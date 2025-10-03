// exnessBot.js
import MetaApi from "metaapi.cloud-sdk";
import { combinedStrategy } from "./strategies.js";

const login = process.env.EXNESS_LOGIN;
const password = process.env.EXNESS_PASSWORD;
const server = process.env.EXNESS_SERVER;
const token = process.env.METAAPI_TOKEN;

let account, connection;
let autoTradeInterval = null;
let tradeCount = 0;
let startBalance = null;

/* ---------- Start Bot ---------- */
export async function startExnessBot(bot) {
  try {
    const api = new MetaApi(token);

    account = await api.metatraderAccountApi.createAccount({
      name: "Exness-Demo-Bot",
      type: "cloud",
      login,
      password,
      server,
      platform: "mt5"
    });

    connection = account.getRPCConnection();
    await connection.connect();

    console.log("📡 Connected to Exness MT5 via MetaApi");

    const accInfo = await connection.getAccountInformation();
    startBalance = accInfo.balance;

    /* ✅ Manual strategy */
    bot.onText(/^\.strategy$/, async (msg) => {
      await runStrategy(bot, msg.chat.id, 0.01); // default lot size
    });

    /* ✅ Auto-trade */
    bot.onText(/^\.autotrade (on|off)(?: ([0-9.]+) (\d+))?$/, async (msg, match) => {
      const chatId = msg.chat.id;
      const action = match[1].toLowerCase();

      if (action === "on") {
        const lotSize = parseFloat(match[2]) || 0.01;
        const intervalMins = parseInt(match[3]) || 5;

        if (autoTradeInterval) {
          bot.sendMessage(chatId, "⚠️ Auto-trade is already running.");
          return;
        }

        tradeCount = 0;
        bot.sendMessage(
          chatId,
          `▶️ Auto-trade started\nLot size: ${lotSize}\nInterval: ${intervalMins} min\nMax Trades: 20/day\nProfit Target: +200%\nLoss Limit: -20%`
        );

        autoTradeInterval = setInterval(() => runStrategy(bot, chatId, lotSize), intervalMins * 60 * 1000);
      }

      if (action === "off") {
        stopAutoTrade(bot, chatId, "Stopped by user");
      }
    });

  } catch (err) {
    console.error("❌ Exness bot failed to start:", err.message);
  }
}

/* ---------- Stop Auto Trade ---------- */
function stopAutoTrade(bot, chatId, reason) {
  if (autoTradeInterval) {
    clearInterval(autoTradeInterval);
    autoTradeInterval = null;
  }
  bot.sendMessage(chatId, `⏹ Auto-trade stopped. Reason: ${reason}`);
}

/* ---------- Run Strategy ---------- */
async function runStrategy(bot, chatId, lotSize) {
  try {
    // Check stop conditions
    const accInfo = await connection.getAccountInformation();
    const balance = accInfo.balance;

    if (tradeCount >= 20) {
      stopAutoTrade(bot, chatId, "Max 20 trades reached for today");
      return;
    }
    if (balance >= startBalance * 3) {
      stopAutoTrade(bot, chatId, "Profit target reached (+200%)");
      return;
    }
    if (balance <= startBalance * 0.8) {
      stopAutoTrade(bot, chatId, "Loss limit reached (-20%)");
      return;
    }

    // Run strategy
    const candles = await connection.getCandles("XAUUSD", "M1", 50);
    const prices = candles.map(c => c.close).reverse();

    const signal = combinedStrategy({ prices });

    if (signal === "buy") {
      await connection.createMarketBuyOrder("XAUUSD", lotSize);
      tradeCount++;
      bot.sendMessage(chatId, `📈 BUY XAUUSD @ lot ${lotSize} ✅ (Trade #${tradeCount})`);
    } else if (signal === "sell") {
      await connection.createMarketSellOrder("XAUUSD", lotSize);
      tradeCount++;
      bot.sendMessage(chatId, `📉 SELL XAUUSD @ lot ${lotSize} ✅ (Trade #${tradeCount})`);
    } else {
      bot.sendMessage(chatId, "⏸ WAIT (no strong signal)");
    }
  } catch (err) {
    bot.sendMessage(chatId, `❌ Strategy error: ${err.message}`);
  }
}