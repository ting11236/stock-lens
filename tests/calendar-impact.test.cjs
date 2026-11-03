const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function app(){const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',setAttribute(){},querySelectorAll(){return []}});return elements.get(id)};const ctx=vm.createContext({window:{localStorage:{getItem:()=>null,setItem(){}}},document:{getElementById:get},Date,URL,Blob,setTimeout,console});vm.runInContext(fs.readFileSync('site/app.js','utf8').replace(/init\(\);\s*$/,''),ctx);return {ctx,get,run:s=>vm.runInContext(s,ctx)}}
test('legacy, routine and uncertain major announcements cannot render in any calendar queue',()=>{
 const a=app(),base={symbol:'5203.TW',name:'訊連',kind:'重大訊息',date:'2026-11-03',end_date:'2026-11-03',source:'https://example.com',description:'routine marker'};
 a.ctx.items=[base,{...base,research_impact:{policy:'research-impact-v1',status:'routine'}},{...base,research_impact:{policy:'research-impact-v1',status:'review'}},{...base,description:'material marker',research_impact:{policy:'research-impact-v1',status:'material'}}];
 a.run("calendar.payload={as_of:'2026-11-04',events:[],update_queue:items,companies:{}};calendar.view='queue';renderCalendar()");
 const html=a.get('calendarContent').innerHTML;assert.doesNotMatch(html,/routine marker/);assert.match(html,/material marker/);
 a.run("research.profiles={};state.stocks=[]");a.ctx.stock={symbol:'5203.TW'};assert.doesNotMatch(a.run('calendarCompanyHtml(stock)'),/routine marker/);assert.match(a.run('calendarCompanyHtml(stock)'),/material marker/);
 assert.equal(a.run('calendarEventHtml(items[0])'),'');
});
