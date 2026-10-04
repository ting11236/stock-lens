'use strict';
const CATS=[
 {id:'週期股',metric:'pb',abbr:'PB',sub:'（依產業初分：鋼鐵、塑化、航運等；生意易受景氣與報價影響）',why:'景氣谷底 EPS 可能接近零或轉負，PE 容易失真；PB 需配合歷史分位、供需、產能出清與資產減損。'},
 {id:'重資產股',metric:'pb',abbr:'PB',sub:'（本站依金融產業分類：銀行、保險、證券等）',why:'淨資產與資產品質是重要的分析起點，但帳面淨值不保證是股價底線；需同看 ROE、呆帳、資本適足率與負債。'},
 {id:'虧損企業',metric:'ps',abbr:'PS',sub:'（含新創、生技及其他虧損或尚未獲利企業）',why:'依最新已公布的當年度累計 EPS 為零或負數分類，包含新創、生技與後來轉虧的其他企業；是否正在轉型需看公司資料。金融與週期產業優先保留其分類，因此這不是全市場所有虧損公司的清單。以營收評價時仍須看毛利率、成長、現金消耗與轉盈可能性。'},
 {id:'高成長股',metric:'peg',abbr:'PEG',sub:'（累計 EPS 為正、單月營收年增 ≥20%；半導體／雲端／資訊等）',why:'初步篩選標準為當年度累計 EPS > 0、單月營收年增率 ≥ 20%，且產業包含半導體、雲端、資訊服務或軟體。這裡的高成長依單月營收判斷，尚未證明盈餘長期持續成長；PEG 仍需另外確認 EPS 成長資料。'},
 {id:'穩定獲利股',metric:'pe',abbr:'PE',sub:'（累計 EPS 為正，且未歸入其他分類）',why:'目前僅依當年度累計 EPS > 0，且未歸入金融、週期、虧損或高成長類別而暫時歸類；尚未驗證連續多年獲利穩定。PE 不設通用便宜／昂貴門檻，仍須比較歷史、同業、成長及資本報酬。'}
];

const $=id=>document.getElementById(id);const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
const fnum=(v,d=2)=>finite(v)===null?'—':Number(v).toLocaleString('zh-TW',{maximumFractionDigits:d,minimumFractionDigits:d});
const ratio=v=>finite(v)===null?'—':fnum(v)+'x';
const pct=v=>finite(v)===null?'—':fnum(v,1)+'%';
const catMeta=s=>CATS.find(c=>c.id===s.category)||{id:'待分類',metric:null,abbr:'—',sub:'資料不足',why:'缺少足夠產業／財報資料，請自行設定分類。'};
const normalized=raw=>{let s=String(raw||'').trim().toUpperCase();if(/^\d{4}$/.test(s))s+='.TW';return s};
const valueOk=(v,key)=>{const x=finite(v);return x!==null&&x>0?x:null};
const primary=s=>{const k=catMeta(s).metric;return k?valueOk(s[k],k):null};

function rawInterpretation(s){const meta=catMeta(s),v=primary(s);if(!meta.metric)return{title:'需要手動分類',tone:'neutral',tip:'尚未能確認此公司適用哪一項主指標。',long:'請確認產業、獲利與成長特性後，選擇合適分類。',pos:50};if(meta.id==='虧損企業'&&/(clinical|pre.revenue|drug discovery|biotech|新藥研發|臨床前|臨床試驗)/.test((s.industry||'').toLowerCase())&&finite(s.revenue_growth)===null&&finite(s.gross_margin)===null)return{title:'研發生技：PS 參考性低',tone:'neutral',tip:'尚未確認可比較的產品營收',long:'對於尚未確認產品銷售的研發生技公司，PS 通常缺乏可比性；應另查臨床里程碑、現金水位、現金消耗與授權收入。',pos:50};if(v===null)return{title:'無法判讀',tone:'neutral',tip:`${meta.abbr} 缺值或不適用`,long:`目前缺少有效的 ${meta.abbr} 正數資料；保留原始資料，請從來源頁確認。${meta.metric==='peg'?' PEG 在 EPS 為負、成長率非正或計算期間不一致時尤其容易失真。':''}`,pos:50};
 if(meta.id==='高成長股'){
  let r=v<.5?['極低 PEG／市場可能有疑慮','caution','先核對增長率與獲利品質；低值不代表必然低估','成長速度相對 PE 很高，也可能反映市場不認同預測。應核對 G 的計算口徑、成長能否持續及獲利品質。',10]:v<1?['成長與估值相對平衡區','positive','確認 G 後，再比較歷史與同業','在這套研究規則中屬相對具吸引力的區間；仍須確認成長率可靠性與估值口徑。',27]:v<1.5?['股價相對成長較高；確認成長能持續','neutral','關注競爭優勢與成長持續性','較高的確定性可能支持成長溢價，但應與歷史 PEG 及同業比較。',45]:v<=2?['股價相對成長偏高；需再比較','caution','1.5–2.0：原規則未設明確區間','PE 相對成長率偏高；原始區間對 1.5–2.0 未給定硬性結論，建議檢查預期修正風險。',65]:['未來成長預期較高','risk','PEG > 2：須注意成長不及預期的風險','若市場給予的定價需要多年高成長才能支撐，EPS 或成長預期下修可能伴隨估值收縮；不能由 PEG 單獨推斷跌幅。',90];if(!['annual','cagr3','cagr5'].includes(s.field_meta?.peg?.period_mode)&&finite(s.trailing_eps)!==null&&s.trailing_eps<=0)return{title:'PEG 不適用：EPS 非正',tone:'neutral',tip:'即使來源提供 PEG，仍需確認預估盈餘口徑',long:'當期 EPS 為零或負數，傳統 PE／PEG 不具可比性；先釐清來源是否使用預估轉盈。',pos:50};return{title:r[0],tone:r[1],tip:r[2],long:r[3],pos:r[4],extra:s.peg_basis||'請確認 PEG 採用歷史或預估 PE／成長率'}
 }
 if(meta.id==='重資產股'){
  let r=v<.7?['股價遠低於淨值；先確認資產是否可靠','risk','低 PB 須查呆帳、負債與淨值品質','市場可能質疑資產可回收價值、資本適足率或長期 ROE；折價不等於有安全底線。',10]:v<1?['股價低於帳面淨值；仍要看公司能否持續賺錢','caution','0.7–1.0：確認 ROE／配息持續性','在這套規則中接近傳統金融估值的折價區；需核對資產品質、資本結構及經常性獲利。',32]:v<=1.5?['股價高於淨值；看賺錢能力是否值得這個價格','positive','1.0–1.5：搭配持續 ROE 觀察','較高 PB 往往需要穩定的資本報酬支撐；可檢查 ROE 是否接近 10%–15%。',53]:v<=2?['股價比淨值高不少；需有更好獲利支持','caution','1.5–2.0：原規則未設定明確結論','需要更高或更持久的 ROE、資產品質與市場地位來支持溢價。',73]:['股價超過帳面淨值兩倍；要確認高獲利能持續','risk','PB > 2：查驗高 ROE 能否持續','高於 2 倍 PB 須檢查是否有持久的超額 ROE、低資本需求或特定會計因素。',92];return{title:r[0],tone:r[1],tip:r[2],long:r[3],pos:r[4]}
 }
 if(meta.id==='週期股'){
  let r=v<.8?['股價低於帳面淨值；可能景氣差，也可能公司出了問題','caution','PB < 0.8：確認資產與景氣是否見底','可能反映景氣低迷，也可能是結構性需求下滑、淨值減損或資金壓力；不能單憑破淨判斷底部。',10]:v<1.2?['股價接近帳面淨值；景氣有沒有好轉還要查證','positive','0.8–1.2：觀察報價是否止跌','供需與產品報價若改善，才可能支持復甦推論；仍應對照歷史 PB。',32]:v<1.5?['股價高於淨值；確認生意是否真的變好','neutral','1.2–1.5：原規則的銜接區','由中低 PB 往較高水準移動，應核對產品報價、庫存、產能利用率及歷史估值分位。',49]:v<=2.5?['股價已反映較多期待；要看好景氣能維持多久','caution','1.5–2.5：須辨識當期獲利是否過熱','產品漲價與利潤擴張可能推升 PB；特別注意 PE 因週期高點獲利而變得很低。',66]:v<=3?['股價相對淨值較高；留意景氣轉差','risk','2.5–3.0：留意週期回落風險','接近這套規則的極端區間，需查供需擴產、報價及 ROE 是否難以維持。',83]:['股價超過淨值三倍；要確認是否把好景氣想得太久','risk','PB > 3：警惕低 PE 的景氣高峰陷阱','PB 極高且當期 PE 極低，可能意味獲利處於週期高峰；須與歷史估值及產能週期交叉檢驗。',94];return{title:r[0],tone:r[1],tip:r[2],long:r[3],pos:r[4]}
 }
 if(meta.id==='虧損企業'){
  const gm=finite(s.gross_margin),industry=(s.industry||'').toLowerCase();const preRevenue=/(clinical|pre.revenue|drug discovery|biotech|新藥研發|臨床前|臨床試驗)/.test(industry)&&finite(s.revenue_growth)===null&&gm===null;
  if(preRevenue)return{title:'研發型生技：PS 參考性低',tone:'neutral',tip:'尚未確認產品營收',long:'產品尚未商業化時，PS 可能因營收基期太低而失真；應優先觀察臨床與監管里程碑、現金水位及燒錢速度。',pos:50};
  if(gm===null)return{title:'待確認毛利率',tone:'neutral',tip:`PS ${ratio(v)}；需先判斷低毛利或高毛利`,long:'PS 同一數值對電商／物流與 SaaS 意義不同；目前缺少毛利率，先不要套用兩套門檻。',pos:50};
  if(gm>30&&gm<50)return{title:'中間毛利：不套用兩極門檻',tone:'neutral',tip:`毛利率 ${pct(gm)}；兩類規則都不完全適用`,long:'本規則以 ≤30% 作低毛利、≥50% 作高毛利的示意分流；中間毛利率需參照同業淨利潛力。',pos:50};
  const high=gm>=50;
  let r;if(high){r=v<2?['異常低 PS／查明原因','caution','高毛利 PS < 2：留意需求與營收品質','高毛利企業卻以極低 PS 定價，可能反映成長停滯、客戶流失、現金壓力或一次性收入。',10]:v<5?['高毛利相對低 PS 區','positive','PS 2–5：配合營收增長與留存率','若毛利高且營收持續擴張，這套規則視為較有比較價值的區間；仍須檢查 吸引新客戶的成本（CAC）、客戶是否持續購買，以及公司花掉多少現金。',30]:v<=10?['高毛利擴張估值區','neutral','PS 5–10：成長率須支撐定價','高毛利軟體公司可能在此區間，但仍取決於收入成長、獲利路徑與利率環境。',58]:v<=15?['較高 PS／過渡區','caution','PS 10–15：原規則未設硬性區間','需特別檢驗營收成長、客戶是否續約、每筆生意扣除相關成本後是否賺錢，以及何時可能停止虧損。',76]:['高毛利極高 PS 區','risk','PS > 15：須有很高成長與護城河支撐','高 PS 对成長預測和資金成本敏感，營收放緩可能引發估值壓縮。',94]}else{r=v<2?['低毛利相對可比較區','neutral','PS < 2：仍要看最終淨利率','薄毛利模式長期可產生的淨利有限，應核對營收品質、規模經濟、現金流與負債。',12]:v<3?['低毛利估值偏高','caution','PS 2–3：需要規模與獲利改善','毛利偏薄的公司若 PS 提高，需要更強的營收成長或營運效率支持。',36]:v<5?['低毛利明顯偏高','risk','PS 3–5：確認是否有結構性轉型','以低毛利模式而言，較高 PS 對長期獲利能力的要求很高。',60]:v<=10?['低毛利高風險 PS 區','risk','PS 5–10：高度依賴獲利模式改善','若毛利及淨利率沒有結構性提升，高 PS 可能較難由最終盈餘支撐。',78]:v<=15?['低毛利極高 PS 區','risk','PS 10–15：顯著高於本規則常態','必須驗證營收成長、現金流與轉型可行性。',87]:['低毛利極端 PS 區','risk','PS > 15：風險與預期均極高','低毛利公司承受高 PS，需要極不尋常的可持續增長或商業模式改善。',95]};return{title:r[0],tone:r[1],tip:r[2],long:r[3],pos:r[4],extra:`毛利率 ${pct(gm)}｜依${high?'高':'低'}毛利規則`}
 }
 return{title:'PE：務必和同類型企業，或這家公司過往的 PE 數值比較',tone:'neutral',tip:'先比較相似同業與公司過去的 PE',long:'PE 務必要和主要業務相近的同類股票比較，再看公司過去的 PE。股價相對獲利倍數較低，可能比較便宜，也可能是獲利將下降；較高則可能反映成長期待。還要確認獲利能否持續、負債與成長差異。',pos:50};
}

function interpretation(s){
 const result=rawInterpretation(s),cat=catMeta(s),v=primary(s);
 if(v!==null){let question='';if(cat.metric==='pb')question=v<1?'（便宜？）':v>1?'（貴？）':'';else if(cat.metric==='peg')question=v<1?'（便宜？）':v>1?'（貴？）':'';else if(cat.metric==='ps')question=/低 PS|PS 偏低/.test(result.title)?'（便宜？）':/高 PS|偏高|極端 PS/.test(result.title)?'（貴？）':'';if(question)result.title+=question;}
 return result;
}
function industryPeReference(stock){
 const date=stock.field_meta?.pe?.date;
 if(!stock.industry||!date)return null;
 const values=state.stocks.filter(p=>p.industry===stock.industry&&p.field_meta?.pe?.date===date&&finite(p.pe)>0).map(p=>Number(p.pe)).sort((a,b)=>a-b);
 if(values.length<5)return null;
 const quantile=q=>{const i=(values.length-1)*q,lower=Math.floor(i);return values[lower]+(values[Math.ceil(i)]-values[lower])*(i-lower);};
 return {count:values.length,date,median:quantile(.5),low:quantile(.25),high:quantile(.75),min:values[0],max:values[values.length-1]};
}
function industryPeHtml(stock){return '<div class="rule-hint peer-pe-reference"><p><b>'+metricHelpLink('pe','PE 本益比：'+(finite(stock.pe)!==null?fnum(stock.pe)+' 倍':'—'),stock.pe)+'</b><small>（務必和主要業務相近的同類股票比較）</small></p><button type="button" class="button" data-peer-pe="'+esc(stock.symbol)+'" aria-haspopup="dialog">同類企業本益比 →</button></div>';}
function industryPeDetailHtml(stock){
 const peers=industryPeReference(stock);
 return (catMeta(stock).metric==='ps'?'<p>依本站分類，這家公司優先參考 PS；這裡仍列出同類股票的 PE 區間，供你比較參考。</p>':'')+(peers?'<p>企業類別：<span class="peer-pe-key">'+esc(stock.industry)+'</span><br>資料日期：'+esc(peers.date)+'<br>有 '+peers.count+' 家公司提供正值官方 PE。</p><p><span class="peer-pe-key">同類本益比中位數：約 '+fnum(peers.median,1)+' 倍</span><br>全部正值 PE：最低 '+fnum(peers.min,1)+' 倍；最高 '+fnum(peers.max,1)+' 倍</p><p>中位數是把全部本益比由低到高排列後，取中間位置的數字；公司家數為偶數時，取中間兩個數字的平均。中位數可以當比較起點，接著還要看相近公司的成長、獲利、負債，以及公司自己過去的 PE。同業中位數、平均值、個別相似公司和自身歷史，都是可用的比較基準。低於中位數表示本益比相對偏低，可能比較便宜，也可能公司面臨問題；高於中位數表示相對偏高，也可能市場預期成長較快。</p>':'<p>目前同產業、同日期的正值官方 PE 不足 5 家；可搜尋產業名稱，逐家公司比較。</p>');
}
function openPeerPe(symbol){const stock=state.stocks.map(materialize).find(s=>s.symbol===symbol);if(!stock)return;$('peerPeTitle').textContent=stock.name+'（'+symbol.slice(0,-3)+'）同類企業本益比';$('peerPeBody').innerHTML=industryPeDetailHtml(stock);$('peerPePopover').showPopover();}

function tvUrl(s){let sym=s.symbol;if(sym.endsWith('.TW'))return'https://www.tradingview.com/chart/?symbol='+encodeURIComponent('TWSE:'+sym.slice(0,-3));if(sym.endsWith('.TWO'))return'https://www.tradingview.com/chart/?symbol='+encodeURIComponent('TPEX:'+sym.slice(0,-4));let ex=/NMS|NAS|NGM|NCM/i.test(s.exchange||'')?'NASDAQ:':/NYQ|NYS/i.test(s.exchange||'')?'NYSE:':'';return'https://www.tradingview.com/chart/?symbol='+encodeURIComponent(ex+sym)}

