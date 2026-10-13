import { useState, type FormEvent } from "react";
import Spinner from "../../components/Spinner";
import { useAuth } from "../../context/useAuth";
import { updateMe } from "../../api/users";
import { ApiError } from "../../api/client";
import type { UpdateProfilePayload, User } from "../../types";
import "./DashboardPages.css";

interface FormState {
  name: string;
  email: string;
  phone: string;
  age: string;
  instagramUsername: string;
  instagramProfileUrl: string;
}

function toForm(user: User): FormState {
  return {
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    age: user.age != null ? String(user.age) : "",
    instagramUsername: user.instagramUsername ?? "",
    instagramProfileUrl: user.instagramProfileUrl ?? "",
  };
}

type FieldErrors = Partial<Record<keyof FormState, string>>;

export default function ProfilePage() {
  const { user, setUser } = useAuth();

  if (!user) {
    return (
      <div className="full-page-loading">
        <Spinner size="lg" />
      </div>
    );
  }

  // Remount the form whenever the underlying user record changes identity,
  // so initial form state is always derived fresh (no sync effects needed).
  return <ProfileForm key={user.id} initialUser={user} onSaved={setUser} />;
}

function ProfileForm({
  initialUser,
  onSaved,
}: {
  initialUser: User;
  onSaved: (user: User) => void;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(initialUser));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [success, setSuccess] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setSuccess(null);
  }

  function validate(): boolean {
    const next: FieldErrors = {};
    if (form.name.trim().length < 2) next.name = "Name must be at least 2 characters.";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email address.";
    if (form.phone && !/^[+\d][\d\s-]{8,14}$/.test(form.phone))
      next.phone = "Enter a valid phone number.";
    if (form.age) {
      const age = Number(form.age);
      if (!Number.isInteger(age) || age < 18 || age > 100)
        next.age = "Age must be between 18 and 100.";
    }
    if (form.instagramProfileUrl && !/^https?:\/\/\S+\.\S+/.test(form.instagramProfileUrl))
      next.instagramProfileUrl = "Enter a full URL starting with http:// or https://";
    if (form.instagramUsername.trim().length < 2)
      next.instagramUsername = "Instagram username is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setApiError(null);
    setSuccess(null);
    if (!validate()) return;

    const payload: UpdateProfilePayload = {
      name: form.name.trim(),
      email: form.email.trim(),
    };
    payload.phone = form.phone.trim() ? form.phone.trim() : null;
    payload.age = form.age ? Number(form.age) : null;
    payload.instagramUsername = form.instagramUsername.trim();
    payload.instagramProfileUrl = form.instagramProfileUrl.trim() || null;

    setSaving(true);
    try {
      const updated = await updateMe(payload);
      onSaved(updated);
      setForm(toForm(updated));
      setSuccess("Profile updated successfully.");
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || /already exists/i.test(err.message))) {
        setApiError("That email address is already used by another account.");
      } else {
        setApiError(err instanceof Error ? err.message : "Could not save your profile.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <header className="dash-page-header">
        <h1 className="dash-page-title">Profile</h1>
        <p className="muted">Keep your details up to date for a smooth check-in.</p>
      </header>

      <div className="card dash-card" style={{ maxWidth: 560 }}>
        <div className="detail-grid" style={{ marginBottom: 20 }}>
          <div className="detail-item">
            <span className="detail-item-label">Role</span>
            <span className="detail-item-value">{initialUser.role}</span>
          </div>
          <div className="detail-item">
            <span className="detail-item-label">Member since</span>
            <span className="detail-item-value">
              {new Date(initialUser.createdAt).toLocaleDateString("en-IN", {
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        {apiError ? (
          <div className="banner banner-error" role="alert" style={{ marginBottom: 16 }}>
            {apiError}
          </div>
        ) : null}
        {success ? (
          <div className="banner banner-success" role="status" style={{ marginBottom: 16 }}>
            {success}
          </div>
        ) : null}

        <form onSubmit={(event) => void handleSubmit(event)} noValidate>
          <div className="field">
            <label htmlFor="profile-name">Full name</label>
            <input
              id="profile-name"
              type="text"
              autoComplete="name"
              value={form.name}
              aria-invalid={Boolean(errors.name)}
              onChange={(event) => update("name", event.target.value)}
            />
            {errors.name ? <span className="field-error" role="alert">{errors.name}</span> : null}
          </div>

          <div className="field">
            <label htmlFor="profile-email">Email</label>
            <input
              id="profile-email"
              type="email"
              autoComplete="email"
              value={form.email}
              aria-invalid={Boolean(errors.email)}
              onChange={(event) => update("email", event.target.value)}
            />
            {errors.email ? <span className="field-error" role="alert">{errors.email}</span> : null}
          </div>

          <div className="detail-grid" style={{ gap: 14 }}>
            <div className="field">
              <label htmlFor="profile-phone">
                Phone <span className="muted">(optional)</span>
              </label>
              <input
                id="profile-phone"
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
              <label htmlFor="profile-age">
                Age <span className="muted">(optional)</span>
              </label>
              <input
                id="profile-age"
                type="number"
                min={18}
                max={100}
                value={form.age}
                aria-invalid={Boolean(errors.age)}
                onChange={(event) => update("age", event.target.value)}
              />
              {errors.age ? <span className="field-error" role="alert">{errors.age}</span> : null}
            </div>
          </div>

          <div className="field">
            <label htmlFor="profile-instagram">
              Instagram username <span className="field-required">*</span>
            </label>
            <input
              id="profile-instagram"
              type="text"
              required
              value={form.instagramUsername}
              aria-invalid={Boolean(errors.instagramUsername)}
              onChange={(event) => update("instagramUsername", event.target.value)}
            />
            {errors.instagramUsername ? (
              <span className="field-error" role="alert">{errors.instagramUsername}</span>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="profile-instagram-url">
              Instagram profile URL <span className="muted">(optional)</span>
            </label>
            <input
              id="profile-instagram-url"
              type="url"
              value={form.instagramProfileUrl}
              aria-invalid={Boolean(errors.instagramProfileUrl)}
              onChange={(event) => update("instagramProfileUrl", event.target.value)}
            />
            {errors.instagramProfileUrl ? (
              <span className="field-error" role="alert">{errors.instagramProfileUrl}</span>
            ) : null}
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <Spinner size="sm" label="Saving…" /> : "Save changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
