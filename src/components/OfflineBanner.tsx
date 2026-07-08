import { useEffect, useState } from "react";

/** Shows a calm banner when the network drops. Firestore keeps working from its
    offline cache and syncs queued changes on reconnect, so this reassures rather
    than alarms — important for a tool sold on being "real-time". */
export function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  if (online) return null;
  return (
    <div
      style={{
        padding: "7px 28px",
        fontSize: 12,
        textAlign: "center",
        background: "rgba(250,204,21,0.12)",
        borderBottom: "1px solid rgba(250,204,21,0.3)",
        color: "var(--gold)",
      }}
    >
      ⚠ You’re offline — the board still works and your changes will sync automatically once you’re back online.
    </div>
  );
}
