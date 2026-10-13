/* InstaReply — shared responder engine (no DOM).
   Pure logic: respond(text, ctx) -> { reply, intent, product }
   The same function plugs into the Instagram webhook (see HOOK.md). */

(function () {
  "use strict";

  var INTENT_ORDER = ["human", "price", "availability", "location", "greeting"];

  function wordsOf(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
  }

  // word-boundary keyword match: single words via set lookup,
  // multi-word phrases via substring
  function hasKeyword(text, words, keywords) {
    var set = {};
    for (var i = 0; i < words.length; i++) set[words[i]] = true;
    for (var j = 0; j < keywords.length; j++) {
      var k = String(keywords[j] || "").toLowerCase().trim();
      if (!k) continue;
      if (k.indexOf(" ") === -1) {
        if (set[k]) return true;
      } else if (text.indexOf(k) !== -1) {
        return true;
      }
    }
    return false;
  }

  // fuzzy product match: product-name tokens weigh 2, keyword hits weigh 1
  function findProduct(text, words, products) {
    var best = null, bestScore = 0;
    var set = {};
    for (var i = 0; i < words.length; i++) set[words[i]] = true;
    for (var p = 0; p < products.length; p++) {
      var pr = products[p], score = 0;
      var toks = wordsOf(pr.name);
      for (var t = 0; t < toks.length; t++) if (set[toks[t]]) score += 2;
      var kws = pr.keywords || [];
      for (var k = 0; k < kws.length; k++) {
        var kw = String(kws[k]).toLowerCase().trim();
        if (kw && set[kw]) score += 1;
      }
      if (score > bestScore) { bestScore = score; best = pr; }
    }
    return best;
  }

  function render(template, vars) {
    return String(template || "").replace(/\{(\w+)\}/g, function (m, key) {
      return vars[key] != null ? String(vars[key]) : m;
    });
  }

  function baseVars(settings, product) {
    return {
      name: "there",
      business: settings.business || "our shop",
      whatsapp: settings.whatsapp || "",
      address: settings.address || "our store",
      hours: settings.hours || "10am – 9pm",
      product: product ? product.name : "",
      price: product ? product.price : ""
    };
  }

  function respond(text, ctx) {
    ctx = ctx || {};
    var products = ctx.products || [];
    var intents = ctx.intents || {};
    var settings = ctx.settings || {};
    var low = String(text || "").toLowerCase();
    var words = wordsOf(text);

    function intentOf(key) {
      return intents[key] || { keywords: [], template: "" };
    }

    // human handoff first — "talk to a person about the price" must not price-match
    if (hasKeyword(low, words, intentOf("human").keywords)) {
      return {
        intent: "human",
        product: null,
        reply: render(intentOf("human").template, baseVars(settings, null))
      };
    }

    var product = findProduct(low, words, products);

    if (hasKeyword(low, words, intentOf("price").keywords)) {
      var v = baseVars(settings, product);
      if (product) {
        return { intent: "price", product: product, reply: render(intentOf("price").template, v) };
      }
      if (products.length) {
        var list = products.map(function (p) { return "• " + p.name + " — ₹" + p.price; }).join("\n");
        return {
          intent: "price",
          product: null,
          reply: "Here's what we have:\n" + list + "\n\nAsk about any item for its details!"
        };
      }
      return { intent: "price", product: null, reply: render(intentOf("price").template, v) };
    }

    if (hasKeyword(low, words, intentOf("availability").keywords)) {
      return {
        intent: "availability",
        product: product,
        reply: render(intentOf("availability").template, baseVars(settings, product))
      };
    }

    if (hasKeyword(low, words, intentOf("location").keywords)) {
      return {
        intent: "location",
        product: null,
        reply: render(intentOf("location").template, baseVars(settings, null))
      };
    }

    if (hasKeyword(low, words, intentOf("greeting").keywords)) {
      return {
        intent: "greeting",
        product: null,
        reply: render(intentOf("greeting").template, baseVars(settings, null))
      };
    }

    return {
      intent: "fallback",
      product: null,
      reply: render(intentOf("fallback").template, baseVars(settings, null))
    };
  }

  window.InstaEngine = {
    respond: respond,
    INTENT_ORDER: INTENT_ORDER,
    findProduct: findProduct,
    render: render
  };
})();
