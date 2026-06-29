function ago(ms) {
  if (!ms) return "—";
  const m = Math.floor((Date.now() - ms) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  return Math.floor(m / 60) + "h ago";
}

async function render() {
  const { stats = {}, projectId } = await chrome.storage.local.get(["stats", "projectId"]);
  const stateEl = document.getElementById("state");
  if (!projectId) {
    stateEl.innerHTML = '<span class="dot warn"></span>Not configured';
  } else if (stats.lastError) {
    stateEl.innerHTML = '<span class="dot err"></span>Error';
  } else if (stats.lastSync) {
    stateEl.innerHTML = '<span class="dot ok"></span>Synced';
  } else {
    stateEl.innerHTML = '<span class="dot warn"></span>Waiting for Relay';
  }
  document.getElementById("lastSync").textContent = ago(stats.lastSync || stats.lastCapture);
  document.getElementById("lastCount").textContent = stats.lastCount != null ? stats.lastCount + " loads" : "—";
  document.getElementById("cu").textContent =
    stats.created != null ? `${stats.created} / ${stats.updated}` : "—";
  document.getElementById("lastPoll").textContent = stats.lastPollError
    ? `error (${stats.lastPollError})`
    : ago(stats.lastPollAt);
  document.getElementById("err").textContent = stats.lastError || "";
}

document.getElementById("syncNow").addEventListener("click", () => {
  const b = document.getElementById("syncNow");
  b.textContent = "Syncing…";
  chrome.runtime.sendMessage({ type: "RFA_POLL_NOW" }, (r) => {
    void chrome.runtime.lastError;
    b.textContent = r && r.ok ? "Synced ✓" : r && r.reason === "no-request-captured" ? "Open Relay Trips first" : "Failed";
    setTimeout(() => { b.textContent = "↻ Sync now"; render(); }, 1800);
  });
});

document.getElementById("opts").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

render();
