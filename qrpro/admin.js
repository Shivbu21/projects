/* QR Pro — owner dashboard */
"use strict";

/* ---------- passcode gate ---------- */
async function tryUnlock() {
  const input = $("#passInput").value;
  const err = $("#passErr");
  const h = await sha256hex(input);
  if (h === storedPassHash()) {
    err.textContent = "";
    $("#lock").hidden = true;
    $("#dash").hidden = false;
    renderAll();
  } else {
    err.textContent = "Wrong passcode. Try again.";
    $("#passInput").value = "";
    $("#passInput").focus();
  }
}

/* ---------- tabs ---------- */
function switchTab(name) {
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  ["qrs", "analytics", "settings"].forEach((t) => { $("#tab-" + t).hidden = t !== name; });
  if (name === "analytics") renderAnalytics();
}

/* ---------- QR CRUD ---------- */
function renderQrList() {
  const list = $("#qrList"), empty = $("#qrListEmpty");
  const qrs = loadQrs(), scans = loadScans();
  list.innerHTML = "";
  if (!qrs.length) { empty.hidden = false; return; }
  empty.hidden = true;
  const sorted = qrs.slice().sort((a, b) => b.createdAt - a.createdAt);
  for (const q of sorted) {
    const link = redirectUrl(q.id);
    const n = scanCountFor(scans, q.id);
    const row = document.createElement("div");
    row.className = "qrrow";
    row.innerHTML =
      '<img src="' + qrImageUrl(link) + '" alt="QR for ' + esc(q.name) + '" loading="lazy">' +
      '<div class="info">' +
        '<div class="nm">' + esc(q.name) + ' <span class="muted small">· ' + n + " scan" + (n === 1 ? "" : "s") + "</span></div>" +
        (q.label ? '<div class="muted small">' + esc(q.label) + "</div>" : "") +
        '<div class="url">→ ' + esc(q.url) + "</div>" +
        '<div class="linkbox"><code>' + esc(link) + "</code></div>" +
      "</div>" +
      '<div class="actions">' +
        '<button class="btn small ghost" data-act="copy" data-id="' + esc(q.id) + '">Copy link</button>' +
        '<button class="btn small ghost" data-act="retarget" data-id="' + esc(q.id) + '">Retarget</button>' +
        '<button class="btn small danger" data-act="delete" data-id="' + esc(q.id) + '">Delete</button>' +
      "</div>";
    list.appendChild(row);
  }
  $$("[data-act]", list).forEach((b) => b.addEventListener("click", () => {
    const id = b.getAttribute("data-id");
    const act = b.getAttribute("data-act");
    if (act === "copy") copyText(redirectUrl(id));
    else if (act === "retarget") openRetarget(id);
    else if (act === "delete") deleteQr(id);
  }));
}

function createQr() {
  const name = $("#fName").value.trim();
  const url = $("#fUrl").value.trim();
  const label = $("#fLabel").value.trim();
  const err = $("#fUrlErr");
  err.textContent = "";
  if (!name) { err.textContent = "Give the QR a name."; $("#fName").focus(); return; }
  if (!isHttpsUrl(url)) { err.textContent = "Destination must be a valid https:// URL."; $("#fUrl").focus(); return; }
  const qrs = loadQrs();
  qrs.push({ id: uid("q"), name, url, label, createdAt: Date.now() });
  save(LS_QRS, qrs);
  $("#fName").value = ""; $("#fUrl").value = ""; $("#fLabel").value = "";
  toast("QR code created — print the image above");
  renderQrList();
}

let retargetId = null;
function openRetarget(id) {
  const q = loadQrs().find((x) => x.id === id);
  if (!q) return;
  retargetId = id;
  $("#retargetName").textContent = q.name + " → currently: " + q.url;
  $("#rUrl").value = q.url;
  $("#rUrlErr").textContent = "";
  $("#retargetVeil").hidden = false;
  $("#rUrl").focus();
}
function saveRetarget() {
  const url = $("#rUrl").value.trim();
  if (!isHttpsUrl(url)) { $("#rUrlErr").textContent = "Destination must be a valid https:// URL."; return; }
  const qrs = loadQrs();
  const q = qrs.find((x) => x.id === retargetId);
  if (!q) return;
  q.url = url;
  save(LS_QRS, qrs);
  $("#retargetVeil").hidden = true;
  retargetId = null;
  toast("Retargeted — all printed QRs now go to the new link");
  renderQrList();
}

