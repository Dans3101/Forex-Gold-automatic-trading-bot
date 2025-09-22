// index.js
import express from "express";
import { startBot, getLatestQR } from "./botManager.js";

// --- Start WhatsApp Trading Bot ---
startBot();

// --- Keep Alive Web Server ---
const app = express();

// ✅ Home route
app.get("/", (req, res) => {
  res.send("✅ Pocket Option Bot is running on Render!");
});

// ✅ QR route
app.get("/qr", (req, res) => {
  const qr = getLatestQR();

  if (!qr) {
    return res.send(`
      <html>
        <body style="text-align:center; font-family:Arial; padding:40px;">
          <h2>⚠️ No QR available</h2>
          <p>The bot may already be connected to WhatsApp.<br>
          If not, please redeploy and wait a few seconds for the QR to generate.</p>
        </body>
      </html>
    `);
  }

  res.send(`
    <html>
      <body style="text-align:center; font-family:Arial; padding:40px;">
        <h2>📲 Scan this QR with WhatsApp</h2>
        <img src="${qr}" alt="WhatsApp QR Code" style="margin-top:20px;"/>
        <p style="margin-top:20px;">Once scanned, the bot will connect automatically.</p>
      </body>
    </html>
  `);
});

// ✅ Use Render's PORT (default 10000) or fallback to 3000
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Web server running on port ${PORT}`);
});