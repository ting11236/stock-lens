"""Generate a small, dated market briefing before publication; no client data fetch."""
import argparse
import html
import json
import math
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from update_snapshot import get, read_json, write_changed, dump

ROOT = Path(__file__).resolve().parent
SECTORS = ['水泥','食品','塑膠','紡織纖維','電機機械','電器電纜','化學','生技醫療','玻璃陶瓷','造紙','鋼鐵','橡膠','汽車','半導體','電腦及週邊設備','光電','通信網路','電子零組件','電子通路','資訊服務','其他電子','建材營造','航運','觀光餐旅','金融保險','貿易百貨','油電燃氣','綠能環保','數位雲端','運動休閒','居家生活','其他']

def num(value):
    try:
        result = float(str(value).replace(',', ''))
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None

def industry_name(name):
    for ending in ('工業', '業'):
        if name.endswith(ending):
            return name[:-len(ending)]
    return name

def parse_market(payload, day, stocks):
    if payload.get('stat') != 'OK' or payload.get('date') != day.replace('-', ''):
        raise ValueError('行情日期不一致')
    tables = payload.get('tables', [])
    table = next(t for t in tables if '證券代號' in t.get('fields', []) and '成交金額' in t['fields'])
    universe = {s['symbol'][:-3]: s for s in stocks if industry_name(s.get('industry','')) in SECTORS}
    amounts = {}; breadth = {'up':0, 'down':0, 'flat':0}; matched = 0
    for values in table['data']:
        row = dict(zip(table['fields'], values)); stock = universe.get(row['證券代號'])
        if not stock: continue
        amount = num(row.get('成交金額')); close = num(row.get('收盤價'))
        if amount is None or amount < 0: raise ValueError('成交金額缺漏')
        if not close or close <= 0: continue
        matched += 1
        industry = industry_name(stock['industry'])
        amounts[industry] = amounts.get(industry, 0) + amount
        sign = re.sub('<[^>]+>', '', row.get('漲跌(+/-)', '')).strip()
        if sign in ('+', '-', ''):
            breadth['up' if sign == '+' else 'down' if sign == '-' else 'flat'] += 1
    if matched < 500 or sum(amounts.values()) <= 0: raise ValueError('行情涵蓋不足')
    # Only official individual-sector price indices; exclude aggregate and leveraged indices.
    indices = {}; index = None
    for table in tables:
        if '指數' not in table.get('fields', []): continue
        for values in table.get('data', []):
            row = dict(zip(table['fields'], values)); name = row['指數']
            change = num(row.get('漲跌百分比(%)'))
            if change is None: continue
            if name == '發行量加權股價指數':
                index = {'close':num(row['收盤指數']), 'change':change}
            if name.endswith('類指數') and name[:-3] in SECTORS:
                indices[name[:-3]] = change
    if not index or not index['close'] or len(indices) < 20: raise ValueError('產業指數不完整')
    total = sum(amounts.values())
    return {'date':day, 'index':index, 'breadth':breadth, 'stock_count':matched,
            'sectors':[{'name':k,'change':v} for k,v in indices.items()],
            'turnover':[{'name':k,'amount':v,'share':v/total*100} for k,v in sorted(amounts.items(),key=lambda x:(-x[1],x[0]))],
            'total_turnover':total,
            'source':'https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&date='+day.replace('-','')+'&type=ALLBUT0999'}

def signed(n): return f'{n:+.2f}%'

def margin_notes(history, day):
    row = next((r for r in history.get('history', []) if r['date'] == day), None)
    if not row: return []
    result = []
    for key, name in [('twse','上市'),('tpex','上櫃'),('combined','上市＋上櫃')]:
        value = row.get(key)
        if not value or not isinstance(value.get('ratio'),(int,float)): continue
        ratio = value['ratio']; lower = value.get('lower_bound',False)
        display = math.floor(ratio*10)/10 if lower else round(ratio,1)
        result.append({'name':name, 'value':('≥ ' if lower else '')+f'{display:.1f}%',
                       'below':ratio < 150, 'lower_bound':lower})
    return result

def context_events(data, day):
    """Only dated, sourced, explicitly reviewed editor entries can add news context."""
    result=[]
    for event in data.get('events',[]):
        try:
            start=date.fromisoformat(event['date']); end=date.fromisoformat(event.get('valid_until',event['date']))
            if event.get('status') != 'reviewed' or not event.get('source','').startswith('https://'): continue
            if not start <= date.fromisoformat(day) <= end or (end-start).days > 7: continue
            if not event.get('summary') or not event.get('title'): continue
            result.append(event)
        except (ValueError,KeyError,TypeError): continue
    return result[:3]

