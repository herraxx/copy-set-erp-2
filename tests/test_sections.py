import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import APP
import random, json, sys, re
from playwright.sync_api import sync_playwright
random.seed(int(sys.argv[1]) if len(sys.argv)>1 else 3)
ROUNDS=int(sys.argv[2]) if len(sys.argv)>2 else 10
URL=APP
issues=[]
def issue(r,sec,msg): issues.append(f"[kierros {r}] {sec}: {msg}")
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1300,"height":900}); pg.set_default_timeout(6000)
    errs=[]; pg.on("pageerror",lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(300)
    E=lambda js: pg.evaluate(js)
    N=lambda v: pg.click(f"#snav [data-nav={v}]")
    def ok_yes(): pg.wait_for_selector("#confdlg[open]"); pg.click("#confyes")
    def clean(r,sec):
        h=pg.inner_html("main")
        if re.search(r"undefined|NaN|\[object Object\]", pg.inner_text("main")): issue(r,sec,"näkymässä undefined/NaN")
        if E("document.documentElement.scrollWidth")>1301: issue(r,sec,"vaakavieritys")
    def back_check(r,sec,expect):
        pg.go_back(); pg.wait_for_timeout(120)
        if E("route.view")!=expect: issue(r,sec,f"selaimen takaisin -> {E('route.view')} (odotettiin {expect})")
    def docs(r,sec):
        for d in [x.get_attribute("data-doc") for x in pg.locator("main [data-doc]").all()]:
            pg.click(f"main [data-doc={d}]"); pg.wait_for_selector("#docdlg[open]")
            t=pg.inner_text("#docbody")
            if "undefined" in t or "NaN" in t: issue(r,sec,f"dokumentti {d} undefined/NaN")
            pg.click("#docclose")
    def mk_customer(r, i):
        N("customers"); pg.click("main .head [data-act=new-customer]")
        pg.fill("[data-cu=name]", f"Asiakas {r}-{i} Oy"); y=f"{random.randint(1000000,9999999)}-{random.randint(0,9)}"; pg.fill("[data-cu=ytunnus]", y)
        pg.select_option("[data-cu=status]", random.choice(["Aktiivinen","Prospekti","Passiivinen"]))
        pg.fill("[data-cu='contacts.0.name']", f"Yhteys {r}{i}"); pg.fill("[data-cu='contacts.0.email']", f"y{r}{i}@example.fi"); pg.fill("[data-cu='contacts.0.phone']", f"040{r}{i}0000")
        pg.click("[data-ed=add-contact]"); pg.fill("[data-cu='contacts.1.name']", f"Toinen {r}{i}")
        pg.fill("[data-cu='addresses.0.street']", f"Katu {i}"); pg.fill("[data-cu='addresses.0.postcode']", "00100"); pg.fill("[data-cu='addresses.0.city']", "Helsinki")
        pg.fill("[data-cu='billing.street']", f"Laskukatu {i}"); pg.fill("[data-cu='billing.postcode']","00200"); pg.fill("[data-cu='billing.city']","Espoo")
        pg.fill("[data-cu=discount]", str(random.choice([0,5,10])))
        pg.click("[data-ed=save-customer]")
        if E("route.view")!="customer": issue(r,"Asiakkaat","tallennus ei avannut asiakasta: "+(pg.inner_text(".errs") if pg.locator(".errs").count() else "")); pg.click("[data-ed=cancel]"); return None,y
        return E("route.id"), y
    def mk_offer(r, cname=None, send=False):
        pg.click(".actionbar [data-act=new-offer]")
        if cname: pg.fill("#custq", cname); pg.wait_for_timeout(60); pg.click("[data-pick] >> nth=0")
        else: pg.click("[data-ed=new-cust]"); pg.fill("[data-c=name]", f"Pika {r} Oy")
        pg.select_option("[data-ed-change=group]", random.choice(E("products().map(p=>p.id)")))
        pg.fill("[data-f=deadline]","2026-12-01"); pg.click("[data-ed=ready]")
        if pg.locator(".errs").count(): issue(r,"Tarjoukset","validointi: "+pg.inner_text(".errs")); pg.click("[data-ed=cancel]"); return None
        oid=E("route.id")
        if send: pg.click("[data-act=send-offer]"); ok_yes()
        return oid
    for r in range(1, ROUNDS+1):
        # ---------------- Asiakkaat ----------------
        sec="Asiakkaat"
        cid,y=mk_customer(r,1)
        if cid:
            c=E(f"S.customers['{cid}']")
            if len(c["contacts"])!=2: issue(r,sec,"toinen yhteyshenkilö puuttuu")
            clean(r,sec)
            N("customers"); pg.click("main .head [data-act=new-customer]"); pg.fill("[data-cu=name]","Tupla Oy"); pg.fill("[data-cu=ytunnus]",y); pg.click("[data-ed=save-customer]")
            if not pg.locator(".errs").count() or "Y-tunnus" not in pg.inner_text(".errs"): issue(r,sec,"tupla-Y-tunnus ei estynyt")
            pg.click("[data-ed=cancel]")
            N("customers")
            for q in [c["name"], y, c["contacts"][0]["name"], c["contacts"][0]["email"], c["contacts"][0]["phone"]]:
                pg.fill("[data-q=customers]", q); pg.wait_for_timeout(260)
                if pg.locator(f".desk tbody tr[data-open-customer='{cid}']").count()==0: issue(r,sec,f"haku '{q}' ei löytänyt")
            pg.fill("[data-q=customers]",""); pg.wait_for_timeout(260)
            for st in ["Aktiivinen","Prospekti","Passiivinen","Kaikki"]:
                pg.click(f"[data-filter='{st}']")
                rows=pg.locator(".desk tbody tr").count(); exp=E(f"Object.values(S.customers).filter(c=>'{st}'==='Kaikki'||c.status==='{st}').length")
                if exp and rows!=exp: issue(r,sec,f"suodatin {st}: {rows} vs {exp}")
            pg.click(f".desk tbody tr[data-open-customer='{cid}']"); clean(r,sec)
            pg.click("main [data-act=edit-customer]"); pg.fill("[data-cu=name]", c["name"]+" (m)"); pg.click("[data-ed=save-customer]")
            if not E(f"S.customers['{cid}'].name.endsWith('(m)')"): issue(r,sec,"muokkaus ei tallentunut")
            pg.click("main [data-act=cust-offer]")
            if E("editing && editing.rec.customerId")!=cid: issue(r,sec,"uusi tarjous asiakkaalta ei esitäyttänyt asiakasta")
            pg.click("[data-ed=cancel]")
            pg.click("main [data-act=cust-order]")
            if E("editing && editing.kind")!="order": issue(r,sec,"uusi tilaus asiakkaalta ei avautunut")
            pg.click("[data-ed=cancel]")
            back_check(r,sec,"customers")
        # ---------------- Alihankkijat ----------------
        sec="Alihankkijat"
        N("suppliers"); pg.click("main .head [data-act=new-supplier]")
        spec=random.choice(["Sidonta","Suurkuva","Folio","Tarrat"])
        pg.fill("[data-se2=name]", f"Alihankkija {r} Oy"); pg.fill("[data-se2=specialty]", spec); pg.fill("[data-se2=contact]","Matti"); pg.fill("[data-se2=leadTime]","3 pv"); pg.click("[data-ed=save-supplier]")
        sid=E("route.id"); clean(r,sec)
        N("suppliers"); pg.fill("[data-q=suppliers]", f"Alihankkija {r}"); pg.wait_for_timeout(260)
        if pg.locator(f".desk tr[data-open-supplier='{sid}']").count()==0: issue(r,sec,"haku ei löytänyt")
        pg.fill("[data-q=suppliers]",""); pg.wait_for_timeout(260)
        pg.click(f"[data-supq='{spec}']")
        if pg.locator(f".desk tr[data-open-supplier='{sid}']").count()==0: issue(r,sec,"erikoisala-suodatin ei löytänyt")
        pg.click(f"[data-supq='{spec}']")
        # order via supplier then try delete
        pg.click(".actionbar [data-act=new-order]"); pg.click("[data-ed=new-cust]"); pg.fill("[data-c=name]",f"AH-asiakas {r}")
        pg.select_option("[data-ed-change=group]","p14"); pg.fill("[data-f=deadline]","2026-12-01"); pg.select_option("[data-ed-change=production]","Alihankkija"); pg.select_option("[data-f=supplierId]", sid); pg.click("[data-ed=save]")
        ah_order=E("route.id")
        pg.click("main [data-doc=orderconf]"); pg.click("#docclose")
        N("suppliers"); pg.click(f".desk tr[data-open-supplier='{sid}']")
        if pg.locator(f"main tr[data-open-order='{ah_order}']").count()==0: issue(r,sec,"linkitetty tilaus ei näy")
        pg.click("main [data-act=edit-supplier]"); pg.click("[data-ed=delete-supplier]"); pg.wait_for_timeout(100)
        if not E(f"!!S.suppliers['{sid}']"): issue(r,sec,"alihankkija poistettiin vaikka avoimia tilauksia")
        if E("route.view")=="edit": pg.click("[data-ed=cancel]")
        # ---------------- Tarjoukset ----------------
        sec="Tarjoukset"
        cname=E(f"S.customers['{cid}']?.name") if cid else None
        oids=[mk_offer(r, cname if cname and random.random()<0.6 else None, send=(k>0)) for k in range(3)]
        N("offers"); clean(r,sec)
        for st in ["Luonnos","Valmis lähetettäväksi","Lähetetty","Hyväksytty","Hylätty","Kaikki"]:
            pg.click(f"[data-filter='{st}']")
            rows=pg.locator(".desk tbody tr").count(); exp=E(f"Object.values(S.offers).filter(o=>'{st}'==='Kaikki'||o.status==='{st}').length")
            if (exp and rows!=exp) or (not exp and rows): issue(r,sec,f"suodatin {st}: {rows} vs {exp}")
        o0=E(f"S.offers['{oids[0]}']")
        for q in [o0["no"], o0["customer"]["name"], o0["items"][0]["product"]]:
            pg.fill("[data-q=offers]", q); pg.wait_for_timeout(260)
            if pg.locator(f".desk tr[data-open-offer='{oids[0]}']").count()==0: issue(r,sec,f"haku '{q}' ei löytänyt")
        pg.fill("[data-q=offers]",""); pg.wait_for_timeout(260)
        pg.click(f".desk tr[data-open-offer='{oids[0]}']"); docs(r,sec)
        pg.click("main [data-act=edit-offer]"); pg.fill("[data-i='0.qty']","777"); pg.click("[data-ed=ready]")
        if E(f"S.offers['{oids[0]}'].items[0].qty")!="777": issue(r,sec,"muokkaus ei tallentunut")
        pg.click("[data-act=delete-offer]"); ok_yes()
        if E(f"!!S.offers['{oids[0]}']"): issue(r,sec,"poisto ei toiminut")
        pg.click(f".desk tr[data-open-offer='{oids[1]}']"); pg.click("[data-act=reject-offer]"); ok_yes(); pg.click("[data-act=copy-offer]"); pg.fill("[data-f=deadline]","2026-12-24"); pg.click("[data-ed=ready]")
        if E("S.offers[route.id]?.copiedFrom")!=E(f"S.offers['{oids[1]}'].no"): issue(r,sec,"kopio hylätystä ei toiminut")
        # ---------------- Tilaukset ----------------
        sec="Tilaukset"
        N("offers"); pg.click(f".desk tr[data-open-offer='{oids[2]}']"); pg.click("[data-act=accept-offer]"); pg.wait_for_selector("#choicedlg[open]")
        way=random.randrange(3); pg.click(f"#choicebtns [data-choice='{way}']")
        if way==2: pg.click("[data-act=create-order]"); ok_yes()
        tid=E("route.id")
        if E("route.view")!="order": issue(r,sec,"hyväksynnän jälkeen ei tilausta"); continue
        if way!=1: pg.click("[data-act=start-prod]"); ok_yes()
        docs(r,sec)
        pg.fill("[data-wof=instructions]","Ohje"); pg.click("[data-act=save-wo]")
        for s_ in ["Käynnissä","Valmis","Aloitettu"]: pg.click(f"[data-stage='{s_}']")
        pg.click("[data-act=edit-order]"); pg.fill("[data-i='0.qty']", "321"); pg.click("[data-ed=save]")
        if E(f"S.orders['{tid}'].status")!="Tuotannossa": issue(r,sec,"muokkaus tuotannossa muutti tilaa")
        pg.click("[data-act=finish-prod]"); ok_yes(); docs(r,sec)
        N("orders")
        for st in ["Vahvistettu","Tuotannossa","Valmis","Laskutusvalmis","Kaikki"]:
            pg.click(f"[data-filter='{st}']")
            rows=pg.locator(".desk tbody tr").count(); exp=E(f"Object.values(S.orders).filter(o=>o.status!=='Laskutettu'&&('{st}'==='Kaikki'||o.status==='{st}')).length")
            if (exp and rows!=exp) or (not exp and rows): issue(r,sec,f"suodatin {st}: {rows} vs {exp}")
        pg.fill("[data-q=orders]", E(f"S.orders['{tid}'].no")); pg.wait_for_timeout(260)
        if pg.locator(f".desk tr[data-open-order='{tid}']").count()==0: issue(r,sec,"haku ei löytänyt")
        pg.fill("[data-q=orders]",""); pg.wait_for_timeout(260)
        pg.click(f".desk tr[data-open-order='{tid}']"); pg.click("[data-act=to-invoice]"); ok_yes(); docs(r,sec)
        pg.click("[data-act=approve-invoice]"); ok_yes()
        if E(f"S.orders['{tid}'].status")!="Laskutettu": issue(r,sec,"laskutus ei onnistunut")
        # direct order delete
        pg.click(".actionbar [data-act=new-order]"); pg.click("[data-ed=new-cust]"); pg.fill("[data-c=name]","Poisto Oy"); pg.select_option("[data-ed-change=group]","p01"); pg.fill("[data-f=deadline]","2026-12-01"); pg.click("[data-ed=save]")
        did=E("route.id"); pg.click("[data-act=delete-order]"); ok_yes()
        if E(f"!!S.orders['{did}']"): issue(r,sec,"tilauksen poisto ei toiminut")
        # ---------------- Arkisto ----------------
        sec="Arkisto"
        N("archive"); clean(r,sec)
        o=E(f"S.orders['{tid}']")
        for q in [o["no"], o["customer"]["name"], o["items"][0]["product"]]:
            pg.fill("[data-q=archive]", q); pg.wait_for_timeout(260)
            if pg.locator(f".desk tr[data-open-order='{tid}']").count()==0: issue(r,sec,f"haku '{q}' ei löytänyt")
        pg.fill("[data-q=archive]",""); pg.wait_for_timeout(260)
        pg.fill("[data-arch=from]","2020-01-01"); pg.fill("[data-arch=to]","2099-12-31"); pg.wait_for_timeout(100)
        if pg.locator(f".desk tr[data-open-order='{tid}']").count()==0: issue(r,sec,"päivämääräsuodatin piilotti työn")
        pg.fill("[data-arch=from]","2099-01-01"); pg.wait_for_timeout(100)
        if pg.locator(f".desk tr[data-open-order='{tid}']").count(): issue(r,sec,"päivämääräsuodatin ei rajannut")
        if pg.locator("[data-act=clear-archive]").count(): pg.click("[data-act=clear-archive]")
        pg.click(f".desk tr[data-open-order='{tid}']")
        for bad in ["edit-order","start-prod","approve-invoice","delete-order"]:
            if pg.locator(f"[data-act={bad}]").count(): issue(r,sec,f"arkistossa näkyy {bad}")
        docs(r,sec)
        pg.click("[data-act=copy-order]"); pg.fill("[data-f=deadline]","2027-01-10"); pg.click("[data-ed=save]")
        if E(f"S.orders['{tid}'].status")!="Laskutettu": issue(r,sec,"kopio muutti alkuperäistä")
        back_check(r,sec,"order")
        # ---------------- Tuotteet & hinnat ----------------
        sec="Tuotteet"
        N("products"); clean(r,sec)
        pg.fill("[data-q=products]","kortit"); pg.wait_for_timeout(260)
        if pg.locator(".desk tbody tr").count()<2: issue(r,sec,"haku 'kortit' löysi liian vähän")
        pg.fill("[data-q=products]",""); pg.wait_for_timeout(260)
        pid=random.choice(E("products().map(p=>p.id)"))
        pg.click(f".desk [data-prod-calc='{pid}']"); pg.wait_for_selector("#calcdlg[open]")
        pg.fill("#calcdlg [data-calc=qty]", str(random.choice([5,50,500,5000])))
        for s_ in pg.locator("#calcdlg [data-copt]").all(): s_.select_option(str(random.randrange(s_.locator("option").count())))
        for c_ in pg.locator("#calcdlg [data-cex]").all():
            if random.random()<0.5: c_.check()
        t=pg.inner_text("#calcres")
        if "NaN" in t or E("calcResult().total")<=0: issue(r,sec,"pikalaskuri antoi virheellisen hinnan")
        exp=E("calcResult().net"); pg.click("#calcdlg [data-act=calc-to-offer]"); pg.click("[data-ed=new-cust]"); pg.fill("[data-c=name]","Laskuri Oy"); pg.fill("[data-f=deadline]","2026-12-01"); pg.click("[data-ed=ready]")
        if abs(E("totals(S.offers[route.id]).net")-exp)>0.02: issue(r,sec,f"pikalaskuri {exp} ≠ tarjous {E('totals(S.offers[route.id]).net')}")
        N("products"); pg.click(f".desk [data-prod-offer='{pid}']")
        if not E("editing && editing.rec.items[0].productId==='"+pid+"' && num(editing.rec.items[0].price)>0"): issue(r,sec,"Tee tarjous ei esitäyttänyt hintaa")
        pg.click("[data-ed=cancel]")
        N("products"); pg.click(f".desk [data-prod-edit='{pid}']")
        n0=E("editing.rec.prices.length"); pg.click("[data-ed=add-pp]"); pg.fill(f"[data-pp='{n0}.qty']","99999"); pg.fill(f"[data-pp='{n0}.price']","12345")
        pg.click("[data-ed=add-pc][data-n='0']") if pg.locator("[data-ed=add-pc]").count() else None
        k=pg.locator("[data-pc^='0.']").count()//3 - 1 if pg.locator("[data-pc^='0.']").count() else -1
        if k>=0: pg.fill(f"[data-pc='0.{k}.label']", f"Testikoko {r}"); pg.fill(f"[data-pc='0.{k}.value']","2")
        pg.click("[data-ed=save-product]")
        pr=E(f"S.products['{pid}']")
        if not any(x["qty"]==99999 for x in pr["prices"]): issue(r,sec,"hintaporras ei tallentunut")
        if k>=0 and not any(ch["label"]==f"Testikoko {r}" for ch in pr["options"][0]["choices"]): issue(r,sec,"valinta ei tallentunut")
        # Oma tuote create + delete
        pg.click("main [data-act=new-product]"); pg.fill("[data-se2=name]", f"Oma {r}"); pg.fill("[data-se2=baseCost]","2,5"); pg.click("[data-ed=save-product]")
        own=E(f"Object.values(S.products).find(p=>p.name==='Oma {r}')?.id")
        if not own: issue(r,sec,"oman tuotteen luonti epäonnistui")
        else:
            pg.click(f".desk [data-prod-edit='{own}']"); pg.click("[data-ed=delete-product]"); ok_yes()
            if E(f"!!S.products['{own}']"): issue(r,sec,"oman tuotteen poisto epäonnistui")
        # ---------------- Markkinointi ----------------
        sec="Markkinointi"
        N("marketing"); clean(r,sec)
        total=pg.locator("[data-mc]").count()
        pg.click("[data-act=mkt-none]")
        if pg.input_value("#bcc"): issue(r,sec,"tyhjennä ei tyhjentänyt BCC:tä")
        pg.click("[data-act=mkt-all]")
        if total and pg.input_value("#bcc").count("@")!=len(set(pg.input_value("#bcc").split("; "))): issue(r,sec,"BCC-lista epäjohdonmukainen")
        if total:
            pg.locator("[data-mc]").first.uncheck()
            if pg.locator("[data-mc]:checked").count()!=total-1: issue(r,sec,"yksittäinen valinta ei toiminut")
        chip=pg.locator("[data-mg]").first; chip.click()
        pg.fill("[data-mk=subject]", f"Aihe {r}")
        if f"Aihe {r}" not in pg.inner_text("#olprev"): issue(r,sec,"esikatselu ei päivittynyt")
        # ---------------- Ylläpito ----------------
        sec="Ylläpito"
        N("admin"); clean(r,sec)
        col=random.choice(["#F7941D","#F5A040"]); pg.fill("[data-tonehex=O]", col)
        pg.fill("[data-bghex=paper]", random.choice(["#F5F4F2","#F2F4F6"]))
        pg.select_option("[data-bmap='act:send-offer']", random.choice(["Y","B"]))
        pg.fill("[data-se=phone]", f"+358 9 {r}")
        pg.click("[data-act=save-admin]")
        st=E("S.settings")
        if st["theme"]["tones"]["O"].lower()!=col.lower() or st["phone"]!=f"+358 9 {r}": issue(r,sec,"asetukset eivät tallentuneet")
        pg.fill("[data-plt='p02.0.price']", str(50+r)); pg.click("[data-act=save-pricelist]")
        if E("S.products.p02.prices[0].price")!=50+r: issue(r,sec,"perushinnasto ei tallentunut")
        pg.click("[data-act=export-data]"); data=pg.input_value("#exportbox")
        try:
            d=json.loads(data)
            if len(d["orders"])!=E("Object.keys(S.orders).length"): issue(r,sec,"varmuuskopion tilausmäärä väärin")
        except Exception as ex: issue(r,sec,"varmuuskopio ei JSON")
        pg.fill("#importbox", data); pg.click("[data-act=import-data]"); ok_yes(); pg.wait_for_timeout(200)
        # ---------------- Dashboard ----------------
        sec="Dashboard"
        N("dashboard"); clean(r,sec)
        for per in ["Päivä","Viikko","Kuukausi","Vuosi","Oma väli"]:
            pg.click(f"[data-period='{per}']"); clean(r,sec)
        pg.click("[data-period='Vuosi']")
        shown=pg.locator(".kpi b").first.inner_text()
        exp=E("eur(Object.values(S.orders).filter(o=>{const d=dayOf(o.date||o.createdAt);return d>=ls('dashboard').from&&d<=ls('dashboard').to}).reduce((a,o)=>a+totals(o).net,0))")
        if shown!=exp: issue(r,sec,f"myynti {shown} ≠ {exp}")
        pg.fill("[data-range=from]","2026-01-01"); pg.fill("[data-range=to]","2026-12-31")
        if E("ls('dashboard').period")!="Oma väli": issue(r,sec,"oma väli ei aktivoitunut")
        # nav badges
        cnt=E("({o:Object.values(S.offers).filter(o=>!['Hylätty'].includes(o.status)&&!(o.status==='Hyväksytty'&&o.orderId)).length, t:Object.values(S.orders).filter(o=>o.status!=='Laskutettu').length})")
        if pg.inner_text("#snav [data-nav=orders] .n")!=str(cnt["t"]): issue(r,"Yläpalkki","tilausten laskuri väärin")
        if pg.inner_text("#snav [data-nav=offers] .n")!=str(cnt["o"]): issue(r,"Yläpalkki","tarjousten laskuri väärin")
        print(f"kierros {r} valmis, ongelmia yhteensä {len(issues)}", flush=True)
    # mobile pass
    pg.set_viewport_size({"width":390,"height":844})
    for v in ["offers","orders","archive","customers","products","suppliers","marketing","admin","dashboard"]:
        N(v); pg.wait_for_timeout(100)
        if E("document.documentElement.scrollWidth")>391:
            issue("mobiili",v,"vaakavieritys: "+str(E('[...document.querySelectorAll("main *")].filter(e=>e.getBoundingClientRect().right>392).slice(0,4).map(e=>e.tagName+"."+e.className+" "+Math.round(e.getBoundingClientRect().right))')))
    print("PAGE ERRORS:", errs[:10]); print("ISSUES:", len(issues)); print("\n".join(issues[:60]))
    b.close()
