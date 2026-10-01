"""TWSE listed-company snapshots. Standard library only; never infer trading dates."""
import copy
import csv
import hashlib
import io
import json
import math
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
DATA = ROOT / 'site/data'
BASE = 'https://openapi.twse.com.tw/v1/'
SOURCES = {
    'companies': 'opendata/t187ap03_L',
    'prices': 'exchangeReport/STOCK_DAY_AVG_ALL',
    'ratios': 'exchangeReport/BWIBBU_ALL',
    'revenue': 'opendata/t187ap05_L',
    'eps': 'opendata/t187ap14_L',
    'margins': 'opendata/t187ap17_L',
    'income': 'opendata/t187ap06_L_ci',
    'balance': 'opendata/t187ap07_L_ci',
}
NUMERIC = ('price','pe','pb','ps','peg','dividend_yield','eps','trailing_eps',
           'gross_margin','revenue_growth','earnings_growth','roe')
INDUSTRIES = dict(zip('01 02 03 04 05 06 07 08 09 10 11 12 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38'.split(),
    '水泥工業 食品工業 塑膠工業 紡織纖維 電機機械 電器電纜 化學生技醫療 玻璃陶瓷 造紙工業 鋼鐵工業 橡膠工業 汽車工業 建材營造 航運業 觀光餐旅 金融保險 貿易百貨 綜合 其他 化學工業 生技醫療 油電燃氣 半導體業 電腦及週邊設備 光電業 通信網路業 電子零組件業 電子通路業 資訊服務業 其他電子業 文化創意業 農業科技業 電子商務 綠能環保 數位雲端 運動休閒 居家生活'.split()))


def number(v):
    try:
        x = float(str(v).replace(',', '').strip())
        return x if math.isfinite(x) else None
    except (ValueError, TypeError):
        return None


def day(raw):
    s = re.sub(r'[-/]', '', str(raw or '').strip())
    try:
        if len(s) == 7 and s.isdigit():
            return datetime(int(s[:3])+1911, int(s[3:5]), int(s[5:])).date().isoformat()
        if len(s) == 8 and s.isdigit():
            return datetime.strptime(s, '%Y%m%d').date().isoformat()
    except ValueError:
        pass
    return None


def quarter(r):
    y, q = number(r.get('年度')), number(r.get('季別'))
    if y is None or q not in (1,2,3,4):
        return None
    y = int(y) + (1911 if y < 1911 else 0)
    return f'{y}-Q{int(q)}'


def month(raw):
    s = str(raw or '').strip()
    if len(s) == 5 and s.isdigit() and 1 <= int(s[-2:]) <= 12:
        return f'{int(s[:3])+1911}-{s[-2:]}'
    return None


def get(url):
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={'User-Agent':'StockLens/2.0 (+https://github.com/ting11236/stock-lens)'}), timeout=40) as response:
                data = response.read(25_000_001)
                if len(data) > 25_000_000:
                    raise ValueError('來源超過大小上限')
                return data
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def read_json(path, default):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return default


def write_changed(path, text):
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_text(encoding='utf-8') == text:
        return False
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(text, encoding='utf-8')
    tmp.replace(path)
    return True


def dump(obj):
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, indent=2, allow_nan=False) + '\n'


def fingerprint(obj):
    return hashlib.sha256(dump(obj).encode()).hexdigest()


