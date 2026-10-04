"""Daily official meeting calendar and an explicit research-update queue."""
import json,re
from datetime import date,datetime,timedelta,timezone
from html.parser import HTMLParser
from pathlib import Path
from update_snapshot import get,read_json,write_changed,dump
ROOT=Path(__file__).resolve().parent
MEETINGS='https://openapi.twse.com.tw/v1/opendata/t187ap38_L'
NEWS='https://openapi.twse.com.tw/v1/opendata/t187ap04_L'
CONFERENCES='https://mopsov.twse.com.tw/mops/web/ajax_t100sb02_1'
TZ=timezone(timedelta(hours=8))

def normalized_date(value):
    text=str(value or '').strip()
    m=re.fullmatch(r'(\d{3,4})[/.-](\d{1,2})[/.-](\d{1,2})',text)
    if m:y,mo,d=map(int,m.groups())
    elif re.fullmatch(r'\d{7,8}',text):y,mo,d=int(text[:-4]),int(text[-4:-2]),int(text[-2:])
    else:return None
    if y<1911:y+=1911
    try:return date(y,mo,d).isoformat()
    except ValueError:return None

class Rows(HTMLParser):
    def __init__(self):super().__init__();self.rows=[];self.row=None;self.cell=None
    def handle_starttag(self,tag,attrs):
        if tag=='tr':self.row=[]
        elif tag in ('td','th') and self.row is not None:self.cell=[]
        elif tag=='br' and self.cell is not None:self.cell.append(' ')
    def handle_data(self,text):
        if self.cell is not None:self.cell.append(text)
    def handle_endtag(self,tag):
        if tag in ('td','th') and self.cell is not None:
            self.row.append(' '.join(''.join(self.cell).split()));self.cell=None
        elif tag=='tr' and self.row is not None:self.rows.append(self.row);self.row=None

def conference_events(text,source):
    if isinstance(text,bytes):text=text.decode('utf-8')
    parser=Rows();parser.feed(text)
    if not any('法人說明會' in ' '.join(r) for r in parser.rows) and '查無' not in text and '沒有符合' not in text:raise ValueError('法說來源格式改變')
    events=[]
    for r in parser.rows:
        if len(r)<6 or not re.fullmatch(r'\d{4}',r[0]):continue
        dates=[normalized_date(d) for d in re.findall(r'\d{3,4}/\d{1,2}/\d{1,2}',r[2])];dates=[d for d in dates if d]
        if not dates:continue
        ranged='至' in r[2] and len(dates)>1
        explicit=[normalized_date(d) for d in re.findall(r'\d{3,4}/\d{1,2}/\d{1,2}',r[5])]
        exact=sorted({d for d in explicit if d and dates[0]<=d<=dates[-1]})
        # A range without individual dates remains a range, never fabricated dates.
        if ranged and len(exact)>1:dates=exact;ranged=False
        elif ranged:dates=[dates[0]]
        for d in dates:
            events.append({'symbol':r[0]+'.TW','name':r[1],'kind':'法說會','date':d,'end_date':normalized_date(re.findall(r'\d{3,4}/\d{1,2}/\d{1,2}',r[2])[-1]) if ranged else d,'time':r[3],'location':r[4],'description':r[5],'source':source,'cancelled':'取消' in ' '.join(r[2:6])})
    return events

def shareholder_events(rows):
    events=[]
    for r in rows:
        code=r.get('公司代號','');d=normalized_date(r.get('股東常(臨時)會日期-日期'))
        if not re.fullmatch(r'\d{4}',code) or not d:continue
        events.append({'symbol':code+'.TW','name':r.get('公司名稱',code),'kind':'股東'+r.get('股東常(臨時)會日期-常或臨時','會'),'date':d,'end_date':d,'time':r.get('召開時間',''),'location':'','description':'已公告股東會日期','source':MEETINGS,'cancelled':False})
    return events

