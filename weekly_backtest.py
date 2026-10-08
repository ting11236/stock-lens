# -*- coding: utf-8 -*-
"""Forward paper ledger. Inputs must be dated, frozen research reports and verified signals.
No orders are sent. No signal is inferred from prose or retrospectively changed reports.
"""
from __future__ import annotations
import argparse, copy, datetime as dt, json, math, os
from pathlib import Path

def initial_ledger():
    return {'schema_version':1,'strategy_id':'stock-lens-ai-10000-20261012','title':'AI建倉與出場回測','start_date':'2026-10-12','initial_capital':10000.0,'currency':'TWD','mode':'forward_paper','status':'scheduled','cash':10000.0,'holdings':{},'trades':[],'events':[],'pending_signals':[],'daily_snapshots':[],'last_asOf':None,'equity':10000.0,'total_return_pct':None,'realized_pnl':0.0,'unrealized_pnl':None,'elapsed_days':None,'costs':{'fee_rate':0.001425,'minimum_fee':1.0,'sell_tax_rate':0.003,'slippage_rate':0.001},'rules':['從2026-10-12起前瞻模擬，未開始前不虛構報酬；不回填事後看見的訊號。','每週使用當時已發布的封存報告，持股延續，不每週重置10000元。','買訊必須價量與基本面確認；報告買點／批次未成立則不買。賣出須當週明確出場批次，不將續抱／停止加碼當賣出。','訊號確認後下一交易日開盤模擬，買價加0.1%、賣價減0.1%滑價；這是價格代理，非零股真實成交。','整數零股、無槓桿、不放空；計入買賣手續費0.1425%每筆至少1元及賣出證交稅0.3%。費率／最低額為研究假設，不是特定券商報價。','分批比例相對原計畫部位：買進依週報配置與批次；賣出依出場計畫起始股數，不能用逐次縮小的剩餘股數誤算。','若一批預算不足一股、開盤超出允許價區、缺行情、停牌／漲跌停不可成交或未確認則不成交並留下原因。','配息於實際發放日記入現金，拆併股於生效日調整股數與成本；缺官方公司行動資料則暫停該股成交／估值，不把價差誤算收益。','總報酬＝（現金＋持股市值−10000）／10000；未賣持股含買進成本，另列估計全數出場後淨值；現金不計息、股利個人稅不估。'], 'sources':[{'title':'TWSE手續費規則','url':'https://twse-regulation.twse.com.tw/ENG/TW/law/DOC01_print.aspx?FLCODE=FL007304&FLNO=94','published_at':None,'published_at_reason':'頁面未列單一發布日，沿用現行條文','accessed_at':'2026-10-08','data_period':'查閱日現行規則'},{'title':'財政部證券交易稅條例第2條','url':'https://law-out.mof.gov.tw/LawContent.aspx?id=FL006079&kw=b&media=print','published_at':None,'published_at_reason':'沿用查閱日條文，不以查閱日當原發布日','accessed_at':'2026-10-08','data_period':'一般股票賣出；非當沖'}]}

def parse_date(value): return dt.date.fromisoformat(value[:10])
def fee(value,costs):return round(max(costs['minimum_fee'],value*costs['fee_rate']),2)
def reject(ledger, signal, reason):
    ledger['events'].append({'signal_id':signal['signal_id'],'date':signal['signal_date'],'code':signal['code'],'status':'not_filled','reason':reason,'report_update_id':signal['report_update_id']})