const RULE_SECTIONS=[
 {id:'高成長股',rows:[['< 0.5','股價相對成長看起來低；先確認成長數字是否太樂觀','G 指每股盈餘的成長率；先確認成長來自持續的生意，而非去年賺太少或一次性收入。'],['0.5–1.0','若盈餘成長可靠，股價相對成長較低；可再研究','確認每股盈餘真的增加、比較的是相同期間，並看公司為何能繼續賺錢。'],['1.0–1.5','股價相對成長較高；要看成長能否持續','若公司能持續增加每股盈餘，市場可能願意付較高股價；要確認成長真的能持續。'],['1.5–2.0','單靠這個數字，還看不出是否划算','檢查實際成長是否符合預期，並比較歷史與同業。'],['> 2.0','股價相對成長偏高；成長不如預期時要留意風險','對業績不如預期較敏感；非必然下跌。']],note:'PEG = PE ÷ EPS 成長率（使用百分點，例如 30% 輸入 30）；各網站的歷史／預估口徑不同。'},
 {id:'重資產股',rows:[['< 0.7','股價遠低於帳面淨值；可能便宜，也可能資產有問題','確認貸出去的錢能否收回、帳面資產是否要認列損失，以及負債和自有資金是否足夠。'],['0.7–1.0','股價低於帳面淨值；要先確認資產與獲利可靠','看公司用股東資金賺錢的效率（ROE）、資產是否可靠，以及是否能持續發股息。'],['1.0–1.5','股價高於帳面淨值；要看賺錢能力是否值得這個價格','看公司每 100 元股東資金能賺多少錢（ROE），並比較同業與過去表現；不是到某個百分比就一定值得買。'],['1.5–2.0','股價比帳面淨值高不少；需要更好的獲利支撐','市場付的價格較高，要確認公司的賺錢效率與資產品質真的比同業好。'],['> 2.0','股價超過帳面淨值兩倍；要確認高獲利能持續','看公司的賺錢效率是否長期高於同業，並確認財報的淨值計算方式是否可比較。']],note:'金融與保險的會計淨值、資本結構及槓桿各不相同；PB 低於 1 倍表示股價低於帳面每股淨值，但帳面資產仍可能縮水，買入後也可能虧錢。'},
 {id:'週期股',rows:[['< 0.8','股價低於帳面淨值；可能景氣差，也可能公司出了問題','確認產品是否長期賣不動、帳面資產是否縮水，以及手上資金是否足以還債。'],['0.8–1.2','股價接近帳面淨值；景氣有沒有好轉還要查證','看產品售價有沒有回升、客戶需求有沒有增加，以及工廠是否有更多訂單可做。'],['1.2–1.5','股價高於帳面淨值；單靠倍數看不出景氣是否復甦','比較過去與同業倍數，再確認報價、訂單和獲利有沒有改善。'],['1.5–2.5','股價已反映較多期待；要看好景氣能維持多久','景氣好時公司賺很多，會讓本益比（PE）變低；若日後賺得少，就不一定是股價便宜。'],['2.5–3.0','股價相對淨值較高；景氣轉差時要更留意','如果同業都擴廠、產品變多，但客戶需求沒跟上，售價和獲利可能下降。'],['> 3.0','股價超過淨值三倍；要確認是否把好景氣想得太久','公司現在賺很多會讓 PE 很低；若景氣轉差、獲利下降，就未必便宜。']],note:'塑化、鋼鐵、航運、水泥、造紙、面板、礦業、油氣與部分機械均可列入研究；PB 還要與公司過去的倍數比較，確認目前處在較低或較高的位置。'},
 {id:'虧損企業',rows:[['< 2','利潤薄的公司仍要看能否賺錢；高毛利公司則要查為何倍數低','PS 低表示市場給每 1 元營收的價格較低；可能股價較便宜，也可能產品賣不好或手上現金不夠。'],['2–5','利潤薄的公司較難支撐；高毛利公司可再看成長與轉盈機會','毛利高的公司也要確認營收持續增加、客戶繼續買，以及扣完費用後何時能真正賺錢。'],['5–10','利潤薄的公司要求較高；高毛利公司也需要成長來支撐','市場付的價格較高，要確認營收增加後，扣除成本能留下更多錢，而非只有生意做大。'],['10–15','市場給營收的價格較高；要看多久能轉成獲利','比較同業，確認毛利、營收成長與轉盈進度，不能只用倍數下結論。'],['> 15','市場給每元營收很高的價格；成長放慢時風險較大','這個價格需要公司未來持續增加收入並賺到錢；若做不到，股價可能承受壓力。']],note:'這版示意分流：毛利率 ≤30% 視為低毛利；≥50% 視為高毛利；30%–50% 不硬套。新藥研發若尚未有產品營收，PS 通常不適用。'},
 {id:'穩定獲利股',rows:[['PE（原始值）','沒有各家公司通用的便宜倍數；需比較歷史與同業','依公司自身歷史 PE、同業、成長、利率與 ROE 比較。'],['PE ≤ 0 或缺漏','不適用','虧損、盈餘異常或資料不足時，不以 PE 評估。']],note:'穩定獲利公司的合理 PE 受成長、風險與利率影響，這裡不設定通用的買進或賣出倍數。'}
];
const VALUATION_GUIDE={
 '週期股':{metric:'PB 股價淨值比（參考起點）',why:'收入與獲利會隨景氣大幅波動，先把股價與帳面淨值比較，再看景氣位置。',also:'產品報價、供需、產能利用率、資產減損，以及正常景氣時能賺多少錢。',note:'PB 也不是所有週期公司的最佳方法；可以搭配正常景氣獲利計算的 PE。景氣高峰時公司賺特別多，PE 可能很低，這時仍可能有景氣回落風險。'},
 '重資產股':{metric:'PB 股價淨值比＋ROE 股東權益報酬率',why:'本站這類主要是金融公司。除了看股價相對淨值多少倍，也要看公司能用股東資金賺多少錢。',also:'呆帳與資產品質、資本是否充足、槓桿與獲利持續性。',note:'製造業、電廠等其他重資產公司不一定優先用 PB；也要看負債與現金流。低於帳面淨值時，先確認帳面資產是否仍有價值。'},
 '虧損企業':{metric:'PS 股價營收比（有實際營收時）',why:'公司尚未有正的盈餘，PE 通常無法合理比較；可先看市場用多少市值評價每 1 元營收。',also:'毛利率、營收成長、每月燒多少現金、手上現金能撐多久，以及何時可能轉盈。',note:'沒有產品營收的研發型生技公司，PS 也可能算不出或沒有意義；要看研發進度與現金。不同利潤率的公司不能只比較 PS 倍數。'},
 '高成長股':{metric:'PEG 本益成長比（盈餘成長資料可靠時）',why:'一起比較本益比與每股盈餘的成長速度，幫助理解成長預期與股價的關係。',also:'成長來自什麼、是否能持續、估計是否可靠、ROE 與現金流。',note:'成長要用 EPS，不能把營收成長直接放進 PEG。本站分類先用單月營收篩選；PEG 則用每股盈餘成長。優先使用 5 年或 3 年 EPS 複合成長率（CAGR）；不夠時使用最近四季或一年的歷史比較，並標明期間。PEG 低於 1 也不能直接判斷便宜。'},
 '穩定獲利股':{metric:'PE 本益比（獲利正常且可持續時）',why:'以股價相對每股盈餘多少倍，與公司的歷史及相似同業比較。',also:'本業是否持續賺錢、現金流、ROE、負債，以及一次性的投資收益或賣資產利益。',note:'同樣 PE 倍數，成長與風險不同，評價也可能不同。先確認多年獲利品質，不能只因今年 EPS 是正數就認定穩定。'}
};
function classificationExplanation(cat){
 if(cat.id==='週期股')return '<p><strong>景氣好時可能賺得多，景氣差或產品跌價時，獲利可能明顯減少的公司。</strong></p><p>本站先依產業名稱分類：塑膠／塑化、鋼鐵、水泥、造紙、航運、面板、油電、化學、玻璃與橡膠。這是初步分組，還沒逐家公司驗證多年獲利的起伏。</p><p>重點是需求、供需與報價對獲利的影響，不只看是不是重工業。金融公司也可能受景氣影響，但本站會優先放在重資產股。</p>';
 if(cat.id==='重資產股')return '<p><strong>本站這一欄主要是銀行、保險、證券等金融公司。</strong></p><p>產業名稱含金融、保險、銀行或證券，就優先分到這裡；不是用廠房大小或資產金額篩選。看這類公司時，要一起比較帳面淨值、賺錢能力與資產品質。</p><p>大型工廠、電廠也可能需要投入很多資產，但不會只因為資產多，就自動分到本站這一欄。</p>';
 if(cat.id!=='高成長股')return '<p>'+esc(cat.why)+'</p>';
 return '<p><strong>今年目前有獲利，而且最近一個月的營收，比去年同月至少多兩成的科技相關公司。</strong></p><p>網站先用下面三個條件，挑出近期營收成長比較快的公司：</p><ul><li><strong>今年目前有賺錢：</strong>最新公布的財報中，從年初算到該季的每股盈餘（EPS）大於零。</li><li><strong>最近收入成長快：</strong>最新一個月的營收，比去年同一個月至少增加 20%（兩成）。</li><li><strong>屬於科技相關產業：</strong>半導體、雲端、資訊服務或軟體。</li></ul><p>接下來還要看這樣的成長能否持續、獲利是否也增加。<strong>這是初步篩選，還不能保證公司未來會一直高成長。</strong></p>';
}
function renderRules(){
 for(const key of ['pe','pb','ps','peg'])$('metric-rules-'+key).innerHTML=RULE_SECTIONS.filter(section=>CATS.find(c=>c.id===section.id)?.metric===key).map(section=>{const cat=CATS.find(c=>c.id===section.id),guide=VALUATION_GUIDE[section.id];return `<article class="integrated-category"><h4>${esc(section.id)}</h4><p class="tiny">${esc(cat.sub)}</p><div class="priority-metric"><span>★ 這類公司先看什麼？</span><strong>${linkedMetricPhrase(guide.metric)}</strong></div><p>${esc(guide.why)}</p><p><b>還要一起看：</b>${esc(guide.also)}</p><div class="rule-hint"><b>判讀重點：</b>${esc(guide.note)}</div><details><summary>${section.id==='高成長股'?'為什麼被分到高成長股？':'本站如何自動分到這一類？'}</summary>${classificationExplanation(cat)}</details><details><summary>倍數區間：數字低或高，怎麼看？（學習參考）</summary><p><strong>這裡的數字是估值倍數。數字低，可能代表股價相對公司的獲利、淨值或營收比較便宜，但也可能是公司出了問題。數字高，可能代表股價相對這些財務數字比較貴，但也可能是市場認為公司未來會賺更多錢。</strong>以下只是學習用的示例區間，不是判定股票好壞或買賣的通用標準。還要比較同業、公司過去的倍數，以及獲利能不能持續。</p><div class="rule-table-wrap" tabindex="0" aria-label="估值倍數學習表，可左右捲動"><table><thead><tr><th>區間</th><th>白話解讀：可能代表什麼？</th><th>判斷前還要看什麼？</th></tr></thead><tbody>${section.rows.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</tbody></table></div><div class="rule-hint">${esc(section.note)}</div></details></article>`}).join('');
}

function csvParse(text){text=String(text).replace(/^\ufeff/,'');let rows=[],row=[],val='',quoted=false;for(let i=0;i<text.length;i++){let c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){val+='"';i++}else quoted=!quoted}else if(c===','&&!quoted){row.push(val);val=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(val);if(row.some(x=>x.trim()!==''))rows.push(row);row=[];val=''}else val+=c}if(quoted)throw Error('CSV 引號未封閉');row.push(val);if(row.some(x=>x.trim()!==''))rows.push(row);return rows}

