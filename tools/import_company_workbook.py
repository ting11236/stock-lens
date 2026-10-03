"""One-time workbook ingestion. Requires openpyxl only for importing, not publishing."""
import gzip
import argparse,hashlib,json,math,re
from pathlib import Path
from collections import defaultdict
import sys
from datetime import date
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from financial_ttm import rolling_financials

def number(v):return isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v)
def links(v):return list(dict.fromkeys(re.findall(r'https://[^\s]+',str(v or ''))))
def fmt(v):return f'{v:,.2f}' if number(v) else '未取得'
def extract(workbook, previous=None):
 import openpyxl
 w=openpyxl.load_workbook(workbook,read_only=True,data_only=True)
 tables={s.title:[list(r) for r in s.values] for s in w}
 def rows(sheet):return [r for r in tables[sheet][5:] if r[0]]
 biz={}
 for sheet in ['臺灣50業務','其他上市業務']:
  for i,r in enumerate(rows(sheet),6):
   if sheet=='臺灣50業務':r=r[:2]+r[3:]
   code=str(r[0]);assert code not in biz
   biz[code]=(r,sheet,i)
 fin={str(r[0]):r for r in rows('營收與獲利')};events=defaultdict(list);outlook=defaultdict(list)
 for r in rows('異常與事件'):events[str(r[0])].append(dict(period=r[2],type=r[3],status=r[4],text=r[5],urls=links(r[6]),source_reviewed_at=r[7]))
 for r in rows('財測與展望'):outlook[str(r[0])].append(dict(type=r[2],period=r[3],scope=r[4],unit=r[5],low=r[6],high=r[7],published_at=r[8],limitations=r[9],urls=links(r[10]),source_reviewed_at=r[11]))
 cumulative=defaultdict(dict)
 for r in rows('累計財務來源'):
  code=str(r[0]);assert r[2] not in cumulative[code];cumulative[code][r[2]]=r
 profiles={}
 for b in rows('全體上市底表'):
  code=str(b[0]);r,sheet,row=biz[code];f=fin[code];assert r[1]==b[1]==f[1]
  c=cumulative[code]
  raw={re.sub(r'(\d{4})Q([1-4])累計',r'\1-Q\2',p):dict(basis=x[3],revenue=x[4],net_income=x[8],eps=x[10],source_url=x[11],source_reviewed_at=x[12]) for p,x in c.items()}
  old=(previous or {}).get('profiles',{}).get(code+'.TW',{})
  if old.get('name')==b[1]:
   raw={**old.get('financial',{}).get('cumulative',{}),**raw}
  rolling=rolling_financials(raw)
  h=c.get('2026Q2累計',[None]*5)[4]
  ttm=rolling['ttms'] if rolling else None
  text=(f"最近 12 個月（{rolling['start_period']} 至 {rolling['period']}）{rolling['basis']} {fmt(ttm)} 億元；每股盈餘 {fmt(rolling['ttm_eps'])} 元；歸母淨利 {fmt(rolling['ttm_parent_profit'])} 億元。" if rolling else '未取得可用累計財務資料。')
  text+='營收未扣成本與費用，不等於獲利。獲利機制：'+str(r[4] or '未取得')+'。'
  financial=dict(zip(['basis','fy2024','fy2025','q32025','q42025','q12026','q22026','ttm','h1_operating_profit','h1_nonoperating','h1_pretax','h1_parent_profit','h1_operating_margin','h1_nonoperating_share','fy2025_parent_profit','q22026_parent_profit','screening','source_url'],f[2:]))
  financial['h1_revenue']=h
  financial['cumulative']=raw
  financial['rolling']=rolling
  profiles[code+'.TW']=dict(name=b[1],source_reviewed_at=r[8],imported_at=date.today().isoformat(),source_filename=Path(workbook).name,source_sheet=sheet,source_row=row,business=str(r[2] or '未取得'),direction=str(r[3] or '未取得'),profit_mechanism=str(r[4] or '未取得'),status=str(r[5]),screening=str(r[6]),urls=links(r[7])+links(f[19]),financial=financial,summary=text,events=events[code],outlooks=outlook[code])
 return dict(schema_version=1,source=dict(filename=Path(workbook).name,sha256=hashlib.sha256(Path(workbook).read_bytes()).hexdigest(),as_of=max(str(x[12]) for rows_ in cumulative.values() for x in rows_.values() if x[12]),imported_at=date.today().isoformat(),provenance='使用者提供研究檔案；本次匯入未重新逐一查閱原始網站',limitations=['業務及獲利機制為定性整理，非分部淨利比例。','預估、指引、長期目標與實際數字分開；未確認所有後續修正。','歷史財務未逐家重編 IFRS17 或合併範圍；四季合計不保證跨期完全可比。']),profiles=profiles)
if __name__=='__main__':
 p=argparse.ArgumentParser()
 p.add_argument('workbook')
 p.add_argument('--output',default='research/imported-overview.json.gz')
 a=p.parse_args()
 target=Path(a.output)
 previous=json.loads(gzip.decompress(target.read_bytes())) if target.exists() else None
 data=extract(a.workbook,previous)
 target.parent.mkdir(parents=True,exist_ok=True)
 target.write_bytes(gzip.compress(json.dumps(data,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode(),mtime=0))
 print('Imported',len(data['profiles']))
