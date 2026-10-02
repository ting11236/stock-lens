"""Licensed TWSE monthly observations; do not crawl restricted historical pages."""
import csv
import io
import json
import re
import sys
from datetime import datetime, timezone, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path
from update_snapshot import DATA, BASE, get, day, month, read_json, write_changed, dump, fingerprint

URL = BASE + 'opendata/t187ap05_L'
UNIT = {'元': 1, '千元': 1000, '百萬元': 1000000}

def shift(period, offset):
    y, m = map(int, period.split('-'))
    index = y * 12 + m - 1 + offset
    return f'{index // 12:04d}-{index % 12 + 1:02d}'

def amount(raw, unit):
    if unit not in UNIT:
        raise ValueError('不支援的單位')
    try:
        v = Decimal(str(raw).replace(',', '').strip())
        return int(v * UNIT[unit]) if v.is_finite() and v * UNIT[unit] == int(v * UNIT[unit]) else None
    except (InvalidOperation, ValueError, TypeError):
        return None

def parse(rows, companies, now):
    if not isinstance(rows, list) or not rows:
        raise ValueError('空資料或非陣列')
    result, seen = [], set()
    for r in rows:
        code = str(r.get('公司代號', '')).strip()
        if code not in companies:
            continue
        p = month(r.get('資料年月'))
        if not p or code in seen or '營業收入-當月營收' not in r:
            raise ValueError('年月、欄位或重複代號異常')
        seen.add(code)
        identity = companies[code]['identity']
        for offset, key in [(0, '營業收入-當月營收'), (-1, '營業收入-上月營收'), (-12, '營業收入-去年當月營收')]:
            raw = r.get(key)
            result.append(dict(code=code, name=r.get('公司名稱'), period=shift(p, offset),
                raw_amount=raw, raw_unit='千元', amount_twd=amount(raw, '千元'), currency='TWD', unit='元',
                basis='unknown', basis_note='此開放資料未逐列標示合併／個體，尚未確認可比口徑',
                identity=identity, identity_verified=offset == 0,
                source_url=URL, source_field=key, source_period=p,
                published_at=None, published_note='來源未提供公司公告日期',
                table_date=day(r.get('出表日期')), downloaded_at=now,
                reason=None if amount(raw, '千元') is not None else '官方未提供有效單月金額',
                note=r.get('備註')))
    if len(seen) < len(companies) * .9:
        raise ValueError('來源涵蓋率低於 90%，保留前次資料')
    return result

def merge(old, records):
    history = json.loads(json.dumps(old))
    for r in records:
        key = r['code'] + ':' + r['period']
        prior = history.get(key)
        comparable = lambda x: {k:v for k,v in x.items() if k not in ('downloaded_at', 'revisions')}
        if prior and comparable(prior) == comparable(r):
            continue
        # Prefer the original month's observation over later comparison columns;
        # changed comparisons are retained for review, never silently overwrite.
        if prior and prior['source_field'] == '營業收入-當月營收' and r['source_field'] != '營業收入-當月營收':
            if prior['amount_twd'] != r['amount_twd']:
                evidence = {k:v for k,v in r.items() if k != 'revisions'}
                prior.setdefault('comparison_conflicts', [])
                if not any(comparable(x)==comparable(evidence) for x in prior['comparison_conflicts']):
                    prior['comparison_conflicts'].append(evidence)
            continue
        r = dict(r)
        r['revisions'] = (prior.get('revisions', []) + [{k:v for k,v in prior.items() if k != 'revisions'}]) if prior else []
        history[key] = r
    return history

def ttm(records, end):
    periods = [shift(end, -i) for i in range(11, -1, -1)]
    rows = [records.get(p) for p in periods]
    reason = None
    if any(r is None for r in rows): reason = '缺少連續 12 個月：' + '、'.join(p for p,r in zip(periods,rows) if r is None)
    elif any(r['amount_twd'] is None for r in rows): reason = '單月金額缺值'
    elif any(r.get('comparison_conflicts') for r in rows): reason = '修訂比較值衝突，需查核原月份'
    elif any(r.get('basis') not in ('consolidated', 'individual') for r in rows): reason = '合併／個體口徑尚未確認'
    elif len({(r['identity'], r['basis'], r['currency']) for r in rows}) != 1 or not all(r.get('identity_verified') for r in rows): reason = '公司身分或口徑不一致／未驗證'
    return dict(start=periods[0], end=end, amount_twd=None if reason else sum(r['amount_twd'] for r in rows), reason=reason)

