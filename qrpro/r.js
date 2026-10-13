/* QR Pro — scan logger + redirect. Runs on r.html?id=<qrId> */
"use strict";

(function () {
  function getId() {
    try { return new URLSearchParams(location.search).get("id"); }
    catch (_) { return null; }
  }

  function showNotFound() {
    const l = document.getElementById("loading");
    const n = document.getElementById("notfound");
    if (l) l.hidden = true;
    if (n) n.hidden = false;
    document.title = "QR Pro — not found";
  }

  document.addEventListener("DOMContentLoaded", () => {
    const id = getId();
    const qrs = (typeof loadQrs === "function") ? loadQrs() : [];
    const q = qrs.find((x) => x.id === id);

    if (!q || !/^https:\/\//i.test(q.url || "")) {
      showNotFound(); // no redirect for unknown/deleted ids
      return;
    }

    // Log the scan synchronously BEFORE redirecting.
    try {
      const scans = (typeof loadScans === "function") ? loadScans() : [];
      scans.push({
        qrId: q.id,
        ts: Date.now(),
        ua: navigator.userAgent || "",
        ref: document.referrer || "",
      });
      if (scans.length > 20000) scans.splice(0, scans.length - 20000); // cap growth
      if (typeof save === "function") save("qrp_scans", scans);
    } catch (_) { /* storage full/blocked — still redirect */ }

    location.replace(q.url);
  });
})();
