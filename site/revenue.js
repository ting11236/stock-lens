'use strict';
let revenueData=null,revenueError=false;
function revenueFreshness(profile,now=new Date()){
 const d=new Date(now.getTime()+8*3600000),index=d.getUTCFullYear()*12+d.getUTCMonth()-(d.getUTCDate()>=16?1:2);
 const expected=String(Math.floor(index/12))+'-'+String(index%12+1).padStart(2,'0');
 return !profile?.latest_month||profile.latest_month<expected;
}
function revenueHtml(stock){
 const p=revenueData?.profiles?.[stock.symbol];
 if(!p)return '<section class="monthly-revenue"><h3>月營收與 TTM</h3><p>'+ (revenueError?'營收載入失敗，請稍後按更新重試。':'尚無有效營收資料。')+'</p></section>';
 const t=p.ttm,money=v=>v===null||v===undefined?'—':Number(v).toLocaleString('zh-TW');
 const link=r=>/^https:\/\/openapi\.twse\.com\.tw\//.test(r.source_url||'')?'<a href="'+esc(r.source_url)+'" target="_blank" rel="noopener noreferrer">官方來源 ↗</a>':'來源未提供';
 return '<section class="monthly-revenue" aria-label="月營收與 TTM"><h3>月營收與 TTM 營收</h3><p>最近營收月份：<b>'+esc(p.latest_month||'未取得')+'</b>'+ (revenueFreshness(p)?' · ⚠ 過期／尚未更新':'')+'</p>'+ (revenueError||revenueData.status?.state==='failed'?'<p class="notice warn">取得失敗，保留舊資料與原下載時間。</p>':'')+'<div class="stat"><span class="label">TTM 營收 · TWD 元</span><strong>'+money(t?.amount_twd)+'</strong><small>'+esc(t?t.start+' 至 '+t.end:'尚無截止月份')+'</small></div><p class="tiny">'+esc(t?.reason||'連續 12 個月、同公司身分及同口徑單月營收總和。')+'。TTM 為營收，不是獲利或 EPS。</p><p class="tiny">'+esc(revenueData.status?.limitation||'')+'。取得 '+p.records.length+' 個月；最近 24 個月缺漏：'+esc(p.missing_months.join('、')||'無')+'</p><a class="button small" href="./data/revenue.csv" download>下載全市場月營收 CSV</a> <a class="button small" href="./data/revenue-history.json" download>下載修訂留存 JSON</a><details open><summary>月營收歷史與可核對來源</summary><div class="revenue-table"><table><thead><tr><th>營收年月</th><th>營收（TWD 元）</th><th>原始值／口徑</th><th>來源與資料時間</th></tr></thead><tbody>'+p.records.map(r=>'<tr><td>'+esc(r.period)+'</td><td>'+money(r.amount_twd)+'</td><td>'+esc(r.raw_amount??'缺值')+' '+esc(r.raw_unit)+'<br>'+esc(r.basis_note)+'<br>'+esc(r.name)+(r.reason?'<br>'+esc(r.reason):'')+'</td><td>'+link(r)+'<br>來源欄：'+esc(r.source_field)+'<br>來源資料月：'+esc(r.source_period)+'<br>出表日：'+esc(r.table_date||'未提供')+'<br>公告日：'+esc(r.published_at||'來源未提供')+'<br>下載：'+esc(r.downloaded_at)+'<br>修訂版本：'+(r.revisions?.length||0)+(r.comparison_conflicts?.length?'<br>⚠ 比較值修訂衝突':'')+'</td></tr>').join('')+'</tbody></table></div></details><p class="tiny">僅使用授權開放資料。歷史比較欄尚未驗證過去公司身分；累計收入未當作單月收入。來源未標示口徑時保留未知，暫不計算 TTM。</p></section>';
}
async function fetchRevenue(){
 try{
  const res=await fetch('./data/revenue.json?v='+Date.now(),{cache:'no-store'});if(!res.ok)throw Error();
  const data=await res.json();if(data.schema_version!==1||!data.profiles||Array.isArray(data.profiles))throw Error();
  for(const [symbol,p] of Object.entries(data.profiles))if(!/^\d{4}\.TW$/.test(symbol)||!Array.isArray(p.records)||!Array.isArray(p.missing_months)||p.records.some(r=>!/^\d{4}-\d{2}$/.test(r.period)||!(r.amount_twd===null||Number.isSafeInteger(r.amount_twd))))throw Error();
  revenueData=data;revenueError=false;
 }catch{revenueError=true}
 if(typeof renderDetail==='function')renderDetail();
}
