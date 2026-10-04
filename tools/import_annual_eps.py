"""Import explicitly dated, official full-year EPS; never infer absent years."""
import gzip, json, re, sys, time
from pathlib import Path
from datetime import date
from html.parser import HTMLParser
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from update_snapshot import get, number

class Rows(HTMLParser):
    def __init__(self):super().__init__();self.rows=[];self.row=None;self.cell=None
    def handle_starttag(self, tag, attrs):
        if tag=='tr':self.row=[]
        if tag in ('td','th'):self.cell=[]
    def handle_data(self,data):
        if self.cell is not None:self.cell.append(data)
    def handle_endtag(self,tag):
        if tag in ('td','th') and self.row is not None and self.cell is not None:self.row.append(''.join(self.cell).strip());self.cell=None
        if tag=='tr' and self.row is not None:self.rows.append(self.row);self.row=None

def parse_eps(text):
    p=Rows();p.feed(text);headers=None;result={}
    for r in p.rows:
        if r and r[0]=='公司代號':headers=r
        elif headers and r and re.fullmatch(r'\d{4}',r[0]) and len(r)==len(headers):
            row=dict(zip(headers,r));key=next((k for k in headers if '基本每股盈餘' in k),None)
            if key:result[r[0]]={'name':r[1],'eps':number(row[key]),'general': '營業收入' in row}
    if len(result)<500:raise ValueError('年度 EPS 筆數異常')
    return result

def run():
    root=Path(__file__).resolve().parents[1];target=root/'research/imported-overview.json.gz';data=json.loads(gzip.decompress(target.read_bytes()))
    cache=root/'work/annual-eps';cache.mkdir(parents=True,exist_ok=True)
    for year in (2020,2021,2022,2023):
        url=f'https://mopsov.twse.com.tw/mops/web/ajax_t163sb04?encodeURIComponent=1&step=1&firstin=1&off=1&TYPEK=sii&year={year-1911}&season=04'
        file=cache/f'{year}.html'
        text=file.read_text() if file.exists() else get(url).decode('utf-8-sig')
        rows=parse_eps(text)
        file.write_text(text)
        count=0
        for code,r in rows.items():
            p=data['profiles'].get(code+'.TW')
            if not p or p['name']!=r['name'] or r['eps'] is None:continue
            periods=p['financial']['cumulative'];key=f'{year}-Q4'
            if key not in periods:
                basis='合併營業收入' if r['general'] else p['financial'].get('basis')
                periods[key]={'eps':r['eps'],'basis':basis,'source_url':url,'source_reviewed_at':date.today().isoformat(),'eps_only':True}
                count+=1
        print(year,count,flush=True);time.sleep(.5)
    target.write_bytes(gzip.compress(json.dumps(data,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode(),mtime=0))

if __name__=='__main__':run()
