/* TuitionOS — teacher dashboard */
"use strict";
const $ = (s, r) => (r || document).querySelector(s);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));
const digits = (s) => String(s || "").replace(/\D/g, "");
const last10 = (s) => digits(s).slice(-10);
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const uid = (p) => (p || "id") + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
const DEFAULT_PASS_HASH = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"; // 1234

function load(k, fb) {
  try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; }
  catch (_) { return fb; }
}
function save(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthKey = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
const monthName = (mk) => {
  const [y, m] = mk.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
};

async function sha256hex(str) {
  if (window.crypto && window.crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return "plain:" + str; /* non-secure context: fail closed */
}
const storedHash = () => localStorage.getItem("tuition_pass") || DEFAULT_PASS_HASH;

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------- seed (dashboard context only, once) ---------- */
function seedOnce() {
  if (localStorage.getItem("tuition_seeded")) return;
  const students = [
    { id: "st-aarav", name: "Aarav Mehta", phone: "9811022334", parentPhone: "9811022335", batch: "Class 10 Morning", fee: 1500 },
    { id: "st-priya", name: "Priya Nair", phone: "9822044510", parentPhone: "9822044511", batch: "Class 10 Morning", fee: 1500 },
    { id: "st-rohit", name: "Rohit Kumar", phone: "9890177882", parentPhone: "9890177883", batch: "Class 10 Morning", fee: 1200 },
    { id: "st-meera", name: "Meera Iyer", phone: "9845011223", parentPhone: "9845011224", batch: "Class 12 Evening", fee: 2000 },
    { id: "st-dev", name: "Dev Patel", phone: "9811133445", parentPhone: "9811133446", batch: "Class 12 Evening", fee: 2000 },
    { id: "st-sana", name: "Sana Sheikh", phone: "9830055667", parentPhone: "9830055668", batch: "Class 12 Evening", fee: 1800 }
  ];
  const t = todayISO(), mk = monthKey(new Date());
  const attendance = students.map((s, i) => ({
    id: "sa-" + s.id, studentId: s.id, date: t, status: i === 4 ? "absent" : "present"
  }));
  const fees = students.map((s, i) => ({
    id: "fe-" + s.id, studentId: s.id, month: mk, status: i < 2 ? "paid" : "unpaid"
  }));
  const scores = [
    { id: "sc1", studentId: "st-aarav", test: "Maths Unit Test 1", marks: 42, max: 50, date: t },
    { id: "sc2", studentId: "st-priya", test: "Maths Unit Test 1", marks: 47, max: 50, date: t },
    { id: "sc3", studentId: "st-meera", test: "Physics Mock", marks: 63, max: 70, date: t },
    { id: "sc4", studentId: "st-dev", test: "Physics Mock", marks: 58, max: 70, date: t }
  ];
  save("tuition_students", students);
  save("tuition_attendance", attendance);
  save("tuition_fees", fees);
  save("tuition_scores", scores);
  save("tuition_settings", { tuitionName: "Sharma Tuition Classes", upiId: "sharmatuition@upi" });
  localStorage.setItem("tuition_seeded", "1");
}

/* ---------- state ---------- */
let state = { tab: "students", attDate: todayISO(), feeMonth: monthKey(new Date()), batchFilter: "all" };
const students = () => load("tuition_students", []);
const batches = () => [...new Set(students().map((s) => s.batch).filter(Boolean))];
const feeFor = (sid, mk) => load("tuition_fees", []).find((f) => f.studentId === sid && f.month === mk);
const attFor = (sid, date) => load("tuition_attendance", []).find((a) => a.studentId === sid && a.date === date);

/* ---------- stats ---------- */
function renderStats() {
  const st = students(), mk = monthKey(new Date()), t = todayISO();
  let collected = 0, pending = 0;
  st.forEach((s) => {
    const f = feeFor(s.id, mk);
    if (f && f.status === "paid") collected += Number(s.fee || 0);
    else pending += Number(s.fee || 0);
  });
  const rows = load("tuition_attendance", []).filter((a) => a.date === t);
  const marked = rows.filter((a) => a.status === "present" || a.status === "absent");
  const pres = rows.filter((a) => a.status === "present").length;
  $("#stCollected").textContent = inr(collected);
  $("#stPending").textContent = inr(pending);
  $("#stAttend").textContent = marked.length ? Math.round((pres / marked.length) * 100) + "%" : "—";
  $("#stStudents").textContent = st.length;
  const settings = load("tuition_settings", {});
  if (settings.tuitionName) { $("#bizName").textContent = settings.tuitionName; }
}

/* ---------- students tab ---------- */
function renderStudents() {
  const st = students();
  const list = state.batchFilter === "all" ? st : st.filter((s) => s.batch === state.batchFilter);
  const opts = [`<option value="all">All batches</option>`]
    .concat(batches().map((b) => `<option value="${esc(b)}"${b === state.batchFilter ? " selected" : ""}>${esc(b)}</option>`)).join("");
  $("#pane-students").innerHTML = `
    <div class="card">
      <h3>Add student</h3>
      <div class="grid2">
        <div class="field"><label>Name</label><input id="ns-name" placeholder="Student name"></div>
        <div class="field"><label>Batch</label><input id="ns-batch" list="batchList" placeholder="e.g. Class 10 Morning">
          <datalist id="batchList">${batches().map((b) => `<option value="${esc(b)}">`).join("")}</datalist></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Student phone</label><input id="ns-phone" type="tel" inputmode="numeric" placeholder="10-digit"></div>
        <div class="field"><label>Parent phone</label><input id="ns-pphone" type="tel" inputmode="numeric" placeholder="10-digit"></div>
      </div>
      <div class="field"><label>Monthly fee (₹)</label><input id="ns-fee" type="number" inputmode="numeric" placeholder="1500"></div>
      <button class="btn block" id="ns-add">Add student</button>
      <div class="err" id="ns-err"></div>
    </div>
    <div class="toolbar">
      <select id="batchFilter" style="flex:1;border:1.5px solid var(--line);border-radius:10px;padding:9px 10px;background:#fff">${opts}</select>
    </div>
    ${list.length ? list.map((s) => `
      <div class="card"><div class="row">
        <div class="who"><div class="nm">${esc(s.name)}</div>
          <div class="sub">${esc(s.batch || "—")} · ${inr(s.fee)}/mo · ${esc(s.phone || "")}</div></div>
        <button class="btn sm bad" data-del="${s.id}">Remove</button>
      </div></div>`).join("")
      : `<div class="empty">No students yet — add your first one above.</div>`}`;

  $("#ns-add").addEventListener("click", () => {
    const name = $("#ns-name").value.trim();
    const batch = $("#ns-batch").value.trim();
    const phone = last10($("#ns-phone").value);
    const pphone = last10($("#ns-pphone").value);
    const fee = Number($("#ns-fee").value) || 0;
    if (!name) { $("#ns-err").textContent = "Name is required."; return; }
    if (phone.length < 10) { $("#ns-err").textContent = "Enter a valid 10-digit student phone."; return; }
    const all = students();
    all.push({ id: uid("st-"), name, batch, phone, parentPhone: pphone, fee });
    save("tuition_students", all);
    toast("Student added"); renderAll();
  });
  $("#batchFilter").addEventListener("change", (e) => { state.batchFilter = e.target.value; renderStudents(); });
  document.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => {
    const id = b.getAttribute("data-del");
    if (!confirm("Remove this student and all their records?")) return;
    save("tuition_students", students().filter((s) => s.id !== id));
    save("tuition_attendance", load("tuition_attendance", []).filter((a) => a.studentId !== id));
    save("tuition_fees", load("tuition_fees", []).filter((f) => f.studentId !== id));
    save("tuition_scores", load("tuition_scores", []).filter((s) => s.studentId !== id));
    toast("Removed"); renderAll();
  }));
}