def validate(name, rows):
    if not isinstance(rows, list) or len(rows) < (500 if name in ('companies','prices','ratios') else 100):
        raise ValueError('來源格式或筆數異常，拒絕覆蓋有效資料')
    key = 'Code' if name in ('prices','ratios') else '公司代號'
    if any(not isinstance(r, dict) or not r.get(key) for r in rows):
        raise ValueError('來源缺少股票代號')
    if len({r[key] for r in rows}) != len(rows):
        raise ValueError('來源有重複代號')
    required = {'companies':['公司名稱','產業別'], 'prices':['ClosingPrice'],
                'ratios':['PEratio','PBratio','DividendYield'], 'eps':['基本每股盈餘(元)'],
                'margins':['毛利率(%)(營業毛利)/(營業收入)'],
                'revenue':['資料年月','營業收入-去年同月增減(%)'],
                'income':['基本每股盈餘（元）','營業收入','淨利（淨損）歸屬於母公司業主'],
                'balance':['歸屬於母公司業主之權益合計']}
    if any(any(k not in r for k in required[name]) for r in rows):
        raise ValueError('來源欄位結構變更')
    if name in ('prices','ratios'):
        metric = 'ClosingPrice' if name == 'prices' else 'PBratio'
        if sum(number(r.get(metric)) is not None for r in rows) < len(rows)*.5:
            raise ValueError('有效數值比例異常')
    date_key = 'Date' if key == 'Code' else '出表日期'
    if any(not day(r.get(date_key)) for r in rows):
        raise ValueError('來源缺少有效日期')
    if name in ('eps','margins','income','balance') and any(not quarter(r) for r in rows):
        raise ValueError('財報期間無效')
    return rows


def fetch_source(name):
    try:
        rows = validate(name, json.loads(get(BASE + SOURCES[name]).decode('utf-8-sig')))
        return name, rows, None
    except Exception as error:
        # Do not include URLs or secret query strings in logs/status.
        return name, None, type(error).__name__ + '：來源未通過下載或格式檢查'


def classify(s):
    industry = s.get('industry', '')
    if re.search('金融|保險|銀行|證券', industry):
        return '重資產股'
    if re.search('塑膠|塑化|鋼鐵|水泥|造紙|航運|面板|油電|化學|玻璃|橡膠', industry):
        return '週期股'
    if s.get('eps') is not None and s['eps'] <= 0:
        return '前期虧損企業'
    growth = s.get('revenue_growth')
    if growth is not None and growth >= 20 and re.search('半導體|雲端|資訊服務|軟體', industry) and (s.get('eps') or 0) > 0:
        return '高成長股'
    return '穩定獲利股' if (s.get('eps') or 0) > 0 else '待分類'


def ttm(history, code, period, field):
    """Cumulative Jan–quarter values: prior FY + current YTD - prior YTD."""
    y, q = period.split('-Q'); y = int(y)
    records = history.get(code, {})
    current = records.get(period, {}).get(field)
    if q == '4':
        return current
    annual = records.get(f'{y-1}-Q4', {}).get(field)
    prior = records.get(f'{y-1}-Q{q}', {}).get(field)
    return annual + current - prior if all(v is not None for v in (annual,current,prior)) else None


def historical_peg(price, eps, prior_eps):
    if any(v is None or v <= 0 for v in (price,eps,prior_eps)):
        return None, None
    growth = (eps / prior_eps - 1) * 100
    # Conservative research guard: tiny bases/extreme growth are not comparable.
    if not 1 <= growth <= 100:
        return None, growth
    return (price / eps) / growth, growth


