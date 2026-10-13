/* InstaReply — simulator (index.html). Customer-side chat UI. */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var LS = {
    products: "insta_products",
    intents: "insta_intents",
    settings: "insta_settings",
    log: "insta_log",
    seeded: "insta_seeded"
  };

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

  function defaults() {
    return {
      products: [
        { id: "p1", name: "Sourdough Loaf", price: "180", keywords: ["bread", "sourdough", "loaf"] },
        { id: "p2", name: "Butter Croissant", price: "90", keywords: ["croissant", "butter"] },
        { id: "p3", name: "Blueberry Muffin", price: "120", keywords: ["muffin", "blueberry"] }
      ],
      intents: {
        greeting: {
          keywords: ["hi", "hello", "hey", "namaste", "good morning", "good evening", "hii", "heyy"],
          template: "Hi {name}! 👋 Welcome to {business}. Ask me about our prices, availability, or store location."
        },
        price: {
          keywords: ["price", "cost", "rate", "charges", "kitna", "how much", "dam", "paisa"],
          template: "The {product} is ₹{price} 😊 Want to order? Reply 'human' and we'll take it forward on WhatsApp!"
        },
        availability: {
          keywords: ["available", "stock", "deliver", "delivery", "kab milega", "order", "buy", "get it"],
          template: "Yes! {product} is available ✅ We deliver across the city — reply 'human' to place your order."
        },
        location: {
          keywords: ["location", "address", "where", "timing", "hours", "open", "close", "kab khula", "reach"],
          template: "📍 {address}\n⏰ {hours}\nCome say hi!"
        },
        human: {
          keywords: ["human", "agent", "call", "phone", "talk to", "person", "owner", "someone", "real person"],
          template: "Of course! Chat with us directly on WhatsApp 👉 https://wa.me/{whatsapp} — we usually reply within minutes."
        },
        fallback: {
          keywords: [],
          template: "Hmm, I didn't quite get that 😅 Ask me about our products, prices, or opening hours — or type 'human' to chat with us on WhatsApp: https://wa.me/{whatsapp}"
        }
      },
      settings: {
        business: "Sharma Bakery",
        whatsapp: "919876543210",
        address: "Shop 12, MG Road Market",
        hours: "Mon–Sun, 10am – 9pm"
      }
    };
  }

  function seed() {
    if (localStorage.getItem(LS.seeded)) return;
    var d = defaults();
    // only fill keys that are absent — never clobber dashboard-added data
    if (localStorage.getItem(LS.products) == null) save(LS.products, d.products);
    if (localStorage.getItem(LS.intents) == null) save(LS.intents, d.intents);
    if (localStorage.getItem(LS.settings) == null) save(LS.settings, d.settings);
    if (localStorage.getItem(LS.log) == null) save(LS.log, []);
    localStorage.setItem(LS.seeded, "1");
  }

  function ctx() {
    var d = defaults();
    return {
      products: load(LS.products, d.products),
      intents: load(LS.intents, d.intents),
      settings: load(LS.settings, d.settings)
    };
  }

  function getLog() { return load(LS.log, []); }
  function pushLog(entry) {
    var log = getLog();
    log.push(entry);
    if (log.length > 500) log = log.slice(log.length - 500);
    save(LS.log, log);
  }

  function renderChat() {
    var chat = $("#chat"), log = getLog();
    var tail = log.slice(-60);
    if (!tail.length) {
      chat.innerHTML = '<div class="empty">Say hi to test the auto-reply 👇</div>';
      return;
    }
    chat.innerHTML = tail.map(function (m) {
      var who = m.from === "bot" ? "bot" : "me";
      var chip = m.intent ? '<span class="intent">' + esc(m.intent) + "</span>" : "";
      return '<div class="msg ' + who + '">' + esc(m.text) + "<br>" + chip + "</div>";
    }).join("");
    chat.scrollTop = chat.scrollHeight;
  }

  function renderCatalog() {
    var box = $("#catalogList"), c = ctx();
    if (!c.products.length) { box.innerHTML = '<div class="empty">No products yet — add them in the dashboard.</div>'; return; }
    box.innerHTML = c.products.map(function (p) {
      return '<div class="prow"><div class="pinfo"><div class="pname">' + esc(p.name) +
        '</div><div class="pmeta">' + esc((p.keywords || []).join(", ")) +
        '</div></div><div class="pprice">₹' + esc(p.price) + "</div></div>";
    }).join("");
  }

  function renderHead() {
    var c = ctx();
    $("#bizName").textContent = c.settings.business || "InstaReply";
    document.title = (c.settings.business || "InstaReply") + " — InstaReply simulator";
  }

  var sending = false;
  function send() {
    var input = $("#msgInput"), text = input.value.trim();
    if (!text || sending) return;
    sending = true;
    input.value = "";
    pushLog({ from: "me", text: text, ts: new Date().toISOString() });
    renderChat();
    var chat = $("#chat");
    var tp = document.createElement("div");
    tp.className = "msg bot typing";
    tp.innerHTML = "<i></i><i></i><i></i>";
    chat.appendChild(tp);
    chat.scrollTop = chat.scrollHeight;
    setTimeout(function () {
      var r = window.InstaEngine.respond(text, ctx());
      pushLog({ from: "bot", text: r.reply, intent: r.intent, ts: new Date().toISOString() });
      renderChat();
      sending = false;
      $("#msgInput").focus();
    }, 650);
  }

  document.addEventListener("DOMContentLoaded", function () {
    seed();
    renderHead();
    renderChat();
    renderCatalog();
    $("#sendBtn").addEventListener("click", send);
    $("#msgInput").addEventListener("keydown", function (e) {
      if (e.key === "Enter") send();
    });
    window.addEventListener("storage", function (e) {
      if (e.key === LS.log || e.key === LS.products || e.key === LS.settings) {
        renderChat(); renderCatalog(); renderHead();
      }
    });
  });
})();
