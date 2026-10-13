/* White-label ScanQ — live preview renderer.
   Reads branding config from localStorage (wl_config), re-renders on change.
   Renders a REAL working mini app: customers can take tokens / book / order. */
(function () {
  "use strict";
  var CFG_KEY = "wl_config";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function $(s, r) { return (r || document).querySelector(s); }
  function uid() { return "p" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

  var DEFAULTS = {
    name: "Demo Store", tagline: "Your tagline here", type: "queue",
    color: "#0E7A3E", logo: "", phone: "",
    welcome: "Welcome! Take your token below and we'll call you."
  };

  function getConfig() {
    try {
      var c = JSON.parse(localStorage.getItem(CFG_KEY));
      if (c && c.name) return Object.assign({}, DEFAULTS, c);
    } catch (e) {}
    return Object.assign({}, DEFAULTS);
  }

  function storeKey(type) { return "wl_pv_" + type; }
  function load(type) {
    try { var v = JSON.parse(localStorage.getItem(storeKey(type))); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function save(type, arr) { localStorage.setItem(storeKey(type), JSON.stringify(arr)); }

  var TYPE_META = {
    queue:  { cta: "Get my token", empty: "No tokens yet — be the first!", itemLabel: "Token" },
    slots:  { cta: "Book my slot", empty: "No bookings yet.", itemLabel: "Booking" },
    orders: { cta: "Place order", empty: "No orders yet.", itemLabel: "Order" }
  };

  function slotOptions() {
    var days = ["Today", "Tomorrow"], times = ["10:00 AM", "12:00 PM", "2:00 PM", "4:00 PM", "6:00 PM"];
    var out = [];
    days.forEach(function (d) { times.forEach(function (t) { out.push(d + ", " + t); }); });
    return out;
  }

  function nextToken(items) {
    var m = 0;
    items.forEach(function (i) { if (i.n > m) m = i.n; });
    return m + 1;
  }

  function render(cfg) {
    var meta = TYPE_META[cfg.type] || TYPE_META.queue;
    var items = load(cfg.type);
    document.title = cfg.name + " — preview";

    var logoHtml = cfg.logo
      ? '<img class="pv-logo" src="' + cfg.logo + '" alt="logo">'
      : '<div class="pv-logo" style="background:' + esc(cfg.color) + '22;border:2px dashed ' + esc(cfg.color) + '55"></div>';

    var formHtml = "";
    if (cfg.type === "queue") {
      formHtml =
        '<div class="pv-field"><label>Your name</label><input id="pvName" type="text" placeholder="Your name" maxlength="40"></div>' +
        '<div class="pv-field"><label>Phone</label><input id="pvPhone" type="tel" placeholder="98765 43210" maxlength="13"></div>';
    } else if (cfg.type === "slots") {
      formHtml =
        '<div class="pv-field"><label>Your name</label><input id="pvName" type="text" placeholder="Your name" maxlength="40"></div>' +
        '<div class="pv-field"><label>Phone</label><input id="pvPhone" type="tel" placeholder="98765 43210" maxlength="13"></div>' +
        '<div class="pv-field"><label>Pick a slot</label><select id="pvSlot">' +
        slotOptions().map(function (s) { return '<option>' + esc(s) + '</option>'; }).join("") +
        "</select></div>";
    } else {
      formHtml =
        '<div class="pv-field"><label>Your name</label><input id="pvName" type="text" placeholder="Your name" maxlength="40"></div>' +
        '<div class="pv-field"><label>Phone</label><input id="pvPhone" type="tel" placeholder="98765 43210" maxlength="13"></div>' +
        '<div class="pv-field"><label>Item</label><input id="pvItem" type="text" placeholder="What would you like?" maxlength="60"></div>' +
        '<div class="pv-field"><label>Qty</label><select id="pvQty">' +
        [1, 2, 3, 4, 5].map(function (q) { return "<option>" + q + "</option>"; }).join("") +
        "</select></div>";
    }

    var listHtml = items.length === 0
      ? '<div class="pv-empty">' + esc(meta.empty) + "</div>"
      : items.slice().reverse().map(function (it) {
          var title = cfg.type === "queue" ? "Token #" + it.n
            : cfg.type === "slots" ? esc(it.slot)
            : esc(it.item) + " × " + it.qty;
          return '<div class="pv-item"><div><div class="t">' + title + '</div>' +
            '<div class="s">' + esc(it.name) + "</div></div>" +
            '<span class="chip ' + esc(it.status) + '">' + esc(it.status) + "</span></div>";
        }).join("");

    $("#app").innerHTML =
      '<div class="pv-head" style="border-top:6px solid ' + esc(cfg.color) + '">' +
      logoHtml +
      '<div class="pv-name">' + esc(cfg.name) + "</div>" +
      (cfg.tagline ? '<div class="pv-tag">' + esc(cfg.tagline) + "</div>" : "") +
      "</div>" +
      (cfg.welcome ? '<div class="pv-welcome">' + esc(cfg.welcome) + "</div>" : "") +
      '<div class="pv-body">' + formHtml +
      '<button class="pv-btn" id="pvGo" style="background:' + esc(cfg.color) + '">' + esc(meta.cta) + "</button>" +
      '<div class="pv-sec">' + esc(meta.itemLabel) + "s</div>" +
      '<div id="pvList">' + listHtml + "</div>" +
      '<div class="pv-foot">Live preview — updates as you configure</div></div>';

    $("#pvGo").addEventListener("click", function () {
      var name = ($("#pvName").value || "").trim();
      var phone = ($("#pvPhone").value || "").replace(/\D/g, "").slice(-10);
      if (!name) { $("#pvName").focus(); $("#pvName").style.borderColor = "#b3261e"; return; }
      var it = { id: uid(), name: name, phone: phone, ts: new Date().toISOString() };
      if (cfg.type === "queue") { it.n = nextToken(items); it.status = "waiting"; }
      else if (cfg.type === "slots") { it.slot = $("#pvSlot").value; it.status = "booked"; }
      else {
        var item = ($("#pvItem").value || "").trim();
        if (!item) { $("#pvItem").focus(); $("#pvItem").style.borderColor = "#b3261e"; return; }
        it.item = item; it.qty = $("#pvQty").value; it.status = "pending";
      }
      items.push(it); save(cfg.type, items); render(cfg);
    });
  }

  function boot() { render(getConfig()); }
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "wl-config" && e.data.config) render(Object.assign({}, DEFAULTS, e.data.config));
  });
  window.addEventListener("storage", function (e) {
    if (e.key === CFG_KEY) render(getConfig());
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
