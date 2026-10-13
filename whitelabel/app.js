/* White-label ScanQ — configurator.
   Steps: 1 Brand → 2 Type → 3 Preview → 4 Download.
   Config in localStorage under wl_config. Live preview via postMessage. */
(function () {
  "use strict";
  var CFG_KEY = "wl_config";
  var COLORS = ["#0E7A3E", "#7C3AED", "#B45309", "#BE185D", "#0F766E", "#1D4ED8"];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  function defaults() {
    return {
      name: "", tagline: "", type: "queue", color: COLORS[0],
      logo: "", phone: "", welcome: "Welcome! Take your token below and we'll call you."
    };
  }
  function loadCfg() {
    try { var c = JSON.parse(localStorage.getItem(CFG_KEY)); if (c) return Object.assign(defaults(), c); }
    catch (e) {}
    return defaults();
  }
  function saveCfg(c) { localStorage.setItem(CFG_KEY, JSON.stringify(c)); }

  var cfg = loadCfg();
  var step = 1;

  function slug(name) {
    return (name || "my-app").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "my-app";
  }

  /* ---------- live preview sync ---------- */
  function pushPreview() {
    saveCfg(cfg);
    ["livePreview", "bigPreview"].forEach(function (id) {
      var f = document.getElementById(id);
      if (f && f.contentWindow) {
        try { f.contentWindow.postMessage({ type: "wl-config", config: cfg }, "*"); } catch (e) {}
      }
    });
  }

  /* ---------- steps ---------- */
  function goStep(n) {
    if (n === 2 && !cfg.name.trim()) {
      $("#fName").focus(); $("#fName").style.borderColor = "#b3261e";
      return;
    }
    step = n;
    $all("[data-step]").forEach(function (p) { p.hidden = +p.getAttribute("data-step") !== n; });
    $all("#stepsBar .step").forEach(function (s) {
      var k = +s.getAttribute("data-go");
      s.classList.toggle("active", k === n);
      s.classList.toggle("done", k < n);
    });
    if (n === 4) renderSummary();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- step 1: brand ---------- */
  function renderSwatches() {
    var box = $("#swatches"); box.innerHTML = "";
    COLORS.forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "swatch" + (cfg.color === c ? " sel" : "");
      b.style.background = c; b.title = c; b.setAttribute("aria-label", "color " + c);
      b.addEventListener("click", function () { cfg.color = c; pushPreview(); renderSwatches(); syncCustom(); });
      box.appendChild(b);
    });
    var ci = document.createElement("input");
    ci.type = "color"; ci.className = "custom"; ci.id = "customColor"; ci.value = cfg.color; ci.title = "Custom color";
    ci.addEventListener("input", function () { cfg.color = ci.value; pushPreview(); renderSwatches(); });
    box.appendChild(ci);
  }
  function syncCustom() { var ci = $("#customColor"); if (ci) ci.value = cfg.color; }

  function renderLogoPrev() {
    var p = $("#logoPrev");
    if (cfg.logo) { p.innerHTML = '<img src="' + cfg.logo + '" alt="logo">'; $("#btnLogoRm").hidden = false; }
    else { p.textContent = "No logo"; $("#btnLogoRm").hidden = true; }
  }

  function fileToLogo(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, 256 / Math.max(img.width, img.height));
        var cv = document.createElement("canvas");
        cv.width = Math.max(1, Math.round(img.width * s));
        cv.height = Math.max(1, Math.round(img.height * s));
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        res(cv.toDataURL("image/png"));
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error("bad image")); };
      img.src = url;
    });
  }

  function bindStep1() {
    $("#fName").value = cfg.name; $("#fTagline").value = cfg.tagline;
    $("#fPhone").value = cfg.phone; $("#fWelcome").value = cfg.welcome;
    renderSwatches(); renderLogoPrev();
    $("#fName").addEventListener("input", function (e) { cfg.name = e.target.value; pushPreview(); });
    $("#fTagline").addEventListener("input", function (e) { cfg.tagline = e.target.value; pushPreview(); });
    $("#fPhone").addEventListener("input", function (e) { cfg.phone = e.target.value.replace(/\D/g, "").slice(0, 13); pushPreview(); });
    $("#fWelcome").addEventListener("input", function (e) { cfg.welcome = e.target.value; pushPreview(); });
    $("#btnLogo").addEventListener("click", function () { $("#fLogo").click(); });
    $("#fLogo").addEventListener("change", function (e) {
      var f = e.target.files[0]; if (!f) return;
      fileToLogo(f).then(function (d) { cfg.logo = d; pushPreview(); renderLogoPrev(); })
        .catch(function () { alert("Could not read that image."); });
    });
    $("#btnLogoRm").addEventListener("click", function () { cfg.logo = ""; pushPreview(); renderLogoPrev(); });
    $("#next1").addEventListener("click", function () { goStep(2); });
  }

  /* ---------- step 2: type ---------- */
  function bindStep2() {
    $all("#typeCards .type-card").forEach(function (card) {
      card.classList.toggle("sel", card.getAttribute("data-type") === cfg.type);
      var pick = function () {
        cfg.type = card.getAttribute("data-type"); pushPreview(); bindStep2();
      };
      card.addEventListener("click", pick);
      card.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
    });
    $all("[data-next]").forEach(function (b) {
      b.addEventListener("click", function () { goStep(+b.getAttribute("data-next")); });
    });
    $all("[data-back]").forEach(function (b) {
      b.addEventListener("click", function () { goStep(+b.getAttribute("data-back")); });
    });
    $all("#stepsBar .step").forEach(function (s) {
      s.addEventListener("click", function () {
        var k = +s.getAttribute("data-go");
        if (k <= step) goStep(k);
        else if (k === step + 1 && (k !== 2 || cfg.name.trim())) goStep(k);
      });
    });
  }

  /* ---------- step 4: summary + export ---------- */
  var TYPE_NAMES = { queue: "Token Queue", slots: "Booking Slots", orders: "Order List" };
  function renderSummary() {
    $("#summaryTable").innerHTML =
      "<tr><td>Business</td><td><strong>" + esc(cfg.name) + "</strong></td></tr>" +
      "<tr><td>App type</td><td>" + esc(TYPE_NAMES[cfg.type]) + "</td></tr>" +
      "<tr><td>Brand color</td><td><span class='sw-dot' style='background:" + esc(cfg.color) + "'></span>" + esc(cfg.color) + "</td></tr>" +
      "<tr><td>Logo</td><td>" + (cfg.logo ? "Uploaded" : "None") + "</td></tr>" +
      "<tr><td>File</td><td><code class='k'>" + esc(slug(cfg.name)) + "-app.html</code></td></tr>";
  }

  /* The generated bundle: one self-contained HTML file.
     Inner script uses only single quotes + concatenation (no backticks/${)
     so it survives the outer template literal. */
  var BUNDLE_JS = [
    "var CFG=__CFG__;",
    "function esc(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c];});}",
    "function $(s,r){return (r||document).querySelector(s);}",
    "function uid(){return 'x'+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36);}",
    "var LS='wlapp_'+CFG.slug+'_items';",
    "function load(){try{var v=JSON.parse(localStorage.getItem(LS));return Array.isArray(v)?v:[]}catch(e){return []}}",
    "function save(a){localStorage.setItem(LS,JSON.stringify(a));}",
    "var isAdmin=/[?&]admin=1/.test(location.search);",
    "var authed=false;",
    "var META={queue:{cta:'Get my token',empty:'No tokens yet.',lbl:'Tokens'},slots:{cta:'Book my slot',empty:'No bookings yet.',lbl:'Bookings'},orders:{cta:'Place order',empty:'No orders yet.',lbl:'Orders'}};",
    "function nextToken(items){var m=0;items.forEach(function(i){if(i.n>m)m=i.n});return m+1;}",
    "function slots(){var d=['Today','Tomorrow'],t=['10:00 AM','12:00 PM','2:00 PM','4:00 PM','6:00 PM'],o=[];d.forEach(function(x){t.forEach(function(y){o.push(x+', '+y);});});return o;}",
    "function actions(type,st){",
    " if(type==='queue'){if(st==='waiting')return [['Call next','serving']];if(st==='serving')return [['Mark done','done']];return [];}",
    " if(type==='slots'){if(st==='booked')return [['Confirm','confirmed'],['Cancel','cancelled']];return [];}",
    " if(st==='pending')return [['Start preparing','preparing']];if(st==='preparing')return [['Mark ready','ready']];return [];}",
    "function rowTitle(type,it){if(type==='queue')return 'Token #'+it.n;if(type==='slots')return it.slot;return it.item+' x '+it.qty;}",
    "function render(){",
    " var items=load(),meta=META[CFG.type]||META.queue;",
    " var logo=CFG.logo?'<img class=\"h-logo\" src=\"'+CFG.logo+'\" alt=\"logo\">':'';",
    " var head='<div class=\"hd\"><div class=\"hd-bar\"></div>'+logo+'<div class=\"h-name\">'+esc(CFG.name)+'</div>'+(CFG.tagline?'<div class=\"h-tag\">'+esc(CFG.tagline)+'</div>':'')+'</div>';",
    " var body='';",
    " if(!isAdmin){",
    "  var form='';",
    "  if(CFG.type==='queue'){form=f2('Your name','cName','text','Your name')+f2('Phone','cPhone','tel','98765 43210');}",
    "  else if(CFG.type==='slots'){form=f2('Your name','cName','text','Your name')+f2('Phone','cPhone','tel','98765 43210')+fSel('Pick a slot','cSlot',slots());}",
    "  else{form=f2('Your name','cName','text','Your name')+f2('Phone','cPhone','tel','98765 43210')+f2('Item','cItem','text','What would you like?')+fSel('Qty','cQty',['1','2','3','4','5']);}",
    "  body=(CFG.welcome?'<div class=\"welcome\">'+esc(CFG.welcome)+'</div>':'')+'<div class=\"bd\">'+form+'<button class=\"btn\" id=\"go\">'+esc(meta.cta)+'</button><div class=\"sec\">'+esc(meta.lbl)+'</div><div id=\"list\">'+listHtml(items)+'</div><div class=\"foot\"><a href=\"?admin=1\">Owner login</a></div></div>';",
    " } else if(!authed){",
    "  body='<div class=\"bd\"><div class=\"sec\">Owner login</div>'+f2('Passcode','cPass','password','••••')+'<button class=\"btn\" id=\"unlock\">Unlock dashboard</button><div class=\"foot\"><a href=\"'+esc(location.pathname)+'\">Customer view</a></div></div>';",
    " } else {",
    "  body='<div class=\"bd\"><div class=\"sec\">'+esc(meta.lbl)+' — dashboard</div><div id=\"list\">'+adminListHtml(items)+'</div><div class=\"foot\"><a href=\"'+esc(location.pathname)+'\">Customer view</a></div></div>';",
    " }",
    " $('#app').innerHTML=head+body;",
    " var go=$('#go');if(go)go.addEventListener('click',submit);",
    " var un=$('#unlock');if(un)un.addEventListener('click',function(){if($('#cPass').value==='1234'){authed=true;render();}else{$('#cPass').style.borderColor='#b3261e';}});",
    " Array.prototype.forEach.call(document.querySelectorAll('[data-act]'),function(b){b.addEventListener('click',function(){var items=load();var it=null;items.forEach(function(x){if(x.id===b.getAttribute('data-id'))it=x;});if(it){it.status=b.getAttribute('data-act');save(items);render();}});});",
    "}",
    "function f2(lbl,id,type,ph){return '<div class=\"f\"><label>'+esc(lbl)+'</label><input id=\"'+id+'\" type=\"'+type+'\" placeholder=\"'+esc(ph)+'\" maxlength=\"60\"></div>';}",
    "function fSel(lbl,id,opts){return '<div class=\"f\"><label>'+esc(lbl)+'</label><select id=\"'+id+'\">'+opts.map(function(o){return '<option>'+esc(o)+'</option>';}).join('')+'</select></div>';}",
    "function chip(st){return '<span class=\"chip '+esc(st)+'\">'+esc(st)+'</span>';}",
    "function listHtml(items){if(!items.length)return '<div class=\"empty\">Nothing here yet.</div>';return items.slice().reverse().map(function(it){return '<div class=\"it\"><div><div class=\"t\">'+esc(rowTitle(CFG.type,it))+'</div><div class=\"s\">'+esc(it.name)+'</div></div>'+chip(it.status)+'</div>';}).join('');}",
    "function adminListHtml(items){if(!items.length)return '<div class=\"empty\">Nothing here yet.</div>';return items.slice().reverse().map(function(it){var bs=actions(CFG.type,it.status).map(function(a){return '<button class=\"mini\" data-id=\"'+it.id+'\" data-act=\"'+a[1]+'\">'+esc(a[0])+'</button>';}).join('');return '<div class=\"it\"><div><div class=\"t\">'+esc(rowTitle(CFG.type,it))+'</div><div class=\"s\">'+esc(it.name)+(it.phone?' · '+esc(it.phone):'')+'</div></div><div style=\"text-align:right\">'+chip(it.status)+'<div class=\"ops\">'+bs+'</div></div></div>';}).join('');}",
    "function submit(){",
    " var name=($('#cName').value||'').trim();",
    " if(!name){$('#cName').focus();$('#cName').style.borderColor='#b3261e';return;}",
    " var phone=($('#cPhone').value||'').replace(/\\D/g,'').slice(-10);",
    " var items=load();",
    " var it={id:uid(),name:name,phone:phone,ts:new Date().toISOString()};",
    " if(CFG.type==='queue'){it.n=nextToken(items);it.status='waiting';}",
    " else if(CFG.type==='slots'){it.slot=$('#cSlot').value;it.status='booked';}",
    " else{var item=($('#cItem').value||'').trim();if(!item){$('#cItem').focus();$('#cItem').style.borderColor='#b3261e';return;}it.item=item;it.qty=$('#cQty').value;it.status='pending';}",
    " items.push(it);save(items);render();",
    "}",
    "if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();"
  ].join("\n");

  var BUNDLE_CSS = [
    "*{margin:0;padding:0;box-sizing:border-box}",
    "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#fff;color:#14231b}",
    "[hidden]{display:none!important}",
    ".hd{text-align:center;padding:26px 20px 18px;border-bottom:1px solid #eef2ef}",
    ".hd-bar{height:6px;background:__COLOR__;border-radius:6px;margin:-26px -20px 18px}",
    ".h-logo{width:64px;height:64px;border-radius:16px;object-fit:cover;margin:0 auto 10px;display:block}",
    ".h-name{font-size:1.35rem;font-weight:800}",
    ".h-tag{font-size:.85rem;color:#5a6b60;margin-top:3px}",
    ".welcome{padding:16px 20px;background:#f7faf8;border-bottom:1px solid #eef2ef;font-size:.92rem}",
    ".bd{padding:18px 20px 40px;max-width:520px;margin:0 auto}",
    ".f{margin-bottom:12px}.f label{display:block;font-size:.78rem;font-weight:600;margin-bottom:5px;color:#5a6b60}",
    ".f input,.f select{width:100%;padding:11px 13px;border:1.5px solid #dfe7e1;border-radius:10px;font-size:1rem;font-family:inherit}",
    ".btn{width:100%;padding:13px;border:none;border-radius:12px;background:__COLOR__;color:#fff;font-weight:700;font-size:1rem;cursor:pointer;font-family:inherit}",
    ".sec{font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#5a6b60;margin:20px 0 10px}",
    ".it{border:1px solid #e6efe9;border-radius:12px;padding:12px 14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:10px}",
    ".it .t{font-weight:700}.it .s{font-size:.8rem;color:#5a6b60}",
    ".chip{font-size:.72rem;font-weight:700;padding:4px 10px;border-radius:20px;white-space:nowrap}",
    ".chip.waiting,.chip.booked,.chip.pending{background:#fef3c7;color:#8a5a00}",
    ".chip.serving,.chip.preparing{background:#dbeafe;color:#1d4ed8}",
    ".chip.done,.chip.confirmed,.chip.ready{background:#d1fae5;color:#065f46}",
    ".chip.cancelled{background:#fee2e2;color:#b3261e}",
    ".empty{text-align:center;color:#8aa096;padding:22px 0;font-size:.88rem}",
    ".mini{margin:4px 0 0 6px;padding:7px 12px;border-radius:8px;border:1.5px solid #dfe7e1;background:#fff;font-weight:600;font-size:.8rem;cursor:pointer;font-family:inherit}",
    ".ops{margin-top:6px}",
    ".foot{text-align:center;margin-top:26px;font-size:.82rem;color:#8aa096}",
    ".foot a{color:__COLOR__}"
  ].join("\n");

  function buildBundle(cfg) {
    var c = {
      name: cfg.name, tagline: cfg.tagline || "", type: cfg.type,
      color: cfg.color, logo: cfg.logo || "", phone: cfg.phone || "",
      welcome: cfg.welcome || "", slug: slug(cfg.name)
    };
    var cfgJson = JSON.stringify(c).replace(/</g, "\\u003c");
    var js = BUNDLE_JS.split("__CFG__").join(cfgJson);
    var css = BUNDLE_CSS.split("__COLOR__").join(c.color);
    return "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n" +
      "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n" +
      "<title>" + esc(c.name) + "</title>\n<style>\n" + css + "\n</style>\n</head>\n" +
      "<body>\n<div id=\"app\"></div>\n<script>\n" + js + "\n</script>\n</body>\n</html>";
  }

  /* ---------- export ---------- */
  function bindExport() {
    $("#btnDownload").addEventListener("click", function () {
      var html = buildBundle(cfg);
      var blob = new Blob([html], { type: "text/html" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = slug(cfg.name) + "-app.html";
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });
    $("#btnCopyJson").addEventListener("click", function () {
      var txt = JSON.stringify(cfg, null, 2);
      var done = function () { $("#copyMsg").textContent = "Copied!"; setTimeout(function () { $("#copyMsg").textContent = ""; }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, done);
      else { var ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} ta.remove(); done(); }
    });
    $("#btnRestart").addEventListener("click", function () {
      if (confirm("Start over with a blank brand?")) {
        cfg = defaults(); saveCfg(cfg); location.reload();
      }
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    bindStep1(); bindStep2(); bindExport();
    goStep(1);
    pushPreview();
    // expose for automated verification
    window.__wl = { getConfig: function () { return cfg; }, buildBundle: buildBundle, goStep: goStep };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
