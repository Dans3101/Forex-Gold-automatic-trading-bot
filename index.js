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
    return res.send("✅ Bot already connected or no QR available.");
  }

  const html = `
    <html>
      <body style="text-align:center; font-family:Arial">
        <h2>📲 Scan this QR with WhatsApp</h2>
        <img src="${qr}" />
      </body>
    </html>
  `;
  res.send(html);
});

// ✅ Use Render's PORT (default 10000) or fallback to 3000
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Web server running on port ${PORT}`);
});