const $ = (id) => document.getElementById(id);
const ago = (ms) => {
  if (!ms) return "—";
  const m = Math.floor((Date.now() - ms) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  return Math.floor(m / 60) + "h ago";
};

async function render() {
  const { auth, profile = {}, state = {}, pollMinutes } = await chrome.storage.local.get(["auth", "profile", "state", "pollMinutes"]);
  const signedIn = !!auth;
  $("loginView").classList.toggle("hide", signedIn);
  $("statusView").classList.toggle("hide", !signedIn);
  if (!signedIn) return;

  $("acct").textContent = profile.name || auth.email;
  $("pollMinutes").value = pollMinutes || 5;
  const stateEl = $("state");
  if (state.lastError) stateEl.innerHTML = '<span class="dot err"></span>Error';
  else if (state.lastSync) stateEl.innerHTML = '<span class="dot ok"></span>Syncing';
  else stateEl.innerHTML = '<span class="dot warn"></span>Waiting for Relay';
  $("lastSync").textContent = ago(state.lastSync || state.lastCapture);
  $("lastCount").textContent = state.lastCount != null ? state.lastCount + " loads" : "—";
  $("cu").textContent = state.created != null ? `${state.created} / ${state.updated}` : "—";
  $("lastPoll").textContent = state.lastPollError ? `error (${state.lastPollError})` : ago(state.lastPollAt);
  $("err").textContent = state.lastError || "";
}

$("signIn").addEventListener("click", () => {
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!email || !password) return;
  const b = $("signIn");
  b.textContent = "Signing in…";
  $("loginErr").textContent = "";
  chrome.runtime.sendMessage({ type: "RFA_SIGN_IN", email, password }, (r) => {
    void chrome.runtime.lastError;
    b.textContent = "Sign in";
    if (r && r.ok) render();
    else $("loginErr").textContent = friendly(r && r.error);
  });
});

$("signOut").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "RFA_SIGN_OUT" }, () => { void chrome.runtime.lastError; render(); });
});

$("syncNow").addEventListener("click", () => {
  const b = $("syncNow");
  b.textContent = "Syncing…";
  chrome.runtime.sendMessage({ type: "RFA_POLL_NOW" }, (r) => {
    void chrome.runtime.lastError;
    b.textContent = r && r.ok ? "Synced ✓" : r && r.reason === "no-request-captured" ? "Open Relay Trips first" : "Failed";
    setTimeout(() => { b.textContent = "↻ Sync now"; render(); }, 1800);
  });
});

$("pollMinutes").addEventListener("change", (e) => {
  chrome.storage.local.set({ pollMinutes: Math.max(1, Number(e.target.value) || 5) });
});

function friendly(code) {
  if (!code) return "Sign-in failed.";
  if (/INVALID|EMAIL_NOT_FOUND|MISSING/.test(code)) return "Wrong email or password.";
  if (/NETWORK/.test(code)) return "Network error — try again.";
  return "Sign-in failed.";
}

render();
