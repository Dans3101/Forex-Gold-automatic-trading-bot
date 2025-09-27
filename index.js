// index.js
import express from "express";
import bodyParser from "body-parser";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { startBot } from "./botManager.js";
import { telegramToken, telegramChatId } from "./config.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

// ✅ Telegram bot setup
if (!telegramToken) {
  console.error("❌ TELEGRAM_TOKEN is missing in .env file!");
  process.exit(1);
}
const bot = new TelegramBot(telegramToken, { polling: true });
startBot(bot);

// ✅ Webhook endpoint for TradingView alerts
app.post("/webhook", async (req, res) => {
  console.log("📩 Incoming webhook request from TradingView:");
  console.log(JSON.stringify(req.body, null, 2)); // full payload in logs

  if (!req.body) {
    console.error("❌ Empty request body!");
    return res.status(400).send("Bad Request: No data received");
  }

  // Try to extract fields (fall back if missing)
  const asset = req.body.asset || "Unknown Asset";
  const decision = req.body.decision || req.body.side || "No Decision";

  try {
    await bot.sendMessage(
      telegramChatId,
      `📡 *New TradingView Signal Received:*\n\n📊 Asset: ${asset}\n📌 Decision: ${decision}`,
      { parse_mode: "Markdown" }
    );
    console.log(`✅ Signal forwarded to Telegram: ${asset} → ${decision}`);
    res.status(200).send("Signal forwarded to Telegram");
  } catch (err) {
    console.error("❌ Failed to forward signal:", err.message);
    res.status(500).send("Failed to send signal to Telegram");
  }
});

app.get("/", (req, res) => {
  res.send("✅ Bot is running! Webhook endpoint is at /webhook");
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});