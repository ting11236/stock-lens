
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const {parseHTML}=require('linkedom');
const source=fs.readFileSync(path.join(__dirname,'../site/margin-observation.js'),'utf8');
function setup(fetch){
 const {document,window}=parseHTML('<html><body><button id="marginObservationOpen">開啟</button><dialog id="marginObservationDialog"><button id="marginObservationClose">關閉</button><div id="marginObservationContent"></div></dialog></body></html>');
 Object.defineProperty(document,'baseURI',{value:'https://example.com/stock-lens/'});
 const dialog=document.getElementById('marginObservationDialog');dialog.showModal=()=>dialog.open=true;dialog.close=()=>dialog.open=false;
 const ctx=vm.createContext({document,window,DOMParser:window.DOMParser,URL,fetch});vm.runInContext(source,ctx);
 return {document,window,dialog,open:()=>document.getElementById('marginObservationOpen').click()};
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


test('chart points show exact values and previous/next controls work without another download',async()=>{
 let calls=0;const chart=html.replace('>合計</template>','><svg><circle cx="64"><title>2026-11-05：≥ 154.1%</title></circle><circle cx="794"><title>2026-11-06：≥ 149.9%</title></circle></svg></template>');
 const s=setup(async()=>{calls++;return {ok:true,text:async()=>chart}});s.open();await flush();
 const host=s.document.querySelector('[data-margin-chart-host]'),out=host.querySelector('output'),points=host.querySelectorAll('circle'),buttons=host.querySelectorAll('.margin-point-detail button');
 assert.equal(out.textContent,'2026-11-06：≥ 149.9%');assert.equal(buttons[1].disabled,true);
 points[0].dispatchEvent(new s.window.Event('click',{bubbles:true}));assert.equal(out.textContent,'2026-11-05：≥ 154.1%');assert.equal(points[0].getAttribute('data-selected'),'true');
 buttons[1].click();assert.equal(out.textContent,'2026-11-06：≥ 149.9%');
 s.dialog.close();s.open();assert.equal(calls,1);assert.equal(out.textContent,'2026-11-06：≥ 149.9%');
});

test('only ratios strictly below 150 percent are red, independent of selection',async()=>{
 const chart=html.replace('>合計</template>','><svg><circle cx="64"><title>2026-11-04：≥ 149.9%</title></circle><circle cx="400"><title>2026-11-05：150.0%</title></circle><circle cx="794"><title>2026-11-06：150.1%</title></circle></svg></template>');
 const s=setup(async()=>({ok:true,text:async()=>chart}));s.open();await flush();
 const points=s.document.querySelectorAll('[data-margin-chart-host] circle');
 assert.deepEqual([...points].map(p=>p.getAttribute('data-below-150')),['true','false','false']);
 points[0].dispatchEvent(new s.window.Event('click',{bubbles:true}));
 assert.equal(points[0].getAttribute('data-selected'),'true');assert.equal(points[0].getAttribute('data-below-150'),'true');
});

test('daily values at or below 150 percent are marked red; missing values are unchanged',async()=>{
 const table=html.replace('</section>','<div class="margin-table-wrap"><table><tbody><tr><td>≥ 149.9%</td><td>150.0%</td><td>150.1%</td><td>—</td></tr></tbody></table></div></section>');
 const s=setup(async()=>({ok:true,text:async()=>table}));s.open();await flush();
 assert.deepEqual([...s.document.querySelectorAll('.margin-table-wrap td')].map(c=>c.getAttribute('data-at-most-150')),['true','true','false','false']);
});

test('chart explains personal 130 percent and author market 150 percent with expandable liquidation help',async()=>{
 const chart=html.replace('>合計</template>','><svg><circle cx="64"><title>2026-11-06：≥ 149.9%</title></circle></svg></template>');
 const s=setup(async()=>({ok:true,text:async()=>chart}));s.open();await flush();
 const note=s.document.querySelector('.margin-threshold-note'),button=note.querySelector('button'),help=note.querySelector('#marginLiquidationHelp');
 assert.equal(note.querySelector('.margin-liquidation-term u').textContent,'融資斷頭');assert.equal(button.textContent,'?');assert.equal(button.getAttribute('aria-label'),'查看融資斷頭的解釋');assert.match(note.textContent,/低於 130% 會被通知追繳/);assert.match(note.textContent,/本站作者.*低於 150%/);assert.equal(help.hidden,true);
 button.click();assert.equal(help.hidden,false);assert.equal(button.getAttribute('aria-expanded'),'true');assert.match(help.textContent,/2 個營業日/);
 button.click();assert.equal(help.hidden,true);assert.equal(button.getAttribute('aria-expanded'),'false');
});
