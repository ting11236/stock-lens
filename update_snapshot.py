"""Daily Stock Lens snapshot: TWSE public data + optional licensed CSV feed."""
import csv
import io
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "site/data/stocks.json"
WATCH = ROOT / "watchlist.json"
RATIOS = "https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL"
PRICES = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_AVG_ALL"
STARTER = {
    "2330": ("半導體", "高成長股"),
    "2317": ("電子代工", "穩定獲利股"),
    "1301": ("塑化", "週期股"),
    "2002": ("鋼鐵", "週期股"),
    "2603": ("航運", "週期股"),
    "2881": ("金融", "重資產股"),
    "2882": ("金融", "重資產股"),
    "2454": ("半導體", "高成長股"),
}
NUMERIC = ("price", "pe", "pb", "ps", "peg", "gross_margin",
           "revenue_growth", "earnings_growth", "roe", "trailing_eps", "net_income")

def number(v):
    try:
        n = float(str(v).replace(",", "").strip())
        return n if n == n and abs(n) != float("inf") else None
    except (TypeError, ValueError):
        return None

def get(url):
    with urlopen(Request(url, headers={"User-Agent": "StockLensResearch/1.0"}), timeout=35) as r:
        return r.read(5_000_000)

def day(raw):
    s = str(raw or "").strip()
    if len(s) == 7 and s.isdigit():
        try:
            return datetime(1911 + int(s[:3]), int(s[3:5]), int(s[5:])).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None

def main():
    symbols = list(dict.fromkeys(s.strip().upper() for s in json.loads(
        WATCH.read_text(encoding="utf-8"))["symbols"]))
    if not 1 <= len(symbols) <= 40:
        raise ValueError("觀察清單必須有 1 至 40 檔")
    previous_payload = json.loads(OUT.read_text(encoding="utf-8"))
    previous = {x["symbol"]: x for x in previous_payload.get("stocks", [])}
    fresh, errors = {}, {}
    try:
        ratios = json.loads(get(RATIOS).decode("utf-8-sig"))
        closes = json.loads(get(PRICES).decode("utf-8-sig"))
        if not isinstance(ratios, list) or len(ratios) < 100 or not isinstance(closes, list):
            raise ValueError("TWSE 格式或資料量異常")
        close_by_code = {str(x.get("Code", "")).strip(): x for x in closes}
        for r in ratios:
            code = str(r.get("Code", "")).strip()
            sym = code + ".TW"
            if sym not in symbols:
                continue
            close = close_by_code.get(code, {})
            rd, cd = day(r.get("Date")), day(close.get("Date"))
            industry, category = STARTER.get(code, ("", "待分類"))
            fresh[sym] = {
                "symbol": sym, "name": r.get("Name") or close.get("Name") or code,
                "sector": "", "industry": industry, "category": category,
                "category_basis": "預設研究分類，需人工確認",
                "currency": "TWD", "exchange": "TWSE",
                "price": number(close.get("ClosingPrice")) if rd and rd == cd else None,
                "pe": number(r.get("PEratio")), "pb": number(r.get("PBratio")),
                "ps": None, "peg": None, "gross_margin": None,
                "revenue_growth": None, "earnings_growth": None, "roe": None,
                "trailing_eps": None, "net_income": None,
                "peg_basis": "TWSE 未提供 PEG，未自行推算",
                "source": "TWSE／政府開放資料",
                "quote_time": None, "financial_data_date": rd
            }
    except Exception as e:
        print("TWSE 取得失敗，保留既有資料：", str(e)[:200])
    url = os.environ.get("STOCK_LENS_CSV_URL", "").strip()
    if url:
        if urlparse(url).scheme != "https":
            raise ValueError("授權 CSV 來源必須使用 HTTPS")
        try:
            feed = csv.DictReader(io.StringIO(get(url).decode("utf-8-sig")))
            for r in feed:
                sym = str(r.get("symbol") or "").strip().upper()
                if sym not in symbols:
                    continue
                item = {k: (v or "").strip() for k, v in r.items() if k}
                for field in NUMERIC:
                    item[field] = number(item.get(field))
                item["symbol"] = sym
                item["name"] = item.get("name") or sym
                item["source"] = item.get("source") or "已授權 CSV"
                item["peg_basis"] = item.get("peg_basis") or "請確認來源 PEG 定義"
                if sym in fresh:
                    for field in ("ps", "peg", "gross_margin", "revenue_growth",
                                  "earnings_growth", "roe", "trailing_eps", "net_income", "peg_basis"):
                        if item.get(field) is not None and item.get(field) != "":
                            fresh[sym][field] = item[field]
                    fresh[sym]["source"] += " + 已授權 CSV"
                else:
                    fresh[sym] = item
        except Exception as e:
            print("授權 CSV 取得失敗，保留既有資料：", str(e)[:200])
    if not fresh:
        print("所有來源失敗；不變更舊快照或聲稱更新成功")
        return
    now = datetime.now(timezone.utc).isoformat()
    rows, stale = [], []
    for sym in symbols:
        if sym in fresh:
            item = fresh[sym]
            item["snapshot_at"] = now
            rows.append(item)
        elif sym in previous:
            item = dict(previous[sym])
            item["stale_reason"] = "本次無新資料，沿用上次快照"
            rows.append(item)
            stale.append(sym)
            errors[sym] = item["stale_reason"]
        else:
            errors[sym] = "尚無可公開使用的資料"
    payload = {
        "status": "partial" if errors else "ok", "fetched_at": now,
        "source": "TWSE 政府開放資料" + (" + 已授權 CSV" if url else ""),
        "stocks": rows, "errors": errors, "stale_symbols": stale,
        "expected_symbols": symbols
    }
    tmp = OUT.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    tmp.replace(OUT)
    print("更新完成：", len(fresh), "筆；無資料：", len(errors), "筆")

if __name__ == "__main__":
    main()
