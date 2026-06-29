/* Isolated-world content script. Receives captured Relay JSON from the page
   (interceptor.js via postMessage), maps it to TMS loads, and hands them to the
   background service worker to sync. */
(() => {
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const d = event.data;
    if (!d || d.__rfa !== true) return;
    if (d.key !== "trips") return; // loadboard handled later

    let loads = [];
    try {
      loads = globalThis.__rfaMapRelayResponse(d.payload) || [];
    } catch (e) {
      console.warn("[RFA] mapping failed", e);
      return;
    }
    if (!loads.length) return;

    chrome.runtime.sendMessage({ type: "RFA_LOADS", loads }, (resp) => {
      // swallow "no receiver" errors when the SW is asleep
      void chrome.runtime.lastError;
      if (resp && resp.ok) console.debug(`[RFA] synced ${loads.length} loads`);
    });
  });

  console.debug("[RFA] Relay content bridge active");
})();