def build_rows(feeds, history, now):
    maps = {name:{str(r.get('Code') or r.get('公司代號')).strip():r for r in rows} for name, rows in feeds.items()}
    rows = []
    for code, company in sorted(maps.get('companies', {}).items()):
        if not re.fullmatch(r'\d{4}', code):
            continue
        s = dict.fromkeys(NUMERIC)
        s.update(symbol=code+'.TW',name=company.get('公司簡稱') or company['公司名稱'],currency='TWD',exchange='TWSE',
                 industry=INDUSTRIES.get(company.get('產業別'),'產業代碼 '+str(company.get('產業別'))),
                 source='臺灣證券交易所／政府開放資料',field_meta={})
        def field(key, value, source, date, basis, reason=None):
            s[key] = number(value)
            s['field_meta'][key] = {'source':BASE+SOURCES[source], 'date':date, 'basis':basis,
                'downloaded_at':now, 'reason':reason if reason else (None if number(value) is not None else '官方未提供／不適用')}
        price = maps.get('prices',{}).get(code,{})
        ratios = maps.get('ratios',{}).get(code,{})
        field('price',price.get('ClosingPrice'),'prices',day(price.get('Date')),'官方收盤參考價；無成交可能缺值')
        s['price_date'] = day(price.get('Date'))
        s['ratio_date'] = day(ratios.get('Date'))
        for key, raw in [('pe','PEratio'),('pb','PBratio'),('dividend_yield','DividendYield')]:
            field(key,ratios.get(raw),'ratios',s['ratio_date'],'官方公告值；此日期為估值日期，非財報期間')
        revenue = maps.get('revenue',{}).get(code,{})
        if revenue.get('產業別'):
            s['industry'] = revenue['產業別']
        field('revenue_growth',revenue.get('營業收入-去年同月增減(%)'),'revenue',month(revenue.get('資料年月')),'單月營收年增率（百分點）')
        eps = maps.get('eps',{}).get(code,{})
        period = quarter(eps)
        field('eps',eps.get('基本每股盈餘(元)'),'eps',period,'年初至本季累計基本 EPS（元），非單季／TTM')
        margins = maps.get('margins',{}).get(code,{})
        field('gross_margin',margins.get('毛利率(%)(營業毛利)/(營業收入)'),'margins',quarter(margins),'年初至本季累計毛利率（百分點）')
        income = maps.get('income',{}).get(code,{})
        balance = maps.get('balance',{}).get(code,{})
        ip = quarter(income)
        # Only the verified general-industry statement schema is archived/derived.
        if ip:
            record = history.setdefault(code,{}).setdefault(ip,{})
            record.update(eps=number(income.get('基本每股盈餘（元）')),revenue=number(income.get('營業收入')),
                          net_income=number(income.get('淨利（淨損）歸屬於母公司業主')))
        bp = quarter(balance)
        if bp:
            history.setdefault(code,{}).setdefault(bp,{})['equity'] = number(balance.get('歸屬於母公司業主之權益合計'))
        trailing = ttm(history,code,ip,'eps') if ip else None
        prior_period = str(int(ip[:4])-1)+ip[4:] if ip else None
        prior_eps = ttm(history,code,prior_period,'eps') if ip else None
        field('trailing_eps',trailing,'income',ip,'最近四季 EPS；以累計財報銜接','缺少完整四季可比財報' if trailing is None else None)
        peg, growth = historical_peg(s['price'],trailing,prior_eps)
        if s['eps'] is None or s['eps'] <= 0:
            peg = None
        field('earnings_growth',growth,'income',ip,'最近四季 EPS 對前一年同期間年增率','缺少兩組正值 TTM EPS' if growth is None else None)
        field('peg',peg,'income',ip,'歷史 PEG = (股價 / TTM EPS) / TTM EPS 年增率百分點；非預估 PEG',
              '須有兩組正值 TTM EPS，年增率 1–100%，且股價有效' if peg is None else None)
        s['peg_basis'] = s['field_meta']['peg']['basis']
        s['field_meta']['peg']['price_date'] = s['price_date']
        s['field_meta']['peg']['comparison_period'] = prior_period
        s['field_meta']['peg']['derived_pe'] = s['price']/trailing if s['price'] is not None and trailing is not None and trailing > 0 else None
        sales = ttm(history,code,ip,'revenue') if ip else None
        shares = number(company.get('已發行普通股數或TDR原股發行股數'))
        ps = s['price']*shares/(sales*1000) if all(v is not None and v > 0 for v in (s['price'],shares,sales)) else None
        field('ps',ps,'income',ip,'股價 × 已發行普通股數 / TTM 營收（財報千元轉元）','缺少完整 TTM 營收、股數或股價' if ps is None else None)
        s['field_meta']['ps'].update(price_date=s['price_date'],shares_date=day(company.get('出表日期')),shares_source=BASE+SOURCES['companies'])
        profit = ttm(history,code,ip,'net_income') if ip else None
        equity = history.get(code,{}).get(ip,{}).get('equity')
        old_equity = history.get(code,{}).get(prior_period,{}).get('equity')
        roe = profit/((equity+old_equity)/2)*100 if profit is not None and all(v is not None and v>0 for v in (equity,old_equity)) else None
        field('roe',roe,'income',ip,'TTM 歸屬母公司淨利 / 期初期末平均母公司權益 × 100','缺少 TTM 淨利或同口徑期初／期末權益' if roe is None else None)
        s['field_meta']['roe'].update(balance_source=BASE+SOURCES['balance'],comparison_period=prior_period)
        s['financial_data_date'] = period
        s['category'] = classify(s)
        s['category_basis'] = '產業、累計 EPS 與單月營收成長的研究分類，需人工確認；可於瀏覽器覆寫'
        rows.append(s)
    return rows


