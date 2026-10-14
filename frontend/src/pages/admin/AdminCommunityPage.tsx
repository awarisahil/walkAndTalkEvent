import { useState, type FormEvent } from "react";
import { fetchAdminEvents } from "../../api/events";
import {
  createCommunityPost,
  deleteCommunityPost,
  fetchCommunityPosts,
} from "../../api/community";
import CommunityMedia from "../../components/CommunityMedia";
import ConfirmDialog from "../../components/ConfirmDialog";
import EmptyState from "../../components/EmptyState";
import ErrorState from "../../components/ErrorState";
import Spinner from "../../components/Spinner";
import { useAsyncData } from "../../hooks/useAsyncData";
import type { CommunityMediaType, CommunityPost } from "../../types";
import { formatDateTime } from "../../utils/format";
import "./AdminPages.css";
import "./AdminCommunityPage.css";

const MEDIA_TYPE_OPTIONS: Array<{ value: CommunityMediaType; label: string }> = [
  { value: "PHOTO", label: "Photo" },
  { value: "VIDEO", label: "Video" },
  { value: "INSTAGRAM", label: "Instagram post" },
];

interface FormState {
  mediaType: CommunityMediaType;
  mediaUrl: string;
  caption: string;
  eventId: string;
}

export default function AdminCommunityPage() {
  const postsQuery = useAsyncData(() => fetchCommunityPosts());
  const eventsQuery = useAsyncData(() => fetchAdminEvents({ page: 1, pageSize: 100 }));

  const [form, setForm] = useState<FormState>({
    mediaType: "PHOTO",
    mediaUrl: "",
    caption: "",
    eventId: "",
  });
  const [urlError, setUrlError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [localPosts, setLocalPosts] = useState<CommunityPost[]>([]);
  const [deletedIds, setDeletedIds] = useState<ReadonlySet<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<CommunityPost | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function update<Field extends keyof FormState>(field: Field, value: FormState[Field]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "mediaUrl") setUrlError(null);
    setApiError(null);
    setSuccess(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const url = form.mediaUrl.trim();
    if (!/^https?:\/\/\S+\.\S+/.test(url)) {
      setUrlError("Enter a full URL starting with http:// or https://");
      return;
    }

    setSubmitting(true);
    setApiError(null);
    setSuccess(null);
    try {
      const created = await createCommunityPost({
        mediaType: form.mediaType,
        mediaUrl: url,
        ...(form.caption.trim() ? { caption: form.caption.trim() } : {}),
        ...(form.eventId ? { eventId: form.eventId } : {}),
      });
      setLocalPosts((prev) => [created, ...prev]);
      setForm({ mediaType: form.mediaType, mediaUrl: "", caption: "", eventId: "" });
      setSuccess("Post added to the community feed.");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Could not add the post.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteCommunityPost(deleteTarget.id);
      setDeletedIds((prev) => new Set(prev).add(deleteTarget.id));
      setLocalPosts((prev) => prev.filter((post) => post.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete the post.");
    } finally {
      setDeleting(false);
    }
  }

  const posts =
    postsQuery.status === "ready"
      ? [...localPosts, ...postsQuery.data.filter((post) => !deletedIds.has(post.id))]
      : localPosts;

  return (
    <div>
      <header className="admin-page-header">
        <h1 className="admin-page-title">Community</h1>
        <p className="muted">Share photos, videos and Instagram reels from past events.</p>
      </header>

      <section className="admin-section">
        <div className="card admin-card" style={{ maxWidth: 640 }}>
          <h2 className="admin-section-title">Add post</h2>
          <form onSubmit={(event) => void handleSubmit(event)} noValidate>
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

            <div className="detail-grid" style={{ gap: 14 }}>
              <div className="field">
                <label htmlFor="cp-type">Media type</label>
                <select
                  id="cp-type"
                  value={form.mediaType}
                  onChange={(event) =>
                    update("mediaType", event.target.value as CommunityMediaType)
                  }
                >
                  {MEDIA_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="cp-event">Linked event</label>
                <select
                  id="cp-event"
                  value={form.eventId}
                  onChange={(event) => update("eventId", event.target.value)}
                  disabled={eventsQuery.status !== "ready"}
                >
                  <option value="">Not linked to an event</option>
                  {eventsQuery.status === "ready"
                    ? eventsQuery.data.items.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.title} · {formatDateTime(event.date)}
                        </option>
                      ))
                    : null}
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="cp-url">
                Media URL{" "}
                <span className="muted">
                  (direct image/video link, or an Instagram post/reel URL)
                </span>
              </label>
              <input
                id="cp-url"
                type="url"
                placeholder="https://…"
                value={form.mediaUrl}
                aria-invalid={Boolean(urlError)}
                onChange={(event) => update("mediaUrl", event.target.value)}
              />
              {urlError ? (
                <span className="field-error" role="alert">{urlError}</span>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="cp-caption">
                Caption <span className="muted">(optional)</span>
              </label>
              <textarea
                id="cp-caption"
                rows={3}
                value={form.caption}
                onChange={(event) => update("caption", event.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <Spinner size="sm" label="Adding…" /> : "Add post"}
            </button>
          </form>
        </div>
      </section>

      <section className="admin-section">
        <h2 className="admin-section-title">All posts</h2>
        {deleteError ? (
          <div className="banner banner-error" role="alert" style={{ marginBottom: 16 }}>
            {deleteError}
          </div>
        ) : null}

        {postsQuery.status === "loading" ? (
          <div className="full-page-loading">
            <Spinner size="lg" label="Loading posts…" />
          </div>
        ) : postsQuery.status === "error" ? (
          <ErrorState message={postsQuery.message} onRetry={postsQuery.reload} />
        ) : posts.length === 0 ? (
          <EmptyState
            title="No community posts yet"
            message="Add the first photo, video or reel from a past event."
          />
        ) : (
          <div className="admin-post-list">
            {posts.map((post) => (
              <div className="card admin-post-row" key={post.id}>
                <div className="admin-post-thumb">
                  <CommunityMedia post={post} variant="thumb" />
                </div>
                <div className="admin-post-info">
                  <span className="admin-post-type">{post.mediaType.toLowerCase()}</span>
                  {post.caption ? (
                    <span className="admin-post-caption">{post.caption}</span>
                  ) : (
                    <span className="muted" style={{ fontSize: "0.85rem" }}>
                      No caption
                    </span>
                  )}
                  <span className="muted" style={{ fontSize: "0.8rem" }}>
                    {post.event
                      ? `${post.event.title} · ${formatDateTime(post.event.date)}`
                      : "Not linked to an event"}{" "}
                    · added {formatDateTime(post.createdAt)}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteTarget(post);
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this post?"
        message="This moment will be removed from the community feed. This cannot be undone."
        confirmLabel="Delete post"
        danger
        busy={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
