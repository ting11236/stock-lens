"""Cache official daily closes and rank the same-date listed-company universe."""
import json
import re
import time
from datetime import date, timedelta, datetime, timezone
from pathlib import Path
from update_snapshot import get, number, read_json, write_changed, dump

ROOT=Path(__file__).resolve().parent
SOURCE='https://www.twse.com.tw/exchangeReport/MI_INDEX'

def parse_day(payload, requested):
    if payload.get('stat') != 'OK' or payload.get('date') != requested.replace('-',''):
        return None
    table=next((t for t in payload.get('tables',[]) if '證券代號' in t.get('fields',[]) and '收盤價' in t.get('fields',[])),None)
    if not table:raise ValueError('找不到官方收盤欄位')
    rows={}
    for values in table['data']:
        r=dict(zip(table['fields'],values));code=r['證券代號']
        if not re.fullmatch(r'\d{4}',code):continue
        close=number(r['收盤價']); volume=number(r.get('成交股數'))
        if close is None or close<=0 or not volume or volume<=0:continue
        sign=re.sub('<[^>]+>','',r.get('漲跌(+/-)','')).strip()
        change=number(r.get('漲跌價差'))
        reference=close-change*(1 if sign=='+' else -1 if sign=='-' else 0) if change is not None and sign in ('+','-','') else None
        rows[code]={'close':close,'volume':volume,'reference':reference,'special':sign not in ('+','-','')}
    if len(rows)<500:raise ValueError('行情筆數異常，保留前次資料')
    return rows

def build_movers(history, stocks):
    days=sorted(history); periods={}; latest=days[-1] if days else None
    universe={s['symbol'][:-3]:s for s in stocks if not re.search(r'[-－]DR\b',s.get('name',''),re.I) and s.get('industry')!='產業代碼 91'}
    for n in (1,5,20):
        if not latest or (n>1 and len(days)<n+1):continue
        start=days[-n-1] if n>1 else None; values=[]
        for code,last in history[latest].items():
            stock=universe.get(code)
            if not stock or stock.get('price_date')!=latest:continue
            base=last.get('reference') if n==1 else history[start].get(code,{}).get('close')
            # Missing a session or a special reference price makes comparisons unreliable.
            if n>1 and any(code not in history[d] or history[d][code].get('special') for d in days[-n-1:]):continue
            if base is None or base<=0:continue
            values.append({'symbol':stock['symbol'],'name':stock['name'],'industry':stock.get('industry','未分類'),'change':(last['close']/base-1)*100,'price':last['close']})
        periods[str(n)]={'start':start,'end':latest,'count':len(values),'gainers':sorted((v for v in values if v['change']>5+1e-9),key=lambda v:(-v['change'],v['symbol'])),'losers':sorted((v for v in values if v['change']<-5-1e-9),key=lambda v:(v['change'],v['symbol']))}
    return {'schema_version':1,'source':SOURCE,'periods':periods,'latest_date':latest,'basis':'收盤價漲跌幅，未還原除權息；不含股息報酬。單日用官方漲跌價差的比較基準；5／20 日用起訖收盤價。'}

def run(root=ROOT):
    data=root/'site/data';stocks=read_json(data/'stocks.json',{});latest=stocks.get('latest_price_date')
    if not latest:return
    history=read_json(data/'price-history.json',{});errors=[];checked=[]
    # Backfill enough real sessions for a 20-session change; thereafter only new dates.
    for offset in range(50):
        day=(date.fromisoformat(latest)-timedelta(days=offset)).isoformat()
        if date.fromisoformat(day).weekday()>4:continue
        if day in history:checked.append(day)
        else:
            try:
                payload=json.loads(get(SOURCE+'?response=json&date='+day.replace('-','')+'&type=ALLBUT0999'))
                rows=parse_day(payload,day)
                if rows:history[day]=rows;checked.append(day)
            except Exception as e:errors.append(day+': '+type(e).__name__)
            time.sleep(.5)
        if len(checked)>=21:break
    history={k:history[k] for k in sorted(history)[-65:] if k<=latest}
    if latest not in history:
        previous=read_json(data/'market-movers.json',{})
        if previous:
            previous['errors']=errors or ['最新交易日未取得有效資料'];previous['stale']=True
            write_changed(data/'market-movers.json',dump(previous))
        return
    if history:
        write_changed(data/'price-history.json',dump(history))
        output=build_movers(history,stocks.get('stocks',[]));output['errors']=errors;output['updated_at']=datetime.now(timezone.utc).isoformat(timespec='seconds')
        write_changed(data/'market-movers.json',dump(output))
        print('漲跌排行', {k:v['count'] for k,v in output['periods'].items()},'來源失敗',len(errors))

if __name__=='__main__':run()
