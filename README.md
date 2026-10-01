# Stock Lens｜雲端每日股票分類估值網站

這一版是**免安裝的靜態網頁**，部署到 GitHub Pages 後，Mac、iPhone、iPad、Windows 都只需開啟網址。**Python 僅在 GitHub 雲端排程執行**，不用在你的電腦啟動。網站保留五類股票、專屬估值規則、原始 PE/PB/PS/PEG、CSV 匯入／匯出、人工分類、TradingView / Investing.com 人工查核。

## 最短上線流程（第一次設定，之後不用再做）

1. 登入 https://github.com/new ，建立名稱 `stock-lens` 的 **Public** 儲存庫，預設分支使用 `main`。GitHub 免費版的 Pages 需要公開儲存庫；公開網站與公開原始碼都可被其他人存取，請勿放入個人秘密或不具再發布授權的資料。
2. 在新儲存庫點 **Add file → Upload files**，上傳這個壓縮檔解壓縮後**資料夾裡的所有內容**，包括 `.github/workflows/daily-publish.yml`（Mac Finder 用 `⌘ + Shift + .` 顯示隱藏資料夾）。請保留檔案的相對路徑，並選擇 **Commit directly to main**。
3. 打開儲存庫的 **Settings → Pages → Build and deployment → Source → GitHub Actions**。前往 **Actions → 每日更新與發布 Stock Lens → Run workflow** 手動執行第一次部署。完成後，Pages 設定頁會顯示網站網址，一般形式是 `https://你的帳號.github.io/stock-lens/`。

如果一開始 push 自動觸發的流程失敗（因當時還沒開啟 Pages），請完成第 3 步後在 Actions 按 **Run workflow** 重新執行即可。**請到 Settings → Pages 選擇 GitHub Actions，並在 Actions 手動執行第一次工作流程，確認 Pages 發布成功。**

## 每天更新什麼

- 每天**台灣時間 18:20**（GitHub cron：UTC 10:20）在雲端執行，將新資料寫入 `site/data/stocks.json` 並重新部署。排程可能延後，並非保證準點；部分 public repos 長期無活動時，GitHub 可能停用排程，需於 Actions 重新啟用。
- 預設使用 [政府資料開放平臺資料集 11547](https://data.gov.tw/dataset/11547) 指向的 **臺灣證券交易所 TWSE OpenAPI**：`BWIBBU_ALL`（本益比／股價淨值比）與 `STOCK_DAY_AVG_ALL`（收盤價）。出處標示「TWSE／政府開放資料」；價格與財報資料可能不同期，非即時行情。資料提供者與授權請見資料集頁面。
- **PS、PEG、ROE、毛利、成長率、美股、上櫃股不在上述兩個 TWSE 資料集內**，預設顯示「—」或「尚無授權資料」，不會捏造。要自動更新這些欄位，需要接入**具相應展示／發布權利**的來源。
- 若當天一檔讀取失敗，會保留該股前一次有效資料並顯示「⏳ 舊快照」與各股資料日期；如果全部失敗，仍保留先前已發布網站，且不虛報成功更新。未曾成功載入前會顯示清楚標記的**虛構教學資料**。

## 加入你的授權 PS / PEG 資料（選用）

如果有獲得適當展示許可、可透過 HTTPS 下載的 CSV，至 **Settings → Secrets and variables → Actions → New repository secret** 建立 `STOCK_LENS_CSV_URL`，值填入該 HTTPS CSV 的 URL（可包含由資料商提供的授權查詢參數）。排程將自動讀取 CSV；同股票的官方台股 `price/pe/pb` 仍優先採用 TWSE，CSV 用來補充 `ps/peg/毛利/成長率/ROE`。美股或上櫃可整筆從 CSV 提供。

CSV 標頭使用：`symbol,name,category,industry,price,currency,pe,pb,ps,peg,gross_margin,revenue_growth,earnings_growth,roe,trailing_eps,net_income,peg_basis,quote_time,source`。數字用純值，百分比用**百分點**（70% 填 70）。URL 與權杖**不要**寫進 `index.html`、`watchlist.json` 或公開儲存庫。如果資料商需要 Bearer Token 或其他驗證格式，需要針對該 API 修改雲端 `licensed_csv_snapshot`，不能直接填 URL 代替所有 API。

Yahoo Finance / yfinance **不是已授權的公開再發布資料來源**；本部署版本預設**不會**向 Yahoo、TradingView 或 Investing.com 自動爬取資料。三站的個股連結僅用於人工查核。

## 修改觀察清單與分類

- 雲端每天會讀取根目錄 `watchlist.json` 的 `symbols`（預設 10 檔，最多 40 檔）；在 GitHub 網頁中編輯後 Commit 到 `main`，會自動觸發發布工作。四位台股代碼沒有附檔名會自動轉 `.TW`；上櫃需填 `.TWO`。
- 網頁上的「加入股票」、分類與指標人工修改存在**該瀏覽器 localStorage**，不會自動寫進 GitHub；要讓新股票每天由雲端更新，仍須加入 `watchlist.json` 並確保其來源有授權資料。
- 分類不代表投資建議。預設觀察清單中的產業／分類是研究起點；新股票如無足夠資訊會顯示「待分類」。
- 五類主指標：週期 PB、重資產金融 PB、前期虧損 PS（依毛利分流）、高成長 PEG、穩定獲利 PE（沒有自訂區間，因此不自動給便宜昂貴評價）。

## 專案結構

- `site/index.html`：網頁。
- `site/data/stocks.json`：每日快照（首次部署為空）。
- `watchlist.json`：雲端要追蹤的股票。
- `update_snapshot.py`：雲端取得／整理資料、缺值與失敗保留。
- `.github/workflows/daily-publish.yml`：每日排程、自動部署。
- `tests/test_snapshot.py`：不依賴真實網路的邏輯測試。

## 注意

公開 GitHub Pages **不是私人網站**。TWSE 的開放資料受其對應開放授權約束，應保留來源與必要的授權標示；其他交易所、資料商或 Yahoo 提供的行情，不應在未取得適當權利時直接公開散布。GitHub Actions 排程只是每天嘗試更新資料，無法保證每檔股票、每項財報當天都有新值。網站僅供研究，不提供自動交易或保證買賣訊號。