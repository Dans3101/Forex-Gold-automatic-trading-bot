// index.js
import express from "express";
import { startBot } from "./botManager.js";

// --- Start WhatsApp Trading Bot ---
startBot();

// --- Keep Alive Web Server ---
const app = express();

// A simple route to confirm service is alive
app.get("/", (req, res) => {
  res.send("✅ Pocket Option Bot is running on Render!");
});

// Use Render's PORT (default 10000) or fallback to 3000 locally
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Web server running on port ${PORT}`);
});