# InstaReply — going live on real Instagram DMs

The simulator runs the **real reply engine** (`engine.js`). To auto-reply on your
actual Instagram DMs you need a tiny server in the middle, because Meta only
talks to a webhook URL — not to a static page. Honest scope: the engine is done
and tested here; the webhook is ~40 lines of Node you (or your developer) deploy
once. Meta approval is the slow part, not the code.

## How it fits together

```
Customer DM → Instagram → your webhook (POST) → InstaEngine.respond(text, ctx)
→ reply text → Instagram Send API → customer sees the reply
```

Your catalog, templates and settings live in `localStorage` in this demo. For
production, move them to a small database (or a JSON file your server reads) and
pass them as `ctx` — the engine itself doesn't care where they come from.

## 1. The exact function your server calls

```js
// engine.js exposes this on window (browser) — copy the file to your server
// and require it, or paste the respond() logic into your handler.
const { respond } = require("./engine-node.js"); // same code, module.exports

const ctx = {
  products: [ { name: "Chocolate Cake", price: "450", keywords: ["cake","price"] } ],
  intents: {
    greeting:     { keywords: ["hi","hello","hey"], template: "Hi {name}! ..." },
    price:        { keywords: ["price","cost","kitna"], template: "The {product} is ₹{price} ..." },
    availability: { keywords: ["available","stock","deliver"], template: "Yes! {product} is available ✅ ..." },
    location:     { keywords: ["location","address","hours","open"], template: "📍 {address}\n⏰ {hours}" },
    human:        { keywords: ["human","agent","call"], template: "Chat with us 👉 https://wa.me/{whatsapp}" },
    fallback:     { keywords: [], template: "Sorry, I didn't get that 😅 ..." }
  },
  settings: { business: "Sharma Bakery", whatsapp: "919876543210",
              address: "Shop 12, MG Road", hours: "10am – 9pm" }
};

// returns { reply: string, intent: "price"|"greeting"|..., product: {...}|null }
const { reply, intent } = respond("cake price?", ctx);
```

**Webhook contract** (what Meta sends your server):

```
POST /webhooks/instagram
{
  "sender_id": "1234567890",      // Instagram-scoped user ID
  "message_text": "cake price?"   // the DM text
}
```

Your handler: `respond(message_text, ctx)` → then send `reply` back:

```
POST https://graph.facebook.com/v21.0/me/messages
Authorization: Bearer <PAGE_ACCESS_TOKEN>
{
  "recipient": { "id": "<sender_id>" },
  "messaging_type": "RESPONSE",
  "message": { "text": "<reply>" }
}
```

Minimal Express sketch (error handling omitted for brevity):

```js
const express = require("express");
const { respond } = require("./engine-node.js");
const app = express().use(express.json();

app.post("/webhooks/instagram", async (req, res) => {
  const { sender_id, message_text } = req.body;
  const { reply, intent } = respond(message_text, loadCtx()); // your catalog
  await fetch("https://graph.facebook.com/v21.0/me/messages", {
    method: "POST",
    headers: { "Authorization": "Bearer " + process.env.PAGE_TOKEN,
               "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: sender_id },
      messaging_type: "RESPONSE", message: { text: reply } })
  });
  logToDashboard(sender_id, message_text, reply, intent); // optional
  res.sendStatus(200);
});
```

## 2. Meta setup checklist

1. **Convert to a Business/Creator account** and link it to a Facebook Page.
2. **Create a Meta app** at developers.facebook.com → add the **Messenger** product
   (Instagram DMs go through the Messenger platform).
3. **Subscribe your webhook** to the `messages` field for Instagram.
4. **Request permissions** — you need `instagram_manage_messages` (and
   `pages_messaging` for the Page). This requires **App Review**: Meta will ask
   for a screencast of the bot replying and a privacy policy URL. Budget a few
   days; test mode works with your own account immediately.
5. **Verify the webhook** with your verify token (Meta sends a GET challenge once).

## 3. Rules that will get you restricted (read this)

- **24-hour window:** you may only reply to someone who messaged you in the last
  24 hours, unless you use an approved message tag (e.g. `HUMAN_AGENT`).
- **No spam:** one reply per incoming message. Never message users first from
  automation. The engine is deliberately reply-only.
- **Rate limits:** page-level limits are generous (~200 sends/sec burst), but a
  sudden spike from a viral post can throttle you — queue replies and back off
  on HTTP 429 with the `Retry-After` header.
- **Handoff honestly:** the `human` intent exists because the bot must never
  pretend to be a person taking an order it can't fulfil. Keep the WhatsApp
  handoff template accurate.
- **Don't auto-reply to everything:** filter out message types you can't handle
  (attachments, story replies, reactions) — reply only to text, exactly like the
  simulator does.

## 4. What stays manual

Order taking, payments, and delivery promises stay human — the bot answers
questions and hands off. That's the safe, honest shape for a shop's DM bot.
