"""Publish source-backed company notes against the complete current market universe.

This validates editorial research; it does not manufacture summaries from prices.
Invalid input leaves the last published file untouched.
"""
import gzip
import copy
from financial_ttm import rolling_financials
import argparse
import json
import re
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit
from update_snapshot import dump, write_changed

ROOT = Path(__file__).resolve().parent
SECTIONS = ('business', 'earnings', 'transition', 'developments')


def checked_date(value, today):
    parsed = date.fromisoformat(value)
    if parsed > today:
        raise ValueError('查核／發布日期不可在未來')
    return value


def validate(records, today=None):
    today = today or date.today()
    if not isinstance(records, dict):
        raise ValueError('研究資料必須是以股票代號為索引的物件')
    for symbol, record in records.items():
        if not re.fullmatch(r'\d{4}\.TW', symbol):
            raise ValueError('無效股票代號：' + symbol)
        if not record.get('name') or not isinstance(record.get('limitations'), list) or not record['limitations'] or not all(isinstance(v, str) for v in record['limitations']):
            raise ValueError(symbol + ' 缺少公司名稱或研究限制')
        checked_date(record['reviewed_at'], today)
        sources = record['sources']
        if not isinstance(sources, dict) or not sources:
            raise ValueError(symbol + ' 缺少已查閱來源')
        for source in sources.values():
            url = urlsplit(source['url'])
            if url.scheme != 'https' or not url.hostname or url.username or url.password:
                raise ValueError(symbol + ' 來源必須是公開 HTTPS 網址')
            if not source.get('title') or not source.get('publisher'):
                raise ValueError(symbol + ' 缺少來源標題或發布者')
            checked_date(source['accessed_at'], today)
            if source['accessed_at'] > record['reviewed_at']:
                raise ValueError(symbol + ' 查閱日期晚於摘要查核日期')
            if source.get('published_at'):
                checked_date(source['published_at'], today)
                if source['published_at'] > source['accessed_at']:
                    raise ValueError(symbol + ' 來源發布日期晚於查閱日期')
        count = 0
        for key in SECTIONS:
            section = record.get(key)
            if section is None:
                continue
            if not isinstance(section, dict) or not isinstance(section.get('text'), str) or not section['text'].strip() or not isinstance(section.get('period'), str) or not section['period'].strip() or not isinstance(section.get('sources'), list) or not section['sources']:
                raise ValueError(symbol + ' 段落必須附期間及來源')
            if any(ref not in sources for ref in section['sources']):
                raise ValueError(symbol + ' 段落引用不存在的來源')
            count += 1
        if not count:
            raise ValueError(symbol + ' 沒有已查核段落')
    return records


def validate_overview(data):
    if not isinstance(data, dict) or data.get('schema_version') != 1 or not isinstance(data.get('profiles'), dict):
        raise ValueError('匯入概況格式錯誤')
    for symbol, item in data['profiles'].items():
        if not re.fullmatch(r'\d{4,6}\.TW', symbol) or not isinstance(item, dict):
            raise ValueError('匯入公司代號錯誤')
        for key in ('name', 'business', 'direction', 'summary', 'status', 'source_reviewed_at'):
            if not isinstance(item.get(key), str) or not item[key].strip():
                raise ValueError(symbol + ' 匯入概況缺少 ' + key)
        for key in ('urls', 'events', 'outlooks'):
            if not isinstance(item.get(key), list):
                raise ValueError(symbol + ' 匯入列表錯誤')
        for url in item['urls'] + [u for key in ('events', 'outlooks') for row in item[key] for u in row.get('urls', [])]:
            parsed = urlsplit(url)
            if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
                raise ValueError(symbol + ' 匯入來源網址不安全')
    return data


def build(stocks, records, today=None, overview=None):
    validate(records, today)
    if overview is not None:
        validate_overview(overview)
    profiles = {}
    for stock in stocks:
        symbol = stock['symbol']
        if symbol in profiles:
            raise ValueError('市場資料有重複代號')
        record = records.get(symbol)
        name_changed = bool(record and record['name'] != stock['name'])
        if name_changed:
            record = None
        profiles[symbol] = ({**record, 'status': 'researched'} if record else {
            'name': stock['name'], 'status': 'pending', 'reviewed_at': None,
            'sources': {}, 'limitations': ['公司名稱變更，需重新核對身分。' if name_changed else '尚未完成逐家公司查核；不以產業通用描述推測業務或轉型。']})
        imported = overview['profiles'].get(symbol) if overview else None
        if imported and imported['name'] == stock['name']:
            imported = copy.deepcopy(imported)
            financial = imported.get('financial', {})
            if 'cumulative' in financial:
                financial['rolling'] = rolling_financials(financial['cumulative'])
            profiles[symbol]['overview'] = imported
            if not record:
                profiles[symbol]['status'] = 'overview'
    researched = sum(p['status'] == 'researched' for p in profiles.values())
    result = {'schema_version': 1, 'coverage': {'total': len(profiles),
            'researched': researched, 'pending': len(profiles)-researched},
            'profiles': profiles}
    if overview is not None:
        result['overview_source'] = overview['source']
        result['coverage']['overview'] = sum('overview' in p for p in profiles.values())
        result['coverage']['missing_overview'] = len(profiles) - result['coverage']['overview']
    return result


def run(root=ROOT):
    stocks = json.loads((root/'site/data/stocks.json').read_text())['stocks']
    if not stocks:
        raise ValueError('市場名冊為空，保留上一份研究索引')
    records = json.loads((root/'research/companies.json').read_text())
    path = root/'research/imported-overview.json.gz'
    overview = json.loads(gzip.decompress(path.read_bytes())) if path.exists() else None
    payload = build(stocks, records, overview=overview)
    write_changed(root/'site/data/company-research.json', dump(payload))
    print(json.dumps(payload['coverage'], ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--validate-only', action='store_true')
    args = parser.parse_args()
    if args.validate_only:
        validate(json.loads((ROOT/'research/companies.json').read_text()))
    else:
        run()
