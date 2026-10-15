import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  requestPasswordReset,
  resetPasswordWithOtp,
} from "../api/auth";
import { ApiError } from "../api/client";
import Spinner from "../components/Spinner";
import "./AuthPages.css";

type Step =
  | { phase: "email" }
  | { phase: "reset"; email: string; sentMessage: string }
  | { phase: "done" };

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>({ phase: "email" });
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function validateEmail(): boolean {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return false;
    }
    return true;
  }

  async function handleSendCode(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!validateEmail()) return;

    setBusy(true);
    try {
      const result = await requestPasswordReset(email.trim().toLowerCase());
      setStep({
        phase: "reset",
        email: email.trim().toLowerCase(),
        sentMessage: result.message,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (step.phase !== "reset") return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const result = await requestPasswordReset(step.email);
      setNotice("A new code has been sent.");
      void result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the code.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (step.phase !== "reset") return;

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await resetPasswordWithOtp({
        email: step.email,
        otp: otp.trim(),
        newPassword,
      });
      setStep({ phase: "done" });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Could not reset the password.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1 className="auth-title">Reset your password</h1>

        {step.phase === "email" ? (
          <>
            <p className="muted auth-subcopy">
              Enter the email you signed up with and we will send you a 6-digit
              reset code.
            </p>

            {error ? (
              <div className="banner banner-error auth-banner" role="alert">
                {error}
              </div>
            ) : null}

            <form onSubmit={(event) => void handleSendCode(event)} noValidate>
              <div className="field">
                <label htmlFor="fp-email">Email</label>
                <input
                  id="fp-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  aria-invalid={Boolean(error)}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
                {busy ? <Spinner size="sm" label="Sending…" /> : "Send reset code"}
              </button>
            </form>
          </>
        ) : null}

        {step.phase === "reset" ? (
          <>
            <p className="muted auth-subcopy">{step.sentMessage}</p>

            {error ? (
              <div className="banner banner-error auth-banner" role="alert">
                {error}
              </div>
            ) : null}
            {notice ? (
              <div className="banner banner-success auth-banner" role="status">
                {notice}
              </div>
            ) : null}

            <form onSubmit={(event) => void handleReset(event)} noValidate>
              <div className="field">
                <label htmlFor="fp-otp">Reset code</label>
                <input
                  id="fp-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  maxLength={6}
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, ""))
                  }
                />
              </div>

              <div className="field">
                <label htmlFor="fp-password">New password</label>
                <input
                  id="fp-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="fp-confirm">Confirm new password</label>
                <input
                  id="fp-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
                {busy ? <Spinner size="sm" label="Updating…" /> : "Update password"}
              </button>
            </form>

            <p className="auth-card-footer">
              Did not get the code?{" "}
              <button
                type="button"
                className="btn-link"
                onClick={() => void handleResend()}
                disabled={busy}
              >
                Resend
              </button>
            </p>
          </>
        ) : null}

        {step.phase === "done" ? (
          <>
            <div className="banner banner-success auth-banner" role="status">
              Password updated — you can log in with your new password.
            </div>
            <Link to="/login" className="btn btn-primary btn-block">
              Go to login
            </Link>
          </>
        ) : null}

        <p className="auth-card-footer">
          Remembered it? <Link to="/login">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
