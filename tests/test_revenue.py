import copy
import json
import tempfile
import unittest
from pathlib import Path
import update_revenue as r

class RevenueTests(unittest.TestCase):
    def rows(self, end='2026-01'):
        return {r.shift(end,-i):dict(period=r.shift(end,-i),amount_twd=i,identity='id',identity_verified=True,basis='consolidated',currency='TWD') for i in range(12)}
    def test_contiguous_cross_year_zero(self):
        t=r.ttm(self.rows(),'2026-01')
        self.assertEqual(t['start'],'2025-02');self.assertEqual(t['amount_twd'],66)
    def test_gap_even_with_twelve_observations(self):
        rows=self.rows();del rows['2025-07'];rows['2025-01']=copy.deepcopy(rows['2025-02'])
        self.assertIsNone(r.ttm(rows,'2026-01')['amount_twd'])
    def test_insufficient_history(self):
        self.assertIsNone(r.ttm({'2026-01':self.rows()['2026-01']},'2026-01')['amount_twd'])
    def test_units_missing_negative_zero(self):
        self.assertEqual(r.amount('1,234','千元'),1234000);self.assertEqual(r.amount('1.5','百萬元'),1500000)
        self.assertEqual(r.amount('0','元'),0);self.assertEqual(r.amount('-3','千元'),-3000)
        for v in ('','—',None,'NaN'):self.assertIsNone(r.amount(v,'千元'))
        with self.assertRaises(ValueError):r.amount('1','unknown')
    def test_basis_identity_currency_and_conflict(self):
        for key,value in [('basis','individual'),('basis','unknown'),('identity','another'),('identity_verified',False),('currency','USD'),('comparison_conflicts',[{}]),('amount_twd',None)]:
            rows=self.rows();rows['2026-01'][key]=value
            self.assertIsNone(r.ttm(rows,'2026-01')['amount_twd'])
    def record(self):
        return dict(code='2330',period='2026-01',source_field='營業收入-當月營收',amount_twd=1000,downloaded_at='a')
    def test_revision_and_idempotence(self):
        a=self.record();h=r.merge({},[a]);b=dict(a,downloaded_at='b')
        self.assertEqual(h,r.merge(h,[b]));b['amount_twd']=2000
        revised=r.merge(h,[b]);self.assertEqual(revised['2330:2026-01']['amount_twd'],2000)
        self.assertEqual(revised['2330:2026-01']['revisions'][0]['amount_twd'],1000)
    def test_comparison_conflict_retains_original(self):
        h=r.merge({},[self.record()]);b=dict(self.record(),source_field='營業收入-上月營收',amount_twd=2000)
        h=r.merge(h,[b]);self.assertEqual(h['2330:2026-01']['amount_twd'],1000)
        self.assertEqual(len(r.merge(h,[b])['2330:2026-01']['comparison_conflicts']),1)
    def test_parse_no_cumulative_or_announcement_inference(self):
        row={'公司代號':'2330','公司名稱':'台積電','資料年月':'11501','出表日期':'1150217','營業收入-當月營收':'0','營業收入-上月營收':'','營業收入-去年當月營收':'3','累計營業收入-當月累計營收':'9999'}
        records=r.parse([row],{'2330':{'identity':'id'}},'now')
        self.assertEqual([x['period'] for x in records],['2026-01','2025-12','2025-01'])
        self.assertEqual(records[0]['amount_twd'],0);self.assertIsNone(records[1]['amount_twd'])
        self.assertIsNone(records[0]['published_at']);self.assertEqual(records[0]['table_date'],'2026-02-17')
        self.assertFalse(records[2]['identity_verified'])
        for rows in ([],[row,row],[dict(row,資料年月='bad')]):
            with self.assertRaises(ValueError):r.parse(rows,{'2330':{'identity':'id'}},'now')
    def test_failure_preserves_and_initial_empty(self):
        def fail(url):raise OSError('secret must not leak')
        with tempfile.TemporaryDirectory() as d:
            p=Path(d);self.assertEqual(r.run(p,fail,'2026-10-02T00:00:00+00:00'),1)
            data=json.loads((p/'revenue.json').read_text());self.assertEqual(data['profiles'],{})
            data['profiles']={'2330.TW':{'records':[self.record()]}}; (p/'revenue.json').write_text(json.dumps(data))
            (p/'revenue-history.json').write_text('{"old":1}')
            r.run(p,fail,'2026-10-03T00:00:00+00:00')
            self.assertEqual(json.loads((p/'revenue.json').read_text())['profiles'],data['profiles'])
            self.assertEqual((p/'revenue-history.json').read_text(),'{"old":1}')
            self.assertNotIn('secret',(p/'revenue.json').read_text())
    def test_historical_ttm_and_stale(self):
        rows=self.rows('2024-12');h={p:dict(v,code='2330') for p,v in rows.items()}
        p=r.build(h,{'2330':{'name':'name'}},'2026-10-02T00:00:00+00:00',{})['profiles']['2330.TW']
        self.assertTrue(p['stale']);self.assertEqual(p['ttm']['amount_twd'],66)
        self.assertEqual(len(p['missing_months']),20)

if __name__=='__main__':unittest.main()
