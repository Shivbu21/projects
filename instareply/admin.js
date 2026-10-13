/* InstaReply — owner dashboard (admin.html) */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var LS = {
    products: "insta_products",
    intents: "insta_intents",
    settings: "insta_settings",
    log: "insta_log",
    pass: "insta_pass"
  };
  var DEFAULT_PASS_HASH = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"; // 1234
  var uid = function () { return "p" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); };

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
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("show"); }, 2400);
  }
  function fmtTime(iso) {
    try { return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); }
    catch (e) { return ""; }
  }

  /* ---------- passcode ---------- */
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
  function storedHash() { return localStorage.getItem(LS.pass) || DEFAULT_PASS_HASH; }

  function unlock() {
    var v = $("#passInput").value;
    sha256hex(v).then(function (h) {
      if (h === storedHash()) {
        $("#lock").hidden = true;
        $("#dash").hidden = false;
        boot();
      } else {
        $("#passErr").textContent = "Wrong passcode.";
      }
    });
  }

  /* ---------- data ---------- */
  function getProducts() { return load(LS.products, []); }
  function getIntents() { return load(LS.intents, {}); }
  function getSettings() { return load(LS.settings, {}); }
  function getLog() { return load(LS.log, []); }

  /* ---------- tabs ---------- */
  function showTab(name) {
    $$(".tab").forEach(function (t) { t.classList.toggle("on", t.dataset.tab === name); });
    $$(".tabpanel").forEach(function (p) { p.hidden = p.dataset.panel !== name; });
  }

  /* ---------- catalog ---------- */
  function renderCatalog() {
    var list = getProducts(), box = $("#prodList");
    if (!list.length) { box.innerHTML = '<div class="empty">No products yet. Add your first one below.</div>'; }
    else {
      box.innerHTML = list.map(function (p) {
        return '<div class="prow"><div class="pinfo"><div class="pname">' + esc(p.name) +
          '</div><div class="pmeta">' + esc((p.keywords || []).join(", ")) + "</div></div>" +
          '<div class="pprice">₹' + esc(p.price) + "</div>" +
          '<button class="btn ghost small" data-edit="' + esc(p.id) + '">Edit</button>' +
          '<button class="btn ghost small" data-del="' + esc(p.id) + '">✕</button></div>';
      }).join("");
    }
    $$("[data-del]", box).forEach(function (b) {
      b.addEventListener("click", function () {
        save(LS.products, getProducts().filter(function (p) { return p.id !== b.dataset.del; }));
        renderCatalog(); toast("Product deleted.");
      });
    });
    $$("[data-edit]", box).forEach(function (b) {
      b.addEventListener("click", function () {
        var p = getProducts().find(function (x) { return x.id === b.dataset.edit; });
        if (!p) return;
        $("#pName").value = p.name; $("#pPrice").value = p.price;
        $("#pKw").value = (p.keywords || []).join(", ");
        $("#pId").value = p.id;
        $("#pAddBtn").textContent = "Save changes";
        $("#pName").focus();
      });
    });
  }

  function saveProduct() {
    var name = $("#pName").value.trim(), price = $("#pPrice").value.trim();
    var kws = $("#pKw").value.split(",").map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    if (!name || !price) { toast("Name and price are required."); return; }
    var list = getProducts(), id = $("#pId").value;
    if (id) {
      list = list.map(function (p) {
        return p.id === id ? { id: id, name: name, price: price, keywords: kws } : p;
      });
    } else {
      list.push({ id: uid(), name: name, price: price, keywords: kws });
    }
    save(LS.products, list);
    $("#pName").value = ""; $("#pPrice").value = ""; $("#pKw").value = ""; $("#pId").value = "";
    $("#pAddBtn").textContent = "Add product";
    renderCatalog(); toast("Product saved.");
  }

  /* ---------- intents / templates ---------- */
  var INTENT_LABELS = {
    greeting: "Greeting", price: "Price question", availability: "Availability",
    location: "Location / hours", human: "Human handoff", fallback: "Fallback"
  };
  function renderIntents() {
    var intents = getIntents(), box = $("#intentList");
    var keys = Object.keys(INTENT_LABELS).filter(function (k) { return intents[k]; });
    box.innerHTML = keys.map(function (k) {
      var it = intents[k];
      return '<div class="card" style="margin-top:12px"><h3>' + esc(INTENT_LABELS[k]) + "</h3>" +
        '<label>Keywords (comma-separated)</label>' +
        '<input data-kw="' + k + '" value="' + esc((it.keywords || []).join(", ")) + '"' +
        (k === "fallback" ? " disabled" : "") + ">" +
        '<label>Reply template — placeholders: {name} {product} {price} {business} {whatsapp} {address} {hours}</label>' +
        '<textarea data-tpl="' + k + '">' + esc(it.template || "") + "</textarea></div>";
    }).join("");
  }
  function saveIntents() {
    var intents = getIntents();
    $$("[data-tpl]").forEach(function (ta) {
      var k = ta.dataset.tpl;
      if (intents[k]) intents[k].template = ta.value;
    });
    $$("[data-kw]").forEach(function (inp) {
      var k = inp.dataset.kw;
      if (intents[k] && !inp.disabled) {
        intents[k].keywords = inp.value.split(",").map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
      }
    });
    save(LS.intents, intents);
    toast("Replies saved.");
  }

  /* ---------- conversations + stats ---------- */
  function renderChats() {
    var log = getLog().slice().reverse();
    var box = $("#chatLog");
    if (!log.length) { box.innerHTML = '<div class="empty">No conversations yet — try the simulator.</div>'; }
    else {
      box.innerHTML = log.slice(0, 120).map(function (m) {
        var who = m.from === "bot" ? '<span class="who bot">Bot</span>' : '<span class="who cust">Customer</span>';
        var chip = m.intent ? '<span class="chip ' + esc(m.intent) + '">' + esc(m.intent) + "</span>" : "";
        return '<div class="logitem">' + who + chip + "<div>" + esc(m.text) +
          "</div><time>" + esc(fmtTime(m.ts)) + "</time></div>";
      }).join("");
    }
    // stats: today
    var today = new Date().toDateString();
    var todays = getLog().filter(function (m) { return new Date(m.ts).toDateString() === today; });
    var cust = todays.filter(function (m) { return m.from !== "bot"; }).length;
    var bots = todays.filter(function (m) { return m.from === "bot"; });
    var resolved = bots.filter(function (m) {
      return ["greeting", "price", "availability", "location"].indexOf(m.intent) !== -1;
    }).length;
    var handoffs = bots.filter(function (m) {
      return m.intent === "human" || m.intent === "fallback";
    }).length;
    $("#stMsgs").textContent = cust;
    $("#stResolved").textContent = bots.length ? Math.round((resolved / bots.length) * 100) + "%" : "—";
    $("#stHandoff").textContent = handoffs;
  }

  /* ---------- settings ---------- */
  function renderSettings() {
    var s = getSettings();
    $("#sBiz").value = s.business || "";
    $("#sWa").value = s.whatsapp || "";
    $("#sAddr").value = s.address || "";
    $("#sHours").value = s.hours || "";
  }
  function saveSettings() {
    var wa = $("#sWa").value.replace(/\D/g, "");
    save(LS.settings, {
      business: $("#sBiz").value.trim(),
      whatsapp: wa,
      address: $("#sAddr").value.trim(),
      hours: $("#sHours").value.trim()
    });
    toast("Settings saved.");
  }
  function changePass() {
    var cur = $("#cCur").value, nw = $("#cNew").value, cf = $("#cCf").value;
    sha256hex(cur).then(function (h) {
      if (h !== storedHash()) { $("#cErr").textContent = "Current passcode is wrong."; return; }
      if (nw.length < 4) { $("#cErr").textContent = "New passcode needs 4+ characters."; return; }
      if (nw !== cf) { $("#cErr").textContent = "New passcodes don't match."; return; }
      sha256hex(nw).then(function (hh) {
        localStorage.setItem(LS.pass, hh);
        $("#cCur").value = $("#cNew").value = $("#cCf").value = "";
        $("#cErr").textContent = "";
        toast("Passcode changed.");
      });
    });
  }

  function boot() {
    renderCatalog(); renderIntents(); renderChats(); renderSettings();
    showTab("catalog");
  }

  document.addEventListener("DOMContentLoaded", function () {
    $("#unlockBtn").addEventListener("click", unlock);
    $("#passInput").addEventListener("keydown", function (e) { if (e.key === "Enter") unlock(); });
    $$(".tab").forEach(function (t) {
      t.addEventListener("click", function () { showTab(t.dataset.tab); });
    });
    $("#pAddBtn").addEventListener("click", saveProduct);
    $("#tSaveBtn").addEventListener("click", saveIntents);
    $("#sSaveBtn").addEventListener("click", saveSettings);
    $("#cSaveBtn").addEventListener("click", changePass);
    $("#clearLogBtn").addEventListener("click", function () {
      if (confirm("Clear the whole conversation log?")) {
        save(LS.log, []); renderChats(); toast("Log cleared.");
      }
    });
    window.addEventListener("storage", function (e) {
      if (e.key === LS.log) renderChats();
      if (e.key === LS.products) renderCatalog();
    });
  });
})();
