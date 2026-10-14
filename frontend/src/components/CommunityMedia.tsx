import { useEffect } from "react";
import type { CommunityPost } from "../types";
import { instagramShortcode } from "../utils/instagram";

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

let embedLoader: Promise<void> | null = null;

/** Loads Instagram's embed.js once and (re)processes any blockquote embeds. */
function processInstagramEmbeds(): void {
  if (window.instgrm?.Embeds) {
    window.instgrm.Embeds.process();
    return;
  }
  embedLoader ??= new Promise<void>((resolve) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://www.instagram.com/embed.js";
    script.onload = () => {
      window.instgrm?.Embeds.process();
      resolve();
    };
    script.onerror = () => {
      embedLoader = null; // allow retry on next mount
      resolve();
    };
    document.body.appendChild(script);
  });
  void embedLoader.then(() => window.instgrm?.Embeds.process());
}

interface CommunityMediaProps {
  post: CommunityPost;
  /** "grid" fills the card width (public page); "thumb" is a compact preview (admin list). */
  variant?: "grid" | "thumb";
}

/** Renders the media payload of a community post according to its type. */
export default function CommunityMedia({ post, variant = "grid" }: CommunityMediaProps) {
  const isGridInstagram = post.mediaType === "INSTAGRAM" && variant === "grid";

  useEffect(() => {
    if (isGridInstagram) processInstagramEmbeds();
  }, [isGridInstagram]);

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
  if (shortcode && isGridInstagram) {
    // Official oEmbed-style markup: embed.js finds these blockquotes and
    // replaces them with a fully-sized iframe (auto height — no cropping).
    return (
      <blockquote
        className="instagram-media community-media-instagram"
        data-instgrm-permalink={post.mediaUrl}
        data-instgrm-version="14"
      >
        <a href={post.mediaUrl} target="_blank" rel="noreferrer">
          View this post on Instagram
        </a>
      </blockquote>
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
