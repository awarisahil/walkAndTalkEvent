/** Extracts an Instagram shortcode from a post/reel URL, or null when it doesn't match. */
export function instagramShortcode(url: string): string | null {
  const match = /(?:instagram\.com\/(?:p|reel)\/)([\w-]+)/.exec(url);
  return match ? match[1] : null;
}