function deleteQr(id) {
  const q = loadQrs().find((x) => x.id === id);
  if (!q) return;
  if (!confirm('Delete "' + q.name + '" and its scan history? Printed QRs will stop working.')) return;
  save(LS_QRS, loadQrs().filter((x) => x.id !== id));
  save(LS_SCANS, loadScans().filter((s) => s.qrId !== id));
  toast("QR deleted");
  renderQrList();
}

/* ---------- analytics ---------- */
function dayKey(ts) {
  const d = new Date(ts);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function renderAnalytics() {
  const qrs = loadQrs(), scans = loadScans();
  $("#stTotal").textContent = scans.length;
  const today = dayKey(Date.now());
  $("#stToday").textContent = scans.filter((s) => dayKey(s.ts) === today).length;
  $("#stQrs").textContent = qrs.length;

  // 14-day chart
  const chart = $("#chart");
  chart.innerHTML = "";
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    days.push({ key: dayKey(d.getTime()), label: d.getDate() + "/" + (d.getMonth() + 1) });
  }
  const counts = days.map((d) => scans.filter((s) => dayKey(s.ts) === d.key).length);
  const max = Math.max(1, ...counts);
  days.forEach((d, i) => {
    const col = document.createElement("div");
    col.className = "bar-col";
    const h = Math.round((counts[i] / max) * 110);
    col.innerHTML =
      '<div class="c">' + (counts[i] || "") + "</div>" +
      '<div class="bar" style="height:' + h + 'px"></div>' +
      '<div class="d">' + d.label + "</div>";
    chart.appendChild(col);
  });

  // per-QR table
  const tb = $("#perQr");
  tb.innerHTML = "";
  const rows = qrs.map((q) => ({ q, n: scanCountFor(scans, q.id) }))
    .sort((a, b) => b.n - a.n);
  if (!rows.length) {
    tb.innerHTML = '<tr><td colspan="3" class="muted">No QR codes yet.</td></tr>';
    return;
  }
  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML =
      "<td><b>" + esc(r.q.name) + "</b>" + (r.q.label ? '<br><span class="muted small">' + esc(r.q.label) + "</span>" : "") + "</td>" +
      '<td class="small" style="word-break:break-all">' + esc(r.q.url) + "</td>" +
      "<td><b>" + r.n + "</b></td>";
    tb.appendChild(tr);
  }
}

/* ---------- settings ---------- */
async function changePasscode() {
  const cur = $("#sCur").value, nw = $("#sNew").value, nw2 = $("#sNew2").value;
  const err = $("#sErr");
  err.textContent = "";
  if ((await sha256hex(cur)) !== storedPassHash()) { err.textContent = "Current passcode is wrong."; return; }
  if (nw.length < 4) { err.textContent = "New passcode must be at least 4 characters."; return; }
  if (nw !== nw2) { err.textContent = "New passcodes don't match."; return; }
  localStorage.setItem(LS_PASS, await sha256hex(nw));
  $("#sCur").value = $("#sNew").value = $("#sNew2").value = "";
  toast("Passcode changed");
}

function renderAll() { renderQrList(); }

document.addEventListener("DOMContentLoaded", () => {
  $("#unlockBtn").addEventListener("click", tryUnlock);
  $("#passInput").addEventListener("keydown", (e) => { if (e.key === "Enter") tryUnlock(); });
  $$(".tab").forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));
  $("#createBtn").addEventListener("click", createQr);
  $("#rCancel").addEventListener("click", () => { $("#retargetVeil").hidden = true; retargetId = null; });
  $("#rSave").addEventListener("click", saveRetarget);
  $("#retargetVeil").addEventListener("click", (e) => {
    if (e.target.id === "retargetVeil") { $("#retargetVeil").hidden = true; retargetId = null; }
  });
  $("#changePassBtn").addEventListener("click", changePasscode);
  $("#wipeBtn").addEventListener("click", () => {
    if (!confirm("Delete ALL QR codes and scan history? This cannot be undone.")) return;
    localStorage.removeItem(LS_QRS);
    localStorage.removeItem(LS_SCANS);
    toast("All data deleted");
    renderAll();
  });
  $("#passInput").focus();
});
