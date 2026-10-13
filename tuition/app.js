/* TuitionOS — parent/student view */
"use strict";
const $ = (s, r) => (r || document).querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));
const digits = (s) => String(s || "").replace(/\D/g, "");
const last10 = (s) => digits(s).slice(-10);
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

function load(k, fb) {
  try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; }
  catch (_) { return fb; }
}
const monthKey = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
const monthName = (mk) => {
  const [y, m] = mk.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
};

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600);
}

function boot() {
  const settings = load("tuition_settings", {});
  if (settings.tuitionName) $("#bizName").textContent = settings.tuitionName;
  $("#btnFind").addEventListener("click", lookup);
  $("#phone").addEventListener("keydown", (e) => { if (e.key === "Enter") lookup(); });
}

function lookup() {
  const q = last10($("#phone").value);
  $("#lookupErr").textContent = "";
  if (q.length < 10) { $("#lookupErr").textContent = "Please enter a valid 10-digit number."; return; }
  const students = load("tuition_students", []);
  const matches = students.filter((s) => last10(s.phone) === q || last10(s.parentPhone) === q);
  if (!matches.length) { $("#lookupErr").textContent = "No student found for this number."; return; }
  render(matches[0]);
}

function render(st) {
  const settings = load("tuition_settings", {});
  const mk = monthKey(new Date());
  const att = load("tuition_attendance", []).filter((a) => a.studentId === st.id && a.date.slice(0, 7) === mk);
  const marked = att.filter((a) => a.status === "present" || a.status === "absent");
  const present = att.filter((a) => a.status === "present").length;
  const attPct = marked.length ? Math.round((present / marked.length) * 100) : null;

  const fees = load("tuition_fees", []);
  const fee = fees.find((f) => f.studentId === st.id && f.month === mk);
  const feeStatus = fee ? fee.status : "unpaid";
  const upi = settings.upiId ? ("upi://pay?pa=" + encodeURIComponent(settings.upiId) +
    "&pn=" + encodeURIComponent(settings.tuitionName || "Tuition") +
    "&am=" + Number(st.fee || 0) + "&cu=INR") : "";

  const scores = load("tuition_scores", []).filter((s) => s.studentId === st.id)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  let scoresHtml = scores.length ? scores.map((s) => {
    const pct = s.max > 0 ? Math.round((s.marks / s.max) * 100) : 0;
    return `<div class="kv"><span class="k">${esc(s.test)} <span style="color:var(--muted)">· ${esc(s.date || "")}</span></span>` +
      `<strong>${esc(String(s.marks))}/${esc(String(s.max))}</strong></div>`;
  }).join("") : `<div class="empty">No test scores yet.</div>`;

  $("#report").innerHTML = `
    <div class="card">
      <h3>${esc(st.name)}</h3>
      <div class="kv"><span class="k">Batch</span><span>${esc(st.batch || "—")}</span></div>
      <div class="kv"><span class="k">Monthly fee</span><span>${inr(st.fee)}</span></div>
    </div>
    <div class="card">
      <h3>Attendance — ${esc(monthName(mk))}</h3>
      ${attPct == null
        ? `<div class="empty">No attendance marked yet this month.</div>`
        : `<div class="big">${attPct}%</div>
           <div class="hint">${present} of ${marked.length} days present</div>
           <div class="scorebar"><i style="width:${attPct}%"></i></div>`}
    </div>
    <div class="card">
      <h3>Fee — ${esc(monthName(mk))}</h3>
      <div class="kv"><span class="k">Amount</span><span>${inr(st.fee)}</span></div>
      <div class="kv"><span class="k">Status</span>
        <span class="chip ${feeStatus === "paid" ? "paid" : "unpaid"}">${feeStatus === "paid" ? "Paid ✓" : "Pending"}</span></div>
      ${feeStatus === "paid"
        ? `<div class="hint">Thank you — fee received for ${esc(monthName(mk))}.</div>`
        : (upi ? `<a class="btn block" style="margin-top:12px;text-decoration:none" href="${upi}">Pay ${inr(st.fee)} via UPI</a>`
               : `<div class="hint">Please contact your teacher to pay.</div>`)}
    </div>
    <div class="card">
      <h3>Test scores</h3>
      ${scoresHtml}
    </div>`;
  $("#report").hidden = false;
  $("#report").scrollIntoView({ behavior: "smooth", block: "start" });
  toast("Report loaded");
}

document.addEventListener("DOMContentLoaded", boot);
