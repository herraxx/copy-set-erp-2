import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import APP
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1300,"height":900}); pg.set_default_timeout(6000)
    errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
    pg.goto(APP); pg.wait_for_timeout(200)
    print("nav:", [x.inner_text().split("\n")[0] for x in pg.locator("#snav .nav").all()])
    # EU customer via register
    pg.click("#snav [data-nav=customers]"); pg.click("main [data-act=new-customer]")
    pg.fill("[data-cu=name]","Svenska Tryck AB"); pg.select_option("[data-cu=country]","Ruotsi"); pg.fill("[data-cu=vatId]","SE556677889901"); pg.click("[data-ed=save-customer]")
    pg.click("main [data-act=cust-offer]"); print("mode from customer page:", pg.input_value("[data-f=vatMode]"))
    # new offer, pick
    pg.click("[data-ed=cancel]")
    pg.click(".actionbar [data-act=new-offer]"); pg.fill("#custq","svenska"); pg.click("[data-pick]")
    print("mode after pick:", pg.input_value("[data-f=vatMode]"))
    pg.select_option("[data-ed-change=group]","p02"); pg.fill("[data-i='0.qty']","1000"); pg.fill("[data-f=deadline]","2026-11-01")
    pg.click("[data-ed=ready]"); print("offer vat:", pg.evaluate("totals(S.offers[route.id])"))
    pg.click("[data-doc=offer]"); h=pg.inner_text("#docbody"); print("doc has AVL 72 a:", "AVL 72 a" in h, "VAT id:", "SE556677889901" in h, "Ruotsi" in h); pg.click("#docclose")
    # EU without VAT id -> validation
    pg.click(".actionbar [data-act=new-offer]"); pg.click("[data-ed=new-cust]"); pg.fill("[data-c=name]","Eesti OÜ"); pg.select_option("[data-ed-change=country]","Viro")
    print("new EU mode:", pg.input_value("[data-f=vatMode]"))
    pg.select_option("[data-ed-change=group]","p01"); pg.fill("[data-f=deadline]","2026-11-01"); pg.click("[data-ed=ready]")
    print("err:", pg.inner_text(".errs").replace("\n"," | ") if pg.locator(".errs").count() else None)
    pg.fill("[data-c=vatId]","EE101234567"); pg.click("[data-ed=ready]"); print("saved:", pg.inner_text("h1"))
    # Norway export
    pg.click(".actionbar [data-act=new-order]"); pg.click("[data-ed=new-cust]"); pg.fill("[data-c=name]","Norsk AS"); pg.select_option("[data-ed-change=country]","Norja")
    print("NO mode:", pg.input_value("[data-f=vatMode]")); pg.select_option("[data-ed-change=group]","p06"); pg.fill("[data-f=deadline]","2026-11-01"); pg.click("[data-ed=save]")
    pg.click("[data-doc=orderconf]"); print("export note:", "AVL 70" in pg.inner_text("#docbody")); pg.click("#docclose")
    # switch back to fi manually
    pg.click("[data-act=edit-order]"); pg.select_option("[data-f=vatMode]","fi"); pg.click("[data-ed=save]"); print("manual fi vat:", pg.evaluate("totals(S.orders[route.id]).vr"))
    # quick calculator
    pg.click("#snav [data-nav=products]"); pg.click(".desk [data-prod-calc='p01']"); pg.select_option("#calcdlg [data-calc=vat]","eu"); print("calc vr:", pg.evaluate("calcResult().vr"))
    pg.click("#calcdlg [data-act=calc-to-offer]"); print("calc->offer mode:", pg.input_value("[data-f=vatMode]"))
    print(errs); b.close()