def make_output(events,stocks,profiles,today,previous=None):
    prev=previous or {};universe={s['symbol']:s for s in stocks};cutoff=(today-timedelta(days=180)).isoformat();day=today.isoformat()
    dedup={}
    for e in events:
        if e['symbol'] in universe and e.get('end_date',e['date'])>=cutoff:dedup[(e['symbol'],e['kind'],e['date'],e.get('time',''))]=e
    events=sorted(dedup.values(),key=lambda e:(e['date'],e['symbol'],e['kind']))
    queue=[];companies={};seen={}
    prior_seen=prev.get('financial_seen',{})
    for symbol,stock in universe.items():
        p=profiles.get(symbol,{})
        reviewed=max(p.get('reviewed_at') or '',p.get('overview',{}).get('source_reviewed_at') or '')
        own=[e for e in events if e['symbol']==symbol and not e.get('cancelled')]
        upcoming=[e for e in own if e.get('end_date',e['date'])>=day and e['kind']!='重大訊息']
        companies[symbol]={'next_conference':next((e for e in upcoming if e['kind']=='法說會'),None),'next_shareholders':next((e for e in upcoming if e['kind'].startswith('股東')),None),'summary_reviewed_at':reviewed or None}
        for e in own:
            end=e.get('end_date',e['date'])
            # Same-day review may have preceded the meeting; do not silently clear it.
            if end<day and reviewed<=end:
                queue.append({**e,'due_date':(date.fromisoformat(end)+timedelta(days=1)).isoformat(),'reason':'新重大訊息待整理' if e['kind']=='重大訊息' else e['kind']+'結束後，補讀簡報／議事資料並更新摘要','summary_reviewed_at':reviewed or None})
        for key,label in [('eps','財報'),('revenue_growth','月營收')]:
            period=stock.get('field_meta',{}).get(key,{}).get('date');old=prior_seen.get(symbol,{}).get(key,{})
            if not period:continue
            changed=old.get('period') and old['period']!=period
            detected=day if changed else old.get('detected_at') if old.get('period')==period else None
            seen.setdefault(symbol,{})[key]={'period':period,'detected_at':detected}
            if detected and reviewed<=detected:
                queue.append({'symbol':symbol,'name':stock['name'],'kind':label,'date':detected,'due_date':detected,'reason':label+'數字更新至 '+period+'，摘要待同步','period':period,'summary_reviewed_at':reviewed or None,'source':stock.get('field_meta',{}).get(key,{}).get('source_url') or MEETINGS})
    return {'schema_version':1,'as_of':day,'events':events,'companies':companies,'update_queue':sorted(queue,key=lambda e:(e['due_date'],e['symbol'])),'financial_seen':seen,'sources':[]}

def run(root=ROOT,today=None):
    today=today or datetime.now(TZ).date();folder=root/'site/data';prev=read_json(folder/'company-calendar.json',read_json(root/'research/company-calendar-seed.json',{}));events=list(prev.get('events',[]));errors=[];sources=[]
    for offset in (-1,0,1,2):
        month=today.year*12+today.month-1+offset;y,m=divmod(month,12);m+=1
        url=CONFERENCES+f'?encodeURIComponent=1&step=1&firstin=1&off=1&TYPEK=sii&year={y-1911}&month={m:02d}'
        try:
            fetched=conference_events(get(url),url)
            # Replace that month's rows, including corrected dates or cancellations.
            month_key=f'{y}-{m:02d}'
            events=[e for e in events if not(e['kind']=='法說會' and e['date'].startswith(month_key))]+fetched
            sources.append({'name':f'{y}-{m:02d} 法說會','url':url,'status':'ok','checked_at':today.isoformat()})
        except Exception as e:errors.append(f'{y}-{m:02d} 法說會：{type(e).__name__}');sources.append({'name':f'{y}-{m:02d} 法說會','url':url,'status':'failed'})
    for kind,url,parse in [('股東會',MEETINGS,shareholder_events),('重大訊息',NEWS,None)]:
        try:
            rows=json.loads(get(url))
            if not isinstance(rows,list):raise ValueError('來源格式改變')
            if parse:
                if len(rows)<500:raise ValueError('股東會筆數異常')
                events=[e for e in events if not e['kind'].startswith('股東')]+parse(rows)
            else:
                for r in rows:
                    code=r.get('公司代號','');d=normalized_date(r.get('發言日期'))
                    if re.fullmatch(r'\d{4}',code) and d:events.append({'symbol':code+'.TW','name':r.get('公司名稱',code),'kind':'重大訊息','date':d,'end_date':d,'time':r.get('發言時間',''),'description':r.get('主旨',''),'source':url,'cancelled':False})
            sources.append({'name':kind,'url':url,'status':'ok','checked_at':today.isoformat()})
        except Exception as e:errors.append(kind+'：'+type(e).__name__);sources.append({'name':kind,'url':url,'status':'failed'})
    stockdata=read_json(folder/'stocks.json',{});profiles=read_json(folder/'company-research.json',{}).get('profiles',{})
    output=make_output(events,stockdata.get('stocks',[]),profiles,today,prev);output.update(sources=sources,errors=errors,updated_at=datetime.now(TZ).isoformat(timespec='seconds'))
    write_changed(folder/'company-calendar.json',dump(output));print('公司日程',len(output['events']),'更新待辦',len(output['update_queue']),'來源失敗',len(errors))
if __name__=='__main__':run()
