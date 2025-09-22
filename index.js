// index.js
import express from "express";
import { startBot, latestPairingCode } from "./botManager.js";

// --- Start WhatsApp Trading Bot ---
startBot();

// --- Keep Alive Web Server ---
const app = express();

// A simple route to confirm service is alive
app.get("/", (req, res) => {
  if (latestPairingCode) {
    res.send(`
      <h1>✅ Pocket Option Bot is running!</h1>
      <p>📲 Enter this pairing code in WhatsApp (Linked Devices > Link with phone number):</p>
      <h2 style="font-size: 2em; color: green;">${latestPairingCode}</h2>
    `);
  } else {
    res.send(`
      <h1>✅ Pocket Option Bot is running!</h1>
      <p>⚠️ No pairing code available right now.</p>
      <p>If already linked, the bot is active on WhatsApp.</p>
    `);
  }
});

// Use Render's PORT (default 10000) or fallback to 3000 locally
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Web server running on port ${PORT}`);
});