import copy
import json
import tempfile
import unittest
from pathlib import Path
import update_snapshot as u


def feeds():
    return {
        'companies':[{'公司代號':'2330','公司名稱':'台積電','公司簡稱':'台積電','產業別':'24','出表日期':'1151001','已發行普通股數或TDR原股發行股數':'1000'}],
        'prices':[{'Code':'2330','Date':'1150930','ClosingPrice':'100.5'}],
        'ratios':[{'Code':'2330','Date':'1150929','PEratio':'20','PBratio':'3','DividendYield':'1.2'}],
        'revenue':[{'公司代號':'2330','資料年月':'11508','營業收入-去年同月增減(%)':'30','產業別':'半導體業'}],
        'eps':[{'公司代號':'2330','年度':'115','季別':'2','基本每股盈餘(元)':'5'}],
        'margins':[{'公司代號':'2330','年度':'115','季別':'2','毛利率(%)(營業毛利)/(營業收入)':'60'}],
        'income':[{'公司代號':'2330','年度':'115','季別':'2','基本每股盈餘（元）':'5','營業收入':'100','淨利（淨損）歸屬於母公司業主':'20'}],
        'balance':[{'公司代號':'2330','年度':'115','季別':'2','歸屬於母公司業主之權益合計':'110'}],
    }

class SnapshotTests(unittest.TestCase):
    def test_numbers_and_dates(self):
        for raw in ('','--','N/A','NaN','inf',None):self.assertIsNone(u.number(raw))
        self.assertEqual(u.number('1,250.50'),1250.5)
        self.assertEqual(u.day('1150930'),'2026-09-30')
        self.assertEqual(u.day('2026/09/30'),'2026-09-30')
        self.assertIsNone(u.day('1150230'))
    def test_join_preserves_distinct_dates_and_missing(self):
        f=feeds();f['companies'].append({'公司代號':'9999','公司名稱':'缺資料','產業別':'20'})
        rows=u.build_rows(f,{},'download-time')
        s=rows[0];self.assertEqual(s['price_date'],'2026-09-30');self.assertEqual(s['ratio_date'],'2026-09-29')
        self.assertEqual(s['eps'],5);self.assertEqual(s['field_meta']['eps']['date'],'2026-Q2')
        self.assertIsNone(s['ps']);self.assertIsNone(s['peg']);self.assertEqual(len(rows),2)
        self.assertIsNone(rows[1]['price']);self.assertIsNotNone(rows[1]['field_meta']['price']['reason'])
    def test_company_universe_excludes_warrants(self):
        f=feeds();f['prices'].append({'Code':'123456','Date':'1150930','ClosingPrice':'2'})
        self.assertEqual(len(u.build_rows(f,{},'now')),1)
    def test_ttm_derived_metrics_units_and_periods(self):
        h={'2330':{'2024-Q2':{'eps':2},'2024-Q4':{'eps':5},'2025-Q2':{'eps':3,'revenue':60,'net_income':10,'equity':90},'2025-Q4':{'eps':6,'revenue':150,'net_income':25}}}
        s=u.build_rows(feeds(),h,'now')[0]
        self.assertEqual(s['trailing_eps'],8)
        self.assertAlmostEqual(s['earnings_growth'],100/3)
        self.assertAlmostEqual(s['ps'],100.5*1000/(190*1000))
        self.assertEqual(s['roe'],35)
        self.assertAlmostEqual(s['peg'],(100.5/8)/(100/3))
        self.assertEqual(s['pe'],20)  # official PE remains intact
    def test_peg_rejects_loss_tiny_or_extreme_growth(self):
        for eps,prior in [(0,2),(-1,2),(2,0),(2,-1),(2,2),(2.001,2),(20,1),(1,2)]:self.assertIsNone(u.historical_peg(20,eps,prior)[0])
    def test_classification(self):
        cases=[({'industry':'金融保險','eps':-1},'重資產股'),({'industry':'鋼鐵工業','eps':-1},'週期股'),({'industry':'生技醫療','eps':-1},'虧損企業'),({'industry':'半導體業','eps':5,'revenue_growth':25},'高成長股'),({'industry':'食品','eps':5},'穩定獲利股')]
        for s,category in cases:self.assertEqual(u.classify(s),category)
    def test_empty_invalid_source_rejected(self):
        for value in ([],{},None):
            with self.assertRaises(ValueError):u.validate('prices',value)
    def test_failed_source_preserves_field_date(self):
        f=feeds();previous={'stocks':u.build_rows(f,{},'first')};f.pop('margins')
        rows=u.preserve_fields(u.build_rows(f,{},'second'),previous,{'margins':'failed'},'second')
        self.assertEqual(rows[0]['gross_margin'],60);self.assertEqual(rows[0]['field_meta']['gross_margin']['downloaded_at'],'first');self.assertIn('stale_reason',rows[0]['field_meta']['gross_margin'])
    def test_no_trade_keeps_last_close_and_actual_date(self):
        f=feeds();previous={'stocks':u.build_rows(f,{},'first')}
        f['prices'][0].update(Date='1151001',ClosingPrice='--')
        s=u.preserve_fields(u.build_rows(f,{},'second'),previous,{},'second')[0]
        self.assertEqual(s['price'],100.5)
        self.assertEqual(s['price_date'],'2026-09-30')
        self.assertIn('未提供有效收盤價',s['field_meta']['price']['stale_reason'])
    def test_update_idempotent_and_failure_preserves_bytes(self):
        f=feeds()
        def loader(n):return n,copy.deepcopy(f[n]),None
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)
            self.assertEqual(u.run(path,loader,'2026-10-01T10:20:00+00:00'),0)
            before={p.name:p.read_bytes() for p in path.iterdir()}
            self.assertEqual(u.run(path,loader,'2026-10-01T11:20:00+00:00'),0)
            self.assertEqual(before,{p.name:p.read_bytes() for p in path.iterdir()})
            self.assertEqual(u.run(path,lambda n:(n,None,'failed'),'2026-10-02T10:20:00+00:00'),1)
            self.assertEqual(before['stocks.json'],(path/'stocks.json').read_bytes())
            self.assertEqual(before['stocks.csv'],(path/'stocks.csv').read_bytes())
            self.assertEqual(json.loads((path/'status.json').read_text())['state'],'failed')
    def test_first_run_failure_and_csv_escaping(self):
        with tempfile.TemporaryDirectory() as directory:
            p=Path(directory);u.run(p,lambda n:(n,None,'failed'),'now')
            self.assertEqual(json.loads((p/'stocks.json').read_text())['stocks'],[])
        self.assertIn("'=SUM",u.csv_text([{'symbol':'2330.TW','name':'=SUM(1,2)'}]))

if __name__=='__main__':unittest.main()
