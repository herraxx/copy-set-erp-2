import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import APP
import random, json, re, sys
from playwright.sync_api import sync_playwright
random.seed(int(sys.argv[1]) if len(sys.argv)>1 else 7)
ITER=int(sys.argv[2]) if len(sys.argv)>2 else 50
issues=[]
def issue(it, msg):
    issues.append(f"[{it}] {msg}")
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1300,"height":900}); pg.set_default_timeout(6000)
    errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
    pg.on("dialog", lambda d: d.accept())
    pg.goto(APP); pg.wait_for_timeout(300)
    E=lambda js: pg.evaluate(js)
    N=lambda v: pg.click(f"#snav [data-nav={v}]")
    def confirm():
        pg.wait_for_selector("#confdlg[open]", timeout=3000); pg.click("#confyes")
    def cur(): return E("route")
    def rec(kind, id): return E(f"clone(S.{kind}['{id}'])")
    def check_totals(r, it):
        t=E(f"totals(S.{'offers' if r['kind']=='offer' else 'orders'}['{r['id']}'])")
        items=sum(float(str(i['qty']).replace(',','.') or 0)*float(str(i['price']).replace(',','.') or 0) for i in r['items'])
        if abs(t['items']-items)>0.01: issue(it, f"{r['no']} items sum mismatch {t['items']} vs {items}")
        if abs(t['total']-(t['net']+t['vat']))>0.011: issue(it, f"{r['no']} total != net+vat")
        exp_vat=round(t['net']*t['vr']/100+1e-9,2)
        if abs(t['vat']-exp_vat)>0.011: issue(it, f"{r['no']} vat calc {t['vat']} vs {exp_vat}")
        for x in r['extras']:
            if not str(x.get('name','')).strip(): issue(it, f"{r['no']} extra without name")
    def open_all_docs(it, label):
        for d in [x.get_attribute("data-doc") for x in pg.locator("main [data-doc]").all()]:
            pg.click(f"main [data-doc={d}]"); pg.wait_for_selector("#docdlg[open]")
            html=pg.inner_html("#docbody")
            if "undefined" in html or "NaN" in html: issue(it, f"{label} doc {d} contains undefined/NaN")
            if 'class="a4"' not in html: issue(it, f"{label} doc {d} missing frame")
            before=E("route.id && (S.orders[route.id]||S.offers[route.id]).status")
            pg.click("#docclose")
            after=E("route.id && (S.orders[route.id]||S.offers[route.id]).status")
            if before!=after: issue(it, f"{label} doc {d} changed status")
    def fill_customer(it, new):
        if not new and E("Object.keys(S.customers).length")>0:
            names=E("Object.values(S.customers).map(c=>c.name)")
            q=random.choice(names)[:4]
            pg.fill("#custq", q); pg.wait_for_timeout(50)
            if pg.locator("[data-pick]").count()==0: issue(it,f"search '{q}' no results"); pg.click("[data-ed=new-cust]"); pg.fill("[data-c=name]", f"Asiakas {it} Oy"); return
            pg.click("[data-pick] >> nth=0")
        else:
            pg.click("[data-ed=new-cust]"); pg.fill("[data-c=name]", f"Asiakas {it} {random.choice(['Oy','Ab','ry','Tmi'])}")
            if random.random()<0.6: pg.fill("[data-c=ytunnus]", f"{random.randint(1000000,9999999)}-{random.randint(0,9)}")
            pg.fill("[data-c=contactName]", random.choice(["Anna","Pekka","Liisa","Juha"])); pg.fill("[data-c=email]", f"a{it}@example.fi")
            if random.random()<0.5: pg.fill("[data-c=billStreet]","Katu "+str(it)); pg.fill("[data-c=billPostcode]","00100"); pg.fill("[data-c=billCity]","Helsinki")
    def fill_items(it):
        prods=E("products().map(p=>p.id)")
        n=random.choice([1,1,1,2,3])
        for k in range(n):
            if k>0: pg.click("[data-ed=add-item]")
            if random.random()<0.85:
                pid=random.choice(prods); pg.select_option(f"[data-ed-change=group][data-n='{k}']", pid)
                pg.fill(f"[data-i='{k}.qty']", str(random.choice([1,5,50,100,250,500,1000,2500,5000])))
                if random.random()<0.6:
                    pg.click(f"[data-ed=toggle-calc][data-n='{k}']")
                    for sel in pg.locator(f"[data-io^='{k}.']").all():
                        opts=sel.locator("option").count(); sel.select_option(str(random.randrange(opts)))
                    if random.random()<0.3: pg.fill(f"[data-ic='{k}.mat']", str(random.randint(0,80)))
                    if random.random()<0.3: pg.fill(f"[data-ic='{k}.margin']", str(random.randint(0,40)))
                    pg.click(f"[data-ed=apply-calc][data-n='{k}']")
                chips=pg.locator(f"[data-ed=add-pex][data-n='{k}']")
                for c in range(chips.count()):
                    if random.random()<0.35: pg.click(f"[data-ed=add-pex][data-n='{k}'][data-k='{c}']")
                if random.random()<0.2: pg.fill(f"[data-i='{k}.qty']", str(random.randint(1,3000)))
            else:
                pg.fill(f"[data-i='{k}.product']", f"Oma tuote {it}-{k}"); pg.fill(f"[data-i='{k}.qty']", str(random.randint(1,500))); pg.fill(f"[data-i='{k}.price']", str(round(random.uniform(0.05,40),2)).replace('.',','))
        if random.random()<0.4:
            pg.click("[data-ed=add-extra]"); i=pg.locator("[data-x$='.name']").count()-1
            pg.fill(f"[data-x='{i}.name']","Kiirelisä"); pg.fill(f"[data-x='{i}.unitPrice']", str(random.randint(10,60)))
    def fill_rest(it, pricing=False):
        pg.fill("[data-f=deadline]", f"2026-{random.randint(10,12)}-{random.randint(10,28)}")
        dm=random.choice(["Nouto","Posti","Lähetti"]); pg.select_option("[data-ed-change=delivery]", dm)
        if dm!="Nouto":
            if pg.locator("[data-ed-change=address]").count() and random.random()<0.5 and pg.locator("[data-ed-change=address] option").count()>1:
                pg.select_option("[data-ed-change=address]","0")
            else:
                pg.fill("[data-f='delivery.street']","Tie "+str(it)); pg.fill("[data-f='delivery.postcode']",f"{random.randint(0,99999):05d}"); pg.fill("[data-f='delivery.city']","Espoo")
            if not pricing: pg.fill("[data-f=deliveryCost]", str(random.choice([0,12,25])))
        if random.random()<0.25 and E("Object.keys(S.suppliers).length")>0:
            pg.select_option("[data-ed-change=production]","Alihankkija"); pg.select_option("[data-f=supplierId]", index=1)
        if pricing: return
        if random.random()<0.15: pg.select_option("[data-f=vatMode]","export")
        if random.random()<0.3: pg.fill("[data-f=discount]", str(random.choice([5,10,15])))
    def save(it, btn):
        pg.click(f"[data-ed={btn}]"); pg.wait_for_timeout(80)
        if pg.locator(".errs").count():
            issue(it, "validation: "+pg.inner_text(".errs").replace("\n"," | ")); return False
        return True
    # seed suppliers
    for nm,sp in [("Sidomo Oy","Sidonta"),("Isokuva Oy","Suurkuva")]:
        N("suppliers"); pg.click("main [data-act=new-supplier]"); pg.fill("[data-se2=name]",nm); pg.fill("[data-se2=specialty]",sp); pg.click("[data-ed=save-supplier]")
    paths=["full","full","full","reject","draft-delete","direct","direct","pricing","pricing","customerpage","edit-midway"]
    for it in range(ITER):
        path=random.choice(paths); newc=random.random()<0.4
        try:
            if path=="pricing":
                N("products"); pid=random.choice(E("products().map(p=>p.id)"))
                pg.click(f".desk [data-prod-calc='{pid}']"); pg.wait_for_selector("#calcdlg[open]")
                pg.fill("#calcdlg [data-calc=qty]", str(random.choice([10,100,500,1000,3000])))
                for sel in pg.locator("#calcdlg [data-copt]").all(): sel.select_option(str(random.randrange(sel.locator("option").count())))
                for c in pg.locator("#calcdlg [data-cex]").all():
                    if random.random()<0.4: c.check()
                if random.random()<0.4: pg.fill("#calcdlg [data-calc=discount]", str(random.choice([5,10])))
                expected=E("calcResult().net")
                pg.click("#calcdlg [data-act=calc-to-offer]"); fill_customer(it,True); fill_rest(it, True)
                if not save(it,"ready"): pg.click("[data-ed=cancel]"); continue
                r=rec("offers", cur()["id"]); got=E(f"totals(S.offers['{r['id']}']).net")
                # delivery cost may be changed in fill_rest; compare w/o it
                if abs(got - expected)>0.06:
                    issue(it, f"pricing->offer net {expected} vs offer {got} (delivery {r['deliveryCost']})")
                check_totals(r,it); open_all_docs(it, r['no']); continue
            if path=="customerpage":
                if not E("Object.keys(S.customers).length"): path="full"
                else:
                    N("customers"); pg.click(".desk tbody tr >> nth=0"); pg.click("main [data-act=cust-offer]")
                    fill_items(it); fill_rest(it)
                    if not save(it,"ready"): pg.click("[data-ed=cancel]"); continue
                    path="full-after-create"
            if path in ("full","reject","draft-delete","edit-midway"):
                pg.click(".actionbar [data-act=new-offer]"); fill_customer(it,newc); fill_items(it); fill_rest(it)
                if path=="draft-delete":
                    if not save(it,"draft"): pg.click("[data-ed=cancel]"); continue
                    no=E("Object.values(S.offers).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0].no")
                    pg.click(f".desk tbody tr:has-text('{no}')"); pg.click("[data-act=delete-offer]"); confirm()
                    if E(f"Object.values(S.offers).some(o=>o.no==='{no}')"): issue(it,"draft not deleted")
                    continue
                if not save(it,"ready"): pg.click("[data-ed=cancel]"); continue
            if path in ("full","reject","edit-midway","full-after-create"):
                oid=cur()["id"]; r=rec("offers",oid); check_totals(r,it); open_all_docs(it,r['no'])
                pg.click("[data-act=send-offer]"); confirm()
                if rec("offers",oid)["status"]!="Lähetetty": issue(it,"send failed")
                pg.click(f"[data-open-offer='{oid}']")
                if path=="edit-midway":
                    pg.click("[data-act=edit-offer]"); pg.fill("[data-i='0.qty']", str(random.randint(1,999))); save(it,"save")
                    if rec("offers",oid)["status"]!="Lähetetty": issue(it,"edit changed status")
                if path=="reject":
                    pg.click("[data-act=reject-offer]"); confirm()
                    if rec("offers",oid)["status"]!="Hylätty": issue(it,"reject failed")
                    pg.click("[data-act=copy-offer]"); pg.fill("[data-f=deadline]","2026-12-01")
                    if save(it,"ready") and rec("offers",cur()["id"])['copiedFrom']!=r['no']: issue(it,"copy lost origin")
                    continue
                pg.click("[data-act=accept-offer]"); pg.wait_for_selector("#choicedlg[open]")
                way=random.choice(["order","order","prod","accept"])
                pg.click("#choicebtns [data-choice='%d']" % {"order":0,"prod":1,"accept":2}[way])
                if rec("offers",oid)["status"]!="Hyväksytty": issue(it,"accept failed")
                if way=="accept":
                    if cur()["view"]!="offer": issue(it,"accept-only navigated away")
                    pg.click("[data-act=create-order]"); confirm()
                if pg.locator("[data-act=create-order]").count(): issue(it,"create-order still visible")
                id=cur()["id"]
                if cur()["view"]!="order": issue(it,"not on order view after accept "+way)
                if way=="prod":
                    if rec("orders",id)["status"]!="Tuotannossa": issue(it,"accept+prod did not start production")
                    pg.click("[data-act=finish-prod]"); confirm(); pg.click("[data-act=to-invoice]"); confirm(); pg.click("[data-act=approve-invoice]"); confirm()
                    if rec("orders",id)["status"]!="Laskutettu": issue(it,"prod path not invoiced")
                    continue
                o=rec("orders",id)
                if o['offerId']!=oid: issue(it,"order not linked")
                if len(o['items'])!=len(r['items']): issue(it,"items not copied")
                if E(f"Object.values(S.orders).filter(x=>x.offerId==='{oid}').length")!=1: issue(it,"duplicate orders from offer")
            if path=="direct":
                pg.click(".actionbar [data-act=new-order]"); fill_customer(it,newc); fill_items(it); fill_rest(it)
                if not save(it,"save"): pg.click("[data-ed=cancel]"); continue
                id=cur()["id"]
            o=rec("orders",id); check_totals(o,it); open_all_docs(it,o['no'])
            if random.random()<0.15:
                pg.click("[data-act=delete-order]"); confirm()
                if rec("orders",id): issue(it,"order not deleted")
                if o.get('offerId') and E(f"S.offers['{o['offerId']}'].orderId"): issue(it,"offer still linked after delete")
                continue
            pg.click("[data-act=start-prod]"); confirm()
            pg.fill("[data-wof=prodNotes]", f"Muistiinpano {it}")
            for st in random.sample(["Aloitettu","Käynnissä","Valmis"], k=2): pg.click(f"[data-stage='{st}']")
            if rec("orders",id)['prodNotes']!=f"Muistiinpano {it}": issue(it,"prodNotes lost on stage change")
            open_all_docs(it,o['no'])
            pg.click("[data-act=finish-prod]"); confirm()
            pg.click("main [data-doc=receipt]"); pg.select_option("#paym", random.choice(["Käteinen","Kortti","MobilePay"])); pg.click("#docclose")
            if rec("orders",id)['status']!="Valmis": issue(it,"receipt changed status")
            open_all_docs(it,o['no'])
            pg.click("[data-act=to-invoice]"); confirm()
            if random.random()<0.2: pg.click("[data-act=back-to-order]"); confirm(); pg.click("[data-act=to-invoice]"); confirm()
            open_all_docs(it,o['no'])
            pg.click("[data-act=approve-invoice]"); confirm()
            o=rec("orders",id)
            if o['status']!="Laskutettu" or not o.get('invoicedAt'): issue(it,"invoice approve failed")
            for bad in ["edit-order","start-prod","finish-prod","approve-invoice","delete-order"]:
                if pg.locator(f"[data-act={bad}]").count(): issue(it,f"archived order shows {bad}")
            open_all_docs(it,o['no'])
            if random.random()<0.3:
                N("archive"); pg.fill("[data-q=archive]", o['customer']['name'][:5]); pg.wait_for_timeout(250)
                if pg.locator(f".desk tbody tr:has-text('{o['no']}')").count()==0: issue(it,"archive search miss")
                pg.click(f".desk tbody tr:has-text('{o['no']}')"); pg.click("[data-act=copy-order]"); pg.fill("[data-f=deadline]","2026-12-15")
                if save(it,"save"):
                    if rec("orders",id)['status']!="Laskutettu": issue(it,"original changed by copy")
        except Exception as ex:
            issue(it, f"{path} EXCEPTION {str(ex).splitlines()[0][:200]}")
            try: pg.goto(APP+"#/dashboard"); pg.wait_for_timeout(200)
            except: pass
    nos=E("[...Object.values(S.offers).map(o=>o.no),...Object.values(S.orders).map(o=>o.no)]")
    if len(nos)!=len(set(nos)): issue("end","duplicate numbers")
    for v in ["dashboard","offers","orders","archive","customers","products","suppliers","marketing","admin"]:
        N(v); h=pg.inner_html("main")
        if "undefined" in h or "NaN" in h: issue("end", f"view {v} has undefined/NaN")
    print("offers",E("Object.keys(S.offers).length"),"orders",E("Object.keys(S.orders).length"),"customers",E("Object.keys(S.customers).length"))
    print("PAGE ERRORS:", errs[:10])
    print("ISSUES:", len(issues)); print("\n".join(issues[:80]))
    b.close()
