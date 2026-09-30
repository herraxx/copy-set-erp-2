"""Runs dist/ inside a simulated Hailer host: storage in a workflow, remote updates, admin rights, setup screen, backup import."""
import os, sys, shutil, tempfile, threading, http.server, functools, json
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tmp = tempfile.mkdtemp()
shutil.copytree(os.path.join(ROOT, "dist"), os.path.join(tmp, "dist"))
shutil.copy(os.path.join(ROOT, "tests", "hailer-sim", "mock-boot.js"), os.path.join(tmp, "dist", "hailer-boot.js"))
shutil.copy(os.path.join(ROOT, "tests", "hailer-sim", "host.html"), os.path.join(tmp, "host.html"))
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=tmp))
threading.Thread(target=srv.serve_forever, daemon=True).start()
HOST = f"http://127.0.0.1:{srv.server_address[1]}/host.html"
backup = open(os.path.join(ROOT, "data", "copyset-erp-backup.json"), encoding="utf-8").read()
fails = []
def check(cond, msg):
    print(("OK   " if cond else "FAIL ") + msg); cond or fails.append(msg)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width":1300, "height":900}); pg.set_default_timeout(8000)
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    reload_app = lambda: (pg.evaluate("document.getElementById('app').contentWindow.location.reload()"), pg.wait_for_timeout(1500))
    pg.goto(HOST); pg.wait_for_timeout(1500); f = pg.frame_locator("#app")
    check(f.locator("#storeinfo").inner_text() == "Tiedot tallentuvat Haileriin", "Hailer-tallennus käytössä")
    check(pg.evaluate("__hailer.acts.filter(a=>a.name.startsWith('products/')).length") == 20, "20 tuotetta luotu Haileriin")
    f.locator("#snav [data-nav=admin]").click()
    pg.frame(url=lambda u: "dist/index.html" in u).evaluate("v => { const t = document.getElementById('importbox'); t.value = v; }", backup)
    f.locator("[data-act=import-data]").click(); f.locator("#confyes").click(); pg.wait_for_timeout(2500)
    d = json.loads(backup)
    for k in ["customers", "offers", "orders", "suppliers"]:
        check(pg.evaluate(f"__hailer.acts.filter(a=>a.name.startsWith('{k}/')).length") == len(d[k]), f"varmuuskopio: {k} {len(d[k])}")
    check(pg.evaluate("JSON.parse(__hailer.acts.find(a=>a.name==='meta/settings').fields.f1).theme.tones.O") == d["settings"]["theme"]["tones"]["O"], "asetukset ja värit tuotu")
    reload_app(); f = pg.frame_locator("#app")
    f.locator("#snav [data-nav=archive]").click()
    check(f.locator(".desk tbody tr").count() == sum(1 for o in d["orders"].values() if o["status"] == "Laskutettu"), "arkisto uudelleenlatauksen jälkeen")
    pg.evaluate("""(()=>{const a=__hailer.acts.find(a=>a.name.startsWith('customers/')); const x=JSON.parse(a.fields.f1); x.name='Etämuutos Oy'; a.fields.f1=JSON.stringify(x); __hailer.emit('activity.update',[a._id],'wf1');})()""")
    pg.wait_for_timeout(500); f.locator("#snav [data-nav=customers]").click()
    check("Etämuutos Oy" in f.locator(".desk tbody").inner_text(), "toisen käyttäjän muutos näkyy heti")
    pg.evaluate("__hailer.admin=false"); reload_app(); f = pg.frame_locator("#app")
    check(f.locator("#snav [data-nav=admin]").count() == 0, "ei-ylläpitäjä ei näe Ylläpitoa")
    pg.evaluate("__hailer.workflows=[]"); reload_app()
    check("Hailer-asennus puuttuu" in pg.frame_locator("#app").locator("main").inner_text(), "asennusohje näkyy, jos työnkulku puuttuu")
    check(not errs, "ei JavaScript-virheitä " + str(errs[:3]))
    b.close()
srv.shutdown(); shutil.rmtree(tmp, ignore_errors=True)
sys.exit(1 if fails else 0)
