import json,unittest
from unittest.mock import patch
import update_snapshot as u
class DailyPriceTests(unittest.TestCase):
    def sample(self):
        return {'stat':'OK','date':'20261117','tables':[{'fields':['證券代號','收盤價'],'data':[['2330','2,170.00']]+[[str(1000+i),'10'] for i in range(500)]+[['9999','--']]}]}
    def test_direct_daily_closes_and_exact_trade_date(self):
        with patch('update_snapshot.get',return_value=json.dumps(self.sample()).encode()) as get:
            name,rows,error=u.fetch_source('prices')
        self.assertIsNone(error);self.assertEqual(rows[0]['Date'],'20261117');self.assertEqual(u.number(rows[0]['ClosingPrice']),2170)
        self.assertEqual(get.call_args.args[0],u.PRICE_URL);self.assertIsNone(u.number(rows[-1]['ClosingPrice']))
    def test_failed_or_changed_source_is_rejected(self):
        for x in [{'stat':'error'},{'stat':'OK','date':'20261117','tables':[]},{'stat':'OK','date':'bad','tables':[]}]:
            with self.assertRaises(ValueError):u.daily_prices(x)
        x=self.sample();x['tables'][0]['data'].append(['2330','1'])
        with self.assertRaises(ValueError):u.validate('prices',u.daily_prices(x))
    def test_field_provenance_points_to_daily_feed(self):
        from test_snapshot import feeds
        f=feeds();f['prices']=[{'Code':'2330','Date':'20261117','ClosingPrice':'2170'}]
        s=u.build_rows(f,{},'now')[0]
        self.assertEqual(s['price_date'],'2026-11-17');self.assertEqual(s['field_meta']['price']['source'],u.PRICE_URL)