/* ---------- attendance tab ---------- */
function renderAttend() {
  const st = students(), d = state.attDate;
  $("#pane-attend").innerHTML = `
    <div class="toolbar">
      <input type="date" id="attDate" value="${d}" max="${todayISO()}">
      <span class="chip info" id="attCount"></span>
    </div>
    ${st.length ? st.map((s) => {
      const r = attFor(s.id, d);
      const cur = r ? r.status : "";
      return `<div class="card"><div class="row">
        <div class="who"><div class="nm">${esc(s.name)}</div><div class="sub">${esc(s.batch || "")}</div></div>
        <div class="seg">
          <button data-att="${s.id}|present" class="${cur === "present" ? "on-p" : ""}">Present</button>
          <button data-att="${s.id}|absent" class="${cur === "absent" ? "on-a" : ""}">Absent</button>
        </div>
      </div></div>`;
    }).join("") : `<div class="empty">Add students first.</div>`}`;
  const marked = load("tuition_attendance", []).filter((a) => a.date === d).length;
  $("#attCount").textContent = marked + " / " + st.length + " marked";
  $("#attDate").addEventListener("change", (e) => { state.attDate = e.target.value || todayISO(); renderAttend(); });
  document.querySelectorAll("[data-att]").forEach((b) => b.addEventListener("click", () => {
    const [sid, status] = b.getAttribute("data-att").split("|");
    const all = load("tuition_attendance", []);
    const ex = all.find((a) => a.studentId === sid && a.date === d);
    if (ex) ex.status = status;
    else all.push({ id: uid("sa-"), studentId: sid, date: d, status });
    save("tuition_attendance", all);
    renderAttend(); renderStats();
  }));
}

