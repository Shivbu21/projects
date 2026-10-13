/* KhataQ — owner dashboard (admin.html) */
(function () {
  "use strict";
  var LS_C = "khata_customers", LS_E = "khata_entries",
      LS_S = "khata_settings", LS_P = "khata_pass";
  var DEFAULT_HASH = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"; // sha256("1234")
  var openHist = {}; // customerId -> history expanded

  function $(s, r) { return (r || document).querySelector(s); }
  function load(k, fb) {
    try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; }
    catch (e) { return fb; }
  }
  function save(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function inr(n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }
  function normPhone(p) { return String(p || "").replace(/\D/g, "").slice(-10); }
  function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
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
  function sha256hex(str) {
    if (window.crypto && window.crypto.subtle) {
      return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)).then(function (h) {
        return Array.prototype.map.call(new Uint8Array(h), function (b) {
          return ("0" + b.toString(16)).slice(-2);
        }).join("");
      });
    }
    return Promise.resolve("plain:" + str); // fail closed on non-secure origins
  }

  function customers() { var c = load(LS_C, []); return Array.isArray(c) ? c : []; }
  function entries() { var e = load(LS_E, []); return Array.isArray(e) ? e : []; }
  function settings() { return load(LS_S, { shopName: "", upiId: "" }); }
  function saveCustomers(c) { save(LS_C, c); }
  function saveEntries(e) { save(LS_E, e); }

  function ledgerFor(cid) {
    return entries().filter(function (e) { return e.customerId === cid; })
      .sort(function (a, b) {
        return (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) ||
               (a.created_at < b.created_at ? -1 : 1);
      });
  }
  function balance(cid) {
    return ledgerFor(cid).reduce(function (s, e) {
      return s + (e.type === "credit" ? Number(e.amount) : -Number(e.amount));
    }, 0);
  }

  /* ---------- entry form + history (per customer) ---------- */
  function entryFormHTML(cid) {
    return '<div class="hist" id="form-' + cid + '" hidden>' +
      '<div class="seg" style="margin-top:10px">' +
        '<button data-t="credit" data-c="' + cid + '" class="on-credit">Udhaar given</button>' +
        '<button data-t="payment" data-c="' + cid + '">Payment received</button></div>' +
      '<div class="row">' +
        '<div class="field"><label>Amount ₹</label><input inputmode="decimal" id="amt-' + cid + '" placeholder="0"></div>' +
        '<div class="field"><label>Date</label><input type="date" id="dt-' + cid + '" value="' + todayISO() + '"></div></div>' +
      '<div class="field"><label>Note (optional)</label><input id="note-' + cid + '" placeholder="e.g. 2kg atta"></div>' +
      '<button class="btn block" data-add="' + cid + '">Save entry</button>' +
      '<div class="err" id="err-' + cid + '" hidden></div></div>';
  }
  var formType = {}; // customerId -> 'credit'|'payment'

  function historyHTML(cust) {
    var rows = ledgerFor(cust.id), run = 0;
    if (!rows.length) return '<div class="empty">No entries yet.</div>';
    return rows.map(function (e) {
      run += (e.type === "credit" ? Number(e.amount) : -Number(e.amount));
      return '<div class="entry ' + e.type + '"><span class="dot"></span>' +
        '<div class="grow"><div>' + (e.type === "credit" ? "Udhaar" : "Payment") +
        (e.note ? " · " + esc(e.note) : "") + '</div>' +
        '<div class="dt">' + esc(fmtDate(e.date)) + ' · bal ' + inr(run) + '</div></div>' +
        '<div class="amt">' + (e.type === "credit" ? "+" : "−") + inr(e.amount) + '</div>' +
        '<button class="del" data-del="' + e.id + '" data-c="' + cust.id + '" title="Delete entry">✕</button></div>';
    }).join("");
  }

  function remindLink(cust, bal) {
    var st = settings();
    var upi = "upi://pay?pa=" + encodeURIComponent(st.upiId || "") +
      "&pn=" + encodeURIComponent(st.shopName || "Shop") +
      "&am=" + bal.toFixed(2) + "&cu=INR";
    var msg = "Namaste " + cust.name + ", your pending balance at " +
      (st.shopName || "our shop") + " is " + inr(bal) +
      ". Please pay here: " + upi;
    return "https://wa.me/91" + normPhone(cust.phone) + "?text=" + encodeURIComponent(msg);
  }

  function renderCustomers() {
    var q = ($("#search").value || "").toLowerCase();
    var list = customers()
      .map(function (c) { return { c: c, bal: balance(c.id) }; })
      .filter(function (x) {
        return !q || x.c.name.toLowerCase().indexOf(q) > -1 || normPhone(x.c.phone).indexOf(q.replace(/\D/g, "")) > -1;
      })
      .sort(function (a, b) { return b.bal - a.bal; });
    $("#custCount").textContent = "· " + customers().length + " customers";
    var box = $("#customerList");
    if (!list.length) { box.innerHTML = '<div class="empty">No customers yet. Add your first one above.</div>'; return; }
    box.innerHTML = list.map(function (x) {
      var c = x.c, initial = esc((c.name || "?").trim().charAt(0).toUpperCase());
      return '<div class="cust"><div class="avatar">' + initial + '</div>' +
        '<div class="info"><div class="nm">' + esc(c.name) + '</div>' +
        '<div class="ph">' + esc(c.phone) + '</div>' +
        '<div class="ops">' +
          '<button class="btn small" data-entry="' + c.id + '">+ Entry</button>' +
          '<button class="btn small ghost" data-hist="' + c.id + '">' + (openHist[c.id] ? "Hide" : "History") + '</button>' +
          (x.bal > 0 ? '<a class="btn small ghost" target="_blank" rel="noopener" href="' + remindLink(c, x.bal) + '">Remind ₹' + Number(x.bal).toLocaleString("en-IN") + '</a>' : "") +
        '</div>' +
        (openHist[c.id] ? '<div class="hist">' + historyHTML(c) + '</div>' : "") +
        '</div>' +
        '<div class="bal"><div class="amt ' + (x.bal > 0 ? "owed" : "clear") + '">' + inr(x.bal) + '</div>' +
        '<div class="muted">' + (x.bal > 0 ? "owes" : "clear") + '</div></div></div>' +
        entryFormHTML(c.id);
    }).join("");

    box.querySelectorAll("[data-entry]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-entry"), f = $("#form-" + id);
        f.hidden = !f.hidden; formType[id] = formType[id] || "credit";
      });
    });
    box.querySelectorAll("[data-hist]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-hist");
        openHist[id] = !openHist[id]; renderCustomers();
      });
    });
    box.querySelectorAll(".seg button").forEach(function (b) {
      b.addEventListener("click", function () {
        var cid = b.getAttribute("data-c"), t = b.getAttribute("data-t");
        formType[cid] = t;
        var seg = b.parentElement;
        seg.querySelectorAll("button").forEach(function (x) { x.className = ""; });
        b.className = t === "credit" ? "on-credit" : "on-payment";
      });
    });
    box.querySelectorAll("[data-add]").forEach(function (b) {
      b.addEventListener("click", function () {
        var cid = b.getAttribute("data-add"), err = $("#err-" + cid);
        err.hidden = true;
        var amt = Number(($("#amt-" + cid).value || "").replace(/,/g, ""));
        var dt = $("#dt-" + cid).value || todayISO();
        var note = $("#note-" + cid).value.trim();
        if (!(amt > 0)) { err.textContent = "Enter an amount greater than 0."; err.hidden = false; return; }
        var es = entries();
        es.push({ id: uid("e"), customerId: cid, type: formType[cid] || "credit",
                  amount: Math.round(amt * 100) / 100, note: note, date: dt,
                  created_at: new Date().toISOString() });
        saveEntries(es);
        toast("Entry saved");
        renderCustomers(); renderStats();
      });
    });
    box.querySelectorAll("[data-del]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (!confirm("Delete this entry? The balance will update.")) return;
        var eid = b.getAttribute("data-del");
        saveEntries(entries().filter(function (e) { return e.id !== eid; }));
        toast("Entry deleted");
        renderCustomers(); renderStats();
      });
    });
  }

  function renderStats() {
    var cs = customers(), out = 0, debtors = 0, coll = 0;
    var m = todayISO().slice(0, 7);
    cs.forEach(function (c) {
      var b = balance(c.id);
      if (b > 0) { out += b; debtors++; }
    });
    entries().forEach(function (e) {
      if (e.type === "payment" && (e.date || "").slice(0, 7) === m) coll += Number(e.amount);
    });
    $("#stOut").textContent = inr(out);
    $("#stColl").textContent = inr(coll);
    $("#stDebtors").textContent = debtors;
    $("#stCust").textContent = cs.length;
  }

  function showTab(n) {
    ["customers", "stats", "settings"].forEach(function (t, i) {
      $("#tab-" + t).hidden = (i + 1) !== n;
      $("#tabB" + (i + 1)).classList.toggle("on", (i + 1) === n);
    });
  }

  function init() {
    // tabs
    $("#tabB1").addEventListener("click", function () { showTab(1); });
    $("#tabB2").addEventListener("click", function () { showTab(2); renderStats(); });
    $("#tabB3").addEventListener("click", function () { showTab(3); });

    // unlock
    function doUnlock() {
      var err = $("#lockErr"); err.hidden = true;
      sha256hex($("#pass").value).then(function (h) {
        var stored = localStorage.getItem(LS_P) || DEFAULT_HASH;
        if (h === stored) {
          $("#lockCard").hidden = true; $("#dash").hidden = false;
          renderCustomers(); renderStats();
        } else { err.textContent = "Wrong passcode."; err.hidden = false; }
      });
    }
    $("#btnUnlock").addEventListener("click", doUnlock);
    $("#pass").addEventListener("keydown", function (ev) { if (ev.key === "Enter") doUnlock(); });

    // add customer
    $("#btnAddCust").addEventListener("click", function () {
      var err = $("#custErr"); err.hidden = true;
      var name = $("#cName").value.trim(), ph = normPhone($("#cPhone").value);
      if (!name) { err.textContent = "Enter the customer's name."; err.hidden = false; return; }
      if (ph.length !== 10) { err.textContent = "Enter a valid 10-digit mobile number."; err.hidden = false; return; }
      var cs = customers();
      if (cs.some(function (c) { return normPhone(c.phone) === ph; })) {
        err.textContent = "This number is already in the ledger."; err.hidden = false; return;
      }
      cs.push({ id: uid("c"), name: name, phone: ph, created_at: new Date().toISOString() });
      saveCustomers(cs);
      $("#cName").value = ""; $("#cPhone").value = "";
      toast("Customer added"); renderCustomers(); renderStats();
    });
    $("#search").addEventListener("input", renderCustomers);

    // settings
    var st = settings();
    $("#sShop").value = st.shopName || ""; $("#sUpi").value = st.upiId || "";
    $("#btnSaveSettings").addEventListener("click", function () {
      save(LS_S, { shopName: $("#sShop").value.trim(), upiId: $("#sUpi").value.trim() });
      toast("Settings saved");
    });

    // change passcode
    $("#btnChangePass").addEventListener("click", function () {
      var err = $("#passErr"); err.hidden = true;
      var cur = $("#pCur").value, nw = $("#pNew").value, cf = $("#pConf").value;
      sha256hex(cur).then(function (h) {
        var stored = localStorage.getItem(LS_P) || DEFAULT_HASH;
        if (h !== stored) { err.textContent = "Current passcode is wrong."; err.hidden = false; return; }
        if (nw.length < 4) { err.textContent = "New passcode needs at least 4 characters."; err.hidden = false; return; }
        if (nw !== cf) { err.textContent = "New passcodes don't match."; err.hidden = false; return; }
        sha256hex(nw).then(function (hh) {
          localStorage.setItem(LS_P, hh);
          $("#pCur").value = $("#pNew").value = $("#pConf").value = "";
          toast("Passcode changed");
        });
      });
    });

    $("#btnOpenCust").addEventListener("click", function () {
      window.open("index.html", "_blank", "noopener");
    });

    // cross-tab sync
    window.addEventListener("storage", function (ev) {
      if ((ev.key === LS_C || ev.key === LS_E) && !$("#dash").hidden) {
        renderCustomers(); renderStats();
      }
    });
  }
  document.addEventListener("DOMContentLoaded", init);
})();
