import { Logo } from "../components/Logo";

export function SetupNeeded() {
  return (
    <div className="login-wrap">
      <div className="card login-card" style={{ maxWidth: 520 }}>
        <div className="logo-lg">
          <Logo />
        </div>
        <h1>Almost there</h1>
        <p className="sub">Firebase not configured</p>
        <p className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
          This app needs a Firebase project for logins and real-time data. To connect it:
        </p>
        <ol className="muted" style={{ fontSize: 13, lineHeight: 1.7, paddingLeft: 18 }}>
          <li>
            Copy <code>.env.example</code> to <code>.env</code> in the project root.
          </li>
          <li>
            Paste your web app config from <strong>Firebase Console → Project settings → Your apps</strong>.
          </li>
          <li>
            In Firebase, enable <strong>Authentication → Email/Password</strong> and create your{" "}
            <strong>Firestore database</strong>.
          </li>
          <li>
            Restart <code>npm run dev</code>.
          </li>
        </ol>
      </div>
    </div>
  );
}
