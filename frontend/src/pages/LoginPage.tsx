import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/useAuth";
import { requestEmailCode } from "../api/auth";
import "./AuthPages.css";

interface LocationState {
  from?: { pathname: string };
}

type Mode = "code" | "password";

export default function LoginPage() {
  const { login, loginWithCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from?.pathname;

  const [mode, setMode] = useState<Mode>("code");

  // Email-code mode
  const [step, setStep] = useState<1 | 2>(1);
  const [codeEmail, setCodeEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeMessage, setCodeMessage] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeFieldError, setCodeFieldError] = useState<string | null>(null);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeLoginBusy, setCodeLoginBusy] = useState(false);

  // Password mode (organizers)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);

  function navigateByRole(role: "ADMIN" | "CUSTOMER") {
    // Customers land on home; a guard-redirected login (state.from) returns
    // them to the page they were sent away from.
    const target = role === "ADMIN" ? "/admin" : (from ?? "/");
    navigate(target, { replace: true });
  }

  async function handleSendCode(event: FormEvent) {
    event.preventDefault();
    setCodeError(null);
    setCodeFieldError(null);
    if (!/^\S+@\S+\.\S+$/.test(codeEmail)) {
      setCodeFieldError("Enter a valid email address.");
      return;
    }
    setSendingCode(true);
    try {
      const result = await requestEmailCode(codeEmail.trim().toLowerCase());
      setCodeMessage(result.message);
      setCode("");
      setStep(2);
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setSendingCode(false);
    }
  }

  async function handleResend() {
    setCodeError(null);
    setSendingCode(true);
    try {
      const result = await requestEmailCode(codeEmail.trim().toLowerCase());
      setCodeMessage(result.message);
      setCode("");
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : "Could not resend the code.");
    } finally {
      setSendingCode(false);
    }
  }

  async function handleCodeLogin(event: FormEvent) {
    event.preventDefault();
    setCodeError(null);
    setCodeFieldError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setCodeFieldError("Enter the 6-digit code from the email.");
      return;
    }
    setCodeLoginBusy(true);
    try {
      const user = await loginWithCode(codeEmail.trim().toLowerCase(), code.trim());
      navigateByRole(user.role);
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setCodeLoginBusy(false);
    }
  }

  function validatePassword(): boolean {
    const next: { email?: string; password?: string } = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter a valid email address.";
    if (password.length === 0) next.password = "Password is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handlePasswordLogin(event: FormEvent) {
    event.preventDefault();
    setPasswordError(null);
    if (!validatePassword()) return;
    setPasswordBusy(true);
    try {
      const user = await login(email, password);
      navigateByRole(user.role);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1 className="auth-card-title">Welcome back</h1>
        {mode === "code" ? (
          <p className="auth-card-subtitle">
            Enter your email and we&apos;ll send you a login code.
          </p>
        ) : (
          <p className="auth-card-subtitle">Log in with your organizer password.</p>
        )}

        {mode === "code" ? (
          <>
            {codeError ? (
              <div className="banner banner-error auth-banner" role="alert">
                {codeError}
              </div>
            ) : null}

            {step === 1 ? (
              <form onSubmit={(event) => void handleSendCode(event)} noValidate>
                <div className="field">
                  <label htmlFor="login-email">Email</label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={codeEmail}
                    aria-invalid={Boolean(codeFieldError)}
                    onChange={(event) => {
                      setCodeEmail(event.target.value);
                      setCodeFieldError(null);
                    }}
                  />
                  {codeFieldError ? (
                    <span className="field-error" role="alert">{codeFieldError}</span>
                  ) : null}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-block"
                  disabled={sendingCode}
                >
                  {sendingCode ? (
                    <Spinner size="sm" label="Sending…" />
                  ) : (
                    "Email me a login code"
                  )}
                </button>
              </form>
            ) : (
              <>
                {codeMessage ? (
                  <div className="banner banner-success auth-banner" role="status">
                    {codeMessage}
                  </div>
                ) : null}
                <form onSubmit={(event) => void handleCodeLogin(event)} noValidate>
                  <div className="field">
                    <label htmlFor="login-code">Login code</label>
                    <input
                      id="login-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="6-digit code"
                      value={code}
                      aria-invalid={Boolean(codeFieldError)}
                      onChange={(event) => {
                        setCode(event.target.value.replace(/\D/g, ""));
                        setCodeFieldError(null);
                      }}
                    />
                    {codeFieldError ? (
                      <span className="field-error" role="alert">{codeFieldError}</span>
                    ) : null}
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-block"
                    disabled={codeLoginBusy}
                  >
                    {codeLoginBusy ? <Spinner size="sm" label="Logging in…" /> : "Log in"}
                  </button>
                </form>

                <div className="auth-code-links">
                  <button
                    type="button"
                    className="auth-link-btn"
                    disabled={sendingCode}
                    onClick={() => void handleResend()}
                  >
                    {sendingCode ? "Sending…" : "Resend code"}
                  </button>
                  <button
                    type="button"
                    className="auth-link-btn"
                    onClick={() => {
                      setStep(1);
                      setCode("");
                      setCodeFieldError(null);
                      setCodeError(null);
                      setCodeMessage(null);
                    }}
                  >
                    Use a different email
                  </button>
                </div>
              </>
            )}

            <p className="auth-card-footer muted">
              <button
                type="button"
                className="auth-link-btn"
                onClick={() => {
                  setMode("password");
                  setCodeError(null);
                }}
              >
                Organizer? Log in with password
              </button>
            </p>
          </>
        ) : (
          <>
            {passwordError ? (
              <div className="banner banner-error auth-banner" role="alert">
                {passwordError}
              </div>
            ) : null}

            <form onSubmit={(event) => void handlePasswordLogin(event)} noValidate>
              <div className="field">
                <label htmlFor="login-password-email">Email</label>
                <input
                  id="login-password-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  aria-invalid={Boolean(errors.email)}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                />
                {errors.email ? (
                  <span className="field-error" role="alert">{errors.email}</span>
                ) : null}
              </div>

              <div className="field">
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  aria-invalid={Boolean(errors.password)}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                />
                {errors.password ? (
                  <span className="field-error" role="alert">{errors.password}</span>
                ) : null}
                <Link to="/forgot-password" className="auth-forgot-link">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={passwordBusy}
              >
                {passwordBusy ? <Spinner size="sm" label="Logging in…" /> : "Log in"}
              </button>
            </form>

            <p className="auth-card-footer muted">
              <button
                type="button"
                className="auth-link-btn"
                onClick={() => {
                  setMode("code");
                  setPasswordError(null);
                }}
              >
                ← Email me a login code
              </button>
            </p>
          </>
        )}

        <p className="auth-card-footer muted">
          Organizer accounts are created by the platform.
        </p>
      </div>
    </div>
  );
}
