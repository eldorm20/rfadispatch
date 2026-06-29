const FIELDS = ["projectId", "apiKey", "syncEmail", "syncPassword", "dispatcherName"];

async function load() {
  const cfg = await chrome.storage.local.get(FIELDS);
  for (const f of FIELDS) document.getElementById(f).value = cfg[f] || "";
}

document.getElementById("save").addEventListener("click", async () => {
  const patch = {};
  for (const f of FIELDS) patch[f] = document.getElementById(f).value.trim();
  await chrome.storage.local.set(patch);
  const s = document.getElementById("status");
  s.textContent = "Saved ✓";
  setTimeout(() => (s.textContent = ""), 2000);
});

load();
