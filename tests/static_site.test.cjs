const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {parseHTML}=require('linkedom');
const {buildStaticSite}=require('../build_static_site.cjs');
test('published HTML shows stocks before scripts run and startup makes no data requests',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'stock-lens-html-')),site=path.join(root,'site');fs.mkdirSync(path.join(site,'data'),{recursive:true});
 for(const f of ['index.html','app.js'])fs.copyFileSync(path.join(__dirname,'../site',f),path.join(site,f));
 const stock={symbol:'1101.TW',name:'<script>alert(1)</script>',industry:'水泥工業',category:'週期股',price:20,price_date:'2026-10-08',pb:.8,field_meta:{price:{source:'https://example.com/private-audit',basis:'原始來源紀錄'}}};
 for(const k of ['pe','ps','peg','eps','trailing_eps','revenue_growth','earnings_growth','gross_margin','roe','dividend_yield'])stock[k]=null;
 const write=(name,v)=>fs.writeFileSync(path.join(site,'data',name+'.json'),JSON.stringify(v));
 write('stocks',{schema_version:2,stocks:[stock],latest_price_date:'2026-10-08',fetched_at:'2026-10-09T00:00:00Z'});
 write('company-research',{schema_version:1,profiles:{'1101.TW':{name:stock.name,status:'pending',reviewed_at:null,sources:{},limitations:['尚未完成研究']}}});
 write('market-movers',{schema_version:1,basis:'收盤價',periods:{'5':{start:'2026-10-01',end:'2026-10-08',count:1,changes:{'1101.TW':0},gainers:[],losers:[]}}});
 write('company-calendar',{schema_version:1,as_of:'2026-10-09',events:[],update_queue:[],companies:{},errors:[]});
 try{
  const result=buildStaticSite(site);assert.equal(result.companies,1);
  const html=fs.readFileSync(path.join(site,'index.html'),'utf8'),{document,window}=parseHTML(html);
  assert.equal(document.querySelectorAll('#stockRows tr[data-symbol]').length,1);
  assert.match(document.getElementById('stockRows').textContent,/alert\(1\)/);
  const model=JSON.parse(document.getElementById('displayModel').textContent);assert.equal(model.stocks[0].price,20);
  assert.doesNotMatch(JSON.stringify(model),/private-audit|原始來源紀錄/);
  assert.equal(document.querySelectorAll('script').length,parseHTML(fs.readFileSync(path.join(__dirname,'../site/index.html'),'utf8')).document.querySelectorAll('script').length);
  const company=parseHTML(fs.readFileSync(path.join(site,'companies/1101.html'),'utf8')).document;assert.equal(company.querySelectorAll('template[data-page-key]').length,9);
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.getAttribute('data-value')||this.querySelector('option')?.getAttribute('value')||''},set(v){this.setAttribute('data-value',v)}});
  const storage={getItem:()=>null,setItem(){}};window.localStorage=storage;
  const requests=[];const ctx=vm.createContext({document,window,localStorage:storage,console,Date,URL,Blob,setTimeout,clearTimeout,requestAnimationFrame:()=>{},fetch:async u=>{requests.push(u);throw Error('No initial data downloads expected')}});
  vm.runInContext(fs.readFileSync(path.join(site,'app.js'),'utf8'),ctx);
  assert.deepEqual(requests,[]);assert.match(document.getElementById('notice').textContent,/已顯示 1 檔/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

