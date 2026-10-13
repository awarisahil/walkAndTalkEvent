import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/useAuth";
import { ApiError } from "../api/client";
import type { RegisterPayload } from "../types";
import "./AuthPages.css";

interface FormState {
  name: string;
  email: string;
  password: string;
  phone: string;
  age: string;
  instagramUsername: string;
  instagramProfileUrl: string;
}

const INITIAL: FormState = {
  name: "",
  email: "",
  password: "",
  phone: "",
  age: "",
  instagramUsername: "",
  instagramProfileUrl: "",
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    if (form.name.trim().length < 2) next.name = "Name must be at least 2 characters.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email address.";
    if (form.password.length < 8) next.password = "Password must be at least 8 characters.";
    if (form.phone && !/^[+\d][\d\s-]{8,14}$/.test(form.phone))
      next.phone = "Enter a valid phone number.";
    if (form.age) {
      const age = Number(form.age);
      if (!Number.isInteger(age) || age < 18 || age > 100)
        next.age = "You must be at least 18 years old.";
    }
    if (form.instagramProfileUrl && !/^https?:\/\/\S+\.\S+/.test(form.instagramProfileUrl))
      next.instagramProfileUrl = "Enter a full URL starting with http:// or https://";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setApiError(null);
    if (!validate()) return;

    const payload: RegisterPayload = {
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
    };
    if (form.phone.trim()) payload.phone = form.phone.trim();
    if (form.age) payload.age = Number(form.age);
    if (form.instagramUsername.trim())
      payload.instagramUsername = form.instagramUsername.trim();
    if (form.instagramProfileUrl.trim())
      payload.instagramProfileUrl = form.instagramProfileUrl.trim();

    setSubmitting(true);
    try {
      const user = await register(payload);
      navigate(user.role === "ADMIN" ? "/admin" : "/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 500) {
        setApiError(
          "Registration failed on our side. Your email may already be in use — try logging in instead.",
        );
      } else {
        setApiError(err instanceof Error ? err.message : "Registration failed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card auth-card-wide">
        <h1 className="auth-card-title">Create your account</h1>
        <p className="auth-card-subtitle">
          Request tickets, pay securely and keep every event in one place.
        </p>

        {apiError ? (
          <div className="banner banner-error auth-banner" role="alert">
            {apiError}
          </div>
        ) : null}

        <form onSubmit={(event) => void handleSubmit(event)} noValidate>
          <div className="field">
            <label htmlFor="reg-name">Full name</label>
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              value={form.name}
              aria-invalid={Boolean(errors.name)}
              onChange={(event) => update("name", event.target.value)}
            />
            {errors.name ? <span className="field-error" role="alert">{errors.name}</span> : null}
          </div>

          <div className="field">
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              value={form.email}
              aria-invalid={Boolean(errors.email)}
              onChange={(event) => update("email", event.target.value)}
            />
            {errors.email ? <span className="field-error" role="alert">{errors.email}</span> : null}
          </div>

          <div className="field">
            <label htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              aria-invalid={Boolean(errors.password)}
              onChange={(event) => update("password", event.target.value)}
            />
            <span className="field-hint">At least 8 characters.</span>
            {errors.password ? (
              <span className="field-error" role="alert">{errors.password}</span>
            ) : null}
          </div>

          <div className="auth-two-col">
            <div className="field">
              <label htmlFor="reg-phone">
                Phone <span className="muted">(optional)</span>
              </label>
              <input
                id="reg-phone"
                type="tel"
                autoComplete="tel"
                value={form.phone}
                aria-invalid={Boolean(errors.phone)}
                onChange={(event) => update("phone", event.target.value)}
              />
              {errors.phone ? (
                <span className="field-error" role="alert">{errors.phone}</span>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="reg-age">
                Age <span className="muted">(optional)</span>
              </label>
              <input
                id="reg-age"
                type="number"
                min={18}
                max={100}
                inputMode="numeric"
                value={form.age}
                aria-invalid={Boolean(errors.age)}
                onChange={(event) => update("age", event.target.value)}
              />
              {errors.age ? <span className="field-error" role="alert">{errors.age}</span> : null}
            </div>
          </div>

          <div className="field">
            <label htmlFor="reg-instagram">
              Instagram username <span className="muted">(optional)</span>
            </label>
            <input
              id="reg-instagram"
              type="text"
              value={form.instagramUsername}
              onChange={(event) => update("instagramUsername", event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="reg-instagram-url">
              Instagram profile URL <span className="muted">(optional)</span>
            </label>
            <input
              id="reg-instagram-url"
              type="url"
              placeholder="https://instagram.com/yourhandle"
              value={form.instagramProfileUrl}
              aria-invalid={Boolean(errors.instagramProfileUrl)}
              onChange={(event) => update("instagramProfileUrl", event.target.value)}
            />
            {errors.instagramProfileUrl ? (
              <span className="field-error" role="alert">{errors.instagramProfileUrl}</span>
            ) : null}
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? <Spinner size="sm" label="Creating account…" /> : "Create account"}
          </button>
        </form>

        <p className="auth-card-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
