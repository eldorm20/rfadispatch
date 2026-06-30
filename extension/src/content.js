/* Isolated-world bridge. Forwards captured Relay data from the page
   (interceptor.js) to the background worker, which does the mapping + sync. */
(() => {
  function send(msg) {
    try {
      chrome.runtime.sendMessage(msg, () => void chrome.runtime.lastError);
    } catch (e) {
      /* SW asleep — ignore */
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const d = event.data;
    if (!d || d.__rfa !== true) return;

    if (d.key === "trips") send({ type: "RFA_TRIPS_RAW", payload: d.payload });
    else if (d.key === "trips-request") send({ type: "RFA_TRIPS_REQUEST", request: d.request });
    else if (d.key === "tracking") send({ type: "RFA_TRACKING_RAW", payload: d.payload });
  });

  console.debug("[RFA] Relay content bridge active");
})();
