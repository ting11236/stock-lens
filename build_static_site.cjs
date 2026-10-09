'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
function buildStaticSite(site=path.resolve('site')){
 const read=name=>JSON.parse(fs.readFileSync(path.join(site,'data',name+'.json'),'utf8'));
 const market=read('stocks'),data=read('company-research'),movers=read('market-movers'),calendar=read('company-calendar');
 const {document,window}=parseHTML(fs.readFileSync(path.join(site,'index.html'),'utf8'));
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){const o=this.querySelector('option[selected]')||this.querySelector('option');return o?.getAttribute('value')??o?.textContent??'';},set(value){for(const o of this.querySelectorAll('option')){if((o.getAttribute('value')??o.textContent)===String(value))o.setAttribute('selected','');else o.removeAttribute('selected');}}});
 const storage={getItem:()=>null,setItem(){}};
 window.localStorage=storage;
 const ctx=vm.createContext({document,window,localStorage:storage,console,Date,URL,Blob,setTimeout,clearTimeout,requestAnimationFrame:()=>{}});
 const code=fs.readFileSync(path.join(site,'app.js'),'utf8').replace(/init\(\);\s*$/,'');
 vm.runInContext(code,ctx);
 const run=s=>vm.runInContext(s,ctx);
 ctx.market=market;ctx.profiles=data.profiles;ctx.moverData=movers;ctx.calendarData=calendar;
 run("state.stocks=market.stocks;state.payload=market;research.profiles=validateResearch({schema_version:1,profiles});research.loading=false;movers.payload=moverData;calendar.payload=calendarData");
 // Generate complete reading content at publication time.
 const folder=path.join(site,'companies');fs.mkdirSync(folder,{recursive:true});
 const template=(key,label,html)=>'<template data-page-key="'+key+'" data-page-label="'+label+'">'+html+'</template>';
 for(const stock of market.stocks){
  ctx.symbol=stock.symbol;
  const pages=run("companyPages(materialize(state.stocks.find(s=>s.symbol===symbol)))");
  const host=document.createElement('div');host.innerHTML=run("fullResearchHtml(materialize(state.stocks.find(s=>s.symbol===symbol)))");
  const financial=host.querySelector('.imported-overview > details');financial?.querySelector(':scope > summary')?.remove();
  const content=pages.map(p=>template(p.key,p.label,p.html)).join('')+'<template data-company-financial>'+ (financial?.innerHTML||'<p>目前尚未提供這部分資料。</p>')+'</template>';
  fs.writeFileSync(path.join(folder,stock.symbol.slice(0,-3)+'.html'),'<div data-company-symbol="'+stock.symbol+'">'+content+'</div>');
 }
 // Render optional panels; browsers switch between ready-made fragments.
 const panelTemplates=[];
 for(const period of Object.keys(movers.periods||{})){
  for(const view of ['gainers','losers']){
   ctx.period=period;ctx.view=view;run("movers.period=period;movers.view=view;renderMovers()");
   panelTemplates.push(template('movers-'+period+'-'+view,'',document.getElementById('moversContent').innerHTML));
  }
 }
 for(const view of ['upcoming','queue']){
  ctx.view=view;run("calendar.view=view;renderCalendar()");
  panelTemplates.push(template('calendar-'+view,'',document.getElementById('calendarContent').innerHTML));
 }
 fs.writeFileSync(path.join(site,'mover-pages.html'),panelTemplates.filter(t=>t.includes('data-page-key="movers-')).join(''));
 fs.writeFileSync(path.join(site,'calendar-pages.html'),panelTemplates.filter(t=>t.includes('data-page-key="calendar-')).join(''));
 // Searchable prose is also a generated HTML document, loaded only for topic search.
 const search=[];
 for(const stock of market.stocks){
  ctx.symbol=stock.symbol;
  const entries=run("researchSearchEntries(research.profiles[symbol])");
  const node=document.createElement('section');node.dataset.searchSymbol=stock.symbol;
  for(const e of entries){const p=document.createElement('p');p.dataset.searchLabel=e.label;p.textContent=e.text;node.append(p);}
  search.push(node.outerHTML);
 }
 fs.writeFileSync(path.join(site,'search-text.html'),search.join(''));
 // A small display model supports sorting/filtering. It contains no research
 // histories, financial statements, source URLs, formulas or source logs.
 const stocks=run("state.stocks.map(materialize)").map(s=>{
  const keys=['symbol','name','industry','category','price','price_date','pe','pb','ps','peg','eps','trailing_eps','revenue_growth','earnings_growth','gross_margin','roe','dividend_yield'];
  const row=Object.fromEntries(keys.map(k=>[k,s[k]??null]));
  row.field_meta={};
  if(s.field_meta?.peg){row.field_meta.peg=Object.fromEntries(['date','period_mode','comparison_period'].map(k=>[k,s.field_meta.peg[k]]).filter(([,v])=>v!==undefined));}
  const p=movers.periods?.['5'];if(p?.end===s.price_date)row._weekly_change={value:p.changes?.[s.symbol]??null,start:p.start,end:p.end};
  return row;
 });
 const briefs=Object.fromEntries(stocks.map(s=>{
  const p=data.profiles[s.symbol]||{};
  return [s.symbol,{name:s.name,status:p.status,reviewed_at:p.reviewed_at,sources:{},limitations:[],_overview_date:p.overview?.source_reviewed_at,_meeting_brief:calendar.companies?.[s.symbol]?Object.fromEntries(['next_conference','next_shareholders'].map(k=>[k,calendar.companies[s.symbol][k]?Object.fromEntries(['kind','date','end_date','time'].map(f=>[f,calendar.companies[s.symbol][k][f]])):null])):undefined,_detail_path:'companies/'+s.symbol.slice(0,-3)+'.html'}];
 }));
 const display={schema_version:2,stocks,profiles:briefs,latest_price_date:market.latest_price_date,fetched_at:market.fetched_at};
 // Real HTML is visible before JavaScript or any data request finishes.
 run("state.selected=state.stocks[0]?.symbol;render()");
 document.getElementById('marketDate').textContent=market.latest_price_date||'尚無資料';
 document.getElementById('lastUpdated').textContent='資料內容更新：'+market.fetched_at;
 document.getElementById('notice').textContent='已顯示 '+stocks.length+' 檔上市股票。';
 let model=document.getElementById('displayModel');
 if(!model){model=document.createElement('script');model.id='displayModel';model.type='application/json';document.body.append(model);}
 model.textContent=JSON.stringify(display).replaceAll('<','\\u003c');
 document.getElementById('homeBootstrap')?.remove();
 fs.writeFileSync(path.join(site,'index.html'),'<!doctype html>\n'+document.documentElement.outerHTML);
 return {companies:stocks.length,homepageBytes:fs.statSync(path.join(site,'index.html')).size};
}
module.exports={buildStaticSite};
if(require.main===module)console.log(buildStaticSite(process.argv[2]?path.resolve(process.argv[2]):undefined));
