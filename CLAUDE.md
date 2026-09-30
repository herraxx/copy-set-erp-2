# ⚠️ START HERE – THE APP IS ALREADY FINISHED. DO NOT REBUILD OR REWRITE IT.

This package *is* the working application. Your task is to **deploy these exact files**, not to
recreate the app from a description, a screenshot or a URL. A rewritten app will never be identical.

- Hailer App: publish the `dist/` folder exactly as it is (`npm install`, then
  `npm run publish-production -- --create --app-name "Copy-Set ERP" --workspace <id> --user-api-key <key> --force`).
  Files: `dist/index.html, styles.css, app.js, hailer-boot.js, vendor/app-sdk.js, fonts/*, manifest.json`.
- If your environment can only take ONE file (e.g. an HTML page/artifact): use `single/copyset-erp.html`
  unchanged – it is the complete app (≈770 kB) with styles, code and font inside.
- If you must use a template/framework (e.g. Vite from `@hailer/create-app`): do NOT port the code.
  Put the `dist/` files into the template's static/public folder unchanged and make the app load `dist/index.html`.
- Verify: `sha256sum -c CHECKSUMS.txt` must print OK for every file. Any difference = not identical.
- Data: after the app runs, Ylläpito → Tuo tiedot → paste `data/copyset-erp-backup.json`.
- There is no public URL to fetch; everything needed is in this package.

Only change `src/` when the user asks for a change, then run `node build.mjs` and the tests.

---

# CLAUDE.md – Copy-Set ERP

Handoff for an AI assistant (or developer) continuing this project. Read this first. The goal when
reproducing or moving the app is **100 % identical behaviour and appearance**: do not rewrite, re-style
or "modernise" anything unless the user asks. Change `src/`, run `node build.mjs`, run the tests.

## What it is

A complete ERP / print-MIS for **Copy-Set Oy**, a print shop in Helsinki. UI language is **Finnish**,
number/date formats `fi-FI` (`1 234,50 €`, `dd.mm.yyyy`), VAT 25,5 %. Target platform: **Hailer**
(runs as a Hailer App in an iframe, data stored in a Hailer workflow). The same build also runs as a
plain web page and as a Claude artifact.

Sections (top bar, left → right): Tarjoukset · Tilaukset · Arkisto | Asiakkaat · Tuotteet & hinnat ·
Alihankkijat · Markkinointi | Ylläpito (admins only) · Dashboard (start page). Under the bar, centred:
**+ Uusi tarjous** and **+ Uusi tilaus**.

## Files

```
src/index.html      page template: <!--FONTS--> <!--STYLES--> <!--SCRIPTS--> are filled by build.mjs
src/styles.css      all styles (design A: light grey + Copy-Set orange #F7941D)
src/app.js          all application logic, one classic script ("use strict"), ~1950 lines
vendor/app-sdk.js   @hailer/app-sdk 2.9.0 ESM bundle (ISC)
vendor/fonts/       Archivo variable font (OFL), latin + latin-ext, wdth+wght axes
build.mjs           no-dependency build → dist/ (Hailer) and single/copyset-erp.html (one file, fonts embedded)
dist/               built Hailer App – this is what `npm pack` / publish uploads (package.json "files")
single/             built one-file version (identical app.js/styles.css inlined)
public/manifest.json  app name/version; the Hailer publish CLI writes appId here; build copies it to dist/
data/copyset-erp-backup.json  full snapshot of the production data (import via Ylläpito → Tuo tiedot)
tests/              Playwright (Python) end-to-end tests, incl. a simulated Hailer host
```

`dist/index.html` loads `fonts/fonts.css`, `styles.css`, then `hailer-boot.js` (ES module: imports the
SDK and sets `window.HailerApi`) and `app.js` (deferred; runs after the module). Never inline the SDK
into app.js – the single-file build must not contain it.

## app.js map (section comments in the file)

helpers → defaults and data normalisation (product defaults, price tables, options, extras, cost %) →
storage (backends) → business logic (numbering, totals, margin, hit rate) → button colours (tone
registry) → Admin → routing → list helper → Dashboard → Offers → Orders (+ work order, margin panel) →
A4 documents → CRM → Products → Suppliers → Quick calculator → Marketing → Editors → actions → events → init.