def apply_signal(original, report, signal, market):
    """An archived report + independently confirmed evidence are mandatory; fills occur later."""
    ledger=copy.deepcopy(original);sid=signal['signal_id'];done={x.get('signal_id') for x in ledger['trades']+ledger['events']}
    if sid in done:return ledger
    if signal['report_update_id']!=report['update_id']:raise ValueError('report mismatch')
    if parse_date(signal['signal_date'])<parse_date(ledger['start_date']):reject(ledger,signal,'回測尚未開始');return ledger
    if parse_date(signal['published_at'])>parse_date(signal['signal_date']):raise ValueError('lookahead publication')
    if dt.datetime.fromisoformat(signal['published_at'])>dt.datetime.fromisoformat(signal['confirmed_at']):raise ValueError('signal predates publication')
    if parse_date(signal['confirmed_at'])!=parse_date(signal['signal_date']):raise ValueError('confirmation must be known on signal date')
    company=next((x for x in report['companies'] if x['code']==signal['code']),None)
    if company is None:raise ValueError('stock not in archived report')
    side=signal['side'];section='building_plan' if side=='buy' else 'exit_plan' if side=='sell' else None
    if section is None:raise ValueError('side')
    tranches=company.get(section,{}).get('tranches',[]);idx=signal['tranche_index']
    if idx<0 or idx>=len(tranches):raise ValueError('no explicit archived tranche')
    tranche=tranches[idx];pct=tranche['target_pct'];key=f'{report["update_id"]}:{signal["code"]}:{side}:{idx}'
    if any(t['plan_tranche_id']==key for t in ledger['trades']):reject(ledger,signal,'本週該批已成交，不重複');return ledger
    evidence=signal.get('evidence',[])
    if not evidence or any(not v.get('source_url') or parse_date(v['asOf'])>parse_date(signal['signal_date']) for v in evidence):raise ValueError('dated evidence missing or lookahead')
    if not signal.get('confirmed') or (side=='buy' and not (signal.get('technical_confirmed') and signal.get('fundamental_confirmed'))):reject(ledger,signal,'價量／基本面或出場條件未確認');return ledger
    bars=sorted([x for x in market if x['code']==signal['code'] and x['date']>signal['signal_date']],key=lambda x:x['date'])
    ledger['pending_signals']=[p for p in ledger.get('pending_signals',[]) if p['signal_id']!=sid]
    if not bars:
        ledger['pending_signals'].append({'signal_id':sid,'code':signal['code'],'signal_date':signal['signal_date'],'report_update_id':signal['report_update_id'],'reason':'訊號已確認，等待下一交易日官方價與成交能力；尚未成交'})
        return ledger
    bar=bars[0]
    if not bar.get('tradable',False) or not bar.get('corporate_actions_verified',False) or not bar.get('source_url'):reject(ledger,signal,'下一日成交能力或公司行動未確認');return ledger
    price=round(bar['open']*(1+ledger['costs']['slippage_rate']*(1 if side=='buy' else -1)),4)
    if price<=0:raise ValueError('invalid price')
    if side=='buy' and (signal.get('max_entry_price') is None or price>signal['max_entry_price']):reject(ledger,signal,'開盤滑價超出已確認進場價上限');return ledger
    holding=ledger['holdings'].get(signal['code'],{'code':signal['code'],'name':company['name'],'shares':0,'cost':0.0,'first_entry_date':bar['date']})
    fractional=ledger.get('share_mode')=='fractional_research'
    minimum_shares=0.000001 if fractional else 1
    if side=='buy':
        allocation=report['portfolio']['base_weights'].get(signal['code'],0)
        target=ledger['equity']*allocation/100
        held_value=holding.get('market_value',holding['cost'])
        budget=min(ledger['cash'],target*pct/100,max(0,target-held_value))
        if fractional:
            available=min(budget-ledger['costs']['minimum_fee'],budget/(1+ledger['costs']['fee_rate']))
            shares=max(0,math.floor(available/price*1000000)/1000000)
            while shares>0 and round(shares*price,2)+fee(round(shares*price,2),ledger['costs'])>budget:
                shares=round(shares-0.000001,6)
        else:
            shares=math.floor(budget/price)
            while shares>0 and shares*price+fee(shares*price,ledger['costs'])>budget:shares-=1
        if shares<minimum_shares:reject(ledger,signal,'該批預算不足支付費用或最小模擬股數' if fractional else '該批預算不足一股含手續費，保留現金');return ledger
        gross=round(shares*price,2);commission=fee(gross,ledger['costs']);tax=0.0;cost=gross+commission;pnl=0.0;ledger['cash']=round(ledger['cash']-cost,2);holding['first_entry_date']=bar['date'] if holding['shares']==0 else holding['first_entry_date'];holding['shares']=round(holding['shares']+shares,6);holding['cost']=round(holding['cost']+cost,2)
    else:
        if holding['shares']<=0:reject(ledger,signal,'無持股可出場');return ledger
        plan=f'{report["update_id"]}:{signal["code"]}:sell'
        plans=ledger.setdefault('exit_plan_bases',{});base=plans.setdefault(plan,holding['shares'])
        shares=min(holding['shares'],math.floor(base*pct/100*1000000)/1000000 if fractional else math.floor(base*pct/100))
        if pct==100 or (idx==len(tranches)-1 and sum(t['target_pct'] for t in tranches)==100) or sum(t['shares'] for t in ledger['trades'] if t.get('exit_plan_id')==plan)+shares>=base:shares=holding['shares']
        if shares<minimum_shares:reject(ledger,signal,'該批低於最小模擬股數，等待後續明確出場批次');return ledger
        gross=round(shares*price,2);commission=fee(gross,ledger['costs']);tax=round(gross*ledger['costs']['sell_tax_rate'],2);cost=round(holding['cost']*shares/holding['shares'],2);pnl=round(gross-commission-tax-cost,2);holding['cost']=round(holding['cost']-cost,2);holding['shares']=round(holding['shares']-shares,6);ledger['cash']=round(ledger['cash']+gross-commission-tax,2);ledger['realized_pnl']=round(ledger['realized_pnl']+pnl,2)
    ledger['holdings'][signal['code']]=holding
    trade={'signal_id':sid,'plan_tranche_id':key,'report_update_id':report['update_id'],'report_published_at':signal['published_at'],'signal_date':signal['signal_date'],'confirmed_at':signal['confirmed_at'],'date':bar['date'],'code':signal['code'],'name':company['name'],'side':side,'share_mode':ledger.get('share_mode','integer_odd_lot'),'tranche_index':idx,'tranche_pct':pct,'condition':tranche['condition'],'shares':shares,'price':price,'gross_amount':gross,'fee':commission,'tax':tax,'realized_pnl':pnl,'days_since_start':(parse_date(bar['date'])-parse_date(ledger['start_date'])).days,'holding_days':(parse_date(bar['date'])-parse_date(holding['first_entry_date'])).days,'cash_after':ledger['cash'],'evidence':evidence,'price_source':bar['source_url']}
    if side=='sell':trade['exit_plan_id']=plan
    ledger['trades'].append(trade);ledger['status']='running';return ledger