// Market snapshots and browser-owned preferences are deliberately stored separately.
const KEY='stock_lens_preferences_v2';
function normalizeCategory(value){return value==='前期虧損企業'?'虧損企業':value}
function readPreferences(storage){
 try{const saved=JSON.parse(storage.getItem(KEY)||'null');if(saved&&Array.isArray(saved.watchlist))return {...saved,overrides:Object.fromEntries(Object.entries(saved.overrides||{}).map(([key,value])=>[key,normalizeCategory(value)]))};
 const legacy=JSON.parse(storage.getItem('stock_lens_web_v1')||'{}');
 // Legacy watchlist was also populated by cloud refreshes; it is not a record
 // of stocks explicitly chosen by the visitor. Only migrate classifications.
 return {watchlist:[],overrides:Object.fromEntries(Object.entries(legacy.overrides||{}).filter(([,v])=>CATS.some(c=>c.id===normalizeCategory(v.category))||v.category==='待分類').map(([k,v])=>[k,normalizeCategory(v.category)]))};
 }catch{return {watchlist:[],overrides:{}}}
}
const preferences=(()=>{try{return readPreferences(window.localStorage)}catch{return {watchlist:[],overrides:{}}}})();
const state={stocks:[],watchlist:[...new Set(preferences.watchlist.filter(s=>/^\d{4}\.TW$/.test(s)))],overrides:preferences.overrides||{},tab:'all',filter:'全部',search:'',sort:'symbol',selected:null,page:1,size:50,busy:false,payload:null,status:null,priceMin:null,priceMax:null,metricMin:null,metricMax:null,researchFilter:'all'};
function persist(){try{localStorage.setItem(KEY,JSON.stringify({watchlist:state.watchlist,overrides:state.overrides}));return true}catch{showNotice('瀏覽器無法儲存設定。此次修改仍可使用；請匯出 CSV 備份。','error');return false}}
const METRIC_NAMES={pe:'PE 本益比',pb:'PB 股價淨值比',ps:'PS 股價營收比',peg:'PEG 本益成長比'};
function metricName(abbr){return METRIC_NAMES[String(abbr).toLowerCase()]||abbr}
let glossaryReturn={tab:'all',page:1};
function metricHelpLink(key,text,value=null){return '<a class="metric-help-link" href="#glossary-'+esc(key)+'" data-metric-help="'+esc(key)+'"'+(finite(value)!==null?' data-metric-value="'+esc(value)+'"':'')+' title="查看 '+esc(metricName(key.toUpperCase()))+' 的白話說明">'+esc(text)+'</a>';}
let metricHelpKey=null;
function metricValueExplanation(key,value){
 const v=finite(value);if(v===null)return '';
 const n=fnum(v),compare='務必和主要業務相近的公司比較，也可看這家公司過去的同一指標。';
 if(key==='pb')return v<=0?'PB 約 '+n+' 倍：淨值或資料狀況需要先確認，暫不判斷便宜或貴。':'PB 約 '+n+' 倍：'+(v<1?'股價低於每股帳面淨值，可能比較便宜，也可能是資產價值縮水或獲利能力差。':v>1?'股價高於每股帳面淨值，可能比較貴，也可能是公司賺錢能力較強。':'股價約等於每股帳面淨值。')+'一般來說，低於 1 倍是低於淨值，高於 1 倍是高於淨值。'+compare;
 if(key==='pe')return v<=0?'PE 為 '+n+'：盈餘或資料狀況需要先確認。':'PE 約 '+n+' 倍：市場用約 '+n+' 元股價評價每 1 元年度每股盈餘。倍數較低可能較便宜，也可能反映獲利將下降；較高可能較貴，也可能反映成長期待。'+compare;
 if(key==='ps')return v<0?'PS 資料需要確認。':'PS 約 '+n+' 倍：市場用約 '+n+' 元市值評價公司每 1 元年度營收。低倍數可能較便宜，也可能是利潤薄或持續虧損；高倍數可能反映成長期待。要和利潤率相近的公司比較，PS 沒有通用的便宜／貴門檻。';
 if(key==='peg')return v<=0?'PEG 的盈餘成長資料需要先確認，暫不判斷便宜或貴。':'PEG 約 '+n+'：'+(v<1?'低於 1，常作為股價相對盈餘成長較便宜的觀察起點。':v>1?'高於 1，表示本益比高於所用的盈餘成長百分點，需有更持續的成長支持。':'接近 1，表示本益比與盈餘成長的百分點接近。')+'1 只是常見參考起點；還要確認成長期間、基期及成長能否持續。';
 if(key==='eps')return 'EPS 約 '+n+' 元／股：'+(v>0?'這段期間每股有獲利。':v<0?'這段期間每股虧損約 '+fnum(-v)+' 元。':'這段期間每股損益約為零。')+'比較時要使用相同期間，例如全年對全年、最近四季對最近四季。';
 if(key==='roe')return 'ROE 約 '+n+'%：'+(v>=0?'這段期間每 100 元平均股東權益，帶來約 '+n+' 元淨利。':'這段期間每 100 元平均股東權益，產生約 '+fnum(-v)+' 元虧損。')+'較高通常表示資金運用效率較好，也需一起看負債及一次性收益。';
 return '';
}
function openMetricHelp(key,value=null){
 const item=$('glossary-'+key);if(!item)return;
 metricHelpKey=key;
 $('metricHelpTitle').textContent=item.querySelector('dt')?.textContent||metricName(key.toUpperCase());
 $('metricHelpText').textContent=item.querySelector('dd > p')?.textContent||'';
 $('metricHelpValue').textContent=metricValueExplanation(key,value);$('metricHelpValue').hidden=!$('metricHelpValue').textContent;
 $('metricHelpPopover').showPopover();
}
function showFullMetricHelp(){
 const key=metricHelpKey;if(!key)return;
 $('metricHelpPopover').hidePopover();
 if($('researchDialog')?.open)$('researchDialog').close();
 if(state.tab!=='rules')glossaryReturn={tab:state.tab==='watchlist'?'watchlist':'all',page:state.page};
 setTab('rules');const target=$('glossary-'+key);target?.scrollIntoView({behavior:'smooth',block:'start'});target?.focus({preventScroll:true});
}
function wireMetricHelp(){document.querySelectorAll('[data-peer-pe]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();openPeerPe(b.dataset.peerPe)});document.querySelectorAll('[data-metric-help]').forEach(link=>link.onclick=e=>{e.preventDefault();e.stopPropagation();openMetricHelp(link.dataset.metricHelp,link.dataset.metricValue);});}
function linkedMetricPhrase(text){return esc(text).replace(/\b(PEG|PE|PB|PS|ROE|EPS|TTM)\b/g,abbr=>metricHelpLink(abbr.toLowerCase(),abbr));}
function statHelpKey(key){return ({calculated_pe:'pe',trailing_eps:'eps',gross_margin:'margin',dividend_yield:'margin'})[key]||(['pe','pb','ps','peg','eps','roe','trailing_sales'].includes(key)?key:null);}
function metricColumnOrder(category){const keys=['pe','pb','ps','peg'],first=CATS.find(c=>c.id===category)?.metric;return first?[first,...keys.filter(k=>k!==first)]:keys;}
function materialize(s){
 const result={...s,field_meta:{...s.field_meta},category:normalizeCategory(state.overrides[s.symbol]||s.category)||'待分類'};
 const profile=research.profiles[s.symbol],metrics=profile?.calculated_metrics||{};
 for(const [key,m] of Object.entries(metrics)){
  if((!Number.isFinite(m.value)&&!(['peg','earnings_growth'].includes(key)&&(['annual','cagr3','cagr5'].includes(m.period_mode))&&finite(result[key])===null))||(finite(result[key])!==null&&key!=='calculated_pe'&&!(['peg','earnings_growth'].includes(key)&&/^cagr[35]$/.test(m.period_mode||''))))continue;
  result[key]=m.value;
  result.field_meta[key]={date:m.period,basis:'依匯入財報計算；'+m.formula,source:profile.overview?.source_filename||'使用者提供工作簿',downloaded_at:profile.overview?.imported_at,reason:m.reason,comparison_period:m.comparison_period,price_date:m.price_date,shares_date:m.shares_date,shares_source:m.shares_source,period_mode:m.period_mode,eps_used:m.eps_used,pe_used:m.pe_used};
  if(key==='peg')result.peg_basis=/^cagr[35]$/.test(m.period_mode||'')?m.comparison_period.slice(0,4)+' → '+m.period.slice(0,4)+' 年，'+m.period_mode.slice(-1)+' 年 EPS 複合成長率（CAGR）；股價日期 '+(m.price_date||'未提供'):m.period_mode==='annual'?m.period.slice(0,4)+' 年全年 EPS 與前一年相比；股價日期 '+(m.price_date||'未提供'):'最近四季 EPS 與去年同期相比';
 }
 return result;
}
function showNotice(message,type='warn'){$('notice').textContent=message;$('notice').className='notice '+type}
function toggleWatch(symbol){state.watchlist=state.watchlist.includes(symbol)?state.watchlist.filter(x=>x!==symbol):[...state.watchlist,symbol];persist();render()}
function setTab(tab){state.tab=tab;state.page=1;document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('selected',b.dataset.tab===tab);b.setAttribute('aria-selected',String(b.dataset.tab===tab))});$('dashboard').hidden=!['all','watchlist'].includes(tab);$('rules').hidden=tab!=='rules';$('sources').hidden=tab!=='sources';if(tab==='rules')renderRules();render()}
const TOPIC_SYNONYMS=[['矽光子','硅光子','siph','silicon photonics'],['人工智慧','人工智能','ai'],['共同封裝光學','共封裝光學','cpo']];
const searchCache=new WeakMap();
function normalizeSearch(value){return String(value||'').normalize('NFKC').toLowerCase()}
function queryGroups(query){const normalized=normalizeSearch(query).trim().replace(/silicon\s+photonics/g,'siph');const whole=TOPIC_SYNONYMS.find(g=>g.includes(normalized));return whole?[whole]:[...new Map(normalized.split(/[\s,，、;；]+/).filter(Boolean).map(term=>{const g=TOPIC_SYNONYMS.find(g=>g.includes(term))||[term];return [g[0],g]})).values()]}
function researchSearchEntries(profile){
 if(!profile)return [];
 if(searchCache.has(profile))return searchCache.get(profile);
 const o=profile.overview,entries=[];
 const add=(label,text)=>{if(text)entries.push({label,text:String(text),normalized:normalizeSearch(text)})};
 if(o){add('公司業務',o.business);add('發展方向',o.direction);add('獲利來源',o.profit_mechanism);for(const x of o.outlooks||[])add('財測與展望',[x.type,x.scope,x.limitations].filter(Boolean).join('；'));for(const x of o.events||[])add('事件與進度',[x.type,x.status,x.text].filter(Boolean).join('；'))}
 for(const [key,label] of RESEARCH_SECTIONS)add('官方摘要・'+label,profile[key]?.text);
 searchCache.set(profile,entries);return entries;
}
function hasSearchTerm(text,term){return /^[a-z][a-z0-9 ]*$/.test(term)?new RegExp('(^|[^a-z0-9])'+term+'($|[^a-z0-9])').test(text):text.includes(term)}
function activeSearch(){return state.search}
function keywordMatches(symbol,query=activeSearch()){
 const groups=queryGroups(query);if(!groups.length)return [];
 return researchSearchEntries(research.profiles[symbol]).filter(e=>groups.some(g=>g.some(term=>hasSearchTerm(e.normalized,term))));
}
function stockSearchScore(stock,query){
 const groups=queryGroups(query),base=normalizeSearch([stock.symbol,stock.name,stock.industry,stock.category].join(' ')),entries=researchSearchEntries(research.profiles[stock.symbol]);
 const match=g=>g.some(term=>hasSearchTerm(base,term)||entries.some(e=>hasSearchTerm(e.normalized,term)));return groups.filter(match).length;
}
function matchesStockSearch(stock,query){return !queryGroups(query).length||stockSearchScore(stock,query)>0}
function keywordEvidence(stock){
 const matches=keywordMatches(stock.symbol);if(!matches.length)return '';
 const terms=queryGroups(activeSearch()).flat();
 return '<aside class="keyword-evidence"><b>搜尋「'+esc(activeSearch())+'」命中的內容</b><ul>'+matches.slice(0,5).map(e=>{const at=Math.max(0,...terms.map(t=>e.normalized.indexOf(t))),start=Math.max(0,at-25),snippet=e.text.slice(start,start+150);return '<li><b>'+esc(e.label)+'</b>：'+(start?'…':'')+esc(plainResearchText(snippet))+(start+150<e.text.length?'…':'')+'</li>'}).join('')+'</ul><p class="tiny">這是現有資料中的文字命中；請看內容確認是已實現、仍在規劃，或尚待查核。</p></aside>';
}
function visibleStocks(){
 let arr=state.stocks.map(materialize).filter(s=>(state.tab!=='watchlist'||state.watchlist.includes(s.symbol))&&(state.filter==='全部'||state.filter===s.category)&&(!activeSearch()||matchesStockSearch(s,activeSearch())));
 arr=arr.filter(s=>{const p=research.profiles[s.symbol];return state.researchFilter==='all'||(state.researchFilter==='researched'?p?.status==='researched':state.researchFilter==='overview'?!!p?.overview:p?.status!=='researched')});
 const within=(v,min,max)=>(min===null&&max===null)||(v!==null&&(min===null||v>=min)&&(max===null||v<=max));
 arr=arr.filter(s=>within(finite(s.price),state.priceMin,state.priceMax)&&within(primary(s),state.metricMin,state.metricMax));
 const field=state.sort.replace(/(Asc|Desc)$/,''),direction=state.sort.endsWith('Desc')?-1:1;
 const scores=new Map(arr.map(s=>[s.symbol,stockSearchScore(s,activeSearch())]));
 return arr.sort((a,b)=>{
  const relevance=scores.get(b.symbol)-scores.get(a.symbol);if(relevance)return relevance;
  if(['symbol','category'].includes(field))return direction*String(a[field]||'').localeCompare(String(b[field]||''),'zh-TW')||a.symbol.localeCompare(b.symbol);
  const x=field==='metric'?primary(a):finite(a[field]),y=field==='metric'?primary(b):finite(b[field]);
  if(x===null&&y===null)return a.symbol.localeCompare(b.symbol);
  return x===null?1:y===null?-1:direction*(x-y)||a.symbol.localeCompare(b.symbol);
 })

}
function star(s){const watched=state.watchlist.includes(s.symbol);return `<button class="star ${watched?'on':''}" data-star="${esc(s.symbol)}" aria-label="${watched?'移除':'加入'}自選股 ${esc(s.symbol)}" aria-pressed="${watched}">${watched?'★':'☆'}</button>`}
function wireStars(root){root.querySelectorAll('[data-star]').forEach(b=>b.onclick=e=>{e.stopPropagation();toggleWatch(b.dataset.star)})}
function render(){
 $('watchCount').textContent=state.watchlist.length;$('marketCount').textContent=state.stocks.length.toLocaleString('zh-TW');
 $('categoryCards').innerHTML=CATS.map(c=>`<div class="category-card-wrap"><button aria-pressed="${state.filter===c.id}" class="metric-card ${state.filter===c.id?'active':''}" data-category="${esc(c.id)}"><span class="cap">${esc(c.id)}</span><span class="category-first-metric"><b>先看 ${esc(c.abbr)}</b><small>（${esc(metricName(c.abbr).replace(c.abbr+' ',''))}）</small></span><strong>${state.stocks.map(materialize).filter(s=>s.category===c.id).length}</strong><span class="tiny">${esc(c.sub)}</span></button>${state.filter===c.id?'<button type="button" class="category-clear" aria-label="取消分類，顯示全部股票" title="取消分類，顯示全部股票">×</button>':''}</div>`).join('');
 document.querySelectorAll('.category-clear').forEach(b=>b.onclick=()=>{state.filter='全部';$('categoryFilter').value='全部';state.page=1;render()});
 document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{state.filter=state.filter===b.dataset.category?'全部':b.dataset.category;$('categoryFilter').value=state.filter;state.page=1;render()});
 const arr=visibleStocks(),pages=Math.max(1,Math.ceil(arr.length/state.size));state.page=Math.min(state.page,pages);
 if(!arr.some(s=>s.symbol===state.selected))state.selected=arr[0]?.symbol||null;
 $('listTitle').textContent=state.tab==='watchlist'?'我的自選股':'全部上市股票';$('rowCount').textContent=`${arr.length} 檔`;
 $('pageLabel').textContent=`${state.page} / ${pages}`;$('prevPage').disabled=state.page===1;$('nextPage').disabled=state.page===pages;
 const rows=arr.slice((state.page-1)*state.size,state.page*state.size);
 const metricOrder=metricColumnOrder(state.filter),preferred=CATS.find(c=>c.id===state.filter)?.metric;
 $('stockHeaders').innerHTML='<th>自選</th><th>股票／產業</th><th>收盤參考價</th><th>研究分類</th><th>主要指標與判讀</th>'+metricOrder.map(k=>'<th'+(k===preferred?' class="primary-raw"':'')+'>'+metricHelpLink(k,k.toUpperCase())+'<small class="metric-caption">（'+esc(metricName(k.toUpperCase()).replace(k.toUpperCase()+' ',''))+'）</small>'+(k==='pe'?'<small class="metric-caption">務必與同類股票比較</small>':'')+(k===preferred?'<small class="metric-caption">★ 此分類優先參考</small>':'')+'</th>').join('');
 $('stockRows').innerHTML=rows.length?rows.map(s=>{const c=catMeta(s),it=interpretation(s);return `<tr data-symbol="${esc(s.symbol)}" tabindex="0" class="${s.symbol===state.selected?'focused':''}" aria-label="查看 ${esc(s.name)} 詳細資料"><td>${star(s)}</td><td><b class="ticker">${esc(s.symbol.replace('.TW',''))}</b><button type="button" class="ticker-name stock-name-button">${esc(s.name)}</button><small>${esc(s.industry)}</small>${keywordMatches(s.symbol).length?'<small class="search-match">命中：'+esc([...new Set(keywordMatches(s.symbol).map(e=>e.label))].slice(0,3).join('、'))+'</small>':''}</td><td class="numeric"><b>${fnum(s.price)}</b><small>${esc(s.price_date||'日期未提供')}</small>${weeklyChangeHtml(s)}</td><td><span class="cat-chip">${esc(s.category)}</span>${c.metric?'<small>先看 '+metricHelpLink(c.metric,c.abbr+' '+ratio(s[c.metric]),s[c.metric])+'</small>':''}</td><td><div class="major">${c.metric?metricHelpLink(c.metric,c.abbr+' '+ratio(s[c.metric]),s[c.metric]):esc(c.abbr)+' —'}</div><small>（${esc(metricName(c.abbr).replace(c.abbr+' ',''))}）</small><span class="tag ${it.tone}">${esc(it.title)}</span></td>${metricOrder.map(k=>`<td class="numeric ${c.metric===k?'primary-raw':''}">${metricHelpLink(k,ratio(s[k]),s[k])}${k==='peg'&&['annual','cagr3','cagr5'].includes(s.field_meta?.peg?.period_mode)?'<small>'+esc(s.field_meta.peg.period_mode==='annual'?s.field_meta.peg.date.slice(0,4)+' 年全年 EPS 成長':s.field_meta.peg.period_mode.slice(-1)+' 年 EPS 複合成長率')+'</small>':''}</td>`).join('')}</tr>`}).join(''):`<tr><td colspan="9"><div class="emptiness ${activeSearch()?'empty-search-hint':''}">${activeSearch()?'試試其他寫法，再搜尋一次看看～':state.tab==='watchlist'?'尚無符合條件的自選股。到「全部股票」搜尋並按 ☆ 即可加入。':'目前沒有符合條件的股票。請清除篩選，或稍後重新載入資料。'}</div></td></tr>`;
 document.querySelectorAll('tr[data-symbol]').forEach(tr=>{tr.onclick=()=>{selectCompany(tr.dataset.symbol)};tr.onkeydown=e=>{if(e.target===tr&&(e.key==='Enter'||e.key===' ')){e.preventDefault();tr.click()}}});wireStars($('stockRows'));
 if(!state.selected&&rows.length)state.selected=rows[0].symbol;
 renderDetail();wireMetricHelp();
 const absent=state.watchlist.filter(sym=>!state.stocks.some(s=>s.symbol===sym));$('missingWatch').hidden=state.tab!=='watchlist'||!absent.length;$('missingWatch').textContent='自選股暫無市場資料（清單仍保留）：'+absent.join('、');
}
const RESEARCH_SECTIONS=[['business','公司業務'],['earnings','近年營收與獲利來源'],['transition','轉型方向'],['developments','新發展項目']];
let research={profiles:{},loading:true,error:false};
function safeResearchUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}}
function researchAge(record,now=new Date()){return record?.reviewed_at?Math.floor((now-new Date(record.reviewed_at+'T00:00:00+08:00'))/86400000):null}
function financialOverviewSummary(o){
 const r=o.financial.rolling;
 return '最近 12 個月（'+r.start_period+' 至 '+r.period+'），'+(r.basis||'營收')+'合計 '+fnum(r.ttms)+' 億元；每股盈餘合計 '+fnum(r.ttm_eps)+' 元，屬於母公司股東的淨利合計 '+fnum(r.ttm_parent_profit)+' 億元。獲利來源：'+plainResearchText(o.profit_mechanism)+'。';
}
function outlookConclusion(x,o){
 const kind=String(x.type||''),scope=String(x.scope||'營收'),period=String(x.period||'未確認');
 const who=/法人|共識/.test(kind)?'研究機構當時估計':/長期目標|業務目標/.test(kind)?'公司希望達到的目標是':'公司當時預估';
 const unit={'新台幣億元':'億新台幣','新台幣／億元':'億新台幣','美元／億元':'億美元','歐元億元':'億歐元'}[x.unit]||x.unit||'';
 if(!Number.isFinite(x.low))return '公司發展方向：'+plainResearchText(o.direction)+'（本份資料未提供營收預估金額）。';
 let text=who+'：'+period+' 的「'+scope+'」約 '+fnum(x.low)+(Number.isFinite(x.high)?' 至 '+fnum(x.high):'')+' '+unit+'。';
 const match=period.match(/^(\d{4})全年$/),prior=match?o.financial?.cumulative?.[(Number(match[1])-1)+'-Q4']:null;
 if(prior?.basis==='合併營業收入'&&prior.revenue>0&&['新台幣億元','新台幣／億元'].includes(x.unit)&&/^(整體)?合併(總)?營(收|業收入)$/.test(scope)){
  const low=(x.low/prior.revenue-1)*100,high=Number.isFinite(x.high)?(x.high/prior.revenue-1)*100:null;
  const change=v=>v>=0?'增加約 '+fnum(v)+'%':'減少約 '+fnum(-v)+'%';
  text+='與 '+(Number(match[1])-1)+' 年實際營收比較，代表'+change(low)+(high!==null?' 至 '+change(high):'')+'，這是預估情境。';
 }
 text+='（'+(/長期目標|業務目標/.test(kind)?'公司目標':/法人|共識/.test(kind)?'研究機構預估':'公司預估')+'，發布於 '+(x.published_at||'日期未提供')+'）';
 if(/子公司|專案|ASIC/.test(scope))text+='範圍：'+scope+'。';
 return text;
}
function overviewHtml(o){
 if(!o)return '';
 const refs=urls=>urls.map(url=>safeResearchUrl(url)?'<a target="_blank" rel="noopener noreferrer" href="'+esc(safeResearchUrl(url))+'">原始來源 ↗</a>':'').join(' · ');
 const amounts=o.financial||{};
 const rolling=amounts.rolling;
 const periodLabel=p=>p?String(p).replace(/(\d{4})-Q([1-4])/,(m,y,q)=>y+' 年 '+['1–3 月','4–6 月','7–9 月','10–12 月'][Number(q)-1]):'未取得';
 const rows=rolling?Object.entries(amounts.cumulative||{}).filter(([p])=>p.endsWith('-Q4')).sort().map(([p,v])=>[p.slice(0,4)+' 年整年',v.revenue,v.eps]).concat(rolling.quarters.map(q=>[periodLabel(q.period)+'（單季）',q.revenue,q.eps]),[['最近 12 個月（TTM）',rolling.ttms,rolling.ttm_eps]]):[['2024 年整年',amounts.fy2024,null],['2025 年整年',amounts.fy2025,null],['最近四季營收',amounts.ttm,null]];
 const table='<details><summary>公司做了多少生意、每股賺多少？</summary><p>營收是公司做生意取得的收入；淨利是扣除成本、費用與稅後的獲利。以下營收以「億元」表示；EPS 是每股盈餘，以「元／股」表示。</p><table><thead><tr><th>統計時間</th><th>營收（億元）</th><th>每股盈餘（元）</th></tr></thead><tbody>'+rows.map(([label,revenue,eps])=>'<tr><th>'+esc(label)+'</th><td>'+fnum(revenue)+'</td><td>'+fnum(eps)+'</td></tr>').join('')+'</tbody></table><p class="tiny">整年：1 月到 12 月。單季：該三個月本身，不是年初累計。最近 12 個月：最新四季加總，會隨新季資料往前移動。— 表示資料不足。</p><p class="tiny">資料口徑：'+esc(amounts.basis||'未提供')+'。金融業可能列淨收益，需依原財報解讀。</p>'+(rolling?'<p><b>最近 12 個月營收（TTM Sales）</b>：'+fnum(rolling.ttms)+' 億元<br><b>最近 12 個月每股盈餘（TTM EPS）</b>：'+fnum(rolling.ttm_eps)+' 元／股<br><b>最近 12 個月股東獲利（歸屬母公司業主淨利）</b>：'+fnum(rolling.ttm_parent_profit)+' 億元</p><p class="tiny">截至 '+esc(periodLabel(rolling.period))+'；範圍 '+esc(rolling.start_period)+' 至 '+esc(rolling.period)+'。公式：'+esc(rolling.formula)+'。EPS 依累計財報銜接；股數變動或追溯重編可能影響比較。</p>':'')+'</details>';

 const annualRefs=Object.entries(amounts.cumulative||{}).filter(([p,v])=>p.endsWith('-Q4')&&safeResearchUrl(v.source_url)).sort().map(([p,v])=>'<li>'+esc(p.slice(0,4))+' 年全年 EPS：'+fnum(v.eps)+' 元／股 · '+refs([v.source_url])+'</li>').join('');
 const annualSources=annualRefs?'<details><summary>查看各年度 EPS 與原始來源</summary><ul>'+annualRefs+'</ul><p class="tiny">較早的年度 EPS 補自公開資訊觀測站；未逐家調整會計準則、股數變動與追溯重編差異。</p></details>':'';
 const forecasts=o.outlooks.map(x=>'<article class="outlook-note"><p><b>白話結論</b><br>'+esc(outlookConclusion(x,o))+'</p><details><summary>查看預估金額、假設與來源</summary><p><b>'+esc(x.type)+' · '+esc(x.period)+'</b><br>'+esc(x.scope)+' · '+esc(x.unit||'未提供金額單位')+(Number.isFinite(x.low)?' '+esc(x.low)+(Number.isFinite(x.high)?'–'+esc(x.high):''):'')+'<br>'+esc(plainResearchText(x.limitations))+'<br>這份預估發布於：'+esc(x.published_at||'未提供')+'<br>'+refs(x.urls)+'</p></details></article>').join('');
 const events=o.events.map(x=>'<p><b>'+esc(x.type)+' · '+esc(x.period)+'</b><br>'+esc(x.status)+'<br>'+esc(plainResearchText(x.text))+'<br>'+refs(x.urls)+'</p>').join('');
 const bullets=text=>'<ul class="overview-points">'+String(text||'未提供').split(/[；;\n]/).filter(Boolean).map(x=>'<li>'+esc(plainResearchText(x.trim()))+'</li>').join('')+'</ul>';
 const money=(value,unit)=>Number.isFinite(value)?fnum(Math.abs(value))+' '+unit:'資料不足';
 const results=rolling?'<section class="overview-block"><h5>② 最近一年的成績</h5><p class="tiny">'+esc(metricPeriod('trailing_eps',{date:rolling.period}))+'</p><div class="overview-facts"><div><span>做了多少生意？（營收）</span><strong>'+money(rolling.ttms,'億元')+'</strong><small>'+esc(rolling.basis||'營收')+'；還沒扣成本與費用</small></div><div><span>'+((rolling.ttm_parent_profit??0)<0?'股東最後虧損多少？（歸屬母公司業主淨損）':'股東最後獲利多少？（歸屬母公司業主淨利）')+'</span><strong>'+money(rolling.ttm_parent_profit,'億元')+'</strong><small>扣除成本、費用及稅等後，屬於母公司股東的結果</small></div><div><span>'+((rolling.ttm_eps??0)<0?'每股虧損（TTM EPS）':'每股盈餘（TTM EPS）')+'</span><strong>'+money(rolling.ttm_eps,'元／股')+'</strong><small>每股數字與公司總獲利是不同的單位</small></div></div></section>':'<section class="overview-block"><h5>② 最近一年的成績</h5><p>'+esc(plainResearchText(o.summary))+'</p></section>';
 return '<div class="imported-overview"><h4>全市場概況與摘要</h4><section class="overview-block"><h5>① 這家公司做什麼？</h5>'+bullets(o.business)+'</section>'+results+'<section class="overview-block"><h5>③ 主要靠什麼賺錢？</h5>'+bullets(o.profit_mechanism)+'<p class="tiny">以上整理公司主要的獲利來源。</p></section><section class="overview-block"><h5>④ 接下來往哪裡發展？</h5>'+bullets(o.direction)+'</section>'+table.replace(/<\/details>$/,annualSources+'</details>')+'<details><summary>財測與展望：未來可能怎麼走？</summary>'+(forecasts||'<p>目前資料沒有列出可核對的預估。</p>')+'</details><details><summary>事件與待核對事項</summary>'+(events||'<p class="tiny">本檔未列事件；不代表沒有重大事件。</p>')+'</details><details><summary>資料日期、來源與進階註記</summary><p class="tiny">使用者提供：'+esc(o.source_filename||'臺灣上市公司營運研究_20261003.xlsx')+' · 檔案查核日 '+esc(o.source_reviewed_at)+' · 匯入日 '+esc(o.imported_at)+'。本次未重新逐一查閱原始網站。</p><p class="tiny">原檔完整度註記：'+esc(o.status)+'<br>原檔財務篩選：'+esc(o.financial?.screening||o.screening)+'</p><div class="research-refs">'+refs(o.urls)+'</div><p class="tiny">營收及公司獲利用億元表示，EPS 用元／股表示；缺值不是零。四季合計未逐家調整 IFRS17 或併表差異，預估未確認所有後續修正。</p></details></div>';

}
const RESEARCH_WORDING=[["集團交易銷除及非控制權益分攤後，永崴歸屬母公司損失增加15.67416億元，不能把107.56億元直接當永崴歸屬損失", "扣除集團內交易並分攤少數股東部分後，永崴母公司股東損失增加 15.67416 億元；107.56 億元為調整前的另一口徑"], ["同季 PC 客戶拉貨調整與原料成本上漲使本業虧損，不能僅因新應用比重提高或單季淨利增加，就判定整體營運已改善", "同季 PC 客戶拉貨調整與原料成本上漲使本業虧損；新應用營收比重及單季淨利增加"], ["土地都更案則有 2027 開工、2031 完工的規劃，仍處開發階段，不能將未來店面或房產計畫算成現有收入", "土地都更案預計 2027 年開工、2031 年完工（目前處開發階段）"], ["2026 上半年歸母淨利 62.65 億元、EPS 6.03 元，不能用營收成長直接代表各事業獲利成長", "2026 上半年母公司股東淨利 62.65 億元、EPS 6.03 元；各事業獲利另看部門財報"], ["2026 手冊的使用執照、室內裝修及施工時間仍是計畫，未取得後續公告，不能當作旅館已開幕或新案已獲利", "2026 手冊列使用執照、裝修及施工的預定時程（開幕與收入進度待公告）"], ["公司表示已完成比利時Magnax併購，2030人形機器人5%市占為目標，不能視為實績或據此直接算营收", "公司表示已完成比利時 Magnax 併購，目標為 2030 年取得人形機器人市場 5% 市占（公司目標）"], ["出售資產帶來的收益、休閒店面的經常損益及都更開發認列時點，需要分開觀察，海外店數也不代表已全部獲利", "收益來源分為資產出售、休閒店面營運及都更開發；海外店數與各店損益分開列示"], ["國內建築、公共工程及越南鋼材需求會影響出貨，集團另有鋼結構及營造業務，營收不能直接等同鋼材銷量", "出貨受國內建築、公共工程及越南鋼材需求影響；集團營收含鋼材、鋼結構及營造業務"], ["投資及其他淨流入約57.04億元，其中含三個月以上定存減少55.63億元，不能當成處分事業獲利", "投資及其他現金淨流入約 57.04 億元，其中 55.63 億元來自三個月以上定存減少"], ["高資產客戶成長、貸款規模與 ESG 案件數仍需對照手續費、資產品質及資本使用，不能直接推算獲利", "高資產客戶、貸款與 ESG 案件增加；獲利需合看手續費、貸款品質及資金成本"], ["南亞科則以權益法認列投資損益，不能將其半導體營收併作南亞本業，產品營收比重也不等於淨利占比", "南亞科的獲利或虧損以轉投資損益計入南亞（營收未併入）；以上產品比例為南亞營收結構"], ["太陽能、液態二氧化碳捕捉仍屬評估，藻類生質燃料則為委託研究，不能寫成已量產或已帶來確定獲利", "太陽能與液態二氧化碳捕捉正在評估；藻類生質燃料為委託研究階段"], ["2026 AI 業務占營收超過 30% 是公司預期，並非已公布全年實績，不能視為獲利占比", "公司預期 2026 年 AI 業務占全年營收超過 30%（全年預估）"], ["2025 營業虧損 1.06 億元，業外收益 7.77 億元，不能將淨利視為休閒本業改善", "2025 年本業虧損 1.06 億元，本業以外收益 7.77 億元；淨利主要受本業以外收益帶動"], ["權益法收益較同期增加 337.5 億元，含南亞科與台塑化貢獻，不能全部歸因電子材料本業", "轉投資收益較去年同期增加 337.5 億元，含南亞科與台塑化貢獻；電子材料本業獲利另列"], ["年報提到與汽車電子合作的方向，尚未單獨揭露新業務營收，不能當作已形成新的主要獲利來源", "年報列出汽車電子合作方向（新業務營收尚未單獨揭露）"], ["ISO 50001 推動公告不等於全部工廠已獲認證，也未揭露各投資事業的獨立獲利貢獻", "正在推動 ISO 50001 能源管理認證（各廠認證進度與投資事業獲利待揭露）"], ["年報指出毛利額隨業績下滑，另有剩餘乳出售損失增加與匯兌利益減少，不能只用營收推估淨利", "年報指出毛利額隨業績下滑；剩餘乳出售損失增加、匯兌利益減少，也影響淨利"], ["世界明珠房產累計銷售金額也不等於 2025 當年認列營收，仍須逐期核對交屋與收入", "世界明珠金額為累計銷售額；2025 年認列營收依當年交屋進度"], ["另所稱本業改善挹注稅後損益7.39億元為改善效果，不能當成本業已獲利7.39億元", "本業改善讓稅後損益增加 7.39 億元（相較原狀況的改善金額）"], ["本輪未補讀 2026 半年財報及 2023 全年資料，不能據此推論最新景氣已回升", "此處整理已列來源，2026 半年與 2023 全年財報資料待補充"], ["這是銀行收益結構，並非各業務淨利比例，投資收益也不能套用製造業的本業／業外分類", "以上為銀行利息、手續費及投資等收益的比例"], ["2026 保險會計及匯率制度改變，FVOCI 股票處分利得不能直接當作當期損益", "2026 年保險會計及匯率制度改變；FVOCI 股票處分利得依新制列入權益項目"], ["當時按78.1%持股估母公司損失110億元，屬初估，不能當2026已認列損失", "當時按 78.1% 持股初估母公司損失 110 億元（認列金額以財報為準）"], ["該季另有世界先進持股處分及評價利益 632 億元，不能全部視為經常性本業成長", "該季含世界先進持股處分及評價利益 632 億元（與本業營運獲利分開列示）"], ["這是零件供應業務，未揭露各產品獲利，不能當作衛星營運商或直接推算新業務淨利", "公司供應衛星相關零件；各產品獲利尚未單獨揭露"], ["依年報判讀，重點為食品本業與通路模式升級，相關計畫尚不能視為已產生新增獲利", "年報規劃重點為食品本業與通路模式升級（計畫效益待後續財報）"], ["半年資本支出現金流12.71億元，不能以媒體所稱年度投資計畫替代已發生支出", "半年已支付建廠與設備投資 12.71 億元；年度投資計畫另列"], ["新產品、專利或通過品質認證本身，並不能證明已形成可觀銷售或改善製造部門獲利", "已推出新品、取得專利或品質認證（產品收入與部門獲利另列）"], ["本輪未取得營業與業外詳細拆分，不能因交船或新訂單就判定船舶、風電業務已獲利", "交船與新訂單已有進展（船舶、風電業務獲利尚未單獨揭露）"], ["本輪未取得逐案投產日期及新增收入，不能把整體資本支出寫成已實現的產能或獲利", "以上為整體建廠與設備投資額（逐案投產日期與收入待揭露）"], ["研究判讀為核心技術與通路延伸，不能據此認定新藥或海外市場已成為主要獲利來源", "公司正在延伸核心技術與通路（新藥及海外市場獲利尚未單獨揭露）"], ["這是產品／平台發表，尚未取得獨立收入或獲利貢獻，亦不代表預告展示都已商業化", "產品與平台已發表（商用進度、獨立收入與獲利待揭露）"], ["送件、獲證、招商及持續出貨屬不同階段，合作案數不能直接推算新藥營收或獲利", "各合作案進度分為送件、獲證、招商與持續出貨；收入依各案實際進度列示"], ["閒置土地活化則另屬資產運用方向，招商、申請及洽談不能視為已取得開發收入", "閒置土地活化進度：招商、申請與洽談中（開發收入尚待後續財報）"], ["半導體前段設備鋁材：2026/9公司新聞稱認證推進，不能當作已大量商用", "半導體前段設備鋁材：2026 年 9 月公司表示認證持續推進（商用進度待公告）"], ["中國建築需求疲弱仍是限制，不能將 AI 材料需求直接視為整體獲利已轉佳", "AI 材料需求提升，中國建築需求仍疲弱；整體獲利看兩者及成本的共同影響"], ["集團建案預估總銷金額與已售戶數，都不能直接當作當年已認列的營收或淨利", "以上為建案預估總銷與已售戶數（當年營收與淨利另看交屋財報）"], ["這項退出決定已發生，新品試產仍待驗證，年報舊規劃不能取代最新財報狀態", "退出決定已公布，新品正處試產驗證階段；目前業務範圍依最新財報列示"], ["這是產品代理及服務業務，不能因半導體營收增加就認定公司自行製造晶片", "公司靠代理半導體產品及提供服務取得收入"], ["住宅 Eco Park A+ 已開始預售，預售不等同已交屋認列收入", "住宅 Eco Park A+ 已開始預售（交屋與營收認列進度待確認）"], ["使用者工具互動、搜尋效率改善等公司指標，不等於已實現額外營收或獲利", "以上為工具使用與搜尋效率指標（相關收入及獲利尚未單獨揭露）"], ["訂單需核對取消、實際交車及營收認列，不能直接用車價乘訂單視為收入", "以上為預接單數；實際收入依交車及財報認列"], ["2024、2025、2026合併範圍不同，同比不能全當自然成長", "2024 至 2026 年的營收變化包含收購與合併範圍調整"], ["2024營收與後續年度比較需留意收購併表時點，不能全歸自然成長", "營收年增包含本業變化與收購後併入的收入"], ["保额219億元不等於可領理賠，單次上限30億元且承保75.5%", "保額 219 億元，單次理賠上限 30 億元、承保比例 75.5%（實際理賠待確認）"], ["金融資產評價與權益法收益仍需分開觀察，不能當成水泥產品毛利改善", "金融資產評價與轉投資收益另列；水泥產品毛利看本業財報"], ["非公司財測，來源較早且未確認後續修正，不能称截至10月最新共識", "研究機構預估，以來源發布日期為準（後續修正待確認）"], ["FVOCI股票處分稅後利益910.7億元不能直接加進損益表淨利", "FVOCI 股票處分稅後利益 910.7 億元列入權益項目，損益表淨利另列"], ["年報列有 20 餘項轉型案，尚不能把全部項目視為完成或獲利貢獻", "年報列有 20 餘項轉型案（各案完成進度與獲利待揭露）"], ["氣候策略頁未提供各項新案的時程，不能認定已量產或有實際財務貢獻", "氣候策略頁列出新案方向（時程與財務貢獻待揭露）"], ["產品展示屬已發生事件，但不能據此認定已大規模量產或形成重大獲利", "產品已展示（大規模量產與獲利進度待揭露）"], ["第二季淨利 6.30 億元，高於半年累計，表示不可只看單季復甦", "第二季淨利 6.30 億元；上半年累計淨利較低，包含第一季的損益"], ["2025公開收購原擬45%不能直接當最新持股或已全額合併營收", "2025 年公開收購原計畫取得 45%；最新持股與營收合併範圍待確認"], ["平板玻璃銷售下降、玻纖銷售增加，不能據營收比重推算各產品獲利", "平板玻璃銷售下降、玻纖銷售增加；各產品獲利另看部門損益"], ["營業活動淨現金流入約1.02億元，會計虧損不等於同額現金流出", "營業活動現金淨流入約 1.02 億元；會計損益與現金流分開列示"], ["輪胎營收也由約 89.98 億元下降，不能把變化全部歸因房產", "輪胎營收由約 89.98 億元下降，與房產業務變化一起影響整體收入"], ["本表2026H1仍是交易前口徑，不能當作交易後完整集團營收", "2026 上半年數字涵蓋交易前的合併範圍"], ["不能將422.60億元母公司淨利全部解讀為晶圓代工本業獲利", "422.60 億元為母公司股東淨利，含晶圓代工及其他損益"], ["這是集團營收比例，不能視為母公司建案收入或各事業獲利占比", "以上為集團各業務營收比例（含子公司）"], ["上述比例屬生產事業營收，不能當作全集團綠色營收或獲利占比", "以上比例以生產事業營收為計算基礎"], ["新項目的最新進度仍待補查，來源涵蓋範圍不等同所有近期新聞", "以下整理所列來源的新項目（最新進度待補充）"], ["這些是地區、用途及產品三種口徑，不可相加或視為獲利占比", "地區、用途及產品分別統計，各自呈現收入來源"], ["公司已退出家具業務，產品收入比例不等於各部門的獲利占比", "公司已退出家具業務；以上為目前各產品收入比例"], ["分部營業利益及權益法投資收益，不等於歸母淨利的完整分配", "以上列出部門營業利益與轉投資收益；母公司股東淨利另列"], ["來源發布後修正未逐日核對，較早來源不能稱10月最新共識", "以上預估以所列發布日期為準（後續修正待確認）"], ["非公司財測，1月版本尚未確認後續修正，不能稱10月最新", "研究機構 1 月預估（後續修正待確認）"], ["不能直接等同國票金控當期新增損失，須另核權益及歸母影響", "國票金控當期損益與股東權益影響，以自身財報列示為準"], ["公司宣稱的效率改善須再對照獲利，不能僅靠新品或接單推定", "公司表示效率改善，實際效益以後續獲利數字呈現"], ["屬製程與服務範圍拓展，尚不能認定新平台已成主要獲利來源", "屬製程與服務範圍拓展（新平台獲利尚未單獨揭露）"], ["收入受合約履約進度影響，不能把整座風場容量當作公司收入", "公司收入依承接合約的履約進度認列；風場容量為專案規模"], ["會員數、服務據點及門市數定義不同，不能混用推估單店營收", "會員數、服務據點數及門市數分別列示，單店收入另看營運資料"], ["未取得完整分部獲利拆解，食品營業比重不代表食品獲利占比", "以上為食品營收比例（完整部門獲利尚未提供）"], ["車輛／售後毛利及汽車轉投資損益，不能僅以台灣銷量估淨利", "獲利來自車輛與售後服務毛利，以及汽車轉投資損益"], ["這些有營運進展，但不能把基金資產規模當作公司營收或獲利", "已有營運進展；基金資產規模為管理的資金總額，服務收入與獲利另列"], ["營收占比並非製程獲利占比，亦不能用單季利益率代表全年", "各製程占當季營收的比例；全年獲利另看全年財報"], ["地區銷售比例不等於 AM／OEM 或各市場的獲利占比", "以上為各地區銷售比例"], ["2026上半年同比含合併範圍影響，不能只解讀本業成長", "2026 上半年營收年增包含合併範圍變動的影響"], ["力積電1月LOI列18億美元價款，價款不等於處分利益", "力積電 1 月意向書列交易價款 18 億美元（處分損益另列）"], ["不能只按造紙產業分類便認定當前主要收入仍來自紙張製造", "目前主要收入來源以最新財報業務結構為準"], ["2025經營團隊接棒、2026董事改選不等於營收成長", "2025 年經營團隊接棒、2026 年董事改選（屬人事調整）"], ["不能將虧損全歸因匯率，製造成本及業外細項仍待原始附註", "虧損原因需合看匯率、製造成本及本業以外損益（細項待財報附註）"], ["這是月營收公告的已發生銷售，不能等同已核閱的半年獲利", "以上為月營收公告的實際銷售；半年獲利另看核閱財報"], ["這是未來承諾，不能當成已完成減碳或確定增加獲利的證據", "以上為未來減碳承諾（達成進度與財務效益待揭露）"], ["服務種類與 AI 使用率，不能視為各業務的獲利占比", "以上為服務種類與 AI 使用率"], ["個體與集團合併口徑不同，不能用此推算各通路獲利占比", "個體財報列本公司，合併財報含子公司；各通路獲利尚未單獨揭露"], ["仍以鋼鐵產業為核心，減碳布局不能直接等同獲利已改善", "公司仍以鋼鐵為核心，正在推動減碳與製程升級"], ["少數股東權益與業外影響不可忽略，不能稱母公司已轉盈", "母公司股東損益另依財報列示，含本業以外及少數股東調整"], ["復健實際出貨與無人載具未來訂單，不能一併寫成已量產", "復健產品已有實際出貨；無人載具訂單屬未來規劃"], ["恢復交易不等於已轉虧為盈，需核重估等權益與損益差異", "股票已恢復交易；資產重估、股東權益及當期損益另看財報"], ["業外淨收益約0.80億元為正，不能把虧損全歸因業外", "本業以外淨收益約 0.80 億元為正；整體虧損仍需合看本業與其他成本"], ["淨利改善不能解讀為品牌商品或旅館本業已全面轉為獲利", "整體淨利改善；品牌商品與旅館部門損益另列"], ["股利0.8元擬由資本公積發放，不能據此認為全年獲利", "擬配股利 0.8 元，資金來源為資本公積"], ["材料事業的營收比重不能當獲利比重，增持後效益待查", "以上為材料事業營收比例；增持後的效益待後續財報"], ["原已為子公司，不能將整體子公司收入當新增合併收入", "原已為合併子公司（營收原已納入合併財報）"], ["公司AI占比與Q3定性指引另列，不能混成營收金額", "AI 營收比例與第三季發展方向分開列示"], ["EPS 0.94 元，不能將放款餘額當作當期收入", "EPS 0.94 元；放款餘額為貸款規模，當期收入另列"], ["缺少同口徑期初及期末權益，不能用期末權益代替平均", "ROE 所需的期初、期末股東權益尚未補齊"], ["部門稅前損益須經部門間調整，不等於歸母淨利分配", "以上為部門稅前損益；母公司股東淨利另列於財報"], ["客貨收入不是獲利占比，也不能與合併收入直接混算", "以上為客運與貨運收入；合併集團總收入另列"], ["通過投標案不等於實際得標或完成100%股權收購", "目前進度：投標案已通過（拍賣結果與交割進度待公告）"], ["最優申請與交易金額不能直接當作本公司已認列營收", "目前進度：最優申請人；以上為交易金額（營收認列進度待財報）"], ["已發生支出為投入階段，不代表各項設備均完工投產", "支出已發生，目前為設備投入階段（投產進度另列）"], ["三項為不同損益因素，不能將合計直接當成稅後淨損", "以上三項為不同損益因素；稅後淨損以財報列示為準"], ["這代表營收結構改變，不能直接推算兩者獲利占比", "雲端網路產品帶來的收入已超過智慧消費電子"], ["麵粉毛利、租賃及轉投資收益；不能當作聯華食品", "麵粉毛利、租賃及轉投資收益（公司為聯華）"], ["候選藥與合作不等於已核准上市或已認列全額營收", "目前進度：候選藥開發與合作（上市許可及收入另列）"], ["高獲利主要受到價格上升影響，不可直接永續外推", "高獲利主要由價格上升帶動，後續獲利隨報價變化"], ["來源較早者更新未確認，不可稱10月最新共識", "以上預估以來源日期為準（後續更新待確認）"], ["較早来源不能稱10月最新共識，後續修正待核", "以上預估以來源日期為準（後續修正待確認）"], ["2026H1與9月後壽險處理不同，不能混算", "2026 上半年與 9 月後的壽險財報適用不同處理方式，分期列示"], ["公告未附同期比較，不能據此稱最新獲利已回升", "以上列最新公告數字（去年同期比較尚未提供）"], ["現有裝置、預定日期與新增產能均不能互相替代", "現有設備、預定時程與新增產能分開列示"], ["該敘述不等於已揭露 AI 或液冷的獲利占比", "以上為 AI 與液冷發展方向（獲利占比尚未揭露）"], ["這是業務擴展方向，尚不能據此量化新業務獲利", "以上為業務擴展方向（新業務獲利尚未單獨揭露）"], ["這表示組合擴展，不代表已不依賴 PC 市場", "業務組合正在擴展，PC 仍是重要市場"], ["這些是營收結構，不能視為各事業的獲利占比", "以上為各事業的營收比例"], ["部門損益為稅前口徑，不能當作歸母淨利分配", "以上為部門稅前損益（扣稅前）"], ["不可把油脂公司的油品事件直接歸給1434", "此油品事件涉及福懋油脂"], ["備忘錄本身不等於具約束力營收或已取得訂單", "已簽合作備忘錄（正式訂單與收入待公告）"], ["2025法說量產目標不能替代2026實績", "以上為 2025 年法說量產目標；2026 年實際進度待確認"], ["3月版本後續修正未確認，不可稱10月最新", "以上為 3 月版本（後續修正待確認）"], ["不能把舊事業直接當最新新增案，細節待補核", "以上為既有事業方向（新專案進度待確認）"], ["不能直接當作2026新增事業，時間待補核", "以上為發展方向（首次推出時間待確認）"], ["分部營業利益與投資收益不能混為淨利占比", "部門營業利益與投資收益分開列示"], ["有非控制權益，集團淨利不能當母公司淨利", "集團淨利含少數股東的部分；母公司股東淨利另列"], ["公告不能視為已完成交割或全部營收已併入", "已公告交易（交割與營收併入時點待公告）"], ["官網以營建為主，舊電子業務不能直接沿用", "官網目前列示的主要業務為營建"], ["海洋公園套裝合作不等於全部樂園收入併入", "公司提供海洋公園套裝服務（收入依合作合約列示）"], ["招商及核准不等於已滿租或已實現新增營收", "目前進度：計畫已核准、招商中（出租與收入進度待公告）"], ["9月公告仍有新館預售，預售不等於已開業", "9 月公告新館仍在預售階段（開業進度待公告）"], ["官網船隊含合資及建造中，不能全算已營運", "官網船隊包含營運中、合資與建造中的船舶"], ["官網新品不等於全新事業，首次量產待補核", "官網已列出新品（首次量產日期待確認）"], ["2026研討會展示不代表已接全額新訂單", "2026 年研討會已展示產品（新訂單金額待公告）"], ["工廠認證也不等於每項藥品已取得上市許可", "以上為工廠認證（各藥品上市許可另列）"], ["另有未分攤費用，不能直接加總成合併淨利", "以上為部門營業利益，另有總部等未分攤費用；合併淨利另列"], ["均為季對季變動，不能當成上半年業外金額", "以上為與前一季相比的變動金額"], ["此門檻不是處分獲利率，亦不等於物流營收", "此數字為交易門檻；處分損益與物流收入另列"], ["此為投標授權，不等於已收購或實際付款", "目前進度：已取得投標授權（得標與付款結果待公告）"], ["不可推及全部產品，實際費用與損失待核", "影響範圍以公告品項為準（費用與損失待確認）"], ["官網既有飯店不等於新開業，新增案待核", "官網列示既有飯店；新增開業案待確認"], ["MOU不等於訂單、已商用或已實現營收", "已簽合作備忘錄（訂單與收入進度待公告）"], ["官網產品存在不等於當期新增營收已量化", "官網已列出產品（當期產品營收尚未單獨揭露）"], ["官網舊方向不能當最新量產，新案待補核", "官網列出既有發展方向（最新量產進度待確認）"], ["研發不等於大規模商用，最新貢獻待補核", "目前進度：研發中（商用與收入進度待確認）"], ["AI相機達可量產標準不等於已大量出貨", "AI 相機已達可量產標準（大量出貨進度待公告）"], ["未給整體營收金額，不能以占比直接推算", "已揭露比例，整體營收金額尚未提供"], ["2026簡報的產業預估不等於公司財測", "以上為 2026 年簡報的產業預估"], ["不代表公司從未提供財測或沒有法人研究", "此份資料尚未收錄可用財測金額"], ["不能將整體淨利成長全部歸因於聚酯本業", "整體淨利包含聚酯本業及其他損益"], ["尚不能據此認定能源已成為主要獲利來源", "能源業務獲利貢獻尚未單獨揭露"], ["淨利轉正不能解讀為電子產品本業已轉盈", "整體淨利轉正；電子產品本業損益另列"], ["舊DDR5計畫不可當最新2026投產", "以上為原 DDR5 計畫（2026 年投產進度待確認）"], ["需閱讀更正內容，不能由目錄推定重大性", "更正影響以公告的實際更正內容為準"], ["不可延伸成所有產品均受影響或仍下架", "受影響品項與下架期間依該公告列示"], ["官網舊案不可直接列為2026新訂單", "官網列出既有專案（2026 年新訂單待確認）"], ["部分來源較早，不能稱10月最新共識", "以上預估以各來源發布日期為準"], ["保費不等於獲利，賠款和再保成本影響", "保費為保險收入；獲利須扣除賠款、再保及其他成本"], ["設備銷售營收與服務毛利不可混為一談", "設備銷售營收與服務毛利分開列示"], ["上述比例不能直接當作部門獲利占比", "以上為各部門營收比例"], ["內部AI知識庫不等於對外AI營收", "AI 知識庫供公司內部使用"], ["銀行帳戶不等於自營加密資產交易所", "銀行提供相關帳戶與金融服務"], ["房產累計銷售不能當作當年認列營收", "以上為房產累計銷售金額（當年認列營收另看交屋財報）"], ["產品頁不等於新年度量產或營收承諾", "產品頁列示產品資訊（量產與收入進度待公告）"], ["產品應用頁不代表已取得新客戶量產", "產品頁列示應用方向（新客戶量產進度待公告）"], ["2026展會產品不等於已取得订单", "2026 年展會已展示產品（訂單待公告）"], ["營收成長和毛利率不能忽略口徑變化", "營收成長與毛利率的比較須使用相同合併範圍"], ["舊版法說所列案不能当最新交屋承諾", "以上為當時法說的建案計畫（最新交屋時程待公告）"], ["核准預算不代表各工程已完工投產", "預算已核准（工程與投產進度另列）"], ["未以產品營收占比推算各產品獲利", "已揭露各產品營收比例；產品別獲利尚未提供"], ["集團百貨飯店不能全歸本公司收入", "本公司收入以自身財報列示的百貨、飯店業務為準"], ["不能當作已上市或已實現處分利益", "目前進度：申請海外上市"], ["1億元專戶不等於已確定最終損失", "1 億元為專戶金額（最終損失待確認）"], ["專案銷售總額不等於當年認列收入", "以上為專案總銷金額（當年認列收入依履約或交屋進度）"], ["不可用原客房量直接推算當期收入", "當期收入依實際營運客房與住房率列示"], ["官網產品線不等於2026新推出", "官網列示既有產品線（推出年份另列）"], ["官網方案不代表已量產或取得訂單", "官網已列出方案（量產與訂單進度待公告）"], ["尚不能據展示推定量產或重大營收", "產品已展示（量產與營收進度待揭露）"], ["營收未扣成本與費用，不等於獲利", "營收為收入總額；淨利為扣除成本、費用及稅後的成果"], ["年度轉盈不能全視為面板本業獲利", "年度淨利轉正，含面板本業與其他損益"], ["淨利轉正仍不代表器材本業已轉盈", "整體淨利轉正；器材本業損益另列"], ["FDK不能未核就全部併入營收", "FDK 的營收合併範圍待財報確認"], ["不可直接推定有一次性併購利益", "併購相關損益以交割後財報列示為準"], ["不可當作本公司併購或負債事件", "此事件涉及另一家公司"], ["AI園區名稱不等同半導體銷售", "AI 園區屬開發案，收入依開發及租售進度認列"], ["原廠新品不代表增你強自行製造", "增你強負責代理原廠新品"], ["預售總銷不等於当年已認列營收", "以上為預售總銷金額（當年認列營收另看交屋財報）"], ["陶朱隱園获獎不等同售出／收入", "陶朱隱園已獲獎（銷售與收入另看財報）"], ["MTU長約不等於當年全部收入", "MTU 長約金額涵蓋多年，當年收入依交付進度認列"], ["展示／獲獎不代表已有商用收入", "目前進度：已展示或獲獎（商用收入待揭露）"], ["產品頁不等於2026新增業務", "產品頁列示公司業務（首次推出年份待確認）"], ["推出不代表2026已大批出貨", "產品已推出（2026 年出貨進度待公告）"], ["2026展示不等同全部已量產", "2026 年已展示產品（量產進度待公告）"], ["研發／認證不等於全數大量量產", "目前進度：研發與認證（量產進度另列）"], ["工程開始不代表新增產能已投產", "工程已開始（投產日期待公告）"], ["展前公告不能證明其後實際量產", "以上為展前公告資訊（後續量產進度待揭露）"], ["屬臨床開發階段，並非上市許可", "目前進度：人體臨床試驗"], ["EAP不等於新適應症全面核准", "已取得擴大用藥計畫（EAP）許可，適用範圍依該計畫"], ["判決進展不能直接當作新增營收", "目前進度：取得有利判決（後續銷售與收入待公告）"], ["官網舊新聞不可當最新上市時點", "以上上市進度以原新聞發布日期為準"], ["年報方向不等於已有新量產收入", "以上為年報發展方向（量產收入待揭露）"], ["旅客交易總額不等於全部淨收入", "旅客交易總額為訂單規模；公司淨收入依服務費及合約列示"], ["分部營業利益不等於淨利分配", "以上為各部門營業利益（本業收入扣除成本與營業費用）"], ["合併淨利與歸母淨利不可混用", "合併淨利包含少數股東的部分；歸母淨利為母公司股東的部分"], ["不能把總額全部當作三洋營收", "以上為專案總額；三洋的營收依其承接範圍及財報列示"], ["此項為股權合作，不能當營收", "此項金額為股權合作投資款"], ["原廠液冷投資不等於威健收購", "此為原廠液冷投資，威健扮演代理角色"], ["代銷案總銷額不等於公司收入", "以上為建案總銷金額；公司收入為代銷服務費"], ["核准不等於立即實現預估營收", "已核准（預估營收依後續履約進度實現）"], ["產品型號推出不等於收入預估", "已推出產品型號（收入預估尚未揭露）"], ["計畫核准不代表完成驗證量產", "計畫已核准（驗證與量產進度待公告）"], ["法人營收預估不等於獲利預估", "以上為研究機構的營收預估"], ["大量營收不代表同幅淨利增長", "收入規模與淨利分別列示；成本與費用影響最後獲利"], ["營收占比並非製程獲利占比", "各製程占公司營收的比例"], ["南僑集團公司不可重複加總", "南僑集團依合併財報扣除內部交易後統計"], ["合併營收不等於純電信營收", "合併營收含電信及其他業務"], ["預售不等同已交屋認列收入", "目前進度：預售中（交屋與營收認列進度待確認）"], ["南向計畫不等於據點已開業", "目前進度：南向據點規劃中"], ["展示／測試不等於量產訂單", "目前進度：展示與測試（量產訂單待公告）"], ["展示不等於已取得量產訂單", "目前進度：已展示（量產訂單待公告）"], ["平台推出不代表新訂單金額", "平台已推出（新訂單金額尚未揭露）"], ["首度展示不代表已大量出貨", "已首度展示（大量出貨進度待公告）"], ["2026論壇不等於新訂單", "2026 年已參與論壇（訂單另列）"], ["保健品研發不等同新藥核准", "此項目為保健品研發"], ["土地處分不能全視為經常性", "土地處分收益按各次交易認列"], ["新廠收入不可由投資額推算", "投資額為建廠投入；新廠收入待投產後財報揭露"], ["營收占比不等於獲利占比", "各事業占公司營收的比例"], ["营收占比不等於獲利占比", "各事業占公司營收的比例"], ["營收結構不等於獲利結構", "各事業占公司營收的比例"], ["集團電商不能全歸本公司", "本公司電商業務以自身財報列示範圍為準"], ["不可直接視為已完成併購", "目前進度：併購案已公告，交割進度待公告"], ["不能沿用舊染整主業描述", "目前業務以最新年報列示為準"], ["不能沿用舊報導分部占比", "目前部門比例以最新財報列示為準"], ["不等於開發AI模型事業", "AI 用於既有業務的工具與服務"], ["開工不等於當年營收認列", "目前進度：已開工（營收依合約履約或交屋進度認列）"], ["訂價不等於全數完成收款", "以上為訂價（實際收款另列）"], ["訂造不等於交船或新營收", "目前進度：已訂造（交船與營運收入另列）"], ["展示不等於完成量產認證", "目前進度：已展示（量產認證進度待公告）"], ["產品推出不等於新增產業", "既有業務新增產品"], ["平台推出不等於全部量產", "平台已推出（各項產品量產進度另列）"], ["加入組織不等於取得訂單", "已加入組織（訂單另列）"], ["設計流片不等於量產收入", "目前進度：設計流片（量產收入待揭露）"], ["不能假定每一業務皆獲利", "各業務損益依部門財報列示"], ["並不代表全為一次性利益", "以上含經常性與其他收益，細項依財報列示"], ["設備銷售不等同服務收入", "設備銷售與服務收入分開列示"], ["集團利潤不可重複加總", "集團內部交易依合併財報扣除"], ["集團公司收入不可混用", "收入依各公司的財報範圍分別列示"], ["不等於新增營收5億元", "此 5 億元為子公司增資款"], ["不能推定查核日已解除", "解除日期待後續公告"], ["計畫不等於已獲准開業", "目前進度：開業計畫中（許可進度待公告）"], ["LOI不等於確定訂單", "已簽意向書（正式訂單待公告）"], ["試產不能視為全部商用", "目前進度：試產中"], ["規劃不等於已完成商用", "目前進度：商用規劃中"], ["此時點不能當成已量產", "此資料日期的量產進度待確認"], ["不能當2026已商用", "2026 年商用進度待確認"], ["公告不等於已完成募集", "已公告募集計畫（實際募資進度待公告）"], ["不把計畫視為已完成", "目前進度：公司規劃中"], ["獲獎不等於新增訂單", "已獲獎（訂單另列）"], ["未分攤費用不可忽略", "另有總部等未分攤費用"], ["認證不等於取得訂單", "已取得認證（訂單另列）"], ["不能當作聯華食品", "公司為聯華"], ["交易價不等於淨利", "以上為交易價款；處分損益另列於財報"], ["評估不代表已量產", "目前進度：評估中"], ["核准不等於完工", "已核准，工程進度以施工與投產公告為準"], ["不把核准當完成", "目前進度：交易已核准，交割日期待公告"], ["不等同福懋油脂", "此處為福懋的業務"], ["招商不等於滿租", "目前進度：招商中"], ["展示不等於訂單", "目前進度：已展示（訂單待公告）"], ["不代表取得訂單", "訂單進度待公告"], ["不可重複加總", "以合併財報扣除內部交易後的數字統計"]];
function plainResearchText(text){let value=String(text||'');for(const [before,after] of RESEARCH_WORDING)value=value.replaceAll(before,after);return value;}

