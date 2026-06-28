import { DOC_KINDS, DOC_LABELS, DOC_SHORT, type DocKind, type LoadDocs } from "../types";
import { relativeTime } from "../lib/format";

/** Compact row of document pills. Pass onToggle to make them clickable. */
export function DocsBadge({
  docs,
  onToggle,
  kinds = DOC_KINDS,
}: {
  docs?: LoadDocs;
  onToggle?: (kind: DocKind) => void;
  kinds?: DocKind[];
}) {
  return (
    <span style={{ display: "inline-flex", gap: 4 }}>
      {kinds.map((k) => {
        const got = !!docs?.[k]?.received;
        const at = docs?.[k]?.at;
        const title = `${DOC_LABELS[k]}: ${got ? "received" + (at ? " " + relativeTime(at) : "") : "pending"}${onToggle ? " · click to toggle" : ""}`;
        const style: React.CSSProperties = {
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.3,
          padding: "2px 6px",
          borderRadius: 6,
          border: "1px solid " + (got ? "rgba(74,222,128,0.4)" : "var(--line)"),
          color: got ? "var(--green)" : "var(--muted)",
          background: got ? "rgba(74,222,128,0.12)" : "transparent",
          cursor: onToggle ? "pointer" : "default",
          opacity: got ? 1 : 0.6,
        };
        return onToggle ? (
          <button key={k} type="button" title={title} style={style} onClick={() => onToggle(k)}>
            {DOC_SHORT[k]}
          </button>
        ) : (
          <span key={k} title={title} style={style}>
            {DOC_SHORT[k]}
          </span>
        );
      })}
    </span>
  );
}
