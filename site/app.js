'use strict';
const CATS=[
 {id:'週期股',metric:'pb',abbr:'PB',sub:'鋼鐵・塑化・航運・面板',why:'景氣谷底 EPS 可能接近零或轉負，PE 容易失真；PB 需配合歷史分位、供需、產能出清與資產減損。'},
 {id:'重資產股',metric:'pb',abbr:'PB',sub:'銀行・保險・金融',why:'淨資產與資產品質是重要的分析起點，但帳面淨值不保證是股價底線；需同看 ROE、呆帳、資本適足率與負債。'},
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

function interpretation(s){const meta=catMeta(s),v=primary(s);if(!meta.metric)return{title:'需要手動分類',tone:'neutral',tip:'尚未能確認此公司適用哪一項主指標。',long:'請確認產業、獲利與成長特性後，選擇合適分類。',pos:50};if(meta.id==='虧損企業'&&/(clinical|pre.revenue|drug discovery|biotech|新藥研發|臨床前|臨床試驗)/.test((s.industry||'').toLowerCase())&&finite(s.revenue_growth)===null&&finite(s.gross_margin)===null)return{title:'研發生技：PS 參考性低',tone:'neutral',tip:'尚未確認可比較的產品營收',long:'對於尚未確認產品銷售的研發生技公司，PS 通常缺乏可比性；應另查臨床里程碑、現金水位、現金消耗與授權收入。',pos:50};if(v===null)return{title:'無法判讀',tone:'neutral',tip:`${meta.abbr} 缺值或不適用`,long:`目前缺少有效的 ${meta.abbr} 正數資料；保留原始資料，請從來源頁確認。${meta.metric==='peg'?' PEG 在 EPS 為負、成長率非正或計算期間不一致時尤其容易失真。':''}`,pos:50};
 if(meta.id==='高成長股'){
  let r=v<.5?['極低 PEG／市場可能有疑慮','caution','先核對增長率與獲利品質；低值不代表必然低估','成長速度相對 PE 很高，也可能反映市場不認同預測。應核對 G 的計算口徑、成長能否持續及獲利品質。',10]:v<1?['成長與估值相對平衡區','positive','確認 G 後，再比較歷史與同業','在這套研究規則中屬相對具吸引力的區間；仍須確認成長率可靠性與估值口徑。',27]:v<1.5?['成長溢價常態區','neutral','關注競爭優勢與成長持續性','較高的確定性可能支持成長溢價，但應與歷史 PEG 及同業比較。',45]:v<=2?['偏高／過渡區','caution','1.5–2.0：原規則未設明確區間','PE 相對成長率偏高；原始區間對 1.5–2.0 未給定硬性結論，建議檢查預期修正風險。',65]:['未來成長預期較高','risk','PEG > 2：須注意成長不及預期的風險','若市場給予的定價需要多年高成長才能支撐，EPS 或成長預期下修可能伴隨估值收縮；不能由 PEG 單獨推斷跌幅。',90];if(finite(s.trailing_eps)!==null&&s.trailing_eps<=0)return{title:'PEG 不適用：EPS 非正',tone:'neutral',tip:'即使來源提供 PEG，仍需確認預估盈餘口徑',long:'當期 EPS 為零或負數，傳統 PE／PEG 不具可比性；先釐清來源是否使用預估轉盈。',pos:50};return{title:r[0],tone:r[1],tip:r[2],long:r[3],pos:r[4],extra:s.peg_basis||'請確認 PEG 採用歷史或預估 PE／成長率'}
 }
 if(meta.id==='重資產股'){
  let r=v<.7?['深度折價／資產品質警訊','risk','低 PB 須查呆帳、負債與淨值品質','市場可能質疑資產可回收價值、資本適足率或長期 ROE；折價不等於有安全底線。',10]:v<1?['淨值折價區','caution','0.7–1.0：確認 ROE／配息持續性','在這套規則中接近傳統金融估值的折價區；需核對資產品質、資本結構及經常性獲利。',32]:v<=1.5?['績優資產估值區','positive','1.0–1.5：搭配持續 ROE 觀察','較高 PB 往往需要穩定的資本報酬支撐；可檢查 ROE 是否接近 10%–15%。',53]:v<=2?['溢價／過渡區','caution','1.5–2.0：原規則未設定明確結論','需要更高或更持久的 ROE、資產品質與市場地位來支持溢價。',73]:['高淨值溢價','risk','PB > 2：查驗高 ROE 能否持續','高於 2 倍 PB 須檢查是否有持久的超額 ROE、低資本需求或特定會計因素。',92];return{title:r[0],tone:r[1],tip:r[2],long:r[3],pos:r[4]}
 }
 if(meta.id==='週期股'){
  let r=v<.8?['景氣低估值候選區','caution','PB < 0.8：確認資產與景氣是否見底','可能反映景氣低迷，也可能是結構性需求下滑、淨值減損或資金壓力；不能單憑破淨判斷底部。',10]:v<1.2?['折價／復甦觀察區','positive','0.8–1.2：觀察報價是否止跌','供需與產品報價若改善，才可能支持復甦推論；仍應對照歷史 PB。',32]:v<1.5?['復甦至擴張過渡區','neutral','1.2–1.5：原規則的銜接區','由中低 PB 往較高水準移動，應核對產品報價、庫存、產能利用率及歷史估值分位。',49]:v<=2.5?['景氣擴張定價區','caution','1.5–2.5：須辨識當期獲利是否過熱','產品漲價與利潤擴張可能推升 PB；特別注意 PE 因週期高點獲利而變得很低。',66]:v<=3?['高檔／過渡區','risk','2.5–3.0：留意週期回落風險','接近這套規則的極端區間，需查供需擴產、報價及 ROE 是否難以維持。',83]:['極高週期估值區','risk','PB > 3：警惕低 PE 的景氣高峰陷阱','PB 極高且當期 PE 極低，可能意味獲利處於週期高峰；須與歷史估值及產能週期交叉檢驗。',94];return{title:r[0],tone:r[1],tip:r[2],long:r[3],pos:r[4]}
 }
 if(meta.id==='虧損企業'){
  const gm=finite(s.gross_margin),industry=(s.industry||'').toLowerCase();const preRevenue=/(clinical|pre.revenue|drug discovery|biotech|新藥研發|臨床前|臨床試驗)/.test(industry)&&finite(s.revenue_growth)===null&&gm===null;
  if(preRevenue)return{title:'研發型生技：PS 參考性低',tone:'neutral',tip:'尚未確認產品營收',long:'產品尚未商業化時，PS 可能因營收基期太低而失真；應優先觀察臨床與監管里程碑、現金水位及燒錢速度。',pos:50};
  if(gm===null)return{title:'待確認毛利率',tone:'neutral',tip:`PS ${ratio(v)}；需先判斷低毛利或高毛利`,long:'PS 同一數值對電商／物流與 SaaS 意義不同；目前缺少毛利率，先不要套用兩套門檻。',pos:50};
  if(gm>30&&gm<50)return{title:'中間毛利：不套用兩極門檻',tone:'neutral',tip:`毛利率 ${pct(gm)}；兩類規則都不完全適用`,long:'本規則以 ≤30% 作低毛利、≥50% 作高毛利的示意分流；中間毛利率需參照同業淨利潛力。',pos:50};
  const high=gm>=50;
  let r;if(high){r=v<2?['異常低 PS／查明原因','caution','高毛利 PS < 2：留意需求與營收品質','高毛利企業卻以極低 PS 定價，可能反映成長停滯、客戶流失、現金壓力或一次性收入。',10]:v<5?['高毛利相對低 PS 區','positive','PS 2–5：配合營收增長與留存率','若毛利高且營收持續擴張，這套規則視為較有比較價值的區間；仍須檢查 CAC、留存及現金消耗。',30]:v<=10?['高毛利擴張估值區','neutral','PS 5–10：成長率須支撐定價','高毛利軟體公司可能在此區間，但仍取決於收入成長、獲利路徑與利率環境。',58]:v<=15?['較高 PS／過渡區','caution','PS 10–15：原規則未設硬性區間','需特別檢驗營收成長、續約率、單位經濟與轉盈時間。',76]:['高毛利極高 PS 區','risk','PS > 15：須有很高成長與護城河支撐','高 PS 对成長預測和資金成本敏感，營收放緩可能引發估值壓縮。',94]}else{r=v<2?['低毛利相對可比較區','neutral','PS < 2：仍要看最終淨利率','薄毛利模式長期可產生的淨利有限，應核對營收品質、規模經濟、現金流與負債。',12]:v<3?['低毛利估值偏高','caution','PS 2–3：需要規模與獲利改善','毛利偏薄的公司若 PS 提高，需要更強的營收成長或營運效率支持。',36]:v<5?['低毛利明顯偏高','risk','PS 3–5：確認是否有結構性轉型','以低毛利模式而言，較高 PS 對長期獲利能力的要求很高。',60]:v<=10?['低毛利高風險 PS 區','risk','PS 5–10：高度依賴獲利模式改善','若毛利及淨利率沒有結構性提升，高 PS 可能較難由最終盈餘支撐。',78]:v<=15?['低毛利極高 PS 區','risk','PS 10–15：顯著高於本規則常態','必須驗證營收成長、現金流與轉型可行性。',87]:['低毛利極端 PS 區','risk','PS > 15：風險與預期均極高','低毛利公司承受高 PS，需要極不尋常的可持續增長或商業模式改善。',95]};return{title:r[0],tone:r[1],tip:r[2],long:r[3],pos:r[4],extra:`毛利率 ${pct(gm)}｜依${high?'高':'低'}毛利規則`}
 }
 return{title:'以同業與歷史 PE 對照',tone:'neutral',tip:'穩定獲利股未設定一體適用的 PE 門檻',long:'這一類採用 PE 為主，但你尚未指定 PE 數值區間，因此保留原始倍數、不自動貼低估／高估標籤。建議比較 5–10 年歷史 PE、同業、EPS 品質與成長。',pos:50};
}

function tvUrl(s){let sym=s.symbol;if(sym.endsWith('.TW'))return'https://www.tradingview.com/chart/?symbol='+encodeURIComponent('TWSE:'+sym.slice(0,-3));if(sym.endsWith('.TWO'))return'https://www.tradingview.com/chart/?symbol='+encodeURIComponent('TPEX:'+sym.slice(0,-4));let ex=/NMS|NAS|NGM|NCM/i.test(s.exchange||'')?'NASDAQ:':/NYQ|NYS/i.test(s.exchange||'')?'NYSE:':'';return'https://www.tradingview.com/chart/?symbol='+encodeURIComponent(ex+sym)}

const RULE_SECTIONS=[
 {id:'高成長股',rows:[['< 0.5','極低 PEG／可能有市場疑慮','核對增長率 G 的真實度與可持續性。'],['0.5–1.0','成長相對估值有利','先驗證 EPS 成長、獲利口徑與競爭優勢。'],['1.0–1.5','成長溢價常態候選','較高確定性可能支撐溢價。'],['1.5–2.0','過渡區','原規則未給固定判斷，需看預期修正。'],['> 2.0','未來成長定價偏高','對業績不如預期較敏感；非必然下跌。']],note:'PEG = PE ÷ EPS 成長率（使用百分點，例如 30% 輸入 30）；各網站的歷史／預估口徑不同。'},
 {id:'重資產股',rows:[['< 0.7','深度折價或資產品質疑慮','先查不良資產、減損、負債與資本適足。'],['0.7–1.0','相對淨值折價','核對 ROE、資本品質與配息可持續性。'],['1.0–1.5','績優重資產常態候選','可對照 ROE 約 10%–15% 的持續性。'],['1.5–2.0','溢價過渡區','需更多 ROE 與資產優勢支撐。'],['> 2.0','高淨值溢價','檢驗持久超額 ROE 與會計淨值口徑。']],note:'金融與保險的會計淨值、資本結構及槓桿各不相同；低於 1 倍 PB 不代表資產保本。'},
 {id:'週期股',rows:[['< 0.8','景氣低估值候選','同時排除結構性衰退、減損或資金風險。'],['0.8–1.2','折價／復甦觀察','核對產品報價、供需與產能利用率。'],['1.2–1.5','復甦過渡區','原規則未給硬性結論。'],['1.5–2.5','景氣擴張定價','注意當期 PE 可能因高峰獲利而偏低。'],['2.5–3.0','高檔過渡區','留意新增產能與景氣轉折。'],['> 3.0','極高週期估值','警惕高 PB 加極低 PE 的峰值陷阱。']],note:'塑化、鋼鐵、航運、水泥、造紙、面板、礦業、油氣與部分機械均可列入研究；PB 門檻需搭配自身歷史分位。'},
 {id:'虧損企業',rows:[['< 2','低毛利：相對可比較；高毛利：異常偏低','低 PS 可能有機會，也可能是需求衰退或現金流壓力。'],['2–5','低毛利：偏高；高毛利：相對低估值候選','高毛利企業須檢查增長、留存、成本及轉盈路徑。'],['5–10','低毛利：高風險；高毛利：擴張估值區','需要成長與毛利支撐，不能只看營收。'],['10–15','過渡／偏高區','原規則未給兩類公司完整門檻。'],['> 15','兩類均屬極高 PS','對長期高成長與商業模式要求高。']],note:'這版示意分流：毛利率 ≤30% 視為低毛利；≥50% 視為高毛利；30%–50% 不硬套。新藥研發若尚未有產品營收，PS 通常不適用。'},
 {id:'穩定獲利股',rows:[['PE（原始值）','保留，不自動貼標籤','依公司自身歷史 PE、同業、成長、利率與 ROE 比較。'],['PE ≤ 0 或缺漏','不適用','虧損、盈餘異常或資料不足時，不以 PE 評估。']],note:'穩定獲利公司的合理 PE 受成長、風險與利率影響，這裡不設定通用的買進或賣出倍數。'}
];
const VALUATION_GUIDE={
 '週期股':{metric:'PB 股價淨值比（參考起點）',why:'收入與獲利會隨景氣大幅波動，先把股價與帳面淨值比較，再看景氣位置。',also:'產品報價、供需、產能利用率、資產減損，以及正常景氣時能賺多少錢。',note:'PB 也不是所有週期公司的最佳方法；可以搭配正常景氣獲利計算的 PE。景氣高峰時公司賺特別多，PE 可能很低，這時仍可能有景氣回落風險。'},
 '重資產股':{metric:'PB 股價淨值比＋ROE 股東權益報酬率',why:'本站這類主要是金融公司。除了看股價相對淨值多少倍，也要看公司能用股東資金賺多少錢。',also:'呆帳與資產品質、資本是否充足、槓桿與獲利持續性。',note:'製造業、電廠等其他重資產公司不一定優先用 PB；也要看負債與現金流。低於帳面淨值時，先確認帳面資產是否仍有價值。'},
 '虧損企業':{metric:'PS 股價營收比（有實際營收時）',why:'公司尚未有正的盈餘，PE 通常無法合理比較；可先看市場用多少市值評價每 1 元營收。',also:'毛利率、營收成長、每月燒多少現金、手上現金能撐多久，以及何時可能轉盈。',note:'沒有產品營收的研發型生技公司，PS 也可能算不出或沒有意義；要看研發進度與現金。不同利潤率的公司不能只比較 PS 倍數。'},
 '高成長股':{metric:'PEG 本益成長比（盈餘成長資料可靠時）',why:'一起比較本益比與每股盈餘的成長速度，幫助理解成長預期與股價的關係。',also:'成長來自什麼、是否能持續、估計是否可靠、ROE 與現金流。',note:'成長要用 EPS，不能把營收成長直接放進 PEG。本站分類先用單月營收篩選，但 PEG 使用歷史 TTM EPS 成長；兩者是不同步驟。PEG 低於 1 也不能直接判斷便宜。'},
 '穩定獲利股':{metric:'PE 本益比（獲利正常且可持續時）',why:'以股價相對每股盈餘多少倍，與公司的歷史及相似同業比較。',also:'本業是否持續賺錢、現金流、ROE、負債，以及一次性的投資收益或賣資產利益。',note:'同樣 PE 倍數，成長與風險不同，評價也可能不同。先確認多年獲利品質，不能只因今年 EPS 是正數就認定穩定。'}
};
function renderRules(){
 $('rulesGrid').innerHTML=RULE_SECTIONS.map(section=>{const cat=CATS.find(c=>c.id===section.id),guide=VALUATION_GUIDE[section.id];return `<article class="rule-card"><h3>${esc(section.id)}</h3><div class="priority-metric"><span>★ 這類公司先看什麼？</span><strong>${esc(guide.metric)}</strong></div><p>${esc(guide.why)}</p><p><b>還要一起看：</b>${esc(guide.also)}</p><div class="rule-hint"><b>判讀重點：</b>${esc(guide.note)}</div><details><summary>本站如何自動分到這一類？</summary><p>${esc(cat.why)}</p></details><details><summary>倍數區間：學習參考，需搭配歷史與同業</summary><table><thead><tr><th>區間</th><th>參考情境</th><th>查看重點</th></tr></thead><tbody>${section.rows.map(r=>`<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join('')}</tbody></table><div class="rule-hint">${esc(section.note)}</div></details></article>`}).join('');
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
function materialize(s){
 const result={...s,field_meta:{...s.field_meta},category:normalizeCategory(state.overrides[s.symbol]||s.category)||'待分類'};
 const profile=research.profiles[s.symbol],metrics=profile?.calculated_metrics||{};
 for(const [key,m] of Object.entries(metrics)){
  if(!Number.isFinite(m.value)||(finite(result[key])!==null&&key!=='calculated_pe'))continue;
  result[key]=m.value;
  result.field_meta[key]={date:m.period,basis:'依匯入財報計算；'+m.formula,source:profile.overview?.source_filename||'使用者提供工作簿',downloaded_at:profile.overview?.imported_at,reason:null,comparison_period:m.comparison_period,price_date:m.price_date,shares_date:m.shares_date,shares_source:m.shares_source};
 }
 return result;
}
function showNotice(message,type='warn'){$('notice').textContent=message;$('notice').className='notice '+type}
function toggleWatch(symbol){state.watchlist=state.watchlist.includes(symbol)?state.watchlist.filter(x=>x!==symbol):[...state.watchlist,symbol];persist();render()}
function setTab(tab){state.tab=tab;state.page=1;document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('selected',b.dataset.tab===tab);b.setAttribute('aria-selected',String(b.dataset.tab===tab))});$('dashboard').hidden=!['all','watchlist'].includes(tab);$('rules').hidden=tab!=='rules';$('sources').hidden=tab!=='sources';if(tab==='rules')renderRules();render()}
const TOPIC_SYNONYMS=[['矽光子','硅光子','siph','silicon photonics'],['人工智慧','人工智能','ai'],['共同封裝光學','共封裝光學','cpo']];
const searchCache=new WeakMap();
function normalizeSearch(value){return String(value||'').normalize('NFKC').toLowerCase()}
function queryGroups(query){const normalized=normalizeSearch(query).trim();const whole=TOPIC_SYNONYMS.find(g=>g.includes(normalized));return whole?[whole]:normalized.split(/\s+/).filter(Boolean).map(term=>TOPIC_SYNONYMS.find(g=>g.includes(term))||[term])}
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
function matchesStockSearch(stock,query){
 const groups=queryGroups(query),base=normalizeSearch([stock.symbol,stock.name,stock.industry,stock.category].join(' ')),entries=researchSearchEntries(research.profiles[stock.symbol]);
 return groups.every(g=>g.some(term=>hasSearchTerm(base,term)||entries.some(e=>hasSearchTerm(e.normalized,term))));
}
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
 return arr.sort((a,b)=>{
  if(['symbol','category'].includes(field))return direction*String(a[field]||'').localeCompare(String(b[field]||''),'zh-TW')||a.symbol.localeCompare(b.symbol);
  const x=field==='metric'?primary(a):finite(a[field]),y=field==='metric'?primary(b):finite(b[field]);
  if(x===null&&y===null)return a.symbol.localeCompare(b.symbol);
  return x===null?1:y===null?-1:direction*(x-y)||a.symbol.localeCompare(b.symbol);
 })

}
function star(s){const watched=state.watchlist.includes(s.symbol);return `<button class="star ${watched?'on':''}" data-star="${esc(s.symbol)}" aria-label="${watched?'移除':'加入'}自選股 ${esc(s.symbol)}" aria-pressed="${watched}">${watched?'★':'☆'}</button>`}
function wireStars(root){root.querySelectorAll('[data-star]').forEach(b=>b.onclick=e=>{e.stopPropagation();toggleWatch(b.dataset.star)})}
function render(){
 const done=state.stocks.filter(s=>research.profiles[s.symbol]?.status==='researched').length;
 const overview=state.stocks.filter(s=>research.profiles[s.symbol]?.overview).length;
 $('researchCoverage').textContent=research.loading?'公司研究載入中…':research.error?'公司研究載入失敗；稍後按更新重試。':`公司概況 ${overview}／${state.stocks.length} 家 · 官方來源查核摘要 ${done} 家`;
 $('watchCount').textContent=state.watchlist.length;$('marketCount').textContent=state.stocks.length.toLocaleString('zh-TW');
 $('categoryCards').innerHTML=CATS.map(c=>`<button class="metric-card ${state.filter===c.id?'active':''}" data-category="${esc(c.id)}"><span class="cap">${esc(c.id)} <b>${metricName(c.abbr)}</b></span><strong>${state.stocks.map(materialize).filter(s=>s.category===c.id).length}</strong><span class="tiny">${esc(c.sub)}</span></button>`).join('');
 document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{state.filter=state.filter===b.dataset.category?'全部':b.dataset.category;$('categoryFilter').value=state.filter;state.page=1;render()});
 const arr=visibleStocks(),pages=Math.max(1,Math.ceil(arr.length/state.size));state.page=Math.min(state.page,pages);
 if(!arr.some(s=>s.symbol===state.selected))state.selected=arr[0]?.symbol||null;
 $('listTitle').textContent=state.tab==='watchlist'?'我的自選股':'全部上市股票';$('rowCount').textContent=`${arr.length} 檔`;
 $('pageLabel').textContent=`${state.page} / ${pages}`;$('prevPage').disabled=state.page===1;$('nextPage').disabled=state.page===pages;
 const rows=arr.slice((state.page-1)*state.size,state.page*state.size);
 $('stockRows').innerHTML=rows.length?rows.map(s=>{const c=catMeta(s),it=interpretation(s);return `<tr data-symbol="${esc(s.symbol)}" tabindex="0" class="${s.symbol===state.selected?'focused':''}" aria-label="查看 ${esc(s.name)} 詳細資料"><td>${star(s)}</td><td><b class="ticker">${esc(s.symbol.replace('.TW',''))}</b><div class="ticker-name">${esc(s.name)}</div><small>${esc(s.industry)}</small>${keywordMatches(s.symbol).length?'<small class="search-match">命中：'+esc([...new Set(keywordMatches(s.symbol).map(e=>e.label))].slice(0,3).join('、'))+'</small>':''}</td><td class="numeric"><b>${fnum(s.price)}</b><small>${esc(s.price_date||'日期未提供')}</small></td><td><span class="cat-chip">${esc(s.category)}</span></td><td><div class="major">${metricName(c.abbr)} ${c.metric?ratio(s[c.metric]):'—'}</div><span class="tag ${it.tone}">${esc(it.title)}</span></td>${['pe','pb','ps','peg'].map(k=>`<td class="numeric ${c.metric===k?'primary-raw':''}">${ratio(s[k])}</td>`).join('')}</tr>`}).join(''):`<tr><td colspan="9"><div class="emptiness">${state.tab==='watchlist'?'尚無符合條件的自選股。到「全部股票」搜尋並按 ☆ 即可加入。':'目前沒有符合條件的股票。請清除篩選，或稍後重新載入資料。'}</div></td></tr>`;
 document.querySelectorAll('tr[data-symbol]').forEach(tr=>{tr.onclick=()=>{state.selected=tr.dataset.symbol;render();if(innerWidth<1100)$('detail').scrollIntoView({behavior:'smooth',block:'start'})};tr.onkeydown=e=>{if(e.target===tr&&(e.key==='Enter'||e.key===' ')){e.preventDefault();tr.click()}}});wireStars($('stockRows'));
 if(!state.selected&&rows.length)state.selected=rows[0].symbol;
 renderDetail();
 const absent=state.watchlist.filter(sym=>!state.stocks.some(s=>s.symbol===sym));$('missingWatch').hidden=state.tab!=='watchlist'||!absent.length;$('missingWatch').textContent='自選股暫無市場資料（清單仍保留）：'+absent.join('、');
}
const RESEARCH_SECTIONS=[['business','公司業務'],['earnings','近年營收與獲利來源'],['transition','轉型方向'],['developments','新發展項目']];
let research={profiles:{},loading:true,error:false};
function safeResearchUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}}
function researchAge(record,now=new Date()){return record?.reviewed_at?Math.floor((now-new Date(record.reviewed_at+'T00:00:00+08:00'))/86400000):null}
function financialOverviewSummary(o){
 const r=o.financial.rolling;
 return '最近 12 個月（'+r.start_period+' 至 '+r.period+'），'+(r.basis||'營收')+'合計 '+fnum(r.ttms)+' 億元；每股盈餘合計 '+fnum(r.ttm_eps)+' 元，屬於母公司股東的淨利合計 '+fnum(r.ttm_parent_profit)+' 億元。營收還沒扣成本與費用，不等於淨利。獲利來源：'+o.profit_mechanism+'。';
}
function outlookConclusion(x,o){
 const kind=String(x.type||''),scope=String(x.scope||'營收'),period=String(x.period||'未確認');
 const who=/法人|共識/.test(kind)?'研究機構當時估計':/長期目標|業務目標/.test(kind)?'公司希望達到的目標是':'公司當時預估';
 const unit={'新台幣億元':'億新台幣','新台幣／億元':'億新台幣','美元／億元':'億美元','歐元億元':'億歐元'}[x.unit]||x.unit||'';
 if(!Number.isFinite(x.low))return /待補查/.test(kind)?'目前這份資料沒有可核對的營收預估金額，因此還不能判斷接下來會成長多少。這不代表公司沒有展望；需要等後續公告或補齊研究資料。':'公司談到的發展方向是「'+o.direction+'」。目前沒有可核對的營收預估金額，先看後續是否有訂單、出貨或收入公告，再判斷成果。';
 let text=who+'：'+period+' 的「'+scope+'」約 '+fnum(x.low)+(Number.isFinite(x.high)?' 至 '+fnum(x.high):'')+' '+unit+'。';
 const match=period.match(/^(\d{4})全年$/),prior=match?o.financial?.cumulative?.[(Number(match[1])-1)+'-Q4']:null;
 if(prior?.basis==='合併營業收入'&&prior.revenue>0&&['新台幣億元','新台幣／億元'].includes(x.unit)&&/^(整體)?合併(總)?營(收|業收入)$/.test(scope)){
  const low=(x.low/prior.revenue-1)*100,high=Number.isFinite(x.high)?(x.high/prior.revenue-1)*100:null;
  const change=v=>v>=0?'增加約 '+fnum(v)+'%':'減少約 '+fnum(-v)+'%';
  text+='與 '+(Number(match[1])-1)+' 年實際營收比較，代表'+change(low)+(high!==null?' 至 '+change(high):'')+'，這是預估情境。';
 }
 text+=/長期目標|業務目標/.test(kind)?'這是希望達到的目標，還不是已實現的收入。':/法人|共識/.test(kind)?'這是外部研究估計，不是公司保證，也不是已公布的實際收入。':'這是公司當時的預估，還不是已公布的實際收入。';
 if(/子公司|專案|ASIC/.test(scope))text+='這只涵蓋所列事業或專案，不能當成整家公司收入。';
 text+='營收增加不代表淨利或股價一定上升；這份預估是否有更新仍待核對。';
 return text;
}
function overviewHtml(o){
 if(!o)return '';
 const refs=urls=>urls.map(url=>safeResearchUrl(url)?'<a target="_blank" rel="noopener noreferrer" href="'+esc(safeResearchUrl(url))+'">原始來源 ↗</a>':'').join(' · ');
 const amounts=o.financial||{};
 const rolling=amounts.rolling;
 const periodLabel=p=>p?String(p).replace(/(\d{4})-Q([1-4])/,(m,y,q)=>y+' 年 '+['1–3 月','4–6 月','7–9 月','10–12 月'][Number(q)-1]):'未取得';
 const rows=rolling?Object.entries(amounts.cumulative||{}).filter(([p])=>p.endsWith('-Q4')).sort().map(([p,v])=>[p.slice(0,4)+' 年整年',v.revenue,v.eps]).concat(rolling.quarters.map(q=>[periodLabel(q.period)+'（單季）',q.revenue,q.eps]),[['最近 12 個月（TTM）',rolling.ttms,rolling.ttm_eps]]):[['2024 年整年',amounts.fy2024,null],['2025 年整年',amounts.fy2025,null],['最近四季營收',amounts.ttm,null]];
 const table='<details><summary>公司做了多少生意、每股賺多少？</summary><p>營收是公司做生意取得的收入，還沒扣成本與費用，所以不等於賺到的錢。以下營收以「億元」表示；EPS 是每股盈餘，以「元／股」表示。</p><table><thead><tr><th>統計時間</th><th>營收（億元）</th><th>每股盈餘（元）</th></tr></thead><tbody>'+rows.map(([label,revenue,eps])=>'<tr><th>'+esc(label)+'</th><td>'+fnum(revenue)+'</td><td>'+fnum(eps)+'</td></tr>').join('')+'</tbody></table><p class="tiny">整年：1 月到 12 月。單季：該三個月本身，不是年初累計。最近 12 個月：最新四季加總，會隨新季資料往前移動。— 表示資料不足。</p><p class="tiny">資料口徑：'+esc(amounts.basis||'未提供')+'。金融業可能列淨收益，需依原財報解讀。</p>'+(rolling?'<p><b>最近 12 個月營收（TTM Sales）</b>：'+fnum(rolling.ttms)+' 億元<br><b>最近 12 個月每股盈餘（TTM EPS）</b>：'+fnum(rolling.ttm_eps)+' 元／股<br><b>最近 12 個月股東獲利</b>：'+fnum(rolling.ttm_parent_profit)+' 億元</p><p class="tiny">截至 '+esc(periodLabel(rolling.period))+'；範圍 '+esc(rolling.start_period)+' 至 '+esc(rolling.period)+'。公式：'+esc(rolling.formula)+'。EPS 依累計財報銜接；股數變動或追溯重編可能影響比較。</p>':'')+'</details>';

 const forecasts=o.outlooks.map(x=>'<article class="outlook-note"><p><b>白話結論</b><br>'+esc(outlookConclusion(x,o))+'</p><details><summary>查看預估金額、假設與來源</summary><p><b>'+esc(x.type)+' · '+esc(x.period)+'</b><br>'+esc(x.scope)+' · '+esc(x.unit||'未提供金額單位')+(Number.isFinite(x.low)?' '+esc(x.low)+(Number.isFinite(x.high)?'–'+esc(x.high):''):'')+'<br>'+esc(plainResearchText(x.limitations))+'<br>這份預估發布於：'+esc(x.published_at||'未提供')+'<br>'+refs(x.urls)+'</p></details></article>').join('');
 const events=o.events.map(x=>'<p><b>'+esc(x.type)+' · '+esc(x.period)+'</b><br>'+esc(x.status)+'<br>'+esc(plainResearchText(x.text))+'<br>'+refs(x.urls)+'</p>').join('');
 const bullets=text=>'<ul class="overview-points">'+String(text||'未提供').split(/[；;\n]/).filter(Boolean).map(x=>'<li>'+esc(plainResearchText(x.trim()))+'</li>').join('')+'</ul>';
 const money=(value,unit)=>Number.isFinite(value)?fnum(Math.abs(value))+' '+unit:'資料不足';
 const results=rolling?'<section class="overview-block"><h5>② 最近一年的成績</h5><p class="tiny">'+esc(metricPeriod('trailing_eps',{date:rolling.period}))+'</p><div class="overview-facts"><div><span>做了多少生意？</span><strong>'+money(rolling.ttms,'億元')+'</strong><small>'+esc(rolling.basis||'營收')+'；還沒扣成本與費用</small></div><div><span>'+((rolling.ttm_parent_profit??0)<0?'股東最後虧損多少？':'股東最後獲利多少？')+'</span><strong>'+money(rolling.ttm_parent_profit,'億元')+'</strong><small>扣除成本、費用及稅等後，屬於母公司股東的結果</small></div><div><span>'+((rolling.ttm_eps??0)<0?'每股虧損（TTM EPS）':'每股盈餘（TTM EPS）')+'</span><strong>'+money(rolling.ttm_eps,'元／股')+'</strong><small>每股數字與公司總獲利是不同的單位</small></div></div></section>':'<section class="overview-block"><h5>② 最近一年的成績</h5><p>'+esc(o.summary)+'</p></section>';
 return '<div class="imported-overview"><h4>全市場概況與摘要</h4><section class="overview-block"><h5>① 這家公司做什麼？</h5>'+bullets(o.business)+'</section>'+results+'<section class="overview-block"><h5>③ 主要靠什麼賺錢？</h5>'+bullets(o.profit_mechanism)+'<p class="tiny">這是獲利來源的文字說明，不代表各事業的獲利比例。</p></section><section class="overview-block"><h5>④ 接下來往哪裡發展？</h5>'+bullets(o.direction)+'</section>'+table+'<details><summary>財測與展望：未來可能怎麼走？</summary>'+(forecasts||'<p>目前資料沒有列出可核對的預估。</p>')+'</details><details><summary>事件與待核對事項</summary>'+(events||'<p class="tiny">本檔未列事件；不代表沒有重大事件。</p>')+'</details><details><summary>資料日期、來源與進階註記</summary><p class="tiny">使用者提供：'+esc(o.source_filename||'臺灣上市公司營運研究_20261003.xlsx')+' · 檔案查核日 '+esc(o.source_reviewed_at)+' · 匯入日 '+esc(o.imported_at)+'。本次未重新逐一查閱原始網站。</p><p class="tiny">原檔完整度註記：'+esc(o.status)+'<br>原檔財務篩選：'+esc(o.financial?.screening||o.screening)+'</p><div class="research-refs">'+refs(o.urls)+'</div><p class="tiny">營收及公司獲利用億元表示，EPS 用元／股表示；缺值不是零。四季合計未逐家調整 IFRS17 或併表差異，預估未確認所有後續修正。</p></details></div>';

}
function plainResearchText(text){return String(text||'').replaceAll('核准不等於完工','董事會已同意這項計畫；目前資料尚未確認工程完成或開始生產，後續要追蹤施工、投產及收入').replaceAll('核准預算不代表各工程已完工投產','董事會已同意撥款，但資料還沒確認每項工程都已蓋好並開始生產').replaceAll('不把核准當完成','目前確認的是董事會同意交易，是否已交割完成還需要後續公告').replaceAll('營收占比並非製程獲利占比','這些百分比表示各製程替公司帶來多少收入；要知道各製程替公司賺多少錢，還需要它們的成本與利潤資料').replaceAll('營收占比不等於獲利占比','這些百分比表示各事業帶來多少收入；各事業實際賺多少錢還需要成本與利潤資料').replaceAll('营收占比不等於獲利占比','各事業的收入比例只能說明收入來源；獲利貢獻還要看成本與利潤').replaceAll('不把計畫視為已完成','這裡記錄的是公司原先規劃；目前還缺後續公告，無法確認是否已照計畫完成').replaceAll('預售不等同已交屋認列收入','住宅已開始接受預售，但目前還沒確認已交屋；何時正式列入公司收入，還要看交屋進度與財報').replaceAll('屬臨床開發階段，並非上市許可','藥品仍在人體試驗階段，目前取得的是進行試驗的核准；還不是可以上市販售的許可').replaceAll('營收結構不等於獲利結構','各事業的收入比例只能說明收入來源；要知道獲利貢獻還要看成本與利潤').replaceAll('未以產品營收占比推算各產品獲利','目前只知道各產品帶來多少收入，還缺各產品扣除成本後的獲利，無法分配公司淨利給各產品')}
function researchHtml(stock){
 const p=research.profiles[stock.symbol],age=researchAge(p),ready=p?.status==='researched';
 const message=research.error?'研究資料載入失敗；已有內容可能為舊版本。':research.loading?'正在載入公司研究資料…':ready?'已有官方來源查核摘要，另附匯入概況；請核對各段資料期間。':p?.overview?'已匯入概況；官方來源與新項目細節仍待逐家查核。':'待查核：這家公司尚未完成來源整理，不代表沒有轉型或新項目。';
 const paragraph=(section)=>{if(!section)return '<p class="tiny">— 尚未取得足夠來源。</p>';return '<p>'+esc(plainResearchText(section.text))+'</p><small>資料期間：'+esc(section.period)+'</small><div class="research-refs">'+section.sources.map(id=>{const ref=p.sources[id],url=safeResearchUrl(ref?.url);return url?'<a target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">'+esc(ref.title)+' ↗</a>':''}).join('')+'</div>'};
 return '<section class="company-research" aria-label="公司研究摘要"><h3>公司研究摘要</h3><p class="tiny">'+esc(message)+'</p>'+(ready?'<p class="research-date">最後查核：'+esc(p.reviewed_at)+(age>=14?' · ⚠ 超過 14 天未查核':'')+'</p>':'')+overviewHtml(p?.overview)+(ready?'<h4>官方來源查核摘要</h4>':'')+(ready||!p?.overview?RESEARCH_SECTIONS.map(([key,label])=>'<details'+(key==='business'?' open':'')+'><summary>'+label+'</summary>'+paragraph(p?.[key])+'</details>').join(''):'')+(ready?'<details><summary>研究限制與來源日期</summary><ul>'+p.limitations.map(x=>'<li>'+esc(plainResearchText(x))+'</li>').join('')+'</ul>'+Object.values(p.sources).map(ref=>'<p class="tiny">'+esc(ref.title)+' · '+esc(ref.publisher)+'<br>發布：'+esc(ref.published_at||'來源未提供')+' · 查閱：'+esc(ref.accessed_at)+'</p>').join('')+'</details>':'')+'<p class="tiny">公司概況依匯入檔案，官方摘要另列查核日期。某事業占公司收入多少，還不能看出它替公司賺了多少錢；需要再看該事業的成本與利潤。</p></section>';
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
 finally{research.loading=false;render()}
}
function metricPeriod(key,m){
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
 const c=catMeta(s),it=interpretation(s),fields=[['pe','PE 本益比'],['calculated_pe','TTM 本益比（依最近四季 EPS 算）'],['pb','PB 股價淨值比'],['ps','PS 股價營收比'],['peg','PEG 本益成長比（歷史）'],['eps','EPS 每股盈餘（年初累計）'],['trailing_eps','最近四季每股盈餘（TTM EPS）'],['trailing_sales','最近四季營收（億元）'],['revenue_growth','單月營收年增率'],['earnings_growth','TTM EPS 年增率'],['gross_margin','累計毛利率'],['roe','ROE 股東權益報酬率'],['dividend_yield','殖利率']];
 const imported=research.profiles[s.symbol]?.overview,rolling=imported?.financial?.rolling;
 const usesImport=key=>rolling&&(key==='trailing_sales'||key==='trailing_eps'&&(finite(s.trailing_eps)===null||String(s.field_meta?.trailing_eps?.date||'')<rolling.period));
 const statValue=key=>usesImport(key)?rolling[key==='trailing_sales'?'ttms':'ttm_eps']:s[key];
 const statMeta=key=>usesImport(key)?{date:rolling.period,basis:'使用者匯入累計財報；'+rolling.formula,source:imported.source_filename||'使用者提供工作簿',downloaded_at:imported.imported_at,reason:statValue(key)===null?'缺少必要累計期間或口徑不同':null}:s.field_meta?.[key]||(research.profiles[s.symbol]?.calculated_metrics?.[key]?{date:rolling?.period,basis:research.profiles[s.symbol].calculated_metrics[key].formula,reason:research.profiles[s.symbol].calculated_metrics[key].reason}:null);
 const percent=['gross_margin','revenue_growth','earnings_growth','roe','dividend_yield'];
 const source=(m)=>m&&/^https:\/\//.test(m.source||'')?`<a href="${esc(m.source)}" target="_blank" rel="noopener noreferrer">官方／授權来源 ↗</a>`:esc(m?.source||'尚無資料來源');
 $('detail').innerHTML=`<div class="detail-top"><div><div class="eyebrow">STOCK RESEARCH · ${esc(s.symbol)}</div><h2>${esc(s.name)}</h2><p class="tiny">${esc(s.industry)} · ${esc(s.category)}</p></div>${star(s)}</div><div class="price-line"><div><span class="label">最近收盤參考價 · TWD</span><div class="price">${fnum(s.price)}</div></div><div class="tiny">股價日期<br><b>${esc(s.price_date||'未提供')}</b></div></div><div class="chart-entry"><a class="button primary" href="${esc(tvUrl(s))}" target="_blank" rel="noopener noreferrer">↗ 查看股價走勢</a><p class="tiny">在新分頁開啟 ${esc(s.name)}（${esc(s.symbol.slice(0,-3))}）的 TradingView 圖表。行情時間與可用功能以該站顯示為準。</p></div>${keywordEvidence(s)}${researchHtml(s)}<label class="label" for="manualCategory">個人研究分類</label><div class="category-edit"><select id="manualCategory" class="select"><option value="">自動：${esc(normalizeCategory(state.stocks.find(x=>x.symbol===s.symbol).category))}</option>${[...CATS.map(x=>x.id),'待分類'].map(cat=>`<option ${state.overrides[s.symbol]===cat?'selected':''}>${esc(cat)}</option>`).join('')}</select><span class="tiny">只保存在此瀏覽器</span></div><div class="focus-value"><span>主要估值 · ${metricName(c.abbr)}</span><strong>${c.metric?ratio(s[c.metric]):'—'}</strong></div><span class="tag ${it.tone}">${esc(it.title)}</span><div class="explain"><b>${esc(it.tip)}</b><p>${esc(it.long)}</p>${it.extra?`<p>${esc(it.extra)}</p>`:''}</div><div class="stats-grid">${fields.map(([key,label])=>{const m=statMeta(key);return `<div class="stat"><span class="label">${label}</span><strong>${percent.includes(key)?pct(statValue(key)):['eps','trailing_eps','trailing_sales'].includes(key)?fnum(statValue(key)):ratio(statValue(key))}</strong><small>${esc(metricPeriod(key,m))}</small></div>`}).join('')}</div><details><summary>各欄位來源、期間與缺值原因</summary><div class="provenance">${[['price','股價'],...fields].map(([key,label])=>{const m=statMeta(key);return `<div><b>${label} · ${esc(m?.date||'未提供')}</b><p>${esc(m?.basis||'來源未提供口徑')}<br>${source(m)}<br>下載：${esc(m?.downloaded_at||'未提供')}${m?.comparison_period?'<br>比較期間：'+esc(m.comparison_period):''}${m?.price_date?'<br>計算股價日期：'+esc(m.price_date):''}${m?.shares_date?'<br>股數資料日期：'+esc(m.shares_date):''}${m?.shares_source&&safeResearchUrl(m.shares_source)?'<br>股數來源：<a target="_blank" rel="noopener noreferrer" href="'+esc(safeResearchUrl(m.shares_source))+'">證交所公開資料 ↗</a>':''}${m?.reason?'<br>缺值原因：'+esc(m.reason):''}${m?.stale_reason?'<br>⚠ '+esc(m.stale_reason):''}</p></div>`}).join('')}</div></details><div class="links"><a class="button small" href="${esc(tvUrl(s))}" target="_blank" rel="noopener noreferrer">TradingView ↗</a><a class="button small" href="https://www.investing.com/search/?q=${encodeURIComponent(s.symbol.slice(0,-3))}" target="_blank" rel="noopener noreferrer">Investing.com ↗</a></div><p class="tiny">使用者自訂研究規則，非確定買賣訊號。不同指標可能來自不同期間；保留原始值，不將缺值視為零。</p>`;
 wireStars($('detail'));$('manualCategory').onchange=e=>{if(e.target.value)state.overrides[s.symbol]=e.target.value;else delete state.overrides[s.symbol];persist();render()};
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
 $('clearFilters').onclick=()=>{state.search='';state.filter='全部';state.researchFilter='all';$('researchFilter').value='all';$('search').value='';$('categoryFilter').value='全部';for(const k of ['priceMin','priceMax','metricMin','metricMax']){state[k]=null;$(k).value=''}state.page=1;render()};
 $('clearWatchBtn').onclick=()=>{if(!state.watchlist.length)return;clearedWatchlist=[...state.watchlist];state.watchlist=[];persist();$('undoWatchBtn').hidden=false;setTab('watchlist');showNotice('自選股已清空。可按「復原清空」恢復；重新整理前有效。','ok')};
 $('undoWatchBtn').onclick=()=>{if(!clearedWatchlist)return;state.watchlist=[...new Set([...clearedWatchlist,...state.watchlist])];clearedWatchlist=null;persist();$('undoWatchBtn').hidden=true;render()};
 $('prevPage').onclick=()=>{state.page--;render()};$('nextPage').onclick=()=>{state.page++;render()};$('fetchBtn').onclick=()=>{fetchLive();fetchResearch()};$('exportBtn').onclick=exportWatchlist;
 window.addEventListener('storage',e=>{if(e.key===KEY){const p=readPreferences(localStorage);state.watchlist=p.watchlist;state.overrides=p.overrides;render()}});
 $('researchFilter').onchange=e=>{state.researchFilter=e.target.value;state.page=1;render()};
 render();fetchLive();fetchResearch();
}
init();