function quickCompanySummary(stock,p){
 const o=p?.overview;
 if(!o&&!p?.business)return '';
 const simple=text=>plainResearchText(text).replaceAll('晶圓代工','替其他公司製造晶片（晶圓代工）').replaceAll('資本支出','建廠、設備等投資支出（資本支出）').replaceAll('業外','本業以外的').replaceAll('產能','能生產多少產品（產能）');
 const brief=text=>{const parts=String(text||'').split(/[；;\n。]/).filter(x=>x.trim());return parts.slice(0,2).map(x=>simple(x.trim())).join('；')||'目前資料還不夠，需再查公司說明';};
 const periodLabel=value=>String(value||'').replace(/^(\d{4})-Q([1-4])$/,'$1 年第 $2 季');
 const f=o?.financial,r=f?.rolling,profit=finite(r?.ttm_parent_profit);
 let performance=profit===null?'目前缺少足夠數字，還不能確認最近一年的獲利。':`最近 12 個月截至${periodLabel(r.period)}，${profit>0?'有賺錢':profit<0?'仍在虧錢':'獲利約為零'}；屬於母公司股東的${profit<0?'虧損':'淨利'}約 ${fnum(Math.abs(profit),1)} 億元。`;
 if(r?.period&&f?.cumulative){const current=f.cumulative[r.period],prior=f.cumulative[(Number(r.period.slice(0,4))-1)+r.period.slice(4)];if(finite(current?.revenue)!==null&&finite(prior?.revenue)>0&&current.basis===prior.basis){const growth=(current.revenue/prior.revenue-1)*100;performance+=`今年截至${periodLabel(r.period).split('年')[1]}的收入（${f.basis==='合併營業收入'?'營收':f.basis||'財報收入'}），比去年同期${growth>=0?'增加':'減少'}約 ${fnum(Math.abs(growth),1)}%。`;}}
 const watch=finite(f?.h1_nonoperating_share)>=0.5?'目前資料顯示，當年上半年超過一半的稅前利益來自本業以外；要再確認這些收入能否持續。':(o?.events?.length?'下方有公司事件與進度說明，先確認計畫走到哪一步，再看是否已帶來收入。':'發展方向是要追蹤的項目；是否已完成、何時帶來收入，仍要看後續公告。');
 return '<section class="overview-block quick-company-summary"><h4>先認識這家公司</h4>'+companyMeetingBrief(stock)+'<ul class="overview-points"><li><strong>它做什麼？</strong> '+esc(brief(o?.business||p?.business?.text))+'</li><li><strong>最近生意與獲利如何？</strong> '+esc(performance)+'</li><li><strong>接下來看什麼？</strong> '+esc(brief(o?.direction||p?.new_projects?.text))+'</li><li><strong>看資料時留意：</strong> '+esc(watch)+'</li></ul><p class="tiny">這段依下方現有資料自動整理，詳細來源與日期請往下看；新季度資料匯入後，財務結論會一起更新。</p></section>';
}
function fullResearchHtml(stock){
 const p=research.profiles[stock.symbol],age=researchAge(p),ready=p?.status==='researched';
 const message=research.error?'研究資料載入失敗；已有內容可能為舊版本。':research.loading?'正在載入公司研究資料…':ready?'已有官方來源查核摘要，另附匯入概況；請核對各段資料期間。':p?.overview?'已匯入概況；官方來源與新項目細節仍待逐家查核。':'待查核：這家公司尚未完成來源整理，不代表沒有轉型或新項目。';
 const paragraph=(section)=>{if(!section)return '<p class="tiny">— 尚未取得足夠來源。</p>';return '<p>'+esc(plainResearchText(section.text))+'</p><small>資料期間：'+esc(section.period)+'</small><div class="research-refs">'+section.sources.map(id=>{const ref=p.sources[id],url=safeResearchUrl(ref?.url);return url?'<a target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">'+esc(ref.title)+' ↗</a>':''}).join('')+'</div>'};
 return '<section class="company-research" aria-label="公司研究摘要"><h3>公司研究摘要｜'+esc(stock.name)+'（'+esc(stock.symbol.slice(0,-3))+'）</h3><p class="tiny">'+esc(message)+'</p>'+(ready?'<p class="research-date">最後查核：'+esc(p.reviewed_at)+(age>=14?' · ⚠ 超過 14 天未查核':'')+'</p>':'')+quickCompanySummary(stock,p)+overviewHtml(p?.overview)+(ready?'<h4>官方來源查核摘要</h4>':'')+(ready||!p?.overview?RESEARCH_SECTIONS.map(([key,label])=>'<details'+(key==='business'?' open':'')+'><summary>'+label+'</summary>'+paragraph(p?.[key])+'</details>').join(''):'')+(ready?'<details><summary>研究限制與來源日期</summary><ul>'+p.limitations.map(x=>'<li>'+esc(plainResearchText(x))+'</li>').join('')+'</ul>'+Object.values(p.sources).map(ref=>'<p class="tiny">'+esc(ref.title)+' · '+esc(ref.publisher)+'<br>發布：'+esc(ref.published_at||'來源未提供')+' · 查閱：'+esc(ref.accessed_at)+'</p>').join('')+'</details>':'')+'<p class="tiny">公司概況依匯入檔案，官方摘要另列查核日期。事業營收比例呈現收入來源；事業獲利另看部門損益。</p></section>';
}
function validateResearch(data){
 if(data?.schema_version!==1||!data.profiles||Array.isArray(data.profiles)||typeof data.profiles!=='object')throw Error('研究資料格式錯誤');
 for(const [symbol,p] of Object.entries(data.profiles)){
  if(!/^\d{4}\.TW$/.test(symbol)||!p||!['pending','researched','overview'].includes(p.status)||!Array.isArray(p.limitations)||!p.limitations.every(x=>typeof x==='string')||!p.sources||typeof p.sources!=='object')throw Error('研究內容格式錯誤');
  if(p.overview){const o=p.overview;if(['business','direction','summary','source_reviewed_at','imported_at','status','screening'].some(k=>typeof o[k]!=='string')||!Array.isArray(o.urls)||o.urls.some(u=>!safeResearchUrl(u))||!Array.isArray(o.events)||!Array.isArray(o.outlooks))throw Error('匯入概況格式錯誤');for(const row of [...o.events,...o.outlooks])if(!Array.isArray(row.urls)||row.urls.some(u=>!safeResearchUrl(u)))throw Error('匯入來源錯誤')}
  if(p.status==='researched'){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(p.reviewed_at)||!Number.isFinite(Date.parse(p.reviewed_at)))throw Error('研究日期錯誤');
   for(const [,ref] of Object.entries(p.sources))if(!safeResearchUrl(ref.url)||typeof ref.title!=='string'||typeof ref.publisher!=='string'||typeof ref.accessed_at!=='string')throw Error('研究來源錯誤');
   for(const [key] of RESEARCH_SECTIONS){const v=p[key];if(v!=null&&(typeof v.text!=='string'||typeof v.period!=='string'||!Array.isArray(v.sources)||!v.sources.length||v.sources.some(id=>!Object.hasOwn(p.sources,id))))throw Error('段落缺少有效來源')}
  }
 }
 return data.profiles;
}
async function fetchResearch(){
 research.loading=true;
 try{const res=await fetch('./data/company-research.json?v='+Date.now(),{cache:'no-store'});if(!res.ok)throw Error('HTTP '+res.status);const profiles=validateResearch(await res.json());research.profiles=profiles;research.error=false}
 catch{research.error=true}
 finally{research.loading=false;render();if($('researchDialog')?.open){const stock=state.stocks.map(materialize).find(s=>s.symbol===researchView.symbol);if(stock){researchView.pages=companyPages(stock);renderResearchPage();}}}
}
function metricPeriod(key,m){
 if(/^cagr[35]$/.test(m?.period_mode||''))return String(m.comparison_period||'').slice(0,4)+' → '+String(m.date||'').slice(0,4)+' 年全年 EPS，'+m.period_mode.slice(-1)+' 年複合成長率（CAGR）'+(key==='peg'&&m.price_date?'；股價 '+m.price_date:'');
 if(m?.period_mode==='annual')return String(m.date||'').slice(0,4)+' 年全年 EPS（與 '+String(m.comparison_period||'').slice(0,4)+' 年全年比較）'+(key==='peg'&&m.price_date?'；股價 '+m.price_date:'');
 const value=String(m?.date||''),q=value.match(/^(\d{4})-Q([1-4])$/),month=value.match(/^(\d{4})-(\d{2})$/);
 if(q){const y=Number(q[1]),n=Number(q[2]);
  if(['eps','gross_margin'].includes(key))return y+' 年截至第 '+n+' 季（1–'+n*3+' 月累計）';
  if(['ps','peg','roe','earnings_growth','trailing_eps','trailing_sales','calculated_pe'].includes(key))return '最近 12 個月，截至 '+y+' 年第 '+n+' 季（'+(n===4?y+' 年 1 月':(y-1)+' 年 '+(n*3+1)+' 月')+'–'+y+' 年 '+n*3+' 月）';
  return y+' 年第 '+n+' 季';
 }
 if(month)return Number(month[1])+' 年 '+Number(month[2])+' 月'+(key==='revenue_growth'?'（與去年同月比較）':'');
 return value?'資料日期：'+value.replace(/-/g,'/'):'期間未提供';
}
function renderDetail(){
 const s=state.stocks.map(materialize).find(x=>x.symbol===state.selected);if(!s){$('detail').innerHTML='<div class="emptiness">選擇一檔股票，查看原始指標、研究區間與資料來源。</div>';return}
 const c=catMeta(s),it=interpretation(s),fields=[['pe','PE 本益比'],['calculated_pe','TTM 本益比（依最近四季 EPS 算）'],['pb','PB 股價淨值比'],['ps','PS 股價營收比'],['peg','PEG 本益成長比（歷史）'],['eps','EPS 每股盈餘（年初累計）'],['trailing_eps','最近四季每股盈餘（TTM EPS）'],['trailing_sales','最近四季營收（億元）'],['revenue_growth','單月營收年增率'],['earnings_growth','EPS 成長率（年增率／複合成長率，見期間）'],['gross_margin','累計毛利率'],['roe','ROE 股東權益報酬率'],['dividend_yield','殖利率']];
 const imported=research.profiles[s.symbol]?.overview,rolling=imported?.financial?.rolling;
 const usesImport=key=>rolling&&(key==='trailing_sales'||key==='trailing_eps'&&(finite(s.trailing_eps)===null||String(s.field_meta?.trailing_eps?.date||'')<rolling.period));
 const statValue=key=>usesImport(key)?rolling[key==='trailing_sales'?'ttms':'ttm_eps']:s[key];
 const statMeta=key=>usesImport(key)?{date:rolling.period,basis:'使用者匯入累計財報；'+rolling.formula,source:imported.source_filename||'使用者提供工作簿',downloaded_at:imported.imported_at,reason:statValue(key)===null?'缺少必要累計期間或口徑不同':null}:s.field_meta?.[key]||(research.profiles[s.symbol]?.calculated_metrics?.[key]?{date:research.profiles[s.symbol].calculated_metrics[key].period,basis:research.profiles[s.symbol].calculated_metrics[key].formula,reason:research.profiles[s.symbol].calculated_metrics[key].reason,period_mode:research.profiles[s.symbol].calculated_metrics[key].period_mode,comparison_period:research.profiles[s.symbol].calculated_metrics[key].comparison_period}:null);
 const percent=['gross_margin','revenue_growth','earnings_growth','roe','dividend_yield'];
 const source=(m)=>m&&/^https:\/\//.test(m.source||'')?`<a href="${esc(m.source)}" target="_blank" rel="noopener noreferrer">官方／授權来源 ↗</a>`:esc(m?.source||'尚無資料來源');
 $('detail').innerHTML=`<div class="detail-top"><div><div class="eyebrow">STOCK RESEARCH · ${esc(s.symbol)}</div><h2>${esc(s.name)}</h2><p class="tiny">${esc(s.industry)} · <b>${esc(s.category)}${c.metric?'（優先參考 '+esc(metricName(c.abbr))+' 指標）':''}</b></p></div>${star(s)}</div><div class="rule-hint"><b>${esc(c.id)}：先看 ${linkedMetricPhrase(VALUATION_GUIDE[c.id]?.metric||'產業與財報資料')}${c.metric?'：'+metricHelpLink(c.metric,ratio(s[c.metric]),s[c.metric]):''}</b><p>${esc(VALUATION_GUIDE[c.id]?.why||'資料還不足，需先確認公司如何賺錢。')}</p></div><div class="price-line"><div><span class="label">最近收盤參考價 · TWD</span><div class="price">${fnum(s.price)}</div>${weeklyChangeHtml(s)}</div><div class="tiny">股價日期<br><b>${esc(s.price_date||'未提供')}</b></div></div><div class="chart-entry"><a class="button primary" href="${esc(tvUrl(s))}" target="_blank" rel="noopener noreferrer">↗ 查看股價走勢</a><p class="tiny">在新分頁開啟 ${esc(s.name)}（${esc(s.symbol.slice(0,-3))}）的 TradingView 圖表。行情時間與可用功能以該站顯示為準。</p></div>${industryPeHtml(s)}${keywordEvidence(s)}${researchHtml(s)}<label class="label" for="manualCategory">個人研究分類</label><div class="category-edit"><select id="manualCategory" class="select"><option value="">自動：${esc(normalizeCategory(state.stocks.find(x=>x.symbol===s.symbol).category))}</option>${[...CATS.map(x=>x.id),'待分類'].map(cat=>`<option ${state.overrides[s.symbol]===cat?'selected':''}>${esc(cat)}</option>`).join('')}</select><span class="tiny">只保存在此瀏覽器</span></div><div class="focus-value"><span>主要估值 · ${c.metric?metricHelpLink(c.metric,metricName(c.abbr)):esc(c.abbr)}</span><strong>${c.metric?metricHelpLink(c.metric,ratio(s[c.metric]),s[c.metric]):'—'}</strong></div><span class="tag ${it.tone}">${esc(it.title)}</span><div class="explain"><b>${esc(it.tip)}</b><p>${esc(it.long)}</p>${it.extra?`<p>${esc(it.extra)}</p>`:''}</div><div class="stats-grid">${fields.map(([key,label])=>{const m=statMeta(key),help=statHelpKey(key),value=percent.includes(key)?pct(statValue(key)):['eps','trailing_eps','trailing_sales'].includes(key)?fnum(statValue(key)):ratio(statValue(key));return `<div class="stat"><span class="label">${help?metricHelpLink(help,label):esc(label)}</span><strong>${help?metricHelpLink(help,value,statValue(key)):esc(value)}</strong><small>${esc(metricPeriod(key,m))}</small></div>`}).join('')}</div><details><summary>各欄位來源、期間與缺值原因</summary><div class="provenance">${[['price','股價'],...fields].map(([key,label])=>{const m=statMeta(key);return `<div><b>${label} · ${esc(m?.date||'未提供')}</b><p>${esc(m?.basis||'來源未提供口徑')}<br>${source(m)}<br>下載：${esc(m?.downloaded_at||'未提供')}${m?.comparison_period?'<br>比較期間：'+esc(m.comparison_period):''}${m?.price_date?'<br>計算股價日期：'+esc(m.price_date):''}${m?.shares_date?'<br>股數資料日期：'+esc(m.shares_date):''}${m?.shares_source&&safeResearchUrl(m.shares_source)?'<br>股數來源：<a target="_blank" rel="noopener noreferrer" href="'+esc(safeResearchUrl(m.shares_source))+'">證交所公開資料 ↗</a>':''}${m?.reason?'<br>缺值原因：'+esc(m.reason):''}${m?.stale_reason?'<br>⚠ '+esc(m.stale_reason):''}</p></div>`}).join('')}</div></details><div class="links"><a class="button small" href="${esc(tvUrl(s))}" target="_blank" rel="noopener noreferrer">TradingView ↗</a><a class="button small" href="https://www.investing.com/search/?q=${encodeURIComponent(s.symbol.slice(0,-3))}" target="_blank" rel="noopener noreferrer">Investing.com ↗</a></div><p class="tiny">使用者自訂研究規則，非確定買賣訊號。不同指標可能來自不同期間；保留原始值，不將缺值視為零。</p>`;
 wireResearchButtons();wireStars($('detail'));$('manualCategory').onchange=e=>{if(e.target.value)state.overrides[s.symbol]=e.target.value;else delete state.overrides[s.symbol];persist();render()};
}
function importWatchlist(text){
 const rows=csvParse(text);if(rows.length<2)throw Error('CSV 需要標題與至少一筆代號');const headers=rows.shift().map(x=>x.trim().toLowerCase()),index=headers.indexOf('symbol')>=0?headers.indexOf('symbol'):headers.indexOf('股票代號');if(index<0)throw Error('CSV 缺少 symbol 或股票代號欄位');const categoryIndex=headers.indexOf('category');const symbols=[],overrides={...state.overrides};
 for(const row of rows){const symbol=normalized(row[index]);if(!/^\d{4}\.TW$/.test(symbol))throw Error('只接受四碼上市台股代號：'+symbol);symbols.push(symbol);const cat=row[categoryIndex]?.trim();if(CATS.some(c=>c.id===cat)||cat==='待分類')overrides[symbol]=cat}
 if(!symbols.length)throw Error('CSV 沒有有效代號');state.watchlist=[...new Set([...state.watchlist,...symbols])];state.overrides=overrides;const stored=persist();setTab('watchlist');if(stored)showNotice(`已加入 ${new Set(symbols).size} 檔自選股。股價與指標使用雲端官方資料，匯入數值不會覆蓋每日資料。`,'ok');
}
function exportWatchlist(){
 const cols=['symbol','name','category','industry',...NUM_FIELDS,'price_date','ratio_date',...NUM_FIELDS.flatMap(k=>[k+'_date',k+'_source',k+'_basis'])];const by=new Map(state.stocks.map(materialize).map(s=>[s.symbol,s]));
 const quote=v=>{let t=String(v??'');if(typeof v==='string'&&/^[=+\-@\t\r]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"'};
 const text='\ufeff'+cols.join(',')+'\r\n'+state.watchlist.map(sym=>{const s=by.get(sym)||{symbol:sym,category:state.overrides[sym]};return cols.map(k=>{const match=k.match(/^(.*)_(date|source|basis)$/);return quote(s[k]??(match?s.field_meta?.[match[1]]?.[match[2]]:null))}).join(',')}).join('\r\n');const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='stock-lens-watchlist.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function freshness(payload,status,now=new Date()){
 if(status?.state==='failed')return '更新失敗：目前顯示上一份有效資料，資料已過期，請核對各欄位日期。';
 if(status?.state==='partial')return '部分來源更新失敗：相關欄位保留舊值或顯示 —，請展開個股來源確認。';
 const date=payload.latest_price_date;if(!date)return '尚無可確認交易日期的快照。';
 const taipei=new Date(now.getTime()+8*3600000);let expected=new Date(Date.UTC(taipei.getUTCFullYear(),taipei.getUTCMonth(),taipei.getUTCDate()));if(taipei.getUTCHours()<18||(taipei.getUTCHours()===18&&taipei.getUTCMinutes()<20))expected.setUTCDate(expected.getUTCDate()-1);while([0,6].includes(expected.getUTCDay()))expected.setUTCDate(expected.getUTCDate()-1);
 if(date<expected.toISOString().slice(0,10))return '資料可能已過期／休市或來源尚未更新；最近股價日期 '+date+'。請查官方開休市日曆及 Actions。';
 return '';
}
async function fetchLive(){
 if(state.busy)return;state.busy=true;$('fetchBtn').disabled=true;showNotice('正在取得最新已發布資料…');
 try{
  const res=await fetch('./data/stocks.json?v='+Date.now(),{cache:'no-store'});if(!res.ok)throw Error('市場資料 HTTP '+res.status);const payload=await res.json();if(payload.schema_version!==2||!Array.isArray(payload.stocks))throw Error('資料格式不符，等待新版資料更新');
  const valid=payload.stocks.every(s=>/^\d{4}\.TW$/.test(s.symbol)&&s.field_meta&&NUM_FIELDS.every(k=>s[k]===null||typeof s[k]==='number'&&Number.isFinite(s[k])));if(!valid||new Set(payload.stocks.map(s=>s.symbol)).size!==payload.stocks.length)throw Error('市場資料內容無效');
  state.stocks=payload.stocks;state.payload=payload;let statusError=false;try{const sr=await fetch('./data/status.json?v='+Date.now(),{cache:'no-store'});if(!sr.ok)throw Error();state.status=await sr.json()}catch{state.status=null;statusError=true}
  $('marketDate').textContent=payload.latest_price_date||'尚無資料';$('lastUpdated').textContent='資料內容更新：'+(payload.fetched_at?new Date(payload.fetched_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'尚未成功');
  render();const warning=freshness(payload,state.status);showNotice(!state.stocks.length?'尚未產生第一份有效資料。請稍後重新載入，或檢查 GitHub Actions。':statusError?'已載入股票資料，但更新狀態無法確認；請核對各欄位日期。':warning||`已載入 ${state.stocks.length} 檔上市股票。股價日期 ${payload.latest_price_date}；財務資料依各欄位期間顯示。`,warning||statusError||!state.stocks.length?'warn':'ok');
 }catch(e){showNotice('無法載入最新快照。'+(state.stocks.length?'目前畫面為之前取得的資料。':'目前沒有可顯示的市場資料。')+' '+e.message,'error')}
 finally{state.busy=false;$('fetchBtn').disabled=false}
}
const NUM_FIELDS=['price','pe','pb','ps','peg','eps','trailing_eps','revenue_growth','earnings_growth','gross_margin','roe','dividend_yield'];
let clearedWatchlist=null;
function init(){
 CATS.forEach(c=>$('categoryFilter').insertAdjacentHTML('beforeend',`<option>${esc(c.id)}</option>`));$('categoryFilter').insertAdjacentHTML('beforeend','<option>待分類</option>');
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));$('search').oninput=e=>{state.search=e.target.value.trim().toLowerCase();state.page=1;render()};$('categoryFilter').onchange=e=>{state.filter=e.target.value;state.page=1;render()};const applySort=()=>{state.sort=$('sort').value+$('sortDirection').value;state.page=1;render()};$('sort').onchange=applySort;$('sortDirection').onchange=applySort;
 for(const k of ['priceMin','priceMax','metricMin','metricMax'])$(k).oninput=e=>{state[k]=finite(e.target.value);state.page=1;render()};
 $('clearFilters').onclick=()=>{state.search='';state.filter='全部';state.researchFilter='all';$('search').value='';$('categoryFilter').value='全部';for(const k of ['priceMin','priceMax','metricMin','metricMax']){state[k]=null;$(k).value=''}state.page=1;render()};
 $('clearWatchBtn').onclick=()=>{if(!state.watchlist.length)return;clearedWatchlist=[...state.watchlist];state.watchlist=[];persist();$('undoWatchBtn').hidden=false;setTab('watchlist');showNotice('自選股已清空。可按「復原清空」恢復；重新整理前有效。','ok')};
 $('undoWatchBtn').onclick=()=>{if(!clearedWatchlist)return;state.watchlist=[...new Set([...clearedWatchlist,...state.watchlist])];clearedWatchlist=null;persist();$('undoWatchBtn').hidden=true;render()};
 $('prevPage').onclick=()=>{state.page--;render()};$('nextPage').onclick=()=>{state.page++;render()};$('fetchBtn').onclick=()=>{fetchLive();fetchResearch();fetchMovers();fetchCalendar()};$('exportBtn').onclick=exportWatchlist;$('returnToStocks').onclick=()=>{setTab(glossaryReturn.tab);state.page=glossaryReturn.page;render();$('listTitle').scrollIntoView({behavior:'smooth',block:'start'});};
 window.addEventListener('storage',e=>{if(e.key===KEY){const p=readPreferences(localStorage);state.watchlist=p.watchlist;state.overrides=p.overrides;render()}});
 render();fetchLive();fetchResearch();initResearchUI();
}
const RESEARCH_PAGES=[['intro','先認識這家公司'],['business','公司業務與獲利來源'],['results','最近成績'],['financial','營收與每股盈餘'],['balance','債務與資產負債表'],['outlook','財測與展望'],['events','事件與進度'],['direction','發展方向'],['official','官方研究摘要'],['sources','資料來源'],['calendar','會議與更新日程']];
let researchView={symbol:null,index:0,pages:[],opener:null};
function researchHtml(stock){
 const p=research.profiles[stock.symbol];
 return '<section id="companyResearch" class="company-research research-launcher" aria-label="公司研究摘要" tabindex="-1"><h3>公司研究摘要｜'+esc(stock.name)+'（'+esc(stock.symbol.slice(0,-3))+'）</h3>'+companyMeetingBrief(stock)+'<p>選一個按鈕查看；視窗內可選其他項目，或按「上一項／下一項」。</p><div class="research-buttons">'+RESEARCH_PAGES.map(([key,label],i)=>'<button type="button" class="button research-button" data-research-page="'+i+'" data-research-symbol="'+esc(stock.symbol)+'">'+esc(label)+'</button>').join('')+'</div>'+(research.loading?'<p class="tiny">公司資料載入中，完成後按鈕內容會更新。</p>':research.error?'<p class="tiny">公司資料暫時無法載入，請按上方更新資料重試。</p>':'<p class="tiny">'+esc(stock.name)+'（'+esc(stock.symbol.slice(0,-3))+'） · '+esc(p?.overview?.source_reviewed_at||p?.reviewed_at||'尚未提供查核日期')+'</p>')+'</section>';
}
function balanceCalculations(b){
 const ratio=(a,c)=>Number.isFinite(a)&&Number.isFinite(c)&&c>0?a/c:null;
 const rows=b?.statements||[],current=rows[0]||{},old=rows.find(r=>r.date===String(Number(current.date?.slice(0,4))-1)+'-12-31');
 return {debt:ratio(current.liabilities,current.assets),current:ratio(current.current_assets,current.current_liabilities),cash:ratio(current.cash,current.current_liabilities),equityChange:old?.parent_equity>0&&Number.isFinite(current.parent_equity)?current.parent_equity/old.parent_equity-1:null};
}
function balanceSheetHtml(stock){
 const b=research.profiles[stock.symbol]?.balance_sheet,rows=b?.statements||[];
 if(!rows.length)return '<p>目前還沒有這家公司的資產負債資料。之後匯入新財報會更新這裡。</p>';
 const m=balanceCalculations(b),current=rows[0],financial=/金融|銀行|保險|證券/.test(stock.industry||'')||['fh','bank','ins','bd'].includes(current.type);
 const fraction=v=>v===null?'—':pct(v*100);
 const cards=[['負債比（所有負債占資產多少）',fraction(m.debt)],['流動比率（短期資產 ÷ 短期負債）',financial?'金融業不套用':ratio(m.current)],['現金 ÷ 短期負債',financial?'金融業另看流動性':ratio(m.cash)],['母公司股東權益較去年底變化',fraction(m.equityChange)]];
 const descriptions=[];
 if(m.debt!==null)descriptions.push('每 100 元資產，約有 '+fnum(m.debt*100,1)+' 元對應負債。負債包含應付帳款等款項，不全是銀行借款。');
 if(!financial&&m.current!==null)descriptions.push(m.current>=1?'帳面上的短期資產多於短期負債；還要看應收款收不收得回來、存貨能不能賣掉。':'帳面上的短期資產少於短期負債；需留意收付款時間、現金流與融資安排。');
 if(Number.isFinite(current.operating_cashflow))descriptions.push(current.operating_cashflow>=0?'資料期間內本業營運帶來現金淨流入。':'資料期間內本業營運為現金淨流出，要看是否為備貨、收款時間或持續消耗現金。');
 if(financial)descriptions.push('銀行、保險與金控的負債結構和一般公司不同。優先一起看資本適足率、逾放與呆帳覆蓋等資料，不用一般公司的流動比率直接判斷。');
 const fields=[['assets','總資產｜公司帳面上擁有的資源'],['liabilities','總負債｜所有需要清償的款項'],['equity','總權益｜資產扣掉負債'],['parent_equity','母公司股東權益'],['cash','現金及約當現金'],['current_assets','流動資產｜通常一年內變現或使用'],['current_liabilities','流動負債｜通常一年內到期'],['listed_borrowings','表列借款與債券'],['listed_leases','表列租賃負債']];
 const ref=url=>safeResearchUrl(url)?'<a target="_blank" rel="noopener noreferrer" href="'+esc(safeResearchUrl(url))+'">原始財報來源 ↗</a>':'未提供來源';
 return '<h3>債務與資產負債表</h3><p><strong>報表日：'+esc(current.date)+' · '+esc(current.basis)+' · 金額單位：億元</strong></p><div class="balance-summary">'+cards.map(([label,value])=>'<div class="stat"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>').join('')+'</div><ul>'+descriptions.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul><div class="research-table-wrap"><table><caption>簡明資產負債表｜期末金額</caption><thead><tr><th>項目</th>'+rows.map(r=>'<th>'+esc(r.date)+'</th>').join('')+'</tr></thead><tbody>'+fields.map(([k,label])=>'<tr><th>'+esc(label)+'</th>'+rows.map(r=>'<td>'+fnum(r[k])+'</td>').join('')+'</tr>').join('')+'</tbody></table></div><p>資產負債表是<strong>當天的帳面金額</strong>，不能把每季相加。— 表示未取得資料。</p><h4>營業現金流｜做生意有沒有帶進現金？</h4><p>'+esc(current.cashflow_period||'目前無可用期間')+'：<strong>'+fnum(current.operating_cashflow)+' 億元</strong>。這是期間內的現金流入減流出，不是銀行帳戶餘額。</p>'+(financial?'<h4>金融業監理指標</h4><p>資本適足率（'+esc(b.regulatory?.capital_type||'未取得')+'）：'+fraction(b.regulatory?.capital_adequacy??null)+'<br>逾放比率：'+fraction(b.regulatory?.npl_ratio??null)+'<br>呆帳覆蓋率：'+fraction(b.regulatory?.coverage_ratio??null)+'</p>':'')+'<p class="tiny">'+esc(b.note)+'<br>查核日：'+esc(current.reviewed_at)+'<br>'+ref(current.source_url)+' · '+ref(current.cashflow_source_url)+'</p>';
}
function companyPages(stock){
 const host=document.createElement('div');host.innerHTML=fullResearchHtml(stock);
 host.querySelectorAll('table').forEach(table=>{const wrap=document.createElement('div');wrap.className='research-table-wrap';table.replaceWith(wrap);wrap.append(table);});
 const overview=host.querySelector('.imported-overview');
 const outer=el=>el?.outerHTML||'';
 const details=[...(overview?.querySelectorAll(':scope > details')||[])];
 const body=el=>{if(!el)return '';const copy=el.cloneNode(true);copy.querySelector(':scope > summary')?.remove();return copy.innerHTML};
 const blocks=overview?.querySelectorAll(':scope > .overview-block')||[];
 const sources=[...host.querySelectorAll('.company-research > details')];
 const titled=el=>'<h3>'+esc(el.querySelector('summary')?.textContent||'資料')+'</h3>'+body(el);
 const contents=[outer(host.querySelector('.quick-company-summary')),outer(blocks[0])+outer(blocks[2]),outer(blocks[1]),body(details[0]),balanceSheetHtml(stock),body(details[1]),body(details[2]),outer(blocks[3]),sources.filter(x=>x.querySelector('summary')?.textContent!=='研究限制與來源日期').map(titled).join(''),body(details[3])+sources.filter(x=>x.querySelector('summary')?.textContent==='研究限制與來源日期').map(titled).join('')];
 return RESEARCH_PAGES.map(([key,label],i)=>({key,label,html:(key==='calendar'?calendarCompanyHtml(stock):contents[i])||'<p>目前沒有這項資料；新資料匯入後會更新。</p>'}));
}
function renderResearchPage(){
 const stock=state.stocks.map(materialize).find(s=>s.symbol===researchView.symbol);if(!stock)return;
 const page=researchView.pages[researchView.index];
 $('researchCompany').textContent=stock.name+'（'+stock.symbol.slice(0,-3)+'）';$('researchPageTitle').textContent=page.label+(page.key==='balance'?'（金額單位：億元）':'');
 $('researchPageBody').innerHTML=page.html;$('researchPageBody').scrollTop=0;wireCalendarCompanies($('researchPageBody'));

 $('researchPageTabs').innerHTML=researchView.pages.map((p,i)=>'<button class="button small '+(i===researchView.index?'active':'')+'" type="button" role="tab" aria-selected="'+(i===researchView.index)+'" data-modal-page="'+i+'">'+esc(p.label)+'</button>').join('');
 $('researchPagePosition').textContent=(researchView.index+1)+' / '+researchView.pages.length;
 $('researchPrev').disabled=researchView.index===0;$('researchNext').disabled=researchView.index===researchView.pages.length-1;
 $('researchPageTabs').querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest',inline:'nearest'});
 $('researchPageTabs').querySelectorAll('[data-modal-page]').forEach(b=>b.onclick=()=>changeResearchPage(Number(b.dataset.modalPage),true));wireMetricHelp();
}
function changeResearchPage(value,absolute=false){const index=absolute?value:researchView.index+value;if(index<0||index>=researchView.pages.length)return;researchView.index=index;renderResearchPage();}
function openCompanyResearch(symbol,index,opener){
 const stock=state.stocks.map(materialize).find(s=>s.symbol===symbol);if(!stock)return;
 researchView={symbol,index,pages:companyPages(stock),opener};renderResearchPage();if(!$('researchDialog').open)$('researchDialog').showModal();
}
function wireResearchButtons(){document.querySelectorAll('[data-research-page]').forEach(b=>b.onclick=()=>openCompanyResearch(b.dataset.researchSymbol,Number(b.dataset.researchPage),b));}
function selectCompany(symbol){state.selected=symbol;render();if(window.matchMedia('(max-width:1099px)').matches)$('companyResearch')?.scrollIntoView({behavior:'smooth',block:'start'});}
let movers={payload:null,error:false,period:'5'};
function moverSummary(rows){const counts=new Map();for(const r of rows)counts.set(r.industry,(counts.get(r.industry)||0)+1);const sorted=[...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));return rows.length?'共 '+rows.length+' 家符合條件，其中'+sorted.slice(0,3).map(([name,n])=>name+' '+n+' 家').join('、')+'。'+(sorted[0]?.[1]===1?'分布較分散。':'這是榜單的產業分布。'):'這段期間沒有符合條件的股票。';}
function renderMovers(){
 const root=$('marketMovers');if(!root)return;const p=movers.payload?.periods?.[movers.period];
 $('moversPeriod').value=movers.period;
 if(!p){$('moversContent').innerHTML='<p>'+esc(movers.error?'暫時無法載入漲跌排行，請稍後更新。':'這個期間的歷史股價尚未補齊，暫不排名。')+'</p>';return;}
 $('moversContent').innerHTML='<p class="tiny">'+(p.start?esc(p.start)+' → ':'官方前一日比較基準 → ')+esc(p.end)+' · '+p.count+' 家可比較公司 · 按漲跌百分比排名</p><div class="mover-grid">'+[['gainers','最近夯什麼？','漲幅超過 5%'],['losers','最近最不夯什麼？','跌幅超過 5%']].map(([key,title,sub])=>'<section class="mover-card"><h3>'+title+'<small>'+sub+'</small></h3><p>'+esc(moverSummary(p[key]))+'</p><ol>'+p[key].map(r=>'<li><button type="button" class="mover-company" data-mover-symbol="'+esc(r.symbol)+'"><span><b>'+esc(r.name)+'</b> '+esc(r.symbol.slice(0,-3))+'<small>'+esc(r.industry)+'</small></span><strong class="'+(r.change>0?'rise':'fall')+'">'+(r.change>0?'+':'')+pct(r.change)+'</strong></button></li>').join('')+'</ol></section>').join('')+'</div><p class="tiny">這裡的「夯／不夯」只指股價漲跌，不代表公司好壞。'+esc(movers.payload.basis)+'列出所有漲幅或跌幅超過 5% 的公司，不限十家；一般漲停、跌停公司也包含在內。漲停、跌停是單日限制，一週或一個月的累計漲跌不稱為漲停、跌停。族群依公司產業整理，未判定漲跌原因。</p>';
 $('moversContent').querySelectorAll('[data-mover-symbol]').forEach(b=>b.onclick=()=>{$('moversDialog').close();state.filter='全部';state.search=b.dataset.moverSymbol.slice(0,-3);$('search').value=state.search;$('categoryFilter').value='全部';for(const key of ['priceMin','priceMax','metricMin','metricMax']){state[key]=null;$(key).value='';}setTab('all');selectCompany(b.dataset.moverSymbol);$('companyResearch')?.scrollIntoView({behavior:'smooth',block:'start'});});
}
async function fetchMovers(){try{const response=await fetch('./data/market-movers.json?v='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error();const payload=await response.json();if(payload.schema_version!==1||!payload.periods)throw Error();for(const p of Object.values(payload.periods))for(const r of [...p.gainers,...p.losers])if(!/^\d{4}\.TW$/.test(r.symbol)||!Number.isFinite(r.change))throw Error();movers.payload=payload;movers.error=false;}catch{movers.error=true;}renderMovers();render();}
function initResearchUI(){
 $('peerPeClose').onclick=()=>$('peerPePopover').hidePopover();
 $('peerHelpOpen').onclick=()=>$('peerHelpPopover').showPopover();$('peerHelpClose').onclick=()=>$('peerHelpPopover').hidePopover();$('peerHelpFull').onclick=()=>{$('peerHelpPopover').hidePopover();glossaryReturn={tab:state.tab==='watchlist'?'watchlist':'all',page:state.page};setTab('rules');$('rules').scrollIntoView({behavior:'smooth',block:'start'});};
 $('calendarOpen').onclick=()=>$('calendarDialog').showModal();$('calendarClose').onclick=()=>$('calendarDialog').close();$('calendarDialog').addEventListener('close',()=>$('calendarOpen').focus());for(const [id,view] of [['calendarUpcoming','upcoming'],['calendarQueue','queue']])$(id).onclick=()=>{calendar.view=view;renderCalendar();};fetchCalendar();
 $('metricHelpClose').onclick=()=>$('metricHelpPopover').hidePopover();$('metricHelpFull').onclick=showFullMetricHelp;
 $('researchClose').onclick=()=>$('researchDialog').close();$('researchPrev').onclick=()=>changeResearchPage(-1);$('researchNext').onclick=()=>changeResearchPage(1);
 $('researchDialog').addEventListener('close',()=>researchView.opener?.focus());
 $('researchDialog').addEventListener('keydown',e=>{if(e.target.closest('input,select,textarea'))return;if(e.key==='ArrowLeft'){e.preventDefault();changeResearchPage(-1);}if(e.key==='ArrowRight'){e.preventDefault();changeResearchPage(1);}});
 let touch=null;const body=$('researchPageBody');body.addEventListener('touchstart',e=>{touch=e.target.closest('.research-table-wrap')?null:{x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});body.addEventListener('touchend',e=>{if(!touch)return;const x=e.changedTouches[0].clientX-touch.x,y=e.changedTouches[0].clientY-touch.y;if(Math.abs(x)>70&&Math.abs(x)>Math.abs(y)*1.5)changeResearchPage(x<0?1:-1);touch=null;},{passive:true});
 $('moversPeriod').onchange=e=>{movers.period=e.target.value;renderMovers();};$('moversOpen').onclick=()=>$('moversDialog').showModal();$('moversClose').onclick=()=>$('moversDialog').close();$('moversDialog').addEventListener('close',()=>$('moversOpen').focus());fetchMovers();
}

let calendar={payload:null,error:false,view:'upcoming'};
function calendarEventHtml(e){
 const range=e.end_date&&e.end_date!==e.date?' 至 '+e.end_date:'';
 return '<article class="calendar-event"><h3>'+esc(e.name)+'（'+esc(e.symbol.slice(0,-3))+'） · '+esc(e.kind)+'</h3><p><b>'+esc(e.date+range)+(e.time?' '+esc(e.time):'')+'</b>'+(e.location?' · '+esc(e.location):'')+'</p><p>'+esc(e.reason||e.description||'')+'</p>'+(e.due_date?'<p>建議更新日：'+esc(e.due_date)+' · 摘要資料日期：'+esc(e.summary_reviewed_at||'未提供')+'</p>':e.kind!=='重大訊息'?'<p>摘要安排：會議結束翌日，補讀簡報或議事資料。</p>':'')+'<div class="links"><button class="button small" type="button" data-calendar-symbol="'+esc(e.symbol)+'">查看公司資料</button>'+(safeResearchUrl(e.source)?'<a class="button small" href="'+esc(e.source)+'" target="_blank" rel="noopener noreferrer">官方公告 ↗</a>':'')+'</div></article>';
}
function companyMeetingBrief(stock){
 const c=calendar.payload?.companies?.[stock.symbol];if(!c)return '';
 const events=[c.next_conference,c.next_shareholders].filter(Boolean);
 return '<div class="company-meeting-brief"><b>重要會議時間</b>'+(events.length?events.map(e=>'<p>'+esc(e.kind)+'：<strong>'+esc(e.date+(e.end_date!==e.date?' 至 '+e.end_date:'')+(e.time?' '+e.time:''))+'</strong>'+(e.location?' · '+esc(e.location):'')+'</p>').join(''):'<p>目前查詢範圍未查得未來場次。</p>')+'</div>';
}
function calendarCompanyHtml(stock){
 const p=calendar.payload,c=p?.companies?.[stock.symbol];
 if(!p)return '<p>公司會議日程'+(calendar.error?'暫時無法載入。':'載入中。')+'</p>';
 const upcoming=[c?.next_conference,c?.next_shareholders].filter(Boolean),queue=p.update_queue.filter(e=>e.symbol===stock.symbol);
 return '<h3>下次會議與摘要更新</h3><p>日程資料日期：'+esc(p.as_of)+'。'+(p.errors?.length?'部分來源更新失敗，請點官方公告確認最新安排。':'依官方已公告日期整理。')+'</p>'+['法說會','股東會'].map((label,i)=>'<p><b>下次'+label+'：</b>'+([c?.next_conference,c?.next_shareholders][i]?esc([c.next_conference,c.next_shareholders][i].date+([c.next_conference,c.next_shareholders][i].end_date!==[c.next_conference,c.next_shareholders][i].date?' 至 '+[c.next_conference,c.next_shareholders][i].end_date:'')):'目前查詢範圍未查得未來場次')+'</p>').join('')+upcoming.map(calendarEventHtml).join('')+'<h3>摘要更新待辦</h3>'+(queue.length?queue.map(calendarEventHtml).join(''):'<p>目前沒有依已收錄公告產生的更新待辦。</p>')+'<p class="tiny">會議日程每天查詢；摘要仍需讀完會後簡報與公告再整理。股價、月營收及已支援的財報數字依每日資料流程更新。</p>';
}
function wireCalendarCompanies(root){root.querySelectorAll('[data-calendar-symbol]').forEach(b=>b.onclick=()=>{if($('calendarDialog').open)$('calendarDialog').close();if($('researchDialog').open)$('researchDialog').close();state.filter='全部';state.search=b.dataset.calendarSymbol.slice(0,-3);$('search').value=state.search;$('categoryFilter').value='全部';for(const key of ['priceMin','priceMax','metricMin','metricMax']){state[key]=null;$(key).value='';}setTab('all');selectCompany(b.dataset.calendarSymbol);$('companyResearch')?.scrollIntoView({behavior:'smooth',block:'start'});});}
function renderCalendar(){
 const p=calendar.payload,root=$('calendarContent');if(!root)return;
 if(!p){root.innerHTML='<p>'+esc(calendar.error?'日程暫時無法載入，請稍後更新。':'正在載入公司日程…')+'</p>';return;}
 const upcoming=p.events.filter(e=>e.kind!=='重大訊息'&&!e.cancelled&&(e.end_date||e.date)>=p.as_of),queue=p.update_queue;
 $('calendarUpcoming').textContent='即將開會（'+upcoming.length+' 場）';$('calendarQueue').textContent='摘要更新待辦（'+queue.length+' 項）';
 $('calendarUpcoming').setAttribute('aria-selected',String(calendar.view==='upcoming'));$('calendarQueue').setAttribute('aria-selected',String(calendar.view==='queue'));
 const rows=calendar.view==='queue'?queue:upcoming;
 root.innerHTML='<p>日程資料日期：'+esc(p.as_of)+'。法說會查詢前一個月到未來兩個月；股東會依官方公告。'+(p.errors?.length?'部分來源更新失敗，保留已有資料。':'')+'</p><p>股價、月營收與已支援的財報數字每日更新；摘要待辦用來安排閱讀會後簡報、議事資料及重大訊息；<b>完成整理後，再更新摘要資料日期</b>。</p>'+(rows.length?rows.map(calendarEventHtml).join(''):'<p>目前沒有符合條件的項目。</p>');wireCalendarCompanies(root);
}
async function fetchCalendar(){try{const r=await fetch('./data/company-calendar.json?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error();const p=await r.json();if(p.schema_version!==1||!Array.isArray(p.events)||!Array.isArray(p.update_queue)||!p.companies)throw Error();calendar.payload=p;calendar.error=false;}catch{calendar.error=true;}renderCalendar();render();if($('researchDialog')?.open){const s=state.stocks.map(materialize).find(s=>s.symbol===researchView.symbol);if(s){researchView.pages=companyPages(s);renderResearchPage();}}}
function weeklyChangeHtml(stock){
 const p=movers.payload?.periods?.['5'],v=finite(p?.changes?.[stock.symbol]);
 if(!p||stock.price_date!==p.end||v===null)return '<small>近一週漲跌幅：—</small>';
 return '<small class="'+(v>0?'rise':v<0?'fall':'')+'" title="'+esc(p.start+' 至 '+p.end+'，最近 5 個交易日；收盤價變動，未還原除權息')+'">近一週 '+(v>0?'+':'')+pct(v)+'</small>';
}

init();
