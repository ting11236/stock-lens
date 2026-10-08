const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
global.document = {getElementById:()=>null};
global.location = {href:'https://ting11236.github.io/stock-lens/'};
const {freshness, render, escape, range, linkMentionedStocks} = require('../site/weekly-investment.js');
const r = JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../site/data/weekly-investment.json'),'utf8'));
test('close boundary and Taipei weekday do not keep old signals fresh',()=>{
 assert.match(freshness({...r,priceAsOf:'2026-10-06'},new Date('2026-10-07T13:29:00+08:00')),/收盤基準/);
 assert.match(freshness({...r,priceAsOf:'2026-10-06'},new Date('2026-10-07T13:30:00+08:00')),/待刷新/);
 assert.match(freshness({...r,priceAsOf:'2026-10-08'},new Date('2026-10-09T14:00:00+08:00')),/待刷新/);
 assert.match(freshness({...r,priceAsOf:'2026-10-09'},new Date('2026-10-10T14:00:00+08:00')),/收盤基準/);
 assert.match(freshness(r,new Date('2026-10-12T00:01:00+08:00')),/已到期/);
});
test('published evidence keeps missing comparable inputs absent and weights feasible',()=>{
 assert.equal(r.companies.length,11);
 assert.equal(Object.values(r.portfolio.base_weights).reduce((a,b)=>a+b,0),100);
 assert.ok(r.top_layout.length===0);
 const w=r.companies.find(c=>c.code==='6669');
 assert.equal(w.prices.best_entry,null);
 assert.equal(w.valuation.ttm_pe,null);
 assert.ok(w.technical.ma['60']>2000 && w.technical.ma['60']<2200);
 assert.equal(w.technical.corporate_action_adjustment.factor,2.9827946);
 for(const c of r.companies){assert.ok(c.priceAsOf>=r.priceAsOf);if(c.building_plan.tranches.length) assert.equal(c.building_plan.tranches.reduce((a,t)=>a+t.target_pct,0),100);for(const n of Object.values(c.scores))assert.ok(n>=0&&n<=10);}
});
test('decision content precedes analysis and untrusted report text is escaped',()=>{
 const html=render(r);
 assert.ok(html.indexOf('最值得設定')<html.lastIndexOf('本週產業 Top5'));
 assert.ok(html.indexOf('優先等待')<html.lastIndexOf('本週產業 Top5'));
 assert.equal(escape('<img onerror="bad">'),'&lt;img onerror=&quot;bad&quot;&gt;');
 assert.match(range(null),/資料不足/);
});

test('method migration preserves baselines without invented upgrades',()=>{
 const root=require('node:path').join(__dirname,'../site/data/weekly-investment/');
 const v1=JSON.parse(fs.readFileSync(root+'2026-W41-v1.json','utf8'));
 const v2=JSON.parse(fs.readFileSync(root+'2026-W41-v2.json','utf8'));
 assert.equal(v1.version,1);assert.equal(v2.version,2);assert.equal(v2.companies.length,8);
 assert.equal(r.version,3);assert.deepEqual(r.changes.added,['1590','1256','2108']);assert.equal(r.changes.rating_changes.length,0);
 for(const c of r.companies) assert.deepEqual(Object.keys(c.scores),['industry','quality','improvement','valuation_entry','confidence']);
 assert.match(render(r),/週報 v3/);assert.doesNotMatch(render(r),/undefined|NaN|比較 8 檔/);
});
test('new candidates have no invented buy prices and company analysis keeps entry and holding conditions',()=>{
 const screen=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../research/weekly-investment/2026-W41-screen-v3.json'),'utf8'));
 assert.equal(screen.universe_count,1089);assert.equal(screen.candidate_count,90);assert.equal(screen.coverage.roic,0);assert.equal(screen.coverage.fcf,0);
 for(const code of r.changes.added){const c=r.companies.find(c=>c.code===code);assert.equal(c.position.role,'Watchlist');assert.deepEqual(c.position.weight_range_pct,[0,0]);assert.equal(c.prices.breakout,null);assert.equal(c.prices.best_entry,null);assert.equal(c.reverse_valuation.implied_eps,null);assert.equal(c.building_plan.tranches.length,0);assert.equal(c.monthly.revenue_twd_thousand,null);}
 const html=render(r);assert.match(html,/全市場研究篩選/);assert.match(html,/轉機股/);assert.match(html,/Reverse Valuation/);
 assert.equal((html.match(/data-weekly-analysis-template=/g)||[]).length,11);assert.doesNotMatch(html,/全部股票操作建議|weekly-operation-card/);for(const label of ["是否建倉／如何分批","進場訊號","買點不成立／風險管理"])assert.ok(html.includes(label));
});

