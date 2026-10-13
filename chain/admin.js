/* ChainQ — multi-outlet owner dashboard. localStorage only. */
"use strict";
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
const LS_PASS = "chain_pass", LS_OUT = "chain_outlets", LS_ENT = "chain_entries";
const DEFAULT_HASH = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"; /* 1234 */
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const uid = () => "c" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
function todayISO() { const d = new Date(); return isoOf(d); }
function isoOf(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function load(k, fb) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; } catch (e) { return fb; } }
function save(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

async function sha256hex(str) {
  if (window.crypto && window.crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.prototype.map.call(new Uint8Array(buf), (b) => ("0" + b.toString(16)).slice(-2)).join("");
  }
  return "plain:" + str; /* non-secure context: fail closed */
}
function getPass() { return localStorage.getItem(LS_PASS) || DEFAULT_HASH; }

const state = { tab: "dash", range: "today", detailId: null };

/* ---------- data ---------- */
function getOutlets() { return load(LS_OUT, []); }
function setOutlets(v) { save(LS_OUT, v); }
function getEntries() { return load(LS_ENT, []); }
function setEntries(v) { save(LS_ENT, v); }
function outletById(id) { return getOutlets().find((o) => o.id === id); }

function inRange(dateISO, range) {
  const t = todayISO();
  if (range === "today") return dateISO === t;
  if (range === "week") {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return dateISO >= isoOf(d) && dateISO <= t;
  }
  return dateISO.slice(0, 7) === t.slice(0, 7); /* month */
}
function summarize(range) {
  const outlets = getOutlets();
  const rows = getEntries().filter((e) => inRange(e.date, range));
  const per = {};
  outlets.forEach((o) => { per[o.id] = { outlet: o, rev: 0, foot: 0, exp: 0 }; });
  rows.forEach((e) => {
    if (!per[e.outletId]) per[e.outletId] = { outlet: outletById(e.outletId) || { name: "?", town: "" }, rev: 0, foot: 0, exp: 0 };
    per[e.outletId].rev += Number(e.revenue) || 0;
    per[e.outletId].foot += Number(e.footfall) || 0;
    per[e.outletId].exp += Number(e.expenses) || 0;
  });
  const tot = { rev: 0, foot: 0, exp: 0 };
  Object.keys(per).forEach((k) => { tot.rev += per[k].rev; tot.foot += per[k].foot; tot.exp += per[k].exp; });
  return { per, tot };
}

/* ---------- dashboard ---------- */
function renderDash() {
  const s = summarize(state.range);
  $("#stRev").textContent = inr(s.tot.rev);
  $("#stFoot").textContent = Number(s.tot.foot).toLocaleString("en-IN");
  $("#stExp").textContent = inr(s.tot.exp);
  $("#stNet").textContent = inr(s.tot.rev - s.tot.exp);
  const lbl = { today: "today", week: "last 7 days", month: "this month" }[state.range];
  $("#chartLbl").textContent = "· " + lbl;

  const rows = Object.keys(s.per).map((k) => s.per[k]).filter((r) => r.outlet.active !== false);
  const max = Math.max.apply(null, [0].concat(rows.map((r) => r.rev)));
  const bars = $("#bars");
  if (!rows.length) { bars.innerHTML = '<div class="empty">No outlets yet — add one under Outlets.</div>'; }
  else {
    bars.innerHTML = rows.map((r) => {
      const w = max ? Math.round((r.rev / max) * 100) : 0;
      return '<div class="barrow"><div class="t"><b>' + esc(r.outlet.name) + '</b><span>' + inr(r.rev) + '</span></div>' +
        '<div class="track"><div class="fill" style="width:' + w + '%"></div></div></div>';
    }).join("");
  }

  const ranked = rows.slice().sort((a, b) => b.rev - a.rev);
  const rk = $("#ranking");
  rk.innerHTML = ranked.length ? ranked.map((r, i) =>
    '<div class="orow"><span class="rank">' + (i + 1) + '</span><span class="nm">' + esc(r.outlet.name) +
    '<small>' + esc(r.outlet.town || "") + ' · ' + Number(r.foot).toLocaleString("en-IN") + ' customers</small></span>' +
    '<span class="amt">' + inr(r.rev) + '</span></div>').join("")
    : '<div class="empty">No data for this period yet.</div>';

  /* detail selector */
  const sel = $("#detailSel");
  const outs = getOutlets();
  sel.innerHTML = outs.map((o) => '<option value="' + o.id + '">' + esc(o.name) + '</option>').join("");
  if (!state.detailId || !outletById(state.detailId)) state.detailId = outs.length ? outs[0].id : null;
  if (state.detailId) sel.value = state.detailId;
  renderDetail();
}
function renderDetail() {
  const box = $("#detailTbl");
  if (!state.detailId) { box.innerHTML = '<div class="empty">Add an outlet first.</div>'; return; }
  const rows = getEntries().filter((e) => e.outletId === state.detailId).sort((a, b) => b.date < a.date ? -1 : 1).slice(0, 30);
  if (!rows.length) { box.innerHTML = '<div class="empty">No entries yet for this outlet.</div>'; return; }
  box.innerHTML = '<table class="ledger"><thead><tr><th>Date</th><th>Revenue</th><th>Footfall</th><th>Expenses</th><th>Net</th></tr></thead><tbody>' +
    rows.map((e) => '<tr><td>' + esc(e.date) + '</td><td>' + inr(e.revenue) + '</td><td>' + Number(e.footfall || 0).toLocaleString("en-IN") +
      '</td><td>' + inr(e.expenses) + '</td><td>' + inr((Number(e.revenue) || 0) - (Number(e.expenses) || 0)) + '</td></tr>').join("") +
    '</tbody></table>';
}

/* ---------- daily entry ---------- */
function renderEntry() {
  if (!$("#entryDate").value) $("#entryDate").value = todayISO();
  const date = $("#entryDate").value;
  const outs = getOutlets().filter((o) => o.active !== false);
  const ents = getEntries();
  const box = $("#entryRows");
  if (!outs.length) { box.innerHTML = '<div class="empty">Add an outlet first, then enter numbers here each night.</div>'; return; }
  box.innerHTML = outs.map((o) => {
    const ex = ents.find((e) => e.outletId === o.id && e.date === date) || {};
    return '<div class="erow" data-oid="' + o.id + '"><div class="onm">' + esc(o.name) + '</div>' +
      '<div class="grid3">' +
      '<div><label>Revenue ₹</label><input type="number" min="0" inputmode="numeric" data-f="revenue" value="' + (ex.revenue || "") + '"></div>' +
      '<div><label>Customers</label><input type="number" min="0" inputmode="numeric" data-f="footfall" value="' + (ex.footfall || "") + '"></div>' +
      '<div><label>Expenses ₹</label><input type="number" min="0" inputmode="numeric" data-f="expenses" value="' + (ex.expenses || "") + '"></div>' +
      '</div></div>';
  }).join("");
}
function saveEntry() {
  const date = $("#entryDate").value;
  if (!date) { $("#entryMsg").textContent = "Pick a date first."; return; }
  const ents = getEntries();
  let n = 0;
  $$("#entryRows .erow").forEach((row) => {
    const oid = row.getAttribute("data-oid");
    const g = (f) => { const v = row.querySelector('[data-f="' + f + '"]').value; return v === "" ? 0 : Math.max(0, Number(v) || 0); };
    const rev = g("revenue"), foot = g("footfall"), exp = g("expenses");
    if (!rev && !foot && !exp) return;
    const ix = ents.findIndex((e) => e.outletId === oid && e.date === date);
    const rec = { id: ix >= 0 ? ents[ix].id : uid(), outletId: oid, date: date, revenue: rev, footfall: foot, expenses: exp };
    if (ix >= 0) ents[ix] = rec; else ents.push(rec);
    n++;
  });
  setEntries(ents);
  $("#entryMsg").textContent = n ? "Saved ✓ (" + n + " outlet" + (n > 1 ? "s" : "") + " for " + date + ")" : "Nothing to save — enter at least one number.";
  renderDash();
}

/* ---------- outlets ---------- */
function renderOutlets() {
  const outs = getOutlets();
  const box = $("#outletList");
  box.innerHTML = outs.length ? outs.map((o) =>
    '<div class="orow"><span class="nm">' + esc(o.name) +
    '<small>' + esc(o.type || "") + (o.town ? " · " + esc(o.town) : "") +
    (o.url ? ' · <a href="' + esc(o.url) + '" target="_blank" rel="noopener" style="color:#047857">app ↗</a>' : "") + '</small></span>' +
    '<span class="tag' + (o.active === false ? " off" : "") + '">' + (o.active === false ? "off" : "on") + '</span>' +
    '<button class="btn small ghost" data-toggle="' + o.id + '">' + (o.active === false ? "Enable" : "Disable") + '</button>' +
    '<button class="btn small danger" data-del="' + o.id + '">✕</button></div>').join("")
    : '<div class="empty">No outlets yet. Add your first one above.</div>';
  $$("#outletList [data-toggle]").forEach((b) => b.addEventListener("click", () => {
    const v = getOutlets(); const o = v.find((x) => x.id === b.getAttribute("data-toggle"));
    o.active = o.active === false ? true : false; setOutlets(v); renderOutlets(); renderDash(); renderEntry();
  }));
  $$("#outletList [data-del]").forEach((b) => b.addEventListener("click", () => {
    if (!confirm("Delete this outlet and ALL its entries?")) return;
    const id = b.getAttribute("data-del");
    setOutlets(getOutlets().filter((o) => o.id !== id));
    setEntries(getEntries().filter((e) => e.outletId !== id));
    if (state.detailId === id) state.detailId = null;
    renderOutlets(); renderDash(); renderEntry();
  }));
}
function addOutlet() {
  const name = $("#oName").value.trim();
  if (!name) { alert("Give the outlet a name."); return; }
  const v = getOutlets();
  v.push({ id: uid(), name: name, type: $("#oType").value, town: $("#oTown").value.trim(), url: $("#oUrl").value.trim(), active: true });
  setOutlets(v);
  $("#oName").value = ""; $("#oTown").value = ""; $("#oUrl").value = "";
  renderOutlets(); renderDash(); renderEntry();
}

/* ---------- CSV export ---------- */
function downloadCSV() {
  const m = $("#expMonth").value;
  if (!m) { alert("Pick a month first."); return; }
  const rows = getEntries().filter((e) => e.date.slice(0, 7) === m).sort((a, b) => a.date < b.date ? -1 : 1);
  if (!rows.length) { alert("No entries for " + m + "."); return; }
  const q = (s) => '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
  const lines = ["date,outlet,revenue,footfall,expenses,net"];
  rows.forEach((e) => {
    const o = outletById(e.outletId);
    lines.push([e.date, q(o ? o.name : "?"), e.revenue || 0, e.footfall || 0, e.expenses || 0, (Number(e.revenue) || 0) - (Number(e.expenses) || 0)].join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "chainq-" + m + ".csv";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ---------- tabs ---------- */
function showTab(t) {
  state.tab = t;
  ["Dash", "Entry", "Outlets"].forEach((k) => {
    $("#tab" + k).classList.toggle("on", k.toLowerCase() === t);
    $("#sec" + k).hidden = k.toLowerCase() !== t;
  });
  if (t === "dash") renderDash();
  if (t === "entry") renderEntry();
  if (t === "outlets") renderOutlets();
}

/* ---------- passcode ---------- */
async function unlock() {
  const v = $("#lockInput").value;
  const h = await sha256hex(v);
  if (h === getPass()) { $("#lock").hidden = true; $("#lockInput").value = ""; boot(); }
  else { $("#lockErr").textContent = "Wrong passcode."; }
}
async function changePasscode() {
  const cur = $("#pcCur").value, nw = $("#pcNew").value, nw2 = $("#pcNew2").value;
  const err = $("#pcErr"); err.textContent = "";
  if ((await sha256hex(cur)) !== getPass()) { err.textContent = "Current passcode is wrong."; return; }
  if (nw.length < 4) { err.textContent = "New passcode needs at least 4 characters."; return; }
  if (nw !== nw2) { err.textContent = "New passcodes don't match."; return; }
  localStorage.setItem(LS_PASS, await sha256hex(nw));
  $("#pcCur").value = $("#pcNew").value = $("#pcNew2").value = "";
  $("#passVeil").hidden = true;
  alert("Passcode changed ✓");
}

function boot() {
  if (!$("#expMonth").value) $("#expMonth").value = todayISO().slice(0, 7);
  showTab("dash");
}
function bind() {
  $("#lockBtn").addEventListener("click", unlock);
  $("#lockInput").addEventListener("keydown", (e) => { if (e.key === "Enter") unlock(); });
  $("#tabDash").addEventListener("click", () => showTab("dash"));
  $("#tabEntry").addEventListener("click", () => showTab("entry"));
  $("#tabOutlets").addEventListener("click", () => showTab("outlets"));
  $$(".ranges button").forEach((b) => b.addEventListener("click", () => {
    $$(".ranges button").forEach((x) => x.classList.remove("on"));
    b.classList.add("on"); state.range = b.getAttribute("data-range"); renderDash();
  }));
  $("#detailSel").addEventListener("change", (e) => { state.detailId = e.target.value; renderDetail(); });
  $("#entryDate").addEventListener("change", renderEntry);
  $("#btnSaveEntry").addEventListener("click", saveEntry);
  $("#btnAddOutlet").addEventListener("click", addOutlet);
  $("#btnCsv").addEventListener("click", downloadCSV);
  $("#btnPass").addEventListener("click", () => { $("#passVeil").hidden = false; });
  $("#pcCancel").addEventListener("click", () => { $("#passVeil").hidden = true; });
  $("#pcSave").addEventListener("click", changePasscode);
}
bind();
