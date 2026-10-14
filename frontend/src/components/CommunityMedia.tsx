import type { CommunityPost } from "../types";
import { instagramShortcode } from "../utils/instagram";

interface CommunityMediaProps {
  post: CommunityPost;
  /** "grid" fills the card width (public page); "thumb" is a compact preview (admin list). */
  variant?: "grid" | "thumb";
}

/** Renders the media payload of a community post according to its type. */
export default function CommunityMedia({ post, variant = "grid" }: CommunityMediaProps) {
  if (post.mediaType === "PHOTO") {
    return (
      <img
        className="community-media-img"
        src={post.mediaUrl}
        alt={post.caption ?? "Community photo"}
        loading="lazy"
      />
    );
  }

  if (post.mediaType === "VIDEO") {
    if (variant === "thumb") {
      return (
        <video className="community-media-video" src={post.mediaUrl} muted preload="metadata" />
      );
    }
    return (
      <video className="community-media-video" src={post.mediaUrl} controls preload="metadata" />
    );
  }

  // INSTAGRAM
  const shortcode = instagramShortcode(post.mediaUrl);
  if (shortcode && variant === "grid") {
    return (
      <iframe
        className="community-media-instagram"
        src={`https://www.instagram.com/p/${shortcode}/embed`}
        title={post.caption ?? "Instagram post"}
        loading="lazy"
        allowTransparency
        scrolling="no"
      />
    );
  }

  // Compact admin preview, or a link card when the URL has no recognizable shortcode.
  return (
    <a
      className={`community-media-instagram-card${variant === "thumb" ? " is-thumb" : ""}`}
      href={post.mediaUrl}
      target="_blank"
      rel="noreferrer"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
      </svg>
      <span>{shortcode ? `Instagram · ${shortcode}` : "View on Instagram"}</span>
    </a>
  );
}
