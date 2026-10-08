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
 assert.ok(html.indexOf('最終操作表')<html.lastIndexOf('本週產業 Top5'));
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
test('new candidates have no invented buy prices and customer table has 14 columns',()=>{
 const screen=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../research/weekly-investment/2026-W41-screen-v3.json'),'utf8'));
 assert.equal(screen.universe_count,1089);assert.equal(screen.candidate_count,90);assert.equal(screen.coverage.roic,0);assert.equal(screen.coverage.fcf,0);
 for(const code of r.changes.added){const c=r.companies.find(c=>c.code===code);assert.equal(c.position.role,'Watchlist');assert.deepEqual(c.position.weight_range_pct,[0,0]);assert.equal(c.prices.breakout,null);assert.equal(c.prices.best_entry,null);assert.equal(c.reverse_valuation.implied_eps,null);assert.equal(c.building_plan.tranches.length,0);assert.equal(c.monthly.revenue_twd_thousand,null);}
 const html=render(r);assert.match(html,/全市場研究篩選/);assert.match(html,/低動能改善研究候選/);assert.match(html,/Reverse Valuation/);
 const table=html.match(/<table class="weekly-table">([\s\S]*?)<\/table>/)[1];assert.equal((table.match(/<th>/g)||[]).length,14);
});

test('support failure cancels previous left-side entry instead of moving it lower',()=>{const q=r.companies.find(c=>c.code==='2382');assert.equal(q.price,325.5);assert.equal(q.prices.first_attention,null);assert.equal(q.prices.best_entry,null);assert.equal(q.building_plan.tranches.length,0);assert.match(q.building_plan.current_action,/撤銷/);assert.ok(q.technical.volume_ratio>1);});

test('all recommendation names use original company links and retain return context',()=>{const html=render(r);for(const code of r.top_wait.concat(r.top_no_chase,r.top_research)){assert.match(html,new RegExp('data-weekly-company="'+code+'"'));}assert.doesNotMatch(html,/<a href="#weekly-/);assert.ok((html.match(/data-weekly-company=/g)||[]).length>=45);});

test('stock mentions in headings and prose are linked without nested links or unsafe HTML',()=>{
 const text=linkMentionedStocks('<h3>台積電與亞德客</h3><p>鮮活、南帝</p><a href="safe">台積電</a><button>台積電</button>',r.companies);
 assert.equal((text.match(/data-weekly-company=/g)||[]).length,4);assert.match(text,/<h3><a[^>]+>台積電<\/a>/);assert.match(text,/<a href="safe">台積電<\/a>/);assert.match(text,/<button>台積電<\/button>/);
 assert.doesNotMatch(render(r),/<a[^>]*>[^<]*<a/);
});
