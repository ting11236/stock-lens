"""Conservative research-impact triage; exchange 'major' is not an impact verdict."""
import re

POLICY = 'research-impact-v1'
ROUTINE = (
    r'背書保證|資金貸與|保證餘額|貸與餘額',
    r'董事.{0,8}(異動|辭任|解任|逝世|改選)|監察人.{0,8}(異動|辭任)|委員.{0,8}異動|發言人.{0,8}異動|經理.{0,8}異動|執行長.{0,8}異動',
    r'召開.{0,8}董事會|董事會.{0,12}(召開|日期|通知)|財務報告.{0,12}(提報|決議日期)',
    r'(受邀|召開|舉辦|參加).{0,25}(法人說明會|法說會)|股東.{0,5}會.{0,15}(日期|通知|議程)|股東會.{0,8}重要決議',
    r'名稱.{0,8}(變更|更名)|更名|面額.{0,25}變更|公告期間',
    r'庫藏股|買回.{0,8}股份|除權|除息|股利.{0,8}(基準日|發放|分派)|現金增資.{0,12}(收足|基準日|認股繳款)',
    r'每月營收|[0-9一二三四五六七八九十]+月.{0,10}(合併營收|營業收入)|自結.{0,8}(合併營收|營業收入)',
    r'董事會通過.{0,25}(財務報告|財報)|處分.{0,15}(基金|有價證券)|取得.{0,15}(基金|使用權資產)',
    r'更正.{0,30}(申報|資訊|附表|明細)|補正.{0,20}(申報|資訊)',
)
MATERIAL = (
    ('財務預測變更', r'(調降|下修|上修|修正|更新|變更).{0,12}(財測|財務預測|獲利預估)|重編.{0,12}(財報|財務報告)'),
    ('重大財務或營運異常', r'債務違約|無法償還|停止支付|跳票|聲請重整|聲請破產|重大.{0,8}(減損|虧損)|勒令停工|產品回收|停止.{0,15}(提供下載|銷售|生產)|廠.{0,10}(火災|爆炸)'),
    ('控制權或主要資產變動', r'取得控制權|喪失控制權|終止.{0,12}(收購|合併)|完成.{0,15}(收購|合併)|股份轉換|合併契約|處分.{0,12}(子公司|主要廠房)|出售.{0,12}(子公司|主要廠房)'),
    ('產品審查或重要訴訟', r'專利.{0,8}訴訟|新藥.{0,25}(上市申請|查驗登記|核准)|新適應症.{0,25}(申請|核准)|三期.{0,10}(完成|試驗結果)|第三期.{0,12}(完成|試驗結果)'),
    ('重要產能或商用進度', r'新廠.{0,20}(正式投產|量產|商轉)|正式.{0,8}(商轉|量產)|董事會通過.{0,15}(新建廠|興建新廠)|重大.{0,8}(擴產|訂單)|取得.{0,12}主要客戶.{0,12}訂單'),
)


def triage(event):
    title = ' '.join(str(event.get('description') or '').split())
    body = str(event.get('statement') or '')
    result = {'policy': POLICY, 'status': 'review', 'reason': '缺少可判定實質影響的完整公告，留內部待判'}
    if not title:
        return result
    # A clarification or a conditional denial requires actual review, even when
    # the headline contains a material-sounding word.
    if re.search(r'澄清|媒體報導|傳聞|疑似|未發生|並無|無新增', title):
        return dict(result, reason='澄清或未確認內容，留內部待判')
    if body:
        for label, pattern in MATERIAL:
            if re.search(pattern, title):
                return dict(result, status='material', reason=label)
    if any(re.search(pattern, title) for pattern in ROUTINE):
        return dict(result, status='routine', reason='例行公告或重複通知，不觸發研究摘要更新')
    return dict(result, reason='影響程度尚未確認，留內部待判')


def news_events(rows, source, normalize_date):
    events = []
    for raw in rows:
        # TWSE currently uses a trailing space in the official 主旨 key.
        row = {str(k).strip(): v for k, v in raw.items()}
        code = str(row.get('公司代號', '')).strip()
        day = normalize_date(row.get('發言日期'))
        if not re.fullmatch(r'\d{4}', code) or not day:
            continue
        events.append({'symbol': code+'.TW', 'name': row.get('公司名稱', code),
                       'kind': '重大訊息', 'date': day, 'end_date': day,
                       'time': str(row.get('發言時間', '')).strip(),
                       'fact_date': normalize_date(row.get('事實發生日')),
                       'description': str(row.get('主旨') or '').strip(),
                       'statement': str(row.get('說明') or '').strip(),
                       'raw_announcement': raw, 'source': source, 'cancelled': False})
    return events


def public_event(event):
    if event.get('kind') != '重大訊息':
        return dict(event)
    impact = triage(event)
    if impact['status'] != 'material':
        return None
    return {**{k:v for k,v in event.items() if k not in ('raw_announcement', 'statement')},
            'research_impact': impact}


def adopted_events(profiles, source, normalize_date):
    """Recover previously read official text without inventing missing API data."""
    events=[]
    for symbol, profile in profiles.items():
        for source_id, item in profile.get('sources',{}).items():
            if item.get('url')!=source or not item.get('statement') or not normalize_date(item.get('published_at')):
                continue
            events.extend(news_events([{'公司代號':symbol[:-3], '公司名稱':profile['name'],
                                        '發言日期':item['published_at'], '主旨':item['title'],
                                        '說明':item['statement']}],source,normalize_date))
            events[-1]['evidence_origin']='adopted_company_research_source'
            events[-1]['research_source_id']=source_id
    return events


def already_researched(event, profile):
    body=' '.join(str(event.get('statement') or '').split())
    if not body:return False
    for source_id, item in profile.get('sources',{}).items():
        if body!=' '.join(str(item.get('statement') or '').split()):continue
        for name in ('business','earnings','developments','transition'):
            section=profile.get(name) or {}
            if source_id in section.get('sources',[]) and (section.get('reviewed_at') or profile.get('reviewed_at') or '')>=event['date']:
                return True
    return False
