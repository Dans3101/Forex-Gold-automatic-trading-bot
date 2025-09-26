// --- Route: TradingView Webhook ---
app.post("/webhook", async (req, res) => {
  try {
    const payload = req.body || {};
    const asset = payload.asset || payload.symbol || "UNKNOWN";
    const action = (payload.decision || payload.action || payload.side || payload.signal || "").toUpperCase();
    const comment = payload.comment || payload.note || "";

    const msg = `📡 *TradingView Signal*\n📊 Asset: ${asset}\n📌 Action: ${action || "—"}${comment ? `\n💬 ${comment}` : ""}`;

    // ✅ Only send if bot is ON
    if (telegramChatId && botManager.isBotOn()) {
      await bot.sendMessage(telegramChatId, msg, { parse_mode: "Markdown" });
    } else {
      console.warn("⚠️ Bot is OFF or TELEGRAM_CHAT_ID missing, signal not sent");
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});