import copy
import json
import tempfile
import unittest
from datetime import date
from pathlib import Path
import build_research as r


def note():
    return {'name': '公司A', 'reviewed_at': '2026-10-02',
            'limitations': ['未提供分部獲利'],
            'sources': {'annual': {'title': '年報', 'publisher': '公司A',
                'url': 'https://example.com/report', 'published_at': None,
                'accessed_at': '2026-10-02'}},
            'business': {'text': '已查核業務', 'period': '2025 年', 'sources': ['annual']}}


class ResearchTests(unittest.TestCase):
    def test_partial_review_dates_do_not_refresh_whole_company(self):
        record = note()
        record['sources']['new'] = {'title': '新公告', 'publisher': '公司A', 'url': 'https://example.com/new', 'published_at': '2026-10-03', 'accessed_at': '2026-10-05'}
        record['developments'] = {'text': '補核發展', 'period': '2025 年', 'sources': ['new'], 'reviewed_at': '2026-10-05'}
        self.assertEqual(r.validate({'1234.TW': record}, date(2026,10,5))['1234.TW']['reviewed_at'], '2026-10-02')
        bad = copy.deepcopy(record)
        del bad['developments']['reviewed_at']
        with self.assertRaises(ValueError): r.validate({'1234.TW': bad}, date(2026,10,5))
        bad = copy.deepcopy(record)
        bad['business']['sources'].append('new')
        with self.assertRaises(ValueError): r.validate({'1234.TW': bad}, date(2026,10,5))
        bad = copy.deepcopy(record)
        bad['developments']['reviewed_at'] = '2099-01-01'
        with self.assertRaises(ValueError): r.validate({'1234.TW': bad}, date(2026,10,5))

    def test_imported_overview_preserves_verified_notes_and_checks_identity(self):
        raw = {'schema_version': 1, 'source': {'filename': 'provided.xlsx'},
               'profiles': {'1234.TW': {'name': '公司A', 'business': '原始業務',
                   'direction': '計畫', 'summary': '財務摘要', 'status': '部分待核',
                   'source_reviewed_at': '2026-10-03', 'urls': ['https://example.com'],
                   'events': [], 'outlooks': []}}}
        stocks = [{'symbol': '1234.TW', 'name': '公司A'}]
        payload = r.build(stocks, {'1234.TW': note()}, overview=raw)
        self.assertEqual(payload['profiles']['1234.TW']['business'], note()['business'])
        self.assertEqual(payload['profiles']['1234.TW']['reviewed_at'], '2026-10-02')
        self.assertEqual(payload['coverage']['overview'], 1)
        self.assertEqual(r.build(stocks, {}, overview=raw)['profiles']['1234.TW']['status'], 'overview')
        self.assertEqual(r.build([{'symbol': '1234.TW', 'name': '新公司'}], {}, overview=raw)['coverage']['overview'], 0)
        raw['profiles']['1234.TW']['events'] = [{'urls': ['javascript:alert(1)']}]
        with self.assertRaises(ValueError): r.build(stocks, {}, overview=raw)

    def test_all_market_without_fabricating_missing_content(self):
        payload = r.build([{'symbol': '1234.TW', 'name': '公司A'},
                           {'symbol': '5678.TW', 'name': '公司B'}], {'1234.TW': note()})
        self.assertEqual(payload['coverage'], {'total': 2, 'researched': 1, 'pending': 1})
        missing = payload['profiles']['5678.TW']
        self.assertIsNone(missing['reviewed_at'])
        self.assertNotIn('business', missing)

    def test_names_must_match_before_reusing_research(self):
        payload = r.build([{'symbol': '1234.TW', 'name': '新名稱'}], {'1234.TW': note()})
        self.assertEqual(payload['profiles']['1234.TW']['status'], 'pending')

    def test_dates_sources_and_urls_are_required(self):
        for modify in [
            lambda n: n.update(reviewed_at='2099-01-01'),
            lambda n: n['business'].update(sources=['missing']),
            lambda n: n['business'].update(period=''),
            lambda n: n['sources']['annual'].update(url='javascript:alert(1)'),
            lambda n: n['sources']['annual'].update(url='https://user:password@example.com'),
            lambda n: n['sources']['annual'].update(published_at='2026-10-03'),
        ]:
            n = note(); modify(n)
            with self.assertRaises(ValueError): r.validate({'1234.TW': n}, date(2026, 10, 2))

    def test_idempotence_and_invalid_input_preserves_published_file(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d); (root/'site/data').mkdir(parents=True); (root/'research').mkdir()
            (root/'site/data/stocks.json').write_text(json.dumps({'stocks':[{'symbol':'1234.TW','name':'公司A'}]}))
            source = root/'research/companies.json'
            source.write_text(json.dumps({'1234.TW':note()}))
            r.run(root); target = root/'site/data/company-research.json'
            before = target.read_bytes(); stamp = target.stat().st_mtime_ns
            r.run(root)
            self.assertEqual(target.stat().st_mtime_ns, stamp)
            bad = note(); bad['business']['sources'] = ['missing']
            source.write_text(json.dumps({'1234.TW':bad}))
            with self.assertRaises(ValueError): r.run(root)
            self.assertEqual(target.read_bytes(), before)


if __name__ == '__main__': unittest.main()
