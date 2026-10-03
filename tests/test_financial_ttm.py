import unittest
from financial_ttm import rolling_financials, trailing_value

class FinancialTTMTests(unittest.TestCase):
    def test_cumulative_formula_and_quarter_differences(self):
        records = {'2025-Q2': {'revenue': 50, 'eps': 2},
                   '2025-Q3': {'revenue': 80, 'eps': 3},
                   '2025-Q4': {'revenue': 120, 'eps': 5},
                   '2026-Q1': {'revenue': 40, 'eps': 1},
                   '2026-Q2': {'revenue': 90, 'eps': 4}}
        r = rolling_financials(records)
        self.assertEqual(r['ttms'], 160)
        self.assertEqual(r['ttm_eps'], 7)
        self.assertEqual([q['revenue'] for q in r['quarters']], [30, 40, 40, 50])
        records['2026-Q3'] = {'revenue': 140, 'eps': 6}
        r = rolling_financials(records)
        self.assertEqual(r['period'], '2026-Q3')
        self.assertEqual(r['start_period'], '2025-Q4')
        self.assertEqual(r['ttms'], 180)
        self.assertEqual(r['ttm_eps'], 8)

    def test_full_year_missing_zero_losses_and_basis_changes(self):
        self.assertEqual(trailing_value({'2026-Q4': {'eps': -2}}, '2026-Q4', 'eps'), -2)
        records = {'2025-Q4': {'eps': 0, 'basis': 'A'},
                   '2025-Q2': {'eps': 0, 'basis': 'A'},
                   '2026-Q2': {'eps': 0, 'basis': 'A'}}
        self.assertEqual(trailing_value(records, '2026-Q2', 'eps'), 0)
        records['2026-Q2']['basis'] = 'B'
        self.assertIsNone(trailing_value(records, '2026-Q2', 'eps'))
        records['2026-Q2']['basis'] = 'A'
        del records['2025-Q2']['eps']
        self.assertIsNone(trailing_value(records, '2026-Q2', 'eps'))
        self.assertIsNone(rolling_financials({}))
