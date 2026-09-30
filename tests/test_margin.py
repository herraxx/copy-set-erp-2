import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import APP
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1300,"height":900}); pg.set_default_timeout(6000)
    errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
    pg.goto(APP); pg.wait_for_timeout(300)
    E=pg.evaluate
    def offer(name, pid, qty):
        pg.click(".actionbar [data-act=new-offer]"); pg.click("[data-ed=new-cust]"); pg.fill("[data-c=name]",name)
        pg.select_option("[data-ed-change=group]",pid); pg.fill("[data-i='0.qty']",str(qty)); pg.fill("[data-f=deadline]","2026-12-01"); pg.click("[data-ed=ready]")
        pg.click("[data-act=send-offer]"); pg.click("#confyes"); return E("Object.values(S.offers).sort((a,b)=>b.no.localeCompare(a.no))[0].id")
    ids=[offer("A Oy","p01",500), offer("B Oy","p06",2), offer("C Oy","p02",1000), offer("D Oy","p03",200)]
    # accept 2 (one with order), reject 1, keep 1 open
    pg.click(f".desk tr[data-open-offer='{ids[0]}']"); pg.click("[data-act=accept-offer]"); pg.click("#choicebtns [data-choice='0']"); oid=E("route.id")
    pg.click("#snav [data-nav=offers]"); pg.click(f".desk tr[data-open-offer='{ids[1]}']"); pg.click("[data-act=accept-offer]"); pg.click("#choicebtns [data-choice='2']")
    pg.click("#snav [data-nav=offers]"); pg.click(f".desk tr[data-open-offer='{ids[2]}']"); pg.click("[data-act=reject-offer]"); pg.click("#confyes")
    hr=E("hitRate(Object.values(S.offers))"); print("hit:", round(hr["pct"],1), hr["won"], hr["lost"], hr["open"], round(hr["valuePct"],1))
    # margin estimate for order
    m=E(f"marginOf(S.orders['{oid}'])"); t=E(f"totals(S.orders['{oid}'])")
    exp_cost=round(t["items"]*45/100,2); print("est:", m["cost"], exp_cost, m["margin"], round(m["pct"],1), m["actual"])
    pg.goto(APP+"#/order/"+oid); pg.wait_for_timeout(300)
    pg.fill("[data-cost=material]","20"); pg.fill("[data-cost=hours]","0,5"); pg.click("[data-act=save-costs]")
    m=E(f"marginOf(S.orders['{oid}'])"); print("actual:", m["cost"], m["margin"], round(m["pct"],1), m["actual"], "expected cost", 20+0.5*45)
    print("panel:", pg.inner_text("#costs").split("\n")[1:6])
    pg.click("#snav [data-nav=dashboard]"); pg.click("[data-period='Vuosi']")
    print("kpis:", [x.inner_text().replace("\n"," / ") for x in pg.locator(".kpi").all()][-2:])
    print("cust table rows:", pg.locator("h2:has-text('asiakkaittain') + div tbody tr").count(), "| jobs:", pg.locator("h2:has-text('Kate töittäin') + div tbody tr").count())
    pg.screenshot(path="kate.png", full_page=True)
    pg.click("#snav [data-nav=orders]"); print("orders row:", pg.inner_text(".desk tbody tr").replace("\t"," | "))
    pg.click("#snav [data-nav=customers]"); pg.click(".desk tbody tr >> nth=0"); print("cust kpis:", [x.inner_text().replace("\n"," / ") for x in pg.locator(".kpi").all()][-2:])
    pg.click("#snav [data-nav=admin]"); pg.fill("[data-pl='p01.costPct']","60"); pg.click("[data-act=save-pricelist]"); print("costPct saved:", E("S.products.p01.costPct"))
    pg.fill("[data-se=hourlyCost]","50"); pg.click("[data-act=save-admin]"); print("hourly:", E("S.settings.hourlyCost"), E(f"marginOf(S.orders['{oid}']).cost"))
    print(errs); b.close()
