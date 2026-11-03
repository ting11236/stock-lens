import copy
import gzip
import json
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch
from announcement_filter import triage,news_events,public_event
import company_calendar as c


def event(title,body='完整公司公告說明'):
    return {'symbol':'5203.TW','name':'訊連','kind':'重大訊息','date':'2026-11-03','end_date':'2026-11-03','time':'120000','description':title,'statement':body,'source':c.NEWS,'cancelled':False}


class AnnouncementImpactTests(unittest.TestCase):
    def test_material_events_have_explicit_research_trigger(self):
        for title in ['本公司部分產品於Apple平台停止提供下載對營運之影響',
                      '公告本公司新藥提出新藥上市申請', '公告BEQIA美國專利訴訟案',
                      '本公司修正財務預測', '公告發生重大資產減損',
                      '公告本公司完成收購並取得控制權', '新廠正式投產']:
            self.assertEqual(triage(event(title))['status'],'material',title)
        # A headline alone is insufficient.
        self.assertEqual(triage(event('新廠正式投產',''))['status'],'review')

    def test_routine_and_uncertain_news_never_reach_public_or_queue(self):
        routine=['每月背書保證餘額','公告董事異動','董事會召開日期',
                 '受邀參加法人說明會','公告變更股票面額，公告期間三個月',
                 '公告庫藏股註銷完成','董事會通過第三季財務報告',
                 '代子公司取得不動產使用權資產','更正資金貸與申報資訊']
        uncertain=['澄清媒體報導新廠正式投產','新產品合作計畫','公告與客戶簽署合作備忘錄','']
        for title in routine:
            self.assertEqual(triage(event(title))['status'],'routine',title)
        for title in uncertain:
            self.assertEqual(triage(event(title))['status'],'review',title)
        events=[event(t) for t in routine+uncertain]
        for i,e in enumerate(events):e['time']=str(i)
        out=c.make_output(events,[{'symbol':'5203.TW','name':'訊連'}],{},date(2026,11,4))
        self.assertEqual(out['events'],[]);self.assertEqual(out['update_queue'],[])

    def test_official_trailing_space_title_and_body_are_preserved(self):
        raw={'公司代號':'5203','公司名稱':'訊連','發言日期':'1151103','發言時間':'120000',
             '主旨 ':'部分產品停止提供下載','說明':'公司原文','事實發生日':'1151024'}
        e=news_events([raw],c.NEWS,c.normalized_date)[0]
        self.assertEqual(e['description'],raw['主旨 ']);self.assertEqual(e['fact_date'],'2026-10-24')
        self.assertEqual(e['raw_announcement'],raw)
        public=public_event(e);self.assertEqual(public['research_impact']['status'],'material')
        self.assertNotIn('raw_announcement',public);self.assertNotIn('statement',public)

    def test_meeting_and_material_queue_survive_and_recent_is_not_fabricated(self):
        material=event('部分產品停止提供下載')
        meeting=dict(material,kind='法說會',date='2026-11-05',end_date='2026-11-05')
        out=c.make_output([material,meeting],[{'symbol':'5203.TW','name':'訊連'}],{},date(2026,11,3))
        self.assertEqual(len(out['events']),2);self.assertEqual(len(out['update_queue']),1)
        self.assertEqual(out['update_queue'][0]['due_date'],'2026-11-03')
        self.assertIsNotNone(out['companies']['5203.TW']['next_conference'])
        self.assertNotIn('recent_summaries',out)
        # The public, body-free copy cannot overwrite the full archived record.
        again=c.make_output([material,public_event(material)],[{'symbol':'5203.TW','name':'訊連'}],{},date(2026,11,4))
        self.assertEqual(len(again['update_queue']),1)

    def test_adopted_exact_announcement_does_not_reenter_pending_queue(self):
        e=event('部分產品停止提供下載')
        profile={'sources':{'original':{'statement':e['statement']}},
                 'transition':{'text':'已更新','sources':['original'],'reviewed_at':'2026-11-04'}}
        out=c.make_output([e],[{'symbol':'5203.TW','name':'訊連'}],{'5203.TW':profile},date(2026,11,4))
        self.assertEqual(len(out['events']),1);self.assertEqual(out['update_queue'],[])
        profile['sources']['original']['statement']='舊版不同公告'
        changed=c.make_output([e],[{'symbol':'5203.TW','name':'訊連'}],{'5203.TW':profile},date(2026,11,4))
        self.assertEqual(len(changed['update_queue']),1)

    def test_run_archives_excluded_raw_announcements_across_repeated_fetches(self):
        raw=[{'公司代號':'5203','公司名稱':'訊連','發言日期':'1151103','發言時間':str(i),
              '主旨 ':title,'說明':'完整公告正文'} for i,title in enumerate(['每月背書保證餘額','部分產品停止提供下載','尚待確認的合作計畫'])]
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);folder=root/'site/data';folder.mkdir(parents=True)
            (folder/'stocks.json').write_text(json.dumps({'stocks':[{'symbol':'5203.TW','name':'訊連'}]}))
            def get(url):
                if url==c.NEWS:return json.dumps(raw).encode()
                if url==c.MEETINGS:raise ValueError('mock failure')
                return '<table><tr><th>法人說明會</th></tr></table>'.encode()
            with patch.object(c,'get',side_effect=get):
                c.run(root,date(2026,11,4));c.run(root,date(2026,11,4))
            public=json.loads((folder/'company-calendar.json').read_text())
            self.assertEqual(len(public['events']),1);self.assertEqual(len(public['update_queue']),1)
            archive=json.loads(gzip.decompress((root/'research/monitoring-tasks/announcement-monitor.json.gz').read_bytes()))
            self.assertEqual(len(archive['events']),3)
            pending=json.loads(gzip.decompress((root/'research/monitoring-tasks/announcement-review.json.gz').read_bytes()))
            self.assertEqual(len(pending['events']),1)
            self.assertEqual(pending['events'][0]['research_impact']['status'],'review')

if __name__=='__main__':unittest.main()