test('support failure cancels previous left-side entry instead of moving it lower',()=>{const q=r.companies.find(c=>c.code==='2382');assert.equal(q.price,325.5);assert.equal(q.prices.first_attention,null);assert.equal(q.prices.best_entry,null);assert.equal(q.building_plan.tranches.length,0);assert.match(q.building_plan.current_action,/撤銷/);assert.ok(q.technical.volume_ratio>1);});

test('all recommendation names use original company links and retain return context',()=>{const html=render(r);for(const code of r.top_wait.concat(r.top_no_chase,r.top_research)){assert.match(html,new RegExp('data-weekly-company="'+code+'"'));}assert.doesNotMatch(html,/<a href="#weekly-/);assert.ok((html.match(/data-weekly-company=/g)||[]).length>=45);});

test('stock mentions in headings and prose are linked without nested links or unsafe HTML',()=>{
 const text=linkMentionedStocks('<h3>台積電與亞德客</h3><p>鮮活、南帝</p><a href="safe">台積電</a><button>台積電</button>',r.companies);
 assert.equal((text.match(/data-weekly-company=/g)||[]).length,4);assert.match(text,/<h3><a[^>]+>台積電<\/a>/);assert.match(text,/<a href="safe">台積電<\/a>/);assert.match(text,/<button>台積電<\/button>/);
 assert.doesNotMatch(render(r),/<a[^>]*>[^<]*<a/);
});

test('backtest shows scheduled status and no fabricated returns before start',()=>{
 const b=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../site/data/weekly-backtest.json'),'utf8'));
 assert.equal(b.initial_capital,10000);assert.equal(b.start_date,'2026-10-12');assert.equal(b.trades.length,0);assert.equal(b.total_return_pct,null);
 const html=render({...r,backtest:b});assert.match(html,/data-weekly-tab="backtest"/);assert.match(html,/尚未開始/);assert.match(html,/逐筆建倉／分批出場紀錄/);assert.match(html,/下一交易日|下一交易日/);assert.doesNotMatch(html,/undefined|NaN/);
});

test('overview order, research folding and portfolio placement remain clear',()=>{
 const b=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../site/data/weekly-backtest.json'),'utf8'));
 const html=render({...r,backtest:b});
 const overview=html.split('id="weekly-overview"')[1].split('id="weekly-industries"')[0];
 const labels=['布局','優先等待','不追高','最值得設定的 3 個價格提醒','只能選一檔的中期研究選擇','轉機股'];
 for(let i=1;i<labels.length;i++)assert.ok(overview.indexOf(labels[i-1])<overview.indexOf(labels[i]));
 assert.doesNotMatch(overview,/條件式研究示範配置/);
 assert.match(overview,/<details[^>]*><summary>全市場研究篩選/);
 assert.doesNotMatch(html,/data-weekly-tab="screening"|data-weekly-tab="2330"|data-weekly-tab="operations"/);
 assert.match(html,/data-weekly-analysis="2330"/);
 assert.match(html,/<dialog class="weekly-analysis-dialog"/);
 assert.match(html,/配置是條件成立後的目標，不是實際持倉/);
});

test('current demonstration allocation uses the same ledger and leaves untriggered cash untouched',()=>{
 const b=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../site/data/weekly-backtest.json'),'utf8'));
 const html=render({...r,backtest:b});assert.match(html,/目前研究示範配置（與回測同一帳本）/);assert.match(html,/尚無成立且成交的建倉：100%現金/);assert.match(html,/未成立不投入/);
});

test('price reminders explicitly identify prices and give beginner-readable steps',()=>{const html=render(r);for(const price of ['2,515','330','2,145'])assert.ok(html.includes('觀察價格：'+price));assert.match(html,/先設定價格通知 → 到價後查看個股分析/);assert.match(html,/現在價格：2,070/);assert.match(html,/股價現況/);assert.match(html,/觀察條件/);assert.match(html,/進場參考/);assert.doesNotMatch(html,/2,515 元（新臺幣）/);});

test('internal update bullets stay out of the customer interface and actionable text is readable',()=>{const b=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../site/data/weekly-backtest.json'),'utf8'));const html=render({...r,backtest:b});assert.doesNotMatch(html,/資料庫先篩1089檔|五項評分改為產業|提前布局20／30／50|發布前已核10\/8收盤10檔|&lt;strong class=/);assert.match(html,/weekly-close-price/);assert.match(html,/目前採用的建倉方式/);assert.match(html,/目前行動/);});

test('fractional research ledger keeps real rules and readable quantity mode',()=>{const b=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../site/data/weekly-backtest.json'),'utf8'));assert.equal(b.share_mode,'fractional_research');const html=render({...r,backtest:b});assert.match(html,/小數股研究模擬/);assert.doesNotMatch(html,/預算不足一股時保留現金/);});

test('compact tranche table keeps target amounts and entry-risk bullets distinct',()=>{const b=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../site/data/weekly-backtest.json'),'utf8'));const html=render({...r,backtest:b});const company=html.split('data-weekly-analysis-template="2330"')[1].split('data-weekly-analysis-template="2308"')[0];assert.match(company,/weekly-tranche-table/);assert.match(company,/<th>觀察股價<\/th><th>符合什麼條件<\/th><th>投入多少資金<\/th>/);assert.doesNotMatch(company,/約 500 元|以目前 10,000 元模擬帳戶為例/);assert.match(company,/1\/4（25%）/);assert.match(company,/取消這次買進/);assert.match(company.replace(/<[^>]+>/g,''),/停止加碼，評估減少/);assert.match(company,/重新評估中長期持有/);assert.doesNotMatch(company,/每一筆買進都需要同時確認股價、成交量與公司營運/);});

test('risk table maps original failure thresholds to actions without price underlines',()=>{const html=render(r);const company=html.split('data-weekly-analysis-template="2330"')[1].split('data-weekly-analysis-template="2308"')[0];assert.match(company,/weekly-risk-table/);assert.match(company,/<th>發生什麼情況<\/th><th>建議怎麼做<\/th>/);assert.match(company,/2,375/);assert.match(company,/1.5倍/);assert.match(company,/毛利率連續2季/);assert.match(company,/補充量能與公司營運條件/);const css=fs.readFileSync(require('node:path').join(__dirname,'../site/weekly-investment.css'),'utf8');assert.match(css,/\.weekly-observe-price,\.weekly-observe-signal\{text-decoration:none\}/);});

test('price reminder summaries give direct conditional guidance with linked entry signals',()=>{const html=render(r);const alerts=html.split('class="weekly-alerts"')[1].split('class="weekly-alert-help"')[0];assert.match(alerts,/weekly-entry-link/);assert.match(alerts,/aria-label="台積電的進場訊號"/);assert.match(alerts,/可考慮按建議分批進場/);assert.match(alerts,/突破時成交量不足，先不買進/);assert.doesNotMatch(alerts,/適合觀察回檔是否穩定|最新收盤資料確認後，會重新核對觀察位置|查看成交量是否縮小/);});

test("risk rows state each breakout and breakdown price explicitly",()=>{const html=render(r);assert.match(html,/收盤突破 2,595 後，下一個交易日收盤又跌回 2,595 以下/);assert.match(html,/單日收盤跌破 2,375，成交量達前20日平均量1.5倍/);});

test("every risk scenario begins with conditional 若",()=>{const html=render(r);for(const table of html.matchAll(/class="weekly-risk-table"[\s\S]*?<\/table>/g)){const rows=[...table[0].matchAll(/<tr><td>(.*?)<\/td>/g)];assert.ok(rows.length>0);assert.ok(rows.every(row=>row[1].startsWith("若")));}});

test('trading terms link to matching explanations without nesting source links',()=>{const html=render(r);assert.match(html,/data-weekly-term="right"/);assert.match(html,/data-weekly-term="left"/);assert.match(html,/\?term=right#term-right/);assert.doesNotMatch(html,/<a[^>]*>[^<]*<a/);const index=fs.readFileSync(require('node:path').join(__dirname,'../site/index.html'),'utf8');assert.match(index,/id="terms"[\s\S]*?glossary-card/);assert.match(index,/id="term-left" tabindex="-1"/);assert.match(index,/id="term-right" tabindex="-1"/);});