def mark_to_market(original, asof, quotes):
    ledger=copy.deepcopy(original)
    if parse_date(asof)<parse_date(ledger['start_date']):return ledger
    value=0.0;unrealized=0.0;exit_cost=0.0
    for code,h in ledger['holdings'].items():
        if h['shares']==0:continue
        q=quotes.get(code)
        if not q or q['date']!=asof or not q.get('corporate_actions_verified') or not q.get('source_url'):
            ledger.update(status='valuation_pending',total_return_pct=None,unrealized_pnl=None);return ledger
        mv=round(h['shares']*q['close'],2);h.update(last_price=q['close'],priceAsOf=asof,market_value=mv,holding_days=(parse_date(asof)-parse_date(h['first_entry_date'])).days,unrealized_pnl=round(mv-h['cost'],2));value+=mv;unrealized+=mv-h['cost'];exit_cost+=fee(mv,ledger['costs'])+round(mv*ledger['costs']['sell_tax_rate'],2)
    equity=round(ledger['cash']+value,2);ledger.update(status='running',last_asOf=asof,equity=equity,total_return_pct=round((equity/ledger['initial_capital']-1)*100,4),unrealized_pnl=round(unrealized,2),estimated_liquidation_equity=round(equity-exit_cost,2),elapsed_days=(parse_date(asof)-parse_date(ledger['start_date'])).days)
    snapshot={k:ledger[k] for k in ['equity','cash','total_return_pct','realized_pnl','unrealized_pnl','elapsed_days']};snapshot['date']=asof;snapshot['stock_market_value']=round(value,2)
    ledger['daily_snapshots']=[s for s in ledger['daily_snapshots'] if s['date']!=asof]+[snapshot];ledger['daily_snapshots'].sort(key=lambda s:s['date']);return ledger

def apply_company_action(original, action):
    ledger=copy.deepcopy(original)
    if any(x.get('action_id')==action['action_id'] for x in ledger['events']):return ledger
    if not action.get('source_url') or not action.get('verified'):raise ValueError('unverified company action')
    h=ledger['holdings'].get(action['code'])
    if not h or h['shares']==0:return ledger
    if action['kind']=='cash_dividend':
        if action.get('entitlement_shares') is None:raise ValueError('record-date entitlement missing')
        cash=round(action['entitlement_shares']*action['cash_per_share'],2);ledger['cash']=round(ledger['cash']+cash,2)
    elif action['kind']=='split':
        shares=h['shares']*action['factor']
        if ledger.get('share_mode')=='fractional_research':shares=round(shares,6)
        elif shares!=int(shares):raise ValueError('fractional share cash settlement must be verified')
        h['shares']=shares if ledger.get('share_mode')=='fractional_research' else int(shares);h.pop('last_price',None);h.pop('market_value',None);cash=0
    else:raise ValueError('unsupported corporate action')
    ledger['events'].append(dict(action_id=action['action_id'],date=action['effective_date'],code=action['code'],status='company_action',cash_amount=cash,reason=action['kind'],source_url=action['source_url']));return ledger

def save(path,ledger):
    tmp=path.with_suffix(path.suffix+'.tmp');tmp.write_text(json.dumps(ledger,ensure_ascii=False,indent=2)+'\n');os.replace(tmp,path)

def main():
    p=argparse.ArgumentParser();p.add_argument('--ledger',type=Path,default=Path('site/data/weekly-backtest.json'));p.add_argument('--report',type=Path);p.add_argument('--signals',type=Path);p.add_argument('--market',type=Path);p.add_argument('--as-of');p.add_argument('--corporate-actions',type=Path);a=p.parse_args();ledger=json.loads(a.ledger.read_text()) if a.ledger.exists() else initial_ledger()
    if a.signals:
        if not(a.report and a.market):p.error('signals require archived report and official market')
        report=json.loads(a.report.read_text());market=json.loads(a.market.read_text())
        for signal in sorted(json.loads(a.signals.read_text()),key=lambda x:(x['signal_date'],x['signal_id'])):ledger=apply_signal(ledger,report,signal,market)
    if a.corporate_actions:
        for action in json.loads(a.corporate_actions.read_text()):ledger=apply_company_action(ledger,action)
    if a.as_of:
        if not a.market:p.error('valuation requires official market')
        quotes={q['code']:q for q in json.loads(a.market.read_text()) if q['date']==a.as_of};ledger=mark_to_market(ledger,a.as_of,quotes)
    save(a.ledger,ledger)
if __name__=='__main__':main()
