import os
import time
from datetime import datetime, timezone
from strategies.signal_engine import get_signal_from_candles
from sheets.sheet_writer import write_signal_row
from utils.data import fetch_binance_klines

# ---- Config (env vars preferred) ----
ASSET = os.getenv("ASSET", "BTCUSDT")      # e.g., "BTCUSDT", "ETHUSDT"
INTERVAL = os.getenv("INTERVAL", "1m")     # "1m", "5m"
CANDLES = int(os.getenv("CANDLES", "200")) # how many candles to pull
SHEET_ID = os.getenv("SHEET_ID")           # REQUIRED: your Google Sheet ID

def main():
    if not SHEET_ID:
        raise RuntimeError("Missing SHEET_ID environment variable. Paste your Google Sheet ID into Heroku Config Vars.")

    # 1) Fetch latest candles
    candles = fetch_binance_klines(symbol=ASSET, interval=INTERVAL, limit=CANDLES)
    if not candles:
        print("No candles returned.")
        return

    # 2) Compute signal
    signal_payload = get_signal_from_candles(candles, asset=ASSET, interval=INTERVAL)
    if signal_payload is None:
        print("No signal generated this run.")
        return

    # 3) Write to Google Sheet
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S %Z")
    row = [
        now,
        signal_payload["asset"],
        signal_payload["interval"],
        signal_payload["close_price"],
        signal_payload["signal"],            # BUY / SELL
        ", ".join(signal_payload["reasons"]),# why
        signal_payload["rsi"],
        signal_payload["macd"],
        signal_payload["macd_signal"],
        signal_payload["ema_fast"],
        signal_payload["ema_slow"],
    ]
    write_signal_row(sheet_id=SHEET_ID, row=row)
    print("Signal written:", row)

if __name__ == "__main__":
    main()
