"""Derive trailing twelve months from dated cumulative financial statements."""
import math
import re


def numeric(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def trailing_value(records, period, field):
    """TTM = previous full year + current YTD - previous matching YTD.

    At Q4, the full-year cumulative value already covers twelve months.
    Missing values and differing statement bases do not produce an estimate.
    """
    year, quarter = map(int, re.fullmatch(r'(\d{4})-Q([1-4])', period).groups())
    keys = [period] if quarter == 4 else [f'{year-1}-Q4', period, f'{year-1}-Q{quarter}']
    rows = [records.get(key, {}) for key in keys]
    values = [row.get(field) for row in rows]
    bases = {row.get('basis') for row in rows if row.get('basis')}
    if not all(numeric(v) for v in values) or len(bases) > 1:
        return None
    return values[0] if quarter == 4 else values[0] + values[1] - values[2]


def rolling_financials(records):
    periods = sorted(p for p in records if re.fullmatch(r'\d{4}-Q[1-4]', p))
    if not periods:
        return None
    latest = periods[-1]
    year, quarter = int(latest[:4]), int(latest[-1])
    end = year * 4 + quarter - 1
    quarters = []
    for index in range(end - 3, end + 1):
        y, q = index // 4, index % 4 + 1
        period = f'{y}-Q{q}'
        current = records.get(period, {})
        previous = records.get(f'{y}-Q{q-1}', {}) if q > 1 else None
        row = {'period': period}
        for field in ('revenue', 'eps', 'net_income'):
            value = current.get(field)
            prior = previous.get(field) if previous is not None else 0
            comparable = previous is None or current.get('basis') == previous.get('basis')
            row[field] = value - prior if numeric(value) and numeric(prior) and comparable else None
        quarters.append(row)
    return {'period': latest, 'start_period': quarters[0]['period'],
            'basis': records[latest].get('basis'), 'quarters': quarters,
            'ttms': trailing_value(records, latest, 'revenue'),
            'ttm_eps': trailing_value(records, latest, 'eps'),
            'ttm_parent_profit': trailing_value(records, latest, 'net_income'),
            'formula': '前一年全年＋今年截至本季累計－去年截至同季累計；第四季直接使用全年數字'}