/* ---------- fees tab ---------- */
function upiLink(st) {
  const settings = load("tuition_settings", {});
  if (!settings.upiId) return "";
  return "upi://pay?pa=" + encodeURIComponent(settings.upiId) +
    "&pn=" + encodeURIComponent(settings.tuitionName || "Tuition") +
    "&am=" + Number(st.fee || 0) + "&cu=INR";
}
function renderFees() {
  const st = students(), mk = state.feeMonth;
  $("#pane-fees").innerHTML = `
    <div class="toolbar">
      <input type="month" id="feeMonth" value="${mk}">
      <span class="hint" style="margin:0">${esc(monthName(mk))}</span>
    </div>
    ${st.length ? st.map((s) => {
      const f = feeFor(s.id, mk);
      const paid = f && f.status === "paid";
      return `<div class="card"><div class="row">
        <div class="who"><div class="nm">${esc(s.name)}</div>
          <div class="sub">${inr(s.fee)} · <span class="chip ${paid ? "paid" : "unpaid"}">${paid ? "Paid ✓" : "Pending"}</span></div></div>
        <div class="actions">
          <button class="btn sm ${paid ? "ghost" : "good"}" data-fee="${s.id}">${paid ? "Mark unpaid" : "Mark paid"}</button>
          ${paid ? "" : `<button class="btn sm soft" data-remind="${s.id}">WhatsApp</button>`}
        </div>
      </div></div>`;
    }).join("") : `<div class="empty">Add students first.</div>`}`;
  $("#feeMonth").addEventListener("change", (e) => { state.feeMonth = e.target.value || monthKey(new Date()); renderFees(); });
  document.querySelectorAll("[data-fee]").forEach((b) => b.addEventListener("click", () => {
    const sid = b.getAttribute("data-fee");
    const all = load("tuition_fees", []);
    const ex = all.find((f) => f.studentId === sid && f.month === mk);
    if (ex) ex.status = ex.status === "paid" ? "unpaid" : "paid";
    else all.push({ id: uid("fe-"), studentId: sid, month: mk, status: "paid" });
    save("tuition_fees", all);
    renderFees(); renderStats();
  }));
  document.querySelectorAll("[data-remind]").forEach((b) => b.addEventListener("click", () => {
    const s = students().find((x) => x.id === b.getAttribute("data-remind"));
    if (!s) return;
    const settings = load("tuition_settings", {});
    const d = digits(s.parentPhone || s.phone);
    const to = d.length === 10 ? "91" + d : d;
    if (!to) { toast("No parent number saved"); return; }
    const upi = upiLink(s);
    const msg = `Hello! Fee reminder from ${settings.tuitionName || "tuition"}: ${inr(s.fee)} for ${monthName(mk)} for ${s.name} is pending.` +
      (upi ? ` Please pay here: ${upi}` : "");
    window.open("https://wa.me/" + to + "?text=" + encodeURIComponent(msg), "_blank", "noopener");
    toast("Opening WhatsApp…");
  }));
}

/* ---------- scores tab ---------- */
function renderScores() {
  const st = students();
  const scores = load("tuition_scores", []);
  const avg = (sid) => {
    const mine = scores.filter((s) => s.studentId === sid && s.max > 0);
    if (!mine.length) return null;
    const m = mine.reduce((a, s) => a + Number(s.marks), 0);
    const mx = mine.reduce((a, s) => a + Number(s.max), 0);
    return Math.round((m / mx) * 100);
  };
  $("#pane-scores").innerHTML = `
    <div class="card">
      <h3>Add test score</h3>
      <div class="field"><label>Student</label><select id="sc-student">
        ${st.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("")}</select></div>
      <div class="field"><label>Test name</label><input id="sc-test" placeholder="e.g. Maths Unit Test 2"></div>
      <div class="grid2">
        <div class="field"><label>Marks</label><input id="sc-marks" type="number" inputmode="numeric" placeholder="38"></div>
        <div class="field"><label>Max marks</label><input id="sc-max" type="number" inputmode="numeric" placeholder="50"></div>
      </div>
      <button class="btn block" id="sc-add">Save score</button>
      <div class="err" id="sc-err"></div>
    </div>
    ${st.length ? st.map((s) => {
      const mine = scores.filter((x) => x.studentId === s.id)
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      const a = avg(s.id);
      return `<div class="card">
        <div class="row"><div class="who"><div class="nm">${esc(s.name)}</div>
          <div class="sub">${mine.length} test${mine.length === 1 ? "" : "s"}</div></div>
          ${a == null ? `<span class="chip info">no scores</span>` : `<span class="chip info">avg ${a}%</span>`}</div>
        ${mine.map((x) => `<div class="kv"><span class="k">${esc(x.test)} <span style="color:var(--muted)">· ${esc(x.date || "")}</span></span>
          <strong>${esc(String(x.marks))}/${esc(String(x.max))}</strong></div>`).join("")}
      </div>`;
    }).join("") : `<div class="empty">Add students first.</div>`}`;
  const addBtn = $("#sc-add");
  if (addBtn) addBtn.addEventListener("click", () => {
    const sid = $("#sc-student").value;
    const test = $("#sc-test").value.trim();
    const marks = Number($("#sc-marks").value);
    const max = Number($("#sc-max").value);
    if (!sid || !test) { $("#sc-err").textContent = "Pick a student and name the test."; return; }
    if (!(marks >= 0) || !(max > 0) || marks > max) { $("#sc-err").textContent = "Marks must be between 0 and max."; return; }
    const all = load("tuition_scores", []);
    all.push({ id: uid("sc-"), studentId: sid, test, marks, max, date: todayISO() });
    save("tuition_scores", all);
    toast("Score saved"); renderScores();
  });
}

