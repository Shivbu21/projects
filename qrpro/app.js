/* QR Pro — shared helpers + public landing logic */
"use strict";

const LS_QRS = "qrp_qrs";
const LS_SCANS = "qrp_scans";
const LS_PASS = "qrp_pass";
const DEFAULT_PASS_HASH = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"; // sha256("1234")

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function load(key, fb) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fb : v; }
  catch (_) { return fb; }
}
function save(key, v) { localStorage.setItem(key, JSON.stringify(v)); }

function loadQrs() { const q = load(LS_QRS, []); return Array.isArray(q) ? q : []; }
function loadScans() { const s = load(LS_SCANS, []); return Array.isArray(s) ? s : []; }

function uid(prefix) {
  return (prefix || "q") + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36);
}

/* The redirect URL a printed QR encodes. Built from the current location so it
   is correct on localhost AND on the deployed site without configuration. */
function redirectUrl(id) {
  const dir = location.href.replace(/[^/]*$/, "");
  return dir + "r.html?id=" + encodeURIComponent(id);
}

function qrImageUrl(redirect) {
  return "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=" +
    encodeURIComponent(redirect);
}

async function sha256hex(str) {
  if (window.crypto && window.crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return "plain:" + str; /* non-secure context: fail closed, never matches a stored hash */
}
function storedPassHash() { return localStorage.getItem(LS_PASS) || DEFAULT_PASS_HASH; }

function toast(msg) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), 2600);
}

function isHttpsUrl(u) { return /^https:\/\//i.test(String(u || "").trim()); }

function scanCountFor(scans, qrId) {
  let n = 0;
  for (const s of scans) if (s.qrId === qrId) n++;
  return n;
}

/* ---------- public landing: render the QR list ---------- */
function renderPublicGrid() {
  const grid = $("#qrGrid"), empty = $("#qrEmpty");
  if (!grid) return;
  const qrs = loadQrs(), scans = loadScans();
  grid.innerHTML = "";
  if (!qrs.length) { empty.hidden = false; return; }
  empty.hidden = true;
  for (const q of qrs) {
    const link = redirectUrl(q.id);
    const n = scanCountFor(scans, q.id);
    const card = document.createElement("div");
    card.className = "qrcard";
    card.innerHTML =
      '<img src="' + qrImageUrl(link) + '" alt="QR code for ' + esc(q.name) + '" loading="lazy">' +
      '<div class="nm">' + esc(q.name) + "</div>" +
      (q.label ? '<div class="lb">' + esc(q.label) + "</div>" : "") +
      '<div class="scans">' + n + " scan" + (n === 1 ? "" : "s") + "</div>" +
      '<div class="row">' +
        '<button class="btn small ghost" data-copy="' + esc(link) + '">Copy link</button>' +
        '<a class="btn small ghost" href="' + esc(link) + '" target="_blank" rel="noopener">Open</a>' +
      "</div>";
    grid.appendChild(card);
  }
  $$("[data-copy]", grid).forEach((b) =>
    b.addEventListener("click", () => copyText(b.getAttribute("data-copy"))));
}

function copyText(text) {
  const done = () => toast("Link copied");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  } else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement("textarea");
  ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
  document.body.appendChild(ta); ta.select();
  try { document.execCommand("copy"); done(); } catch (_) { toast("Copy failed — long-press the link"); }
  document.body.removeChild(ta);
}

document.addEventListener("DOMContentLoaded", renderPublicGrid);