State is one object `S = {customers, offers, orders, products, suppliers, settings}` keyed by id.
UI is string templates rendered into `#main` by `render()`; one delegated click/input/change handler
dispatches on `data-*` attributes (`data-act`, `data-ed`, `data-nav`, `data-doc`, `data-open-*` …).
Routing is hash based (`#/view/id`) with `history.pushState`; browser Back works; list filter, search
and scroll position are remembered per view (`LS`).

## Storage backends (chosen automatically at start, `startStorage()`)

| Where the page runs | Backend | Notes |
|---|---|---|
| Inside Hailer (`window.HailerApi` + in iframe + SDK `connected`) | `hailerBackend` | shared, live updates via signals |
| Claude artifact (`window.claude.use("db")`) | `claudeBackend` | shared artifact database |
| Anything else | `localBackend` | `localStorage["copyset-erp-v1"]` |

**Hailer mapping:** workflow key `copyset_erp_data`, first phase, textarea field key `erp_json`.
Every record is one activity: `name = "<collection>/<id>"` (e.g. `offers/mufva9pagu074i`), field
`erp_json` = the record as JSON. Settings are `meta/settings`. Load = `activity.list` over all phases
(paged 500). Save = `activity.update` / `activity.create`; delete = `activity.remove`. Live sync:
signals `activity.create|update|remove` for that workflow → `activity.get` → re-render. Admin =
`permission.map()[me].workspace.isAdmin || isOwner`. If the workflow/field is missing the app shows
setup instructions instead of the UI. On first start (no products) the 20 default products are written.

## Data model (all ids are strings; numbers entered in forms may be strings – always read with `num()`)

**settings** – company (`name, ytunnus, street, postcode, city, phone, email, web, iban, bic`),
pricing defaults (`startCost 50, billingFee 6, terms 21, vat 25.5, margin 30, offerValidity 30`),
margin calc (`hourlyCost 45, costPct 45, extrasCostPct 35`), `theme = {tones:{O,Y,G,B,L,H,W,R}, bg:{paper,band,sheet}, buttons:{<buttonKey>:<tone>}}`.

**customers** – `name, ytunnus, status (Aktiivinen|Prospekti|Passiivinen), country (default Suomi),
vatId, contacts[{name,role,email,phone}], addresses[{label,street,postcode,city}],
billing{street,postcode,city}, einvoice, operator, terms, discount %, notes`.

**offers / orders** (same shape, `kind` = offer|order) – `no` (TAR-YYYY-NNNN / TIL-YYYY-NNNN, next =
max+1 per year), `status`, `customerId`, `customer` (snapshot: name, ytunnus, contactName, email,
phone, billStreet/Postcode/City, einvoice, operator, terms, country, vatId), `items[]`, `extras[]`,
`instructions, deliveryMethod (Nouto|Posti|Lähetti), delivery{street,postcode,city}, deliveryCost,
date, deadline, productionMethod (Copy-Set|Alihankkija), supplierId, startCost, billingFee, vatRate,
vatMode (fi|eu|export), discount %, customerRef, reference, attachments[{name,size}], history[{at,text}]`.
Orders also: `offerId, offerNo, stage (Aloitettu|Käynnissä|Valmis), prodNotes, finishedAt,
invoicedAt, payMethod (Käteinen|Kortti|MobilePay), receiptDate, costs{material,hours,subcontract,other}, copiedFrom`.
Offers also: `orderId, sentAt, acceptedAt, copiedFrom`.

**item** – `iid, group, productId, product, qty, unit, price (unit price, up to 6 decimals), desc,
format, material, colors, printInfo, optNote, opts{groupIndex:choiceIndex}, calc{base,prod,mat,other,margin}, autoPrice`.
**extra** – `name, qty, unitPrice, unit, price (=qty×unitPrice), src ("<iid>:<k>" when picked from the product), link (iid → follows item qty)`.

**products** – `name, unit, baseCost, startCost, costPct, prices[{qty,price}]` (price table, total €
excl. VAT with default options), `options[{name, field (format|material|colors|printInfo|''), choices[{label, mode (kerroin|yks|työ), value}]}]`,
`tiers[{from,disc}]` (only used when no price table), `extras[{name, price, per (työ|yks)}]`, `custom`, `sort`.

**suppliers** – `name, specialty (comma list), contact, email, phone, street, postcode, city, leadTime, notes`.

## Workflows (every status change is an explicit button + confirmation, logged to history)

