#!/usr/bin/env bash
# Runs ON THE SERVER (invoked by deploy.sh via ssh). Idempotent.
set -euo pipefail

: "${PORT:?}"; : "${IP:?}"; : "${APP_DIR:?}"
: "${DEPLOY_DB_PASSWORD:?}"; : "${DEPLOY_JWT_SECRET:?}"; : "${DEPLOY_ADMIN_PASSWORD:?}"

SUDO() { printf '%s\n' "$DEPLOY_SSH_PASSWORD" | sudo -S -p '' "$@"; }

cd "$APP_DIR"
echo "    [remote] app dir: $APP_DIR"

# --- Node >= 20 (Ubuntu 24.04 apt ships v18 — too old for Vite 8) ----------
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt 20 ]; then
  echo "    [remote] installing Node 22 via nvm…"
  export NVM_DIR="$HOME/.nvm"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash >/dev/null
  fi
  . "$NVM_DIR/nvm.sh"
  nvm install --lts >/dev/null
  nvm alias default lts/* >/dev/null
fi
export PATH="$HOME/.nvm/versions/node/$(ls -1 "$HOME/.nvm/versions/node" 2>/dev/null | sort -V | tail -1)/bin:$PATH" 2>/dev/null || true
echo "    [remote] node $(node -v), npm $(npm -v)"

# --- PostgreSQL --------------------------------------------------------------
if ! command -v psql >/dev/null 2>&1; then
  echo "    [remote] installing PostgreSQL…"
  SUDO apt-get update -y
  SUDO apt-get install -y postgresql postgresql-contrib
fi
SUDO service postgresql start 2>/dev/null || true

PSQL() { SUDO -u postgres psql "$@"; }
if ! PSQL -tAc "SELECT 1 FROM pg_roles WHERE rolname='walkandtalk'" | grep -q 1; then
  echo "    [remote] creating walkandtalk role…"
  PSQL -c "CREATE USER walkandtalk WITH PASSWORD '$DEPLOY_DB_PASSWORD';"
else
  # Keep the role password in sync with the .env generated each deploy.
  PSQL -c "ALTER USER walkandtalk WITH PASSWORD '$DEPLOY_DB_PASSWORD';"
fi
if ! PSQL -tAc "SELECT 1 FROM pg_database WHERE datname='walkandtalk'" | grep -q 1; then
  echo "    [remote] creating walkandtalk database…"
  SUDO -u postgres createdb -O walkandtalk walkandtalk
fi

# --- .env files ---------------------------------------------------------------
# Reuse secrets from a previous deploy (keeps admin password / JWT valid and
# users logged in); only fall back to the freshly generated ones on first run.
ADMIN_PW="$DEPLOY_ADMIN_PASSWORD"
JWT_SECRET="$DEPLOY_JWT_SECRET"
DB_PW="$DEPLOY_DB_PASSWORD"
RAZORPAY_ID=""
RAZORPAY_SECRET=""
if [ -f backend/.env ]; then
  EXISTING="$(cat backend/.env)"
  EXISTING_ADMIN="$(printf '%s\n' "$EXISTING" | grep '^ADMIN_PASSWORD=' | cut -d= -f2- || true)"
  EXISTING_JWT="$(printf '%s\n' "$EXISTING" | grep '^JWT_ACCESS_SECRET=' | cut -d= -f2- || true)"
  EXISTING_DBPW="$(printf '%s\n' "$EXISTING" | grep -o 'walkandtalk:[^@]*@localhost' | cut -d: -f2 || true)"
  RAZORPAY_ID="$(printf '%s\n' "$EXISTING" | grep '^RAZORPAY_KEY_ID=' | cut -d= -f2- || true)"
  RAZORPAY_SECRET="$(printf '%s\n' "$EXISTING" | grep '^RAZORPAY_KEY_SECRET=' | cut -d= -f2- || true)"
  [ -n "$EXISTING_ADMIN" ] && ADMIN_PW="$EXISTING_ADMIN"
  [ -n "$EXISTING_JWT" ] && JWT_SECRET="$EXISTING_JWT"
  [ -n "$EXISTING_DBPW" ] && DB_PW="$EXISTING_DBPW"
fi
# The DB role password must match whatever we keep in .env.
PSQL -c "ALTER USER walkandtalk WITH PASSWORD '$DB_PW';"

# --- .env files ---------------------------------------------------------------
cat > backend/.env <<EOF
NODE_ENV=production
PORT=$PORT
CORS_ORIGIN=http://$IP:$PORT
SERVE_STATIC_DIR=$APP_DIR/frontend/dist
DATABASE_URL="postgresql://walkandtalk:$DB_PW@localhost:5432/walkandtalk?schema=public"
JWT_ACCESS_SECRET=$JWT_SECRET
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30
PAYMENT_RESERVATION_MINUTES=30
ADMIN_EMAIL=admin@eventplatform.com
ADMIN_PASSWORD=$ADMIN_PW
SEED_DEMO_DATA=false
RAZORPAY_KEY_ID=$RAZORPAY_ID
RAZORPAY_KEY_SECRET=$RAZORPAY_SECRET
EOF
cat > frontend/.env <<EOF
VITE_API_URL=http://$IP:$PORT/api
EOF

# --- Backend ------------------------------------------------------------------
echo "    [remote] backend: npm ci…"
cd "$APP_DIR/backend"
npm ci --no-audit --no-fund
echo "    [remote] backend: prisma generate + migrate…"
npx prisma generate
npx prisma migrate deploy
echo "    [remote] backend: seed (upsert only — never wipes data)…"
npx tsx prisma/seed.ts
echo "    [remote] backend: build…"
npm run build
npm prune --omit=dev

# --- Frontend -----------------------------------------------------------------
echo "    [remote] frontend: npm ci + build…"
cd "$APP_DIR/frontend"
npm ci --no-audit --no-fund
npm run build

# --- Restart app ---------------------------------------------------------------
echo "    [remote] restarting app…"
mkdir -p "$APP_DIR/.run"
# Kill whatever actually listens on our port (pid files can go stale).
# The `|| true` inside the substitution is required: with pipefail+set -e,
# grep finding no listener would otherwise abort the whole script.
OLD_PID="$(ss -ltnp 2>/dev/null | grep ":$PORT " | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2 || true)"
if [ -n "$OLD_PID" ]; then kill "$OLD_PID" 2>/dev/null || true; fi
sleep 1
cd "$APP_DIR/backend"
NODE_ENV=production nohup node dist/server.js > "$APP_DIR/.run/app.log" 2>&1 &
sleep 2
# Record the REAL listener pid, not the backgrounded job pid.
RUN_PID="$(ss -ltnp 2>/dev/null | grep ":$PORT " | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2 || true)"
echo "$RUN_PID" > "$APP_DIR/.run/app.pid"
echo "$PORT" > "$APP_DIR/.run/app-port"

# --- Firewall (best effort — never fails the deploy) ---------------------------
SUDO ufw allow "$PORT/tcp" >/dev/null 2>&1 || true

echo "    [remote] waiting for health check…"
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    echo "    [remote] app is healthy on port $PORT"
    exit 0
  fi
  sleep 1
done
echo "    [remote] WARNING: health check did not pass in 30s — check .run/app.log"
tail -n 20 "$APP_DIR/.run/app.log" || true
exit 1
