
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const {parseHTML}=require('linkedom');
const source=fs.readFileSync(path.join(__dirname,'../site/margin-observation.js'),'utf8');
function setup(fetch){
 const {document,window}=parseHTML('<html><body><button id="marginObservationOpen">開啟</button><dialog id="marginObservationDialog"><button id="marginObservationClose">關閉</button><div id="marginObservationContent"></div></dialog></body></html>');
 Object.defineProperty(document,'baseURI',{value:'https://example.com/stock-lens/'});
 const dialog=document.getElementById('marginObservationDialog');dialog.showModal=()=>dialog.open=true;dialog.close=()=>dialog.open=false;
 const ctx=vm.createContext({document,window,DOMParser:window.DOMParser,URL,fetch});vm.runInContext(source,ctx);
 return {document,dialog,open:()=>document.getElementById('marginObservationOpen').click()};
}
const html='<section class="margin-panel"><button data-margin-market="combined"></button><button data-margin-market="twse"></button><button data-margin-period="30"></button><div data-margin-chart-host></div><template data-margin-chart="combined-90">合計</template><template data-margin-chart="twse-90">上市</template><template data-margin-chart="twse-30">上市月線</template></section>';
const flush=()=>new Promise(r=>setImmediate(r));
test('margin panel downloads once and reopening displays cached content immediately',async()=>{
 let calls=0,resolve;const s=setup(()=>{calls++;return new Promise(r=>resolve=r)});
 s.open();s.open();assert.equal(calls,1);resolve({ok:true,text:async()=>html});await flush();
 const body=s.document.getElementById('marginObservationContent');assert.match(body.textContent,/合計/);
 body.querySelector('[data-margin-market="twse"]').click();assert.equal(body.querySelector('[data-margin-chart-host]').textContent,'上市');
 s.dialog.close();s.open();assert.equal(calls,1);assert.equal(body.querySelector('[data-margin-chart-host]').textContent,'上市');
 body.querySelector('[data-margin-period="30"]').click();assert.equal(body.querySelector('[data-margin-chart-host]').textContent,'上市月線');
});
test('failed margin download can retry without getting stuck on a rejected promise',async()=>{
 let calls=0;const s=setup(async()=>{if(++calls===1)throw Error('offline');return {ok:true,text:async()=>html}});
 s.open();await flush();assert.ok(s.document.querySelector('[data-margin-retry]'));s.document.querySelector('[data-margin-retry]').click();await flush();
 assert.equal(calls,2);assert.ok(s.document.querySelector('.margin-panel'));
});

