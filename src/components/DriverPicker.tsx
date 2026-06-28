import { useMemo, useRef, useState } from "react";
import { useDrivers } from "../hooks/useDrivers";
import type { Driver } from "../types";

/**
 * Searchable driver chooser. Type to filter the roster; pick a driver to fill
 * name + phone + truck + carrier. Free text is still allowed for one-off names.
 */
export function DriverPicker({
  value,
  onPick,
  onText,
  placeholder = "Search drivers…",
}: {
  value: string;
  onPick: (d: Driver) => void;
  onText: (name: string) => void;
  placeholder?: string;
}) {
  const { drivers } = useDrivers();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const blurTimer = useRef<number | undefined>(undefined);

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    const active = drivers.filter((d) => d.active !== false);
    if (!term) return active.slice(0, 8);
    return active
      .filter((d) => `${d.name} ${d.carrier ?? ""} ${d.truck ?? ""}`.toLowerCase().includes(term))
      .slice(0, 8);
  }, [drivers, q]);

  return (
    <div style={{ position: "relative" }}>
      <input
        value={open ? q : value}
        placeholder={placeholder}
        onFocus={() => {
          setQ(value);
          setOpen(true);
        }}
        onChange={(e) => {
          setQ(e.target.value);
          onText(e.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = window.setTimeout(() => setOpen(false), 150);
        }}
      />
      {open && matches.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 20,
            background: "var(--panel-solid)",
            border: "1px solid var(--line-strong)",
            borderRadius: 10,
            overflow: "hidden",
            boxShadow: "var(--shadow)",
            maxHeight: 240,
            overflowY: "auto",
          }}
        >
          {matches.map((d) => (
            <button
              key={d.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                window.clearTimeout(blurTimer.current);
                onPick(d);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "9px 12px",
                background: "transparent",
                border: "none",
                color: "var(--text)",
                cursor: "pointer",
                fontSize: 13,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(45,212,191,0.1)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <strong>{d.name}</strong>
              <span className="muted" style={{ fontSize: 11, marginLeft: 8 }}>
                {[d.carrier, d.truck, d.phone].filter(Boolean).join(" · ")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