def build(history, companies, now, status):
    taipei = datetime.fromisoformat(now).astimezone(timezone(timedelta(hours=8)))
    current = taipei.strftime('%Y-%m')
    expected = shift(current, -1 if taipei.day >= 16 else -2)
    profiles = {}
    for code, c in companies.items():
        rows = {r['period']:r for r in history.values() if r['code']==code}
        latest = max(rows, default=None)
        target = [shift(expected, -i) for i in range(23,-1,-1)]
        windows = [ttm(rows,p) for p in sorted(rows)]
        profiles[code+'.TW'] = dict(name=c['name'], latest_month=latest, stale=latest is None or latest < expected,
            expected_month=expected, records=[rows[p] for p in sorted(rows, reverse=True)],
            missing_months=[p for p in target if p not in rows], ttm=ttm(rows,latest) if latest else None,
            historical_ttm=windows)
    values = list(profiles.values())
    return dict(schema_version=1, profiles=profiles, status=status, expected_month=expected,
        coverage=dict(companies=len(values), companies_with_records=sum(bool(v['records']) for v in values),
            records=sum(len(v['records']) for v in values), companies_with_ttm=sum(v['ttm'] is not None and v['ttm']['amount_twd'] is not None for v in values),
            distinct_months=sorted({r['period'] for r in history.values()})),
        limitations=['授權開放介面只提供當月、上月、去年同月；無法完成連續 12／24 月回補。',
            '出表日期不是公司公告日；合併／個體口徑未標示，TTM 暫不計算。',
            '歷史比较欄不能驗證過去公司身分；累計欄位未推導為單月。'])

def run(data_dir=DATA, fetch=get, now=None):
    now = now or datetime.now(timezone.utc).isoformat(timespec='seconds')
    old = read_json(data_dir/'revenue-history.json', {})
    previous = read_json(data_dir/'revenue.json', {})
    prior_status = dict(previous.get('status', {}))
    try:
        roster = json.loads(fetch(BASE+'opendata/t187ap03_L').decode('utf-8-sig'))
        companies = {str(r['公司代號']):dict(name=r['公司名稱'], identity=str(r.get('營利事業統一編號') or r['公司名稱'])) for r in roster if re.fullmatch(r'\d{4}', str(r.get('公司代號','')))}
        if len(companies)<500 or len(companies)<len(previous.get('profiles',{}))*.9: raise ValueError('名冊異常')
        records = parse(json.loads(fetch(URL).decode('utf-8-sig')), companies, now)
        history = merge(old, records)
        status = dict(state='partial', error=None, limitation='歷史月份與合併／個體口徑不足')
        payload = build(history, companies, now, status)
        write_changed(data_dir/'revenue-history.json', dump(history))
    except Exception as e:
        status = dict(state='failed', error=type(e).__name__+'：下載或格式檢查失敗，保留前次有效營收', limitation='歷史月份與合併／個體口徑不足')
        payload = previous or dict(schema_version=1, profiles={},coverage={},limitations=['尚無有效營收資料'])
        payload['status'] = status
    status['since'] = prior_status.get('since',now) if all(prior_status.get(k)==v for k,v in status.items()) else now
    write_changed(data_dir/'revenue.json',dump(payload))
    out = io.StringIO(newline=''); fields = ['code','name','period','raw_amount','raw_unit','amount_twd','currency','unit','basis','basis_note','identity','identity_verified','source_url','source_field','source_period','published_at','published_note','table_date','downloaded_at','reason','note']
    writer = csv.DictWriter(out,fieldnames=fields,extrasaction='ignore');writer.writeheader()
    for p in payload['profiles'].values(): writer.writerows(p['records'])
    write_changed(data_dir/'revenue.csv','\ufeff'+out.getvalue())
    print(json.dumps({'status':status,'coverage':payload.get('coverage')},ensure_ascii=False))
    return 1 if status['state']=='failed' else 0

if __name__=='__main__': sys.exit(run())
