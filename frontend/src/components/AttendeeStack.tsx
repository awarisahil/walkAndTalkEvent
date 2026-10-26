import "./AttendeeStack.css";

/**
 * Deterministic subtle tint per name so neighboring chips differ slightly
 * without leaving the stone/ink palette.
 */
const CHIP_TINTS: Array<{ bg: string; fg: string }> = [
  { bg: "#f5f5f4", fg: "#1c1917" }, // stone-100 / ink
  { bg: "#e7e5e4", fg: "#1c1917" }, // stone-200 / ink
  { bg: "#f0fdf4", fg: "#15803d" }, // green-50 / green-700
  { bg: "#fff7ed", fg: "#c2410c" }, // orange-50 / orange-700
  { bg: "#f0f9ff", fg: "#0369a1" }, // sky-50 / sky-700
  { bg: "#faf5ff", fg: "#7e22ce" }, // purple-50 / purple-700
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface AttendeeStackProps {
  /** Up to 6 confirmed attendee names (may be fewer than `count`). */
  names: string[];
  /** Total confirmed attendee count. */
  count: number;
  /** Chip diameter in px (28 default, 36 for the large detail variant). */
  size?: number;
  /** Max chips to render before the "+N" overflow chip. */
  maxChips?: number;
}

export default function AttendeeStack({
  names,
  count,
  size = 28,
  maxChips = 5,
}: AttendeeStackProps) {
  if (count <= 0) return null;

  const shown = names.slice(0, maxChips);
  const remaining = count - shown.length;
  const fontSize = Math.round(size * 0.36);

  return (
    <span
      className="attendee-stack"
      role="list"
      aria-label={`${count} attendee${count === 1 ? "" : "s"}: ${names.join(", ")}${remaining > 0 ? ` and ${remaining} more` : ""}`}
    >
      {shown.map((name) => {
        const tint = CHIP_TINTS[hashName(name) % CHIP_TINTS.length];
        return (
          <span
            key={name}
            role="listitem"
            className="attendee-chip"
            title={name}
            style={{
              width: size,
              height: size,
              fontSize,
              background: tint.bg,
              color: tint.fg,
            }}
          >
            {initials(name)}
          </span>
        );
      })}
      {remaining > 0 ? (
        <span
          className="attendee-chip attendee-chip-more"
          style={{ width: size, height: size, fontSize }}
          title={`${remaining} more attendee${remaining === 1 ? "" : "s"}`}
        >
          +{remaining}
        </span>
      ) : null}
    </span>
  );
}
