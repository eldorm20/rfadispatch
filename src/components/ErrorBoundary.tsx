import { Component, type ReactNode } from "react";

interface State {
  error: Error | null;
}

/** Last-resort crash guard: a render error shows a friendly recovery screen
    instead of a blank page (production requirement). */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("[RFA] render crash:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#02110f", color: "#eafff7", fontFamily: "Inter, system-ui, sans-serif", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#7fa599", fontSize: 14, margin: "0 0 20px" }}>
            The page hit an unexpected error. Your data is safe — reload to continue.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: "10px 22px", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, background: "linear-gradient(135deg,#2dd4bf,#4ade80)", color: "#02110f" }}
          >
            ↻ Reload
          </button>
          <p style={{ color: "#4a6a60", fontSize: 11, marginTop: 18 }}>{String(this.state.error?.message ?? this.state.error)}</p>
        </div>
      </div>
    );
  }
}
