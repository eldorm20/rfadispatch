import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import { Logo } from "../components/Logo";

export function Login() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function forgot() {
    setErr("");
    setInfo("");
    if (!email.trim()) {
      setErr("Enter your email first, then tap “Forgot password”.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo("Reset link sent — check your inbox.");
    } catch {
      setErr("Couldn’t send the reset email. Check the address.");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await signIn(email, password);
      nav("/", { replace: true });
    } catch (ex) {
      const code = (ex as { code?: string }).code ?? "";
      setErr(
        code.includes("invalid") || code.includes("wrong") || code.includes("not-found")
          ? "Wrong email or password."
          : "Couldn’t sign in. Check your connection and try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <div className="logo-lg">
          <Logo />
        </div>
        <h1>RFA DISPATCH</h1>
        <p className="sub">Transportation Management System</p>

        <div className="field" style={{ marginBottom: 14 }}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="username" required />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
        </div>
        <div className="err">{err || (info && <span style={{ color: "var(--green)" }}>{info}</span>)}</div>

        <button className="btn primary" style={{ width: "100%" }} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <div style={{ textAlign: "center", marginTop: 14 }}>
          <a href="#" style={{ fontSize: 12, color: "var(--muted)" }} onClick={(e) => { e.preventDefault(); void forgot(); }}>
            Forgot password?
          </a>
        </div>
      </form>
    </div>
  );
}
