
"""Official TWSE/TPEx margin collateral estimates; price gaps produce lower bounds."""
import argparse,hashlib,html,json,math,time
from concurrent.futures import ThreadPoolExecutor
from datetime import date,datetime,timedelta,timezone
from pathlib import Path
from update_snapshot import get,read_json,dump,write_changed

ROOT=Path(__file__).resolve().parent
TZ=timezone(timedelta(hours=8))
MARKETS={"twse":"上市","tpex":"上櫃","combined":"上市＋上櫃"}
def number(v):
    try:
        n=float(str(v).strip().replace(",",""))
        return n if math.isfinite(n) else None
    except (ValueError,TypeError):return None

def urls(day):
    compact=day.replace("-","");slash=day.replace("-","/")
    return {
      "twse_margin":f"https://www.twse.com.tw/exchangeReport/MI_MARGN?response=json&date={compact}&selectType=ALL",
      "twse_prices":f"https://www.twse.com.tw/exchangeReport/MI_INDEX?response=json&date={compact}&type=ALLBUT0999",
      "tpex_margin":f"https://www.tpex.org.tw/www/zh-tw/margin/balance?date={slash}&response=json",
      "tpex_prices":f"https://www.tpex.org.tw/www/zh-tw/afterTrading/dailyQuotes?date={slash}&response=json"
    }

def valid_day(payload,day):
    return str(payload.get("stat","")).lower()=="ok" and payload.get("date")==day.replace("-","")

def parse_margin(payload,day,market):
    if not valid_day(payload,day):return None
    if not any(t.get('data') for t in payload.get('tables',[])):return None
    if market=="twse":
        t=next((t for t in payload.get("tables",[]) if (t.get("fields") or [])[:7]==["代號","名稱","買進","賣出","現金償還","前日餘額","今日餘額"]),None)
        summary=next((t for t in payload.get("tables",[]) if "信用交易統計" in t.get("title","")),None)
        if not t or not summary:raise ValueError("上市融資欄位改變")
        debtrow=next((r for r in summary["data"] if r[0]=="融資金額(仟元)"),None)
        lotsrow=next((r for r in summary["data"] if r[0]=="融資(交易單位)"),None)
        debt=number(debtrow[5]) if debtrow else None
        total=number(lotsrow[5]) if lotsrow else None
    else:
        t=next((t for t in payload.get("tables",[]) if (t.get("fields") or [])[:7]==["代號","名稱","前資餘額(張)","資買","資賣","現償","資餘額"]),None)
        if not t:raise ValueError("上櫃融資欄位改變")
        debtrow=next((r for r in t.get("summary",[]) if r[1]=="融資金(仟元)"),None)
        lotsrow=next((r for r in t.get("summary",[]) if r[1]=="合計(張)"),None)
        debt=number(debtrow[6]) if debtrow else None
        total=number(lotsrow[6]) if lotsrow else None
    if not debt or debt<=0 or not total or total<=0:raise ValueError("缺少每日融資金額或張數")
    rows={}
    for row in t["data"]:
        code=str(row[0]).strip();balance=number(row[6])
        if not code or code in rows or balance is None or balance<0:raise ValueError("融資餘額格式或重複代號")
        rows[code]=balance
    if len(rows)<100 or abs(sum(rows.values())-total)>.01:raise ValueError("逐檔融資張數與官方總數不一致")
    return {"lots":rows,"financing_twd":debt*1000,"total_lots":total}

def parse_prices(payload,day,market):
    if not valid_day(payload,day):return None
    if not any(t.get('data') for t in payload.get('tables',[])):return None
    codefield,pricefield=("證券代號","收盤價") if market=="twse" else ("代號","收盤")
    table=next((t for t in payload.get("tables",[]) if codefield in (t.get("fields") or []) and pricefield in t["fields"]),None)
    if not table:raise ValueError("收盤價欄位改變")
    ci,pi=table["fields"].index(codefield),table["fields"].index(pricefield)
    prices={}
    for row in table["data"]:
        code=str(row[ci]).strip()
        if code in prices:raise ValueError("行情重複代號")
        prices[code]=number(row[pi])
    if len(prices)<100:raise ValueError("行情筆數異常")
    return prices

def calculate(margin,prices):
    if margin is None or prices is None:return None
    missing=[];value=0;covered=0;count=0
    for code,lots in margin["lots"].items():
        if lots<=0:continue
        count+=1;p=prices.get(code)
        if p is None or p<=0:missing.append(code);continue
        value+=lots*1000*p;covered+=lots
    if covered<=0:raise ValueError("融資標的無可用收盤價")
    return {"ratio":value/margin["financing_twd"]*100,"collateral_twd":round(value,2),
            "financing_twd":margin["financing_twd"],"total_lots":margin["total_lots"],
            "covered_lots":covered,"lot_coverage_pct":covered/margin["total_lots"]*100,
            "financed_symbols":count,"missing_symbols":missing,"lower_bound":bool(missing)}

