# -*- coding: utf-8 -*-
import unittest,copy
from weekly_backtest import initial_ledger,apply_signal,mark_to_market,apply_company_action
class PaperTests(unittest.TestCase):
 def setUp(self):
  self.r={'update_id':'2026-W42-v1','portfolio':{'base_weights':{'1234':100}},'companies':[{'code':'1234','name':'測試股','building_plan':{'tranches':[{'target_pct':50,'condition':'確認後第一批'},{'target_pct':50,'condition':'第二次確認'}]},'exit_plan':{'tranches':[{'target_pct':50,'condition':'風險增加先減半'},{'target_pct':50,'condition':'論點失效全部出清'}]}}]}
  self.s={'signal_id':'s1','report_update_id':self.r['update_id'],'code':'1234','side':'buy','signal_date':'2026-10-12','published_at':'2026-10-12T08:00:00+08:00','confirmed_at':'2026-10-12T14:00:00+08:00','tranche_index':0,'confirmed':True,'technical_confirmed':True,'fundamental_confirmed':True,'max_entry_price':110,'evidence':[{'asOf':'2026-10-12','source_url':'https://example.test/confirmed'}]}
  self.m=[{'code':'1234','date':'2026-10-13','open':100,'close':101,'tradable':True,'corporate_actions_verified':True,'source_url':'https://example.test/official'}]
 def test_start_and_missing_confirmation(self):
  l=initial_ledger();self.assertIsNone(l['total_return_pct']);self.s['signal_date']='2026-10-09';self.assertEqual(apply_signal(l,self.r,self.s,self.m)['trades'],[])
  self.s['signal_date']='2026-10-12';self.s['fundamental_confirmed']=False;self.assertEqual(apply_signal(l,self.r,self.s,self.m)['trades'],[])
 def test_fill_next_day_integer_shares_costs_and_dedup(self):
  l=apply_signal(initial_ledger(),self.r,self.s,self.m);t=l['trades'][0];self.assertEqual(t['date'],'2026-10-13');self.assertEqual(t['shares'],49);self.assertLess(l['cash'],10000-49*100);self.assertEqual(apply_signal(l,self.r,self.s,self.m),l)
 def test_no_lookahead_and_no_invented_tranche(self):
  self.s['published_at']='2026-10-13T08:00:00+08:00'
  with self.assertRaises(ValueError):apply_signal(initial_ledger(),self.r,self.s,self.m)
  self.s['published_at']='2026-10-12T08:00:00+08:00';self.s['tranche_index']=5
  with self.assertRaises(ValueError):apply_signal(initial_ledger(),self.r,self.s,self.m)
 def test_wait_when_market_missing_or_price_gap_exceeds_limit(self):
  l=initial_ledger();self.assertEqual(len(apply_signal(l,self.r,self.s,[])['pending_signals']),1);self.s['max_entry_price']=99;self.assertEqual(apply_signal(l,self.r,self.s,self.m)['trades'],[])
 def test_sell_tranches_use_initial_shares_and_final_remainder(self):
  l=apply_signal(initial_ledger(),self.r,self.s,self.m);self.s.update(side='sell',signal_id='s2',signal_date='2026-10-13',confirmed_at='2026-10-13T14:00:00+08:00');self.m[0].update(date='2026-10-14',open=120);l=apply_signal(l,self.r,self.s,self.m);self.assertEqual(l['trades'][-1]['shares'],24);self.assertGreater(l['trades'][-1]['tax'],0)
  self.s.update(signal_id='s3',tranche_index=1,signal_date='2026-10-14',confirmed_at='2026-10-14T14:00:00+08:00');self.m[0]['date']='2026-10-15';l=apply_signal(l,self.r,self.s,self.m);self.assertEqual(l['trades'][-1]['shares'],25);self.assertEqual(l['holdings']['1234']['shares'],0);self.assertGreater(l['realized_pnl'],0)
 def test_valuation_includes_cash_and_never_uses_stale_quote(self):
  l=apply_signal(initial_ledger(),self.r,self.s,self.m);v=mark_to_market(l,'2026-10-13',{'1234':self.m[0]});self.assertAlmostEqual(v['equity'],v['cash']+49*101);self.assertEqual(v['elapsed_days'],1);self.assertIsNone(mark_to_market(l,'2026-10-14',{'1234':self.m[0]})['total_return_pct']);self.assertEqual(mark_to_market(v,'2026-10-13',{'1234':self.m[0]})['daily_snapshots'],v['daily_snapshots'])
 def test_no_holdings_remains_cash_zero_return_after_start(self):
  l=mark_to_market(initial_ledger(),'2026-10-12',{});self.assertEqual(l['total_return_pct'],0);self.assertEqual(l['equity'],10000);self.assertEqual(l['cash'],10000)

 def test_dividend_record_date_shares_split_and_dedup(self):
  l=apply_signal(initial_ledger(),self.r,self.s,self.m);a={'action_id':'div-1','code':'1234','kind':'cash_dividend','verified':True,'source_url':'https://example.test/dividend','effective_date':'2026-10-14','entitlement_shares':49,'cash_per_share':2};v=apply_company_action(l,a);self.assertEqual(v['cash'],l['cash']+98);self.assertEqual(apply_company_action(v,a),v)
  a.update(action_id='split-1',kind='split',factor=2);v=apply_company_action(v,a);self.assertEqual(v['holdings']['1234']['shares'],98);self.assertEqual(v['holdings']['1234']['cost'],l['holdings']['1234']['cost'])
 def test_late_confirmation_cannot_fill_prior_open(self):
  self.s['confirmed_at']='2026-10-13T14:00:00+08:00'
  with self.assertRaises(ValueError):apply_signal(initial_ledger(),self.r,self.s,self.m)