Offer: Luonnos → Valmis lähetettäväksi → Lähetetty → Hyväksytty / Hylätty.
- Luonnos / Valmis lähetettäväksi can be deleted. Editing a Lähetetty offer keeps the status.
- **Merkitse hyväksytyksi** opens a choice: *Hyväksy ja luo tilaus* · *Hyväksy ja aloita tuotanto heti* ·
  *Vain hyväksy* · *Peruuta*. One offer can create only one order (link `orderId`); deleting that order frees the offer.
- Hylätty/Hyväksytty → *Kopioi uudeksi tarjoukseksi*.

Order: Vahvistettu → Tuotannossa (stages Aloitettu/Käynnissä/Valmis, editable Työmääräys) → Valmis →
Laskutusvalmis (↔ Takaisin tilaukseen) → Laskutettu (read-only, shown in Arkisto; can be copied to a new order).
Opening/printing documents never changes status. Prospekti customer becomes Aktiivinen when an order is created.

## Pricing (function `priceConfig`)

1. Price table: total for qty is interpolated between rows; below the first row the first row's price
   is the minimum (per-piece if first qty = 1); above the last row the last segment's slope continues.
2. Unit = total / qty, then options: `kerroin` multiplies, `yks` adds €/unit, `työ` adds a one-off €.
3. Without a price table: `baseCost` × qty with quantity-tier discount.
4. `+ calc.prod + calc.mat + calc.other`, then `× (1 + calc.margin %)`.
Item price follows automatically (`autoPrice`) until the user types a price; the hint offers "käytä ehdotusta".
Record totals: items + extras → customer discount % → + startCost + billingFee + deliveryCost = net;
VAT = net × rate (fi 25,5 %, eu/export 0 % with legal note AVL 72 a § / AVL 70 §; EU requires customer VAT ID).
Quick calculator (Tuotteet & hinnat → Laske) uses the same engine and creates an identical offer.

## Margin and hit rate

`marginOf(r)`: actual costs if any `costs` field is filled (`material + hours×hourlyCost + subcontract + other`),
else estimate `Σ item net × product.costPct + extras net × extrasCostPct`; delivery cost always counted.
`hitRate(offers)`: won = Hyväksytty or has order, lost = Hylätty, drafts/open excluded; by count and by value.
Shown on Dashboard (KPIs, per customer, per job), customer page, order/offer pages, order lists (Kate %; `*` = estimate). <20 % is red.

## Documents (A4, one shared frame `sheet()`)

Tarjous, Tilausvahvistus, Työkortti (no prices), Lähete (no prices), Lähetyslappu, Käteiskuitti,
Lasku / Laskun tarkastus. Orange top bar, company left, title + meta right, three grey info boxes,
item table, totals with orange-tinted total row, 4-column footer. Print CSS prints only the document.

## Colours

Tones (admin-editable): O orange #F7941D create/start · Y yellow #FFD95A waiting · G green #8FD19E done/save ·
B blue #9CCBEF open/print · L lilac #C9B6EA edit/copy · H grey #E4E2DE other · W white cancel/add row ·
R red outline delete/reject. Status badges reuse Y/O/G. Every button gets its tone from `BTN_REG`
(key from `btnKey()`) unless overridden in `settings.theme.buttons`. Backgrounds `paper/band/sheet` are editable too.

## Build, test, publish

```bash
node build.mjs                 # dist/ + single/
pip install playwright && playwright install chromium
bash tests/run_all.sh          # all tests; must end without FAIL/ISSUES
npm install && npm run publish-production -- --user-api-key <key> --force
```
Test suite: full flow, 10 rounds through every top-bar section, 50 random full workflows, quick
calculator = offer to the cent, price tables, VAT modes, margin/hit rate, mobile (375–390 px, no
horizontal scroll), and `test_hailer.py` (dist/ in a simulated Hailer host: storage, backup import,
live remote update, non-admin, setup screen).

## Rules for changes

- Keep one source of truth in `src/`; never edit `dist/` or `single/` by hand.
- Keep all UI text Finnish; keep `fi-FI` formatting helpers (`eur`, `eur4`, `fdate`, `nfmt`, `pct`).
- Add new buttons to `BTN_REG` so admins can recolour them.
- Record shape changes need a normaliser (`normRec`, `normCust`, `normProduct`, `normSettings`) so old data keeps working.
- Run the whole test suite after every change.
