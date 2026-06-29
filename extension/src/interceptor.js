/* Runs in the PAGE's MAIN world at document_start. Wraps fetch + XHR so we can
   read Amazon Relay's own API responses (which carry the CSRF token / auth we
   can't replay). When a Trips (entitiesV2) response comes back, we forward the
   parsed JSON to the isolated content script via window.postMessage.

   Read-only: we never modify requests or responses. */
(() => {
  const TARGETS = [
    { key: "trips", match: "/api/tours/entitiesV2" },
    { key: "loadboard", match: "/api/loadboard/search" },
  ];
  const matchOf = (url) => TARGETS.find((t) => typeof url === "string" && url.includes(t.match));

  function forward(key, json) {
    try {
      window.postMessage({ __rfa: true, key, payload: json }, window.location.origin);
    } catch (e) {
      /* ignore */
    }
  }

  // --- fetch ---
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
      const t = matchOf(url);
      if (t && res.ok) {
        res
          .clone()
          .json()
          .then((j) => forward(t.key, j))
          .catch(() => {});
      }
    } catch (e) {
      /* ignore */
    }
    return res;
  };

  // --- XMLHttpRequest ---
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__rfaTarget = matchOf(url);
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (...sendArgs) {
    if (this.__rfaTarget) {
      this.addEventListener("load", () => {
        try {
          if (this.status >= 200 && this.status < 300) {
            forward(this.__rfaTarget.key, JSON.parse(this.responseText));
          }
        } catch (e) {
          /* ignore */
        }
      });
    }
    return origSend.apply(this, sendArgs);
  };

  console.debug("[RFA] Relay interceptor active");
})();