def preserve_fields(rows, previous, failed, now):
    old = {s['symbol']:s for s in previous.get('stocks',[])}
    for s in rows:
        prev = old.get(s['symbol'],{})
        for key, meta in s['field_meta'].items():
            prior = prev.get('field_meta',{}).get(key)
            dependencies = {'roe':{'income','balance'},'ps':{'income','companies','prices'},'peg':{'income','prices'}}
            source_failed = bool(dependencies.get(key,set()) & set(failed)) or any(meta['source'] == BASE+SOURCES[n] for n in failed)
            if prior and (source_failed or (prior.get('date') and meta.get('date') and prior['date'] > meta['date'])):
                s[key], s['field_meta'][key] = prev.get(key), dict(prior,stale_reason='本次來源失敗或日期倒退，沿用前次有效值')
            elif prior and s[key] == prev.get(key) and {k:v for k,v in meta.items() if k!='downloaded_at'} == {k:v for k,v in prior.items() if k not in ('downloaded_at','stale_reason')}:
                meta['downloaded_at'] = prior['downloaded_at']
        s['price_date'] = s['field_meta']['price']['date']
        s['ratio_date'] = s['field_meta']['pe']['date']
        s['snapshot_at'] = max((m['downloaded_at'] for m in s['field_meta'].values()),default=now)
        s['category'] = classify(s)
    return rows


def licensed_csv(rows, url, now):
    """Existing opt-in licensed source: require per-field period and explicit provenance."""
    if urlparse(url).scheme != 'https':
        raise ValueError('授權 CSV 必須是 HTTPS')
    by_symbol = {s['symbol']:s for s in rows}
    for raw in csv.DictReader(io.StringIO(get(url).decode('utf-8-sig'))):
        s = by_symbol.get(raw.get('symbol','').strip().upper())
        if not s or not raw.get('source'):
            continue
        for key in ('ps','peg','gross_margin','revenue_growth','earnings_growth','roe','trailing_eps'):
            value, period = number(raw.get(key)),raw.get(key+'_date') or raw.get('financial_data_date')
            if value is None or not period:
                continue
            basis = raw.get(key+'_basis') or ('已授權 CSV；提供者定義')
            if key == 'peg' and (raw.get('peg_basis') not in ('historical','forward') or not raw.get('peg_period')):
                continue
            if key == 'peg':
                basis = ('歷史' if raw['peg_basis']=='historical' else '預估')+' PEG：'+raw['peg_period']
                s['peg_basis'] = basis
            s[key] = value
            s['field_meta'][key] = dict(source=raw['source'],date=period,basis=basis,downloaded_at=now,reason=None)


def csv_text(rows):
    cols = ['symbol','name','industry','category',*NUMERIC,'price_date','ratio_date','financial_data_date','source','snapshot_at']
    for field in NUMERIC:
        cols += [field+'_date',field+'_source',field+'_downloaded_at',field+'_basis',field+'_reason']
    out = io.StringIO(newline=''); writer = csv.DictWriter(out,fieldnames=cols);writer.writeheader()
    for s in rows:
        row = {k:s.get(k) for k in cols}
        for key in NUMERIC:
            for prop in ('date','source','downloaded_at','basis','reason'):
                row[key+'_'+prop] = s.get('field_meta',{}).get(key,{}).get(prop)
        # Spreadsheet formula injection protection; numeric negatives stay numeric.
        writer.writerow({k:("'"+v if isinstance(v,str) and v.startswith(('=','+','-','@','\t','\r')) else v) for k,v in row.items()})
    return '\ufeff'+out.getvalue()


