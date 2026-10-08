(() => {
  'use strict';
  const escape = v => String(v ?? '—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = v => v == null ? '—' : Number(v).toLocaleString('zh-TW', {maximumFractionDigits:2});
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
    const names = codes => codes.map(stockLink).join('、');
    const conclusion = `<div class="weekly-kicker">${escape(r.week_id)} · 週報 v${r.version} · 研究判斷</div><h2 class="weekly-headline">${escape(r.headline)}</h2><p class="weekly-freshness" role="status">${escape(freshness(r))}</p>${list(r.summary)}<div class="weekly-grid">${card('布局', `<strong>${r.top_layout.length ? names(r.top_layout) : '0 檔完整觸發'}</strong><p>目前等待條件，不強迫選滿三檔。</p>`)}${card('優先等待', `<strong>${r.top_wait.map(code => `${stockLink(code)}（信心 ${number(byCode[code].scores.confidence)}/10）`).join('、')}</strong><p>到價只是提醒；止穩、量能與基本面同時確認才評估新部位。</p>`)}${card('不追高', `<strong>${names(r.top_no_chase)}</strong><p>公司品質與買點分開判斷；已有部位參照個股持有策略。</p>`)}${card('低動能改善研究候選', `<strong>${names(r.top_research || [])}</strong><p>${escape(r.top_notes?.research || '')}</p>`)}</div>`;
    const alerts = card('最值得設定的 3 個價格提醒', `<div class="weekly-alerts">${r.alerts.map(a=>`<article><b>${stockLink(a.code)} · ${number(a.price)}</b><span>${escape(a.direction)} · ${escape(a.asOf || r.priceAsOf)}</span><p>${escape(a.reason)}</p></article>`).join('')}</div><p class="tiny">提醒價格不是買單；各股基準見提醒標示；最遲有效至 ${escape(r.freshness.valid_until.slice(0,10))} 前，遇新收盤或重大變化需重驗。</p>`);
    const columns=['產業','股票','定位與權重','目前股價','位階','1–3年邏輯','市場可能錯估','第一關注價','最佳布局區','右側突破價','建倉指引','持有策略','失效條件','信心度'];
    const table=card('最終操作表', `<p class="tiny">左右滑動比較；股票名稱可切到完整分析。權重為條件式研究示範，尚未觸發。</p><div class="weekly-table-wrap" tabindex="0" aria-label="投資操作表，可橫向捲動"><table class="weekly-table"><thead><tr>${columns.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${r.companies.map(c=>`<tr><td>${escape(c.industry)}</td><td>${stockLink(c.code)}</td><td>${escape(c.position.role)}<small>${range(c.position.weight_range_pct)}%</small></td><td>${number(c.price)}<small>${escape(c.priceAsOf)}</small></td><td>${escape(c.position.stage)}</td><td class="weekly-wide">${escape(c.growth_1to3y)}</td><td class="weekly-wide">${escape(c.variant_view?.research_hypothesis || c.market_expectations)}</td><td>${range(c.prices.first_attention)}</td><td>${range(c.prices.best_entry)}</td><td>${number(c.prices.breakout)}</td><td class="weekly-wide"><b>${escape(c.building_plan.current_action)}</b><p>${escape(c.building_plan.conditional_action)}</p></td><td class="weekly-wide">${escape(c.holding_strategy)}</td><td class="weekly-wide">${escape(c.position_management)}<p>${escape(c.thesis_failure)}</p></td><td>${c.scores.confidence}/10</td></tr>`).join('')}</tbody></table></div>`);
    const choice=card('只能選一檔的中期研究選擇', `<p><b>${stockLink(r.only_one.code)}</b></p>`+list(r.only_one.reasons));
    const portfolio=card('條件式研究示範配置', `<p>${escape(r.portfolio.type)}</p><p><b>${escape(r.portfolio.current_new_money)}</b></p><p>條件成立後的示範基準：${Object.entries(r.portfolio.base_weights).map(([c,w])=>`${c==='cash'?'現金':stockLink(c)} ${number(w)}%`).join(' · ')}，合計100%。</p><p>${escape(r.portfolio.ranges_note)}</p><p>${escape(r.portfolio.factor_exposure)}</p><p>現金區間${range(r.portfolio.cash_range)}%，AI共同因子上限${r.portfolio.ai_factor_cap}%。${escape(r.portfolio.risk_note)}</p>`);
    const details=r.companies.map(c=>`<article class="weekly-card weekly-company" id="weekly-${c.code}" data-weekly-panel="${c.code}" role="tabpanel" aria-labelledby="weekly-tab-${c.code}" hidden><header><h3>${stockLink(c.code)}</h3><span class="weekly-role">${escape(c.position.role)}</span></header><p class="weekly-decision">${escape(c.position.stage)} · ${escape(c.building_plan.current_action)}</p><p class="weekly-freshness" role="status">${escape(freshness({...r,priceAsOf:c.priceAsOf}))}</p><p><b>官方收盤 ${number(c.price)} 元（${escape(c.priceAsOf)}）</b></p><p><b>AI信心 ${c.scores.confidence}/10 · 估值／買點 ${c.scores.valuation_entry}/10 · 公司品質 ${c.scores.quality}/10</b></p><p>已有持股：${escape(c.holding_strategy)}</p>${card("是否建倉／如何分批", `<p>${escape(c.building_plan.conditional_action)}</p>${list(c.building_plan.tranches.map(t=>`${t.target_pct}%目標部位：${t.condition}`))}<p>${escape(c.building_plan.target_basis)}</p><p><b>停止加碼：</b>${escape(c.building_plan.stop_addition)}</p>`)}<div class="weekly-grid">${card('進場訊號', `<p>${escape(c.buy_signal)}</p><p><b>基本面確認：</b>${escape(c.fundamental_confirmation)}</p>`)}${card('買點不成立／風險管理', `<p>第一關注 ${range(c.prices.first_attention)}；最佳 ${range(c.prices.best_entry)}；突破 ${number(c.prices.breakout)}。</p><p>${escape(c.prices.reason)}</p><p>${escape(c.position_management)}</p><p><b>thesis失效：</b>${escape(c.thesis_failure)}</p>`)}${card('AI研究信心', `<div class="weekly-scores">${Object.entries(c.scores).map(([k,v])=>`<span>${({quality:'品質',industry:'產業',improvement:'改善潛力',valuation_entry:'估值／買點',confidence:'信心'})[k]}<b>${v}/10</b></span>`).join('')}</div><p>${escape(c.score_reason)}</p><p>信心取決於證據完整度，不等於上漲機率。${escape(c.risk)}</p>`)}</div><details><summary>展開論點、估值、價量與例行資料日期</summary><h4>Thesis與1–3年動能</h4><p>${escape(c.thesis)}</p><p>${escape(c.growth_1to3y)}</p><h4>市場預期與price-in</h4><p>${escape(c.market_expectations)}</p><p>${escape(c.price_in)}</p><h4>基本面拐點與競爭力</h4><p>${escape(c.candidate_type)}</p><p>${escape(c.fundamental_inflection)}</p><p>${escape(c.competition)}</p><h4>Variant View：待驗證假說</h4><p>市場可能預期：${escape(c.variant_view?.market_hypothesis)}</p><p>研究假說：${escape(c.variant_view?.research_hypothesis)}</p><p>確認／反證：${escape(c.variant_view?.confirmation)}</p><h4>Reverse Valuation 敏感度</h4><p>研究PE帶 ${range(c.reverse_valuation?.assumption_pe)}；反推所需EPS ${range(c.reverse_valuation?.implied_eps)}；相對TTM增幅 ${range(c.reverse_valuation?.required_growth_pct)}%。${escape(c.reverse_valuation?.reason)}</p><p>${escape(c.valuation_methods)}</p><p>官方PB ${number(c.valuation.official_pb)}（${escape(c.valuation.official_pe_date)}）。</p><h4>估值口徑</h4><p>TTM EPS ${number(c.financial.ttm_eps)}（${escape(c.financial.ttm_period)}）；自行TTM PE ${number(c.valuation.ttm_pe)}；官方PE ${number(c.valuation.official_pe)}（${escape(c.valuation.official_pe_date)}）。${escape(c.valuation.official_pe_note)}</p><p>2026 Forward PE ${number(c.valuation.forward_pe)}；2027 Forward PE ${number(c.valuation.forward_next_year_pe)}。${c.valuation.consensus ? `${escape(c.valuation.consensus.provider)}，發布${escape(c.valuation.consensus.published_at)}，${c.valuation.consensus.coverage}位分析師，2026 EPS中位${number(c.valuation.consensus.median)}，前值${number(c.valuation.consensus.previous)}，範圍${number(c.valuation.consensus.low)}–${number(c.valuation.consensus.high)}。${escape(c.valuation.consensus.note)}` : escape(c.valuation.consensus_missing_reason)}</p><p>研究估值：${escape(c.valuation.classification)}，合理TTM PE帶${range(c.valuation.reasonable_ttm_pe_range)}，對應${range(c.valuation.reasonable_ttm_price_range)}元。${escape(c.valuation.assumption)} 所有倍數假設均為研究判斷。</p><h4>官方價量與基本面快照</h4><p>5／10／20／60日均線：${Object.values(c.technical.ma).map(number).join('／')}。20日高低 ${number(c.technical.low20)}–${number(c.technical.high20)}；成交 ${number(c.technical.volume)}股，前20日均量 ${number(c.technical.average_volume_20)}股（${number(c.technical.volume_ratio)}倍）；20日漲跌 ${number(c.technical.return20)}%。${escape(c.technical.basis)}</p><p>${escape(c.financialPeriod)}：EPS ${number(c.financial.eps)}，毛利率 ${number(c.financial.gross_margin)}%，營益率 ${number(c.financial.operating_margin)}%。${escape(c.financial.eps_basis)}。${escape(c.financial.eps_comparability_note)}</p><p>${escape(c.monthly.period)}營收 ${number(c.monthly.revenue_twd_thousand == null ? null : c.monthly.revenue_twd_thousand/100000)}億元、YoY ${number(c.monthly.yoy)}%。${escape(c.monthly.latest_missing_reason||'')} 訂單、CAPEX、產能與營收分開判斷。</p><p class="tiny">updatedAt ${escape(c.updatedAt)} · priceAsOf ${escape(c.priceAsOf)} · financialPeriod ${escape(c.financialPeriod)} · forecastAsOf ${escape(c.forecastAsOf)} · 觀察價asOf ${escape(c.prices.asOf)}／有效至 ${escape(c.prices.valid_until)}。</p><p>${escape(c.prices.validity_rule)}</p><h4>資料限制</h4>${list(c.missing)}<h4>逐筆來源</h4><ul class="weekly-sources">${c.sources.map(s=>`<li><span>${escape(s.title)}</span> · <a href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">查看原始來源</a><small>${escape(s.claim_type)} · 期間 ${escape(s.data_period)} · 發布 ${escape(s.published_at)} · 查閱 ${escape(s.accessed_at)}</small>${s.published_at_reason ? `<p>${escape(s.published_at_reason)}</p>`:''}${s.note?`<p>${escape(s.note)}</p>`:''}</li>`).join('')}</ul></details></article>`).join('');
    const sectors=card('本週產業 Top5 與排序理由', `<p>${escape(r.industry_ranking_scope)}</p><ol>${r.industries.map(i=>`<li><h4>${i.search_terms.map(term=>`<a href="./?search=${encodeURIComponent(term)}#listTitle" data-weekly-search="${escape(term)}">${escape(term)}</a>`).join("／")} <small>${escape(i.stage)}</small></h4><p>${escape(i.reason)}</p><p>1–3年：${escape(i.growth_1to3y)}</p><p>價格反映：${escape(i.price_in)}</p><p>${escape(i.evidence_gap)}</p><p>催化：${escape(i.catalyst)}。風險：${escape(i.risk)}。</p><p class="weekly-sector-stocks"><b>相關股票：</b>${i.codes.map(code=>`<a href="./?company=${encodeURIComponent(code)}#detail" data-weekly-company="${escape(code)}">${escape(byCode[code]?.name||code)}（${escape(code)}）</a>`).join("、")}</p></li>`).join('')}</ol><details><summary>其他追蹤趨勢與缺漏</summary>${r.other_trends.map(t=>`<h4>${escape(t.name)}</h4><p>${escape(t.assessment)}</p>`).join('')}</details>`);
    const candidates=card('錯價候選／不追高篩選',r.mispricing.map(m=>`<h4>${stockLink(m.code)}</h4><p>${escape(m.evidence)}</p><p>${escape(m.test)}</p>`).join('')+`<h4>基本面好但價格過強</h4>${r.overheated.map(m=>`<p><b>${stockLink(m.code)}：</b>${escape(m.reason)}</p>`).join('')}`);
    const methodology=card('方法、版本與續做項目', `<p>${escape(r.scoring.scale)}</p>${Object.entries(r.scoring).filter(([k])=>k!=='scale').map(([k,v])=>`<p>${escape(v)}</p>`).join('')}<h4>訊號共同定義</h4>${list(Object.values(r.signal_definitions))}<h4>上週→本週</h4><p>${escape(r.changes.baseline)} 本版新增 ${r.changes.added.length} 檔；刪除 ${r.changes.removed.length} 檔；評分變動 ${r.changes.rating_changes.length} 項。</p>${list(r.changes.rating_changes.map(x=>`${x.code} ${byCode[x.code]?.name||""}：${x.field} ${x.from_score}→${x.to_score}；${x.reason}`))}<p>觀察價調整 ${r.changes.entry_changes.length} 檔；產業排序變動 ${r.changes.industry_changes.length} 項。</p><p>研究狀態 ${escape(r.research_status)}；週版本${escape(r.update_id)}。網站驗證與發布版本另外記錄，資料檔不以發布代替研究完成。</p><p><a href="data/weekly-investment/${escape(r.week_id)}-v${r.version}.json" target="_blank" rel="noopener">查看本週封存資料</a> · <a href="weekly-investment.html">獨立開啟報告</a></p><p>${escape(r.changes.method_change)}</p>${list(r.changes.entry_changes.map(x=>x.code+"："+x.reason))}<h4>未驗證／未更新資料</h4>${list(r.pending)}<p>例行法說與財報由既有網站流程維護；本專欄主要更新進場、信心與失效條件。${escape(r.source_priority)}</p>`);
    const screening=card('資料庫優先：全市場初篩', `<p>涵蓋 ${number(r.screening?.universe_count)} 家；${number(r.screening?.candidate_count)} 家符合初篩。這是待研究名單，不是買進排名。</p><p>${escape(r.screening?.selection_reason)}</p><p>條件：H1營收YoY≥20%、EPS增速高於營收、20交易日股價漲跌≤5%；虧轉盈另列，先排除業外與低基期假象。</p><p>${escape(r.screening?.next_types)}</p><h4>業外獲利警訊</h4>${list((r.screening?.value_trap_examples||[]).map(x=>x.name+'：'+x.note))}<h4>近期熱門產業與中期趨勢分開</h4><p>${escape(r.hot_sectors?.basis)}；基準 ${escape(r.hot_sectors?.asOf)}。</p>${list((r.hot_sectors?.items||[]).map(x=>x.name+'：前20檔中'+x.count+'檔。'+x.assessment))}<p>三個研究引擎：產業趨勢、公司拐點、市場錯價；ROIC、FCF及連續月營收覆蓋不足，不當成通過。</p><p><a href="https://github.com/ting11236/stock-lens/blob/main/research/weekly-investment/2026-W41-screen-v3.json" target="_blank" rel="noopener">查看完整篩選紀錄與來源雜湊</a></p>`);
    const b=r.backtest;
    const holdings=b?Object.values(b.holdings).filter(h=>h.shares>0):[];
    const backtest=card('回測：10000元跟隨AI建倉與出場', b ? `<p><b>開始日期 ${escape(b.start_date)} · ${b.status==='scheduled'?'尚未開始':b.status==='valuation_pending'?'行情／公司行動待確認':'前瞻模擬中'}</b></p><p>依每週當時已發布的建倉、減碼與分批出場計畫延續同一帳戶，不每週重新投入。</p><div class="weekly-grid">${card('目前模擬資產', `<strong>${number(b.equity)} 元</strong><p>起始 ${number(b.initial_capital)} 元；現金 ${number(b.cash)} 元</p>`)}${card('目前回測報酬', `<strong>${b.total_return_pct==null?'未開始／尚不能估值':number(b.total_return_pct)+'%'}</strong><p>已實現 ${number(b.realized_pnl)} 元；未實現 ${number(b.unrealized_pnl)} 元</p>`)}${card('經過多久', `<strong>${b.elapsed_days==null?'下週一開始':number(b.elapsed_days)+' 日曆日'}</strong><p>估值日期 ${escape(b.last_asOf)}；成交 ${b.trades.length} 筆</p>`)}</div><h4>目前持倉</h4>${holdings.length?`<div class="weekly-table-wrap"><table class="weekly-table"><thead><tr><th>股票</th><th>股數</th><th>建倉日期</th><th>持有天數</th><th>含買進費用成本</th><th>市值</th><th>未實現損益</th></tr></thead><tbody>${holdings.map(h=>`<tr><td><a href="./?company=${encodeURIComponent(h.code)}#detail" data-weekly-company="${escape(h.code)}">${escape(h.name)}</a></td><td>${number(h.shares)}</td><td>${escape(h.first_entry_date)}</td><td>${number(h.holding_days)}</td><td>${number(h.cost)}</td><td>${number(h.market_value)}</td><td>${number(h.unrealized_pnl)}</td></tr>`).join('')}</tbody></table></div>`:'<p>尚無持股。未開始或沒有完整買訊時保留現金。</p>'}<h4>逐筆建倉／分批出場紀錄</h4>${b.trades.length?`<div class="weekly-table-wrap"><table class="weekly-table"><thead><tr>${['訊號確認日','成交日','股票','買入／賣出','週報依據','第幾批與比例','股數','成交價','投入／收回金額','手續費／交易稅','持有多久','已實現損益','成交後現金','建倉／出場原因'].map(t=>`<th>${t}</th>`).join('')}</tr></thead><tbody>${b.trades.map(t=>`<tr><td>${escape(t.signal_date)}</td><td>${escape(t.date)}</td><td><a href="./?company=${encodeURIComponent(t.code)}#detail" data-weekly-company="${escape(t.code)}">${escape(t.name)}</a></td><td>${t.side==='buy'?'建倉':'出場'}</td><td>${escape(t.report_update_id)}</td><td>第${t.tranche_index+1}批／${number(t.tranche_pct)}%</td><td>${number(t.shares)}</td><td>${number(t.price)}</td><td>${number(t.gross_amount)}</td><td>${number(t.fee)}／${number(t.tax)}</td><td>${number(t.holding_days)}日</td><td>${number(t.realized_pnl)}</td><td>${number(t.cash_after)}</td><td class="weekly-wide">${escape(t.condition)}</td></tr>`).join('')}</tbody></table></div>`:'<p>尚無成交紀錄；不以事後價格回填之前未確認的建倉或出場。</p>'}<h4>每日資產與報酬歷程</h4>${b.daily_snapshots.length?list(b.daily_snapshots.slice().reverse().map(d=>`${d.date}：第${d.elapsed_days}日，資產${number(d.equity)}元、現金${number(d.cash)}元、報酬${number(d.total_return_pct)}%。`)):'<p>下週開始累積；目前不宣稱已有回測獲利。</p>'}<details><summary>沒有成交的原因與回測方法</summary>${list((b.pending_signals||[]).map(x=>`${x.signal_date} ${x.code}：${x.reason}`))}${list(b.events.map(x=>`${x.date} ${x.code}：${x.reason}`))}${list(b.rules)}<p>估計全數出場後資產 ${number(b.estimated_liquidation_equity)} 元；這是扣除預估費用的情境，未實際出場不計已實現。</p>${(b.sources||[]).map(x=>`<p><a href="${safeUrl(x.url)}" target="_blank" rel="noopener">${escape(x.title)}</a>：期間${escape(x.data_period)}，發布${escape(x.published_at)}（${escape(x.published_at_reason)}），查閱${escape(x.accessed_at)}。</p>`).join('')}</details>` : '<p>回測帳本暫時無法讀取，請稍後重新開啟；不以缺資料顯示0%報酬。</p>');
    const tabs=`<nav class="weekly-stock-tabs" role="tablist" aria-label="選擇股票分析"><button id="weekly-tab-overview" role="tab" data-weekly-tab="overview" aria-controls="weekly-overview" aria-selected="true">總覽</button><button id="weekly-tab-industries" role="tab" data-weekly-tab="industries" aria-controls="weekly-industries" aria-selected="false" tabindex="-1">本週產業 Top5</button><button id="weekly-tab-backtest" role="tab" data-weekly-tab="backtest" aria-controls="weekly-backtest" aria-selected="false" tabindex="-1">回測</button><button id="weekly-tab-screening" role="tab" data-weekly-tab="screening" aria-controls="weekly-screening" aria-selected="false" tabindex="-1">全市場研究篩選</button>${r.companies.map(c=>`<button id="weekly-tab-${c.code}" role="tab" data-weekly-tab="${c.code}" aria-controls="weekly-${c.code}" aria-selected="false" tabindex="-1">${escape(c.code)}</button><a href="./?company=${encodeURIComponent(c.code)}#detail" data-weekly-company="${escape(c.code)}">${escape(c.name)}</a>`).join('')}</nav>`;
    return linkMentionedStocks(`<div class="weekly-report"><p class="tiny">點股票代號切換分析；點股票名稱跳到下方原個股介面，並可回上一頁。</p>${tabs}<section id="weekly-overview" data-weekly-panel="overview" role="tabpanel" aria-labelledby="weekly-tab-overview">${conclusion}${alerts}${choice}${portfolio}<details class="weekly-overview-fold"><summary>比較 ${r.companies.length} 檔操作表</summary>${table}</details><details class="weekly-overview-fold"><summary>錯價候選與不追高原因</summary>${candidates}</details><details class="weekly-overview-fold"><summary>研究方法、版本與資料限制</summary>${methodology}</details></section><section id="weekly-industries" data-weekly-panel="industries" role="tabpanel" aria-labelledby="weekly-tab-industries" hidden>${sectors}</section><section id="weekly-screening" data-weekly-panel="screening" role="tabpanel" aria-labelledby="weekly-tab-screening" hidden>${screening}</section><section id="weekly-backtest" data-weekly-panel="backtest" role="tabpanel" aria-labelledby="weekly-tab-backtest" hidden>${backtest}</section>${details}<p class="tiny">研究示範不保證報酬；此頁不代客交易。最新收盤後價格與訊號須重新確認。</p></div>`,r.companies.concat(r.screening?.value_trap_examples || []));
  }
  // Link to the existing company section, including direct entry from the standalone report.
  let returnContext={tab:'industries',scroll:0};
  function rememberReportPosition() {
    const dialog=document.getElementById('weeklyInvestmentDialog');
    const content=document.getElementById('weeklyInvestmentContent');
    if(dialog?.open && content) returnContext={tab:content.querySelector('[data-weekly-tab][aria-selected="true"]')?.dataset.weeklyTab||'overview',scroll:content.scrollTop};
    const back=document.getElementById('weeklyReturnReport');
    if(back) back.hidden=false;
  }
  function openExistingSearch(term) {
    if(typeof state==='undefined' || typeof setTab!=='function' || !state.stocks.length || !term || term.length>80) return false;
    rememberReportPosition();
    document.getElementById('weeklyInvestmentDialog')?.close();
    state.filter='全部';state.search=term.trim().toLowerCase();state.industryFilter=null;state.categoryAnchor=null;state.researchFilter='all';state.page=1;
    document.getElementById('search').value=term;document.getElementById('categoryFilter').value='全部';
    for(const key of ['priceMin','priceMax','metricMin','metricMax']){state[key]=null;document.getElementById(key).value='';}
    setTab('all');document.getElementById('listTitle').scrollIntoView({block:'start'});return true;
  }
  function openExistingCompany(code) {
    if(!/^\d{4}$/.test(code) || typeof state==='undefined' || typeof selectCompany!=='function' || !state.stocks.some(s=>s.symbol===code+'.TW')) return false;
    rememberReportPosition();
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
    root.addEventListener('click',e=>{
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
    backButton.hidden=true;
  });
  if (trigger && dialog && root) {
    trigger.addEventListener('click',()=>{ dialog.showModal(); loadReport(root); });
    document.getElementById('weeklyInvestmentClose')?.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();}});
  }
  const standalone=document.getElementById('weeklyStandalone');
  if(standalone) loadReport(standalone);
  // Public pure helpers for focused validation without requiring the main market application.
  if(typeof module!=='undefined' && module.exports) module.exports={escape,range,freshness,render,linkMentionedStocks};
})();
