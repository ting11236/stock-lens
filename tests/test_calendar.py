import unittest
from datetime import date
from company_calendar import normalized_date,conference_events,shareholder_events,make_output
class CalendarTests(unittest.TestCase):
    def test_roc_dates_and_invalid_dates(self):
        self.assertEqual(normalized_date('1151015'),'2026-10-15')
        self.assertEqual(normalized_date('115/10/15'),'2026-10-15')
        self.assertIsNone(normalized_date('115/02/30'))
    def test_conference_range_uses_explicit_sessions_without_inventing_days(self):
        text='<table><tr><th>法人說明會</th></tr><tr><td>2330</td><td>台積電</td><td>115/10/01 至 115/10/15</td><td>14:00</td><td>線上</td><td>2026/10/1及2026/10/15法說</td></tr></table>'
        rows=conference_events(text,'https://example.com');self.assertEqual([r['date'] for r in rows],['2026-10-01','2026-10-15'])
        rows=conference_events(text.replace('2026/10/1及2026/10/15法說','多日場次'),'https://example.com');self.assertEqual(len(rows),1);self.assertEqual(rows[0]['end_date'],'2026-10-15')
    def test_cancelled_and_same_day_reviews_do_not_silently_clear_past_events(self):
        stocks=[{'symbol':'2330.TW','name':'台積電'}];events=[{'symbol':'2330.TW','name':'台積電','kind':'法說會','date':'2026-10-03','end_date':'2026-10-03','source':'https://example.com'},{'symbol':'2330.TW','kind':'法說會','date':'2026-10-15','end_date':'2026-10-15','cancelled':True}]
        p=make_output(events,stocks,{'2330.TW':{'reviewed_at':'2026-10-03'}},date(2026,10,4));self.assertEqual(len(p['update_queue']),1);self.assertEqual(p['update_queue'][0]['due_date'],'2026-10-04');self.assertIsNone(p['companies']['2330.TW']['next_conference'])
        p=make_output(events,stocks,{'2330.TW':{'reviewed_at':'2026-10-04'}},date(2026,10,4));self.assertEqual(p['update_queue'],[])
    def test_finance_changes_queue_until_research_reviewed(self):
        s={'symbol':'2330.TW','name':'台積電','field_meta':{'revenue_growth':{'date':'2026-08'}}};p=make_output([], [s],{},date(2026,10,4));self.assertEqual(p['update_queue'],[])
        s['field_meta']['revenue_growth']['date']='2026-09';new=make_output([],[s],{},date(2026,10,5),p);self.assertEqual(len(new['update_queue']),1)
        same=make_output([],[s],{},date(2026,10,6),new);self.assertEqual(same['update_queue'][0]['due_date'],'2026-10-05')
        reviewed=make_output([],[s],{'2330.TW':{'reviewed_at':'2026-10-06'}},date(2026,10,6),new);self.assertEqual(reviewed['update_queue'],[])
    def test_shareholder_date_comes_from_meeting_not_transfer_or_announcement(self):
        r={'公司代號':'1101','公司名稱':'台泥','股東常(臨時)會日期-常或臨時':'臨時會','股東常(臨時)會日期-日期':'1151013','公告日期':'1150813','停止過戶起訖日期-起':'1150914'}
        self.assertEqual(shareholder_events([r])[0]['date'],'2026-10-13')
