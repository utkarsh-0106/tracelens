(function () {
  "use strict";
  const script = document.currentScript;
  const apiBase = (script && script.dataset.apiBase) || "http://localhost:5000";
  const storageKey = "tracelens_session_id";
  const sessionId = getSessionId();

  function getSessionId() {
    try {
      let id = localStorage.getItem(storageKey);
      if (!id) {
        id = "sess_" + (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
        localStorage.setItem(storageKey, id);
      }
      return id;
    } catch {
      return "sess_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
  }

  function send(type, extra) {
    const payload = {
      session_id: sessionId,
      event_type: type,
      page_url: window.location.href,
      timestamp: new Date().toISOString(),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      scroll: { x: Math.max(0, window.scrollX || 0), y: Math.max(0, window.scrollY || 0) },
      ...(extra || {})
    };
    try {
      fetch(apiBase.replace(/\/$/, "") + "/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    } catch { /* Tracking must never block normal page interaction. */ }
  }

  if (!window.__tracelensInitialized) {
    window.__tracelensInitialized = true;
    send("page_view");
    document.addEventListener("click", function (event) {
      const target = event.target && event.target.closest ? event.target.closest("a,button,[data-track]") : event.target;
      if (!target) return;
      send("click", { coordinates: { x: Math.max(0, event.clientX), y: Math.max(0, event.clientY) } });
    }, { passive: true });
  }
})();
