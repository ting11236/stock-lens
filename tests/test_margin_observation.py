
import copy,json,tempfile,unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch
from margin_observation import calculate,combine,parse_margin,parse_prices,ratio_text,run,panel

class MarginTests(unittest.TestCase):
    def sample(self,market):
        fields=["代號","名稱","買進","賣出","現金償還","前日餘額","今日餘額"] if market=="twse" else ["代號","名稱","前資餘額(張)","資買","資賣","現償","資餘額"]
        rows=[[str(1000+i),"公司",0,0,0,0,0] for i in range(100)]
        rows[0][0]="0050";rows[0][6]=2;rows[1][6]=1
        details={"fields":fields,"data":rows}
        if market=="twse":
            return {"stat":"OK","date":"20261106","tables":[{"title":"115年11月06日 信用交易統計","data":[["融資金額(仟元)",0,0,0,0,"100"],["融資(交易單位)",0,0,0,0,"3"]]},details]}
        details["summary"]=[["","融資金(仟元)",0,0,0,0,"100"],["","合計(張)",0,0,0,0,"3"]]
        return {"stat":"ok","date":"20261106","tables":[details]}
    def test_units_etfs_and_market_parsers(self):
        for market in ("twse","tpex"):
            margin=parse_margin(self.sample(market),"2026-11-06",market)
            result=calculate(margin,{"0050":50,"1001":20})
            self.assertEqual(result["collateral_twd"],120000)
            self.assertEqual(result["financing_twd"],100000)
            self.assertEqual(result["ratio"],120)
            self.assertFalse(result["lower_bound"])
            self.assertEqual(result["lot_coverage_pct"],100)
    def test_combined_ratio_is_not_average_of_percentages(self):
        a=calculate({"lots":{"A":1},"financing_twd":10000,"total_lots":1},{"A":20})
        b=calculate({"lots":{"B":1},"financing_twd":90000,"total_lots":1},{"B":100})
        self.assertAlmostEqual(combine(a,b)["ratio"],120)
        self.assertNotAlmostEqual(combine(a,b)["ratio"],(a["ratio"]+b["ratio"])/2)
        self.assertIsNone(combine(a,None))
    def test_missing_price_is_lower_bound_and_rounds_down(self):
        m=parse_margin(self.sample("twse"),"2026-11-06","twse")
        r=calculate(m,{"0050":50.049,"1001":None})
        self.assertTrue(r["lower_bound"]);self.assertEqual(r["missing_symbols"],["1001"])
        self.assertEqual(ratio_text(r),"≥ 100.0%")
        self.assertAlmostEqual(r["lot_coverage_pct"],200/3)
        with self.assertRaises(ValueError):calculate(m,{})
    def test_wrong_date_bad_units_and_duplicate_data_rejected(self):
        x=self.sample("twse");self.assertIsNone(parse_margin(x,"2026-11-05","twse"))
        x["tables"][0]["data"][1][5]="4"
        with self.assertRaises(ValueError):parse_margin(x,"2026-11-06","twse")
        x=self.sample("tpex");x["tables"][0]["data"][1][0]="0050"
        with self.assertRaises(ValueError):parse_margin(x,"2026-11-06","tpex")
        x=self.sample("twse");x["tables"][0]["data"][0][0]="融資金額(元)"
        with self.assertRaises(ValueError):parse_margin(x,"2026-11-06","twse")
    def test_prices_require_same_date_and_keep_unavailable_absent(self):
        x={"stat":"ok","date":"20261106","tables":[{"fields":["代號","收盤"],"data":[[str(i),"10"] for i in range(100)]}]}
        x["tables"][0]["data"][0][1]="---"
        self.assertIsNone(parse_prices(x,"2026-11-05","tpex"))
        r=parse_prices(x,"2026-11-06","tpex");self.assertIsNone(r["0"]);self.assertEqual(r["1"],10)
    def test_source_failure_preserves_history_and_shows_warning(self):
        r=calculate({"lots":{"A":1},"financing_twd":10000,"total_lots":1},{"A":20})
        old={"history":[{"date":"2026-11-06","twse":r,"tpex":r,"combined":combine(r,r)}]}
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/"site/data").mkdir(parents=True)
            (root/"site/data/margin-history.json").write_text(json.dumps(old))
            with patch("margin_observation.get",side_effect=OSError("offline")),patch("margin_observation.time.sleep"):
                run(root,days=1,today=date(2026,11,6))
            new=json.loads((root/"site/data/margin-history.json").read_text())
            self.assertEqual(new["history"],old["history"])
            self.assertEqual(len(new["errors"]),4)
            self.assertIn("保留已取得資料",(root/"site/margin-panel.html").read_text())

