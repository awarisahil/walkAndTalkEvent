import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/useAuth";
import "./AuthPages.css";

interface LocationState {
  from?: { pathname: string };
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from?.pathname;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const next: { email?: string; password?: string } = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter a valid email address.";
    if (password.length === 0) next.password = "Password is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setApiError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const user = await login(email, password);
      // Customers land on home; a guard-redirected login (state.from) returns
      // them to the page they were sent away from.
      const target =
        user.role === "ADMIN" ? "/admin" : (from ?? "/");
      navigate(target, { replace: true });
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1 className="auth-card-title">Welcome back</h1>
        <p className="auth-card-subtitle">Log in to manage your requests and tickets.</p>

        {apiError ? (
          <div className="banner banner-error auth-banner" role="alert">
            {apiError}
          </div>
        ) : null}

        <form onSubmit={(event) => void handleSubmit(event)} noValidate>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              aria-invalid={Boolean(errors.email)}
              onChange={(event) => setEmail(event.target.value)}
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
              onChange={(event) => setPassword(event.target.value)}
            />
            {errors.password ? (
              <span className="field-error" role="alert">{errors.password}</span>
            ) : null}
            <Link to="/forgot-password" className="auth-forgot-link">
              Forgot password?
            </Link>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? <Spinner size="sm" label="Logging in…" /> : "Log in"}
          </button>
        </form>

        <p className="auth-card-footer">
          New to Walk &amp; Talk? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
