/* SocietyOS — resident view */
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => "s" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

const LS = {
  flats: "society_flats",
  bills: "society_bills",
  complaints: "society_complaints",
  notices: "society_notices",
  settings: "society_settings",
};
function load(k, fb) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; } catch { return fb; } }
function save(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600);
}
function settings() {
  return Object.assign({ societyName: "Greenview Residency", upiId: "", defaultAmount: 2500 }, load(LS.settings, {}));
}
const digits = (p) => String(p || "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
const monthLabel = (m) => { const [y, mo] = m.split("-"); return new Date(+y, +mo - 1).toLocaleString("en", { month: "long", year: "numeric" }); };
const CAT = { water: "Water", electricity: "Electricity", lift: "Lift", cleanliness: "Cleanliness", other: "Other" };

let flat = null;

function upiLink(amount) {
  const s = settings();
  const pa = encodeURIComponent(s.upiId || "");
  const pn = encodeURIComponent(s.societyName);
  return `upi://pay?pa=${pa}&pn=${pn}&am=${encodeURIComponent(amount)}&cu=INR`;
}

function renderBills() {
  const bills = load(LS.bills, []).filter(b => b.flatId === flat.id)
    .sort((a, b) => b.month.localeCompare(a.month));
  const ul = $("#billList");
  $("#billEmpty").hidden = bills.length > 0;
  ul.innerHTML = bills.map(b => `
    <li>
      <div class="grow">
        <div><b>${esc(monthLabel(b.month))}</b> · ${inr(b.amount)}</div>
        <div class="sub">Bill ${esc(b.id.slice(0, 8).toUpperCase())}</div>
      </div>
      <span class="chip ${b.status}">${b.status === "paid" ? "Paid" : "Pending"}</span>
      ${b.status === "unpaid" ? `<a class="btn small" href="${esc(upiLink(b.amount))}">Pay ${inr(b.amount)}</a>` : ""}
    </li>`).join("");
}

function renderMyComplaints() {
  const list = load(LS.complaints, []).filter(c => c.flatId === flat.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const ul = $("#cmpList");
  $("#cmpEmpty").hidden = list.length > 0;
  ul.innerHTML = list.map(c => `
    <li>
      <div class="grow">
        <div><b>${esc(CAT[c.category] || c.category)}</b></div>
        <div class="sub">${esc(c.desc)}</div>
        <div class="sub">${new Date(c.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</div>
      </div>
      <span class="chip ${c.status}">${c.status === "open" ? "Open" : "Resolved"}</span>
    </li>`).join("");
}

function renderNotices() {
  const list = load(LS.notices, []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const box = $("#noticeBoard");
  $("#noticeEmpty").hidden = list.length > 0;
  box.innerHTML = list.map(n => `
    <div class="notice">
      <b>${esc(n.title)}</b>
      <p>${esc(n.body)}</p>
      <div class="sub">${new Date(n.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
    </div>`).join("");
}

function showHome() {
  $("#lookupCard").hidden = true;
  $("#home").hidden = false;
  $("#flatTitle").textContent = `Tower ${flat.tower} · Flat ${flat.flat}`;
  $("#flatSub").textContent = `${flat.owner} · ${flat.phone}`;
  renderBills(); renderMyComplaints(); renderNotices();
}

$("#btnFind").addEventListener("click", () => {
  const tower = $("#inTower").value.trim().toUpperCase();
  const fno = $("#inFlat").value.trim();
  const phone = digits($("#inPhone").value);
  const flats = load(LS.flats, []);
  let found = null;
  if (phone) found = flats.find(f => digits(f.phone) === phone);
  if (!found && tower && fno) found = flats.find(f => f.tower.toUpperCase() === tower && f.flat === fno);
  if (!found) { $("#lookupErr").textContent = "Flat not found. Check tower, flat no. or registered phone."; return; }
  $("#lookupErr").textContent = "";
  flat = found;
  showHome();
});
$("#btnChange").addEventListener("click", () => {
  flat = null;
  $("#home").hidden = true;
  $("#lookupCard").hidden = false;
  $("#inTower").value = ""; $("#inFlat").value = ""; $("#inPhone").value = "";
});

$("#btnComplaint").addEventListener("click", () => {
  const desc = $("#cmpDesc").value.trim();
  if (!flat) return;
  if (!desc) { toast("Please describe the issue."); return; }
  const list = load(LS.complaints, []);
  list.push({ id: uid(), flatId: flat.id, category: $("#cmpCat").value, desc, status: "open", createdAt: new Date().toISOString() });
  save(LS.complaints, list);
  $("#cmpDesc").value = "";
  renderMyComplaints();
  toast("Complaint submitted.");
});

/* live refresh when the secretary acts in another tab */
window.addEventListener("storage", (e) => {
  if (!flat) return;
  if ([LS.bills, LS.complaints, LS.notices].includes(e.key)) {
    renderBills(); renderMyComplaints(); renderNotices();
  }
});

$("#societyName").textContent = settings().societyName + " · Resident Portal";
