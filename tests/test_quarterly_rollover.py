import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import update_snapshot as u
from test_snapshot import feeds


class QuarterlyRolloverTests(unittest.TestCase):
    def valid_row(self, source):
        row = copy.deepcopy(feeds()[source][0])
        row['出表日期'] = '1151103'
        row['季別'] = '3'
        return row

    def test_small_seasonal_batch_still_requires_valid_rows(self):
        for source in u.QUARTERLY:
            row = self.valid_row(source)
            self.assertEqual(u.validate(source, [row]), [row])
            for bad in ([], [row, row], [dict(row, 公司代號='oops')],
                        [dict(row, 季別='4')], [dict(row, 出表日期='bad')]):
                with self.assertRaises(ValueError):
                    u.validate(source, bad)
            metric = {'eps':'基本每股盈餘(元)', 'margins':'毛利率(%)(營業毛利)/(營業收入)',
                      'income':'基本每股盈餘（元）', 'balance':'歸屬於母公司業主之權益合計'}[source]
            with self.assertRaises(ValueError):
                u.validate(source, [dict(row, **{metric:'not a number'})])

    def test_malformed_json_retries_and_never_becomes_an_empty_success(self):
        good = json.dumps([self.valid_row('income')]).encode()
        with patch.object(u, 'get', side_effect=[b'<html>temporary failure</html>', good]) as get, patch.object(u.time, 'sleep'):
            name, rows, error = u.fetch_source('income')
            self.assertEqual((name, error), ('income', None))
            self.assertEqual(len(rows), 1)
            self.assertEqual(get.call_count, 2)
        with patch.object(u, 'get', return_value=b'<html>bad</html>') as get, patch.object(u.time, 'sleep'):
            self.assertIsNone(u.fetch_source('income')[1])
            self.assertEqual(get.call_count, 3)

    def test_merge_keeps_missing_companies_and_rejects_regressions(self):
        new = self.valid_row('eps')
        old = dict(new, 季別='2')
        other = dict(old, 公司代號='9999')
        merged = u.merge_quarterly([new, other], [old])
        self.assertEqual({r['公司代號']:r['季別'] for r in merged}, {'2330':'3','9999':'2'})
        self.assertEqual(u.merge_quarterly([new], [dict(new, 出表日期='1151102')]), [new])
        self.assertEqual(u.merge_quarterly([new], [dict(new, **{'基本每股盈餘(元)':'0'})])[0]['基本每股盈餘(元)'], '0')

    def test_first_cache_migration_preserves_unreported_company_and_reprices_ps(self):
        base = feeds()
        for name, rows in base.items():
            second = copy.deepcopy(rows[0])
            second['Code' if name in ('prices','ratios') else '公司代號'] = '9999'
            rows.append(second)
        history = {code:{'2025-Q2':{'eps':3,'revenue':60,'net_income':10,'equity':90},
                         '2025-Q4':{'eps':6,'revenue':150,'net_income':25}}
                   for code in ('2330','9999')}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            (path/'financial-history.json').write_text(json.dumps(history))
            load = lambda name:(name,copy.deepcopy(base[name]),None)
            self.assertEqual(u.run(path, load, 'first'), 0)
            before = json.loads((path/'stocks.json').read_text())
            # The deployed version has no raw quarterly cache yet.
            (path/'quarterly-sources.json').unlink()
            incoming = copy.deepcopy(base)
            for name in u.QUARTERLY:
                incoming[name] = [dict(incoming[name][0], 季別='3', 出表日期='1151103')]
            incoming['eps'][0]['基本每股盈餘(元)'] = '6'
            incoming['income'][0].update({'基本每股盈餘（元）':'6','營業收入':'120','淨利（淨損）歸屬於母公司業主':'25'})
            for row in incoming['prices']:
                row['ClosingPrice'] = '200'
            self.assertEqual(u.run(path, lambda n:(n,copy.deepcopy(incoming[n]),None), 'second'), 0)
            rows = {s['symbol']:s for s in json.loads((path/'stocks.json').read_text())['stocks']}
            self.assertEqual(rows['2330.TW']['eps'], 6)
            self.assertEqual(rows['2330.TW']['financial_data_date'], '2026-Q3')
            old = rows['9999.TW']
            self.assertEqual((old['eps'],old['gross_margin'],old['financial_data_date']), (5,60,'2026-Q2'))
            self.assertEqual(old['field_meta']['eps']['downloaded_at'], 'first')
            self.assertAlmostEqual(old['ps'], before['stocks'][1]['ps'] * 200 / 100.5)
            self.assertEqual(old['field_meta']['ps']['date'], '2026-Q2')
            h = json.loads((path/'financial-history.json').read_text())
            self.assertNotIn('2026-Q3', h['9999'])
            self.assertEqual(h['9999']['2026-Q2']['eps'], 5)
            # Next response only contains the other company. Cached Q3 survives.
            for name in u.QUARTERLY:
                incoming[name][0]['公司代號'] = '9999'
            self.assertEqual(u.run(path, lambda n:(n,copy.deepcopy(incoming[n]),None), 'third'), 0)
            rows = {s['symbol']:s for s in json.loads((path/'stocks.json').read_text())['stocks']}
            self.assertEqual(rows['2330.TW']['financial_data_date'], '2026-Q3')
            self.assertEqual(json.loads((path/'status.json').read_text())['state'], 'ok')


if __name__ == '__main__':
    unittest.main()