/* ---------- settings tab ---------- */
function renderSettings() {
  const settings = load("tuition_settings", {});
  $("#pane-settings").innerHTML = `
    <div class="card">
      <h3>Tuition details</h3>
      <div class="field"><label>Tuition name</label><input id="set-name" value="${esc(settings.tuitionName || "")}" placeholder="Sharma Tuition Classes"></div>
      <div class="field"><label>UPI ID (for fee payments)</label><input id="set-upi" value="${esc(settings.upiId || "")}" placeholder="name@upi"></div>
      <button class="btn block" id="set-save">Save settings</button>
    </div>
    <div class="card">
      <h3>Change passcode</h3>
      <div class="field"><label>Current passcode</label><input id="pc-cur" type="password" inputmode="numeric"></div>
      <div class="grid2">
        <div class="field"><label>New passcode</label><input id="pc-new" type="password" inputmode="numeric"></div>
        <div class="field"><label>Confirm</label><input id="pc-conf" type="password" inputmode="numeric"></div>
      </div>
      <button class="btn block" id="pc-save">Change passcode</button>
      <div class="err" id="pc-err"></div>
    </div>`;
  $("#set-save").addEventListener("click", () => {
    save("tuition_settings", {
      tuitionName: $("#set-name").value.trim(),
      upiId: $("#set-upi").value.trim()
    });
    toast("Settings saved"); renderStats();
  });
  $("#pc-save").addEventListener("click", async () => {
    const cur = $("#pc-cur").value, nw = $("#pc-new").value, cf = $("#pc-conf").value;
    if (await sha256hex(cur) !== storedHash()) { $("#pc-err").textContent = "Current passcode is wrong."; return; }
    if (nw.length < 4) { $("#pc-err").textContent = "New passcode must be at least 4 characters."; return; }
    if (nw !== cf) { $("#pc-err").textContent = "New passcodes don't match."; return; }
    localStorage.setItem("tuition_pass", await sha256hex(nw));
    $("#pc-cur").value = $("#pc-new").value = $("#pc-conf").value = "";
    toast("Passcode changed");
  });
}

/* ---------- tab switching ---------- */
function renderAll() {
  renderStats();
  renderStudents(); renderAttend(); renderFees(); renderScores(); renderSettings();
}
function showTab(name) {
  state.tab = name;
  document.querySelectorAll("#tabs .tab").forEach((t) => t.classList.toggle("on", t.dataset.tab === name));
  ["students", "attend", "fees", "scores", "settings"].forEach((n) => { $("#pane-" + n).hidden = n !== name; });
}

/* ---------- boot ---------- */
document.addEventListener("DOMContentLoaded", () => {
  seedOnce(); /* dashboard context only, once */
  $("#tabs").addEventListener("click", (e) => {
    const t = e.target.closest(".tab");
    if (t) showTab(t.dataset.tab);
  });
  $("#btnSettingsTop").addEventListener("click", () => showTab("settings"));

  const tryUnlock = async () => {
    const h = await sha256hex($("#pass").value);
    if (h === storedHash()) {
      $("#lock").hidden = true; $("#dash").hidden = false;
      renderAll();
    } else {
      $("#passErr").textContent = "Wrong passcode.";
    }
  };
  $("#btnUnlock").addEventListener("click", tryUnlock);
  $("#pass").addEventListener("keydown", (e) => { if (e.key === "Enter") tryUnlock(); });

  window.addEventListener("storage", (e) => {
    if (e.key && e.key.startsWith("tuition_") && !$("#dash").hidden) renderAll();
  });
});
