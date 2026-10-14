import { useCallback, useState } from "react";
import { fetchCommunityPosts } from "../api/community";
import CommunityMedia from "../components/CommunityMedia";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import MediaLightbox from "../components/MediaLightbox";
import { useAsyncData } from "../hooks/useAsyncData";
import type { CommunityMediaType, CommunityPost } from "../types";
import { formatDate } from "../utils/format";
import "./CommunityPage.css";

type TypeFilter = CommunityMediaType | "ALL";

const FILTER_CHIPS: Array<{ value: TypeFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "PHOTO", label: "Photos" },
  { value: "VIDEO", label: "Videos" },
  { value: "INSTAGRAM", label: "Instagram" },
];

const EXPAND_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6" />
  </svg>
);

function CommunityCard({
  post,
  onExpand,
}: {
  post: CommunityPost;
  onExpand: (post: CommunityPost) => void;
}) {
  const expandable = post.mediaType !== "INSTAGRAM";

  function openViewer() {
    if (expandable) onExpand(post);
  }

  return (
    <article className={`card community-card${expandable ? " is-expandable" : ""}`}>
      <div
        className="community-card-media"
        role={expandable ? "button" : undefined}
        tabIndex={expandable ? 0 : undefined}
        aria-label={
          expandable
            ? post.mediaType === "PHOTO"
              ? "View photo full screen"
              : "Play video"
            : undefined
        }
        onClick={openViewer}
        onKeyDown={(event) => {
          if (expandable && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            onExpand(post);
          }
        }}
      >
        <CommunityMedia post={post} />
        {expandable ? <span className="community-card-expand">{EXPAND_ICON}</span> : null}
      </div>
      {(post.caption || post.event) && (
        <div className="community-card-body">
          {post.caption ? <p className="community-card-caption">{post.caption}</p> : null}
          {post.event ? (
            <span className="community-event-chip">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="17" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              {post.event.title} · {formatDate(post.event.date)}
            </span>
          ) : null}
        </div>
      )}
    </article>
  );
}

function CommunitySkeleton() {
  return (
    <div className="community-card" aria-hidden="true">
      <div className="skeleton community-skeleton-media" />
      <div className="community-card-body">
        <div className="skeleton" style={{ height: 14, width: "85%" }} />
        <div className="skeleton" style={{ height: 14, width: "45%" }} />
      </div>
    </div>
  );
}

export default function CommunityPage() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [viewerPost, setViewerPost] = useState<CommunityPost | null>(null);
  const closeViewer = useCallback(() => setViewerPost(null), []);
  const query = useAsyncData(
    () => fetchCommunityPosts({ mediaType: typeFilter === "ALL" ? undefined : typeFilter }),
    [typeFilter],
  );

  return (
    <div className="container community-page">
      <header className="community-header">
        <h1 className="section-title">
          <svg
            className="section-title-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 21c-4.5-2.5-7-6-7-10a7 7 0 0 1 14 0c0 4-2.5 7.5-7 10z" />
            <path d="M12 3v18" strokeDasharray="1 4" />
          </svg>
          Community moments
        </h1>
        <p className="muted">Photos, reels and memories from our past walks.</p>
      </header>

      <div className="community-filters" role="group" aria-label="Filter by media type">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            className={`community-chip${typeFilter === chip.value ? " is-active" : ""}`}
            aria-pressed={typeFilter === chip.value}
            onClick={() => setTypeFilter(chip.value)}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {query.status === "loading" ? (
        <div className="community-grid" aria-label="Loading moments">
          {Array.from({ length: 6 }, (_, i) => (
            <CommunitySkeleton key={i} />
          ))}
        </div>
      ) : query.status === "error" ? (
        <ErrorState message={query.message} onRetry={query.reload} />
      ) : query.data.length === 0 ? (
        <EmptyState
          title="No moments yet"
          message="No moments yet — check back after the next event!"
        />
      ) : (
        <div className="community-grid">
          {query.data.map((post) => (
            <CommunityCard key={post.id} post={post} onExpand={setViewerPost} />
          ))}
        </div>
      )}

      {viewerPost && viewerPost.mediaType !== "INSTAGRAM" ? (
        <MediaLightbox post={viewerPost} onClose={closeViewer} />
      ) : null}
    </div>
  );
}
