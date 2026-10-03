"""One-time workbook ingestion. Requires openpyxl only for importing, not publishing."""
import gzip
import argparse,hashlib,json,math,re
from pathlib import Path
from collections import defaultdict

def number(v):return isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v)
def links(v):return list(dict.fromkeys(re.findall(r'https://[^\s]+',str(v or ''))))
def fmt(v):return f'{v:,.2f}' if number(v) else '未取得'
def extract(workbook):
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
  # Recompute quarters from raw cumulative inputs; cached formulas are checked, not trusted blindly.
  c=cumulative[code];a=c['2025Q2累計'][4];q=c['2025Q3累計'][4];y=c['2025Q4累計'][4];q1=c['2026Q1累計'][4];h=c['2026Q2累計'][4]
  calculated=[q-a if number(q) and number(a) else None,y-q if number(y) and number(q) else None,q1,h-q1 if number(h) and number(q1) else None]
  for actual,expected in zip(f[5:9],calculated):
   assert (actual is None and expected is None) or (number(actual) and number(expected) and math.isclose(actual,expected,abs_tol=1e-7)),(code,actual,expected)
  ttm=sum(calculated) if all(number(v) for v in calculated) else None
  assert (ttm is None and f[9] is None) or (number(f[9]) and math.isclose(ttm,f[9],abs_tol=1e-7)),code
  text=f'2024／2025 全年{f[2]} {fmt(f[3])}／{fmt(f[4])} 億元；2025Q3–2026Q2 四季合計 {fmt(ttm)} 億元。2026H1 {f[2]} {fmt(h)} 億元、營業利益 {fmt(f[10])} 億元、業外淨額 {fmt(f[11])} 億元、歸母淨利 {fmt(f[13])} 億元。'
  if '金控' in f[2] or '銀行' in f[2]:text+='金融業依檔案列示淨收益等口徑，不能與一般業營業收入直接比較。'
  if f[13] is None:text+='歸母淨利缺值不以本期淨利或零代替。'
  if f[2]=='未取得':text='本檔未取得可用年度及季度財報；未將缺值填零，原上市地幣別與申報頻率仍待核對。'
  text+='獲利機制：'+str(r[4] or '未取得')+'。'
  financial=dict(zip(['basis','fy2024','fy2025','q32025','q42025','q12026','q22026','ttm','h1_operating_profit','h1_nonoperating','h1_pretax','h1_parent_profit','h1_operating_margin','h1_nonoperating_share','fy2025_parent_profit','q22026_parent_profit','screening','source_url'],f[2:]))
  financial['h1_revenue']=h
  profiles[code+'.TW']=dict(name=b[1],source_reviewed_at=r[8],imported_at='2026-10-04',source_sheet=sheet,source_row=row,business=str(r[2] or '未取得'),direction=str(r[3] or '未取得'),profit_mechanism=str(r[4] or '未取得'),status=str(r[5]),screening=str(r[6]),urls=links(r[7])+links(f[19]),financial=financial,summary=text,events=events[code],outlooks=outlook[code])
 return dict(schema_version=1,source=dict(filename=Path(workbook).name,sha256=hashlib.sha256(Path(workbook).read_bytes()).hexdigest(),as_of='2026-10-03',imported_at='2026-10-04',provenance='使用者提供研究檔案；本次匯入未重新逐一查閱原始網站',limitations=['業務及獲利機制為定性整理，非分部淨利比例。','預估、指引、長期目標與實際數字分開；未確認所有後續修正。','歷史財務未逐家重編 IFRS17 或合併範圍；四季合計不保證跨期完全可比。']),profiles=profiles)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('workbook');p.add_argument('--output',default='research/imported-overview.json.gz');a=p.parse_args();data=extract(a.workbook);Path(a.output).write_bytes(gzip.compress(json.dumps(data,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode(),mtime=0));print('Imported',len(data['profiles']))
