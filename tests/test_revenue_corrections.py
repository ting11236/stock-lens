import json
import unittest
from pathlib import Path
from revenue_corrections import corrected_revenue


class RevenueCorrectionTests(unittest.TestCase):
    def setUp(self):
        self.row = {'公司代號':'6472', '資料年月':'11510',
                    '營業收入-當月營收':'1989583', '營業收入-上月營收':'2325228',
                    '累計營業收入-當月累計營收':'18293599',
                    '營業收入-去年當月營收':'1716457',
                    '累計營業收入-去年累計營收':'16613638'}

    def test_stale_feed_uses_announced_values_and_recalculates_growth(self):
        result = corrected_revenue(self.row)
        self.assertEqual(result['營業收入-當月營收'], '1975135')
        self.assertEqual(result['營業收入-上月營收'], '2369613')
        self.assertAlmostEqual(result['營業收入-去年同月增減(%)'], (1975135/1716457-1)*100)
        self.assertEqual(result['_official_correction']['sequence'], '2')
        self.assertEqual(self.row['營業收入-當月營收'], '1989583')

    def test_new_month_new_revision_and_other_company_are_never_overridden(self):
        for change in [{'資料年月':'11511'}, {'公司代號':'2330'},
                       {'營業收入-當月營收':'1975000'},
                       {'累計營業收入-當月累計營收':'18324000'}]:
            row = dict(self.row, **change)
            self.assertIs(corrected_revenue(row), row)

    def test_missing_comparison_does_not_preserve_old_growth(self):
        row = dict(self.row, **{'營業收入-去年同月增減(%)':'15.912195877904312'})
        del row['營業收入-去年當月營收']
        self.assertIsNone(corrected_revenue(row)['營業收入-去年同月增減(%)'])
