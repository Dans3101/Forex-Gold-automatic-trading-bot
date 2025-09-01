// index.js
import express from "express";
import { startSession } from "./botManager.js"; // ✅ import your bot logic

// Start the bot
startSession("main");

// --- Keep Alive Web Server ---
const app = express();

// Health check route
app.get("/", (req, res) => {
  res.send("✅ Pocket Option Bot is running on Render!");
});

// Use Render's PORT (default 10000) or fallback to 3000 locally
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Web server running on port ${PORT}`);
});