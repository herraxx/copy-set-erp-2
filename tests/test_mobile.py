import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import APP
import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1300,"height":900}); pg.set_default_timeout(6000)
    errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
    pg.goto(APP); pg.wait_for_timeout(200)
    # quick data
    pg.click(".actionbar [data-act=new-order]"); pg.click("[data-ed=new-cust]"); pg.fill("[data-c=name]","Mobiili Oy")
    pg.select_option("[data-ed-change=group]","p01"); pg.fill("[data-f=deadline]","2026-11-11"); pg.click("[data-ed=save]")
    oid=pg.evaluate("route.id")
    pg.set_viewport_size({"width":375,"height":800})
    over=[]
    for h in ["#/dashboard","#/offers","#/orders","#/archive","#/customers","#/products","#/suppliers","#/pricing","#/marketing","#/admin",f"#/order/{oid}"]:
        pg.evaluate(f"location.hash='{h}'"); pg.wait_for_timeout(150)
        w=pg.evaluate("document.documentElement.scrollWidth")
        if w>376: over.append((h,w))
    pg.click("main [data-act=edit-order]"); pg.wait_for_timeout(100); w=pg.evaluate("document.documentElement.scrollWidth"); 
    if w>376: over.append(("edit",w))
    pg.screenshot(path="mob_edit.png")
    print("overflow:",over, "errs:",errs); b.close()
