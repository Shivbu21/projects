/* SocietyOS — secretary dashboard */
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => "s" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const DEFAULT_PASS_HASH = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"; // 1234

const LS = {
  flats: "society_flats",
  bills: "society_bills",
  complaints: "society_complaints",
  notices: "society_notices",
  settings: "society_settings",
  pass: "society_pass",
};
function load(k, fb) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; } catch { return fb; } }
function save(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600);
}
async function sha256hex(str) {
  if (window.crypto?.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return "plain:" + str; /* non-secure context: fail closed */
}
function getPassHash() { return localStorage.getItem(LS.pass) || DEFAULT_PASS_HASH; }
function settings() {
  return Object.assign({ societyName: "Greenview Residency", upiId: "", defaultAmount: 2500 }, load(LS.settings, {}));
}
const digits = (p) => String(p || "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
const waNum = (p) => { const d = digits(p); return d.length === 10 ? "91" + d : d; };
const monthLabel = (m) => { const [y, mo] = m.split("-"); return new Date(+y, +mo - 1).toLocaleString("en", { month: "long", year: "numeric" }); };
const curMonth = () => new Date().toISOString().slice(0, 7);
const CAT = { water: "Water", electricity: "Electricity", lift: "Lift", cleanliness: "Cleanliness", other: "Other" };
const flatById = (id) => load(LS.flats, []).find(f => f.id === id);

/* ---------- passcode gate ---------- */
$("#btnUnlock").addEventListener("click", async () => {
  const h = await sha256hex($("#passInput").value);
  if (h === getPassHash()) {
    $("#lock").hidden = true; $("#dash").hidden = false;
    $("#lockErr").textContent = ""; $("#passInput").value = "";
    paintAll();
  } else {
    $("#lockErr").textContent = "Wrong passcode.";
  }
});
$("#passInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#btnUnlock").click(); });

/* ---------- tabs ---------- */
$("#tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-tab]"); if (!b) return;
  document.querySelectorAll("#tabs button").forEach(x => x.classList.remove("on"));
  b.classList.add("on");
  ["flats", "bills", "complaints", "notices", "settings"].forEach(t => {
    $("#tab-" + t).hidden = t !== b.dataset.tab;
  });
});

/* ---------- stats ---------- */
function paintStats() {
  const flats = load(LS.flats, []);
  const m = $("#billMonth").value || curMonth();
  const bills = load(LS.bills, []).filter(b => b.month === m);
  const open = load(LS.complaints, []).filter(c => c.status === "open").length;
  $("#stFlats").textContent = flats.length;
  $("#stOpen").textContent = open;
  $("#stColl").textContent = bills.length ? Math.round(100 * bills.filter(b => b.status === "paid").length / bills.length) + "%" : "—";
}

/* ---------- flats ---------- */
$("#btnAddFlat").addEventListener("click", () => {
  const tower = $("#fTower").value.trim().toUpperCase();
  const fno = $("#fNo").value.trim();
  const owner = $("#fOwner").value.trim();
  const phone = $("#fPhone").value.trim();
  if (!tower || !fno || !owner || !phone) { toast("Fill tower, flat no., name and phone."); return; }
  if (digits(phone).length < 10) { toast("Enter a valid 10-digit phone."); return; }
  const flats = load(LS.flats, []);
  if (flats.some(f => f.tower.toUpperCase() === tower && f.flat === fno)) { toast("This flat already exists."); return; }
  flats.push({ id: uid(), tower, flat: fno, owner, phone, createdAt: new Date().toISOString() });
  save(LS.flats, flats);
  $("#fTower").value = $("#fNo").value = $("#fOwner").value = $("#fPhone").value = "";
  paintFlats(); paintStats();
  toast("Flat added.");
});
function paintFlats() {
  const flats = load(LS.flats, []).sort((a, b) => (a.tower + a.flat).localeCompare(b.tower + b.flat));
  const ul = $("#flatList");
  $("#flatEmpty").hidden = flats.length > 0;
  ul.innerHTML = flats.map(f => `
    <li>
      <div class="grow">
        <div><b>Tower ${esc(f.tower)} · ${esc(f.flat)}</b> — ${esc(f.owner)}</div>
        <div class="sub">${esc(f.phone)}</div>
      </div>
      <button class="btn small danger" data-del-flat="${esc(f.id)}">Remove</button>
    </li>`).join("");
}
$("#flatList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-del-flat]"); if (!b) return;
  if (!confirm("Remove this flat? Its bills and complaints stay.")) return;
  save(LS.flats, load(LS.flats, []).filter(f => f.id !== b.dataset.delFlat));
  paintFlats(); paintStats();
});

