/* KhataQ — customer ledger view (index.html) */
(function () {
  "use strict";
  var LS_C = "khata_customers", LS_E = "khata_entries", LS_S = "khata_settings";

  function $(s, r) { return (r || document).querySelector(s); }
  function load(k, fb) {
    try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; }
    catch (e) { return fb; }
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function inr(n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }
  function normPhone(p) { return String(p || "").replace(/\D/g, "").slice(-10); }
  function fmtDate(iso) {
    try {
      var d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
      return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    } catch (e) { return iso; }
  }
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  function customers() { var c = load(LS_C, []); return Array.isArray(c) ? c : []; }
  function entries() { var e = load(LS_E, []); return Array.isArray(e) ? e : []; }
  function settings() { return load(LS_S, { shopName: "", upiId: "" }); }

  function ledgerFor(cid) {
    return entries().filter(function (e) { return e.customerId === cid; })
      .sort(function (a, b) {
        return (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) ||
               (a.created_at < b.created_at ? -1 : 1);
      });
  }
  function balance(rows) {
    return rows.reduce(function (s, e) {
      return s + (e.type === "credit" ? Number(e.amount) : -Number(e.amount));
    }, 0);
  }

  function renderLedger(cust) {
    var rows = ledgerFor(cust.id), bal = balance(rows), st = settings();
    $("#custLine").innerHTML = esc(cust.name) + " · " + esc(cust.phone);
    var owed = $("#totalOwed");
    owed.textContent = inr(bal);
    owed.className = "balance-big " + (bal > 0 ? "owed" : "clear");
    if (bal <= 0) $("#btnPay").style.display = "none";
    else {
      $("#btnPay").style.display = "";
      var upi = "upi://pay?pa=" + encodeURIComponent(st.upiId || "") +
        "&pn=" + encodeURIComponent(st.shopName || "Shop") +
        "&am=" + bal.toFixed(2) + "&cu=INR";
      $("#btnPay").href = upi;
    }
    var box = $("#entries"), run = 0;
    if (!rows.length) { box.innerHTML = '<div class="empty">No entries yet. Ask the shopkeeper to add your first udhaar.</div>'; }
    else {
      box.innerHTML = rows.map(function (e) {
        run += (e.type === "credit" ? Number(e.amount) : -Number(e.amount));
        return '<div class="entry ' + e.type + '">' +
          '<span class="dot"></span>' +
          '<div class="grow"><div>' + (e.type === "credit" ? "Udhaar" : "Payment") +
          (e.note ? " · " + esc(e.note) : "") + '</div>' +
          '<div class="dt">' + esc(fmtDate(e.date)) + ' · bal ' + inr(run) + '</div></div>' +
          '<div class="amt">' + (e.type === "credit" ? "+" : "−") + inr(e.amount) + '</div></div>';
      }).join("");
    }
    $("#lookupCard").hidden = true;
    $("#ledgerCard").hidden = false;
    window.scrollTo(0, 0);
  }

  function init() {
    var st = settings();
    $("#shopTitle").textContent = st.shopName ? st.shopName + " · Khata" : "KhataQ";
    $("#btnLookup").addEventListener("click", function () {
      var ph = normPhone($("#phone").value), err = $("#lookupErr");
      err.hidden = true;
      if (ph.length !== 10) { err.textContent = "Enter a valid 10-digit mobile number."; err.hidden = false; return; }
      var cust = customers().find(function (c) { return normPhone(c.phone) === ph; });
      if (!cust) { err.textContent = "No ledger found for this number. Check with the shopkeeper."; err.hidden = false; return; }
      renderLedger(cust);
    });
    $("#phone").addEventListener("keydown", function (ev) { if (ev.key === "Enter") $("#btnLookup").click(); });
    $("#btnBack").addEventListener("click", function () {
      $("#ledgerCard").hidden = true; $("#lookupCard").hidden = false; $("#phone").value = "";
    });
    // live update if the shopkeeper edits in another tab
    window.addEventListener("storage", function (ev) {
      if ((ev.key === LS_E || ev.key === LS_C) && !$("#ledgerCard").hidden) {
        var ph = normPhone($("#phone").value);
        var cust = customers().find(function (c) { return normPhone(c.phone) === ph; });
        if (cust) renderLedger(cust);
      }
    });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