def render(data, margins, events, as_of, failed=False):
    e=html.escape; day=data['date']; sectors=sorted(data['sectors'],key=lambda s:(-s['change'],s['name']))
    up=[s for s in sectors if s['change']>0][:3]
    down=sorted([s for s in sectors if s['change']<0],key=lambda s:s['change'])[:3]
    def sector_text(values):
        return '、'.join(e(s['name'])+' <span class="market-brief-emphasis">'+signed(s['change'])+'</span>' for s in values)
    strength = sector_text(up) if up else '各產業指數均未上漲；相對抗跌的是 '+sector_text(sectors[:3])
    weakness = sector_text(down) if down else '各產業指數均未下跌；漲幅較小的是 '+sector_text(list(reversed(sectors))[:3])
    concentration='、'.join(e(s['name'])+f' <span class="market-brief-emphasis">{s["share"]:.1f}%</span>' for s in data['turnover'][:3])
    idx=data['index']; breadth=data['breadth']
    mood='下跌家數較多' if breadth['down']>breadth['up'] else '上漲家數較多' if breadth['up']>breadth['down'] else '漲跌家數相同'
    status='最近交易日收盤' if day!=as_of else '當日收盤'
    result=f'<div class="market-brief-heading"><h2 id="todayMarketSummaryTitle">今日市場摘要</h2><span>{e(day)} · {status} · 上市股票</span></div>'
    if failed: result+='<p class="market-brief-status">本次行情未更新成功，以下保留上次有效交易日的摘要。</p>'
    result+=f'<p class="market-brief-lead">加權指數收在 <b>{idx["close"]:,.2f}</b> 點，單日 <span class="market-brief-emphasis">{signed(idx["change"])}</span>；{mood}（上漲 {breadth["up"]} 家、下跌 {breadth["down"]} 家）。</p>'
    result+='<ul class="market-brief-list"><li><strong>哪些產業較強？</strong>'+strength+'。</li><li><strong>哪些產業較弱？</strong>'+weakness+'。</li><li><strong>交易集中在哪裡？</strong>'+concentration+f'，為上市股票成交金額占比前三名；合計成交金額 {data["total_turnover"]/1e8:,.1f} 億元。</li>'
    if margins:
        values='、'.join(e(m['name'])+' <span'+(' class="market-brief-emphasis"' if m['below'] else '')+'>'+e(m['value'])+'</span>' for m in margins)
        below=[m for m in margins if m['below']]
        note='；'+('、'.join(m['name'] for m in below))+'的估算值低於本站作者設定的 <b>150%</b> 觀察線。' if below else '；估算值均未低於本站作者設定的 150% 觀察線。'
        if any(m['lower_bound'] for m in margins): note+='「≥」是目前可算出的下限，完整比率可能更高。'
        result+='<li><strong>融資觀察：</strong>'+values+note+'</li>'
    result+='</ul>'
    if abs(idx['change'])>=3:
        result+=f'<p class="market-brief-event"><strong>市場明顯波動：</strong>加權指數單日{("下跌" if idx["change"]<0 else "上漲")} {abs(idx["change"]):.2f}%，超過本站用來提醒大幅波動的 3% 觀察線。</p>'
    for event in events:
        result+='<p class="market-brief-event"><strong>'+e(event['title'])+'：</strong>'+e(event['summary'])+' <small>'+e(event['date'])+' · <a href="'+e(event['source'],quote=True)+'" target="_blank" rel="noopener noreferrer">查看來源 ↗</a></small></p>'
    result+='<details class="market-brief-details"><summary>查看完整產業數字與資料來源</summary><p>產業漲跌採證交所各產業價格指數；交易熱度採本站上市股票的官方成交金額加總，不含 ETF、權證與存託憑證。成交金額占比顯示交易集中程度，不是資金淨流入。</p><div class="market-brief-table-wrap"><table><thead><tr><th>產業</th><th>單日漲跌</th></tr></thead><tbody>'
    result+=''.join('<tr><th scope="row">'+e(s['name'])+'</th><td>'+signed(s['change'])+'</td></tr>' for s in sectors)
    result+='</tbody></table></div><p><a href="'+e(data['source'],quote=True)+'" target="_blank" rel="noopener noreferrer">證交所當日行情 ↗</a> · <a href="https://www.tpex.org.tw/zh-tw/mainboard/trading/margin-trading/transactions.html" target="_blank" rel="noopener noreferrer">上櫃融資來源 ↗</a></p><p>隨每日網站發布更新；日期以此區塊為準。重大事件僅加入有日期、來源且已查證的內容，不推測漲跌原因。</p></details>'
    return result

def run(root=ROOT, input_path=None):
    folder=root/'site/data'; stocks=read_json(folder/'stocks.json',{})
    previous=read_json(folder/'market-summary.json',{}); data=previous.get('market'); failed=False
    now=datetime.now(timezone(timedelta(hours=8))); as_of=now.date().isoformat()
    # Before the evening publication window use the previous completed session.
    target=now.date()-timedelta(days=1 if now.hour<18 else 0)
    if input_path:
        raw=json.loads(Path(input_path).read_bytes()); compact=raw.get('date','')
        if not re.fullmatch(r'\d{8}',compact): raise ValueError('缺行情日期')
        day=compact[:4]+'-'+compact[4:6]+'-'+compact[6:]
        data=parse_market(raw,day,stocks.get('stocks',[]))
    elif not data or data.get('date','')<target.isoformat():
        updated=None
        for offset in range(8):
            day=(target-timedelta(days=offset)).isoformat()
            if date.fromisoformat(day).weekday()>4: continue
            try:
                raw=json.loads(get('https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&date='+day.replace('-','')+'&type=ALLBUT0999'))
                if raw.get('stat')!='OK' or raw.get('date')!=day.replace('-',''): continue
                if not any(t.get('data') for t in raw.get('tables',[])): continue
                updated=parse_market(raw,day,stocks.get('stocks',[]));break
            except Exception: continue
        if updated and (not data or updated['date']>=data['date']): data=updated
        else: failed=True
    if not data or data['date']>as_of: raise ValueError('尚無有效市場摘要')
    day=data['date']
    margins=margin_notes(read_json(folder/'margin-history.json',{}),day)
    events=context_events(read_json(root/'research/market-summary-events.json',{}),day)
    result={'schema_version':1,'as_of':as_of,'market':data,'margins':margins,'events':events,'stale':failed}
    write_changed(folder/'market-summary.json',dump(result))
    write_changed(root/'site/market-summary.html',render(data,margins,events,as_of,failed))
    print('市場摘要',day,len(data['sectors']),'產業')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--input');args=parser.parse_args();run(input_path=args.input)
