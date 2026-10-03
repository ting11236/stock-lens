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

class DerivedMetricTests(unittest.TestCase):
    def test_units_peg_and_average_equity(self):
        from financial_ttm import derived_metrics
        financial={'cumulative':{'2024-Q4':{'revenue':100,'eps':4,'net_income':10,'basis':'合併營業收入'},'2025-Q4':{'revenue':150,'eps':5,'net_income':15,'basis':'合併營業收入'}}}
        stock={'price':100,'issued_shares':100000000,'shares_date':'2026-10-02','price_date':'2026-10-02'}
        balance={'2024-Q4':{'equity':10000000},'2025-Q4':{'equity':20000000}}
        result=derived_metrics(stock,financial,balance)
        self.assertAlmostEqual(result['ps']['value'],100/150)
        self.assertEqual(result['calculated_pe']['value'],20)
        self.assertEqual(result['earnings_growth']['value'],25)
        self.assertEqual(result['peg']['value'],.8)
        self.assertEqual(result['roe']['value'],10)
        self.assertEqual(result['ps']['shares_date'],'2026-10-02')
        self.assertIsNone(derived_metrics(stock,financial,{})['roe']['value'])
        for row in financial['cumulative'].values():row['basis']='銀行淨收益'
        self.assertIsNone(derived_metrics(stock,financial,balance)['ps']['value'])

    def test_missing_share_date_and_loss_do_not_manufacture_values(self):
        from financial_ttm import derived_metrics
        financial={'cumulative':{'2026-Q4':{'revenue':100,'eps':-2,'basis':'合併營業收入'}}}
        r=derived_metrics({'price':100,'issued_shares':1000},financial)
        self.assertIsNone(r['ps']['value'])
        self.assertIsNone(r['calculated_pe']['value'])
        self.assertIsNone(r['peg']['value'])

class AnnualPEGTests(unittest.TestCase):
    def test_annual_fallback_uses_annual_pe_not_ttm_pe(self):
        from financial_ttm import derived_metrics
        rows={'2024-Q4':{'eps':4,'basis':'合併營業收入'},'2025-Q4':{'eps':5,'basis':'合併營業收入'},'2025-Q2':{'eps':1,'basis':'合併營業收入'},'2026-Q2':{'eps':1.2,'basis':'合併營業收入'}}
        r=derived_metrics({'price':100,'price_date':'2026-10-02'},{'cumulative':rows})
        self.assertAlmostEqual(r['calculated_pe']['value'],100/5.2)
        self.assertEqual(r['earnings_growth']['value'],25)
        self.assertEqual(r['peg']['value'],.8)
        self.assertEqual(r['peg']['pe_used'],20)
        self.assertEqual(r['peg']['period'],'2025-Q4')
        self.assertEqual(r['peg']['comparison_period'],'2024-Q4')
        self.assertEqual(r['peg']['period_mode'],'annual')
        rows['2024-Q2']={'eps':.8,'basis':'合併營業收入'}
        r=derived_metrics({'price':100},{'cumulative':rows})
        self.assertEqual(r['peg']['period_mode'],'ttm')
        self.assertEqual(r['peg']['period'],'2026-Q2')
        self.assertAlmostEqual(r['earnings_growth']['value'],(5.2/4.2-1)*100)

    def test_growth_decline_loss_basis_and_threshold(self):
        from financial_ttm import derived_metrics
        for old,new,basis,growth in [(4,5,'B',None),(0,5,'A',None),(-2,5,'A',None),(4,3,'A',-25),(4,-1,'A',-125),(1,4,'A',300)]:
            rows={'2024-Q4':{'eps':old,'basis':'A'},'2025-Q4':{'eps':new,'basis':basis},'2026-Q2':{'eps':1,'basis':'A'}}
            r=derived_metrics({'price':100},{'cumulative':rows})
            self.assertEqual(r['earnings_growth']['value'],growth)
            self.assertIsNone(r['peg']['value'])
