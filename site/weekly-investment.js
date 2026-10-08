(() => {
  'use strict';
  const escape = v => String(v ?? '—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = v => v == null ? '—' : Number(v).toLocaleString('zh-TW', {maximumFractionDigits:2});
  const quantity = v => v == null ? '—' : Number(v).toLocaleString('zh-TW', {maximumFractionDigits:6});
  const range = v => Array.isArray(v) ? v.map(number).join('–') : '未成立／資料不足';
  const list = a => `<ul>${(a || []).map(v=>`<li>${escape(v)}</li>`).join('')}</ul>`;
  const safeUrl = url => { try { const u = new URL(url, location.href); return u.protocol === 'https:' ? escape(u.href) : '#'; } catch { return '#'; } };
  const card = (title,content) => `<section class="weekly-card"><h3>${escape(title)}</h3>${content}</section>`;
  function linkMentionedStocks(html, companies) {
    const aliases = new Map();
    for (const c of companies) {
      for (const name of [c.name, c.name.replace(/-KY$/, ''), ...(c.code==='1256'?['鮮活']:[])]) {
        if(name.length>=2) aliases.set(escape(name),c.code);
      }
    }
    const names=[...aliases.keys()].sort((a,b)=>b.length-a.length);
    const pattern=new RegExp(names.map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
    const excluded=new Set(['a','button','script','style','textarea','option']);
    const stack=[];
    return html.split(/(<[^>]+>)/g).map(part=>{
      if(part.startsWith('<')) {
        const tag=part.match(/^<\s*(\/?)\s*([a-z0-9]+)/i);
        if(tag && excluded.has(tag[2].toLowerCase())) {
          if(tag[1]) stack.pop(); else if(!part.endsWith('/>')) stack.push(tag[2].toLowerCase());
        }
        return part;
      }
      if(stack.length) return part;
      return part.replace(pattern,name=>`<a href="./?company=${encodeURIComponent(aliases.get(name))}#detail" data-weekly-company="${escape(aliases.get(name))}">${name}</a>`);
    }).join('');
  }
  function freshness(report, now = new Date()) {
    const taipei = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
    const p = Object.fromEntries(taipei.map(x=>[x.type,x.value]));
    const date = `${p.year}-${p.month}-${p.day}`;
    const weekday = new Date(date+'T12:00:00+08:00').getUTCDay();
    const afterClose = Number(p.hour)*60+Number(p.minute) >= 13*60+30;
    // No holiday-calendar assumption: after a new weekday close, require a fresh official check.
    if (now > new Date(report.freshness.valid_until)) return '本版觀察價已到期，等待重新核對；不可視為本週最新買點。';
    if (date > report.priceAsOf && afterClose && weekday!==0 && weekday!==6) return '已過新交易日收盤時間，價格基準待刷新；以下為前次研究觀察條件。休市日亦須核對官方日曆。';
    if (Math.floor((new Date(date+'T00:00:00+08:00')-new Date(report.priceAsOf+'T00:00:00+08:00'))/86400000)>3) return '價格基準可能過期，請先核對官方最近交易日；本頁不提供即時訊號。';
    return `收盤基準 ${report.priceAsOf}；非即時買訊。所有價格須配合下列量價與基本面條件。`;
  }
  function render(r) {
    const byCode = Object.fromEntries(r.companies.map(c=>[c.code,c]));
    const stockLink = code => `<a href="./?company=${encodeURIComponent(code)}#detail" data-weekly-company="${escape(code)}">${escape(code)} ${escape(byCode[code]?.name || '')}</a>`;
    const analysisLink = code => `<button type="button" class="weekly-summary-stock" data-weekly-analysis="${escape(code)}" aria-haspopup="dialog">${escape(code)} ${escape(byCode[code]?.name || '')}<span>查看分析 ↗</span></button>`;
    const names = codes => codes.map(analysisLink).join(' ');
    const conclusion = `<div class="weekly-kicker">${escape(r.week_id)} · 週報 v${r.version} · 研究判斷</div><h2 class="weekly-headline">${escape(r.headline)}</h2><p class="weekly-freshness" role="status">${escape(freshness(r))}</p><div class="weekly-decision-list">${card('布局', `<strong>${r.top_layout.length ? names(r.top_layout) : '0 檔完整觸發'}</strong><p>目前等待條件，不強迫選滿三檔。</p>`)}${card('優先等待', `<strong>${r.top_wait.map(code => `<span class="weekly-summary-item">${analysisLink(code)}<small>信心 ${number(byCode[code].scores.confidence)}/10</small></span>`).join(' ')}</strong><p>到價只是提醒；止穩、量能與基本面同時確認才評估新部位。</p>`)}${card('不追高', `<strong>${names(r.top_no_chase)}</strong><p>公司品質與買點分開判斷；已有部位參照個股持有策略。</p>`)}</div>`;
    const turnaround = card('轉機股', `<p>轉機股是原本成長較慢或表現平淡，最近營收與獲利開始改善、值得繼續觀察的公司。這三檔上半年營運數字變好，但最近一段時間股價反應較小，因此列入後續研究。</p><strong>${names(r.top_research || [])}</strong>${r.update_id==='2026-W41-v3'?`<ul><li>亞德客-KY：2026上半年營收比去年同期增加約30%，每股盈餘增加約51%。接下來觀察客戶訂單與獲利改善能否持續。</li><li>鮮活果汁-KY：2026上半年營收比去年同期增加約47%，每股盈餘增加約107%。接下來確認需求與毛利率是否能維持。</li><li>南帝：2026上半年營收比去年同期增加約23%，每股盈餘增加約288%。接下來確認產品報價、需求與本業獲利，也會檢查高成長是否主要來自去年獲利較低。</li></ul>`:list((r.top_research||[]).map(code=>byCode[code]?.fundamental_inflection||'待確認營運改善的持續性'))}<p>目前是值得深入了解的觀察名單。完成未來需求、合理價格與進場條件的確認後，才會評估是否適合建倉；點「查看分析」可看每家公司還需要確認的事項。</p>`);
    const alertGuide=a=> {
      if(r.update_id!=='2026-W41-v3') return [a.reason];
      const guides={
        '2330':[
          '股價現況：最近已核收盤資料為10/7，價格高於觀察位置。2,515接近當時最近10個交易日的平均收盤價，適合觀察回檔是否穩定。',
          '觀察條件：股價回落接近2,515時，查看成交量是否縮小，以及價格是否停止持續下跌。最新收盤資料確認後，會重新核對觀察位置。',
          '進場參考：同時確認公司需求與獲利展望維持，再依分析框的完整條件評估對應批次。'],
        '2382':[
          '股價現況：10/8收盤325.5，低於原本328–330的支撐區，原左側買點已撤銷。',
          '觀察條件：先看收盤能否回到330以上，並在下一個交易日維持。',
          '進場參考：公司本業獲利能力也要確認，這些條件成立後再重新評估建倉方式。'],
        '2345':[
          '股價現況：10/8收盤2,070，低於近期高點2,140。2,145是觀察能否突破這個高點的位置。',
          '觀察條件：收盤達到2,145時，成交量高於前20個交易日平均量，下一個交易日收盤也維持在該價位以上。',
          '進場參考：同時確認每股盈餘預估停止下修，再依分析框的右側確認條件評估第一批建倉。']
      };
      return guides[a.code]||[a.reason];
    };
    const alerts = card('最值得設定的 3 個價格提醒', `<p>把觀察價格加入通知，到價後依下列條件查看是否適合進場。點「查看分析」可看完整建倉指引。</p><div class="weekly-alerts">${r.alerts.map(a=>`<article>${analysisLink(a.code)}<div class="weekly-alert-quotes"><p><b>現在價格：${number(byCode[a.code]?.price)}</b><small>最近已核收盤：${escape(byCode[a.code]?.priceAsOf)}</small></p><p><b>觀察價格：${number(a.price)}</b><small>觀察資料基準：${escape(a.asOf || r.priceAsOf)}</small></p></div>${list(alertGuide(a))}</article>`).join('')}</div><p class="weekly-alert-help">使用方式：先設定價格通知 → 到價後查看個股分析 → 確認進場條件 → 按建議批次評估投入資金。使用提醒前，請依最新收盤資料核對進場條件。本版觀察條件最遲有效至 ${escape(r.freshness.valid_until.slice(0,10))}，遇到新的收盤資料或公司重要變化時會重新評估。</p>`);
    const choice=card('只能選一檔的中期研究選擇', `<p><b>${analysisLink(r.only_one.code)}</b></p>`+list(r.only_one.reasons));
    const portfolio=card('條件成立後的目標配置', `<p>${escape(r.portfolio.type)}</p><p><b>${escape(r.portfolio.current_new_money)}</b></p><p>各股所有批次均成立並成交後的目標基準（未成立不投入）：${Object.entries(r.portfolio.base_weights).map(([c,w])=>`${c==='cash'?'現金':stockLink(c)} ${number(w)}%`).join(' · ')}，合計100%。</p><p>${escape(r.portfolio.ranges_note)}</p><p>${escape(r.portfolio.factor_exposure)}</p><p>現金區間${range(r.portfolio.cash_range)}%，AI共同因子上限${r.portfolio.ai_factor_cap}%。${escape(r.portfolio.risk_note)}</p>`);
    const actionText=text=>escape(text).replace(/停止加碼|建議進場(?:[（(][^）)]*[）)])?/g,t=>`<strong class="weekly-action-important">${t}</strong>`);
    const plainCondition=text=>String(text)
      .replace(/需求／EPS與利潤指引維持/g,'公司的需求展望、每股盈餘預估與獲利指引維持')
      .replace(/EPS/g,'每股盈餘').replace(/thesis/g,'投資理由').replace(/YoY/g,'與去年同期相比的成長率')
      .replace(/量>前20日均量/g,'成交量高於前20個交易日平均量').replace(/量>20日均量/g,'成交量高於前20個交易日平均量')
      .replace(/量≤0\.8倍均量/g,'成交量在前20個交易日平均量的八成以下').replace(/量≥20日均量/g,'成交量達到前20個交易日平均量')
      .replace(/量≥1\.5倍均量/g,'成交量達到前20個交易日平均量的1.5倍').replace(/止穩/g,'價格停止持續下跌')
      .replace(/重站/g,'收盤重新回到').replace(/隔日守住/g,'下一個交易日收盤也維持在該價位以上')
      .replace(/先等([^，；。]*?)回測/g,'先觀察股價回落到$1時的表現').replace(/回測量/g,'股價回落時的成交量').replace(/回測跌破/g,'股價回落並跌破')
      .replace(/第一關注/g,'第一個值得觀察的價格區間為').replace(/最佳區另採左側/g,'如果股價回落到理想布局區，可先觀察以下條件')
      .replace(/只研究首筆小部位/g,'先評估第一筆較小額的投入').replace(/不追第一天/g,'第一天先觀察，等後續確認再評估')
      .replace(/高估值者先重估，不能只靠突破買進/g,'股價相對獲利偏高時，先重新估算合理價格，再確認是否適合依突破條件買進')
      .replace(/收盤收盤/g,'收盤').replace(/第一個值得觀察的價格區間為取/g,'第一關注價參考')
      .replace(/股價回落時的成交量≤此前20日均量0\.8倍/g,'股價回落時，成交量應在此前20個交易日平均量的八成以下')
      .replace(/量>此前20日均量/g,'成交量應高於此前20個交易日平均量').replace(/低點連2日不破/g,'連續兩個交易日的最低價維持在觀察價位以上')
      .replace(/且量縮守住支撐/g,'，而且成交量比近期平均量小、收盤維持在支撐價位以上')
      .replace(/最佳區價格停止持續下跌/g,'元的理想布局區內，股價停止持續下跌')
      .replace(/下一個獨立交易日／數據確認/g,'下一個交易日，重新核對價格與公司營運資料')
      .replace(/時間、估值與價格同時核對/g,'每批分開安排，並重新確認股價是否合理及公司營運是否符合預期')
      .replace(/核心投資理由/g,'中長期投資理由').replace(/縮減戰術部位/g,'評估減少為這次進場建立的部位').replace(/每股盈餘與每股盈餘/g,'每股盈餘');

    const trancheSentence=(c,t,i)=> {
      const examples={
        '2330':[
          '股價在 2,375–2,415 區間停止下跌後，可以建立第一筆，投入 1/4 的資金。',
          '後續股價在 2,480–2,515 區間，成交量縮小且守住支撐後，可以建立第二筆，再投入 1/4 的資金。',
          '收盤重新回到 2,555 以上，下一個交易日也守住後，可以建立第三筆，再投入 1/4 的資金。',
          '收盤突破 2,595，成交量高於前20個交易日平均量，下一個交易日也守住後，可以建立第四筆，投入最後 1/4 的資金。'],
        '2345':[
          '收盤達到 2,145，成交量高於前20個交易日平均量，下一個交易日也守住後，可以建立第一筆，投入 30% 的資金。',
          '後續股價回落到 2,145 附近沒有跌破，並再次收高後，可以建立第二筆，再投入 30% 的資金。',
          '後續每股盈餘預估上調或交付改善獲得確認，且價格與估值仍合適時，可以建立第三筆，投入最後 40% 的資金。'],
        '3017':[
          '收盤突破 3,705，成交量高於前20個交易日平均量，下一個交易日也守住後，可以建立第一筆，投入 30% 的資金。',
          '後續股價回落到 3,705 附近沒有跌破，並再次收高後，可以建立第二筆，再投入 30% 的資金。',
          '後續每股盈餘預估或交付改善獲得確認，且價格與估值仍合適時，可以建立第三筆，投入最後 40% 的資金。']
      };
      const text=r.update_id==='2026-W41-v3' && examples[c.code]?.[i] || `${plainCondition(t.condition)}條件確認後，可以建立第 ${i+1} 筆，投入 ${number(t.target_pct)}% 的資金。`;
      return escape(text).replace(/(投入(?:最後 )?(?:1\/4|30%|40%|[\d.]+%) 的資金)/g,'<strong class="weekly-action-important">$1</strong>');
    };
    const details=r.companies.map(c=>`<article class="weekly-card weekly-company" id="weekly-${c.code}" data-weekly-analysis-template="${c.code}" hidden><header><h3>${stockLink(c.code)}</h3><span class="weekly-role">${escape(c.position.role)}</span></header><p class="weekly-decision">${escape(c.position.stage)} · ${actionText(c.building_plan.current_action)}</p><p class="weekly-freshness" role="status">${escape(freshness({...r,priceAsOf:c.priceAsOf}))}</p><p><b>官方收盤 <span class="weekly-close-price">${number(c.price)}</span>（${escape(c.priceAsOf)}）</b></p><p><b>AI信心 ${c.scores.confidence}/10 · 估值／買點 ${c.scores.valuation_entry}/10 · 公司品質 ${c.scores.quality}/10</b></p><p>已有持股：${escape(plainCondition(c.holding_strategy))}</p>${card("是否建倉／如何分批", `<p><b>目前行動：${actionText(c.building_plan.current_action)}</b></p>${c.building_plan.tranches.length ? `<p>先決定這檔股票「全部買完後」的目標投入金額，再分成 ${c.building_plan.tranches.length} 筆。下方百分比表示每筆占這檔股票目標金額的比例，不是拿全部資金直接買進。</p><p>以下每筆都要同時符合「進場訊號」中的成交量與公司營運條件；確認後才投入資金。</p>${`<ol class="weekly-tranches">${c.building_plan.tranches.map((t,i)=>`<li><p>${trancheSentence(c,t,i)}</p></li>`).join('')}</ol>`}${r.backtest?.equity && r.portfolio.base_weights[c.code] ? `<p>以目前 ${number(r.backtest.equity)} 元模擬帳戶為例：這檔股票條件成立後的目標配置 ${number(r.portfolio.base_weights[c.code])}%，對應目標金額約 ${number(r.backtest.equity*r.portfolio.base_weights[c.code]/100)} 元。第一筆 ${c.building_plan.tranches[0].target_pct}% 約 ${number(r.backtest.equity*r.portfolio.base_weights[c.code]/100*c.building_plan.tranches[0].target_pct/100)} 元；回測會先扣除模擬費用，再把該批金額換算成小數股；例如不足一股也會記錄模擬買入，而不是因股價太高放棄投入。</p>`:''}` : '<p>目前先保留資金，尚未啟動分批買進。接下來要確認公司營運、合理價格與進場訊號；研究條件足夠後，才會訂出每一筆的金額和買進時機。</p>'}<p>目前採用的建倉方式：${escape(plainCondition(c.building_plan.conditional_action))}</p><p><b class="weekly-action-important">停止加碼：什麼時候停止後續買進？</b>如果原本看好的需求、獲利或股價支撐條件改變，先保留剩餘資金並重新評估。${actionText(plainCondition(c.building_plan.stop_addition))}</p>`)}<div class="weekly-grid">${card('進場訊號', `<p>每一筆買進都需要同時確認股價、成交量與公司營運。先依下列價格條件觀察，接著檢查成交量是否符合要求，最後確認公司的營收與獲利展望仍支持原本的投資理由。</p><h4>先看價格與成交量</h4><p>${escape(plainCondition(c.buy_signal))}</p><h4>再看公司營運是否配合</h4><p>${escape(plainCondition(c.fundamental_confirmation))}</p><p>這兩部分確認後，才依分批計畫評估這一筆投入金額；等待期間先保留現金，後面的每一筆也會重新核對條件。</p>`)}${card('買點不成立／風險管理', `<p>先區分兩種情況：股價未符合這次買進條件時，取消該筆買進並保留後續資金；公司的需求與獲利展望改變時，則重新評估整個中長期投資理由和已持有部位。</p><h4>這次觀察的價格範圍</h4><p>第一關注價：${range(c.prices.first_attention)}；理想布局區：${range(c.prices.best_entry)}；右側確認價：${number(c.prices.breakout)}。已列出的價格須搭配進場訊號使用，尚未成立的區間會等待資料確認後再訂定。</p><p>價格依據：${escape(plainCondition(c.prices.reason))}</p><h4>股價出現什麼變化時調整部位？</h4><p>${actionText(plainCondition(c.position_management))}</p><h4>公司出現什麼變化時重估投資理由？</h4><p>${escape(plainCondition(c.thesis_failure))}</p><p>遇到上述變化，先停止尚未完成的買進批次，再依已發布的持有或出場計畫評估既有部位；回測也會沿用同一套條件執行。</p>`)}${card('AI研究信心', `<div class="weekly-scores">${Object.entries(c.scores).map(([k,v])=>`<span>${({quality:'品質',industry:'產業',improvement:'改善潛力',valuation_entry:'估值／買點',confidence:'信心'})[k]}<b>${v}/10</b></span>`).join('')}</div><p>${escape(c.score_reason)}</p><p>信心取決於證據完整度，不等於上漲機率。${escape(c.risk)}</p>`)}</div><details><summary>展開論點、估值、價量與例行資料日期</summary><h4>Thesis與1–3年動能</h4><p>${escape(c.thesis)}</p><p>${escape(c.growth_1to3y)}</p><h4>市場預期與price-in</h4><p>${escape(c.market_expectations)}</p><p>${escape(c.price_in)}</p><h4>基本面拐點與競爭力</h4><p>${escape(c.candidate_type)}</p><p>${escape(c.fundamental_inflection)}</p><p>${escape(c.competition)}</p><h4>Variant View：待驗證假說</h4><p>市場可能預期：${escape(c.variant_view?.market_hypothesis)}</p><p>研究假說：${escape(c.variant_view?.research_hypothesis)}</p><p>確認／反證：${escape(c.variant_view?.confirmation)}</p><h4>Reverse Valuation 敏感度</h4><p>研究PE帶 ${range(c.reverse_valuation?.assumption_pe)}；反推所需EPS ${range(c.reverse_valuation?.implied_eps)}；相對TTM增幅 ${range(c.reverse_valuation?.required_growth_pct)}%。${escape(c.reverse_valuation?.reason)}</p><p>${escape(c.valuation_methods)}</p><p>官方PB ${number(c.valuation.official_pb)}（${escape(c.valuation.official_pe_date)}）。</p><h4>估值口徑</h4><p>TTM EPS ${number(c.financial.ttm_eps)}（${escape(c.financial.ttm_period)}）；自行TTM PE ${number(c.valuation.ttm_pe)}；官方PE ${number(c.valuation.official_pe)}（${escape(c.valuation.official_pe_date)}）。${escape(c.valuation.official_pe_note)}</p><p>2026 Forward PE ${number(c.valuation.forward_pe)}；2027 Forward PE ${number(c.valuation.forward_next_year_pe)}。${c.valuation.consensus ? `${escape(c.valuation.consensus.provider)}，發布${escape(c.valuation.consensus.published_at)}，${c.valuation.consensus.coverage}位分析師，2026 EPS中位${number(c.valuation.consensus.median)}，前值${number(c.valuation.consensus.previous)}，範圍${number(c.valuation.consensus.low)}–${number(c.valuation.consensus.high)}。${escape(c.valuation.consensus.note)}` : escape(c.valuation.consensus_missing_reason)}</p><p>研究估值：${escape(c.valuation.classification)}，合理TTM PE帶${range(c.valuation.reasonable_ttm_pe_range)}，對應${range(c.valuation.reasonable_ttm_price_range)}元。${escape(c.valuation.assumption)} 所有倍數假設均為研究判斷。</p><h4>官方價量與基本面快照</h4><p>5／10／20／60日均線：${Object.values(c.technical.ma).map(number).join('／')}。20日高低 ${number(c.technical.low20)}–${number(c.technical.high20)}；成交 ${number(c.technical.volume)}股，前20日均量 ${number(c.technical.average_volume_20)}股（${number(c.technical.volume_ratio)}倍）；20日漲跌 ${number(c.technical.return20)}%。${escape(c.technical.basis)}</p><p>${escape(c.financialPeriod)}：EPS ${number(c.financial.eps)}，毛利率 ${number(c.financial.gross_margin)}%，營益率 ${number(c.financial.operating_margin)}%。${escape(c.financial.eps_basis)}。${escape(c.financial.eps_comparability_note)}</p><p>${escape(c.monthly.period)}營收 ${number(c.monthly.revenue_twd_thousand == null ? null : c.monthly.revenue_twd_thousand/100000)}億元、YoY ${number(c.monthly.yoy)}%。${escape(c.monthly.latest_missing_reason||'')} 訂單、CAPEX、產能與營收分開判斷。</p><p class="tiny">updatedAt ${escape(c.updatedAt)} · priceAsOf ${escape(c.priceAsOf)} · financialPeriod ${escape(c.financialPeriod)} · forecastAsOf ${escape(c.forecastAsOf)} · 觀察價asOf ${escape(c.prices.asOf)}／有效至 ${escape(c.prices.valid_until)}。</p><p>${escape(c.prices.validity_rule)}</p><h4>資料限制</h4>${list(c.missing)}<h4>逐筆來源</h4><ul class="weekly-sources">${c.sources.map(s=>`<li><span>${escape(s.title)}</span> · <a href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">查看原始來源</a><small>${escape(s.claim_type)} · 期間 ${escape(s.data_period)} · 發布 ${escape(s.published_at)} · 查閱 ${escape(s.accessed_at)}</small>${s.published_at_reason ? `<p>${escape(s.published_at_reason)}</p>`:''}${s.note?`<p>${escape(s.note)}</p>`:''}</li>`).join('')}</ul></details></article>`).join('');
    const industryGuides={
      1:{title:'先進晶片製造與封裝',items:[
        ['為什麼值得關注','AI需要更高效能的晶片，也需要把多顆晶片有效組合。台積電的公司需求展望與獲利表現，提供較明確的成長依據。'],
        ['未來成長從哪裡來','未來1–3年觀察2奈米製程與先進封裝產能逐步投入生產，以及AI、伺服器處理器需求能否支持這些新產能。'],
        ['目前發展階段','產業已進入擴充產能的階段；接下來要看工廠是否按計畫交付，以及新增產能是否有足夠訂單使用。'],
        ['股價反映程度','股價已反映部分成長期待。封裝相關股票的估值較高，因此需要分別檢查每家公司的價格，而不是整個產業一起買進。'],
        ['接下來看什麼','觀察2奈米生產進度、封裝產能使用率與新工廠交付。產能擴大後，還要確認營收和獲利實際增加。'],
        ['主要風險','海外工廠成本較高，可能壓低獲利率；若客戶減少設備投資，需求也可能放慢。']]},
      2:{title:'高速網路與AI資料傳輸',items:[
        ['為什麼值得關注','AI伺服器之間需要傳輸大量資料，因此網路設備也必須升級。智邦9月營收仍強，但每股盈餘預估曾下修，進場前要確認獲利預期是否穩定。'],
        ['未來成長從哪裡來','800G產品持續出貨，以及速度更高的1.6T產品導入，是未來1–3年的觀察重點。'],
        ['目前發展階段','800G已在發展中段，1.6T仍是較早期的新產品。新技術要先通過客戶測試，再觀察是否形成持續訂單。'],
        ['股價反映程度','股價近20個交易日的表現落後營運成長，是值得觀察的差距；仍需確認每股盈餘預估改善，才能判斷是否提供合理進場機會。'],
        ['接下來看什麼','觀察1.6T的客戶測試與交付進度，以及每股盈餘預估是否停止下修。CPO等新技術會持續追蹤，取得實際營收證據後再納入獲利評估。'],
        ['主要風險','客戶較集中、產品更換速度快，供貨成本或新產品導入不順都可能影響獲利。']]},
      3:{title:'AI電源與資料中心供電',items:[
        ['為什麼值得關注','AI伺服器需要更多電力，資料中心也需要改善供電效率。台達電的電源與基礎設施業務已有成長實績。'],
        ['未來成長從哪裡來','觀察高功率電源、高壓直流供電與液冷產品的導入，以及設備交付能否持續帶來營收。'],
        ['目前發展階段','電源業務已在成長中段，高壓直流供電仍較早期。產品開始導入後，要繼續確認出貨規模和獲利。'],
        ['股價反映程度','市場已給較高的成長期待，股價與估值反映程度較多。現階段主要觀察合理價格及營運確認，分批計畫會依個股條件評估。'],
        ['接下來看什麼','觀察高功率電源與高壓直流供電的量產交付，以及新產品是否提升整體獲利。'],
        ['主要風險','客戶導入可能延期；自動化或交通等其他部門表現較弱時，也可能抵銷AI業務的部分成長。']]},
      4:{title:'高階電路板材料',items:[
        ['為什麼值得關注','AI設備升級也提高電路板材料要求。台光電9月營收及第二季獲利改善，支持材料升級的成長方向。'],
        ['未來成長從哪裡來','未來1–3年觀察高階材料需求、售價與產品組合改善，以及新工廠逐步投入生產。'],
        ['目前發展階段','產業仍在成長中段，但股價已反映較多期待。擴產計畫要經過客戶認證及良率確認，才有機會轉成收入。'],
        ['股價反映程度','目前估值偏高，新部位需要更謹慎評估價格與潛在風險；好產業仍要搭配合適買點。'],
        ['接下來看什麼','觀察新材料客戶認證、售價及產品組合，以及新產能的生產品質和使用率。'],
        ['主要風險','同業擴產太快可能增加供給，進而影響售價。股價已包含较高成長期待時，營運不如預期容易造成較大波動。']]},
      5:{title:'液冷與AI散熱',items:[
        ['為什麼值得關注','高功率AI晶片產生更多熱，帶動冷板、液冷模組與整體散熱設備需求。奇鋐第二季獲利改善，相關獲利預估也曾上調。'],
        ['未來成長從哪裡來','未來1–3年觀察新AI平台採用液冷，以及散熱模組與整體機構設計的需求增加。'],
        ['目前發展階段','產業處於擴張中段。新平台需求增加後，仍要確認公司是否取得訂單及維持供貨份額。'],
        ['股價反映程度','股價偏強，9月營收成長速度則放慢。現階段優先觀察回檔後是否穩定，再核對價格和營運是否同時支持進場。'],
        ['接下來看什麼','觀察新平台交付、客戶訂單與供貨份額，以及每股盈餘預估是否持續改善。'],
        ['主要風險','平台更換或竞争加劇可能改變供貨份額；若市場預期的高成長未實現，估值也可能調整。']]}
    };
    const sectors=card('本週產業 Top5', `<ol class="weekly-industry-list">${r.industries.map(i=>{
      const guide=r.update_id==='2026-W41-v3'?industryGuides[i.rank]:null;
      const items=guide?.items||[['為什麼值得關注',i.reason],['未來1–3年成長',i.growth_1to3y],['目前發展階段',i.stage],['股價反映程度',i.price_in],['接下來看什麼',i.catalyst],['主要風險',i.risk]];
      return `<li><h4>${escape(guide?.title||i.name)}</h4><p class="weekly-sector-search">搜尋相關股票：${i.search_terms.map(term=>`<a href="./?search=${encodeURIComponent(term)}#listTitle" data-weekly-search="${escape(term)}">${escape(term)}</a>`).join(' · ')}</p><ul>${items.map(([label,text])=>`<li><b>${escape(label)}：</b>${escape(text.replace(/较/g,'較').replace(/竞争/g,'競爭'))}</li>`).join('')}</ul><p class="weekly-sector-stocks"><b>相關股票：</b>${i.codes.map(code=>`<a href="./?company=${encodeURIComponent(code)}#detail" data-weekly-company="${escape(code)}">${escape(byCode[code]?.name||code)}（${escape(code)}）</a>`).join('、')}</p><details><summary>查看估值數字與資料日期</summary><p>${escape(plainCondition(i.price_in).replace(/TTM PE/g,'最近四季本益比').replace(/MA20/g,'20日平均收盤價').replace(/Forward/g,'預估'))}</p></details></li>`;
    }).join('')}</ol><details><summary>其他追蹤方向</summary>${r.other_trends.map(t=>`<h4>${escape(t.name)}</h4><p>${escape(t.assessment)}</p>`).join('')}</details>`);
    const otherTracked=r.companies.filter(c=>![...r.top_layout,...r.top_wait,...r.top_no_chase,...(r.top_research||[])].includes(c.code));
    const candidates=card('錯價候選／不追高篩選',r.mispricing.map(m=>`<h4>${analysisLink(m.code)}</h4><p>${escape(m.evidence)}</p><p>${escape(m.test)}</p>`).join('')+`<h4>基本面好但價格過強</h4>${r.overheated.map(m=>`<p><b>${analysisLink(m.code)}：</b>${escape(m.reason)}</p>`).join('')}<h4>其他持續追蹤股票</h4><p>這些股票仍在研究範圍，點選查看目前操作條件。</p>${otherTracked.map(c=>analysisLink(c.code)).join(' ')}`);
    const methodology=card('方法、版本與續做項目', `<p>${escape(r.scoring.scale)}</p>${Object.entries(r.scoring).filter(([k])=>k!=='scale').map(([k,v])=>`<p>${escape(v)}</p>`).join('')}<h4>訊號共同定義</h4>${list(Object.values(r.signal_definitions))}<h4>上週→本週</h4><p>${escape(r.changes.baseline)} 本版新增 ${r.changes.added.length} 檔；刪除 ${r.changes.removed.length} 檔；評分變動 ${r.changes.rating_changes.length} 項。</p>${list(r.changes.rating_changes.map(x=>`${x.code} ${byCode[x.code]?.name||""}：${x.field} ${x.from_score}→${x.to_score}；${x.reason}`))}<p>觀察價調整 ${r.changes.entry_changes.length} 檔；產業排序變動 ${r.changes.industry_changes.length} 項。</p><p>研究狀態 ${escape(r.research_status)}；週版本${escape(r.update_id)}。網站驗證與發布版本另外記錄，資料檔不以發布代替研究完成。</p><p><a href="data/weekly-investment/${escape(r.week_id)}-v${r.version}.json" target="_blank" rel="noopener">查看本週封存資料</a> · <a href="weekly-investment.html">獨立開啟報告</a></p><p>${escape(r.changes.method_change)}</p>${list(r.changes.entry_changes.map(x=>x.code+"："+x.reason))}<h4>未驗證／未更新資料</h4>${list(r.pending)}<p>例行法說與財報由既有網站流程維護；本專欄主要更新進場、信心與失效條件。${escape(r.source_priority)}</p>`);
    const screening=card('資料庫優先：全市場初篩', `<p>涵蓋 ${number(r.screening?.universe_count)} 家；${number(r.screening?.candidate_count)} 家符合初篩。這是待研究名單，不是買進排名。</p><p>${escape(r.screening?.selection_reason)}</p><p>條件：H1營收YoY≥20%、EPS增速高於營收、20交易日股價漲跌≤5%；虧轉盈另列，先排除業外與低基期假象。</p><p>${escape(r.screening?.next_types)}</p><h4>業外獲利警訊</h4>${list((r.screening?.value_trap_examples||[]).map(x=>x.name+'：'+x.note))}<h4>近期熱門產業與中期趨勢分開</h4><p>${escape(r.hot_sectors?.basis)}；基準 ${escape(r.hot_sectors?.asOf)}。</p>${list((r.hot_sectors?.items||[]).map(x=>x.name+'：前20檔中'+x.count+'檔。'+x.assessment))}<p>三個研究引擎：產業趨勢、公司拐點、市場錯價；ROIC、FCF及連續月營收覆蓋不足，不當成通過。</p><p><a href="https://github.com/ting11236/stock-lens/blob/main/research/weekly-investment/2026-W41-screen-v3.json" target="_blank" rel="noopener">查看完整篩選紀錄與來源雜湊</a></p>`);
    const b=r.backtest;
    const holdings=b?Object.values(b.holdings).filter(h=>h.shares>0):[];
    const currentAllocation=card('目前研究示範配置（與回測同一帳本）', b ? `<p><b>${holdings.length ? '只計已確認並成交的部位' : '尚無成立且成交的建倉：100%現金'}</b></p><p>${b.equity>0 && b.status!=='valuation_pending' ? `現金 ${number(b.cash/b.equity*100)}%` : '權重待有效行情確認'}${holdings.map(h=>` · ${stockLink(h.code)} ${b.equity>0 && h.market_value!=null && b.status!=='valuation_pending'?number(h.market_value/b.equity*100)+'%':'待估值'}`).join('')}</p><p>示範配置與回測共用同一帳本：條件成立後確認訊號，下一交易日符合成交條件才投入對應批次；條件成立後以小數股投入對應批次；未觸發、失效或行情未確認的批次等待後續確認。不是先照目標權重持倉。</p>` : '<p>帳本無法讀取，暫不推定目前配置。</p>');
    const backtest=card('回測：10000元跟隨AI建倉與出場', b ? `<p><b>開始日期 ${escape(b.start_date)} · ${b.status==='scheduled'?'尚未開始':b.status==='valuation_pending'?'行情／公司行動待確認':'前瞻模擬中'}</b></p><p>依每週當時已發布的建倉、減碼與分批出場計畫延續同一帳戶，不每週重新投入。</p><p><b>小數股研究模擬：</b>每批條件成立後，依配置金額模擬買入小數股，讓萬元帳戶也能跟隨高價股的分批建議。這是計算建議收益的模擬股數；建倉與出場條件和示範配置相同。</p><div class="weekly-grid">${card('目前模擬資產', `<strong>${number(b.equity)} 元</strong><p>起始 ${number(b.initial_capital)} 元；現金 ${number(b.cash)} 元</p>`)}${card('目前回測報酬', `<strong>${b.total_return_pct==null?'未開始／尚不能估值':number(b.total_return_pct)+'%'}</strong><p>已實現 ${number(b.realized_pnl)} 元；未實現 ${number(b.unrealized_pnl)} 元</p>`)}${card('經過多久', `<strong>${b.elapsed_days==null?'下週一開始':number(b.elapsed_days)+' 日曆日'}</strong><p>估值日期 ${escape(b.last_asOf)}；成交 ${b.trades.length} 筆</p>`)}</div><details class="weekly-overview-fold"><summary>條件式研究示範配置與建倉依據</summary><p>操作建議、目標配置與回測共用每週封存的權重及建倉／出場條件。配置是條件成立後的目標，不是實際持倉；回測只在訊號確認、資金及成交條件允許時執行。未觸發部分保留現金，小數股精度及費稅也會造成權重的小幅差異。</p>${currentAllocation}<details><summary>各股條件成立後的目標配置</summary>${portfolio}</details><p>每批比例以該股目標部位計算；出場按已發布出場計畫執行，不因目標配置不同便自動交易。</p></details><h4>目前持倉</h4>${holdings.length?`<div class="weekly-table-wrap"><table class="weekly-table"><thead><tr><th>股票</th><th>股數</th><th>建倉日期</th><th>持有天數</th><th>含買進費用成本</th><th>市值</th><th>未實現損益</th></tr></thead><tbody>${holdings.map(h=>`<tr><td><a href="./?company=${encodeURIComponent(h.code)}#detail" data-weekly-company="${escape(h.code)}">${escape(h.name)}</a></td><td>${quantity(h.shares)}</td><td>${escape(h.first_entry_date)}</td><td>${number(h.holding_days)}</td><td>${number(h.cost)}</td><td>${number(h.market_value)}</td><td>${number(h.unrealized_pnl)}</td></tr>`).join('')}</tbody></table></div>`:'<p>尚無持股。未開始或沒有完整買訊時保留現金。</p>'}<h4>逐筆建倉／分批出場紀錄</h4>${b.trades.length?`<div class="weekly-table-wrap"><table class="weekly-table"><thead><tr>${['訊號確認日','成交日','股票','買入／賣出','週報依據','第幾批與比例','股數','成交價','投入／收回金額','手續費／交易稅','持有多久','已實現損益','成交後現金','建倉／出場原因'].map(t=>`<th>${t}</th>`).join('')}</tr></thead><tbody>${b.trades.map(t=>`<tr><td>${escape(t.signal_date)}</td><td>${escape(t.date)}</td><td><a href="./?company=${encodeURIComponent(t.code)}#detail" data-weekly-company="${escape(t.code)}">${escape(t.name)}</a></td><td>${t.side==='buy'?'建倉':'出場'}</td><td>${escape(t.report_update_id)}</td><td>第${t.tranche_index+1}批／${number(t.tranche_pct)}%</td><td>${quantity(t.shares)}</td><td>${number(t.price)}</td><td>${number(t.gross_amount)}</td><td>${number(t.fee)}／${number(t.tax)}</td><td>${number(t.holding_days)}日</td><td>${number(t.realized_pnl)}</td><td>${number(t.cash_after)}</td><td class="weekly-wide">${escape(t.condition)}</td></tr>`).join('')}</tbody></table></div>`:'<p>尚無成交紀錄；不以事後價格回填之前未確認的建倉或出場。</p>'}<h4>每日資產與報酬歷程</h4>${b.daily_snapshots.length?list(b.daily_snapshots.slice().reverse().map(d=>`${d.date}：第${d.elapsed_days}日，資產${number(d.equity)}元、現金${number(d.cash)}元、報酬${number(d.total_return_pct)}%。`)):'<p>下週開始累積；目前不宣稱已有回測獲利。</p>'}<details><summary>沒有成交的原因與回測方法</summary>${list((b.pending_signals||[]).map(x=>`${x.signal_date} ${x.code}：${x.reason}`))}${list(b.events.map(x=>`${x.date} ${x.code}：${x.reason}`))}${list(b.rules)}<p>估計全數出場後資產 ${number(b.estimated_liquidation_equity)} 元；這是扣除預估費用的情境，未實際出場不計已實現。</p>${(b.sources||[]).map(x=>`<p><a href="${safeUrl(x.url)}" target="_blank" rel="noopener">${escape(x.title)}</a>：期間${escape(x.data_period)}，發布${escape(x.published_at)}（${escape(x.published_at_reason)}），查閱${escape(x.accessed_at)}。</p>`).join('')}</details>` : '<p>回測帳本暫時無法讀取，請稍後重新開啟；不以缺資料顯示0%報酬。</p>');
    const tabs=`<nav class="weekly-stock-tabs" role="tablist" aria-label="AI研究內容"><button id="weekly-tab-overview" role="tab" data-weekly-tab="overview" aria-controls="weekly-overview" aria-selected="true">總覽</button><button id="weekly-tab-industries" role="tab" data-weekly-tab="industries" aria-controls="weekly-industries" aria-selected="false" tabindex="-1">本週產業 Top5</button><button id="weekly-tab-backtest" role="tab" data-weekly-tab="backtest" aria-controls="weekly-backtest" aria-selected="false" tabindex="-1">回測</button></nav>`;
    return linkMentionedStocks(`<div class="weekly-report">${tabs}<section id="weekly-overview" data-weekly-panel="overview" role="tabpanel" aria-labelledby="weekly-tab-overview">${conclusion}${alerts}${choice}${turnaround}<details class="weekly-overview-fold"><summary>錯價候選與不追高原因</summary>${candidates}</details><details class="weekly-overview-fold"><summary>研究方法、版本與資料限制</summary>${methodology}</details><details class="weekly-overview-fold"><summary>全市場研究篩選：查看研究流程</summary>${screening}</details></section><section id="weekly-industries" data-weekly-panel="industries" role="tabpanel" aria-labelledby="weekly-tab-industries" hidden>${sectors}</section><section id="weekly-backtest" data-weekly-panel="backtest" role="tabpanel" aria-labelledby="weekly-tab-backtest" hidden>${backtest}</section>${details}<dialog class="weekly-analysis-dialog" aria-labelledby="weekly-analysis-title"><header class="weekly-analysis-heading"><h2 id="weekly-analysis-title"></h2><button type="button" data-weekly-close-analysis>✕ 返回總覽</button></header><div class="weekly-analysis-body"></div></dialog><p class="tiny">研究示範不保證報酬；此頁不代客交易。最新收盤後價格與訊號須重新確認。</p></div>`,r.companies.concat(r.screening?.value_trap_examples || []));
  }
  // Link to the existing company section, including direct entry from the standalone report.
  let returnContext={tab:'industries',scroll:0};
  function rememberReportPosition() {
    const dialog=document.getElementById('weeklyInvestmentDialog');
    const content=document.getElementById('weeklyInvestmentContent');
    if(dialog?.open && content) returnContext={tab:content.querySelector('[data-weekly-tab][aria-selected="true"]')?.dataset.weeklyTab||'overview',scroll:content.scrollTop,analysis:content.dataset.analysisCode||null,analysisScroll:content.querySelector('.weekly-analysis-body')?.scrollTop||0};
    const back=document.getElementById('weeklyReturnReport');
    if(back) back.hidden=false;
  }
  function openExistingSearch(term) {
    if(typeof state==='undefined' || typeof setTab!=='function' || !state.stocks.length || !term || term.length>80) return false;
    rememberReportPosition();
    document.querySelector('.weekly-analysis-dialog[open]')?.close();
    document.getElementById('weeklyInvestmentDialog')?.close();
    state.filter='全部';state.search=term.trim().toLowerCase();state.industryFilter=null;state.categoryAnchor=null;state.researchFilter='all';state.page=1;
    document.getElementById('search').value=term;document.getElementById('categoryFilter').value='全部';
    for(const key of ['priceMin','priceMax','metricMin','metricMax']){state[key]=null;document.getElementById(key).value='';}
    setTab('all');document.getElementById('listTitle').scrollIntoView({block:'start'});return true;
  }
  function openExistingCompany(code) {
    if(!/^\d{4}$/.test(code) || typeof state==='undefined' || typeof selectCompany!=='function' || !state.stocks.some(s=>s.symbol===code+'.TW')) return false;
    rememberReportPosition();
    document.querySelector('.weekly-analysis-dialog[open]')?.close();
    document.getElementById('weeklyInvestmentDialog')?.close();
    state.filter='全部';state.search=code;state.industryFilter=null;state.categoryAnchor=null;state.researchFilter='all';state.page=1;
    document.getElementById('search').value=code;document.getElementById('categoryFilter').value='全部';
    for(const key of ['priceMin','priceMax','metricMin','metricMax']){state[key]=null;document.getElementById(key).value='';}
    setTab('all');selectCompany(code+'.TW');return true;
  }
  const linkedCode=typeof window==='undefined'?null:new URL(window.location.href).searchParams.get('company');
  const linkedSearch=typeof window==='undefined'?null:new URL(window.location.href).searchParams.get('search');
  if(linkedSearch && linkedSearch.length<=80 && document.getElementById('stockRows')) {
    if(!openExistingSearch(linkedSearch)) {
      const observer=new MutationObserver(()=>{
        if(typeof state!=='undefined' && state.stocks.length) {observer.disconnect();openExistingSearch(linkedSearch);}
      });
      observer.observe(document.getElementById('stockRows'),{childList:true});
    }
  }
  if(linkedCode && /^\d{4}$/.test(linkedCode) && document.getElementById('stockRows')) {
    if(!openExistingCompany(linkedCode)) {
      const observer=new MutationObserver(()=>{
        if(typeof state!=='undefined' && state.stocks.some(s=>s.symbol===linkedCode+'.TW')) {observer.disconnect();openExistingCompany(linkedCode);}
      });
      observer.observe(document.getElementById('stockRows'),{childList:true});
    }
  }
  const loadedReports = new Map();
  const boundRoots = new WeakSet();
  function bindTabs(root) {
    if (boundRoots.has(root)) return;
    boundRoots.add(root);
    function select(code, focus=false) {
      const target=root.querySelector(`[data-weekly-tab="${code}"]`);
      if(!target) return;
      root.querySelectorAll('[data-weekly-tab]').forEach(b=>{const active=b===target;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
      root.querySelectorAll('[data-weekly-panel]').forEach(p=>p.hidden=p.dataset.weeklyPanel!==code);
      if(focus) target.focus();
      if(root.id==='weeklyInvestmentContent') root.scrollTop=0;
      else root.scrollIntoView({block:'start'});
    }
    let analysisOpener=null;
    function openAnalysis(code) {
      const analysis=root.querySelector('.weekly-analysis-dialog');
      const source=root.querySelector(`[data-weekly-analysis-template="${code}"]`);
      if(!source || !analysis) return;
      root.dataset.analysisCode=code;
      analysisOpener=root.querySelector(`[data-weekly-analysis="${code}"]`);
      analysis.querySelector('h2').innerHTML=source.querySelector('h3').innerHTML;
      const body=analysis.querySelector('.weekly-analysis-body');
      body.innerHTML=source.innerHTML;
      body.querySelector('header')?.remove();
      if(!analysis.open) analysis.showModal();
      body.scrollTop=0;
    }
    root.addEventListener('close',e=>{if(e.target.matches('.weekly-analysis-dialog')){delete root.dataset.analysisCode;analysisOpener?.focus({preventScroll:true});}},true);
    root.addEventListener('click',e=>{
      const opener=e.target.closest('[data-weekly-analysis]');
      if(opener) openAnalysis(opener.dataset.weeklyAnalysis);
      if(e.target.closest('[data-weekly-close-analysis]')) root.querySelector('.weekly-analysis-dialog')?.close();
      const industry=e.target.closest('[data-weekly-search]');
      if(industry && openExistingSearch(industry.dataset.weeklySearch)) e.preventDefault();
      const company=e.target.closest('[data-weekly-company]');
      if(company && openExistingCompany(company.dataset.weeklyCompany)) e.preventDefault();
      const button=e.target.closest('[data-weekly-tab]');
      if(button) select(button.dataset.weeklyTab);
      const link=e.target.closest('a[href^="#weekly-"]');
      if(link){e.preventDefault();select(link.getAttribute('href').replace('#weekly-',''),true);}
    });
    root.addEventListener('keydown',e=>{
      const active=e.target.closest('[data-weekly-tab]');
      if(!active || !['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
      e.preventDefault();const tabs=[...root.querySelectorAll('[data-weekly-tab]')];const i=tabs.indexOf(active);
      const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
      select(tabs[next].dataset.weeklyTab,true);
    });
  }
  async function loadReport(root) {
    root.setAttribute('aria-busy','true');
    root.innerHTML='<p class="weekly-loading" role="status">正在載入AI產業與台股投資分析…</p>';
    try {
      const response=await fetch('data/weekly-investment.json', {cache:'no-store'});
      if (!response.ok) throw new Error('report unavailable');
      const r=await response.json();
      if (![1,2].includes(r.schema_version) || !Array.isArray(r.companies) || r.companies.length===0) throw new Error('report invalid');
      try {
        const ledgerResponse=await fetch('data/weekly-backtest.json',{cache:'no-store'});
        if(ledgerResponse.ok){const ledger=await ledgerResponse.json();if(ledger.schema_version===1 && Array.isArray(ledger.trades) && Array.isArray(ledger.daily_snapshots))r.backtest=ledger;}
      } catch { /* Keep the report readable; the backtest panel explicitly reports missing data. */ }
      root.innerHTML=render(r);
      loadedReports.set(root, r);
      bindTabs(root);
    } catch {
      root.innerHTML='<p class="notice warn" role="alert">AI研究報告暫時無法讀取。請稍後重新開啟；原市場資料與自選功能仍可使用。</p>';
    } finally { root.setAttribute('aria-busy','false'); }
  }
  if (typeof window !== 'undefined') window.setInterval(() => {
    loadedReports.forEach((r,root) => {
      root.querySelectorAll('.weekly-freshness').forEach(status=>status.textContent=freshness(r));
    });
  }, 60000);
  const trigger=document.getElementById('weeklyInvestmentOpen');
  const dialog=document.getElementById('weeklyInvestmentDialog');
  const root=document.getElementById('weeklyInvestmentContent');
  const backButton=document.getElementById('weeklyReturnReport');
  if(backButton && dialog && root) backButton.addEventListener('click',async()=>{
    dialog.showModal();
    if(!loadedReports.has(root)) await loadReport(root);
    root.querySelector(`[data-weekly-tab="${returnContext.tab}"]`)?.click();
    root.scrollTop=returnContext.scroll;
    if(returnContext.analysis){root.querySelector(`[data-weekly-analysis="${returnContext.analysis}"]`)?.click();const body=root.querySelector('.weekly-analysis-body');if(body)body.scrollTop=returnContext.analysisScroll;}
    backButton.hidden=true;
  });
  if (trigger && dialog && root) {
    trigger.addEventListener('click',()=>{ dialog.showModal(); loadReport(root); });
    document.getElementById('weeklyInvestmentClose')?.addEventListener('click',()=>{root.querySelector('.weekly-analysis-dialog[open]')?.close();dialog.close();});
    dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();}});
  }
  const standalone=document.getElementById('weeklyStandalone');
  if(standalone) loadReport(standalone);
  // Public pure helpers for focused validation without requiring the main market application.
  if(typeof module!=='undefined' && module.exports) module.exports={escape,range,freshness,render,linkMentionedStocks};
})();
