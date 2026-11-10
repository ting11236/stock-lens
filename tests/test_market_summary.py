import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from market_summary import SECTORS, parse_market, margin_notes, context_events, render, run

class SummaryTests(unittest.TestCase):
    def sample(self):
        stocks=[{'symbol':str(1000+i)+'.TW','industry':'半導體業','price_date':'2026-11-06'} for i in range(500)]
        fields=['證券代號','成交金額','收盤價','漲跌(+/-)']
        rows=[[str(1000+i),'100','10','-'] for i in range(500)]
        rows.append(['0050','99999999','100','+'])
        payload={'stat':'OK','date':'20261106','tables':[
            {'fields':fields,'data':rows},
            {'fields':['指數','收盤指數','漲跌百分比(%)'],'data':[
                ['發行量加權股價指數','20,000','-4']]+[[s+'類指數','100',str(-i-1)] for i,s in enumerate(SECTORS)]+[['電子類兩倍槓桿指數','100','99']]}
        ]}
        return payload,stocks
    def test_official_turnover_excludes_etfs_and_uses_sector_index(self):
        raw,stocks=self.sample(); result=parse_market(raw,'2026-11-06',stocks)
        self.assertEqual(result['total_turnover'],50000)
        self.assertEqual(result['turnover'][0]['share'],100)
        self.assertEqual(result['breadth']['down'],500)
        self.assertEqual(len(result['sectors']),32)
        self.assertNotIn('電子類兩倍槓桿',str(result['sectors']))
    def test_wrong_date_incomplete_quotes_and_missing_amount_rejected(self):
        raw,stocks=self.sample()
        with self.assertRaises(ValueError):parse_market(raw,'2026-11-05',stocks)
        broken=copy.deepcopy(raw);broken['tables'][0]['data']=broken['tables'][0]['data'][:20]
        with self.assertRaises(ValueError):parse_market(broken,'2026-11-06',stocks)
        raw['tables'][0]['data'][0][1]='--'
        with self.assertRaises(ValueError):parse_market(raw,'2026-11-06',stocks)
    def test_all_down_is_relative_resilience_not_a_rise_and_escapes_news(self):
        raw,stocks=self.sample(); data=parse_market(raw,'2026-11-06',stocks)
        text=render(data,[],[{'title':'<script>','summary':'<b>','date':'2026-11-06','source':'https://example.com'}],'2026-11-09')
        self.assertIn('各產業指數均未上漲；相對抗跌',text)
        self.assertIn('最近交易日收盤',text)
        self.assertIn('市場明顯波動',text)
        self.assertIn('&lt;script&gt;',text)
        self.assertNotIn('<script>',text)
    def test_margin_same_date_and_threshold_lower_bound(self):
        history={'history':[{'date':'2026-11-06','twse':{'ratio':149.99,'lower_bound':True},'tpex':{'ratio':150,'lower_bound':False}}]}
        notes=margin_notes(history,'2026-11-06')
        self.assertEqual(notes[0]['value'],'≥ 149.9%');self.assertTrue(notes[0]['below']);self.assertFalse(notes[1]['below'])
        self.assertEqual(margin_notes(history,'2026-11-05'),[])
    def test_news_requires_review_date_source_and_expiry(self):
        event={'status':'reviewed','date':'2026-11-06','valid_until':'2026-11-09','title':'事件','summary':'已查證','source':'https://example.com'}
        self.assertEqual(len(context_events({'events':[event]},'2026-11-06')),1)
        self.assertEqual(context_events({'events':[event]},'2026-11-10'),[])
        for fields in [{'status':'pending'},{'source':'javascript:alert(1)'},{'valid_until':'2026-12-01'}]:
            self.assertEqual(context_events({'events':[{**event,**fields}]},'2026-11-06'),[])
    def test_outage_keeps_previous_date_and_marks_stale(self):
        raw,stocks=self.sample(); data=parse_market(raw,'2026-11-06',stocks)
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);folder=root/'site/data';folder.mkdir(parents=True)
            (folder/'stocks.json').write_text(json.dumps({'latest_price_date':'2026-11-09','stocks':stocks}))
            (folder/'market-summary.json').write_text(json.dumps({'market':data}))
            with patch('market_summary.get',side_effect=OSError('offline')):run(root)
            result=json.loads((folder/'market-summary.json').read_text())
            self.assertEqual(result['market']['date'],'2026-11-06');self.assertTrue(result['stale'])
            self.assertIn('保留上次有效交易日',(root/'site/market-summary.html').read_text())

if __name__=='__main__': unittest.main()