/* ---------- bills ---------- */
function paintBills() {
  const m = $("#billMonth").value || curMonth();
  const bills = load(LS.bills, []).filter(b => b.month === m)
    .sort((a, b) => { const fa = flatById(a.flatId), fb = flatById(b.flatId); return ((fa?.tower || "") + (fa?.flat || "")).localeCompare((fb?.tower || "") + (fb?.flat || "")); });
  const ul = $("#billList");
  $("#billEmpty").hidden = bills.length > 0;
  ul.innerHTML = bills.map(b => {
    const f = flatById(b.flatId) || { tower: "?", flat: "?", owner: "removed", phone: "" };
    return `
    <li>
      <div class="grow">
        <div><b>Tower ${esc(f.tower)} · ${esc(f.flat)}</b> — ${esc(f.owner)} · ${inr(b.amount)}</div>
        <div class="sub">${esc(monthLabel(b.month))}</div>
      </div>
      <span class="chip ${b.status}">${b.status === "paid" ? "Paid" : "Pending"}</span>
      <div class="bill-actions">
        <button class="btn small ${b.status === "paid" ? "ghost" : ""}" data-toggle-bill="${esc(b.id)}">${b.status === "paid" ? "Mark unpaid" : "Mark paid"}</button>
        ${b.status === "unpaid" && f.phone ? `<a class="wa" target="_blank" rel="noopener" href="${esc(waReminder(f, b))}">WhatsApp reminder</a>` : ""}
      </div>
    </li>`;
  }).join("");
}
$("#btnGen").addEventListener("click", () => {
  const m = $("#billMonth").value || curMonth();
  const s = settings();
  const amount = Number(s.defaultAmount) || 0;
  const flats = load(LS.flats, []);
  if (!flats.length) { toast("Add flats first."); return; }
  const bills = load(LS.bills, []);
  let added = 0;
  for (const f of flats) {
    if (bills.some(b => b.flatId === f.id && b.month === m)) continue; /* idempotent */
    bills.push({ id: uid(), flatId: f.id, month: m, amount, status: "unpaid", createdAt: new Date().toISOString() });
    added++;
  }
  save(LS.bills, bills);
  paintBills(); paintStats();
  toast(added ? `${added} bill(s) generated for ${monthLabel(m)}.` : "Bills already exist for this month.");
});
$("#billList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-toggle-bill]"); if (!b) return;
  const bills = load(LS.bills, []);
  const row = bills.find(x => x.id === b.dataset.toggleBill); if (!row) return;
  row.status = row.status === "paid" ? "unpaid" : "paid";
  save(LS.bills, bills);
  paintBills(); paintStats();
});
function waReminder(f, b) {
  const s = settings();
  const upi = `upi://pay?pa=${encodeURIComponent(s.upiId || "")}&pn=${encodeURIComponent(s.societyName)}&am=${encodeURIComponent(b.amount)}&cu=INR`;
  const msg = `Hi ${f.owner}, your maintenance bill for ${monthLabel(b.month)} is ${inr(b.amount)} (Tower ${f.tower}, Flat ${f.flat}). Pay here: ${upi} — ${s.societyName}`;
  return `https://wa.me/${waNum(f.phone)}?text=${encodeURIComponent(msg)}`;
}