def combine(a,b):
    if not a or not b:return None
    debt=a["financing_twd"]+b["financing_twd"];value=a["collateral_twd"]+b["collateral_twd"]
    lots=a["total_lots"]+b["total_lots"];covered=a["covered_lots"]+b["covered_lots"]
    return {"ratio":value/debt*100,"collateral_twd":value,"financing_twd":debt,"total_lots":lots,
            "covered_lots":covered,"lot_coverage_pct":covered/lots*100,
            "financed_symbols":a["financed_symbols"]+b["financed_symbols"],
            "missing_symbols":["上市:"+s for s in a["missing_symbols"]]+["上櫃:"+s for s in b["missing_symbols"]],
            "lower_bound":a["lower_bound"] or b["lower_bound"]}

def ratio_text(row):
    if not row:return "—"
    # Round down a lower bound: rounding up could overstate the bound.
    n=math.floor(row["ratio"]*10)/10 if row["lower_bound"] else round(row["ratio"],1)
    return ("≥ " if row["lower_bound"] else "")+f"{n:,.1f}%"

def chart(rows,key):
    points=[(r["date"],r[key]) for r in rows if r.get(key)]
    if not points:return '<p>這段期間尚無完整資料。</p>'
    vals=[v["ratio"] for _,v in points];low=math.floor((min(vals)-3)/5)*5;high=math.ceil((max(vals)+3)/5)*5
    width,height=820,300;left,right,top,bottom=64,26,24,48
    x=lambda i:left+(width-left-right)*i/max(1,len(points)-1)
    y=lambda v:top+(high-v)/(high-low)*(height-top-bottom)
    pieces=[]
    for j in range(5):
        v=low+(high-low)*j/4;yy=y(v)
        pieces.append(f'<line x1="{left}" y1="{yy:.2f}" x2="{width-right}" y2="{yy:.2f}" stroke="#dce7e1"/><text x="{left-9}" y="{yy+5:.2f}" text-anchor="end">{v:g}%</text>')
    coords=" ".join(f'{x(i):.2f},{y(v["ratio"]):.2f}' for i,(_,v) in enumerate(points))
    pieces.append(f'<polyline points="{coords}" fill="none" stroke="#256d54" stroke-width="3"/>')
    for i,(d,v) in enumerate(points):
        pieces.append(f'<circle cx="{x(i):.2f}" cy="{y(v["ratio"]):.2f}" r="3.2" fill="#256d54"><title>{d}：{ratio_text(v)}</title></circle>')
    for i in sorted({0,len(points)//2,len(points)-1}):
        pieces.append(f'<text x="{x(i):.2f}" y="{height-15}" text-anchor="middle">{points[i][0][5:]}</text>')
    label=f'{MARKETS[key]}估算融資維持率，{points[0][0]}至{points[-1][0]}，{len(points)}個交易日'
    return f'<svg class="margin-chart" viewBox="0 0 {width} {height}" role="img" aria-label="{html.escape(label)}"><title>{html.escape(label)}</title>'+''.join(pieces)+'</svg>'

def panel(data):
    rows=data.get("history",[]);latest=rows[-1] if rows else None
    if not latest:return '<section class="margin-panel"><p>融資資料暫時無法取得，請稍後再試。</p></section>'
    e=html.escape;latestday=date.fromisoformat(latest["date"])
    cards=''.join(f'<button type="button" class="margin-number button" data-margin-market="{key}" aria-pressed="{str(key=="combined").lower()}"><span>{name}</span><strong>{ratio_text(latest.get(key))}</strong><small>融資金額 {latest[key]["financing_twd"]/1e8:,.2f} 億元</small></button>' if latest.get(key) else f'<div>{name}暫缺同日資料</div>' for key,name in [("combined",MARKETS["combined"]),("twse",MARKETS["twse"]),("tpex",MARKETS["tpex"])])
    views=[]
    for key in MARKETS:
        for period,n in [("30",30),("90",90)]:
            subset=[r for r in rows if r["date"]>=(latestday-timedelta(days=n)).isoformat()]
            views.append(f'<template data-margin-chart="{key}-{period}"><h3>{MARKETS[key]}走勢</h3>{chart(subset,key)}<p class="margin-note">實際收錄 {len([r for r in subset if r.get(key)])} 個交易日；未取得資料的日期留空。</p></template>')
    table=''.join('<tr><th scope="row">'+r["date"]+'</th>'+''.join('<td>'+ratio_text(r.get(k))+'</td>' for k in ("combined","twse","tpex"))+'</tr>' for r in reversed(rows))
    missing=''.join(f'<p>{name}：'+('缺當日收盤價 '+str(len(latest[key]["missing_symbols"]))+' 檔；可計價標的占融資張數 '+f'{latest[key]["lot_coverage_pct"]:.2f}%'+('。代號：'+e('、'.join(latest[key]["missing_symbols"]))) if latest[key]["lower_bound"] else '當日有融資餘額的標的均取得收盤價。')+'</p>' for key,name in MARKETS.items() if key!="combined" and latest.get(key))
    warning='<p class="margin-status">部分日期或來源未更新成功，保留已取得資料；請以標示日期為準。</p>' if data.get("errors") else ''
    return '<section class="margin-panel"><p>資料日期：<b>'+latest["date"]+'</b> · 每個交易日收盤後更新</p>'+warning+'<p class="margin-lead">觀察融資買進的股票，目前市值能覆蓋多少借款。<u>數字下降，代表市值相對借款的緩衝變薄。</u></p><div class="margin-cards">'+cards+'</div><p class="margin-bound"><b>≥ 表示估算下限：</b>部分標的缺當日收盤價，未計入市值；全部標的的比率可能更高。</p><div class="margin-periods" role="group" aria-label="融資圖表期間"><button class="button" type="button" data-margin-period="30" aria-pressed="false">近一個月</button><button class="button" type="button" data-margin-period="90" aria-pressed="true">近三個月</button></div><div data-margin-chart-host></div>'+''.join(views)+'<details class="margin-details"><summary>每天的數值</summary><div class="margin-table-wrap"><table><thead><tr><th>資料日期</th><th>合計</th><th>上市</th><th>上櫃</th></tr></thead><tbody>'+table+'</tbody></table></div></details><details class="margin-details"><summary>這個數字怎麼算、怎麼看？</summary><p>估算融資維持率＝各標的「收盤價 × 融資餘額張數 × 1,000股」加總 ÷ 官方融資金額餘額 × 100%。包含股票及可融資ETF等標的。</p><p>合計以兩市場的市值與借款金額分別加總後計算。這是市場總量的估算，個人帳戶的維持率請看券商提供的數字。</p><p>例如200%可理解為：目前計入的股票市值，約為融資借款的2倍。數字要搭配大盤走勢及融資金額變化觀察。</p>'+missing+'<p>採官方當日融資餘額；交易所後續調整時，本站會重新計算最近數日。</p><p>資料來源：<a href="https://www.twse.com.tw/zh/trading/margin/mi-margn.html" target="_blank" rel="noopener noreferrer">證交所融資融券餘額 ↗</a>、<a href="https://www.tpex.org.tw/zh-tw/mainboard/trading/margin-trading/transactions.html" target="_blank" rel="noopener noreferrer">櫃買中心融資融券餘額 ↗</a>；收盤價採兩市場每日行情。</p></details></section>'

def run(root=ROOT,days=10,cache=None,today=None):
    today=today or datetime.now(TZ).date()
    folder=root/"site/data";previous=read_json(folder/"margin-history.json",{})
    history={r["date"]:r for r in previous.get("history",[])};errors=[];evidence=[]
    def fetch(item):
        key,url=item
        path=Path(cache)/((hashlib.sha256(url.encode()).hexdigest())+".json") if cache else None
        if path and path.exists():raw=path.read_bytes()
        else:
            raw=get(url)
            if path:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw if isinstance(raw,bytes) else raw.encode())
        return key,json.loads(raw)
    # Inputs must describe the exact requested day; non-trading dates add no point.
    for offset in reversed(range(days)):
        day=(today-timedelta(days=offset)).isoformat()
        if date.fromisoformat(day).weekday()>4:continue
        sources=urls(day);responses={}
        with ThreadPoolExecutor(max_workers=4) as pool:
            futures={pool.submit(fetch,item):item[0] for item in sources.items()}
            for future,key in futures.items():
                try:k,value=future.result();responses[k]=value
                except Exception as ex:errors.append(day+" "+key+" "+type(ex).__name__)
        row={"date":day}
        for market in ("twse","tpex"):
            try:
                m=parse_margin(responses.get(market+"_margin",{}),day,market)
                p=parse_prices(responses.get(market+"_prices",{}),day,market)
                if m is None and p is None:continue
                if m is None or p is None:raise ValueError("同日行情與融資未齊")
                row[market]=calculate(m,p)
            except Exception as ex:errors.append(day+" "+market+" "+type(ex).__name__)
        if row.get("twse") or row.get("tpex"):
            # A source outage never removes a previously valid same-date market.
            old=history.get(day,{})
            for market in ("twse","tpex"):
                if market not in row and old.get(market):row[market]=old[market]
            row["combined"]=combine(row.get("twse"),row.get("tpex"))
            row["sources"]=sources;history[day]=row
        time.sleep(.35)
    cutoff=(today-timedelta(days=400)).isoformat()
    result={"schema_version":1,"method_version":"same-day-collateral-v1","updated_at":datetime.now(TZ).isoformat(timespec="seconds"),
            "history":[history[d] for d in sorted(history) if cutoff<=d<=today.isoformat()],"errors":errors,
            "basis":"各標的當日收盤價×融資張數×1000，除以同日市場融資金額；缺價時為下限，含ETF。"}
    if not result["history"]:raise ValueError("尚無有效融資資料")
    write_changed(folder/"margin-history.json",dump(result))
    write_changed(root/"site/margin-panel.html",panel(result))
    print("融資觀察",len(result["history"]),"日，最新",result["history"][-1]["date"],"來源錯誤",len(errors))

if __name__=="__main__":
    p=argparse.ArgumentParser();p.add_argument("--days",type=int,default=10);p.add_argument("--cache")
    args=p.parse_args();run(days=args.days,cache=args.cache)

