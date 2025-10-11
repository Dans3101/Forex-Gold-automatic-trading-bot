// index.js
import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import { startExnessBot, stopExnessBot, setupTelegramHandlers } from "./exnessBot.js";
import { telegramToken, telegramChatId, config, exness } from "./config.js";
import ExnessAdapter from "./exnessAdapter.js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const URL = process.env.RENDER_EXTERNAL_URL || `https://your-app.onrender.com`;

let bot;
let adapter;

// ✅ Initialize Exness adapter connection
async function initExness() {
  adapter = new ExnessAdapter({
    loginId: exness.loginId,
    password: exness.password,
    server: exness.server,
    useSimulation: false, // change to true if testing without API
  });

  console.log("🔌 Connecting to Exness...");
  const connected = await adapter.connect();
  if (connected) console.log("✅ Exness connected successfully!");
  else console.error("❌ Failed to connect to Exness");
}

// ✅ Telegram Bot setup
if (process.env.NODE_ENV === "production") {
  bot = new TelegramBot(telegramToken, { webHook: true });
  bot.setWebHook(`${URL}/webhook/${telegramToken}`);
  console.log(`🌍 Webhook set to ${URL}/webhook/${telegramToken}`);
} else {
  bot = new TelegramBot(telegramToken, { polling: true });
  console.log("📡 Running bot in polling mode (local)");
}

// ✅ Command menu
bot.setMyCommands([
  { command: "/start", description: "Show welcome message & buttons" },
  { command: "/exstart", description: "Start Exness trading bot" },
  { command: "/exstop", description: "Stop Exness trading bot" },
  { command: "/config", description: "Show current bot config" },
  { command: "/balance", description: "Check Exness account balance" },
  { command: "/open", description: "Show open trades" },
]);

// ✅ Start message
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `👋 Welcome to your Exness Forex Bot!`, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "▶ Start Bot", callback_data: "exstart" },
          { text: "⏹ Stop Bot", callback_data: "exstop" },
        ],
        [{ text: "⚙ Show Config", callback_data: "config" }],
        [
          { text: "💰 Set Asset", callback_data: "setasset" },
          { text: "📊 Set Lot Size", callback_data: "setlot" },
        ],
        [
          { text: "🛑 Set StopLoss", callback_data: "setsl" },
          { text: "🎯 Set TakeProfit", callback_data: "settp" },
        ],
        [{ text: "💵 Show Balance", callback_data: "balance" }],
      ],
    },
  });
});

// ✅ Handle inline button clicks
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const action = query.data;

  switch (action) {
    case "exstart":
      startExnessBot(bot, chatId, adapter);
      bot.sendMessage(chatId, "✅ Exness bot started!");
      break;

    case "exstop":
      stopExnessBot();
      bot.sendMessage(chatId, "🛑 Exness bot stopped.");
      break;

    case "config":
      bot.sendMessage(
        chatId,
        `⚙️ *Current Config:*\n` +
          `Asset: *${config.asset}*\n` +
          `Lot Size: *${config.lotSize}*\n` +
          `Trade Amount: *${config.tradeAmount}%*\n` +
          `Stop Loss: *${config.stopLoss}%*\n` +
          `Take Profit: *${config.takeProfit} USD*`,
        { parse_mode: "Markdown" }
      );
      break;

    case "balance":
      const balance = await adapter.getBalance();
      bot.sendMessage(chatId, `💵 *Current Balance:* ${balance.toFixed(2)} USD`, {
        parse_mode: "Markdown",
      });
      break;

    case "open":
      const trades = await adapter.getOpenTrades();
      if (trades.length === 0) {
        bot.sendMessage(chatId, "📭 No open trades currently.");
      } else {
        const tradeList = trades
          .map(
            (t) =>
              `#${t.id}\nSymbol: ${t.symbol}\nSide: ${t.side}\nPrice: ${t.price}\nLot: ${t.lotSize}\n`
          )
          .join("\n\n");
        bot.sendMessage(chatId, `📋 *Open Trades:*\n\n${tradeList}`, {
          parse_mode: "Markdown",
        });
      }
      break;

    default:
      bot.sendMessage(chatId, "❌ Unknown action.");
  }

  bot.answerCallbackQuery(query.id);
});

// ✅ Setup Telegram handlers for adjustable settings
setupTelegramHandlers(bot, telegramChatId);

// ✅ Webhook endpoint for Render
app.post(`/webhook/${telegramToken}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ✅ Initialize connection and start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await initExness();
});