/* ---------- complaints ---------- */
function paintComplaints() {
  const list = load(LS.complaints, []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const ul = $("#cmpList");
  $("#cmpEmpty").hidden = list.length > 0;
  ul.innerHTML = list.map(c => {
    const f = flatById(c.flatId);
    return `
    <li>
      <div class="grow">
        <div><b>${esc(CAT[c.category] || c.category)}</b> — ${f ? `Tower ${esc(f.tower)} · ${esc(f.flat)} (${esc(f.owner)})` : "flat removed"}</div>
        <div class="sub">${esc(c.desc)}</div>
        <div class="sub">${new Date(c.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</div>
      </div>
      <span class="chip ${c.status}">${c.status === "open" ? "Open" : "Resolved"}</span>
      <button class="btn small ${c.status === "open" ? "" : "ghost"}" data-toggle-cmp="${esc(c.id)}">${c.status === "open" ? "Resolve" : "Reopen"}</button>
    </li>`;
  }).join("");
}
$("#cmpList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-toggle-cmp]"); if (!b) return;
  const list = load(LS.complaints, []);
  const c = list.find(x => x.id === b.dataset.toggleCmp); if (!c) return;
  c.status = c.status === "open" ? "resolved" : "open";
  save(LS.complaints, list);
  paintComplaints(); paintStats();
});

/* ---------- notices ---------- */
$("#btnNotice").addEventListener("click", () => {
  const title = $("#nTitle").value.trim();
  const body = $("#nBody").value.trim();
  if (!title || !body) { toast("Add a title and details."); return; }
  const list = load(LS.notices, []);
  list.push({ id: uid(), title, body, createdAt: new Date().toISOString() });
  save(LS.notices, list);
  $("#nTitle").value = $("#nBody").value = "";
  paintNotices();
  toast("Notice posted.");
});
function paintNotices() {
  const list = load(LS.notices, []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const ul = $("#noticeList");
  $("#noticeEmpty").hidden = list.length > 0;
  ul.innerHTML = list.map(n => `
    <li>
      <div class="grow">
        <div><b>${esc(n.title)}</b></div>
        <div class="sub">${esc(n.body)}</div>
        <div class="sub">${new Date(n.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
      </div>
      <button class="btn small danger" data-del-notice="${esc(n.id)}">Delete</button>
    </li>`).join("");
}
$("#noticeList").addEventListener("click", (e) => {
  const b = e.target.closest("[data-del-notice]"); if (!b) return;
  save(LS.notices, load(LS.notices, []).filter(n => n.id !== b.dataset.delNotice));
  paintNotices();
});

/* ---------- settings ---------- */
$("#btnSaveSettings").addEventListener("click", () => {
  const s = {
    societyName: $("#sName").value.trim() || "Greenview Residency",
    upiId: $("#sUpi").value.trim(),
    defaultAmount: Number($("#sAmt").value) || 0,
  };
  save(LS.settings, s);
  paintSettings(); paintName();
  toast("Settings saved.");
});
function paintSettings() {
  const s = settings();
  $("#sName").value = s.societyName; $("#sUpi").value = s.upiId; $("#sAmt").value = s.defaultAmount;
}
function paintName() { $("#societyName").textContent = settings().societyName + " · Secretary Dashboard"; }

$("#btnChangePass").addEventListener("click", async () => {
  const err = $("#passErr");
  const cur = await sha256hex($("#pCur").value);
  if (cur !== getPassHash()) { err.textContent = "Current passcode is wrong."; return; }
  const nw = $("#pNew").value, cf = $("#pConf").value;
  if (nw.length < 4) { err.textContent = "New passcode must be at least 4 characters."; return; }
  if (nw !== cf) { err.textContent = "New passcodes do not match."; return; }
  localStorage.setItem(LS.pass, await sha256hex(nw));
  $("#pCur").value = $("#pNew").value = $("#pConf").value = "";
  err.textContent = "";
  toast("Passcode changed.");
});

/* ---------- boot ---------- */
function paintAll() {
  if (!$("#billMonth").value) $("#billMonth").value = curMonth();
  paintSettings(); paintName();
  paintFlats(); paintBills(); paintComplaints(); paintNotices(); paintStats();
}
window.addEventListener("storage", (e) => {
  if ($("#dash").hidden) return;
  if ([LS.flats, LS.bills, LS.complaints, LS.notices].includes(e.key)) {
    paintFlats(); paintBills(); paintComplaints(); paintStats();
  }
});
paintName();
