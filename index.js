// index.js
import express from "express";
import { startBot } from "./botManager.js";

// --- Start Telegram Trading Bot ---
startBot();

// --- Keep Alive Web Server ---
const app = express();

// ✅ Home route
app.get("/", (req, res) => {
  res.send("✅ Pocket Option Bot is running on Render with Telegram!");
});

// ✅ Use Render's PORT (default 10000) or fallback to 3000
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Web server running on port ${PORT}`);
});