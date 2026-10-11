const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {recentPublishedMeetingSummaries,monthStart}=require('../meeting_summaries.cjs');
function entry(symbol,date,batch='meeting'){return {symbol,name:'公司',kind:'法說會',meeting_date:'2026-09-01',summary_updated_at:date,batch_id:batch,summary_verified:true,website_adopted:true,published:true,live_verified:true};}
const profile={name:'長榮',meeting_research:{batch_id:'meeting',status:'meeting_complete_with_disclosed_gaps',event_date:'2026-09-01'}};
test('last month uses actual summary update date, orders latest first, and deduplicates one meeting',()=>{
 const p={'2603.TW':profile,'3008.TW':profile,'2010.TW':profile,'1215.TW':profile};
 const list=[entry('2603.TW','2026-09-11'),entry('2603.TW','2026-10-10'),entry('3008.TW','2026-10-11'),entry('2010.TW','2026-09-10'),entry('1215.TW','2026-10-12')];
 const rows=recentPublishedMeetingSummaries(list,p,'2026-10-11');assert.deepEqual(rows.map(r=>r.symbol),['3008.TW','2603.TW']);assert.equal(rows[1].summary_updated_at,'2026-10-10');assert.equal(rows[0].meeting_date,'2026-09-01');
 assert.equal(recentPublishedMeetingSummaries([entry('2603.TW','2026-09-11')],p,'2026-10-11').length,1);
 assert.equal(monthStart('2026-03-31'),'2026-02-28');assert.equal(monthStart('2028-03-31'),'2028-02-29');assert.equal(monthStart('2026-01-31'),'2025-12-31');
});
test('unpublished, pending, unrelated chapter, superseded and invalid records stay absent',()=>{
 const base=entry('2603.TW','2026-10-11'),p={'2603.TW':profile};
 for(const flag of ['summary_verified','website_adopted','published','live_verified'])assert.equal(recentPublishedMeetingSummaries([{...base,[flag]:false}],p,'2026-10-11').length,0);
 for(const change of [{symbol:'9999.TW'},{batch_id:'old'},{kind:'公告'},{summary_updated_at:'2026-13-01'},{meeting_date:'2026-02-30'},{meeting_date:'2026-10-12'}])assert.equal(recentPublishedMeetingSummaries([{...base,...change}],p,'2026-10-11').length,0);
 assert.equal(recentPublishedMeetingSummaries([base],{'2603.TW':{name:'長榮'}},'2026-10-11').length,0);
 assert.equal(recentPublishedMeetingSummaries([base],{'2603.TW':{...profile,meeting_research:{...profile.meeting_research,status:'researching'}}},'2026-10-11').length,0);
});
function app(){
 const elements=new Map();const make=()=>({innerHTML:'',textContent:'',value:'',open:false,setAttribute(k,v){this[k]=v},querySelectorAll(){return []},close(){this.open=false}});
 const ctx=vm.createContext({window:{localStorage:{getItem:()=>null,setItem(){}}},document:{getElementById:id=>{if(!elements.has(id))elements.set(id,make());return elements.get(id)},querySelectorAll:()=>[]},Date,URL,Blob,setTimeout,console});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../site/app.js'),'utf8').replace(/init\(\);\s*$/,''),ctx);
 return {elements,run:s=>vm.runInContext(s,ctx),ctx};
}
test('recent panel shows both dates and safe company links; link clears old filters and selects existing company',()=>{
 const a=app();a.ctx.rows=[{symbol:'2603.TW',name:'長榮<script>',kind:'法說會',meeting_date:'2026-09-01',summary_updated_at:'2026-10-11'}];
 a.run("calendar.payload={recent_summaries:rows};calendar.view='recent';renderCalendar()");
 const html=a.elements.get('calendarContent').innerHTML;assert.match(html,/data-calendar-symbol="2603.TW"/);assert.match(html,/會議日期/);assert.match(html,/摘要更新日期/);assert.match(html,/2026-09-01/);assert.match(html,/2026-10-11/);assert.doesNotMatch(html,/<script>/);assert.equal(a.elements.get('calendarRecent')['aria-selected'],'true');
 const button={dataset:{calendarSymbol:'2603.TW'}};a.ctx.root={querySelectorAll:()=>[button]};a.run("state.industryFilter='水泥';state.categoryAnchor='1101.TW';state.priceMin=999;setTab=t=>{state.tab=t};selectCompany=s=>{state.selected=s};wireCalendarCompanies(root)");button.onclick();
 assert.equal(a.run('state.industryFilter'),null);assert.equal(a.run('state.categoryAnchor'),null);assert.equal(a.run('state.priceMin'),null);assert.equal(a.run('state.selected'),'2603.TW');assert.equal(a.run('state.search'),'2603');
 a.run("calendar.payload={recent_summaries:[]};renderCalendar()");assert.match(a.elements.get('calendarContent').innerHTML,/尚無已完成更新/);
});
