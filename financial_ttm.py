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
    same_eps_basis = records.get(period, {}).get('basis') == records.get(prior_period, {}).get('basis')
    growth = (eps / prior_eps - 1) * 100 if same_eps_basis and numeric(eps) and numeric(prior_eps) and prior_eps > 0 else None
    growth_period, growth_prior_period, growth_mode, growth_eps = period, prior_period, 'ttm', eps
    if growth is None:
        annual_periods = sorted(p for p in records if re.fullmatch(r'\d{4}-Q4', p) and p <= period)
        if annual_periods:
            annual = annual_periods[-1]
            old_annual = str(int(annual[:4])-1) + '-Q4'
            current, previous = records[annual], records.get(old_annual, {})
            current_eps, old_eps = current.get('eps'), previous.get('eps')
            if current.get('basis') == previous.get('basis') and numeric(current_eps) and numeric(old_eps) and old_eps > 0:
                growth = (current_eps / old_eps - 1) * 100
                growth_period, growth_prior_period, growth_mode, growth_eps = annual, old_annual, 'annual', current_eps
    annual_periods = sorted(p for p in records if re.fullmatch(r'\d{4}-Q4', p) and p <= period)
    cagr = {}
    if annual_periods:
        end = annual_periods[-1]
        for years in (3, 5):
            keys = [f'{int(end[:4])-i}-Q4' for i in range(years+1)]
            values = [records.get(k, {}).get('eps') for k in keys]
            bases = {records.get(k, {}).get('basis') for k in keys}
            if len(bases) == 1 and all(numeric(v) and v > 0 for v in values):
                cagr[years] = ((values[0]/values[-1])**(1/years)-1)*100
        years = 5 if 5 in cagr else 3 if 3 in cagr else None
        if years:
            growth, growth_eps = cagr[years], records[end]['eps']
            growth_period, growth_prior_period, growth_mode = end, f'{int(end[:4])-years}-Q4', f'cagr{years}'
    peg_pe = price / growth_eps if numeric(price) and price > 0 and numeric(growth_eps) and growth_eps > 0 else None
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
        'earnings_growth': (growth, ('（本年全年 EPS ÷ 前年全年 EPS − 1）× 100%' if growth_mode == 'annual' else '（本期 TTM EPS ÷ 去年同季 TTM EPS − 1）× 100%'), '缺少可比的 EPS，或前期 EPS 不大於零'),
        'peg': (peg_pe / growth if peg_pe is not None and growth is not None and 1 <= growth <= 100 else None, ('（股價 ÷ 本年全年 EPS）÷ 全年 EPS 年增率百分點' if growth_mode == 'annual' else '（股價 ÷ TTM EPS）÷ TTM EPS 年增率百分點'), 'EPS 須為正，成長率須在 1%–100% 的本站研究範圍內'),
        'roe': (roe, 'TTM 歸母淨利 ÷ 期初期末平均母公司權益 × 100%；億元轉財報千元', '缺少同口徑期初及期末權益，不能用期末權益代替平均'),
    }
    if growth_mode.startswith('cagr'):
        n=int(growth_mode[-1])
        formulas['earnings_growth']=(growth, f'（期末全年 EPS ÷ {n} 年前全年 EPS）^(1/{n}) − 1，再乘 100%', '缺少連續同口徑正值全年 EPS')
        formulas['peg']=(peg_pe/growth if peg_pe is not None and 1 <= growth <= 100 else None, f'（股價 ÷ 期末全年 EPS）÷ {n} 年 EPS 複合成長率百分點', 'EPS CAGR 須在 1%–100% 的本站研究範圍內，且股價有效')
    return {key: {'value': value, 'period': growth_period if key in ('peg','earnings_growth') else period, 'formula': formula,
                  'reason': None if value is not None else reason,
                  'comparison_period': (growth_prior_period if key in ('peg','earnings_growth') else prior_period if key == 'roe' else None),
                  'period_mode': growth_mode if key in ('peg','earnings_growth') else None,
                  'eps_used': growth_eps if key == 'peg' else None,
                  'pe_used': peg_pe if key == 'peg' else None,
                  'price_date': stock.get('price_date') if key in ('calculated_pe','ps','peg') else None,
                  'shares_date': stock.get('shares_date') if key == 'ps' else None,
                  'shares_source': stock.get('shares_source') if key == 'ps' else None}
            for key, (value, formula, reason) in formulas.items()}
