import time
import requests

BINANCE_BASE = "https://api.binance.com"

def fetch_binance_klines(symbol="BTCUSDT", interval="1m", limit=200):
    """
    Returns list of dicts:
    [{open_time, open, high, low, close, volume, close_time}, ...]
    """
    url = f"{BINANCE_BASE}/api/v3/klines"
    params = {"symbol": symbol, "interval": interval, "limit": limit}
    try:
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        candles = []
        for k in data:
            candles.append({
                "open_time": k[0],
                "open": float(k[1]),
                "high": float(k[2]),
                "low":  float(k[3]),
                "close":float(k[4]),
                "volume":float(k[5]),
                "close_time":k[6],
            })
        return candles
    except Exception as e:
        print("Error fetching Binance klines:", e)
        return []
