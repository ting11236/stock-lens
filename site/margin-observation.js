(() => {
  'use strict';
  const trigger=document.getElementById('marginObservationOpen'),dialog=document.getElementById('marginObservationDialog'),content=document.getElementById('marginObservationContent');
  if(!trigger||!dialog||!content)return;
  let loading=null,ready=false,market='combined',period='90';
  function draw(){
    const template=content.querySelector('template[data-margin-chart="'+market+'-'+period+'"]'),host=content.querySelector('[data-margin-chart-host]');
    if(host&&template){host.innerHTML=template.innerHTML;wirePoints(host)}
    content.querySelectorAll('[data-margin-market]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.marginMarket===market)));
    content.querySelectorAll('[data-margin-period]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.marginPeriod===period)));
  }
  function wirePoints(host){
    const svg=host.querySelector('svg'),points=svg?[...svg.querySelectorAll('circle')]:[];
    if(!points.length)return;
    const box=document.createElement('div');box.className='margin-point-detail';
    box.innerHTML='<button type="button" aria-label="前一個交易日">‹</button><output aria-live="polite"></output><button type="button" aria-label="後一個交易日">›</button>';
    svg.before(box);
    const legend=document.createElement('p');legend.className='margin-point-legend';legend.textContent='● 紅點：估算維持率低於 150%';box.after(legend);
    const output=box.querySelector('output'),buttons=box.querySelectorAll('button');let selected=points.length-1;
    function select(i){
      selected=Math.max(0,Math.min(points.length-1,i));
      points.forEach((p,j)=>{p.setAttribute('r',j===selected?'6':'3.2');p.setAttribute('data-selected',String(j===selected))});
      output.textContent=points[selected].querySelector('title').textContent;
      buttons[0].disabled=selected===0;buttons[1].disabled=selected===points.length-1;
    }
    points.forEach((p,i)=>{
      const value=p.querySelector('title').textContent.match(/([\d,]+(?:\.\d+)?)%/);
      p.setAttribute('data-below-150',String(Boolean(value)&&Number(value[1].replace(/,/g,''))<150));
      p.setAttribute('tabindex','0');p.setAttribute('role','button');p.setAttribute('aria-label',p.querySelector('title').textContent);
      p.addEventListener('click',()=>select(i));p.addEventListener('focus',()=>select(i));
      p.addEventListener('keydown',e=>{if(['Enter',' ','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const n=e.key==='ArrowLeft'?i-1:e.key==='ArrowRight'?i+1:i;select(n);points[selected].focus()}});
    });
    function nearest(e){
      if(e.type==='click'&&e.target.closest('circle'))return;
      const rect=svg.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*820;
      select(points.reduce((best,p,i)=>Math.abs(Number(p.getAttribute('cx'))-x)<Math.abs(Number(points[best].getAttribute('cx'))-x)?i:best,0));
    }
    svg.addEventListener('click',nearest);
    svg.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')nearest(e)});
    buttons[0].addEventListener('click',()=>select(selected-1));buttons[1].addEventListener('click',()=>select(selected+1));
    select(selected);
  }
  function wire(){
    content.querySelectorAll('[data-margin-market]').forEach(b=>b.addEventListener('click',()=>{market=b.dataset.marginMarket;draw()}));
    content.querySelectorAll('[data-margin-period]').forEach(b=>b.addEventListener('click',()=>{period=b.dataset.marginPeriod;draw()}));
    draw();
  }
  async function load(){
    if(ready)return;
    if(loading)return loading;
    content.innerHTML='<p role="status">正在開啟台股融資圖表…</p>';
    loading=(async()=>{
      try{
        const response=await fetch(new URL('margin-panel.html',document.baseURI));
        if(!response.ok)throw Error('read failed');
        const text=await response.text(),doc=new DOMParser().parseFromString(text,'text/html');
        const panel=doc.querySelector('.margin-panel');
        if(!panel||!panel.querySelector('template[data-margin-chart]'))throw Error('invalid reading page');
        // This same-origin reading page is generated during publication.
        panel.querySelectorAll('script,iframe,object,embed').forEach(n=>n.remove());
        panel.querySelectorAll('*').forEach(n=>{for(const a of [...n.attributes])if(/^on/i.test(a.name))n.removeAttribute(a.name)});
        content.innerHTML=panel.outerHTML;wire();ready=true;
      }catch{
        content.innerHTML='<p role="alert">融資圖表暫時無法開啟，請稍後再試。</p><button type="button" class="button" data-margin-retry>重新開啟</button>';
        content.querySelector('[data-margin-retry]').addEventListener('click',()=>load());
      }finally{loading=null}
    })();
    return loading;
  }
  trigger.addEventListener('click',()=>{if(!dialog.open)dialog.showModal();load()});
  document.getElementById('marginObservationClose').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>trigger.focus());
})();
