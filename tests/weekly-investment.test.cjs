const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
global.document = {getElementById:()=>null};
global.location = {href:'https://ting11236.github.io/stock-lens/'};
const {freshness, render, escape, range} = require('../site/weekly-investment.js');
const r = JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../site/data/weekly-investment.json'),'utf8'));
test('close boundary and Taipei weekday do not keep old signals fresh',()=>{
 assert.match(freshness({...r,priceAsOf:'2026-10-06'},new Date('2026-10-07T13:29:00+08:00')),/收盤基準/);
 assert.match(freshness({...r,priceAsOf:'2026-10-06'},new Date('2026-10-07T13:30:00+08:00')),/待刷新/);
 assert.match(freshness({...r,priceAsOf:'2026-10-08'},new Date('2026-10-09T14:00:00+08:00')),/待刷新/);
 assert.match(freshness({...r,priceAsOf:'2026-10-09'},new Date('2026-10-10T14:00:00+08:00')),/收盤基準/);
 assert.match(freshness(r,new Date('2026-10-12T00:01:00+08:00')),/已到期/);
});
test('published evidence keeps missing comparable inputs absent and weights feasible',()=>{
 assert.equal(r.companies.length,8);
 assert.equal(Object.values(r.portfolio.base_weights).reduce((a,b)=>a+b,0),100);
 assert.ok(r.top_layout.length===0);
 const w=r.companies.find(c=>c.code==='6669');
 assert.equal(w.prices.best_entry,null);
 assert.equal(w.valuation.ttm_pe,null);
 assert.equal(w.technical.ma['60'],2097.2);
 assert.equal(w.technical.corporate_action_adjustment.factor,2.9827946);
 for(const c of r.companies){assert.equal(c.priceAsOf,r.priceAsOf);if(c.building_plan.tranches.length) assert.equal(c.building_plan.tranches.reduce((a,t)=>a+t.target_pct,0),100);for(const n of Object.values(c.scores))assert.ok(n>=0&&n<=10);}
});
test('decision content precedes analysis and untrusted report text is escaped',()=>{
 const html=render(r);
 assert.ok(html.indexOf('最值得設定')<html.lastIndexOf('本週產業 Top5'));
 assert.ok(html.indexOf('最終操作表')<html.lastIndexOf('本週產業 Top5'));
 assert.equal(escape('<img onerror="bad">'),'&lt;img onerror=&quot;bad&quot;&gt;');
 assert.match(range(null),/資料不足/);
});

test('same-week update preserves archived baseline and displays actual changes',()=>{
 const v1=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../site/data/weekly-investment/2026-W41-v1.json'),'utf8'));
 assert.equal(v1.version,1);assert.equal(v1.priceAsOf,'2026-10-06');
 assert.equal(r.version,2);assert.equal(r.priceAsOf,'2026-10-07');
 assert.equal(r.changes.added.length,0);assert.equal(r.changes.rating_changes.length,1);
 assert.equal(r.changes.entry_changes.length,7);
 assert.match(render(r),/週報 v2/);assert.doesNotMatch(render(r),/首版 v2|歷史評級變動0/);
 for(const c of r.companies){
  if(c.prices.breakout!==null){const tick=c.technical.high20>=1000?5:c.technical.high20>=500?1:.5;assert.equal(c.prices.breakout,c.technical.high20+tick);}
  assert.equal(c.valuation.official_pe_date,'2026-10-06');
 }
});
