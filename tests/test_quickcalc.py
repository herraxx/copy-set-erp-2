import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import APP
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1300,"height":900}); pg.set_default_timeout(6000)
    errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
    pg.goto(APP); pg.wait_for_timeout(200)
    print("nav:", [x.inner_text().split("\n")[0] for x in pg.locator("#snav .nav").all()])
    pg.click("#snav [data-nav=products]"); pg.click(".desk tr >> nth=1 >> [data-prod-calc]")
    pg.wait_for_selector("#calcdlg[open]")
    pg.fill("#calcdlg [data-calc=qty]","500"); pg.select_option("#calcdlg [data-copt='1']","3"); pg.check("#calcdlg [data-cex='1']")
    print(pg.inner_text("#calcres").replace("\n"," | "))
    pg.screenshot(path="qc.png")
    pg.click("#calcdlg [data-act=calc-to-offer]")
    print("offer:", pg.inner_text("h1"), pg.input_value("[data-i='0.qty']"), pg.input_value("[data-i='0.price']"), pg.input_value("[data-i='0.material']"), pg.input_value("[data-x='0.name']"))
    pg.evaluate("location.hash='#/pricing'"); pg.wait_for_timeout(150); print("pricing route ->", pg.url.split('#')[1])
    print(errs); b.close()
