#!/usr/bin/env bash
#
# Deploy Walk & Talk Events to the VPS.
#
# Usage:
#   DEPLOY_SSH_PASSWORD='your-ssh-password' ./deploy/deploy.sh
# or run without the env var and you will be prompted.
#
# The script:
#   1. Picks a FREE port on the server (starting at 5050) — existing
#      services/ports on the VPS are never touched.
#   2. Generates secrets (DB password, JWT secret, admin password).
#   3. Rsyncs the project (excluding node_modules, dist, .env, .git).
#   4. Installs Node 22 (via nvm) and PostgreSQL if missing.
#   5. Creates the walkandtalk role + database if missing.
#   6. Builds backend + frontend and runs migrations + admin seed.
#   7. Starts the app with nohup (API + frontend on the chosen port).
#
set -euo pipefail

SERVER="devzone@65.21.8.185"
IP="65.21.8.185"
APP_NAME="walkAndTalkEvent"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -z "${DEPLOY_SSH_PASSWORD:-}" ]; then
  read -rsp "SSH password for $SERVER: " DEPLOY_SSH_PASSWORD
  echo
fi
export DEPLOY_SSH_PASSWORD

# --- password helper for ssh/rsync (OpenSSH >= 8.4) -------------------------
ASKPASS="$(mktemp)"
trap 'rm -f "$ASKPASS"' EXIT
cat > "$ASKPASS" <<'ASKPASS_EOF'
#!/bin/sh
printf '%s\n' "$DEPLOY_SSH_PASSWORD"
ASKPASS_EOF
chmod 700 "$ASKPASS"
export SSH_ASKPASS="$ASKPASS" SSH_ASKPASS_REQUIRE=force

SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)
RSYNC_SSH="$(printf '%q ' ssh "${SSH_OPTS[@]}")"

echo "==> Checking SSH connection…"
ssh "${SSH_OPTS[@]}" "$SERVER" 'echo ok' >/dev/null

REMOTE_HOME="$(ssh "${SSH_OPTS[@]}" "$SERVER" 'echo "$HOME"')"
REMOTE_DIR="$REMOTE_HOME/MyCenter/projects/$APP_NAME"

echo "==> Choosing app port on the server (sticky: reuses this app's port)…"
PORT="$(ssh "${SSH_OPTS[@]}" "$SERVER" '
  APP_DIR="$HOME/MyCenter/projects/walkAndTalkEvent"
  PORT_FILE="$APP_DIR/.run/app-port"
  PID_FILE="$APP_DIR/.run/app.pid"
  listener_pid() { ss -ltnp 2>/dev/null | grep ":$1 " | grep -o "pid=[0-9]*" | head -1 | cut -d= -f2; }

  if [ -f "$PORT_FILE" ]; then
    P="$(cat "$PORT_FILE")"
    LP="$(listener_pid "$P")"
    if [ -z "$LP" ]; then echo "$P"; exit 0; fi
    if [ -f "$PID_FILE" ] && [ "$LP" = "$(cat "$PID_FILE")" ]; then
      echo "$P"; exit 0
    fi
  fi
  for p in 5050 5051 5052 5053 5054 8080 8081 8082; do
    ss -ltn 2>/dev/null | grep -q ":$p " || { echo "$p"; exit 0; }
  done
  echo ""
')"
if [ -z "$PORT" ]; then
  echo "No free port found in candidate range." >&2
  exit 1
fi
echo "    Using port $PORT"

echo "==> Generating secrets…"
DB_PASSWORD="$(openssl rand -hex 16)"
JWT_SECRET="$(openssl rand -hex 32)"
ADMIN_PASSWORD="$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 14)"

echo "==> Syncing project to $SERVER:$REMOTE_DIR …"
ssh "${SSH_OPTS[@]}" "$SERVER" "mkdir -p $REMOTE_DIR"
rsync -az --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude 'dist' \
  --exclude 'backend/dist' \
  --exclude 'frontend/dist' \
  --exclude 'backend/tests' \
  --exclude 'backend/uploads' \
  -e "$RSYNC_SSH" \
  "$REPO_ROOT/" "$SERVER:$REMOTE_DIR/"

echo "==> Running remote setup (this can take several minutes)…"
ssh "${SSH_OPTS[@]}" "$SERVER" \
  "PORT='$PORT' \
   IP='$IP' \
   APP_DIR='$REMOTE_DIR' \
   DEPLOY_SSH_PASSWORD='$DEPLOY_SSH_PASSWORD' \
   DEPLOY_DB_PASSWORD='$DB_PASSWORD' \
   DEPLOY_JWT_SECRET='$JWT_SECRET' \
   DEPLOY_ADMIN_PASSWORD='$ADMIN_PASSWORD' \
   bash -s" < "$SCRIPT_DIR/remote-setup.sh"

echo
echo "==> Verifying deployment…"
sleep 2
LOCAL_CHECK="$(curl -sf --max-time 10 "http://$IP:$PORT/api/health" && echo "" || echo "FAILED")"
if [ "$LOCAL_CHECK" = "FAILED" ]; then
  echo "WARNING: public health check failed — the app may still be starting,"
  echo "or the VPS firewall needs:  sudo ufw allow $PORT/tcp"
  ssh "${SSH_OPTS[@]}" "$SERVER" 'tail -n 30 "$HOME/MyCenter/projects/walkAndTalkEvent/.run/app.log"' || true
  exit 1
fi
echo "    $LOCAL_CHECK"
echo "    Frontend:   http://$IP:$PORT/"
echo "    API health: http://$IP:$PORT/api/health"
EFFECTIVE_ADMIN_PW="$(ssh "${SSH_OPTS[@]}" "$SERVER" "grep '^ADMIN_PASSWORD=' $REMOTE_DIR/backend/.env | cut -d= -f2-")"
echo
echo "Admin login:    admin@eventplatform.com / $EFFECTIVE_ADMIN_PW"
echo "To redeploy later, just run this script again."
