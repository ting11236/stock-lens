const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('company reopen displays cached content immediately without loading placeholder or fetching',async()=>{
 const body={innerHTML:''},dialog={open:false,showModal(){this.open=true}};
 const ctx=vm.createContext({window:{localStorage:{getItem:()=>null}},document:{getElementById:id=>id==='researchDialog'?dialog:body},console,Date,URL,Blob,setTimeout});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../site/app.js'),'utf8').replace(/init\(\);\s*$/,''),ctx);
 vm.runInContext("state.stocks=[{symbol:'1101.TW',name:'台泥'}];research.profiles={'1101.TW':{_detail_path:'companies/1101.html'}};renderedCompanies.set('1101.TW',{pages:[{key:'intro',html:'已讀取內容'}]});renderResearchPage=()=>{$('researchPageBody').innerHTML=researchView.pages[researchView.index].html};globalThis.calls=0;ensureCompanyResearch=async()=>{calls++}",ctx);
 await vm.runInContext("openCompanyResearch('1101.TW',0,null)",ctx);
 assert.equal(body.innerHTML,'已讀取內容');assert.equal(vm.runInContext('calls',ctx),0);
});
test('report reopen and simultaneous opens reuse content, while a failed request can retry',async()=>{
 const src=fs.readFileSync(path.join(__dirname,'../site/weekly-investment.js'),'utf8');
 const start=src.indexOf('  const reportRequests=new Map();'),end=src.indexOf("  if (typeof window",start);
 const root={innerHTML:'',setAttribute(){}},loadedReports=new Map();let calls=0,fail=false,resolveFirst;
 const ctx=vm.createContext({loadedReports,render:()=>'<p>已讀取報告</p>',bindTabs(){},fetch:async url=>{calls++;if(fail)throw Error('offline');if(url.includes('weekly-backtest'))return {ok:false};await new Promise(r=>resolveFirst=r);return {ok:true,json:async()=>({schema_version:1,companies:[{}]})}}});
 vm.runInContext(src.slice(start,end),ctx);ctx.root=root;
 const first=vm.runInContext('loadReport(root)',ctx),second=vm.runInContext('loadReport(root)',ctx);assert.equal(calls,1);resolveFirst();await Promise.all([first,second]);
 assert.equal(root.innerHTML,'<p>已讀取報告</p>');const before=calls;await vm.runInContext('loadReport(root)',ctx);assert.equal(calls,before);assert.equal(root.innerHTML,'<p>已讀取報告</p>');
 loadedReports.clear();fail=true;await vm.runInContext('loadReport(root)',ctx);assert.equal(loadedReports.size,0);fail=false;const retry=vm.runInContext('loadReport(root)',ctx);resolveFirst();await retry;assert.equal(loadedReports.size,1);
});
