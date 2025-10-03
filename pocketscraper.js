// exnessBot.js
import MetaApi from "metaapi.cloud-sdk";

const login = process.env.EXNESS_LOGIN;
const password = process.env.EXNESS_PASSWORD;
const server = process.env.EXNESS_SERVER;
const token = process.env.METAAPI_TOKEN;

let account, connection;

// ✅ Start Exness bot
export async function startExnessBot(bot) {
  try {
    const api = new MetaApi(token);

    // Create connection with Exness account
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

    // Telegram command handlers
    bot.onText(/^\.buy$/, async (msg) => {
      const chatId = msg.chat.id;
      try {
        const trade = await connection.createMarketBuyOrder("XAUUSD", 0.01);
        bot.sendMessage(chatId, `✅ BUY order placed\nID: ${trade.id}`);
      } catch (err) {
        bot.sendMessage(chatId, `❌ Failed to place BUY: ${err.message}`);
      }
    });

    bot.onText(/^\.sell$/, async (msg) => {
      const chatId = msg.chat.id;
      try {
        const trade = await connection.createMarketSellOrder("XAUUSD", 0.01);
        bot.sendMessage(chatId, `✅ SELL order placed\nID: ${trade.id}`);
      } catch (err) {
        bot.sendMessage(chatId, `❌ Failed to place SELL: ${err.message}`);
      }
    });

    bot.onText(/^\.status$/, async (msg) => {
      const chatId = msg.chat.id;
      try {
        const orders = await connection.getPositions();
        let message = "📊 Bot Status\n";
        if (!orders || orders.length === 0) {
          message += "No open positions.";
        } else {
          orders.forEach((pos, i) => {
            message += `#${i + 1} ${pos.type} ${pos.symbol} Vol: ${pos.volume}, Profit: ${pos.unrealizedProfit}\n`;
          });
        }
        bot.sendMessage(chatId, message);
      } catch (err) {
        bot.sendMessage(chatId, `❌ Failed to fetch status: ${err.message}`);
      }
    });

  } catch (err) {
    console.error("❌ Exness bot failed to start:", err.message);
  }
}