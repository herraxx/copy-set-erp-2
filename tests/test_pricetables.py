import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import APP
import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1300,"height":900}); pg.set_default_timeout(6000)
    errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
    pg.goto(APP); pg.wait_for_timeout(200)
    pg.click(".actionbar [data-act=new-offer]")
    pg.select_option("[data-ed-change=group]","p01")
    print("KK default:", pg.input_value("[data-i='0.qty']"), pg.input_value("[data-i='0.price']"), "|", pg.inner_text("[data-hint='0']"))
    pg.fill("[data-i='0.qty']","250"); print("250:", pg.input_value("[data-i='0.price']"), pg.inner_text("[data-hint='0']"))
    pg.fill("[data-i='0.qty']","1000"); print("1000:", pg.input_value("[data-i='0.price']"))
    pg.fill("[data-i='0.qty']","8000"); print("8000:", pg.input_value("[data-i='0.price']"))
    pg.fill("[data-i='0.qty']","50"); print("50 (min):", pg.input_value("[data-i='0.price']"))
    pg.fill("[data-i='0.qty']","500")
    pg.click("[data-ed=toggle-calc]"); pg.select_option("[data-io='0.2']","1"); print("4+0 500:", pg.input_value("[data-i='0.price']"))
    pg.fill("[data-ic='0.margin']","10"); print("margin10:", pg.input_value("[data-i='0.price']"))
    pg.click("[data-ed=add-pex][data-k='1']"); print("extras:", pg.input_value("[data-xline='0']"))
    pg.fill("[data-i='0.price']","0,2"); print("manual:", pg.inner_text("[data-hint='0']"))
    pg.click("[data-ed=use-suggest]"); print("back to suggest:", pg.input_value("[data-i='0.price']"))
    pg.click("[data-ed=add-item]"); pg.select_option("[data-ed-change=group][data-n='1']","p06"); print("rollup:", pg.input_value("[data-i='1.qty']"), pg.input_value("[data-i='1.price']"))
    pg.fill("[data-i='1.qty']","2"); print("rollup 2:", pg.input_value("[data-i='1.price']"))
    pg.click("[data-ed=toggle-calc][data-n='1']"); pg.select_option("[data-io='1.0']","2"); print("rollup 120x200 x2:", pg.input_value("[data-i='1.price']"))
    pg.screenshot(path="pt1.png", full_page=True)
    # pricing page
    pg.click("[data-ed=cancel]"); pg.click("#snav [data-nav=products]")
    for pid in ["p02","p07","p18","p19"]:
        pg.click(f".desk [data-prod-calc='{pid}']"); pg.wait_for_selector("#calcdlg[open]"); r=pg.evaluate("calcResult()"); print(pid, pg.input_value("#calcdlg [data-calc=qty]"), r["pc"]["total"], r["net"]); pg.click("#qcclose")
    # admin table edit
    pg.click("#snav [data-nav=admin]"); pg.fill("[data-plt='p01.0.price']","55"); pg.click("[data-act=save-pricelist]")
    print("saved:", pg.evaluate("S.products.p01.prices[0]"), pg.evaluate("S.products.p01.baseCost"))
    pg.click("#snav [data-nav=products]"); pg.click("tr >> nth=1 >> [data-prod-edit]"); pg.click("[data-ed=add-pp]"); pg.fill("[data-pp='8.qty']","10000"); pg.fill("[data-pp='8.price']","800"); pg.click("[data-ed=save-product]")
    print("rows:", len(pg.evaluate("S.products.p01.prices")))
    print(errs); b.close()