def run(data_dir=DATA, loader=fetch_source, now=None):
    previous = read_json(data_dir/'stocks.json',{})
    history = read_json(data_dir/'financial-history.json',{})
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(loader,SOURCES))
    now = now or datetime.now(timezone.utc).isoformat(timespec='seconds')
    feeds = {n:r for n,r,e in results if r is not None}
    errors = {n:e for n,r,e in results if e}
    old_count = len(previous.get('stocks',[]))
    if 'companies' in feeds and old_count > 500 and len(feeds['companies']) < old_count*.95:
        errors['companies'] = '公司名冊筆數異常下降，保留前次快照';feeds.pop('companies')
    # Daily feeds must cover most listed companies; PE null remains a valid row.
    codes = {r['公司代號'] for r in feeds.get('companies',[])}
    for name in ('prices','ratios'):
        if name in feeds and codes and len(codes & {r['Code'] for r in feeds[name]})/len(codes)<.9:
            errors[name] = '股票涵蓋率低於 90%，拒絕更新';feeds.pop(name)
    core_ok = all(n in feeds for n in ('companies','prices','ratios'))
    if core_ok:
        rows = preserve_fields(build_rows(feeds,history,now),previous,errors,now)
        if os.environ.get('STOCK_LENS_CSV_URL'):
            try:
                licensed_csv(rows,os.environ['STOCK_LENS_CSV_URL'],now)
            except Exception:
                errors['licensed'] = '授權 CSV 下載或格式失敗'
                old_by_symbol = {s['symbol']:s for s in previous.get('stocks',[])}
                for s in rows:
                    old = old_by_symbol.get(s['symbol'],{})
                    for key,meta in old.get('field_meta',{}).items():
                        if key in NUMERIC and meta.get('source') not in {BASE+p for p in SOURCES.values()}:
                            s[key] = old.get(key)
                            s['field_meta'][key] = dict(meta,stale_reason='授權來源失敗，沿用前次有效值')
        # Preserve per-row fetch timestamps for identical content, including licensed fields.
        old_by = {s['symbol']:s for s in previous.get('stocks',[])}
        for s in rows:
            old = old_by.get(s['symbol'],{})
            for key,meta in s['field_meta'].items():
                pm = old.get('field_meta',{}).get(key,{})
                if s.get(key)==old.get(key) and {k:v for k,v in meta.items() if k!='downloaded_at'}=={k:v for k,v in pm.items() if k!='downloaded_at'}:
                    meta['downloaded_at']=pm.get('downloaded_at',now)
            s['snapshot_at']=max(m['downloaded_at'] for m in s['field_meta'].values())
        payload = dict(schema_version=2,stocks=rows,source='臺灣證券交易所／政府資料開放授權條款第 1 版',license='https://data.gov.tw/license',
                       latest_price_date=max((s['price_date'] for s in rows if s['price_date']),default=None))
        stable_previous = {k:v for k,v in previous.items() if k!='fetched_at'}
        payload['fetched_at'] = previous.get('fetched_at') if payload==stable_previous else now
        write_changed(data_dir/'stocks.json',dump(payload))
        write_changed(data_dir/'stocks.csv',csv_text(rows))
        write_changed(data_dir/'financial-history.json',dump(history))
    elif not (data_dir/'stocks.json').exists():
        write_changed(data_dir/'stocks.json',dump(dict(schema_version=2,stocks=[],fetched_at=None)))
        write_changed(data_dir/'stocks.csv',csv_text([]))
    # Status records transitions, not each retry timestamp. Actions logs retain every attempt.
    status = {'state':'failed' if not core_ok else ('partial' if errors else 'ok'),'errors':errors,
              'latest_price_date':read_json(data_dir/'stocks.json',{}).get('latest_price_date')}
    prior_status = read_json(data_dir/'status.json',{})
    status['since'] = prior_status.get('since',now) if all(prior_status.get(k)==v for k,v in status.items()) else now
    write_changed(data_dir/'status.json',dump(status))
    print(f'{now} status={status["state"]} stocks={len(read_json(data_dir/"stocks.json",{}).get("stocks",[]))} sources={len(feeds)}/{len(SOURCES)}')
    for n,e in errors.items():print(n,e)
    return 0 if not errors else 1


if __name__ == '__main__':
    sys.exit(run())
