# Stock Lens｜上市台股分類估值研究

[開啟網站](https://ting11236.github.io/stock-lens/) · [每日更新](https://github.com/ting11236/stock-lens/actions) · [資料來源與計算口徑](docs/data-sources.md)

沿用 HTML/CSS/JavaScript、Python 標準函式庫、GitHub Actions 與 GitHub Pages，無須登入、後端或付費服務。五類估值區間及研究提示沿用原版；數據不足、指標不適用或規則空白區间不給確定買賣結論。

## 使用

- **全部股票**：搜尋股票代號、名稱、產業或分類。可依分類、股價、主要估值倍數篩選與排序，每頁 50 檔。不同指標不能直接橫向比較，建議先選同一分類。
- **我的自選股**：按 ☆ 加入，再按 ★ 移除。股價與指標直接取自每日市場資料。
- 點選股票，查看股價日期、原始 PE/PB/PS/PEG、EPS、成長率、毛利率、ROE、研究提示及外部查核連結。展開來源區可看各欄位日期、口徑與缺值原因。
- 詳細資料的「個人研究分類」可以人工覆寫，選「自動」恢復。
- 自選清單與人工分類存在 `stock_lens_preferences_v2` localStorage；不同瀏覽器設定檔各自獨立，共用同一設定檔會共用設定。換裝置不會同步。預設自選股為空白，只有自己按星號或匯入 CSV 才會加入。保留新版已儲存的個人清單；舊版只遷移分類覆寫，不帶入可能由雲端自動產生的觀察清單，舊手動股價也不覆蓋官方行情。
- 每次開啟都重新下載雲端快照。儲存設定失敗時會提示，請用 CSV 備份。
- 自選 CSV 至少含 `symbol`，例如 `2330` 或 `2330.TW`；`category` 可選填。匯入合併代號與分類，不採用 CSV 內的報價覆蓋官方資料。舊版多欄位 CSV 仍可讀取台股代號與分類。完整市場 CSV 在「資料說明」下載。

## 每日更新與失敗處理

每天台灣時間 **18:20**（UTC `20 10 * * *`）嘗試更新。官方只公布每日／月／季頻率，未承諾固定完成時刻；GitHub 排程可能延後。網站依 API 的 Date、年度／季別、資料年月顯示實際期間，絕不用下載时间代替交易日期。

公司名冊限定四碼上市普通股，含外國第一上市及創新板；不含 ETF、權證、特別股、TDR、上櫃及美股。`watchlist.json` 保留作舊版參考，已不限制下載範圍。

- `stocks.json` 與 `stocks.csv`：有效市场快照及所有欄位來源。
- `status.json`：成功／部分失敗／失敗及狀態開始時間。
- `financial-history.json`：逐期保留一般業累計損益與母公司權益，供完整期間推算；不含個人自選。
- 公司名冊、價格或估值來源失敗、格式不符、涵蓋率低於 90%，或名冊異常縮水，保留整份前次快照；發布失敗狀態，Actions 最終回報失敗。
- 財務來源失敗，已有欄位保留原日期並標記舊值。沒有有效值則顯示「—」。初次執行失敗也可開啟網站，清楚呈現空狀態。
- 同數值、期間、來源與狀態不變時，不改下載時間、不改檔案。每次嘗試時間可查 Actions 日誌；JSON 的下載時間表示該版本第一次成功取得的時間。
- 前端會依最近股價日期與台灣時間提醒可能過期；已排除一般週末，但未建立完整休市日曆，國定假日可能出現提醒。

## 財務資料限制

目前可直接取得收盤價、PE、PB、殖利率、累計 EPS、單月營收年增率、累計毛利率。PS、ROE、TTM EPS 成長與歷史 PEG 需要完整且可比的歷史資料；初次執行通常缺少，因此顯示「—」，不年化半年數字、不反推 EPS、不以營收成長代替 EPS 成長。

後續逐季累積可比的一般業財報後才計算。金融等特殊業別的財報推算尚未接入；官方 EPS、PE/PB 仍照常顯示。歷史資料如遇公司重編、拆併股或會計口徑變更，已保存的過去季度未必是重編後資料，衍生指標須人工查核，不應直接視為預測或買賣訊號。

原有選用的 `STOCK_LENS_CSV_URL` Actions secret 仍可補充**已取得公開展示授權**的 CSV。每欄需有 `<field>_date` 或 `financial_data_date`，並提供 `source`。PEG 另外必須提供 `peg_basis=historical|forward` 及 `peg_period`。價格、PE、PB 保持官方來源優先。網址與權杖不寫入公開快照或錯誤訊息；`source` 請填可公開的來源名稱或文件網址。此版本只合併上市普通股。

## 開發與驗證

```sh
python -m unittest discover -s tests -v
node --test tests/app.test.cjs
python update_snapshot.py
python -m http.server 8000 --directory site
```

開啟 `http://localhost:8000`。不要直接以 file:// 開啟，因瀏覽器會限制讀取 JSON。

PR／`codex/**` 分支執行 `Stock Lens checks`：單元測試加真實 TWSE 整合下載，將 `site/` 上傳為 `stock-lens-preview` artifact，**不部署 Pages**。只有 main 的每日工作流程會提交資料及發布正式網站。合併後若需重跑，可在「每日更新與發布 Stock Lens」選 main → Run workflow。Pages Source 維持 GitHub Actions。

## 檔案

- `site/index.html`：兩個股票頁面、規則與資料說明。
- `site/styles.css`：淺色 Dashboard 與手機、平板、桌面 RWD。
- `site/app.js`：沿用原版估值規則，處理搜尋、排序、個人分類、自選與 CSV。
- `update_snapshot.py`：官方資料下載、验证、合併、來源日期、衍生指標、失敗保留與去重。
- `.github/workflows/daily-publish.yml`：18:20 更新及 main Pages 發布。
- `.github/workflows/ci.yml`：PR 驗證，無正式站發布權限。
- `tests/`：日期、來源缺值、更新失敗、重複執行、自選持久化、CSV、分類及估值邊界測試。

## 未來跨裝置同步

可保留 GitHub Pages 前端，另接 Supabase Auth + Postgres。只同步 `user_id / symbol / category_override`，用 Row Level Security 限制使用者只讀寫自己的記錄；行情仍由現有公共 JSON 提供。前端僅持公開 anon key，service-role key 不可放在網站。此版不啟用帳號或雲端個人資料庫。

### 排序與股價走勢

全部股票與我的自選股共用「排序欄位」及「排序方向」選單。可按股價、PE、PB、PS、PEG、主要估值倍數由低到高或由高到低排列；缺值固定排在最後，切換排序會回到第一頁。主要倍數跨分類意義不同，建議先選同一分類。

點選股票後，收盤價下方的「查看股價走勢」會在新分頁開啟對應 TWSE 代號的 TradingView 圖表。本站不爬取 TradingView 行情；圖表可用性、資料延遲及功能以 TradingView 為準。

## 全市場公司研究摘要

每檔股票明細新增公司業務、近年營收／獲利來源、轉型方向、新發展項目。可用「公司研究」選單篩選已有摘要／待查核，並查看實際涵蓋進度。目前 43 家已建立附來源的研究初稿，其餘待分批查核；**不是全市場深度摘要已完成**。

每段附資料期間與來源連結，另列發布日期、查閱日期及限制。逾 14 天未查核會提醒；營收占比不視為獲利占比、計画不視為成果。讀取研究資料失敗不影響股價、自選股及排序。

研究資料由 Codex 每週查核並透過待審 PR 更新，合併後才發布；GitHub Actions 僅驗證與產生全市場索引，不自行生成網路研究。完整維護、來源及排程限制見 [公司研究維護規則](docs/company-research.md)。

本機驗證：`python build_research.py`（先備妥 stocks.json）與 `python build_research.py --validate-only`。原始研究在 `research/companies.json`；網站檔案為 `site/data/company-research.json`。
