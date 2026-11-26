"""Apply verified announcement corrections only to the exact superseded feed row."""
import copy
import json
from pathlib import Path


def corrected_revenue(row, corrections=None):
    if corrections is None:
        path = Path(__file__).parent / 'research/monthly-revenue-corrections.json'
        corrections = json.loads(path.read_text())['corrections'] if path.exists() else []
    for correction in corrections:
        if str(row.get('公司代號')) != correction['company_code'] or str(row.get('資料年月')) != correction['feed_period']:
            continue
        before, after = correction['before'], correction['after']
        # A later official revision must not be replaced by this older notice.
        if any(str(row.get(k)) != str(v) for k, v in before.items()):
            continue
        result = copy.deepcopy(row)
        result.update({k: str(v) for k, v in after.items()})
        for numerator, denominator, target in [
            ('營業收入-當月營收', '營業收入-去年當月營收', '營業收入-去年同月增減(%)'),
            ('營業收入-當月營收', '營業收入-上月營收', '營業收入-上月比較增減(%)'),
            ('累計營業收入-當月累計營收', '累計營業收入-去年累計營收', '累計營業收入-前期比較增減(%)'),
        ]:
            try:
                n, d = float(result[numerator]), float(result[denominator])
                result[target] = (n / d - 1) * 100 if d > 0 else None
            except (KeyError, TypeError, ValueError):
                result[target] = None
        result['_official_correction'] = correction['source']
        return result
    return row
