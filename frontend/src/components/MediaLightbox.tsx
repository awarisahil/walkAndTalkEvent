import { useEffect, useRef } from "react";
import type { CommunityPost } from "../types";
import { formatDate } from "../utils/format";
import "./MediaLightbox.css";

interface MediaLightboxProps {
  post: CommunityPost;
  onClose: () => void;
}

/**
 * Full-view viewer for community media: contain-fit photo overlay or a
 * Reels-style vertical video player. Closes via ×, ESC, or backdrop click.
 */
export default function MediaLightbox({ post, onClose }: MediaLightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const isVideo = post.mediaType === "VIDEO";

  return (
    <div
      className="media-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={isVideo ? `Video: ${post.caption ?? post.event?.title ?? "community moment"}` : `Photo: ${post.caption ?? post.event?.title ?? "community moment"}`}
      onClick={onClose}
    >
      <button
        ref={closeRef}
        type="button"
        className="media-lightbox-close"
        aria-label="Close viewer"
        onClick={onClose}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <div
        className={`media-lightbox-body${isVideo ? " is-video" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        {isVideo ? (
          <video
            className="media-lightbox-video"
            src={post.mediaUrl}
            controls
            autoPlay
            muted
            playsInline
          />
        ) : (
          <img className="media-lightbox-img" src={post.mediaUrl} alt={post.caption ?? "Community photo"} />
        )}

        {(post.caption || post.event) && (
          <div className="media-lightbox-info">
            {post.caption ? <p className="media-lightbox-caption">{post.caption}</p> : null}
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
      </div>
    </div>
  );
}
