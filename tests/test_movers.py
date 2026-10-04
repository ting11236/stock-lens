import unittest
from market_movers import build_movers, parse_day

class MoversTests(unittest.TestCase):
    def test_dates_session_count_directions_and_missing_sessions(self):
        dates=['2026-09-24','2026-09-25','2026-09-28','2026-09-29','2026-09-30','2026-10-02']
        history={d:{'1101':{'close':100+i,'reference':100+i-1},'1102':{'close':100-i,'reference':101-i},'1103':{'close':100}} for i,d in enumerate(dates)}
        del history[dates[2]]['1103']
        stocks=[{'symbol':c+'.TW','name':c,'industry':'水泥','price_date':dates[-1]} for c in ['1101','1102','1103']]
        p=build_movers(history,stocks)['periods']
        self.assertAlmostEqual(p['5']['gainers'][0]['change'],5)
        self.assertAlmostEqual(p['5']['losers'][0]['change'],-5)
        self.assertEqual(p['5']['count'],2)
        self.assertEqual(p['5']['start'],dates[0])
        self.assertNotIn('20',p)
        stocks[0]['price_date']='2026-09-30'
        self.assertEqual(len(build_movers(history,stocks)['periods']['5']['gainers']),0)

    def test_wrong_or_nontrading_dates_are_not_used(self):
        self.assertIsNone(parse_day({'stat':'OK','date':'20261001'},'2026-10-02'))
        self.assertIsNone(parse_day({'stat':'很抱歉，沒有符合條件的資料!','date':'20261002'},'2026-10-02'))
