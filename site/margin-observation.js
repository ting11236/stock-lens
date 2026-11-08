(() => {
  'use strict';
  const trigger=document.getElementById('marginObservationOpen'),dialog=document.getElementById('marginObservationDialog'),content=document.getElementById('marginObservationContent');
  if(!trigger||!dialog||!content)return;
  let loading=null,ready=false,market='combined',period='90';
  function draw(){
    const template=content.querySelector('template[data-margin-chart="'+market+'-'+period+'"]'),host=content.querySelector('[data-margin-chart-host]');
    if(host&&template)host.innerHTML=template.innerHTML;
    content.querySelectorAll('[data-margin-market]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.marginMarket===market)));
    content.querySelectorAll('[data-margin-period]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.marginPeriod===period)));
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
