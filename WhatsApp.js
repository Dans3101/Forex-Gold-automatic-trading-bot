// whatsapp.js
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;

// LocalAuth stores session in ./whatsapp-session (safe to keep private)
export const client = new Client({
  authStrategy: new LocalAuth({ clientId: "signal-bot" }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-gpu",
    ],
  },
});

client.on("qr", (qr) => {
  console.log("📲 Scan this QR code (or use 'Link with phone number') in your WhatsApp app:");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  console.log("🔐 Authenticated - session saved (LocalAuth).");
});

client.on("auth_failure", (msg) => {
  console.error("❌ Auth failure:", msg);
});

client.on("ready", () => {
  console.log("✅ WhatsApp client is ready.");
});

/**
 * Initialize the WhatsApp client (call once from your main file).
 */
export async function initWhatsApp() {
  await client.initialize();
}

/**
 * Send a plain text message to a WhatsApp group by exact group name.
 * Returns true if sent, false if group not found or error.
 */
export async function sendToGroupByName(groupName, message) {
  try {
    const chats = await client.getChats();
    const group = chats.find((c) => c.isGroup && c.name === groupName);
    if (!group) {
      console.error("⚠️ Group not found:", groupName);
      return false;
    }
    await client.sendMessage(group.id._serialized, message);
    console.log(`📤 Sent to group "${groupName}"`);
    return true;
  } catch (err) {
    console.error("Error sending to group:", err.message || err);
    return false;
  }
}
