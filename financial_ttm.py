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


def derived_metrics(stock, financial, equity_history=None):
    """Keep imported calculations separate from official stock-feed fields."""
    records = financial.get('cumulative', {})
    rolling = rolling_financials(records)
    if not rolling:
        return {}
    period = rolling['period']
    prior_period = str(int(period[:4])-1) + period[4:]
    eps, sales, profit = rolling['ttm_eps'], rolling['ttms'], rolling['ttm_parent_profit']
    price, shares = stock.get('price'), stock.get('issued_shares')
    prior_eps = trailing_value(records, prior_period, 'eps')
    growth = (eps / prior_eps - 1) * 100 if numeric(eps) and numeric(prior_eps) and eps > 0 and prior_eps > 0 else None
    pe = price / eps if numeric(price) and price > 0 and numeric(eps) and eps > 0 else None
    # Ordinary operating revenue, not financial-industry net-income equivalents.
    ps = price * shares / (sales * 100000000) if rolling['basis'] == '合併營業收入' and all(numeric(v) and v > 0 for v in (price, shares, sales)) and stock.get('shares_date') else None
    balances = equity_history or {}
    equity = balances.get(period, {}).get('equity')
    old = balances.get(prior_period, {}).get('equity')
    roe = profit * 100000 / ((equity + old) / 2) * 100 if numeric(profit) and all(numeric(v) and v > 0 for v in (equity, old)) else None
    formulas = {
        'trailing_eps': (eps, rolling['formula'], '缺少可比的累計 EPS'),
        'trailing_sales': (sales, rolling['formula']+'；億元', '缺少可比的累計營收'),
        'calculated_pe': (pe, '股價 ÷ 最近四季 EPS；與官方 PE 分開', '股價缺值或最近四季 EPS 非正'),
        'ps': (ps, '股價 × 已發行普通股數 ÷（最近四季營收 × 100,000,000 元）', '缺少股價、股數日期或正值營收；金融淨收益不套一般營收 PS'),
        'earnings_growth': (growth, '（本期 TTM EPS ÷ 去年同季 TTM EPS − 1）× 100%', '缺少兩組正值且可比的 TTM EPS'),
        'peg': (pe / growth if pe is not None and growth is not None and 1 <= growth <= 100 else None, '（股價 ÷ TTM EPS）÷ TTM EPS 年增率百分點', '缺少有效成長率；沿用 1%–100% 的研究門檻'),
        'roe': (roe, 'TTM 歸母淨利 ÷ 期初期末平均母公司權益 × 100%；億元轉財報千元', '缺少同口徑期初及期末權益，不能用期末權益代替平均'),
    }
    return {key: {'value': value, 'period': period, 'formula': formula,
                  'reason': None if value is not None else reason,
                  'comparison_period': prior_period if key in ('roe','peg','earnings_growth') else None,
                  'price_date': stock.get('price_date') if key in ('calculated_pe','ps','peg') else None,
                  'shares_date': stock.get('shares_date') if key == 'ps' else None,
                  'shares_source': stock.get('shares_source') if key == 'ps' else None}
            for key, (value, formula, reason) in formulas.items()}
