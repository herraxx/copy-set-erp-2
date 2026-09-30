"use strict";
/* ================= helpers ================= */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clone = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
const num = v => { if (typeof v === "number") return isFinite(v) ? v : 0; const n = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return isFinite(n) ? n : 0; };
const r2 = n => Math.round(n * 100) / 100;
const eur = n => new Intl.NumberFormat("fi-FI", {style:"currency", currency:"EUR"}).format(n || 0);
const nfmt = n => new Intl.NumberFormat("fi-FI", {maximumFractionDigits:2}).format(n || 0);
const pad = n => String(n).padStart(2, "0");
const isoLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => isoLocal(new Date());
const fdate = d => { if (!d) return "–"; const x = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + "T12:00:00") : new Date(d); return isNaN(x) ? "–" : `${pad(x.getDate())}.${pad(x.getMonth() + 1)}.${x.getFullYear()}`; };
const fdt = d => { const x = new Date(d); return `${fdate(d)} ${pad(x.getHours())}:${pad(x.getMinutes())}`; };
const dayOf = d => d ? (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d : isoLocal(new Date(d))) : "";
const pct = n => String(nfmt(n)) + " %";
const lines = s => esc(s).replace(/\n/g, "<br>");
let toastT;
function toast(msg){ const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2600); }
function setPath(o, path, v){ const k = path.split("."); let x = o; while (k.length > 1) { const p = k.shift(); x[p] = x[p] || {}; x = x[p]; } x[k[0]] = v; }
function getPath(o, path){ return path.split(".").reduce((x, p) => x == null ? x : x[p], o); }

const OFFER_ST = ["Luonnos","Valmis lähetettäväksi","Lähetetty","Hyväksytty","Hylätty"];
const ORDER_ST = ["Vahvistettu","Tuotannossa","Valmis","Laskutusvalmis","Laskutettu"];
const STAGES = ["Aloitettu","Käynnissä","Valmis"];
const CUST_ST = ["Aktiivinen","Prospekti","Passiivinen"];
const DELIVERY = ["Nouto","Posti","Lähetti"];
const PRODUCTION = ["Copy-Set","Alihankkija"];
const OWN = "Oma tuote";
const stClass = s => ({"Luonnos":"s-grey","Valmis lähetettäväksi":"s-wait","Lähetetty":"s-wait","Hyväksytty":"s-done","Hylätty":"s-bad",
  "Vahvistettu":"s-wait","Tuotannossa":"s-act","Valmis":"s-done","Laskutusvalmis":"s-wait","Laskutettu":"s-done",
  "Aktiivinen":"s-done","Prospekti":"s-wait","Passiivinen":"s-grey"}[s] || "s-grey");
const orderBadge = o => o.status === "Tuotannossa" && o.stage ? `<span class="st s-act" title="Tuotantovaihe: ${esc(o.stage)}">Tuotannossa · ${esc(o.stage.toLowerCase())}</span>` : badge(o.status);
const badge = s => `<span class="st ${stClass(s)}">${esc(s)}</span>`;

const TONE_DEFAULTS = {O:"#F7941D", Y:"#FFD95A", G:"#8FD19E", B:"#9CCBEF", L:"#C9B6EA", H:"#E4E2DE", W:"#FFFFFF", R:"#B3261E"};
const BG_DEFAULTS = {paper:"#F5F4F2", band:"#E9E7E4", sheet:"#FFFFFF"};
const BG_LABELS = {paper:"Sivun tausta", band:"Ylävalikon tausta", sheet:"Korttien, lomakkeiden ja painikerivin tausta"};
function DEFAULT_THEME(){ return {tones:{...TONE_DEFAULTS}, bg:{...BG_DEFAULTS}, buttons:{}}; }
const EU_COUNTRIES = ["Alankomaat","Belgia","Bulgaria","Espanja","Irlanti","Italia","Itävalta","Kreikka","Kroatia","Kypros","Latvia","Liettua","Luxemburg","Malta","Portugali","Puola","Ranska","Romania","Ruotsi","Saksa","Slovakia","Slovenia","Tanska","Tšekki","Unkari","Viro"];
const OTHER_COUNTRIES = ["Norja","Iso-Britannia","Sveitsi","Islanti","Yhdysvallat","Kanada","Muu maa"];
const COUNTRIES = ["Suomi", ...EU_COUNTRIES, ...OTHER_COUNTRIES];
const VAT_MODES = {fi:"Kotimaan myynti", eu:"EU-yhteisömyynti 0 %", export:"Vienti EU:n ulkopuolelle 0 %"};
const VAT_NOTES = {eu:"Yhteisömyynti, AVL 72 a §. Arvonlisäveroton myynti toiseen EU-maahan, ostaja on verovelvollinen (reverse charge).", export:"Vientimyynti EU:n ulkopuolelle, AVL 70 §. Arvonlisäveroton myynti."};
function vatModeFor(country){ if (!country || country === "Suomi") return "fi"; return EU_COUNTRIES.includes(country) ? "eu" : "export"; }
const isAbroad = c => c && c.country && c.country !== "Suomi";
/* ================= defaults and data normalisation ================= */
const DEFAULT_SETTINGS = { name:"Copy-Set Oy", ytunnus:"", street:"Asemapäällikönkatu 12 B 5", postcode:"00520", city:"Helsinki", phone:"+358 9 877 0570", email:"copy-set@copy-set.fi", web:"www.copy-set.fi",
  iban:"", bic:"", terms:21, startCost:50, billingFee:6, vat:25.5, margin:30, offerValidity:30 , hourlyCost:45, costPct:45, extrasCostPct:35 };
/* ---- Product configuration defaults: options (valinnat), quantity discounts (määräalennus) and common extras ----
   mode "kerroin" multiplies the base unit price, "yks" adds € per unit, "työ" adds € once per job. */
const K = (label, value) => ({label, mode:"kerroin", value});
const Y = (label, value) => ({label, mode:"yks", value});
const G = (name, field, ...choices) => ({name, field, choices});
const TIERS_PAPER = [[250,5],[500,12],[1000,20],[2500,28],[5000,35]];
const TIERS_SMALLRUN = [[50,5],[100,10],[250,15],[500,20]];
const TIERS_LARGE = [[3,5],[5,10],[10,15],[25,20]];
const DEFAULT_CONFIG = {
  "Käyntikortit": {tiers:[], options:[
    G("Koko","format", K("85 × 55 mm (vakio)",1), K("90 × 50 mm",1), K("85 × 40 mm (kapea)",0.95), K("55 × 55 mm (neliö)",1.05), K("65 × 65 mm (neliö)",1.1), K("Taitettu 85 × 55 mm",1.9)),
    G("Paperi","material", K("350 g silk",1), K("350 g matta",1), K("300 g pinnoittamaton",1.1), K("400 g soft touch",1.5), K("300 g helmiäiskartonki",1.6), K("350 g kierrätyskartonki",1.1), K("600 g kolmikerroskartonki",2.4)),
    G("Painatus","colors", K("4+4 CMYK",1), K("4+0 CMYK",0.7), K("1+1",0.65), K("1+0",0.55)),
    G("Kulmat","printInfo", K("Suorat kulmat",1), Y("Pyöristetyt kulmat (6 mm)",0.02))]},
  "Flyerit": {tiers:[], options:[
    G("Koko","format", K("A5 148 × 210 mm",1), K("A6 105 × 148 mm",0.85), K("A4 210 × 297 mm",1.35), K("DL 99 × 210 mm",0.9), K("A3 297 × 420 mm",2.6), K("148 × 148 mm (neliö)",0.95)),
    G("Paperi","material", K("170 g silk",1), K("130 g silk",0.9), K("250 g silk",1.25), K("300 g kartonki",1.4), K("120 g offset",0.9), K("160 g kierrätys",1.05)),
    G("Painatus","colors", K("4+4 CMYK",1), K("4+0 CMYK",0.85), K("1+1",0.6), K("1+0",0.5))]},
  "Esitteet": {tiers:[], options:[
    G("Koko (taitettuna)","format", K("A5 (A4 auki), 4 s.",1), K("A4 (A3 auki), 4 s.",1.9), K("DL 99 × 210 (A4 auki), 6 s.",1), K("A6 (A5 auki), 4 s.",0.6), K("B5 176 × 250, 4 s.",1.4), K("210 × 210 neliö, 4 s.",1.7), K("A5, 6 s.",1.5)),
    G("Taitto","printInfo", K("Puolitus",1), K("Haitaritaitto (Z)",1.05), K("Rulla- / sisääntaitto (C)",1.05), K("Ikkunataitto",1.15)),
    G("Paperi","material", K("170 g silk",1), K("170 g matta",1), K("130 g silk",0.9), K("250 g silk",1.25), K("160 g kierrätys",1.05)),
    G("Painatus","colors", K("4+4 CMYK",1), K("1+1",0.6))]},
  "Julisteet A3": {tiers:[], options:[
    G("Koko","format", K("A3 297 × 420 mm",1), K("SRA3 320 × 450 mm",1.1), K("A4 210 × 297 mm",0.55), K("A2 420 × 594 mm",2.4)),
    G("Paperi","material", K("170 g silk",1), K("200 g juliste matta",1.1), K("250 g silk",1.3), K("135 g blueback",1.1)),
    G("Painatus","colors", K("4+0 CMYK",1), K("4+4 CMYK",1.7))]},
  "Suurkuvatulosteet": {tiers:[], options:[
    G("Koko","format", K("A1 594 × 841 mm",1), K("A2 420 × 594 mm",0.55), K("A0 841 × 1189 mm",1.9), K("50 × 70 cm",0.75), K("70 × 100 cm",1.4), K("100 × 140 cm",2.8)),
    G("Materiaali","material", K("200 g julistepaperi",1), K("Satiinivalokuvapaperi",1.3), K("Blueback 135 g",1.1), K("Canvas-kangas",2.5), K("Tarrakalvo",1.6), K("5 mm kapa-levy",2.2), K("3 mm PVC-levy",2.2)),
    G("Käyttö","printInfo", K("Sisäkäyttö",1), K("Ulkokäyttö (UV-kestävä)",1.2))]},
  "Roll-upit": {tiers:[], options:[
    G("Koko","format", K("85 × 200 cm (suosituin)",1), K("60 × 200 cm",0.85), K("100 × 200 cm",1.26), K("120 × 200 cm",1.6), K("150 × 200 cm",2), K("Pöytäroll-up A3",0.45), K("Pöytäroll-up A4",0.35)),
    G("Teline","printInfo", K("Classic",1), K("Pro",1.2), K("Premium, teleskooppi",1.5), K("Ulkokäyttö, kaksipuolinen",3.1)),
    G("Materiaali","material", K("Blockout-kalvo",1), K("Polyesterikangas",1.05), K("PVC-vapaa polyesteri",1.1))]},
  "Banderollit": {tiers:[], options:[
    G("Materiaali","material", K("PVC 510 g",1), K("Reikävinyyli (mesh)",1.1), K("PVC-vapaa polyesteri",1.15), K("Kangas 215 g",1.2), K("B1-paloluokiteltu",1.3)),
    G("Painatus","colors", K("Yksipuolinen",1), K("Kaksipuolinen (blockout)",1.8)),
    G("Käyttö","printInfo", K("Ulkokäyttö",1), K("Sisäkäyttö",0.95))]},
  "Tarrat": {tiers:[], options:[
    G("Koko","format", K("enint. 7,5 × 7,5 cm",1), K("enint. 5 × 5 cm",0.6), K("enint. 10 × 10 cm",1.6), K("enint. 15 × 10 cm",2.2), K("A6",2.4), K("A5",4)),
    G("Materiaali","material", K("Valkoinen paperi",1), K("Vedenkestävä paperi",1.2), K("Valkoinen vinyyli",1.5), K("Läpinäkyvä vinyyli",1.6), K("Kultapaperi",1.4), K("Holografinen kalvo",2.2)),
    G("Muoto","printInfo", K("Suorakaide",1), K("Pyöreä / soikea",1), K("Muotoonleikattu",1.2)),
    G("Toimitus","", K("Yksittäiset",1), K("Tarra-arkki",1), K("Rullalla",0.85))]},
  "Kyltit ja taulut": {tiers:[], options:[
    G("Koko","format", K("A1 594 × 841 mm",1), K("A3 297 × 420 mm",0.35), K("A2 420 × 594 mm",0.6), K("1000 × 700 mm",1.3), K("1200 × 800 mm",1.6), K("1500 × 1000 mm",2.4)),
    G("Materiaali","material", K("3 mm alumiinikomposiitti",1), K("3 mm PVC",0.7), K("5 mm kapa-levy",0.6), K("10 mm kapa-levy",0.8), K("4 mm akryyli",1.8), K("Kennolevy",0.5)),
    G("Painatus","colors", K("1-puolinen",1), K("2-puolinen",1.7))]},
  "Kirjelomakkeet": {tiers:[], options:[
    G("Paperi","material", K("100 g offset",1), K("90 g offset",0.9), K("120 g offset",1.2), K("100 g Munken Pure",1.3)),
    G("Painatus","colors", K("4+0 CMYK",1), K("1+0",0.6), K("4+4 CMYK",1.6)),
    G("Koko","format", K("A4",1), K("A5",0.6))]},
  "Kirjekuoret": {tiers:[], options:[
    G("Koko","format", K("C5 162 × 229",1), K("C5 ikkuna",1.05), K("E65 / DL 110 × 220",0.8), K("E65 ikkuna",0.85), K("C4 229 × 324",1.5), K("C4 ikkuna",1.55), K("C6 114 × 162",0.7)),
    G("Painatus","colors", K("1+0",1), K("4+0 CMYK",1.6)),
    G("Paperi","material", K("90 g valkoinen",1), K("100 g Munken",1.3))]},
  "Lomakkeet": {tiers:[], options:[
    G("Koko","format", K("A4",1), K("A5",0.6), K("A3",1.9)),
    G("Paperi","material", K("80 g offset",1), K("90 g offset",1.05), K("Itsejäljentävä 2-os.",2.2), K("Itsejäljentävä 3-os.",3.2)),
    G("Painatus","colors", K("1+1",1), K("1+0",0.8), K("4+0 CMYK",1.6), K("4+4 CMYK",2.2))]},
  "Vihkot ja kirjaset": {tiers:[], options:[
    G("Koko","format", K("A5",1), K("A4",1.8), K("A6",0.6), K("210 × 210 mm",1.6)),
    G("Sivumäärä","printInfo", K("16 sivua",1), K("8 sivua",0.6), K("12 sivua",0.8), K("20 sivua",1.2), K("24 sivua",1.4), K("32 sivua",1.8), K("48 sivua",2.6)),
    G("Paperi","material", K("130 g silk",1), K("115 g silk",0.95), K("90 g offset",0.9), K("170 g silk",1.15)),
    G("Kansi","", K("Sama paperi kuin sisus",1), Y("250 g kansi",0.15), Y("300 g kansi",0.2)),
    G("Painatus","colors", K("4+4 CMYK",1), K("1+1",0.55))]},
  "Kirjat": {tiers:[], options:[
    G("Koko","format", K("A5 148 × 210",1), K("B5 176 × 250",1.3), K("170 × 240",1.25), K("A4",1.8)),
    G("Sivumäärä","printInfo", K("101–200 sivua",1), K("enint. 100 sivua",0.75), K("201–300 sivua",1.5), K("301–400 sivua",2)),
    G("Sidonta","", K("Liimasidonta, pehmeä kansi",1), Y("Kovakantinen",6), K("Kierresidonta",0.95), K("PUR-sidonta",1.1)),
    G("Sisus","colors", K("1+1 mustavalko",1), K("4+4 väri",1.8)),
    G("Paperi","material", K("90 g offset",1), K("80 g Munken Print Cream",1.1), K("115 g silk",1.2))]},
  "Kalenterit": {tiers:[], options:[
    G("Malli","format", K("Seinäkalenteri A3",1), K("Seinäkalenteri A4",0.7), K("Pöytäkalenteri A5 vaaka",0.8), K("Pöytäkalenteri A6",0.6), K("Taskukalenteri",0.5)),
    G("Sivut","printInfo", K("12 + kansi (kk/sivu)",1), K("6 + kansi (2 kk/sivu)",0.65)),
    G("Paperi","material", K("170 g silk",1), K("200 g silk",1.15), K("250 g matta",1.3)),
    G("Sidonta","", K("Wire-O",1), K("Nidottu",0.85))]},
  "Postikortit": {tiers:[], options:[
    G("Koko","format", K("A6 105 × 148",1), K("148 × 148 neliö",1.2), K("DL 99 × 210",1.2), K("A5 148 × 210",1.8)),
    G("Paperi","material", K("300 g silk",1), K("350 g matta",1.1), K("300 g pinnoittamaton",1.2), K("350 g kierrätys",1.15)),
    G("Painatus","colors", K("4+4 CMYK",1), K("4+1",0.9), K("4+0 CMYK",0.8))]},
  "Kutsu- ja onnittelukortit": {tiers:[], options:[
    G("Malli","format", K("Taitettu A6 (A5 auki)",1), K("Taitettu 148 × 148",1.2), K("Taitettu A5 (A4 auki)",1.7), K("Yksiosainen A6",0.6)),
    G("Paperi","material", K("300 g silk",1), K("300 g pinnoittamaton",1.2), K("300 g pellavapinta",1.4), K("350 g helmiäiskartonki",1.7)),
    G("Painatus","colors", K("4+4 CMYK",1), K("4+0 CMYK",0.85))]},
  "Opinnäytetyöt ja sidonta": {tiers:[], options:[
    G("Sidonta","", K("Liimasidonta, pehmeä kansi",1), Y("Kovat kannet ja kultaus",25), K("Kierresidonta",0.6), K("Nidonta",0.35)),
    G("Sivumäärä","printInfo", K("61–120 sivua",1), K("enint. 60 sivua",0.8), K("121–200 sivua",1.4), K("201–300 sivua",1.9)),
    G("Sisus","colors", K("Mustavalko",1), K("Väri",1.8)),
    G("Koko","format", K("A4",1), K("A5",0.8))]},
  "Mustavalkokopiot": {tiers:[], options:[
    G("Koko","format", K("A4",1), K("A3",2), K("A5",0.6)),
    G("Puolet","colors", K("1-puolinen",1), K("2-puolinen",1.7)),
    G("Paperi","material", K("80 g",1), K("100 g",1.2), K("160 g",1.8), K("250 g kartonki",3))]},
  "Värikopiot": {tiers:[], options:[
    G("Koko","format", K("A4",1), K("A3",2), K("SRA3",2.2), K("A5",0.6)),
    G("Puolet","colors", K("1-puolinen",1), K("2-puolinen",1.7)),
    G("Paperi","material", K("100 g",1), K("80 g",0.9), K("160 g silk",1.3), K("250 g silk",1.8), K("300 g kartonki",2.1))]}
};

/* Hintataulukot: määrä → kokonaishinta € alv 0 % oletusvalinnoilla. Välimäärät lasketaan portaiden välistä,
   suuremmat määrät viimeisen portaan kappalehinnalla. Lähteinä suomalaisten painojen julkiset hinnastot. */
const DEFAULT_PRICES = {
  "Käyntikortit":[[100,50],[200,62],[300,74],[400,86],[500,96],[1000,150],[2500,290],[5000,480]],
  "Flyerit":[[100,50],[200,75],[300,91],[400,100],[500,115],[1000,155],[2500,290],[5000,480]],
  "Esitteet":[[100,70],[200,90],[300,105],[400,125],[500,155],[1000,240],[2500,480],[5000,820]],
  "Julisteet A3":[[1,15],[5,55],[10,95],[25,200],[50,350],[100,600]],
  "Suurkuvatulosteet":[[1,35],[3,95],[5,150],[10,280],[25,625]],
  "Roll-upit":[[1,99],[2,186],[3,279],[5,450],[10,850]],
  "Banderollit":[[1,39],[2,70],[5,150],[10,260],[20,460],[50,1000]],
  "Tarrat":[[100,45],[250,75],[500,85],[750,95],[1000,110],[2500,190],[5000,300]],
  "Kyltit ja taulut":[[1,65],[2,120],[5,275],[10,500],[25,1100]],
  "Kirjelomakkeet":[[100,30],[250,50],[500,75],[1000,120],[2500,250],[5000,420]],
  "Kirjekuoret":[[100,55],[250,85],[500,120],[1000,180],[2500,360],[5000,600]],
  "Lomakkeet":[[100,25],[250,45],[500,70],[1000,115],[2500,240],[5000,420]],
  "Vihkot ja kirjaset":[[10,60],[25,110],[50,180],[100,300],[250,650],[500,1150]],
  "Kirjat":[[1,25],[5,90],[10,150],[25,300],[50,520],[100,900],[250,2000]],
  "Kalenterit":[[1,25],[5,95],[10,160],[25,330],[50,560],[100,950]],
  "Postikortit":[[100,50],[200,65],[300,74],[400,81],[500,100],[1000,145],[2500,300]],
  "Kutsu- ja onnittelukortit":[[10,25],[25,45],[50,70],[100,110],[250,220],[500,380]],
  "Opinnäytetyöt ja sidonta":[[1,20],[2,36],[3,50],[5,78],[10,140]],
  "Mustavalkokopiot":[[1,0.25],[10,2.1],[50,9.5],[100,17],[500,70],[1000,120],[5000,500]],
  "Värikopiot":[[1,0.6],[10,5],[50,22.5],[100,42],[500,190],[1000,350],[5000,1600]]
};
const defaultPrices = name => (DEFAULT_PRICES[name] || []).map(([qty, price]) => ({qty, price}));
const DEFAULT_EXTRAS = {
  "Käyntikortit":[["Taitto / asettelu",35,"työ"],["Matta- tai kiiltolaminointi",0.03,"yks"],["Soft touch -laminointi",0.06,"yks"],["Kuumafoliointi (kulta/hopea)",45,"työ"],["Kohdelakkaus",40,"työ"],["Muuttuvat tiedot (per nimi)",8,"työ"],["Korttikotelo",1.5,"yks"]],
  "Flyerit":[["Taitto / asettelu",45,"työ"],["Laminointi",0.05,"yks"],["Rei'itys",0.01,"yks"],["Pikatoimitus",25,"työ"]],
  "Esitteet":[["Taitto / asettelu",60,"työ"],["Nuuttaus",0.03,"yks"],["Kansilaminointi",0.08,"yks"],["Kohdelakkaus",60,"työ"],["Pikatoimitus",30,"työ"]],
  "Julisteet A3":[["Taitto / asettelu",35,"työ"],["Laminointi",1.5,"yks"],["Rullaus ja pakkaus",5,"työ"]],
  "Suurkuvatulosteet":[["Taitto / asettelu",45,"työ"],["Laminointi",6,"yks"],["Pohjustus levylle",12,"yks"],["Kiilapuukehys (canvas)",25,"yks"],["Rei'itys / ripustus",3,"yks"]],
  "Roll-upit":[["Taitto / asettelu",45,"työ"],["Vaihtoprintti",55,"yks"],["Kohdevalo",35,"yks"],["Kova kuljetuslaukku",30,"yks"]],
  "Banderollit":[["Taitto / asettelu",45,"työ"],["Purjerenkaat tiheämmin (50 cm välein)",2,"yks"],["Tunnelointi / putkitasku",4,"yks"],["Kiinnitysnarut",8,"työ"],["B1-paloluokitus",5,"yks"]],
  "Tarrat":[["Taitto / asettelu",35,"työ"],["Stanssityökalu / muotoonleikkaus",40,"työ"],["Laminointi",0.03,"yks"],["Siirtoteippaus",0.05,"yks"]],
  "Kyltit ja taulut":[["Taitto / asettelu",45,"työ"],["Asennus",60,"työ"],["Kiinnitystarvikkeet",8,"yks"],["Porareiät kulmiin",4,"yks"],["Distanssikiinnikkeet",12,"yks"]],
  "Kirjelomakkeet":[["Taitto / asettelu",35,"työ"],["Rei'itys",0.01,"yks"],["Word-pohja",40,"työ"]],
  "Kirjekuoret":[["Taitto / asettelu",30,"työ"],["Osoitetulostus",0.05,"yks"],["Postitus / kuoritus",0.08,"yks"]],
  "Lomakkeet":[["Taitto / asettelu",40,"työ"],["Numerointi",0.03,"yks"],["Rei'itys",0.01,"yks"],["Lehtiöinti (50 arkkia)",1.5,"yks"],["Nuuttaus / repäisyviiva",0.02,"yks"]],
  "Vihkot ja kirjaset":[["Taitto / asettelu",80,"työ"],["Kansilaminointi",0.15,"yks"],["Rei'itys kansioon",0.02,"yks"],["Pikatoimitus",40,"työ"]],
  "Kirjat":[["Taitto / asettelu",150,"työ"],["Kansilaminointi",0.3,"yks"],["Kansiliepeet",0.8,"yks"],["Kannen kohdelakkaus",80,"työ"],["ISBN-viivakoodi",20,"työ"]],
  "Kalenterit":[["Taitto / asettelu",90,"työ"],["Ripustin",0.3,"yks"],["Pahvitausta",0.4,"yks"],["Kuvankäsittely",15,"työ"],["Kirjekuori / pakkaus",0.5,"yks"]],
  "Postikortit":[["Taitto / asettelu",30,"työ"],["Laminointi",0.05,"yks"],["Pyöristetyt kulmat",0.02,"yks"],["Kirjekuoret",0.12,"yks"]],
  "Kutsu- ja onnittelukortit":[["Taitto / asettelu",35,"työ"],["Nuuttaus",0.08,"yks"],["Kirjekuoret",0.15,"yks"],["Kuumafoliointi",45,"työ"],["Muuttuvat nimet",0.1,"yks"]],
  "Opinnäytetyöt ja sidonta":[["Kultaus kanteen",8,"yks"],["Selkäteksti",5,"yks"],["Muistitikkutasku",3,"yks"],["Pikatyö",25,"työ"]],
  "Mustavalkokopiot":[["Nidonta",0.1,"yks"],["Rei'itys",0.02,"yks"],["Kierresidonta",3.5,"yks"],["Taittaminen",0.03,"yks"]],
  "Värikopiot":[["Laminointi",0.8,"yks"],["Nidonta",0.1,"yks"],["Kierresidonta",3.5,"yks"],["Leikkaus",5,"työ"]]
};
/* share of the selling price that is material + machine cost (for margin estimates); editable per product */
const DEFAULT_COST_PCT = {"Roll-upit":60, "Kyltit ja taulut":55, "Banderollit":50, "Suurkuvatulosteet":45, "Opinnäytetyöt ja sidonta":50, "Kirjat":55, "Kalenterit":50, "Mustavalkokopiot":30, "Värikopiot":35};
const defaultExtras = name => (DEFAULT_EXTRAS[name] || []).map(([n, price, per]) => ({name:n, price, per}));
const defaultOptions = name => JSON.parse(JSON.stringify(DEFAULT_CONFIG[name]?.options || []));
const defaultTiers = name => (DEFAULT_CONFIG[name]?.tiers || []).map(([from, disc]) => ({from, disc}));

const DEFAULT_PRODUCTS = [
  ["Käyntikortit","kpl",0.08,40],["Flyerit","kpl",0.12,50],["Esitteet","kpl",0.35,60],["Julisteet A3","kpl",1.2,30],
  ["Suurkuvatulosteet","kpl",18,20],["Roll-upit","kpl",95,0],["Banderollit","m²",28,20],["Tarrat","kpl",0.15,50],
  ["Kyltit ja taulut","kpl",45,30],["Kirjelomakkeet","kpl",0.1,40],["Kirjekuoret","kpl",0.18,50],["Lomakkeet","kpl",0.2,50],
  ["Vihkot ja kirjaset","kpl",1.8,80],["Kirjat","kpl",4.5,120],["Kalenterit","kpl",6,90],["Postikortit","kpl",0.25,40],
  ["Kutsu- ja onnittelukortit","kpl",0.6,40],["Opinnäytetyöt ja sidonta","kpl",12,0],["Mustavalkokopiot","kpl",0.06,0],["Värikopiot","kpl",0.3,0]
].map(([name, unit, baseCost, startCost], i) => ({id:"p" + pad(i + 1), name, unit, baseCost, startCost, format:"", material:"", colors:"", description:"", sort:i + 1, extras:defaultExtras(name), options:defaultOptions(name), tiers:defaultTiers(name), prices:defaultPrices(name)})).map(p => (p.prices.length && (p.baseCost = Math.round(p.prices[0].price / p.prices[0].qty * 10000) / 10000), p));

const COLLS = ["customers","offers","orders","products","suppliers"];

function normCust(c){
  if (!c) return c;
  if (!Array.isArray(c.contacts)) c.contacts = (c.contact || c.email || c.phone) ? [{name:c.contact || "", email:c.email || "", phone:c.phone || "", role:""}] : [];
  if (!Array.isArray(c.addresses)) c.addresses = c.address ? [{label:"Pääosoite", street:c.address, postcode:"", city:""}] : [];
  if (!c.billing) c.billing = {street:c.billingAddress || "", postcode:"", city:""};
  if (!CUST_ST.includes(c.status)) c.status = "Aktiivinen";
  if (c.terms == null || c.terms === "") c.terms = "";
  if (c.discount == null) c.discount = 0;
  if (!c.country) c.country = "Suomi";
  if (c.vatId == null) c.vatId = "";
  return c;
}
function normRec(r){
  if (!r) return r;
  r.customer = r.customer || {}; const c = r.customer;
  if (c.contactName == null && c.contact != null) c.contactName = c.contact;
  if (c.billStreet == null && c.billingAddress != null) c.billStreet = c.billingAddress;
  if (!r.delivery) r.delivery = {street:r.deliveryAddress || "", postcode:"", city:""};
  if (!DELIVERY.includes(r.deliveryMethod)) r.deliveryMethod = (!r.deliveryMethod || r.deliveryMethod === "Nouto") ? "Nouto" : r.deliveryMethod === "Kuljetus" ? "Lähetti" : "Posti";
  if (!PRODUCTION.includes(r.productionMethod)) r.productionMethod = r.productionMethod === "Alihankinta" ? "Alihankkija" : "Copy-Set";
  r.items = r.items || []; r.extras = r.extras || []; r.attachments = r.attachments || []; r.history = r.history || [];
  r.items.forEach(i => { if (!i.group) i.group = OWN; if (!i.iid) i.iid = uid(); });
  r.extras = r.extras.map(x => (x.unitPrice == null || x.unitPrice === "") ? {...x, qty:"1", unitPrice:String(x.price ?? 0), unit:x.unit || "työ"} : x);
  if (r.vatRate == null) r.vatRate = 25.5;
  if (!VAT_MODES[r.vatMode]) r.vatMode = num(r.vatRate) === 0 ? (vatModeFor(r.customer.country) === "eu" ? "eu" : "export") : "fi";
  if (r.discount == null) r.discount = 0;
  return r;
}
function normSettings(x){ x = {...DEFAULT_SETTINGS, ...(x || {})}; const dt = DEFAULT_THEME(); x.theme = {tones:{...dt.tones, ...(x.theme?.tones || {})}, bg:{...dt.bg, ...(x.theme?.bg || {})}, buttons:{...(x.theme?.buttons || {})}}; if (x.address && !x.street) x.street = x.address; delete x.address; return x; }
function normProduct(p){
  if (!p) return p;
  if (!Array.isArray(p.extras)) p.extras = defaultExtras(p.name);
  if (!Array.isArray(p.options)) p.options = defaultOptions(p.name);
  if (!Array.isArray(p.tiers)) p.tiers = defaultTiers(p.name);
  if (!Array.isArray(p.prices)) p.prices = defaultPrices(p.name);
  if (p.costPct == null || p.costPct === "") p.costPct = DEFAULT_COST_PCT[p.name] ?? 45;
  return p;
}
function norm(coll, o){ return coll === "products" ? normProduct(o) : coll === "customers" ? normCust(o) : (coll === "offers" || coll === "orders") ? normRec(o) : o; }

/* ================= storage: Hailer, Claude artifact database or this browser =================
   The app keeps all data in S. A backend loads S and saves changes. Inside Hailer every record is
   one activity in the workflow with key HAILER.workflow; the record is JSON in the field HAILER.field. */
const S = { customers:{}, offers:{}, orders:{}, products:{}, suppliers:{}, settings:{} };
const LKEY = "copyset-erp-v1";
const HAILER = { workflow:"copyset_erp_data", field:"erp_json" };
let backend = null, isAdmin = true;

function applyDoc(coll, id, data){
  if (coll === "meta") { if (id === "settings") S.settings = normSettings(clone(data)); return; }
  if (S[coll]) S[coll][id] = norm(coll, clone(data));
}
function removeDoc(coll, id){ if (S[coll]) delete S[coll][id]; }
function ensureProducts(){ if (!Object.keys(S.products).length) DEFAULT_PRODUCTS.forEach(p => S.products[p.id] = clone(p)); }

function localBackend(){
  const save = () => { try { localStorage.setItem(LKEY, JSON.stringify(S)); } catch(e){ throw new Error("Tallennus selaimeen epäonnistui"); } };
  return {
    label:"Tiedot tallentuvat tähän selaimeen",
    async start(){
      try { const raw = localStorage.getItem(LKEY); if (raw) { const d = JSON.parse(raw); COLLS.forEach(k => Object.entries(d[k] || {}).forEach(([id, o]) => applyDoc(k, id, o))); if (d.settings) applyDoc("meta", "settings", d.settings); } } catch(e){}
      ensureProducts();
    },
    async put(){ save(); }, async del(){ save(); }, async putSettings(){ save(); }
  };
}

async function claudeBackend(){
  const db = await window.claude.use("db");
  if (!db) return null;
  try { const u = await window.claude.use("user"); isAdmin = u ? !!(await u.canEdit()) : true; } catch(_) { isAdmin = true; }
  return {
    label:"Tiedot tallentuvat yhteiseen tietokantaan",
    async start(){
      for (const coll of COLLS) {
        db.collection(coll).onSnapshot(snap => {
          S[coll] = {};
          snap.docs.forEach(doc => applyDoc(coll, doc.id, doc.data()));
          if (coll === "products") ensureProducts();
          scheduleRender();
        }, () => {});
      }
      db.doc("meta/settings").onSnapshot(s => { if (s.exists) { applyDoc("meta", "settings", s.data()); scheduleRender(); } }, () => {});
    },
    async put(coll, obj){ await db.collection(coll).doc(obj.id).set(clone(obj)); },
    async del(coll, id){ await db.collection(coll).doc(id).delete(); },
    async putSettings(s){ await db.doc("meta/settings").set(clone(s)); }
  };
}

function connectHailer(){
  return new Promise(resolve => {
    let done = false, api = null;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    api = new window.HailerApi({
      connected: () => finish(api),
      outside: () => finish(null),
      signals: s => hailerSignal && hailerSignal(s),
      error: e => console.warn("Hailer:", e)
    });
    setTimeout(() => finish(null), 4000);
  });
}
let hailerSignal = null;
class HailerSetupError extends Error {}

async function hailerBackend(api){
  const ws = api.info().workspaceId;
  const wf = (await api.workflow.list()).find(w => w.key === HAILER.workflow && (!ws || w.workspaceId === ws));
  if (!wf) throw new HailerSetupError("workflow");
  const fields = Object.values(wf.fields || {});
  const field = fields.find(f => f.key === HAILER.field) || fields.find(f => f.type === "textarea");
  if (!field) throw new HailerSetupError("field");
  const phaseId = wf.phasesOrder[0];
  try {
    const me = await api.user.current();
    const pm = await api.permission.map(ws ? {workspaceId:ws} : undefined);
    const role = pm?.[me._id]?.workspace;
    isAdmin = role ? !!(role.isAdmin || role.isOwner) : true;
  } catch(_) { isAdmin = true; }

  const byKey = {}, byId = {};                  // "coll/id" <-> activity _id
  const ingest = a => {
    const key = a.name || ""; const cut = key.indexOf("/"); if (cut < 1) return;
    const coll = key.slice(0, cut), id = key.slice(cut + 1);
    let data; try { data = JSON.parse(a.fields?.[field._id] ?? "null"); } catch(_) { return; }
    if (!data) return;
    byKey[key] = a._id; byId[a._id] = key;
    applyDoc(coll, id, data);
  };
  const write = async (coll, id, data) => {
    const key = coll + "/" + id, json = JSON.stringify(data);
    if (byKey[key]) await api.activity.update([{_id:byKey[key], fields:{[field._id]:json}}]);
    else { const [a] = await api.activity.create(wf._id, [{name:key, phaseId, fields:{[field._id]:json}}]); if (a) { byKey[key] = a._id; byId[a._id] = key; } }
  };
  hailerSignal = async s => {
    if (!/^activity\.(create|update|remove)$/.test(s.name) || s.data?.workflowId !== wf._id) return;
    const ids = [].concat(s.data.activityIds || []);
    for (const id of ids) {
      if (s.name === "activity.remove") { const key = byId[id]; if (key) { const cut = key.indexOf("/"); removeDoc(key.slice(0, cut), key.slice(cut + 1)); delete byKey[key]; delete byId[id]; } }
      else { try { const a = await api.activity.get(id); if (a) ingest(a); } catch(_) {} }
    }
    scheduleRender();
  };
  return {
    label:"Tiedot tallentuvat Haileriin",
    async start(){
      for (const ph of wf.phasesOrder) {
        for (let skip = 0; ; skip += 500) {
          const list = await api.activity.list(wf._id, ph, {limit:500, skip});
          list.forEach(ingest);
          if (list.length < 500) break;
        }
      }
      if (!Object.keys(S.products).length) { ensureProducts(); if (isAdmin) for (const p of Object.values(S.products)) await write("products", p.id, p); }
    },
    put: (coll, obj) => write(coll, obj.id, obj),
    async del(coll, id){ const key = coll + "/" + id; if (byKey[key]) { await api.activity.remove([byKey[key]]); delete byId[byKey[key]]; delete byKey[key]; } },
    putSettings: s => write("meta", "settings", s)
  };
}

async function put(coll, obj){
  obj.updatedAt = new Date().toISOString();
  S[coll][obj.id] = obj;
  try { await backend.put(coll, obj); }
  catch(e){ toast(e.code === "quota_exceeded" ? "Tietokanta on täynnä" : "Tallennus epäonnistui – yritä uudelleen"); throw e; }
}
async function del(coll, id){
  delete S[coll][id];
  try { await backend.del(coll, id); } catch(e){ toast("Poisto epäonnistui"); }
}
async function putSettings(){
  try { await backend.putSettings(S.settings); } catch(e){ toast("Tallennus epäonnistui"); throw e; }
}
function setStoreInfo(){ $("#storeinfo").textContent = backend ? backend.label : "Ladataan…"; }

async function startStorage(){
  S.settings = normSettings({});
  if (window.HailerApi && window.parent !== window) {
    const api = await connectHailer();
    if (api) {
      try { backend = await hailerBackend(api); }
      catch(e) { if (e instanceof HailerSetupError) { showHailerSetup(e.message); return false; } console.warn(e); }
    }
  }
  if (!backend && window.claude?.use) { try { backend = await claudeBackend(); } catch(_) { backend = null; } }
  if (!backend) backend = localBackend();
  await backend.start();
  S.settings = normSettings(S.settings);
  setStoreInfo();
  return true;
}
function showHailerSetup(what){
  $("#main").innerHTML = `<div class="panel" style="max-width:720px;margin:20px auto">
  <h1 style="font-size:26px">Hailer-asennus puuttuu</h1>
  <p>Copy-Set ERP tallentaa tietonsa Hailerin työnkulkuun. ${what === "field" ? "Työnkulusta puuttuu tietokenttä." : "Työnkulkua ei löytynyt tästä työtilasta."} Luo se kerran näin:</p>
  <ol style="line-height:1.7"><li>Hailerissa: <b>Työtilan asetukset → Työnkulut → Uusi työnkulku</b>, nimi <b>Copy-Set ERP data</b>.</li>
  <li>Aseta työnkulun avaimeksi (key) <code>${HAILER.workflow}</code>.</li>
  <li>Lisää kenttä tyyppiä <b>Pitkä teksti (textarea)</b>, nimi <b>Data</b>, avain <code>${HAILER.field}</code>.</li>
  <li>Jätä yksi vaihe (esim. <b>Tiedot</b>). Anna sovelluksen käyttäjille oikeus lukea ja muokata työnkulkua.</li>
  <li>Lataa sovellus uudelleen.</li></ol></div>`;
  $("#storeinfo").textContent = "Hailer-asennus puuttuu";
}
let rq, pageDirty = false;
function scheduleRender(){ if (!booted || editing || pageDirty) return; cancelAnimationFrame(rq); rq = requestAnimationFrame(() => render(true)); }
let booted = false;

/* ================= business logic ================= */
function nextNo(prefix, coll){
  const y = new Date().getFullYear(); const re = new RegExp(`^${prefix}-${y}-(\\d+)$`);
  let max = 0; Object.values(S[coll]).forEach(o => { const m = re.exec(o.no || ""); if (m) max = Math.max(max, +m[1]); });
  return `${prefix}-${y}-${String(max + 1).padStart(4, "0")}`;
}
function totals(r){
  const items = (r.items || []).reduce((a, i) => a + num(i.qty) * num(i.price), 0);
  const extras = (r.extras || []).reduce((a, x) => a + xTotal(x), 0);
  const sub = items + extras, dp = num(r.discount), disc = r2(sub * dp / 100);
  const start = num(r.startCost), fee = num(r.billingFee), ship = num(r.deliveryCost);
  const net = r2(sub - disc + start + fee + ship);
  const vr = r.vatRate == null ? num(S.settings.vat) : num(r.vatRate);
  const vat = r2(net * vr / 100);
  return {items, extras, sub, dp, disc, start, fee, ship, net, vr, vat, total: r2(net + vat)};
}
const xTotal = x => (x.unitPrice == null || x.unitPrice === "") ? num(x.price) : r2(num(x.qty === "" || x.qty == null ? 1 : x.qty) * num(x.unitPrice));
const xDesc = x => num(x.qty) && num(x.qty) !== 1 ? `${nfmt(num(x.qty))} ${x.unit && x.unit !== "työ" ? x.unit : "kpl"}` : "";
const eur4 = n => new Intl.NumberFormat("fi-FI", {style:"currency", currency:"EUR", minimumFractionDigits:2, maximumFractionDigits:4}).format(n || 0);
function optChoice(p, gi, opts){ const g = p?.options?.[gi]; if (!g || !g.choices?.length) return null; const ci = opts && opts[gi] != null && opts[gi] !== "" ? +opts[gi] : 0; return g.choices[ci] || g.choices[0]; }
function tierFor(p, q){ return (p?.tiers || []).filter(t => num(t.from) > 0 && q >= num(t.from)).sort((a, b) => num(b.from) - num(a.from))[0] || null; }
/* price table: quantity → total price (alv 0 %) with default options; interpolated between rows,
   minimum price below the first row, last row's marginal price above the last row */
function tableRows(p){ return (p?.prices || []).map(x => ({q:num(x.qty), p:num(x.price)})).filter(x => x.q > 0 && x.p >= 0).sort((a, b) => a.q - b.q); }
function tableTotal(p, q){
  const t = tableRows(p); if (!t.length || q <= 0) return null;
  if (q <= t[0].q) return t[0].q === 1 ? t[0].p * q : t[0].p;
  for (let i = 1; i < t.length; i++) if (q <= t[i].q) { const a = t[i - 1], b = t[i]; return a.p + (b.p - a.p) * (q - a.q) / (b.q - a.q); }
  const L = t[t.length - 1], P = t[t.length - 2];
  const slope = P ? Math.max(0, (L.p - P.p) / (L.q - P.q)) : L.p / L.q;
  return L.p + slope * (q - L.q);
}
function priceTableText(p, q){
  const t = tableRows(p); if (!t.length) return "";
  q = num(q); let hit = -1; t.forEach((x, i) => { if (q >= x.q) hit = i; });
  return t.map((x, i) => `<span class="${i === hit ? "tier on" : "tier"}">${nfmt(x.q)} ${esc(p.unit || "kpl")} ${eur(x.p)}</span>`).join(" ");
}
/* product price: table price (or base × qty) × option multipliers + €/unit adds + one-off adds + extra costs + margin */
function priceConfig(p, qty, opts, c){
  c = c || {};
  const q = num(qty);
  const manualBase = c.base !== undefined && c.base !== "";
  const tbl = !manualBase ? tableTotal(p, q) : null;
  let unit = manualBase ? num(c.base) : tbl != null && q ? tbl / q : num(p?.baseCost);
  let fixed = 0;
  (p?.options || []).forEach((g, gi) => { const ch = optChoice(p, gi, opts); if (!ch) return;
    if (ch.mode === "kerroin") unit *= num(ch.value); else if (ch.mode === "yks") unit += num(ch.value); else if (ch.mode === "työ") fixed += num(ch.value); });
  const tier = tbl == null ? tierFor(p, q) : null, disc = tier ? num(tier.disc) : 0;
  const listUnit = unit * (1 - disc / 100);
  const costs = num(c.prod) + num(c.mat) + num(c.other);
  const goods = listUnit * q + fixed + costs;
  const total = r2(goods * (1 + num(c.margin) / 100));
  return {q, fromTable:tbl != null, tableTotal:tbl, baseUnit:unit, disc, tier, listUnit, fixed, costs, goods, marginSum:total - goods, total, unitPrice: q ? Math.round(total / q * 1e6) / 1e6 : 0};
}
function optFields(p, opts){ const f = {}; (p?.options || []).forEach((g, gi) => { if (!g.field) return; const ch = optChoice(p, gi, opts); if (ch) (f[g.field] = f[g.field] || []).push(ch.label); }); const o = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.join(", ")])); if (p) o.optNote = optNote(p, opts); return o; }
function optNote(p, opts){ return (p?.options || []).map((g, gi) => !g.field ? optChoice(p, gi, opts)?.label : "").filter(Boolean).join(", "); }
const choiceHint = ch => ch.mode === "kerroin" ? (num(ch.value) === 1 ? "" : "× " + nfmt(num(ch.value))) : ch.mode === "yks" ? "+" + eur4(num(ch.value)) + "/yks" : "+" + eur(num(ch.value));
function tiersText(p, q){ const t = tierFor(p, num(q)); return (p?.tiers || []).length ? p.tiers.map(x => `<span class="${t === x ? "tier on" : "tier"}">${nfmt(num(x.from))}+ −${nfmt(num(x.disc))} %</span>`).join(" ") : ""; }
/* margin: actual costs when entered on the order, otherwise an estimate from the products' cost shares */
const COST_KEYS = ["material", "hours", "subcontract", "other"];
const costPctOf = i => { const p = S.products[i.productId]; return p && p.costPct !== "" && p.costPct != null ? num(p.costPct) : num(S.settings.costPct); };
function marginOf(r){
  const t = totals(r), f = t.sub ? (t.sub - t.disc) / t.sub : 1, c = r.costs || {};
  const actual = COST_KEYS.some(k => num(c[k]));
  const base = actual
    ? num(c.material) + num(c.hours) * num(S.settings.hourlyCost) + num(c.subcontract) + num(c.other)
    : r.items.reduce((a, i) => a + num(i.qty) * num(i.price) * f * costPctOf(i) / 100, 0) + t.extras * f * num(S.settings.extrasCostPct) / 100;
  const cost = r2(base + t.ship);                 // delivery is passed through at cost
  const margin = r2(t.net - cost);
  return {net:t.net, cost, margin, pct:t.net ? margin / t.net * 100 : 0, actual};
}
/* offer hit rate: won = accepted (or turned into an order), lost = rejected; drafts and open offers are not decided yet */
function hitRate(offers){
  const won = offers.filter(o => o.status === "Hyväksytty" || o.orderId), lost = offers.filter(o => o.status === "Hylätty");
  const open = offers.filter(o => ["Valmis lähetettäväksi", "Lähetetty"].includes(o.status) && !o.orderId);
  const wv = won.reduce((a, o) => a + totals(o).net, 0), lv = lost.reduce((a, o) => a + totals(o).net, 0);
  const dec = won.length + lost.length;
  return {won:won.length, lost:lost.length, open:open.length, openValue:open.reduce((a, o) => a + totals(o).net, 0), wonValue:wv,
    pct:dec ? won.length / dec * 100 : null, valuePct:wv + lv ? wv / (wv + lv) * 100 : null};
}
const pctTxt = v => v == null ? "–" : nfmt(Math.round(v * 10) / 10) + " %";
const marginCls = p => p < 20 ? ' style="color:var(--t-R);font-weight:700"' : "";
const log = (r, text) => { r.history = r.history || []; r.history.unshift({at:new Date().toISOString(), text}); };
const cust = r => r.customer || {};
const addr = a => a ? [a.street, [a.postcode, a.city].filter(Boolean).join(" ")].filter(Boolean).join("\n") : "";
const billAddr = c => [c.billStreet, [c.billPostcode, c.billCity].filter(Boolean).join(" "), c.country && c.country !== "Suomi" ? c.country.toUpperCase() : ""].filter(Boolean).join("\n");
const products = () => Object.values(S.products).sort((a, b) => (a.sort || 99) - (b.sort || 99) || a.name.localeCompare(b.name, "fi"));
const normY = y => String(y || "").replace(/\s/g, "").toUpperCase();
function dupY(y, exceptId){ const n = normY(y); if (!n) return null; return Object.values(S.customers).find(c => c.id !== exceptId && normY(c.ytunnus) === n) || null; }
function validY(y){ if (!y) return true; return /^\d{7}-\d$/.test(normY(y)); }
function custOrders(id){ return Object.values(S.orders).filter(o => o.customerId === id); }
function custOffers(id){ return Object.values(S.offers).filter(o => o.customerId === id); }
function custSales(id){ return custOrders(id).reduce((a, o) => a + totals(o).net, 0); }
function searchCustomers(q, max = 8){
  q = q.trim().toLowerCase(); if (!q) return [];
  return Object.values(S.customers).filter(c => [c.name, c.ytunnus, ...(c.contacts || []).flatMap(k => [k.name, k.email, k.phone])].some(v => String(v || "").toLowerCase().includes(q)))
    .sort((a, b) => (a.status === "Passiivinen") - (b.status === "Passiivinen") || a.name.localeCompare(b.name, "fi")).slice(0, max);
}
function snapshotFrom(c, contactIdx = 0){
  const k = (c.contacts || [])[contactIdx] || {};
  return {id:c.id, name:c.name, ytunnus:c.ytunnus || "", contactName:k.name || "", email:k.email || "", phone:k.phone || "",
    billStreet:c.billing?.street || "", billPostcode:c.billing?.postcode || "", billCity:c.billing?.city || "",
    einvoice:c.einvoice || "", operator:c.operator || "", terms:c.terms || "", country:c.country || "Suomi", vatId:c.vatId || ""};
}
function termsOf(r){ return num(cust(r).terms) || num(S.settings.terms) || 21; }

/* ================= Button colours (admin-editable) ================= */
const TONES = {
  O:["Oranssi – luo / aloita","#F7941D"], Y:["Keltainen – odottaa / vie eteenpäin","#FFD95A"], G:["Vihreä – valmis / tallenna","#8FD19E"],
  B:["Sininen – avaa / näytä / tulosta","#9CCBEF"], L:["Violetti – muokkaa / kopioi","#C9B6EA"], H:["Harmaa – muu toiminto","#E4E2DE"],
  W:["Valkoinen – peruuta / lisää rivi","#FFFFFF"], R:["Punainen – poista / hylkää","#B3261E"]
};
const BTN_REG = [
  ["Yleiset", [["act:new-offer","+ Uusi tarjous","O"],["act:new-order","+ Uusi tilaus","O"],["docprint","Tulosta","B"],["docclose","Sulje (dokumentti)","W"],["back","Sulje / takaisin","W"],["nav","Siirtymäpainikkeet","H"]]],
  ["Tarjous- ja tilauslomake", [["ed:calc","Laske hinta","B"],["ed:draft","Tallenna luonnos","W"],["ed:ready","Tallenna tarjous","G"],["ed:save","Tallenna tilaus / muutokset","G"],["ed:cancel","Peruuta","W"],["ed:new-cust","+ Luo uusi asiakas","W"],["ed:change-cust","Vaihda asiakas","L"],["ed:add-item","+ Lisää tuote","W"],["ed:add-extra","+ Lisää lisätyö","W"],["ed:toggle-calc","Valinnat ja laskuri","B"],["ed:apply-calc","Käytä hinta ja tiedot","G"],["ed:del","Poista rivi","R"]]],
  ["Tarjouksen työnkulku", [["act:edit-offer","Muokkaa / Jatka muokkausta","L"],["act:send-offer","Lähetä tarjous","Y"],["act:accept-offer","Merkitse hyväksytyksi","G"],["act:reject-offer","Hylkää tarjous","R"],["act:delete-offer","Poista tarjous","R"],["act:create-order","Luo tilaus","O"],["act:create-order-prod","Luo tilaus ja aloita tuotanto","O"],["open","Avaa tilaus / tarjous","B"],["act:copy-offer","Kopioi uudeksi tarjoukseksi","L"]]],
  ["Tilauksen työnkulku", [["act:start-prod","Aloita tuotanto","O"],["act:edit-order","Muokkaa tilausta","L"],["act:copy-order","Kopioi uudeksi tilaukseksi","L"],["act:delete-order","Poista tilaus","R"],["act:save-wo","Tallenna työmääräys","G"],["act:save-costs","Tallenna kustannukset","G"],["act:finish-prod","Kuittaa valmiiksi","G"],["act:to-invoice","Siirrä laskun tarkastukseen","Y"],["act:approve-invoice","Hyväksy lasku","G"],["act:back-to-order","Takaisin tilaukseen","W"]]],
  ["Dokumentit", [["doc:offer","Tarjous","B"],["doc:orderconf","Tilausvahvistus","B"],["doc:workcard","Työkortti","B"],["doc:delivery","Lähete","B"],["doc:label","Lähetyslappu","B"],["doc:receipt","Käteiskuitti","B"],["doc:invoice","Lasku / Laskun tarkastus","B"]]],
  ["Asiakkaat", [["act:new-customer","+ Uusi asiakas","O"],["act:edit-customer","Muokkaa asiakasta","L"],["act:cust-offer","+ Uusi tarjous asiakkaalle","O"],["act:cust-order","+ Uusi tilaus asiakkaalle","O"],["ed:add-contact","+ Lisää yhteyshenkilö","W"],["ed:add-address","+ Lisää toimitusosoite","W"],["ed:save-customer","Tallenna asiakas","G"]]],
  ["Tuotteet ja hinnat", [["act:new-product","+ Oma tuote","O"],["prod-offer","Tee tarjous","O"],["prod-calc","Laske (pikalaskuri)","B"],["prod-edit","Muokkaa tuotetta","L"],["ed:add-conf","+ Lisää hintaporras / valinta / vaihtoehto","W"],["ed:reset-pconf","Palauta oletusvalinnat","H"],["ed:save-product","Tallenna tuote","G"],["ed:delete-product","Poista tuote","R"]]],
  ["Alihankkijat", [["act:new-supplier","+ Uusi alihankkija","O"],["act:edit-supplier","Muokkaa alihankkijaa","L"],["ed:save-supplier","Tallenna alihankkija","G"],["ed:delete-supplier","Poista alihankkija","R"]]],
  ["Pikalaskuri ja markkinointi", [["act:calc-to-offer","Tee tarjous tästä (pikalaskuri)","O"],["act:calc-add-extra","+ Lisää oma lisätyö (hinnoittelu)","W"],["act:calc-del-extra","Poista oma lisätyö","R"],["act:mkt-all","Valitse kaikki","H"],["act:mkt-none","Tyhjennä valinnat","W"],["act:copy-bcc","Kopioi BCC-lista","H"],["mailto","Avaa sähköpostissa","B"]]],
  ["Arkisto ja ylläpito", [["act:clear-archive","Tyhjennä haku","W"],["act:save-admin","Tallenna ylläpidon muutokset","G"],["act:save-pricelist","Tallenna perushinnasto","G"],["act:reset-tones","Palauta oletusvärit","W"],["act:export-data","Luo varmuuskopio","B"],["act:copy-export","Kopioi varmuuskopio","H"],["act:import-data","Tuo tiedot","O"]]]
];
const BTN_DEFAULT = Object.fromEntries(BTN_REG.flatMap(([, list]) => list.map(([k, , t]) => [k, t])));

let themeDraft = null;      // admin's unsaved theme while on the admin page
let lastTone = "O";         // tone of the last clicked button, reused by its confirmation dialog
const theme = () => themeDraft || S.settings.theme || DEFAULT_THEME();
function applyTheme(){
  const t = theme();
  Object.keys(TONES).forEach(k => document.documentElement.style.setProperty("--t-" + k, t.tones?.[k] || TONES[k][1]));
  Object.keys(BG_DEFAULTS).forEach(k => document.documentElement.style.setProperty("--" + k, t.bg?.[k] || BG_DEFAULTS[k]));
}
function btnKey(el){
  const d = el.dataset;
  if (d.btn) return d.btn;
  if (d.act) return "act:" + d.act;
  if (d.ed) { if (/^del-/.test(d.ed)) return "ed:del"; if (/^(add-pe|add-pg|add-pc|add-pt|add-pp|up-pc)$/.test(d.ed)) return "ed:add-conf"; return "ed:" + d.ed; }
  if (d.doc) return "doc:" + d.doc;
  if (d.back) return "back";
  if (d.nav) return "nav";
  if (d.openOrder || d.openOffer) return "open";
  if (d.prodOffer) return "prod-offer";
  if (d.prodCalc) return "prod-calc";
  if (d.prodEdit) return "prod-edit";
  if (el.tagName === "A" && /^mailto:/.test(el.getAttribute("href") || "")) return "mailto";
  return null;
}
const toneOf = key => theme().buttons?.[key] || (key.startsWith("doc:") && theme().buttons?.doc) || BTN_DEFAULT[key] || null;
function applyTones(root = document){
  root.querySelectorAll(".btn").forEach(el => {
    if (el.dataset.fixedTone) return;
    const k = btnKey(el); const t = k && toneOf(k); if (!t) return;
    el.classList.remove("primary", "go", "good", "bad", "ghost", "t-O", "t-Y", "t-G", "t-B", "t-L", "t-H", "t-W", "t-R");
    el.classList.add("t-" + t);
  });
}

/* ================= Admin ================= */
function lum(hex){ const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return 1; const c = [0, 2, 4].map(i => { const v = parseInt(m[1].slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function adminView(){
  if (!isAdmin) return `<div class="empty">Ylläpito on vain ylläpitäjille.</div>`;
  if (!themeDraft) themeDraft = clone(S.settings.theme || DEFAULT_THEME());
  themeDraft.bg = {...BG_DEFAULTS, ...(themeDraft.bg || {})};
  const t = themeDraft, s = S.settings;
  const toneSel = (key) => `<select data-bmap="${key}" aria-label="Väri">${Object.entries(TONES).map(([k, v]) => `<option value="${k}" ${toneOf(key) === k ? "selected" : ""}>${esc(v[0].split(" – ")[0])}</option>`).join("")}</select>`;
  const f = (k, l) => `<label class="f">${l}<input type="text" ${/cost|fee|terms|vat|margin|Validity/i.test(k) ? 'inputmode="decimal"' : ""} data-se="${k}" value="${esc(s[k])}"></label>`;
  return `<div class="head"><div><h1>Ylläpito</h1><div class="sub">Painikkeiden värit, perushinnasto, hinnoittelun oletukset ja yritystiedot. Näkyy vain ylläpitäjille.</div></div></div>
  <div class="form" id="admin">
  <fieldset><legend>Värit</legend><p class="sub small" style="margin:0 0 10px">Samat värit näkyvät myös tilamerkinnöissä: keltainen = odottaa, oranssi = työn alla, vihreä = valmis.</p>
    <div class="tones">${Object.entries(TONES).map(([k, v]) => `<div class="tone"><input type="color" data-tone="${k}" value="${esc(t.tones[k] || v[1])}" aria-label="${esc(v[0])}">
      <div style="display:flex;flex-direction:column;gap:6px"><span class="small" style="font-weight:700">${esc(v[0])}</span><span class="row"><input type="text" data-tonehex="${k}" value="${esc(t.tones[k] || v[1])}" aria-label="Värikoodi"><span class="btn sm t-${k}" data-fixed-tone="1">Esimerkki</span></span></div></div>`).join("")}</div>
    </fieldset>
  <fieldset><legend>Taustavärit</legend><p class="sub small" style="margin:0 0 10px">Teksti on aina tummaa, joten valitse vaaleita sävyjä, jotta kaikki pysyy luettavana.</p>
    <div class="tones">${Object.entries(BG_LABELS).map(([k, l]) => `<div class="tone"><input type="color" data-bg="${k}" value="${esc(t.bg[k])}" aria-label="${esc(l)}">
      <div style="display:flex;flex-direction:column;gap:6px"><span class="small" style="font-weight:700">${esc(l)}</span><input type="text" data-bghex="${k}" value="${esc(t.bg[k])}" aria-label="Värikoodi"><span class="small" data-bgwarn="${k}" style="color:var(--t-R);font-weight:600">${lum(t.bg[k]) < 0.45 ? "Liian tumma – teksti voi olla vaikealukuinen" : ""}</span></div></div>`).join("")}</div>
    <div class="row" style="margin-top:12px"><button class="btn sm" data-act="reset-tones">Palauta kaikki oletusvärit</button></div></fieldset>
  <fieldset><legend>Painikkeet</legend><p class="sub small" style="margin:0 0 6px">Valitse jokaiselle painikkeelle väri. Muutos näkyy heti; tallenna sivun alalaidasta.</p>
    ${BTN_REG.map(([g, list]) => `<h3>${esc(g)}</h3><div class="btnmap">${list.map(([k, label]) => `<div class="bm"><span><span class="btn sm t-${toneOf(k)}" data-fixed-tone="1">${esc(label)}</span></span>${toneSel(k)}</div>`).join("")}</div>`).join("")}
  </fieldset>
  <fieldset><legend>Perushinnasto</legend><p class="sub small" style="margin:0 0 8px">Perushinta ja aloituskustannus jokaiselle tuoteryhmälle. Koot, paperit, lisätyöt ja määräalennukset muokataan tuotteen omalla sivulla.</p>
    <div style="overflow-x:auto"><table class="plist"><thead><tr><th>Tuoteryhmä</th><th>Yksikkö</th><th>Hintataulukko: määrä → hinta € alv 0 %</th><th>Aloitus €</th><th>Kustannus %</th><th></th></tr></thead><tbody>
    ${products().map(p => `<tr><td><b>${esc(p.name)}</b><br><span class="small sub">${(p.options || []).length} valintaa · ${(p.extras || []).length} lisätyötä</span></td><td><input type="text" data-pl="${p.id}.unit" value="${esc(p.unit)}" style="max-width:64px"></td>
      <td><div class="ptab">${(p.prices || []).map((t, i) => `<span class="pt"><input type="text" inputmode="numeric" data-plt="${p.id}.${i}.qty" value="${esc(t.qty)}" aria-label="Määrä"><span>→</span><input type="text" inputmode="decimal" data-plt="${p.id}.${i}.price" value="${esc(t.price)}" aria-label="Hinta €"></span>`).join("") || `<span class="small sub">Ei taulukkoa – perushinta ${eur4(num(p.baseCost))} / ${esc(p.unit)}</span>`}</div></td>
      <td><input type="text" inputmode="decimal" data-pl="${p.id}.startCost" value="${esc(p.startCost)}" style="max-width:80px"></td><td><input type="text" inputmode="decimal" data-pl="${p.id}.costPct" value="${esc(p.costPct)}" style="max-width:64px" aria-label="Kustannusosuus %"></td><td><button class="btn sm" data-prod-edit="${p.id}">Muokkaa tuotetta</button></td></tr>`).join("")}
    </tbody></table></div>
    <div class="row" style="margin-top:12px;justify-content:space-between"><button class="btn sm" data-act="new-product">+ Oma tuote</button><button class="btn" data-act="save-pricelist">Tallenna perushinnasto</button></div></fieldset>
  <fieldset><legend>Hinnoittelun oletukset</legend><div class="grid">${f("startCost", "Aloituskustannus €")}${f("billingFee", "Laskutuslisä €")}${f("terms", "Maksuehto pv")}${f("vat", "Alv %")}${f("margin", "Oletuskate %")}${f("offerValidity", "Tarjouksen voimassaolo pv")}</div>
    <h3>Katelaskenta</h3><div class="grid">${f("hourlyCost", "Tuntikustannus €/h")}${f("costPct", "Oletuskustannusosuus %")}${f("extrasCostPct", "Lisätöiden kustannusosuus %")}</div>
    <p class="sub small" style="margin:10px 0 0">Ulkomaisille asiakkaille alv 0 % valitaan automaattisesti asiakkaan maan mukaan: EU-maat = yhteisömyynti (vaatii ALV-tunnisteen), muut = vienti. Valintaa voi muuttaa tarjouksella ja tilauksella.</p></fieldset>
  <fieldset><legend>Yritystiedot dokumentteihin</legend><div class="grid">${f("name", "Yrityksen nimi")}${f("ytunnus", "Y-tunnus")}${f("street", "Katuosoite")}${f("postcode", "Postinumero")}${f("city", "Postitoimipaikka")}${f("phone", "Puhelin")}${f("email", "Sähköposti")}${f("web", "Verkkosivu")}${f("iban", "IBAN")}${f("bic", "BIC")}</div></fieldset>
  <fieldset><legend>Varmuuskopio ja siirto</legend><p class="sub small" style="margin:0 0 10px">Siirrä kaikki tiedot toiseen paikkaan (esim. Haileriin): luo varmuuskopio, kopioi teksti ja liitä se uuden paikan Tuo tiedot -kenttään. Tuonti lisää ja päivittää tietueita, se ei poista mitään.</p>
    <div class="row"><button class="btn" data-act="export-data">Luo varmuuskopio</button><button class="btn" data-act="copy-export">Kopioi</button></div>
    <label class="f" style="margin-top:10px"><span class="sr">Varmuuskopio</span><textarea id="exportbox" readonly style="min-height:90px;font-family:ui-monospace,monospace;font-size:12px" placeholder="Paina Luo varmuuskopio"></textarea></label>
    <label class="f" style="margin-top:14px">Tuo tiedot (liitä varmuuskopio)<textarea id="importbox" style="min-height:90px;font-family:ui-monospace,monospace;font-size:12px"></textarea></label>
    <div class="row" style="margin-top:8px"><button class="btn" data-act="import-data">Tuo tiedot</button></div></fieldset>
  <div class="sticky-bar"><button class="btn" data-back="dashboard">Peruuta</button><button class="btn" data-act="save-admin">Tallenna ylläpidon muutokset</button></div>
  </div>`;
}

/* ================= routing ================= */
const LS = {}; // per-view list state: filter, q, scroll
const ls = v => LS[v] = LS[v] || {filter:"Kaikki", q:"", scroll:0};
let route = {view:"dashboard", id:""};
let editing = null;
let depth = 0;
function parseHash(){
  const h = location.hash.replace(/^#\/?/, "");
  const [view, id] = h.split("/");
  return {view: view || "dashboard", id: id ? decodeURIComponent(id) : ""};
}
function saveScroll(){ if (!route.id && route.view !== "edit") ls(route.view).scroll = window.scrollY; }
function go(view, id = "", {replace = false} = {}){
  saveScroll();
  const h = "#/" + view + (id ? "/" + encodeURIComponent(id) : "");
  if (replace) history.replaceState({d:depth}, "", h); else history.pushState({d:++depth}, "", h);
  applyRoute();
}
function goBack(fallback){ if (depth > 0) history.back(); else go(fallback, "", {replace:true}); }
function applyRoute(){
  const r = parseHash();
  if (r.view === "edit" && !editing) { history.replaceState({d:depth}, "", "#/dashboard"); route = {view:"dashboard", id:""}; }
  else { if (r.view !== "edit") editing = null; route = r; }
  pageDirty = false;
  if (route.view !== "admin" && route.view !== "settings" && themeDraft) { themeDraft = null; }
  try { if (route.view !== "edit") sessionStorage.setItem("copyset-last", location.hash); } catch(e){}
  render();
  const s = !route.id && route.view !== "edit" ? ls(route.view).scroll : 0;
  window.scrollTo(0, s || 0);
}
window.addEventListener("popstate", e => { depth = e.state?.d || 0; applyRoute(); });

const NAV = [["offers","Tarjoukset"],["orders","Tilaukset"],["archive","Arkisto"],null,
  ["customers","Asiakkaat"],["products","Tuotteet & hinnat"],["suppliers","Alihankkijat"],["marketing","Markkinointi"],null,["admin","Ylläpito"],["dashboard","Dashboard"]];
const NAV_ICONS = {
  offers:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h4"/>',
  orders:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 10l1.5 1.5L13 9M9 15h6"/>',
  archive:'<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9"/><path d="M10 13h4"/>',
  customers:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.6 3.2-6 6.5-6s6 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.4c2 .8 3.3 2.9 3.5 5.6"/>',
  products:'<path d="M3 12.5V4h8.5L21 13.5 13.5 21z"/><circle cx="8" cy="8.5" r="1.6"/>',
  suppliers:'<path d="M2 6h11v10H2z"/><path d="M13 9h4.5l3.5 4v3h-8"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/>',
  pricing:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01M8.5 18h.01M12 18h.01M15.5 18h.01" stroke-width="2.4"/>',
  marketing:'<path d="M3 10v4h3l7 4V6L6 10z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>',
  admin:'<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/><path d="M4 12h2M10 12h10"/><circle cx="8" cy="12" r="2"/>',
  dashboard:'<rect x="3.5" y="3.5" width="7" height="8" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.5"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.5"/><rect x="3.5" y="14.5" width="7" height="6" rx="1.5"/>'
};
const SECTION = {offer:"offers", order:"orders", customer:"customers", supplier:"suppliers", product:"products"};
function navHTML(){
  const cnt = {
    offers: Object.values(S.offers).filter(o => !["Hylätty"].includes(o.status) && !(o.status === "Hyväksytty" && o.orderId)).length,
    orders: Object.values(S.orders).filter(o => o.status !== "Laskutettu").length,
    archive: Object.values(S.orders).filter(o => o.status === "Laskutettu").length,
    customers: Object.keys(S.customers).length, suppliers: Object.keys(S.suppliers).length, products: Object.keys(S.products).length };
  let cur = SECTION[route.view] || route.view;
  if (route.view === "order" && S.orders[route.id]?.status === "Laskutettu") cur = "archive";
  if (route.view === "edit" && editing) cur = SECTION[editing.kind] || cur;
  if (cur === "settings") cur = "admin";
  return NAV.filter(n => !n || n[0] !== "admin" || isAdmin).map(n => n ? `<button class="nav" data-nav="${n[0]}" ${cur === n[0] ? 'aria-current="page"' : ""}><svg class="ni" viewBox="0 0 24 24" aria-hidden="true">${NAV_ICONS[n[0]] || ""}</svg><span class="nl">${n[1]}</span>${cnt[n[0]] != null ? `<span class="n${cnt[n[0]] ? "" : " zero"}" aria-label="${cnt[n[0]]} kpl">${cnt[n[0]]}</span>` : ""}</button>` : `<div class="navsep"></div>`).join("");
}

function render(fromSnapshot){
  $("#snav").innerHTML = navHTML();
  document.body.classList.toggle("editing", route.view === "edit");
  applyTheme();
  const v = route.view, m = $("#main"), id = route.id;
  const y = window.scrollY;
  if (v === "edit" && editing) { m.innerHTML = editorHTML(); afterEditorRender(); applyTones(); return; }
  const views = {
    dashboard, offers: offerList, offer: () => offerView(S.offers[id]), orders: () => orderList(false), archive: archiveView,
    order: () => orderView(S.orders[id]), customers: customerList, customer: () => customerView(S.customers[id]),
    products: productList, suppliers: supplierList, supplier: () => supplierView(S.suppliers[id]),
    pricing: () => { history.replaceState({d:depth}, "", "#/products"); route = {view:"products", id:""}; return productList(); }, marketing: marketingView, settings: adminView, admin: adminView };
  m.innerHTML = (views[v] || dashboard)();
  applyTones();
  fitSheets();
  if (fromSnapshot) window.scrollTo(0, y);
}

/* ================= list helper: table on desktop, cards on mobile ================= */
function listBlock(cols, rows, empty){
  if (!rows.length) return `<div class="table-wrap"><div class="empty">${empty}</div></div>`;
  return `<div class="table-wrap desk"><table class="list"><thead><tr>${cols.map(c => `<th class="${c.r ? "r" : ""}">${c.h}</th>`).join("")}</tr></thead><tbody>
  ${rows.map(r => `<tr ${r.attr || ""}>${r.cells.map((x, i) => `<td class="${cols[i].cls || ""}">${x}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
  <div class="cards">${rows.map(r => `<button class="card" ${r.attr || ""}><div class="card-top"><b>${r.title}</b><span class="num">${r.right || ""}</span></div><div class="card-sub">${r.sub || ""}</div>${r.badge || ""}</button>`).join("")}</div>`;
}
function backBtn(fallback, label = "Takaisin"){ return `<button class="back" data-back="${fallback}">← ${label}</button>`; }
function searchBox(view, ph){ return `<input type="search" class="search" data-q="${view}" value="${esc(ls(view).q)}" placeholder="${esc(ph)}" aria-label="Haku">`; }
function matchQ(q, ...vals){ q = (q || "").trim().toLowerCase(); if (!q) return true; return q.split(/\s+/).every(w => vals.some(v => String(v ?? "").toLowerCase().includes(w))); }

/* ================= Dashboard ================= */
function rangeFor(p){
  const n = new Date(); let a, b;
  if (p === "Päivä") a = b = new Date(n);
  else if (p === "Viikko") { a = new Date(n); a.setDate(n.getDate() - ((n.getDay() + 6) % 7)); b = new Date(a); b.setDate(a.getDate() + 6); }
  else if (p === "Kuukausi") { a = new Date(n.getFullYear(), n.getMonth(), 1); b = new Date(n.getFullYear(), n.getMonth() + 1, 0); }
  else { a = new Date(n.getFullYear(), 0, 1); b = new Date(n.getFullYear(), 11, 31); }
  return [isoLocal(a), isoLocal(b)];
}
function dashboard(){
  const st = ls("dashboard");
  if (!st.period) { st.period = "Kuukausi"; [st.from, st.to] = rangeFor("Kuukausi"); }
  const inR = d => { d = dayOf(d); return d && d >= st.from && d <= st.to; };
  const orders = Object.values(S.orders);
  const inPeriod = orders.filter(o => inR(o.date || o.createdAt));
  const sales = inPeriod.reduce((a, o) => a + totals(o).net, 0);
  const invoiced = orders.filter(o => o.status === "Laskutettu" && inR(o.invoicedAt));
  const invSum = invoiced.reduce((a, o) => a + totals(o).net, 0);
  const prod = orders.filter(o => o.status === "Tuotannossa").length;
  const ready = orders.filter(o => o.status === "Valmis" || o.status === "Laskutusvalmis").length;
  const byGroup = {}, byCust = {};
  inPeriod.forEach(o => {
    const t = totals(o), f = t.sub ? (t.sub - t.disc) / t.sub : 1;
    o.items.forEach(i => { const g = i.group || OWN; byGroup[g] = (byGroup[g] || 0) + num(i.qty) * num(i.price) * f; });
    if (t.extras) byGroup["Lisätyöt"] = (byGroup["Lisätyöt"] || 0) + t.extras * f;
    const cn = cust(o).name || "–"; byCust[cn] = (byCust[cn] || 0) + t.net;
  });
  const m = inPeriod.map(o => ({o, ...marginOf(o)}));
  const mSum = m.reduce((a, x) => a + x.margin, 0);
  const offersIn = Object.values(S.offers).filter(o => inR(o.date || o.createdAt));
  const hr = hitRate(offersIn);
  const custRows = {};
  m.forEach(x => { const k = x.o.customerId || cust(x.o).name || "–"; const c = custRows[k] = custRows[k] || {name:cust(x.o).name || "–", id:x.o.customerId, net:0, margin:0, jobs:0}; c.net += x.net; c.margin += x.margin; c.jobs++; });
  offersIn.forEach(o => { const k = o.customerId || cust(o).name || "–"; custRows[k] = custRows[k] || {name:cust(o).name || "–", id:o.customerId, net:0, margin:0, jobs:0}; });
  Object.entries(custRows).forEach(([k, c]) => { c.hr = hitRate(offersIn.filter(o => (o.customerId || cust(o).name || "–") === k)); });
  const custList = Object.values(custRows).sort((a, b) => b.margin - a.margin);
  const jobList = m.sort((a, b) => (b.o.date || "").localeCompare(a.o.date || "")).slice(0, 20);
  const bars = (obj, cls = "") => { const e = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 12); const mx = Math.max(1, ...e.map(x => x[1]));
    return e.length ? `<div class="bars ${cls}">${e.map(([k, v]) => `<div class="bar"><span class="l" title="${esc(k)}">${esc(k)}</span><span class="t"><i style="width:${(v / mx * 100).toFixed(1)}%"></i></span><span class="num">${eur(v)}</span></div>`).join("")}</div>` : `<p class="sub">Ei myyntiä valitulla aikavälillä.</p>`; };
  return `<div class="head"><div><h1>Dashboard</h1><div class="sub">${fdate(st.from)} – ${fdate(st.to)} · lasketaan tilausten päiväyksestä</div></div>
</div>
  <div class="chips">${["Päivä","Viikko","Kuukausi","Vuosi","Oma väli"].map(p => `<button class="chip" data-period="${p}" aria-pressed="${st.period === p}">${p}</button>`).join("")}</div>
  <div class="range"><label class="f">Alkaen<input type="date" data-range="from" value="${esc(st.from)}"></label><label class="f">Saakka<input type="date" data-range="to" value="${esc(st.to)}"></label></div>
  <div class="kpis">
    <div class="kpi"><b>${eur(sales)}</b><span>Myynti alv 0 · ${inPeriod.length} tilausta</span></div>
    <div class="kpi"><b>${eur(inPeriod.length ? sales / inPeriod.length : 0)}</b><span>Keskimääräinen tilaus</span></div>
    <div class="kpi"><b>${prod}</b><span>Tuotannossa nyt</span></div>
    <div class="kpi"><b>${ready}</b><span>Valmiina, odottaa laskutusta</span></div>
    <div class="kpi"><b>${eur(invSum)}</b><span>Laskutettu alv 0 · ${invoiced.length} kpl</span></div>
    <div class="kpi"><b>${eur(mSum)}</b><span>Kate · ${pctTxt(sales ? mSum / sales * 100 : null)} myynnistä</span></div>
    <div class="kpi"><b>${pctTxt(hr.pct)}</b><span>Tarjousten voittoprosentti · ${hr.won}/${hr.won + hr.lost} ratkaistua</span></div>
  </div>
  <div class="two"><div class="panel"><h2>Myynti tuoteryhmittäin</h2>${bars(byGroup)}</div><div class="panel"><h2>Myynti asiakkaittain</h2>${bars(byCust, "m")}</div></div>
  <div class="panel" style="margin-top:16px"><h2>Tarjoukset</h2>
    <div class="kpis" style="margin-bottom:0">
      <div class="kpi"><b>${pctTxt(hr.pct)}</b><span>Voittoprosentti kappaleista</span></div>
      <div class="kpi"><b>${pctTxt(hr.valuePct)}</b><span>Voittoprosentti arvosta · ${eur(hr.wonValue)} voitettu</span></div>
      <div class="kpi"><b>${hr.won} / ${hr.lost}</b><span>Hyväksytty / hylätty</span></div>
      <div class="kpi"><b>${hr.open}</b><span>Avoinna · ${eur(hr.openValue)}</span></div>
    </div><p class="sub small" style="margin:10px 0 0">Tarjoukset, joiden päiväys on valitulla aikavälillä. Luonnokset ja avoimet tarjoukset eivät vaikuta prosenttiin.</p></div>
  <div class="panel" style="margin-top:16px"><h2>Kate ja voittoprosentti asiakkaittain</h2>
    ${custList.length ? `<div style="overflow-x:auto"><table class="list"><thead><tr><th>Asiakas</th><th class="r">Myynti alv 0</th><th class="r">Kate €</th><th class="r">Kate %</th><th class="r">Tilauksia</th><th class="r">Tarjouksia (voitettu / ratkaistu)</th><th class="r">Voitto-%</th></tr></thead><tbody>
    ${custList.map(c => `<tr ${c.id && S.customers[c.id] ? `data-open-customer="${c.id}"` : ""}><td class="id">${esc(c.name)}</td><td class="r num">${eur(c.net)}</td><td class="r num">${eur(c.margin)}</td><td class="r num"${marginCls(c.net ? c.margin / c.net * 100 : 100)}>${pctTxt(c.net ? c.margin / c.net * 100 : null)}</td><td class="r num">${c.jobs}</td><td class="r num">${c.hr.won} / ${c.hr.won + c.hr.lost}</td><td class="r num">${pctTxt(c.hr.pct)}</td></tr>`).join("")}
    </tbody></table></div>` : `<p class="sub">Ei tilauksia tai tarjouksia valitulla aikavälillä.</p>`}</div>
  <div class="panel" style="margin-top:16px"><h2>Kate töittäin</h2>
    ${jobList.length ? `<div style="overflow-x:auto"><table class="list"><thead><tr><th>Tilaus</th><th>Asiakas</th><th>Tila</th><th class="r">Myynti alv 0</th><th class="r">Kustannus</th><th class="r">Kate €</th><th class="r">Kate %</th><th>Peruste</th></tr></thead><tbody>
    ${jobList.map(x => `<tr data-open-order="${x.o.id}"><td class="id">${esc(x.o.no)}</td><td>${esc(cust(x.o).name || "–")}</td><td>${orderBadge(x.o)}</td><td class="r num">${eur(x.net)}</td><td class="r num">${eur(x.cost)}</td><td class="r num">${eur(x.margin)}</td><td class="r num"${marginCls(x.pct)}>${pctTxt(x.pct)}</td><td class="small">${x.actual ? "Toteuma" : "Arvio"}</td></tr>`).join("")}
    </tbody></table></div><p class="sub small" style="margin:10px 0 0">Arvio lasketaan tuotteiden kustannusosuuksista (Ylläpito). Kun tilaukselle kirjataan toteutuneet kustannukset, käytetään niitä. Alle 20 %:n kate näkyy punaisena.</p>` : `<p class="sub">Ei tilauksia valitulla aikavälillä.</p>`}</div>`;
}

/* ================= Offers ================= */
function offerList(){
  const st = ls("offers");
  const all = Object.values(S.offers).sort((a, b) => (b.no || "").localeCompare(a.no || ""));
  const f = st.filter;
  const rows = all.filter(o => (f === "Kaikki" || o.status === f) && matchQ(st.q, o.no, cust(o).name, cust(o).contactName, o.customerRef, ...o.items.map(i => i.product)));
  const count = s => all.filter(o => o.status === s).length;
  return `<div class="head"><div><h1>Tarjoukset</h1><div class="sub">Tarjous siirtyy tilaukseksi vasta, kun merkitset sen hyväksytyksi ja luot tilauksen.</div></div>
</div>
  <div class="toolbar">${searchBox("offers", "Hae numerolla, asiakkaalla, tuotteella tai viitteellä")}</div>
  <div class="chips">${["Kaikki", ...OFFER_ST].map(s => `<button class="chip" data-filter="${s}" aria-pressed="${f === s}">${s} ${s === "Kaikki" ? all.length : count(s)}</button>`).join("")}</div>
  ${listBlock([{h:"Numero", cls:"id"},{h:"Asiakas"},{h:"Tuotteet"},{h:"Deadline", cls:"num"},{h:"Tila"},{h:"Yhteensä alv 0", r:1, cls:"r num"}],
    rows.map(o => ({attr:`data-open-offer="${o.id}"`, cells:[esc(o.no), esc(cust(o).name || "–"), esc(o.items.map(i => i.product).filter(Boolean).join(", ") || "–"), fdate(o.deadline), badge(o.status) + (o.orderId ? ` <span class="sub small">→ ${esc(S.orders[o.orderId]?.no || "tilaus")}</span>` : ""), eur(totals(o).net)],
      title:esc(o.no), right:eur(totals(o).net), sub:`${esc(cust(o).name || "–")} · deadline ${fdate(o.deadline)}`, badge:badge(o.status)})),
    all.length ? "Haulla ei löytynyt tarjouksia." : `Ei vielä tarjouksia.<br><button class="btn primary" data-act="new-offer">+ Uusi tarjous</button>`)}`;
}
function flow(list, current, rejected){
  const idx = list.indexOf(current);
  return `<div class="flow" aria-label="Työnkulku">${list.map((s, i) => {
    if (!rejected && s === "Hylätty") return "";
    if (rejected && s === "Hyväksytty") return "";
    let c = i < idx ? "done" : i === idx ? "now" : "";
    if (rejected && s === "Hylätty") c = "stop";
    return `<span class="${c}">${esc(s)}</span>`;
  }).join("")}</div>`;
}
const histPanel = r => `<div class="panel"><h2>Tapahtumahistoria</h2><ul class="hist">${(r.history || []).map(h => `<li><time>${fdt(h.at)}</time>${esc(h.text)}</li>`).join("") || "<li>–</li>"}</ul></div>`;
const attachPanel = r => (r.attachments || []).length ? `<div class="panel"><h2>Liitteet</h2><ul class="files">${r.attachments.map(a => `<li><span>${esc(a.name)}</span><span class="sub">${Math.ceil((a.size || 0) / 1024)} kt</span></li>`).join("")}</ul></div>` : "";
function offerView(o){
  if (!o) return `${backBtn("offers")}<div class="empty">Tarjousta ei löytynyt.</div>`;
  const a = [];
  if (o.status === "Luonnos") a.push(`<button class="btn primary" data-act="edit-offer">Jatka muokkausta</button>`);
  if (o.status === "Valmis lähetettäväksi") a.push(`<button class="btn go" data-act="send-offer">Lähetä tarjous</button>`, `<button class="btn" data-act="edit-offer">Muokkaa</button>`);
  if (o.status === "Luonnos" || o.status === "Valmis lähetettäväksi") a.push(`<button class="btn" data-act="delete-offer">Poista tarjous</button>`);
  if (o.status === "Lähetetty") a.push(`<button class="btn good" data-act="accept-offer">Merkitse hyväksytyksi</button>`, `<button class="btn" data-act="edit-offer">Muokkaa</button>`, `<button class="btn bad" data-act="reject-offer">Hylkää tarjous</button>`);
  if (o.status === "Hyväksytty" && !(o.orderId && S.orders[o.orderId])) a.push(`<button class="btn go" data-act="create-order">Luo tilaus</button>`, `<button class="btn" data-act="create-order-prod">Luo tilaus ja aloita tuotanto</button>`);
  if (o.orderId && S.orders[o.orderId]) a.push(`<button class="btn go" data-open-order="${o.orderId}">Avaa tilaus ${esc(S.orders[o.orderId].no)}</button>`);
  if (o.status === "Hylätty" || o.status === "Hyväksytty") a.push(`<button class="btn" data-act="copy-offer">Kopioi uudeksi tarjoukseksi</button>`);
  a.push(`<button class="btn ghost" data-back="offers">Sulje</button>`);
  return `${backBtn("offers", "Tarjoukset")}<div class="head"><div><h1>${esc(o.no)}</h1><div class="sub">${o.customerId && S.customers[o.customerId] ? `<button class="link" data-open-customer="${o.customerId}">${esc(cust(o).name)}</button>` : esc(cust(o).name || "Ei asiakasta")} ${badge(o.status)}</div></div></div>
  ${flow(OFFER_ST, o.status, o.status === "Hylätty")}
  <div class="layout"><div class="sheet-fit">${docOffer(o)}</div>
  <div><div class="panel"><h2>Toiminnot</h2><div class="actions">${a.join("")}</div></div>
  <div class="panel"><h2>Dokumentit</h2><div class="doclinks"><button class="btn sm" data-doc="offer">Tarjous</button></div></div>
  ${marginPanel(o, false)}${attachPanel(o)}${histPanel(o)}</div></div>`;
}

/* ================= Orders ================= */
function orderRows(list){
  return list.map(o => ({attr:`data-open-order="${o.id}"`,
    cells:[esc(o.no), esc(cust(o).name || "–"), esc(o.items.map(i => i.product).filter(Boolean).join(", ") || "–"), fdate(o.status === "Laskutettu" ? o.invoicedAt : o.deadline),
      orderBadge(o) + (o.productionMethod === "Alihankkija" ? ` <span class="sub small">· ${esc(S.suppliers[o.supplierId]?.name || "Alihankkija")}</span>` : ""), eur(totals(o).net), (m => `<span${marginCls(m.pct)} title="${m.actual ? "Toteuma" : "Arvio"}: ${eur(m.margin)}">${pctTxt(m.pct)}${m.actual ? "" : "*"}</span>`)(marginOf(o))],
    title:esc(o.no), right:eur(totals(o).net), sub:`${esc(cust(o).name || "–")} · ${o.status === "Laskutettu" ? "laskutettu " + fdate(o.invoicedAt) : "deadline " + fdate(o.deadline)}`, badge:orderBadge(o)}));
}
const ORDER_COLS = d => [{h:"Numero", cls:"id"},{h:"Asiakas"},{h:"Tuotteet"},{h:d, cls:"num"},{h:"Tila"},{h:"Yhteensä alv 0", r:1, cls:"r num"},{h:"Kate", r:1, cls:"r num"}];
function orderList(){
  const st = ls("orders");
  const all = Object.values(S.orders).filter(o => o.status !== "Laskutettu").sort((a, b) => (b.no || "").localeCompare(a.no || ""));
  const rows = all.filter(o => (st.filter === "Kaikki" || o.status === st.filter) && matchQ(st.q, o.no, cust(o).name, o.customerRef, o.reference, ...o.items.map(i => i.product)));
  return `<div class="head"><div><h1>Tilaukset</h1><div class="sub">Jokainen tilan muutos tehdään omalla painikkeella. Dokumenttien avaaminen tai tulostus ei muuta tilaa.</div></div>
</div>
  <div class="toolbar">${searchBox("orders", "Hae numerolla, asiakkaalla, tuotteella tai viitteellä")}</div>
  <div class="chips">${["Kaikki", ...ORDER_ST.slice(0, 4)].map(s => `<button class="chip" data-filter="${s}" aria-pressed="${st.filter === s}">${s} ${s === "Kaikki" ? all.length : all.filter(o => o.status === s).length}</button>`).join("")}</div>
  ${listBlock(ORDER_COLS("Deadline"), orderRows(rows), all.length ? "Haulla ei löytynyt tilauksia." : "Ei aktiivisia tilauksia. Luo tilaus hyväksytystä tarjouksesta tai suoraan.")}`;
}
function archiveView(){
  const st = ls("archive");
  const all = Object.values(S.orders).filter(o => o.status === "Laskutettu").sort((a, b) => (b.invoicedAt || "").localeCompare(a.invoicedAt || ""));
  const rows = all.filter(o => {
    const d = dayOf(o.invoicedAt), od = dayOf(o.date);
    if (st.from && !(d >= st.from || od >= st.from)) return false;
    if (st.to && !(d <= st.to || od <= st.to)) return false;
    return matchQ(st.q, o.no, o.offerNo, cust(o).name, cust(o).ytunnus, o.customerRef, o.reference, ...o.items.map(i => i.product + " " + (i.group || "")));
  });
  return `<div class="head"><div><h1>Arkisto</h1><div class="sub">Vanhat laskutetut työt. Avaa työ tai kopioi se uudeksi tilaukseksi – alkuperäinen ei muutu.</div></div></div>
  <div class="toolbar">${searchBox("archive", "Asiakas, tilausnumero, tuote tai viite")}
  <label class="f" style="width:150px">Alkaen<input type="date" data-arch="from" value="${esc(st.from || "")}"></label>
  <label class="f" style="width:150px">Saakka<input type="date" data-arch="to" value="${esc(st.to || "")}"></label>
  ${st.from || st.to || st.q ? `<button class="btn sm ghost" data-act="clear-archive" style="align-self:end">Tyhjennä haku</button>` : ""}</div>
  <p class="sub small" style="margin:-4px 0 10px">${rows.length} / ${all.length} työtä</p>
  ${listBlock(ORDER_COLS("Laskutettu"), orderRows(rows), all.length ? "Haulla ei löytynyt töitä." : "Arkisto on tyhjä. Tilaus siirtyy tänne, kun lasku hyväksytään.")}`;
}
function orderView(o){
  if (!o) return `${backBtn("orders")}<div class="empty">Tilausta ei löytynyt.</div>`;
  const a = [], docs = [];
  const locked = o.status === "Laskutettu";
  let body = "";
  switch (o.status) {
    case "Vahvistettu":
      a.push(`<button class="btn go" data-act="start-prod">Aloita tuotanto</button>`, `<button class="btn" data-act="edit-order">Muokkaa</button>`, `<button class="btn" data-act="copy-order">Kopioi uudeksi tilaukseksi</button>`, `<button class="btn bad" data-act="delete-order">Poista tilaus</button>`);
      docs.push(["orderconf", "Tilausvahvistus"]); body = `<div class="sheet-fit">${docOrderConf(o)}</div>`; break;
    case "Tuotannossa":
      a.push(`<button class="btn good" data-act="finish-prod">Kuittaa valmiiksi</button>`, `<button class="btn" data-act="edit-order">Muokkaa koko tilausta</button>`);
      docs.push(["workcard", "Tulosta työkortti"]); body = workOrderForm(o); break;
    case "Valmis":
      a.push(`<button class="btn go" data-act="to-invoice">Siirrä laskun tarkastukseen</button>`);
      docs.push(["delivery", "Lähete"], ["label", "Lähetyslappu"], ["receipt", "Käteiskuitti"]); body = `<div class="sheet-fit">${docDelivery(o)}</div>`; break;
    case "Laskutusvalmis":
      a.push(`<button class="btn good" data-act="approve-invoice">Hyväksy lasku</button>`, `<button class="btn" data-act="edit-order">Muokkaa</button>`, `<button class="btn" data-act="back-to-order">Takaisin tilaukseen</button>`);
      docs.push(["invoice", "Laskun tarkastus"], ["receipt", "Käteiskuitti"]); body = `<div class="sheet-fit">${docInvoice(o)}</div>`; break;
    case "Laskutettu":
      a.push(`<button class="btn" data-act="copy-order">Kopioi uudeksi tilaukseksi</button>`);
      docs.push(["invoice", "Lasku"], ["receipt", "Käteiskuitti"], ["delivery", "Lähete"], ["label", "Lähetyslappu"], ["workcard", "Työkortti"], ["orderconf", "Tilausvahvistus"]);
      body = `<div class="sheet-fit">${docInvoice(o)}</div>`; break;
  }
  const fb = locked ? "archive" : "orders";
  a.push(`<button class="btn ghost" data-back="${fb}">Sulje</button>`);
  const offer = o.offerId && S.offers[o.offerId];
  const sup = o.productionMethod === "Alihankkija" && S.suppliers[o.supplierId];
  return `${backBtn(fb, locked ? "Arkisto" : "Tilaukset")}<div class="head"><div><h1>${esc(o.no)}</h1><div class="sub">${o.customerId && S.customers[o.customerId] ? `<button class="link" data-open-customer="${o.customerId}">${esc(cust(o).name)}</button>` : esc(cust(o).name || "")} ${orderBadge(o)}</div></div></div>
  ${flow(ORDER_ST, o.status)}
  ${locked ? `<div class="lock">Laskutettu ${fdate(o.invoicedAt)}. Työ on arkistoitu ja vain luku -tilassa. Voit kopioida sen uudeksi tilaukseksi.</div>` : ""}
  <div class="layout"><div>${body}</div>
  <div><div class="panel"><h2>Toiminnot</h2><div class="actions">${a.join("")}</div></div>
  <div class="panel"><h2>Dokumentit</h2><div class="doclinks">${docs.map(([k, l]) => `<button class="btn sm" data-doc="${k}">${l}</button>`).join("")}</div>
  ${offer ? `<p class="sub small" style="margin:12px 0 0">Luotu tarjouksesta <button class="link" data-open-offer="${offer.id}">${esc(offer.no)}</button></p>` : ""}
  ${sup ? `<p class="sub small" style="margin:8px 0 0">Alihankkija <button class="link" data-open-supplier="${sup.id}">${esc(sup.name)}</button></p>` : ""}
  ${o.copiedFrom ? `<p class="sub small" style="margin:8px 0 0">Kopioitu työstä ${esc(o.copiedFrom)}</p>` : ""}</div>
  ${marginPanel(o, true)}${attachPanel(o)}${histPanel(o)}</div></div>`;
}
/* margin panel: estimate on offers, estimate + actual costs (jälkilaskenta) on orders */
function marginPanel(r, editable){
  const m = marginOf(r), c = r.costs || {};
  const f = (k, l) => `<label class="f">${l}<input type="text" inputmode="decimal" data-cost="${k}" value="${esc(c[k] ?? "")}" placeholder="0"></label>`;
  return `<div class="panel" id="costs"><h2>${editable ? "Kate ja jälkilaskenta" : "Arvioitu kate"}</h2>
  <dl class="kv"><dt>Myynti alv 0</dt><dd class="num">${eur(m.net)}</dd><dt>Kustannukset</dt><dd class="num">${eur(m.cost)} <span class="sub small">(${m.actual ? "toteuma" : "arvio"})</span></dd>
  <dt>Kate</dt><dd class="num"><b${marginCls(m.pct)}>${eur(m.margin)} · ${pctTxt(m.pct)}</b></dd></dl>
  ${editable ? `<h3>Toteutuneet kustannukset</h3><div class="grid" style="grid-template-columns:1fr 1fr">${f("material", "Materiaalit €")}${f("hours", `Työtunnit h (${eur(num(S.settings.hourlyCost))}/h)`)}${f("subcontract", "Alihankinta €")}${f("other", "Muut kulut €")}</div>
  <div class="row" style="margin-top:10px"><button class="btn sm" data-act="save-costs">Tallenna kustannukset</button></div>
  <p class="sub small" style="margin:8px 0 0">Tyhjänä kate arvioidaan tuotteiden kustannusosuuksista. Toimituskulut lasketaan aina kustannukseksi.</p>` : `<p class="sub small" style="margin:8px 0 0">Arvio tuotteiden kustannusosuuksista (Ylläpito → Perushinnasto).</p>`}</div>`;
}
function workOrderForm(o){
  const sup = o.productionMethod === "Alihankkija" && S.suppliers[o.supplierId];
  return `<div class="panel"><div class="row" style="justify-content:space-between;margin-bottom:14px"><h2 style="margin:0">Työmääräys</h2>
  <div class="stage" role="group" aria-label="Tuotantovaihe">${STAGES.map(s => `<button data-stage="${s}" aria-pressed="${o.stage === s}">${s}</button>`).join("")}</div></div>
  <div class="form" id="wo">
  ${o.items.map((it, i) => `<fieldset><legend>${esc(it.product || "Tuote " + (i + 1))}</legend><div class="grid">
    <label class="f">Määrä<input type="text" inputmode="decimal" data-wo="${i}.qty" value="${esc(it.qty)}"></label>
    <label class="f">Formaatti<input type="text" data-wo="${i}.format" value="${esc(it.format)}"></label>
    <label class="f">Materiaali<input type="text" data-wo="${i}.material" value="${esc(it.material)}"></label>
    <label class="f">Värit<input type="text" data-wo="${i}.colors" value="${esc(it.colors)}" placeholder="4+4 CMYK"></label>
    <label class="f">Painotiedot<input type="text" data-wo="${i}.printInfo" value="${esc(it.printInfo)}"></label>
    <label class="f wide">Kuvaus<textarea data-wo="${i}.desc">${esc(it.desc)}</textarea></label></div></fieldset>`).join("")}
  <fieldset><legend>Työ</legend><div class="grid">
    <label class="f wide">Työohjeet<textarea data-wof="instructions">${esc(o.instructions)}</textarea></label>
    <label class="f wide">Tuotantomuistiinpanot<textarea data-wof="prodNotes">${esc(o.prodNotes)}</textarea></label></div>
    ${o.extras.length ? `<h3>Lisätyöt</h3><ul class="files">${o.extras.map(x => `<li><span>${esc(x.name)}</span><span class="sub">${xDesc(x)}</span></li>`).join("")}</ul>` : ""}
    <h3>Toimitus</h3><p class="small" style="margin:0">Deadline <b>${fdate(o.deadline)}</b> · ${esc(o.deliveryMethod)}${o.deliveryMethod !== "Nouto" ? " · " + lines(addr(o.delivery)).replace(/<br>/g, ", ") : ""}<br>Tuotanto: ${esc(o.productionMethod)}${sup ? " – " + esc(sup.name) + (sup.leadTime ? ` (toimitusaika ${esc(sup.leadTime)})` : "") : ""}</p>
  </fieldset>
  <div class="row" style="justify-content:flex-end"><button class="btn primary" data-act="save-wo">Tallenna muutokset</button></div>
  </div></div>`;
}

/* ================= A4 documents: one shared frame, same size and layout for every document ================= */
const spec = i => [i.format, i.material, i.colors, i.printInfo, i.optNote].filter(Boolean).join(", ");
function docFoot(){
  const s = S.settings;
  const col = (title, parts) => `<div><b>${esc(title)}</b>${parts.filter(Boolean).map(esc).join("<br>")}</div>`;
  return `<div class="d-foot">${col(s.name, [s.street, [s.postcode, s.city].filter(Boolean).join(" ")])}${col("Yhteystiedot", [s.phone, s.email, s.web])}${col("Pankki", [s.iban && "IBAN " + s.iban, s.bic && "BIC " + s.bic])}${col("Y-tunnus", [s.ytunnus, "Alv-rekisteröity"])}</div>`;
}
function sheet({title, no, meta = [], info = [], body = "", stamp = ""}){
  const s = S.settings;
  return `<div class="a4"><div class="d-bar"></div>${stamp}<div class="d-in">
  <div class="d-head"><div class="d-co"><b>${esc(s.name)}</b><span>${esc([s.street, [s.postcode, s.city].filter(Boolean).join(" ")].filter(Boolean).join(", "))}</span></div>
  <div class="d-title"><h1>${esc(title)}</h1><dl class="d-meta"><dt>Numero</dt><dd>${esc(no)}</dd>${meta.filter(m => m && m[1]).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl></div></div>
  ${info.length ? `<div class="d-info">${info.map(([h, html]) => `<div class="d-box"><h4>${esc(h)}</h4><p>${html || "–"}</p></div>`).join("")}</div>` : `<div style="height:8mm"></div>`}
  ${body}<div class="d-space"></div></div>${docFoot()}</div>`;
}
const joinBr = arr => arr.filter(Boolean).map(esc).join("<br>");
function infoCustomer(r){ const c = cust(r); return `<b>${esc(c.name || "–")}</b>${c.ytunnus ? "<br>Y-tunnus " + esc(c.ytunnus) : ""}${c.vatId ? "<br>ALV-tunniste " + esc(c.vatId) : ""}${isAbroad(c) ? "<br>" + esc(c.country) : ""}${c.contactName || c.email || c.phone ? "<br>" + joinBr([c.contactName, c.email, c.phone]) : ""}`; }
function infoDelivery(r){ return `<b>${esc(r.deliveryMethod)}</b>${r.deliveryMethod !== "Nouto" && addr(r.delivery) ? "<br>" + lines(addr(r.delivery)) : ""}`; }
function infoTerms(r){ return joinBr([`Maksuehto ${termsOf(r)} pv netto`, r.customerRef && "Asiakkaan viite: " + r.customerRef, r.vatMode !== "fi" && VAT_MODES[r.vatMode]]); }
function priceTable(r){
  return `<table class="d-items"><thead><tr><th>Tuote</th><th class="r">Määrä</th><th class="r">À-hinta</th><th class="r">Yhteensä</th></tr></thead><tbody>
  ${r.items.map(i => `<tr><td><b>${esc(i.product)}</b>${spec(i) ? `<small>${esc(spec(i))}</small>` : ""}${i.desc ? `<small>${esc(i.desc)}</small>` : ""}</td><td class="r num">${nfmt(num(i.qty))} ${esc(i.unit || "kpl")}</td><td class="r num">${eur4(num(i.price))}</td><td class="r num">${eur(num(i.qty) * num(i.price))}</td></tr>`).join("")}
  ${r.extras.length ? `<tr class="grp"><td colspan="4">Lisätyöt</td></tr>` + r.extras.map(x => `<tr><td>${esc(x.name)}</td><td class="r num">${xDesc(x)}</td><td class="r num">${xDesc(x) ? eur4(num(x.unitPrice)) : ""}</td><td class="r num">${eur(xTotal(x))}</td></tr>`).join("") : ""}
  </tbody></table>`;
}
function sumBlock(r){
  const t = totals(r);
  return `<div class="d-sum">${t.disc ? `<div><span>Tuotteet ja lisätyöt</span><span>${eur(t.sub)}</span></div><div><span>Asiakasalennus ${pct(t.dp)}</span><span>−${eur(t.disc)}</span></div>` : ""}
  ${t.start ? `<div><span>Aloituskustannus</span><span>${eur(t.start)}</span></div>` : ""}${t.fee ? `<div><span>Laskutuslisä</span><span>${eur(t.fee)}</span></div>` : ""}${t.ship ? `<div><span>Toimituskulut</span><span>${eur(t.ship)}</span></div>` : ""}
  <div><span>Yhteensä alv 0 %</span><span>${eur(t.net)}</span></div><div><span>Alv ${pct(t.vr)}${r.vatMode === "eu" ? " (yhteisömyynti)" : r.vatMode === "export" ? " (vienti)" : ""}</span><span>${eur(t.vat)}</span></div><div class="tot"><span>Yhteensä</span><span>${eur(t.total)}</span></div></div>
  ${VAT_NOTES[r.vatMode] ? `<p style="margin:3mm 0 0;font-size:8pt;color:#5F636A;text-align:right">${esc(VAT_NOTES[r.vatMode])}</p>` : ""}`;
}
function plainTable(r){
  return `<table class="d-items"><thead><tr><th>Tuote</th><th>Tiedot</th><th class="r">Määrä</th></tr></thead><tbody>
  ${r.items.map(i => `<tr><td><b>${esc(i.product)}</b></td><td>${esc(spec(i))}${i.desc ? `<small>${esc(i.desc)}</small>` : ""}</td><td class="r num">${nfmt(num(i.qty))} ${esc(i.unit || "kpl")}</td></tr>`).join("")}
  ${r.extras.length ? `<tr class="grp"><td colspan="3">Lisätyöt</td></tr>` + r.extras.map(x => `<tr><td colspan="2">${esc(x.name)}</td><td class="r num">${xDesc(x)}</td></tr>`).join("") : ""}</tbody></table>`;
}
const note = (title, text) => text ? `<div class="d-note"><b>${esc(title)}</b>${esc(text)}</div>` : "";
function docOffer(o){
  const valid = new Date((o.date || today()) + "T12:00:00"); valid.setDate(valid.getDate() + (num(S.settings.offerValidity) || 30));
  return sheet({title:"Tarjous", no:o.no, meta:[["Päiväys", fdate(o.date)], ["Voimassa", fdate(isoLocal(valid))], ["Toimitus viim.", fdate(o.deadline)]],
    info:[["Asiakas", infoCustomer(o)], ["Toimitus", infoDelivery(o)], ["Ehdot", infoTerms(o)]],
    body:`${o.instructions ? `<p class="d-lead">${esc(o.instructions)}</p>` : ""}${priceTable(o)}${sumBlock(o)}${note("Huomioitavaa", `Tarjous on voimassa ${fdate(isoLocal(valid))} asti. Hinnat alv 0 % ja alv ${pct(totals(o).vr)}.`)}`});
}
function docOrderConf(o){
  return sheet({title:"Tilausvahvistus", no:o.no, meta:[["Päiväys", fdate(o.date)], ["Tarjous", esc(o.offerNo || "")], ["Toimitus viim.", fdate(o.deadline)]],
    info:[["Asiakas", infoCustomer(o)], ["Toimitus", infoDelivery(o)], ["Ehdot", infoTerms(o)]],
    body:`${o.instructions ? `<p class="d-lead">${esc(o.instructions)}</p>` : ""}${priceTable(o)}${sumBlock(o)}${note("Kiitos tilauksestanne", "Vahvistamme tilauksen yllä olevin tiedoin. Ilmoitattehan mahdollisista muutoksista mahdollisimman pian.")}`});
}
function docWorkCard(o){
  const sup = o.productionMethod === "Alihankkija" && S.suppliers[o.supplierId];
  return sheet({title:"Työkortti", no:o.no, meta:[["Päiväys", fdate(o.date)], ["Deadline", `<span class="d-dl">${fdate(o.deadline)}</span>`], ["Vaihe", esc(o.stage || o.status)]],
    info:[["Asiakas", infoCustomer(o)], ["Toimitus", infoDelivery(o)], ["Tuotanto", `<b>${esc(o.productionMethod)}</b>${sup ? "<br>" + joinBr([sup.name, sup.contact, sup.phone]) : ""}`]],
    body:`${o.items.map(i => `<div class="d-witem"><h3>${esc(i.product)} · ${nfmt(num(i.qty))} ${esc(i.unit || "kpl")}</h3>
      <div class="d-spec"><div><span>Formaatti</span>${esc(i.format || "–")}</div><div><span>Materiaali</span>${esc(i.material || "–")}</div><div><span>Värit</span>${esc(i.colors || "–")}</div><div><span>Painotiedot</span>${esc(i.printInfo || "–")}</div></div>
      ${i.optNote ? `<p style="margin:2.5mm 0 0"><b>Lisäksi:</b> ${esc(i.optNote)}</p>` : ""}${i.desc ? `<p style="margin:2mm 0 0;white-space:pre-wrap">${esc(i.desc)}</p>` : ""}</div>`).join("")}
    ${o.extras.length ? `<div class="d-note" style="white-space:normal"><b>Lisätyöt</b><ul class="d-check">${o.extras.map(x => `<li>☐ ${esc(x.name)}${xDesc(x) ? " · " + xDesc(x) : ""}</li>`).join("")}</ul></div>` : ""}
    ${note("Työohjeet", o.instructions)}${note("Tuotantomuistiinpanot", o.prodNotes)}${o.attachments.length ? note("Liitteet", o.attachments.map(a => a.name).join("\n")) : ""}`});
}
function docDelivery(o){
  return sheet({title:"Lähete", no:o.no, meta:[["Päiväys", fdate(o.finishedAt || today())], ["Asiakkaan viite", esc(o.customerRef || "")]],
    info:[["Vastaanottaja", infoCustomer(o)], ["Toimitusosoite", lines(addr(o.delivery)) || "Nouto"], ["Toimitustapa", `<b>${esc(o.deliveryMethod)}</b>`]],
    body:`${plainTable(o)}<div class="d-sign"><div>Vastaanotettu, päiväys</div><div>Allekirjoitus ja nimenselvennys</div></div>`});
}
function docLabel(o){
  const s = S.settings, c = cust(o);
  return sheet({title:"Lähetyslappu", no:o.no, meta:[["Päiväys", fdate(o.finishedAt || today())], ["Toimitustapa", esc(o.deliveryMethod)]],
    body:`<div class="d-label"><div style="font-size:8pt;color:#6A6E74;font-weight:700">LÄHETTÄJÄ</div><div><b>${esc(s.name)}</b><br>${lines(addr(s))}${s.phone ? "<br>" + esc(s.phone) : ""}</div>
    <div style="font-size:8pt;color:#6A6E74;font-weight:700;margin-top:10mm">VASTAANOTTAJA</div><div class="to">${esc(c.name || "")}<br>${lines(addr(o.delivery)) || "Nouto"}</div>
    ${c.contactName || c.phone ? `<div>${esc([c.contactName, c.phone].filter(Boolean).join(", "))}</div>` : ""}
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6mm;margin-top:10mm;border-top:.6mm solid #2A2A2A;padding-top:4mm;font-weight:800;font-size:12pt"><span>${esc(o.no)}</span><span>${esc(o.deliveryMethod)}</span><span>Kolli ____ / ____</span></div></div>`});
}
function docReceipt(o){
  return sheet({title:"Käteiskuitti", no:o.no, meta:[["Päiväys", fdate(o.receiptDate || today())], ["Maksutapa", esc(o.payMethod || "Käteinen")]],
    info:[["Asiakas", infoCustomer(o)], ["Maksu", `<span class="d-paid">Maksettu</span><br>${esc(o.payMethod || "Käteinen")}`], ["Myyjä", joinBr([S.settings.name, S.settings.ytunnus && "Y-tunnus " + S.settings.ytunnus])]],
    body:`${priceTable(o)}${sumBlock(o)}${note("Kiitos!", "Kuitti on maksutosite. Säilytä kuitti mahdollista reklamaatiota varten.")}`});
}
function docInvoice(o){
  const s = S.settings, c = cust(o), terms = termsOf(o);
  const base = o.invoicedAt ? new Date(o.invoicedAt) : new Date(); const due = new Date(base); due.setDate(due.getDate() + terms);
  const review = o.status !== "Laskutettu", ref = o.reference || o.no;
  return sheet({title: review ? "Laskun tarkastus" : "Lasku", no:o.no, stamp: review ? `<div class="d-stamp">Tarkastettavana</div>` : "",
    meta:[["Laskun päiväys", fdate(isoLocal(base))], ["Eräpäivä", fdate(isoLocal(due))], ["Viite", esc(ref)]],
    info:[["Laskutusosoite", `<b>${esc(c.name || "–")}</b>${c.ytunnus ? "<br>Y-tunnus " + esc(c.ytunnus) : ""}${billAddr(c) ? "<br>" + lines(billAddr(c)) : ""}`],
      [c.einvoice ? "Verkkolasku" : "Toimitus", c.einvoice ? joinBr([c.einvoice, c.operator && "Välittäjä " + c.operator]) : infoDelivery(o)],
      ["Maksuehdot", joinBr([`${terms} pv netto`, `Eräpäivä ${fdate(isoLocal(due))}`, o.customerRef && "Asiakkaan viite: " + o.customerRef, c.contactName && "Tilaaja: " + c.contactName])]],
    body:`${priceTable(o)}${sumBlock(o)}<div class="d-note"><b>Maksutiedot</b>Saaja ${esc(s.name)}${s.iban ? " · IBAN " + esc(s.iban) : ""}${s.bic ? " · BIC " + esc(s.bic) : ""}\nViite ${esc(ref)} · Eräpäivä ${fdate(isoLocal(due))} · Summa ${eur(totals(o).total)}</div>`});
}
const DOCS = {offer:["Tarjous", docOffer], orderconf:["Tilausvahvistus", docOrderConf], workcard:["Työkortti", docWorkCard], delivery:["Lähete", docDelivery], label:["Lähetyslappu", docLabel], receipt:["Käteiskuitti", docReceipt], invoice:["Lasku", docInvoice]};

function fitSheets(){
  $$(".sheet-fit").forEach(w => {
    const a = w.querySelector(".a4"); if (!a) return;
    a.style.transform = ""; a.style.marginLeft = "";
    const full = a.offsetWidth, avail = w.clientWidth;
    const s = Math.min(1, avail / full);
    a.style.transform = s < 1 ? `scale(${s})` : "";
    a.style.marginLeft = s < 1 ? "0" : Math.max(0, (avail - full) / 2) + "px";
    w.style.height = (a.offsetHeight * s + 12) + "px";
  });
}
window.addEventListener("resize", () => { cancelAnimationFrame(fitSheets.r); fitSheets.r = requestAnimationFrame(fitSheets); });

let docCtx = null;
function openDoc(kind){
  const r = route.view === "offer" ? S.offers[route.id] : S.orders[route.id];
  if (!r) return;
  docCtx = {kind, id:r.id};
  const [title, fn] = DOCS[kind];
  $("#doctitle").textContent = `${kind === "invoice" && r.status !== "Laskutettu" ? "Laskun tarkastus" : title} · ${r.no}`;
  $("#docextra").innerHTML = kind === "receipt" ? `<label class="row small" style="font-weight:600">Maksutapa <select id="paym" style="width:auto" ${r.status === "Laskutettu" ? "disabled" : ""}>${["Käteinen","Kortti","MobilePay"].map(p => `<option ${r.payMethod === p ? "selected" : ""}>${p}</option>`).join("")}</select></label>` : "";
  $("#docbody").innerHTML = fn(r);
  $("#docdlg").showModal(); applyTones($("#docdlg"));
  requestAnimationFrame(fitSheets);
}
$("#docclose").onclick = () => $("#docdlg").close();
$("#docprint").onclick = () => {
  const r = docCtx && (S.offers[docCtx.id] || S.orders[docCtx.id]); if (!r) return;
  $("#print-area").innerHTML = DOCS[docCtx.kind][1](r); $("#docdlg").close(); setTimeout(() => window.print(), 60);
};
$("#docextra").addEventListener("change", async e => {
  if (e.target.id !== "paym") return;
  const o = clone(S.orders[docCtx.id]); o.payMethod = e.target.value; o.receiptDate = o.receiptDate || today();
  await put("orders", o); $("#docbody").innerHTML = docReceipt(o); fitSheets();
});

function confirmBox(title, text, yesLabel = "Vahvista", danger = false){
  return new Promise(res => {
    $("#conftitle").textContent = title; $("#confbody").innerHTML = `<p style="margin:0">${text}</p>`;
    const y = $("#confyes"); y.textContent = yesLabel; y.className = "btn t-" + (danger ? "R" : (lastTone === "W" || lastTone === "H" ? "O" : lastTone));
    const d = $("#confdlg");
    const done = v => { d.close(); y.onclick = null; $("#confno").onclick = null; d.oncancel = null; res(v); };
    y.onclick = () => done(true); $("#confno").onclick = () => done(false); d.oncancel = e => { e.preventDefault(); done(false); };
    d.showModal();
  });
}

/* choice dialog: several explicit alternatives, resolves with the chosen value or null */
function choiceBox(title, html, options){
  return new Promise(res => {
    const d = $("#choicedlg");
    $("#choicetitle").textContent = title; $("#choicebody").innerHTML = html;
    $("#choicebtns").innerHTML = options.map((o, i) => `<button class="btn t-${o.tone || "W"}" data-choice="${i}" data-fixed-tone="1">${esc(o.label)}</button>`).join("");
    const done = v => { d.close(); d.oncancel = null; $("#choicebtns").onclick = null; res(v); };
    $("#choicebtns").onclick = e => { const b = e.target.closest("[data-choice]"); if (b) done(options[+b.dataset.choice].value); };
    d.oncancel = e => { e.preventDefault(); done(null); };
    d.showModal();
  });
}

/* offer → order, optionally straight into production; one order per offer */
async function createOrderFromOffer(o, startProduction){
  if (o.orderId && S.orders[o.orderId]) { toast("Tästä tarjouksesta on jo luotu tilaus"); return go("order", o.orderId); }
  const ord = clone(o);
  Object.assign(ord, {id:uid(), kind:"order", no:nextNo("TIL", "orders"), status:"Vahvistettu", offerId:o.id, offerNo:o.no, history:[], date:today()});
  ["orderId","sentAt","acceptedAt"].forEach(k => delete ord[k]);
  log(ord, `Tilaus luotu tarjouksesta ${o.no}`);
  if (startProduction) { ord.status = "Tuotannossa"; ord.stage = "Aloitettu"; log(ord, "Tuotanto aloitettu"); }
  const r = clone(S.offers[o.id] || o); r.orderId = ord.id; log(r, `Tilaus ${ord.no} luotu`);
  await put("orders", ord); await put("offers", r);
  if (o.customerId && S.customers[o.customerId]?.status === "Prospekti") { const c = clone(S.customers[o.customerId]); c.status = "Aktiivinen"; await put("customers", c); }
  toast(startProduction ? `Tilaus ${ord.no} luotu ja tuotanto aloitettu` : `Tilaus ${ord.no} luotu`);
  return go("order", ord.id, {replace:true});
}

/* ================= CRM ================= */
function customerList(){
  const st = ls("customers");
  const all = Object.values(S.customers).sort((a, b) => a.name.localeCompare(b.name, "fi"));
  const rows = all.filter(c => (st.filter === "Kaikki" || c.status === st.filter) && matchQ(st.q, c.name, c.ytunnus, ...c.contacts.flatMap(k => [k.name, k.email, k.phone])));
  return `<div class="head"><div><h1>Asiakkaat</h1><div class="sub">${all.length} asiakasta</div></div><button class="btn primary" data-act="new-customer">+ Uusi asiakas</button></div>
  <div class="toolbar">${searchBox("customers", "Yritys, Y-tunnus, yhteyshenkilö, sähköposti tai puhelin")}</div>
  <div class="chips">${["Kaikki", ...CUST_ST].map(s => `<button class="chip" data-filter="${s}" aria-pressed="${st.filter === s}">${s} ${s === "Kaikki" ? all.length : all.filter(c => c.status === s).length}</button>`).join("")}</div>
  ${listBlock([{h:"Yritys", cls:"id"},{h:"Y-tunnus"},{h:"Tila"},{h:"Yhteyshenkilö"},{h:"Sähköposti"},{h:"Puhelin"},{h:"Töitä", r:1, cls:"r num"},{h:"Myynti alv 0", r:1, cls:"r num"}],
    rows.map(c => { const k = c.contacts[0] || {}; const n = custOrders(c.id).length, sales = custSales(c.id);
      return {attr:`data-open-customer="${c.id}"`, cells:[esc(c.name), esc(c.ytunnus), badge(c.status), esc(k.name), esc(k.email), esc(k.phone), n, eur(sales)],
        title:esc(c.name), right:eur(sales), sub:[c.ytunnus, k.name, k.phone].filter(Boolean).map(esc).join(" · "), badge:badge(c.status)}; }),
    all.length ? "Haulla ei löytynyt asiakkaita." : `Ei asiakkaita. Asiakas tallentuu myös, kun luot tarjouksen uudelle asiakkaalle.<br><button class="btn primary" data-act="new-customer">+ Uusi asiakas</button>`)}`;
}
function customerView(c){
  if (!c) return `${backBtn("customers")}<div class="empty">Asiakasta ei löytynyt.</div>`;
  const offers = custOffers(c.id).sort((a, b) => (b.no || "").localeCompare(a.no || ""));
  const orders = custOrders(c.id).sort((a, b) => (b.no || "").localeCompare(a.no || ""));
  const openOffers = offers.filter(o => ["Luonnos","Valmis lähetettäväksi","Lähetetty"].includes(o.status)).length;
  return `${backBtn("customers", "Asiakkaat")}<div class="head"><div><h1>${esc(c.name)}</h1><div class="sub">${c.ytunnus ? "Y-tunnus " + esc(c.ytunnus) + " " : ""}${badge(c.status)}</div></div>
  <div class="row"><button class="btn" data-act="edit-customer">Muokkaa</button><button class="btn" data-act="cust-order">+ Uusi tilaus</button><button class="btn primary" data-act="cust-offer">+ Uusi tarjous</button></div></div>
  <div class="kpis"><div class="kpi"><b>${orders.length}</b><span>Töitä</span></div><div class="kpi"><b>${eur(custSales(c.id))}</b><span>Kokonaismyynti alv 0</span></div>
  <div class="kpi"><b>${offers.length}</b><span>Tarjouksia, ${openOffers} avoinna</span></div><div class="kpi"><b>${c.discount ? pct(num(c.discount)) : "–"}</b><span>Asiakasalennus</span></div>
  ${(() => { const ms = orders.map(marginOf), net = ms.reduce((a, x) => a + x.net, 0), mg = ms.reduce((a, x) => a + x.margin, 0), hr = hitRate(offers);
    return `<div class="kpi"><b${marginCls(net ? mg / net * 100 : 100)}>${eur(mg)}</b><span>Kate · ${pctTxt(net ? mg / net * 100 : null)}</span></div><div class="kpi"><b>${pctTxt(hr.pct)}</b><span>Tarjousten voittoprosentti · ${hr.won}/${hr.won + hr.lost}</span></div>`; })()}</div>
  <div class="layout"><div>
    <div class="panel"><h2>Tilaukset</h2>${listBlock(ORDER_COLS("Deadline / laskutettu"), orderRows(orders), "Ei tilauksia.")}</div>
    <div class="panel"><h2>Tarjoukset</h2>${listBlock([{h:"Numero", cls:"id"},{h:"Päiväys", cls:"num"},{h:"Tuotteet"},{h:"Tila"},{h:"Yhteensä alv 0", r:1, cls:"r num"}],
      offers.map(o => ({attr:`data-open-offer="${o.id}"`, cells:[esc(o.no), fdate(o.date), esc(o.items.map(i => i.product).filter(Boolean).join(", ")), badge(o.status), eur(totals(o).net)], title:esc(o.no), right:eur(totals(o).net), sub:fdate(o.date), badge:badge(o.status)})), "Ei tarjouksia.")}</div>
  </div><div>
    <div class="panel"><h2>Yhteyshenkilöt</h2>${c.contacts.length ? c.contacts.map(k => `<p style="margin:0 0 10px"><b>${esc(k.name || "–")}</b>${k.role ? ` <span class="sub">${esc(k.role)}</span>` : ""}<br>${k.email ? `<span class="small">${esc(k.email)}</span><br>` : ""}${k.phone ? `<span class="small">${esc(k.phone)}</span>` : ""}</p>`).join("") : `<p class="sub">Ei yhteyshenkilöitä.</p>`}</div>
    <div class="panel"><h2>Toimitusosoitteet</h2>${c.addresses.length ? c.addresses.map(a => `<p style="margin:0 0 10px">${a.label ? `<b>${esc(a.label)}</b><br>` : ""}${lines(addr(a))}</p>`).join("") : `<p class="sub">Ei osoitteita.</p>`}</div>
    <div class="panel"><h2>Laskutus</h2><dl class="kv"><dt>Osoite</dt><dd>${lines(addr(c.billing)) || "–"}</dd><dt>Verkkolasku</dt><dd>${esc(c.einvoice || "–")}</dd><dt>Välittäjä</dt><dd>${esc(c.operator || "–")}</dd><dt>Maa</dt><dd>${esc(c.country || "Suomi")}${isAbroad(c) ? ` · ${esc(VAT_MODES[vatModeFor(c.country)])}` : ""}</dd>${c.vatId ? `<dt>ALV-tunniste</dt><dd>${esc(c.vatId)}</dd>` : ""}<dt>Maksuehto</dt><dd>${num(c.terms) || num(S.settings.terms)} pv</dd><dt>Alennus</dt><dd>${pct(num(c.discount))}</dd></dl>${c.notes ? `<h3>Muistiinpanot</h3><p class="small" style="white-space:pre-wrap;margin:0">${esc(c.notes)}</p>` : ""}</div>
  </div></div>`;
}

/* ================= Products ================= */
function productList(){
  const st = ls("products");
  const rows = products().filter(p => matchQ(st.q, p.name, p.description, p.material));
  return `<div class="head"><div><h1>Tuotteet & hinnat</h1><div class="sub">${Object.keys(S.products).length} tuoteryhmää. Tee tarjous siirtää tuotteen suoraan uuteen tarjoukseen.</div></div>${isAdmin ? `<button class="btn primary" data-act="new-product">+ Oma tuote</button>` : ""}</div>
  <div class="toolbar">${searchBox("products", "Hae tuotetta")}</div>
  <div class="table-wrap desk"><table class="list"><thead><tr><th>Tuoteryhmä</th><th>Yksikkö</th><th class="r">Alkaen</th><th class="r">Aloituskustannus</th><th>Valinnat, lisätyöt ja hinnat</th><th></th></tr></thead><tbody>
  ${rows.map(p => `<tr><td class="id">${esc(p.name)}${p.custom ? ` <span class="st grey">Oma</span>` : ""}</td><td>${esc(p.unit)}</td><td class="r num">${tableRows(p).length ? eur(tableRows(p)[0].p) + " / " + nfmt(tableRows(p)[0].q) + " " + esc(p.unit) : eur4(num(p.baseCost)) + " / " + esc(p.unit)}</td><td class="r num">${eur(num(p.startCost))}</td><td class="small">${(p.options || []).length ? p.options.map(g => `${esc(g.name)} (${g.choices.length})`).join(", ") : esc(spec(p)) || "–"}${(p.extras || []).length ? `<span class="sub" style="display:block">Lisätyöt: ${p.extras.map(x => esc(x.name)).join(", ")}</span>` : ""}${tableRows(p).length ? `<span class="sub" style="display:block">Hintataulukko: ${tableRows(p).slice(0, 4).map(x => nfmt(x.q) + " " + esc(p.unit) + " " + eur(x.p)).join(" · ")}${tableRows(p).length > 4 ? " …" : ""}</span>` : (p.tiers || []).length ? `<span class="sub" style="display:block">Määräalennus ${p.tiers.length} porrasta</span>` : ""}</td>
  <td class="r"><div class="row" style="justify-content:flex-end;flex-wrap:nowrap"><button class="btn sm go" data-prod-offer="${p.id}">Tee tarjous</button><button class="btn sm" data-prod-calc="${p.id}">Laske</button>${isAdmin ? `<button class="btn sm ghost" data-prod-edit="${p.id}">Muokkaa</button>` : ""}</div></td></tr>`).join("")}
  </tbody></table></div>
  <div class="cards">${rows.map(p => `<div class="card" style="cursor:default"><div class="card-top"><b>${esc(p.name)}</b><span class="num">${eur(num(p.baseCost))} / ${esc(p.unit)}</span></div><div class="card-sub">Aloitus ${eur(num(p.startCost))}${spec(p) ? " · " + esc(spec(p)) : ""}${(p.options || []).length ? "<br>Valinnat: " + p.options.map(g => esc(g.name)).join(", ") : ""}${(p.extras || []).length ? "<br>Lisätyöt: " + p.extras.map(x => esc(x.name)).join(", ") : ""}</div><div class="row"><button class="btn sm go" data-prod-offer="${p.id}">Tee tarjous</button><button class="btn sm" data-prod-calc="${p.id}">Laske</button>${isAdmin ? `<button class="btn sm ghost" data-prod-edit="${p.id}">Muokkaa</button>` : ""}</div></div>`).join("")}</div>`;
}

/* ================= Suppliers ================= */
function supplierList(){
  const st = ls("suppliers");
  const all = Object.values(S.suppliers).sort((a, b) => a.name.localeCompare(b.name, "fi"));
  const rows = all.filter(s => matchQ(st.q, s.name, s.specialty, s.contact, s.email, s.phone, s.city));
  const spec = {}; all.forEach(s => String(s.specialty || "").split(",").map(x => x.trim()).filter(Boolean).forEach(x => spec[x] = (spec[x] || 0) + 1));
  const linked = id => Object.values(S.orders).filter(o => o.productionMethod === "Alihankkija" && o.supplierId === id);
  return `<div class="head"><div><h1>Alihankkijat</h1></div><button class="btn primary" data-act="new-supplier">+ Uusi alihankkija</button></div>
  <div class="kpis"><div class="kpi"><b>${all.length}</b><span>Alihankkijaa</span></div><div class="kpi"><b>${Object.keys(spec).length}</b><span>Erikoisalaa</span></div>
  <div class="kpi"><b>${Object.values(S.orders).filter(o => o.productionMethod === "Alihankkija" && o.status !== "Laskutettu").length}</b><span>Avointa alihankintatyötä</span></div></div>
  ${Object.keys(spec).length ? `<div class="chips">${Object.entries(spec).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<button class="chip" data-supq="${esc(k)}" aria-pressed="${st.q === k}">${esc(k)} ${n}</button>`).join("")}</div>` : ""}
  <div class="toolbar">${searchBox("suppliers", "Hae yrityksellä, erikoisalalla tai yhteyshenkilöllä")}</div>
  ${listBlock([{h:"Yritys", cls:"id"},{h:"Erikoisala"},{h:"Yhteyshenkilö"},{h:"Sähköposti"},{h:"Puhelin"},{h:"Toimitusaika"},{h:"Töitä", r:1, cls:"r num"}],
    rows.map(s => ({attr:`data-open-supplier="${s.id}"`, cells:[esc(s.name), esc(s.specialty), esc(s.contact), esc(s.email), esc(s.phone), esc(s.leadTime), linked(s.id).length],
      title:esc(s.name), right:esc(s.leadTime || ""), sub:[s.specialty, s.contact, s.phone].filter(Boolean).map(esc).join(" · ")})),
    all.length ? "Haulla ei löytynyt alihankkijoita." : `Ei alihankkijoita.<br><button class="btn primary" data-act="new-supplier">+ Uusi alihankkija</button>`)}`;
}
function supplierView(s){
  if (!s) return `${backBtn("suppliers")}<div class="empty">Alihankkijaa ei löytynyt.</div>`;
  const orders = Object.values(S.orders).filter(o => o.productionMethod === "Alihankkija" && o.supplierId === s.id).sort((a, b) => (b.no || "").localeCompare(a.no || ""));
  return `${backBtn("suppliers", "Alihankkijat")}<div class="head"><div><h1>${esc(s.name)}</h1><div class="sub">${esc(s.specialty || "")}</div></div><button class="btn" data-act="edit-supplier">Muokkaa</button></div>
  <div class="layout"><div class="panel"><h2>Tilaukset tällä alihankkijalla</h2>${listBlock(ORDER_COLS("Deadline / laskutettu"), orderRows(orders), "Ei vielä tilauksia. Valitse tilauksessa tuotantotavaksi Alihankkija ja tämä yritys.")}</div>
  <div class="panel"><h2>Tiedot</h2><dl class="kv"><dt>Yhteyshenkilö</dt><dd>${esc(s.contact || "–")}</dd><dt>Sähköposti</dt><dd>${esc(s.email || "–")}</dd><dt>Puhelin</dt><dd>${esc(s.phone || "–")}</dd><dt>Osoite</dt><dd>${lines(addr(s)) || "–"}</dd><dt>Toimitusaika</dt><dd>${esc(s.leadTime || "–")}</dd></dl>${s.notes ? `<h3>Muistiinpanot</h3><p class="small" style="white-space:pre-wrap;margin:0">${esc(s.notes)}</p>` : ""}</div></div>`;
}

/* ================= Quick calculator (Tuotteet & hinnat → Laske) ================= */
const calc = {productId:"", product:"", unit:"kpl", qty:"250", opts:{}, ex:{}, custom:[], base:"", prod:"0", mat:"0", margin:"0", discount:"0", startCost:"", billingFee:"", delivery:"0", vat:"", target:"new"};
function calcSetProduct(p){
  const t = tableRows(p);
  Object.assign(calc, {productId:p ? p.id : "", product:p ? p.name : "", unit:p ? p.unit : "kpl", opts:{}, ex:{}, base:"", startCost:p ? String(p.startCost) : "", qty:t.length ? String(t[Math.min(2, t.length - 1)].q) : calc.qty});
  (p?.extras || []).forEach((x, k) => calc.ex[k] = {on:false, price:String(x.price)});
}
function calcResult(){
  const p = S.products[calc.productId];
  const pc = priceConfig(p, calc.qty, calc.opts, {base:calc.base, prod:calc.prod, mat:calc.mat, margin:calc.margin});
  const exList = (p?.extras || []).map((x, k) => ({x, k, st:calc.ex[k] || {on:false, price:x.price}})).filter(e => e.st.on)
    .map(e => ({name:e.x.name, per:e.x.per, k:e.k, unitPrice:num(e.st.price), qty:e.x.per === "yks" ? pc.q : 1, total:r2(num(e.st.price) * (e.x.per === "yks" ? pc.q : 1))}))
    .concat((calc.custom || []).filter(c => String(c.name).trim()).map(c => ({name:c.name.trim(), per:"oma", k:null, unitPrice:num(c.price), qty:num(c.qty) || 1, total:r2(num(c.price) * (num(c.qty) || 1))})));
  const extras = exList.reduce((a, e) => a + e.total, 0);
  const sub = pc.total + extras, disc = r2(sub * num(calc.discount) / 100);
  const start = calc.startCost === "" ? num(S.settings.startCost) : num(calc.startCost);
  const fee = calc.billingFee === "" ? num(S.settings.billingFee) : num(calc.billingFee);
  const net = r2(sub - disc + start + fee + num(calc.delivery));
  const vr = calc.vat === "" || calc.vat === "fi" ? num(S.settings.vat) : 0, vat = r2(net * vr / 100);
  return {p, pc, exList, extras, sub, disc, start, fee, net, vr, vat, total:r2(net + vat)};
}
function quickCalcHTML(){
  const r = calcResult(), p = r.p;
  const f = (k, l, ph = "") => `<label class="f">${l}<input type="text" inputmode="decimal" data-calc="${k}" value="${esc(calc[k])}" placeholder="${esc(ph)}"></label>`;
  return `<div class="calc"><div class="form">
  <fieldset><legend>${esc(p ? p.name : "Tuote")}</legend><div class="grid">${f("qty", "Määrä " + esc(calc.unit || "kpl"))}</div>
  ${p?.options?.length ? `<div class="grid" style="margin-top:12px">${p.options.map((g, gi) => `<label class="f">${esc(g.name)}<select data-copt="${gi}">${g.choices.map((ch, ci) => `<option value="${ci}" ${String(calc.opts[gi] ?? 0) === String(ci) ? "selected" : ""}>${esc(ch.label)}${choiceHint(ch) ? " (" + choiceHint(ch) + ")" : ""}</option>`).join("")}</select></label>`).join("")}</div>` : ""}
  ${tableRows(p).length ? `<p class="small" style="margin:12px 0 0">Hintataulukko: <span id="tiers">${priceTableText(p, calc.qty)}</span></p>` : ""}</fieldset>
  ${p?.extras?.length ? `<fieldset><legend>Lisätyöt</legend><div class="exlist">${p.extras.map((x, k) => { const st = calc.ex[k] || {on:false, price:String(x.price)};
    return `<div class="exrow"><label class="chk"><input type="checkbox" data-cex="${k}" ${st.on ? "checked" : ""}> ${esc(x.name)}</label><label class="f"><span class="sr">Hinta</span><input type="text" inputmode="decimal" data-cexp="${k}" value="${esc(st.price)}" aria-label="${esc(x.name)} hinta"></label><span class="sub small">${x.per === "yks" ? "€ / " + esc(calc.unit || "yks") : "€ / työ"}</span></div>`; }).join("")}</div></fieldset>` : ""}
  <fieldset><legend>Hinnoittelu</legend><div class="grid">${f("discount", "Asiakasalennus %")}${f("startCost", "Aloituskustannus €", String(S.settings.startCost))}${f("billingFee", "Laskutuslisä €", String(S.settings.billingFee))}
    <label class="f">Arvonlisävero<select data-calc="vat"><option value="" ${!calc.vat || calc.vat === "fi" ? "selected" : ""}>Kotimaa ${pct(num(S.settings.vat))}</option><option value="eu" ${calc.vat === "eu" ? "selected" : ""}>EU-yhteisömyynti 0 %</option><option value="export" ${calc.vat === "export" ? "selected" : ""}>Vienti 0 %</option></select></label></div></fieldset>
  </div><div><div class="panel result" id="calcres">${calcResultHTML(r)}</div>
  <div class="actions" style="margin-top:12px"><button class="btn" data-act="calc-to-offer">Tee tarjous tästä</button></div></div></div>`;
}
function openQuickCalc(p){
  calcSetProduct(p); calc.target = "new"; calc.custom = []; calc.discount = "0"; calc.margin = "0"; calc.prod = "0"; calc.mat = "0"; calc.delivery = "0";
  $("#qctitle").textContent = "Pikalaskuri · " + p.name;
  $("#qcbody").innerHTML = quickCalcHTML(); applyTones($("#calcdlg"));
  $("#calcdlg").showModal();
}
function refreshCalc(){
  if ($("#calcdlg").open) { const y = $("#qcbody").scrollTop; $("#qcbody").innerHTML = quickCalcHTML(); applyTones($("#calcdlg")); $("#qcbody").scrollTop = y; }
  else render();
}
$("#qcclose").onclick = () => $("#calcdlg").close();
function calcResultHTML(r){
  const pc = r.pc, u = esc(calc.unit || "kpl");
  return `<h2>Laskettu hinta</h2>
  ${pc.fromTable ? `<div class="line"><span>Hintataulukko ${nfmt(pc.q)} ${u}</span><span>${eur(pc.tableTotal)}</span></div>` : ""}
  <div class="line"><span>Perushinta valinnoilla</span><span>${eur4(pc.baseUnit)} / ${u}</span></div>
  ${pc.disc ? `<div class="line"><span>Määräalennus ${pct(pc.disc)}</span><span>${eur4(pc.listUnit)} / ${u}</span></div>` : ""}
  <div class="line"><span>Tuote ${nfmt(pc.q)} ${u}</span><span>${eur(pc.listUnit * pc.q)}</span></div>
  ${pc.fixed ? `<div class="line"><span>Valintojen kertamaksut</span><span>${eur(pc.fixed)}</span></div>` : ""}
  ${pc.costs ? `<div class="line"><span>Lisäkustannukset</span><span>${eur(pc.costs)}</span></div>` : ""}
  ${Math.abs(pc.marginSum) >= 0.005 ? `<div class="line"><span>Lisäkate ${pct(num(calc.margin))}</span><span>${eur(pc.marginSum)}</span></div>` : ""}
  ${r.exList.map(e => `<div class="line"><span>${esc(e.name)}${e.per === "yks" || e.qty !== 1 ? ` (${nfmt(e.qty)} × ${eur4(e.unitPrice)})` : ""}</span><span>${eur(e.total)}</span></div>`).join("")}
  ${r.disc ? `<div class="line"><span>Asiakasalennus ${pct(num(calc.discount))}</span><span>−${eur(r.disc)}</span></div>` : ""}
  <div class="line"><span>Aloituskustannus</span><span>${eur(r.start)}</span></div>
  ${r.fee ? `<div class="line"><span>Laskutuslisä</span><span>${eur(r.fee)}</span></div>` : ""}
  ${num(calc.delivery) ? `<div class="line"><span>Toimituskulut</span><span>${eur(num(calc.delivery))}</span></div>` : ""}
  <div class="line"><span>Yhteensä alv 0 %</span><span>${eur(r.net)}</span></div>
  <div class="line"><span>Alv ${pct(r.vr)}</span><span>${eur(r.vat)}</span></div>
  <div class="line big"><span>Kokonaishinta</span><span>${eur(r.total)}</span></div>
  <div class="unit">Tuotteen à-hinta ${eur4(pc.unitPrice)} / ${u} alv 0 · sis. lisätyöt ${eur4(pc.q ? (pc.total + r.extras) / pc.q : 0)} / ${u}</div>`;
}

/* ================= Marketing ================= */
const mkt = {groups:new Set(), selected:null, subject:"", body:""};
function mktCustomers(){
  const bought = {};
  Object.values(S.orders).forEach(o => { if (!o.customerId) return; bought[o.customerId] = bought[o.customerId] || new Set(); o.items.forEach(i => bought[o.customerId].add(i.group || OWN)); });
  return Object.values(S.customers).map(c => ({c, email:(c.contacts.find(k => k.email) || {}).email || "", contact:(c.contacts.find(k => k.email) || c.contacts[0] || {}).name || "", groups:bought[c.id] || new Set()}))
    .filter(x => x.email && (!mkt.groups.size || [...mkt.groups].some(g => x.groups.has(g))))
    .sort((a, b) => a.c.name.localeCompare(b.c.name, "fi"));
}
function marketingView(){
  const s = S.settings;
  if (!mkt.subject) mkt.subject = `Uutisia ${s.name}lta`;
  if (!mkt.body) mkt.body = `Hei,\n\nkiitos yhteistyöstä! Halusimme kertoa ajankohtaisista tarjouksistamme.\n\n[Kirjoita viesti tähän]\n\nYstävällisin terveisin\n${s.name}\n${s.phone || ""}`;
  const list = mktCustomers();
  if (!mkt.selected) mkt.selected = new Set(list.map(x => x.c.id));
  const chosen = list.filter(x => mkt.selected.has(x.c.id));
  const bcc = [...new Set(chosen.map(x => x.email))].join("; ");
  const groups = [...new Set([...products().map(p => p.name), ...Object.values(S.orders).flatMap(o => o.items.map(i => i.group || OWN))])];
  const mailto = `mailto:${encodeURIComponent(s.email || "")}?bcc=${encodeURIComponent(bcc.replace(/; /g, ","))}&subject=${encodeURIComponent(mkt.subject)}&body=${encodeURIComponent(mkt.body)}`;
  return `<div class="head"><div><h1>Markkinointi</h1><div class="sub">Valitse vastaanottajat aiemmin ostettujen tuotteiden mukaan ja valmistele viesti. Viestiä ei lähetetä automaattisesti.</div></div></div>
  <div class="mk"><div>
    <div class="panel"><h2>Ostetut tuotteet</h2><p class="sub small" style="margin-top:-6px">Ilman valintaa mukana ovat kaikki asiakkaat, joilla on sähköposti.</p>
    <div class="chips">${groups.map(g => `<button class="chip" data-mg="${esc(g)}" aria-pressed="${mkt.groups.has(g)}">${esc(g)}</button>`).join("")}</div></div>
    <div class="panel"><div class="row" style="justify-content:space-between;margin-bottom:10px"><h2 style="margin:0">Vastaanottajat · ${chosen.length} / ${list.length}</h2>
    <div class="row"><button class="btn sm" data-act="mkt-all">Valitse kaikki</button><button class="btn sm" data-act="mkt-none">Tyhjennä valinnat</button></div></div>
    ${list.length ? `<div class="recips">${list.map(x => `<label><input type="checkbox" data-mc="${x.c.id}" ${mkt.selected.has(x.c.id) ? "checked" : ""}><span><b>${esc(x.c.name)}</b><small>${esc(x.contact)} · ${esc(x.email)}</small></span></label>`).join("")}</div>` : `<p class="sub">Valinnoilla ei löytynyt asiakkaita, joilla on sähköposti.</p>`}</div>
  </div><div>
    <div class="panel"><h2>Viesti</h2><div class="form" style="gap:12px">
      <label class="f">Aihe<input type="text" data-mk="subject" value="${esc(mkt.subject)}"></label>
      <label class="f">Viesti<textarea data-mk="body" style="min-height:200px">${esc(mkt.body)}</textarea></label>
      <label class="f">Piilokopio (BCC) · ${chosen.length} vastaanottajaa<textarea id="bcc" readonly style="min-height:70px">${esc(bcc)}</textarea></label>
      <div class="row"><button class="btn" data-act="copy-bcc" ${chosen.length ? "" : "disabled"}>Kopioi BCC-lista</button><a class="btn go" href="${mailto}" target="_blank" rel="noopener">Avaa sähköpostissa</a></div>
    </div></div>
    <div class="panel"><h2>Esikatselu</h2><div class="outlook" id="olprev">${outlookHTML(bcc, chosen.length)}</div></div>
  </div></div>`;
}
function outlookHTML(bcc, n){
  const s = S.settings;
  return `<div class="bar-top">Uusi viesti</div><div class="hdr"><span>Lähettäjä</span><div>${esc(s.email || s.name)}</div><span>Vastaanottaja</span><div>${esc(s.email || "–")}</div><span>Piilokopio</span><div>${n} vastaanottajaa</div></div><div class="subj">${esc(mkt.subject)}</div><div class="body">${esc(mkt.body)}</div>`;
}

/* ================= Editors ================= */
const blankItem = () => ({iid:uid(), group:OWN, product:"", qty:"1", unit:"kpl", price:"0", desc:"", format:"", material:"", colors:"", printInfo:""});
function blankRecord(kind){
  const s = S.settings;
  return {id:uid(), kind, no:"", status:kind === "offer" ? "Luonnos" : "Vahvistettu", customerId:"", customer:{},
    items:[blankItem()], extras:[], instructions:"", deliveryMethod:"Nouto", delivery:{street:"", postcode:"", city:""}, deliveryCost:"0",
    date:today(), deadline:"", productionMethod:"Copy-Set", supplierId:"", startCost:String(s.startCost), billingFee:String(s.billingFee),
    vatRate:num(s.vat), vatMode:"fi", discount:"0", attachments:[], history:[], customerRef:"", reference:""};
}
function itemFromProduct(p, qty = "1", price, opts = {}, calc){
  const it = {iid:uid(), group:p.name, productId:p.id, product:p.name, qty:String(qty), unit:p.unit || "kpl", price:"0", desc:p.description || "", format:p.format || "", material:p.material || "", colors:p.colors || "", printInfo:"", opts:{...opts}, calc:calc ? {...calc} : {base:"", prod:"0", mat:"0", other:"0", margin:"0"}, autoPrice:true};
  Object.assign(it, optFields(p, opts));
  it.price = String(price ?? priceConfig(p, qty, opts, it.calc).unitPrice);
  return it;
}
function startEdit(kind, rec, isNew, ui = {}){ editing = {kind, rec:clone(rec), isNew, ui, errors:[]}; go("edit", kind); }

function editorHTML(){
  const k = editing.kind;
  if (k === "customer") return customerEditor();
  if (k === "supplier") return simpleEditor("supplier");
  if (k === "product") return simpleEditor("product");
  return recEditor();
}
function errBox(){ return editing.errors.length ? `<div class="errs" role="alert"><b>Tarkista seuraavat tiedot:</b><ul>${editing.errors.map(e => `<li>${esc(e)}</li>`).join("")}</ul></div>` : ""; }

function custSection(r){
  const c = r.customer, ui = editing.ui;
  if (!c.name && !ui.newCust) {
    return `<fieldset><legend class="req">Asiakas</legend>
    <div class="ta"><label class="f">Hae asiakas<input type="search" id="custq" autocomplete="off" placeholder="Kirjoita nimi, Y-tunnus, yhteyshenkilö, sähköposti tai puhelin"></label><div class="ta-res" id="custres" role="listbox"></div></div>
    <div class="row" style="margin-top:10px"><button class="btn sm" data-ed="new-cust">+ Luo uusi asiakas</button></div></fieldset>`;
  }
  const reg = r.customerId && S.customers[r.customerId];
  const inp = (key, label, cls = "", extra = "") => `<label class="f">${label}${cls === "req" ? " *" : ""}<input type="text" data-c="${key}" value="${esc(c[key])}" ${extra}></label>`;
  return `<fieldset><legend class="req">Asiakas</legend>
  ${reg ? `<div class="picked"><span><b>${esc(reg.name)}</b> ${reg.ytunnus ? "· " + esc(reg.ytunnus) : ""} ${badge(reg.status)}</span><button class="btn sm" data-ed="change-cust">Vaihda asiakas</button></div>`
        : `<div class="picked"><span><b>Uusi asiakas</b> – tallentuu asiakasrekisteriin</span><button class="btn sm" data-ed="change-cust">Hae olemassa oleva</button></div>`}
  <div class="grid">
    ${inp("name", "Yrityksen nimi", "req")}${inp("ytunnus", "Y-tunnus", "", reg ? "disabled" : 'placeholder="1234567-8"')}
    <label class="f">Maa<select data-c="country" data-ed-change="country">${COUNTRIES.map(x => `<option ${(c.country || "Suomi") === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>
    ${(c.country && c.country !== "Suomi") || r.vatMode === "eu" ? inp("vatId", "ALV-tunniste (VAT ID)", "", 'placeholder="esim. SE556677889901"') : ""}
    ${reg && reg.contacts.length > 1 ? `<label class="f">Yhteyshenkilö<select data-ed-change="contact">${reg.contacts.map((k, i) => `<option value="${i}" ${k.name === c.contactName ? "selected" : ""}>${esc(k.name || k.email)}</option>`).join("")}</select></label>` : ""}
    ${inp("contactName", "Yhteyshenkilö")}${inp("email", "Sähköposti")}${inp("phone", "Puhelin")}
    <label class="f">Asiakkaan viite<input type="text" data-f="customerRef" value="${esc(r.customerRef)}"></label>
  </div>
  <h3>Laskutus</h3><div class="grid">
    ${inp("billStreet", "Laskutusosoite")}${inp("billPostcode", "Postinumero")}${inp("billCity", "Postitoimipaikka")}
    ${inp("einvoice", "Verkkolaskuosoite")}${inp("operator", "Välittäjätunnus")}${inp("terms", "Maksuehto pv", "", `inputmode="numeric" placeholder="${esc(S.settings.terms)}"`)}
    <label class="f">Asiakasalennus %<input type="text" inputmode="decimal" data-f="discount" value="${esc(r.discount)}"></label>
  </div></fieldset>`;
}
function recEditor(){
  const {kind, rec:r, isNew} = editing;
  const t = totals(r);
  const title = isNew ? (kind === "offer" ? "Uusi tarjous" : "Uusi tilaus") : `Muokkaa ${r.no}`;
  let buttons;
  if (kind === "offer" && ["Luonnos","Valmis lähetettäväksi"].includes(r.status))
    buttons = `<button class="btn ghost" data-ed="cancel">Peruuta</button><button class="btn" data-ed="calc">Laske hinta</button><button class="btn" data-ed="draft">Tallenna luonnos</button><button class="btn primary" data-ed="ready">Tallenna tarjous</button>`;
  else buttons = `<button class="btn ghost" data-ed="cancel">Peruuta</button><button class="btn" data-ed="calc">Laske hinta</button><button class="btn primary" data-ed="save">${kind === "order" && isNew ? "Tallenna tilaus" : "Tallenna muutokset"}</button>`;
  const reg = r.customerId && S.customers[r.customerId];
  const sups = Object.values(S.suppliers).sort((a, b) => a.name.localeCompare(b.name, "fi"));
  return `<button class="back" data-ed="cancel">← Peruuta</button>
  <div class="head"><div><h1>${esc(title)}</h1><div class="sub">${r.no ? badge(r.status) : "Numero annetaan tallennettaessa"}${r.copiedFrom ? ` · kopio työstä ${esc(r.copiedFrom)}` : ""}</div></div></div>
  ${kind === "offer" && r.status === "Lähetetty" ? `<div class="warn">Tarjous on jo lähetetty. Muutokset tallentuvat samaan tarjoukseen ja tila pysyy Lähetetty.</div>` : ""}
  <div class="form" id="ed">${errBox()}
  ${custSection(r)}
  <fieldset><legend class="req">Tuotteet</legend><div class="items">
  ${r.items.map((i, n) => `<div class="item">
    <div class="item-top">
      <label class="f">Tuoteryhmä<select data-ed-change="group" data-n="${n}"><option value="">${OWN}</option>${products().map(p => `<option value="${p.id}" ${i.productId === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
      <label class="f">Tuote<input type="text" data-i="${n}.product" value="${esc(i.product)}" placeholder="esim. Esite A4 taitettu"></label>
      <label class="f">Määrä<input type="text" inputmode="decimal" data-i="${n}.qty" value="${esc(i.qty)}"></label>
      <label class="f">Yks.<input type="text" data-i="${n}.unit" value="${esc(i.unit || "kpl")}"></label>
      <label class="f">À-hinta €<input type="text" inputmode="decimal" data-i="${n}.price" value="${esc(i.price)}"></label>
      <label class="f">Yhteensä<input type="text" data-line="${n}" value="${eur(num(i.qty) * num(i.price))}" disabled></label>
      <button class="btn sm ghost" data-ed="del-item" data-n="${n}" aria-label="Poista tuote">Poista</button>
    </div>
    <div class="item-more">
      <label class="f">Formaatti<input type="text" data-i="${n}.format" value="${esc(i.format)}"></label>
      <label class="f">Materiaali<input type="text" data-i="${n}.material" value="${esc(i.material)}"></label>
      <label class="f">Värit<input type="text" data-i="${n}.colors" value="${esc(i.colors)}" placeholder="4+4"></label>
      <label class="f">Painotiedot<input type="text" data-i="${n}.printInfo" value="${esc(i.printInfo)}"></label>
      <label class="f" style="grid-column:1/-1">Kuvaus<textarea data-i="${n}.desc" style="min-height:44px">${esc(i.desc)}</textarea></label>
    </div>${itemTools(r, i, n)}</div>`).join("")}
  </div><button class="btn sm" data-ed="add-item" style="margin-top:10px">+ Lisää tuote</button></fieldset>

  <fieldset><legend>Lisätyöt</legend><div class="items">
  ${r.extras.map((x, n) => `<div class="extra"><label class="f">Lisätyö<input type="text" data-x="${n}.name" value="${esc(x.name)}" placeholder="esim. Nuuttaus"></label><label class="f">Määrä<input type="text" inputmode="decimal" data-x="${n}.qty" value="${esc(x.qty)}" ${x.link ? 'title="Seuraa tuotteen määrää, kunnes muutat tätä"' : ""}></label><label class="f">À-hinta €<input type="text" inputmode="decimal" data-x="${n}.unitPrice" value="${esc(x.unitPrice)}"></label><label class="f">Yhteensä<input type="text" data-xline="${n}" value="${eur(xTotal(x))}" disabled></label><button class="btn sm ghost" data-ed="del-extra" data-n="${n}">Poista</button></div>`).join("") || `<p class="sub" style="margin:0">Ei lisätöitä. Valitse yleisiä lisätöitä tuoterivin alta tai lisää oma.</p>`}
  </div><button class="btn sm" data-ed="add-extra" style="margin-top:10px">+ Lisää lisätyö</button></fieldset>

  <fieldset><legend>Työ, tuotanto ja toimitus</legend><div class="grid">
    <label class="f wide">Kuvaus / työohje<textarea data-f="instructions">${esc(r.instructions)}</textarea></label>
    <label class="f">Tuotanto<select data-ed-change="production">${PRODUCTION.map(p => `<option ${r.productionMethod === p ? "selected" : ""}>${p}</option>`).join("")}</select></label>
    ${r.productionMethod === "Alihankkija" ? `<label class="f">Alihankkija *<select data-f="supplierId"><option value="">Valitse…</option>${sups.map(s => `<option value="${s.id}" ${r.supplierId === s.id ? "selected" : ""}>${esc(s.name)}${s.specialty ? " – " + esc(s.specialty) : ""}</option>`).join("")}</select></label>` : ""}
    <label class="f">Päiväys<input type="date" data-f="date" value="${esc(r.date)}"></label>
    <label class="f">Deadline *<input type="date" data-f="deadline" value="${esc(r.deadline)}"></label>
    <label class="f">Toimitustapa<select data-ed-change="delivery">${DELIVERY.map(p => `<option ${r.deliveryMethod === p ? "selected" : ""}>${p}</option>`).join("")}</select></label>
  </div>
  ${r.deliveryMethod !== "Nouto" ? `<h3>Toimitusosoite</h3><div class="grid">
    ${reg && reg.addresses.length ? `<label class="f wide">Valitse asiakkaan osoite<select data-ed-change="address"><option value="">–</option>${reg.addresses.map((a, i) => `<option value="${i}">${esc([a.label, addr(a).replace(/\n/g, ", ")].filter(Boolean).join(": "))}</option>`).join("")}</select></label>` : ""}
    <label class="f">Katuosoite *<input type="text" data-f="delivery.street" value="${esc(r.delivery.street)}"></label>
    <label class="f">Postinumero *<input type="text" inputmode="numeric" data-f="delivery.postcode" value="${esc(r.delivery.postcode)}"></label>
    <label class="f">Postitoimipaikka *<input type="text" data-f="delivery.city" value="${esc(r.delivery.city)}"></label>
  </div>` : ""}</fieldset>

  <fieldset><legend>Hinnoittelu</legend><div class="grid">
    <label class="f">Aloituskustannus €<input type="text" inputmode="decimal" data-f="startCost" value="${esc(r.startCost)}"></label>
    <label class="f">Laskutuslisä €<input type="text" inputmode="decimal" data-f="billingFee" value="${esc(r.billingFee)}"></label>
    <label class="f">Toimituskulut €<input type="text" inputmode="decimal" data-f="deliveryCost" value="${esc(r.deliveryCost)}"></label>
    <label class="f">Arvonlisävero<select data-f="vatMode" data-ed-change="vatmode">${Object.entries(VAT_MODES).map(([k, l]) => `<option value="${k}" ${r.vatMode === k ? "selected" : ""}>${k === "fi" ? l + " " + pct(num(S.settings.vat)) : l}</option>`).join("")}</select></label>
    ${kind === "order" ? `<label class="f">Laskun viite<input type="text" data-f="reference" value="${esc(r.reference)}" placeholder="Oletus: tilausnumero"></label>` : ""}
  </div>
  <div class="totals" id="tot" style="margin-top:14px">${totalsHTML(t)}</div></fieldset>

  <fieldset><legend>Liitteet</legend><input type="file" id="files" multiple>
    <ul class="files">${r.attachments.map((a, n) => `<li><span>${esc(a.name)} <span class="sub">${Math.ceil((a.size || 0) / 1024)} kt</span></span><button class="btn sm ghost" data-ed="del-file" data-n="${n}">Poista</button></li>`).join("")}</ul></fieldset>
  </div>
  <div class="sticky-bar">${buttons}</div>`;
}
function itemTools(r, i, n){
  const p = S.products[i.productId];
  const open = editing.ui.calcOpen && editing.ui.calcOpen[i.iid];
  const chips = (p?.extras || []).map((x, k) => { const on = r.extras.some(e => e.src === i.iid + ":" + k);
    return `<button class="chip" data-ed="add-pex" data-n="${n}" data-k="${k}" aria-pressed="${on}">${on ? "✓" : "+"} ${esc(x.name)} · ${eur4(num(x.price))}${x.per === "yks" ? " / " + esc(i.unit || "kpl") : ""}</button>`; }).join("");
  const c = i.calc || {};
  const f = (k, l, ph = "") => `<label class="f">${l}<input type="text" inputmode="decimal" data-ic="${n}.${k}" value="${esc(c[k] ?? "")}" placeholder="${esc(ph)}"></label>`;
  const sels = (p?.options || []).map((g, gi) => `<label class="f">${esc(g.name)}<select data-io="${n}.${gi}">${g.choices.map((ch, ci) => `<option value="${ci}" ${String((i.opts || {})[gi] ?? 0) === String(ci) ? "selected" : ""}>${esc(ch.label)}${choiceHint(ch) ? " (" + choiceHint(ch) + ")" : ""}</option>`).join("")}</select></label>`).join("");
  return `<div class="item-tools"><button class="btn sm ${open ? "primary" : ""}" data-ed="toggle-calc" data-n="${n}" aria-expanded="${!!open}">${p?.options?.length ? "Valinnat ja laskuri" : "Laskuri"}</button>${p ? `<span class="small" data-hint="${n}">${priceHint(i)}</span>` : ""}${chips ? `<span class="sub small">Yleiset lisätyöt</span>${chips}` : ""}</div>
  ${open ? `<div class="icalc">${sels ? `<div class="grid">${sels}</div>` : ""}
  ${tableRows(p).length ? `<p class="small" style="margin:10px 0 0">Hintataulukko (oletusvalinnoilla): ${priceTableText(p, i.qty)}</p>` : p?.tiers?.length ? `<p class="small" style="margin:10px 0 0">Määräalennus: ${tiersText(p, i.qty)}</p>` : ""}
  <h3>Lisäkustannukset ja kate</h3><div class="grid">${f("base", "Oma perushinta / yks. €", p && tableRows(p).length ? "hintataulukosta" : p ? String(p.baseCost) : "")}${f("prod", "Tuotantokustannukset €")}${f("mat", "Materiaali €")}${f("other", "Muut kulut €")}${f("margin", "Lisäkate %")}</div>
  <div class="row" style="justify-content:space-between;margin-top:10px"><span class="small" data-icres="${n}">${icalcText(i)}</span><button class="btn sm go" data-ed="apply-calc" data-n="${n}">Käytä hinta ja tiedot</button></div></div>` : ""}`;
}
function priceHint(i, n = editing ? editing.rec.items.indexOf(i) : 0){
  const p = S.products[i.productId]; if (!p) return "";
  const c = priceConfig(p, i.qty, i.opts, i.calc);
  return i.autoPrice ? `Hintaehdotus <b>${eur(c.total)}</b> (${eur4(c.unitPrice)} / ${esc(i.unit || "kpl")}) · päivittyy automaattisesti` : `Hintaehdotus ${eur(c.total)} · <button class="link" data-ed="use-suggest" data-n="${n}">käytä ehdotusta</button>`;
}
function icalcText(i){
  const p = S.products[i.productId], c = priceConfig(p, i.qty, i.opts, i.calc);
  return `${eur4(c.baseUnit)}/yks${c.disc ? ` −${nfmt(c.disc)} %` : ""} × ${nfmt(c.q)}${c.fixed ? " + " + eur(c.fixed) : ""}${c.costs ? " + kulut " + eur(c.costs) : ""}${Math.abs(c.marginSum) >= 0.005 ? " + kate " + eur(c.marginSum) : ""} = <b>${eur(c.total)}</b> · à-hinta <b>${eur4(c.unitPrice)}</b> / ${esc(i.unit || "kpl")}`;
}
function totalsHTML(t){
  return `<span>Tuotteet</span><span class="r">${eur(t.items)}</span><span>Lisätyöt</span><span class="r">${eur(t.extras)}</span>
  ${t.disc ? `<span>Asiakasalennus ${pct(t.dp)}</span><span class="r">−${eur(t.disc)}</span>` : ""}
  <span>Aloituskustannus</span><span class="r">${eur(t.start)}</span><span>Laskutuslisä</span><span class="r">${eur(t.fee)}</span><span>Toimituskulut</span><span class="r">${eur(t.ship)}</span>
  <span>Yhteensä alv 0 %</span><span class="r">${eur(t.net)}</span><span>Alv ${pct(t.vr)}</span><span class="r">${eur(t.vat)}</span>
  <span class="big">Yhteensä</span><span class="big r">${eur(t.total)}</span>`;
}

function customerEditor(){
  const c = editing.rec;
  const i = (k, l, cls = "", extra = "") => `<label class="f">${l}${cls === "req" ? " *" : ""}<input type="text" data-cu="${k}" value="${esc(getPath(c, k))}" ${extra}></label>`;
  return `<button class="back" data-ed="cancel">← Peruuta</button><div class="head"><div><h1>${esc(editing.isNew ? "Uusi asiakas" : c.name)}</h1></div></div>
  <div class="form" id="ed">${errBox()}
  <fieldset><legend>Perustiedot</legend><div class="grid">
    ${i("name", "Yrityksen nimi", "req")}${i("ytunnus", "Y-tunnus", "", 'placeholder="1234567-8"')}
    <label class="f">Maa<select data-cu="country">${COUNTRIES.map(x => `<option ${(c.country || "Suomi") === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>
    ${i("vatId", "ALV-tunniste (VAT ID)", "", 'placeholder="ulkomaiset: esim. SE556677889901"')}
    <label class="f">Asiakkuuden tila<select data-cu="status">${CUST_ST.map(s => `<option ${c.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
    ${i("terms", "Maksuehto pv", "", `inputmode="numeric" placeholder="${esc(S.settings.terms)}"`)}${i("discount", "Asiakasalennus %", "", 'inputmode="decimal"')}
  </div></fieldset>
  <fieldset><legend>Yhteyshenkilöt</legend>
  ${c.contacts.map((k, n) => `<div class="sub-row"><label class="f">Nimi<input type="text" data-cu="contacts.${n}.name" value="${esc(k.name)}"></label><label class="f">Rooli<input type="text" data-cu="contacts.${n}.role" value="${esc(k.role)}"></label><label class="f">Sähköposti<input type="email" data-cu="contacts.${n}.email" value="${esc(k.email)}"></label><label class="f">Puhelin<input type="tel" data-cu="contacts.${n}.phone" value="${esc(k.phone)}"></label><button class="btn sm ghost" data-ed="del-contact" data-n="${n}">Poista</button></div>`).join("")}
  <button class="btn sm" data-ed="add-contact" style="margin-top:10px">+ Lisää yhteyshenkilö</button></fieldset>
  <fieldset><legend>Toimitusosoitteet</legend>
  ${c.addresses.map((a, n) => `<div class="sub-row"><label class="f">Nimi<input type="text" data-cu="addresses.${n}.label" value="${esc(a.label)}" placeholder="esim. Varasto"></label><label class="f">Katuosoite<input type="text" data-cu="addresses.${n}.street" value="${esc(a.street)}"></label><label class="f">Postinumero<input type="text" inputmode="numeric" data-cu="addresses.${n}.postcode" value="${esc(a.postcode)}"></label><label class="f">Postitoimipaikka<input type="text" data-cu="addresses.${n}.city" value="${esc(a.city)}"></label><button class="btn sm ghost" data-ed="del-address" data-n="${n}">Poista</button></div>`).join("")}
  <button class="btn sm" data-ed="add-address" style="margin-top:10px">+ Lisää toimitusosoite</button></fieldset>
  <fieldset><legend>Laskutus</legend><div class="grid">
    ${i("billing.street", "Laskutusosoite")}${i("billing.postcode", "Postinumero", "", 'inputmode="numeric"')}${i("billing.city", "Postitoimipaikka")}${i("einvoice", "Verkkolaskuosoite")}${i("operator", "Välittäjätunnus")}
    <label class="f wide">Muistiinpanot<textarea data-cu="notes">${esc(c.notes)}</textarea></label>
  </div></fieldset></div>
  <div class="sticky-bar"><button class="btn ghost" data-ed="cancel">Peruuta</button><button class="btn primary" data-ed="save-customer">Tallenna asiakas</button></div>`;
}
function simpleEditor(kind){
  const o = editing.rec;
  const i = (k, l, cls = "", extra = "") => `<label class="f">${l}${cls === "req" ? " *" : ""}<input type="text" data-se2="${k}" value="${esc(o[k])}" ${extra}></label>`;
  const body = kind === "supplier"
    ? `<fieldset><legend>Alihankkija</legend><div class="grid">${i("name", "Yritys", "req")}${i("specialty", "Erikoisala", "", 'placeholder="esim. Suurkuva, Sidonta"')}${i("contact", "Yhteyshenkilö")}${i("email", "Sähköposti")}${i("phone", "Puhelin")}${i("street", "Katuosoite")}${i("postcode", "Postinumero")}${i("city", "Postitoimipaikka")}${i("leadTime", "Toimitusaika", "", 'placeholder="esim. 3–5 arkipäivää"')}
       <label class="f wide">Muistiinpanot<textarea data-se2="notes">${esc(o.notes)}</textarea></label></div></fieldset>`
    : `<fieldset><legend>Tuote</legend><div class="grid">${i("name", "Tuoteryhmä / nimi", "req")}${i("unit", "Yksikkö")}${i("baseCost", "Perushinta / yks. €", "", 'inputmode="decimal"')}${i("costPct", "Kustannusosuus % (katelaskenta)", "", 'inputmode="decimal"')}${i("startCost", "Aloituskustannus €", "", 'inputmode="decimal"')}${i("format", "Oletusformaatti")}${i("material", "Oletusmateriaali")}${i("colors", "Oletusvärit")}
       <label class="f wide">Kuvaus<textarea data-se2="description">${esc(o.description)}</textarea></label></div></fieldset>
       <fieldset><legend>Yleiset lisätyöt</legend><p class="sub small" style="margin:0 0 6px">Näkyvät valintoina tarjouksen ja tilauksen tuoterivillä. Hinta per työ lisätään kerran, hinta per yksikkö kerrotaan tuotteen määrällä.</p>
       ${(o.extras || []).map((x, n) => `<div class="extra pe"><label class="f">Lisätyö<input type="text" data-pe="${n}.name" value="${esc(x.name)}"></label><label class="f">Hinta €<input type="text" inputmode="decimal" data-pe="${n}.price" value="${esc(x.price)}"></label><label class="f">Hinnoittelu<select data-pe="${n}.per"><option value="työ" ${x.per !== "yks" ? "selected" : ""}>per työ</option><option value="yks" ${x.per === "yks" ? "selected" : ""}>per ${esc(o.unit || "yks")}</option></select></label><button class="btn sm ghost" data-ed="del-pe" data-n="${n}">Poista</button></div>`).join("") || `<p class="sub">Ei lisätöitä.</p>`}
       <button class="btn sm" data-ed="add-pe" style="margin-top:10px">+ Lisää lisätyö</button></fieldset>
       <fieldset><legend>Hintataulukko</legend><p class="sub small" style="margin:0 0 6px">Kokonaishinta € alv 0 % oletusvalinnoilla. Välimäärien hinta lasketaan portaiden välistä, suurempien määrien viimeisen portaan kappalehinnalla. Alle pienimmän määrän veloitetaan pienimmän portaan hinta.</p>
       ${(o.prices || []).map((t, ti) => `<div class="extra pe"><label class="f">Määrä ${esc(o.unit || "kpl")}<input type="text" inputmode="numeric" data-pp="${ti}.qty" value="${esc(t.qty)}"></label><label class="f">Hinta yhteensä €<input type="text" inputmode="decimal" data-pp="${ti}.price" value="${esc(t.price)}"></label><span class="small sub" style="align-self:center">${num(t.qty) ? eur4(num(t.price) / num(t.qty)) + " / " + esc(o.unit || "kpl") : ""}</span><button class="btn sm ghost" data-ed="del-pp" data-n="${ti}">Poista</button></div>`).join("") || `<p class="sub">Ei hintataulukkoa – hinta lasketaan perushinnasta × määrä.</p>`}
       <button class="btn sm" data-ed="add-pp" style="margin-top:10px">+ Lisää porras</button></fieldset>
       <fieldset><legend>Valinnat (koko, paperi, painatus …)</legend><p class="sub small" style="margin:0 0 6px">Ensimmäinen vaihtoehto on oletus. <b>Kerroin</b> kertoo perushinnan (1 = ei muutosta), <b>€/yks</b> lisää hinnan jokaiseen kappaleeseen, <b>€/työ</b> lisää kerran. Kenttä kertoo, mihin tuoterivin tietoon valinta kirjoitetaan.</p>
       ${(o.options || []).map((g, gi) => `<div class="optgroup"><div class="extra pe"><label class="f">Valinnan nimi<input type="text" data-po="${gi}.name" value="${esc(g.name)}"></label>
         <label class="f">Kirjoitetaan kenttään<select data-po="${gi}.field">${[["", "Kuvaus"],["format","Formaatti"],["material","Materiaali"],["colors","Värit"],["printInfo","Painotiedot"]].map(([v, l]) => `<option value="${v}" ${g.field === v ? "selected" : ""}>${l}</option>`).join("")}</select></label><span></span>
         <button class="btn sm bad" data-ed="del-pg" data-n="${gi}">Poista valinta</button></div>
         ${g.choices.map((c, ci) => `<div class="extra choice"><label class="f">Vaihtoehto${ci === 0 ? " (oletus)" : ""}<input type="text" data-pc="${gi}.${ci}.label" value="${esc(c.label)}"></label>
           <label class="f">Hinnoittelu<select data-pc="${gi}.${ci}.mode"><option value="kerroin" ${c.mode === "kerroin" ? "selected" : ""}>Kerroin ×</option><option value="yks" ${c.mode === "yks" ? "selected" : ""}>+ € / ${esc(o.unit || "yks")}</option><option value="työ" ${c.mode === "työ" ? "selected" : ""}>+ € / työ</option></select></label>
           <label class="f">Arvo<input type="text" inputmode="decimal" data-pc="${gi}.${ci}.value" value="${esc(c.value)}"></label>
           <span class="row" style="flex-wrap:nowrap">${ci > 0 ? `<button class="btn sm ghost" data-ed="up-pc" data-n="${gi}" data-k="${ci}" aria-label="Siirrä ylös">↑</button>` : ""}<button class="btn sm ghost" data-ed="del-pc" data-n="${gi}" data-k="${ci}">Poista</button></span></div>`).join("")}
         <button class="btn sm" data-ed="add-pc" data-n="${gi}" style="margin-top:8px">+ Vaihtoehto</button></div>`).join("") || `<p class="sub">Ei valintoja.</p>`}
       <button class="btn sm" data-ed="add-pg" style="margin-top:10px">+ Lisää valinta</button></fieldset>
       <fieldset><legend>Määräalennus</legend><p class="sub small" style="margin:0 0 6px">Käytetään vain, jos tuotteella ei ole hintataulukkoa. Alennus perushinnasta, kun määrä on vähintään annettu kappalemäärä.</p>
       ${(o.tiers || []).map((t, ti) => `<div class="extra pe"><label class="f">Alkaen ${esc(o.unit || "kpl")}<input type="text" inputmode="numeric" data-pt="${ti}.from" value="${esc(t.from)}"></label><label class="f">Alennus %<input type="text" inputmode="decimal" data-pt="${ti}.disc" value="${esc(t.disc)}"></label><span></span><button class="btn sm ghost" data-ed="del-pt" data-n="${ti}">Poista</button></div>`).join("") || `<p class="sub">Ei määräalennuksia.</p>`}
       <button class="btn sm" data-ed="add-pt" style="margin-top:10px">+ Lisää porras</button></fieldset>
       ${DEFAULT_CONFIG[o.name] ? `<div class="row"><button class="btn sm ghost" data-ed="reset-pconf">Palauta oletushinnat, -valinnat ja -lisätyöt</button></div>` : ""}`;
  return `<button class="back" data-ed="cancel">← Peruuta</button><div class="head"><div><h1>${esc(editing.isNew ? (kind === "supplier" ? "Uusi alihankkija" : "Oma tuote") : o.name)}</h1></div></div>
  <div class="form" id="ed">${errBox()}${body}</div>
  <div class="sticky-bar"><button class="btn ghost" data-ed="cancel">Peruuta</button>${!editing.isNew ? `<button class="btn bad" data-ed="delete-${kind}">Poista</button>` : ""}<button class="btn primary" data-ed="save-${kind}">Tallenna</button></div>`;
}

/* leave the editor after saving: an edited record returns to the page it was opened from
   (no duplicate history entries); a new record replaces the editor entry with its own page */
function leaveEditor(view, id = ""){
  const wasNew = editing ? editing.isNew : true;
  editing = null;
  if (!wasNew && depth > 0) { history.back(); return; }
  go(view, id, {replace:true});
}
function readEditor(){
  if (!editing) return;
  const r = editing.rec, k = editing.kind;
  if (k === "customer") { $$("#ed [data-cu]").forEach(el => setPath(r, el.dataset.cu, el.value)); return; }
  if (k === "supplier" || k === "product") { $$("#ed [data-se2]").forEach(el => r[el.dataset.se2] = el.value); $$("#ed [data-pe]").forEach(el => { const [n, key] = el.dataset.pe.split("."); r.extras[n][key] = el.value; });
    $$("#ed [data-po]").forEach(el => { const [gi, key] = el.dataset.po.split("."); r.options[gi][key] = el.value; });
    $$("#ed [data-pc]").forEach(el => { const [gi, ci, key] = el.dataset.pc.split("."); r.options[gi].choices[ci][key] = el.value; });
    $$("#ed [data-pt]").forEach(el => { const [ti, key] = el.dataset.pt.split("."); r.tiers[ti][key] = el.value; });
    $$("#ed [data-pp]").forEach(el => { const [ti, key] = el.dataset.pp.split("."); r.prices[ti][key] = el.value; });
    return; }
  $$("#ed [data-f]").forEach(el => setPath(r, el.dataset.f, el.value));
  if (!VAT_MODES[r.vatMode]) r.vatMode = "fi";
  r.vatRate = r.vatMode === "fi" ? num(S.settings.vat) : 0;
  $$("#ed [data-c]").forEach(el => r.customer[el.dataset.c] = el.value);
  $$("#ed [data-i]").forEach(el => { const [n, key] = el.dataset.i.split("."); r.items[n][key] = el.value; });
  $$("#ed [data-x]").forEach(el => { const [n, key] = el.dataset.x.split("."); r.extras[n][key] = el.value; });
  r.extras.forEach(x => x.price = xTotal(x));
  $$("#ed [data-ic]").forEach(el => { const [n, key] = el.dataset.ic.split("."); r.items[n].calc = r.items[n].calc || {}; r.items[n].calc[key] = el.value; });
  $$("#ed [data-io]").forEach(el => { const [n, gi] = el.dataset.io.split("."); r.items[n].opts = r.items[n].opts || {}; r.items[n].opts[gi] = el.value; });
}
function rerenderEditor(){ const y = window.scrollY; $("#main").innerHTML = editorHTML(); afterEditorRender(); applyTones(); window.scrollTo(0, y); }
function afterEditorRender(){
  const q = $("#custq");
  if (q) q.addEventListener("input", () => {
    const res = searchCustomers(q.value);
    $("#custres").innerHTML = q.value.trim() ? (res.map(c => { const k = c.contacts[0] || {}; return `<button type="button" data-pick="${c.id}" role="option"><b>${esc(c.name)}</b> ${c.status !== "Aktiivinen" ? `<span class="sub small">${esc(c.status)}</span>` : ""}<small>${esc([c.ytunnus, k.name, k.email, k.phone].filter(Boolean).join(" · "))}</small></button>`; }).join("")
      || `<button type="button" data-ed="new-cust"><b>Ei osumia</b><small>Luo uusi asiakas “${esc(q.value)}”</small></button>`) : "";
  });
}
function updateTotals(){
  if (!$("#tot")) return;
  $("#tot").innerHTML = totalsHTML(totals(editing.rec));
  editing.rec.items.forEach((it, n) => { const el = document.querySelector(`[data-line="${n}"]`); if (el) el.value = eur(num(it.qty) * num(it.price)); const c = document.querySelector(`[data-icres="${n}"]`); if (c) c.innerHTML = icalcText(it); });
  editing.rec.extras.forEach((x, n) => { const el = document.querySelector(`[data-xline="${n}"]`); if (el) el.value = eur(xTotal(x)); const q = document.querySelector(`[data-x="${n}.qty"]`); if (q && document.activeElement !== q) q.value = x.qty; });
}
function pickCustomer(c){
  readEditor();
  const r = editing.rec;
  r.customerId = c.id; r.customer = snapshotFrom(c); if (!num(r.discount)) r.discount = String(num(c.discount));
  const a = c.addresses[0];
  if (a && !r.delivery.street) r.delivery = {street:a.street || "", postcode:a.postcode || "", city:a.city || ""};
  editing.ui.newCust = false;
  const m = vatModeFor(c.country); if (m !== r.vatMode) { r.vatMode = m; r.vatRate = m === "fi" ? num(S.settings.vat) : 0; toast(`${c.country}: ${VAT_MODES[m]}`); }
  rerenderEditor();
  if (c.status === "Passiivinen") toast("Huom: asiakas on merkitty passiiviseksi");
}

function validateRec(r, strict){
  const e = [];
  if (!r.customer?.name?.trim()) e.push("Asiakkaan nimi puuttuu.");
  if (r.customer?.ytunnus && !validY(r.customer.ytunnus)) e.push("Y-tunnuksen muoto on 1234567-8.");
  if (!r.customerId && r.customer?.ytunnus) { const d = dupY(r.customer.ytunnus); if (d) e.push(`Y-tunnus ${r.customer.ytunnus} on jo asiakkaalla ${d.name}. Valitse asiakas haulla.`); }
  if (strict) {
    const items = r.items.filter(i => String(i.product).trim());
    if (!items.length) e.push("Lisää vähintään yksi tuote.");
    items.forEach(i => { if (num(i.qty) <= 0) e.push(`Tuotteen “${i.product}” määrän pitää olla suurempi kuin 0.`); });
    r.extras.forEach(x => { if (!String(x.name).trim()) e.push("Lisätyöltä puuttuu nimi."); });
    if (!r.deadline) e.push("Deadline puuttuu.");
    if (r.deliveryMethod !== "Nouto" && !(r.delivery.street && r.delivery.postcode && r.delivery.city)) e.push(`Toimitustapa ${r.deliveryMethod} vaatii toimitusosoitteen, postinumeron ja postitoimipaikan.`);
    if (r.delivery.postcode && r.deliveryMethod !== "Nouto" && !/^\d{5}$/.test(String(r.delivery.postcode).trim())) e.push("Postinumeron pitää olla viisi numeroa.");
    if (r.productionMethod === "Alihankkija" && !r.supplierId) e.push("Valitse alihankkija.");
    if (r.vatMode === "eu" && !String(r.customer.vatId || "").trim()) e.push("EU-yhteisömyynti vaatii asiakkaan ALV-tunnisteen (VAT ID), esim. SE556677889901.");
    if (r.vatMode === "eu" && r.customer.vatId && !/^[A-Z]{2}[0-9A-Z]{2,13}$/.test(String(r.customer.vatId).replace(/[\s.-]/g, "").toUpperCase())) e.push("ALV-tunnisteen muoto: maatunnus + numero, esim. SE556677889901.");
  }
  return e;
}
async function ensureCustomer(r, statusIfNew){
  if (r.customerId && S.customers[r.customerId]) {
    const c = S.customers[r.customerId];
    if (c.status === "Prospekti" && statusIfNew === "Aktiivinen") { const u = clone(c); u.status = "Aktiivinen"; await put("customers", u); }
    return;
  }
  const s = r.customer;
  const c = normCust({id:uid(), name:s.name.trim(), ytunnus:s.ytunnus || "", status:statusIfNew,
    contacts:(s.contactName || s.email || s.phone) ? [{name:s.contactName || "", email:s.email || "", phone:s.phone || "", role:""}] : [],
    addresses:r.delivery.street ? [{label:"Toimitusosoite", ...r.delivery}] : [],
    billing:{street:s.billStreet || "", postcode:s.billPostcode || "", city:s.billCity || ""}, einvoice:s.einvoice || "", operator:s.operator || "",
    terms:s.terms || "", discount:num(r.discount), notes:"", country:s.country || "Suomi", vatId:s.vatId || ""});
  await put("customers", c); r.customerId = c.id; r.customer.id = c.id;
}
function showErrors(e){ editing.errors = e; rerenderEditor(); const b = $(".errs"); if (b) b.scrollIntoView({behavior:"smooth", block:"center"}); toast(e[0]); }

async function editorAction(act, n, el){
  readEditor();
  const r = editing.rec, kind = editing.kind;
  switch (act) {
    case "cancel": { editing = null; if (depth > 0) history.back(); else go({offer:"offers", order:"orders", customer:"customers", supplier:"suppliers", product:"products"}[kind] || "dashboard", "", {replace:true}); return; }
    case "add-item": r.items.push(blankItem()); return rerenderEditor();
    case "del-item": r.items.splice(n, 1); if (!r.items.length) r.items.push(blankItem()); return rerenderEditor();
    case "add-extra": r.extras.push({name:"", qty:"1", unitPrice:"0", unit:"työ", price:0}); return rerenderEditor();
    case "del-extra": r.extras.splice(n, 1); return rerenderEditor();
    case "add-pex": {
      const it = r.items[n], k = +el.dataset.k, p = S.products[it.productId], x = p?.extras?.[k]; if (!x) return;
      const src = it.iid + ":" + k, idx = r.extras.findIndex(e => e.src === src);
      if (idx >= 0) { r.extras.splice(idx, 1); return rerenderEditor(); }
      const per = x.per === "yks";
      r.extras.push({name: x.name + (r.items.length > 1 ? " – " + (it.product || p.name) : ""), qty: per ? String(it.qty) : "1", unitPrice: String(x.price), unit: per ? (it.unit || "kpl") : "työ", src, link: per ? it.iid : "", price: 0});
      r.extras.forEach(e => e.price = xTotal(e));
      return rerenderEditor();
    }
    case "toggle-calc": {
      const it = r.items[n]; editing.ui.calcOpen = editing.ui.calcOpen || {};
      if (!it.calc) { const p = S.products[it.productId]; it.calc = {base:p ? "" : String(num(it.price)), prod:"0", mat:"0", other:"0", margin:"0"}; }
      if (!it.opts) it.opts = {};
      editing.ui.calcOpen[it.iid] = !editing.ui.calcOpen[it.iid]; return rerenderEditor();
    }
    case "use-suggest": { const it = r.items[n], p = S.products[it.productId]; if (!p) return; it.price = String(priceConfig(p, it.qty, it.opts, it.calc).unitPrice); it.autoPrice = true; return rerenderEditor(); }
    case "apply-calc": {
      const it = r.items[n], p = S.products[it.productId], c = priceConfig(p, it.qty, it.opts, it.calc); if (!c.q) return toast("Anna tuotteen määrä ensin");
      it.price = String(c.unitPrice); it.autoPrice = !!p; Object.assign(it, optFields(p, it.opts));
      editing.ui.calcOpen[it.iid] = false; rerenderEditor(); return toast(`À-hinta ${eur4(c.unitPrice)} ja tuotetiedot päivitetty riville`);
    }
    case "add-pe": r.extras = r.extras || []; r.extras.push({name:"", price:"0", per:"työ"}); return rerenderEditor();
    case "add-pg": r.options = r.options || []; r.options.push({name:"", field:"", choices:[{label:"", mode:"kerroin", value:"1"}]}); return rerenderEditor();
    case "del-pg": r.options.splice(n, 1); return rerenderEditor();
    case "add-pc": r.options[n].choices.push({label:"", mode:"kerroin", value:"1"}); return rerenderEditor();
    case "del-pc": r.options[n].choices.splice(+el.dataset.k, 1); return rerenderEditor();
    case "up-pc": { const cs = r.options[n].choices, k = +el.dataset.k; if (k > 0) [cs[k - 1], cs[k]] = [cs[k], cs[k - 1]]; return rerenderEditor(); }
    case "add-pt": r.tiers = r.tiers || []; r.tiers.push({from:"", disc:""}); return rerenderEditor();
    case "add-pp": r.prices = r.prices || []; r.prices.push({qty:"", price:""}); return rerenderEditor();
    case "del-pp": r.prices.splice(n, 1); return rerenderEditor();
    case "del-pt": r.tiers.splice(n, 1); return rerenderEditor();
    case "reset-pconf": { if (!DEFAULT_CONFIG[r.name] && !DEFAULT_EXTRAS[r.name]) return toast("Tälle tuotteelle ei ole oletusvalintoja"); r.options = defaultOptions(r.name); r.tiers = defaultTiers(r.name); r.extras = defaultExtras(r.name); r.prices = defaultPrices(r.name); rerenderEditor(); return toast("Oletusvalinnat palautettu – tallenna, jos haluat pitää ne"); }
    case "del-pe": r.extras.splice(n, 1); return rerenderEditor();
    case "del-file": r.attachments.splice(n, 1); return rerenderEditor();
    case "new-cust": { const q = $("#custq")?.value || ""; r.customerId = ""; r.customer = {name:q.trim()}; editing.ui.newCust = true; return rerenderEditor(); }
    case "change-cust": r.customerId = ""; r.customer = {}; editing.ui.newCust = false; rerenderEditor(); return $("#custq")?.focus();
    case "add-contact": r.contacts.push({name:"", role:"", email:"", phone:""}); return rerenderEditor();
    case "del-contact": r.contacts.splice(n, 1); return rerenderEditor();
    case "add-address": r.addresses.push({label:"", street:"", postcode:"", city:""}); return rerenderEditor();
    case "del-address": r.addresses.splice(n, 1); return rerenderEditor();
    case "calc": { updateTotals(); $("#tot").scrollIntoView({behavior:"smooth", block:"center"}); return toast("Hinta laskettu: " + eur(totals(r).net) + " alv 0, " + eur(totals(r).total) + " sis. alv"); }
    case "save-customer": {
      const e = [];
      if (!r.name?.trim()) e.push("Yrityksen nimi puuttuu.");
      if (r.ytunnus && !validY(r.ytunnus)) e.push("Y-tunnuksen muoto on 1234567-8.");
      const d = dupY(r.ytunnus, r.id); if (d) e.push(`Y-tunnus ${r.ytunnus} on jo asiakkaalla ${d.name}.`);
      [...r.contacts.map(k => k.postcode), ...r.addresses.map(a => a.postcode), r.billing.postcode].filter(Boolean).forEach(p => { if (!/^\d{5}$/.test(String(p).trim())) e.push(`Postinumero ${p} ei ole viisi numeroa.`); });
      if (e.length) return showErrors(e);
      r.contacts = r.contacts.filter(k => k.name || k.email || k.phone); r.addresses = r.addresses.filter(a => a.street || a.city);
      r.ytunnus = r.ytunnus ? normY(r.ytunnus) : "";
      await put("customers", r); toast("Asiakas tallennettu"); return leaveEditor("customer", r.id);
    }
    case "save-supplier": case "save-product": {
      if (!r.name?.trim()) return showErrors(["Nimi puuttuu."]);
      const coll = kind === "supplier" ? "suppliers" : "products";
      if (kind === "product") { r.baseCost = num(r.baseCost); r.startCost = num(r.startCost); r.costPct = num(r.costPct); if (!r.sort) r.sort = 100 + Object.keys(S.products).length; r.extras = (r.extras || []).filter(x => String(x.name).trim()).map(x => ({name:x.name.trim(), price:num(x.price), per:x.per === "yks" ? "yks" : "työ"}));
        r.options = (r.options || []).filter(g => String(g.name).trim()).map(g => ({name:g.name.trim(), field:g.field || "", choices:g.choices.filter(c => String(c.label).trim()).map(c => ({label:c.label.trim(), mode:["kerroin","yks","työ"].includes(c.mode) ? c.mode : "kerroin", value:num(c.value)}))})).filter(g => g.choices.length);
        r.tiers = (r.tiers || []).filter(t => num(t.from) > 0).map(t => ({from:num(t.from), disc:num(t.disc)})).sort((a, b) => a.from - b.from);
        r.prices = (r.prices || []).filter(t => num(t.qty) > 0 && String(t.price).trim() !== "").map(t => ({qty:num(t.qty), price:num(t.price)})).sort((a, b) => a.qty - b.qty);
        if (r.prices.length) r.baseCost = Math.round(r.prices[0].price / r.prices[0].qty * 10000) / 10000; }
      await put(coll, r); toast("Tallennettu");
      return kind === "supplier" ? leaveEditor("supplier", r.id) : leaveEditor("products");
    }
    case "delete-supplier": case "delete-product": {
      const coll = kind === "supplier" ? "suppliers" : "products";
      if (kind === "supplier" && Object.values(S.orders).some(o => o.supplierId === r.id && o.status !== "Laskutettu")) return toast("Alihankkijalla on avoimia tilauksia – ei voi poistaa");
      if (!await confirmBox("Poista", `Poistetaanko ${esc(r.name)}?`, "Poista", true)) return;
      await del(coll, r.id); editing = null; return go(coll, "", {replace:true});
    }
  }
  // offer / order save
  const strict = act !== "draft";
  const e = validateRec(r, strict); if (e.length) return showErrors(e);
  if (strict) r.items = r.items.filter(i => String(i.product).trim());
  await ensureCustomer(r, kind === "order" ? "Aktiivinen" : "Prospekti");
  const wasNew = editing.isNew;
  if (kind === "offer") {
    if (!r.no) r.no = nextNo("TAR", "offers");
    if (act === "draft") { r.status = "Luonnos"; log(r, wasNew ? "Luonnos luotu" : "Luonnos tallennettu"); await put("offers", r); editing = null; toast("Luonnos tallennettu"); return go("offers", "", {replace:true}); }
    if (act === "ready") { const was = r.status; r.status = "Valmis lähetettäväksi"; log(r, was === "Valmis lähetettäväksi" ? "Tarjousta muokattu" : "Tarjous tallennettu lähetettäväksi"); }
    else log(r, "Tarjousta muokattu");
    await put("offers", r); toast("Tarjous tallennettu"); return leaveEditor("offer", r.id);
  }
  if (!r.no) { r.no = nextNo("TIL", "orders"); log(r, r.copiedFrom ? `Tilaus luotu kopioimalla työ ${r.copiedFrom}` : "Tilaus luotu (Vahvistettu)"); }
  else log(r, "Tilausta muokattu");
  await put("orders", r); toast(wasNew ? `Tilaus ${r.no} luotu` : "Muutokset tallennettu"); return leaveEditor("order", r.id);
}
async function editorChange(kind, el){
  readEditor();
  const r = editing.rec;
  if (kind === "group") {
    const n = +el.dataset.n, p = S.products[el.value];
    if (p) { const old = r.items[n]; r.extras = r.extras.filter(e => !(e.src && e.src.startsWith(old.iid + ":")));
      const t = tableRows(p); const q = num(old.qty) > 1 ? old.qty : String(t.length ? t[0].q : 1);
      r.items[n] = {...itemFromProduct(p, q), iid:old.iid, desc:old.desc || p.description || ""}; if (num(p.startCost) > num(r.startCost)) r.startCost = String(p.startCost); }
    else { r.items[n].group = OWN; r.items[n].productId = ""; }
  }
  if (kind === "production") { r.productionMethod = el.value; if (el.value !== "Alihankkija") r.supplierId = ""; }
  if (kind === "delivery") r.deliveryMethod = el.value;
  if (kind === "country") { const m = vatModeFor(r.customer.country); if (m !== r.vatMode) { r.vatMode = m; r.vatRate = m === "fi" ? num(S.settings.vat) : 0; toast(`Arvonlisävero: ${VAT_MODES[m]}`); } }
  if (kind === "contact") { const c = S.customers[r.customerId]; const k = c?.contacts[+el.value]; if (k) Object.assign(r.customer, {contactName:k.name, email:k.email, phone:k.phone}); }
  if (kind === "address") { const c = S.customers[r.customerId]; const a = c?.addresses[+el.value]; if (a) r.delivery = {street:a.street, postcode:a.postcode, city:a.city}; }
  rerenderEditor();
}

/* ================= actions ================= */
async function act(name, el){
  const o = route.view === "offer" ? S.offers[route.id] : route.view === "order" ? S.orders[route.id] : null;
  switch (name) {
    case "new-offer": return startEdit("offer", blankRecord("offer"), true);
    case "new-order": return startEdit("order", blankRecord("order"), true);
    case "new-customer": return startEdit("customer", normCust({id:uid(), name:"", ytunnus:"", status:"Aktiivinen", contacts:[{name:"", role:"", email:"", phone:""}], addresses:[{label:"", street:"", postcode:"", city:""}], billing:{street:"", postcode:"", city:""}, terms:"", discount:0}), true);
    case "edit-customer": return startEdit("customer", S.customers[route.id], false);
    case "cust-offer": case "cust-order": {
      const c = S.customers[route.id], kind = name === "cust-offer" ? "offer" : "order";
      const r = blankRecord(kind); r.customerId = c.id; r.customer = snapshotFrom(c); r.discount = String(num(c.discount));
      r.vatMode = vatModeFor(c.country); r.vatRate = r.vatMode === "fi" ? num(S.settings.vat) : 0;
      if (c.addresses[0]) r.delivery = {street:c.addresses[0].street, postcode:c.addresses[0].postcode, city:c.addresses[0].city};
      return startEdit(kind, r, true);
    }
    case "new-supplier": return startEdit("supplier", {id:uid(), name:"", specialty:"", contact:"", email:"", phone:"", street:"", postcode:"", city:"", leadTime:"", notes:""}, true);
    case "edit-supplier": return startEdit("supplier", S.suppliers[route.id], false);
    case "new-product": return startEdit("product", {id:uid(), name:"", unit:"kpl", baseCost:"0", startCost:String(S.settings.startCost), format:"", material:"", colors:"", description:"", custom:true}, true);
    case "edit-offer": return startEdit("offer", o, false);
    case "edit-order": return startEdit("order", o, false);
    case "send-offer": {
      if (!await confirmBox("Lähetä tarjous", `Merkitäänkö tarjous ${esc(o.no)} lähetetyksi asiakkaalle ${esc(cust(o).name)}?`, "Lähetä tarjous")) return;
      const r = clone(o); r.status = "Lähetetty"; r.sentAt = new Date().toISOString(); log(r, "Tarjous lähetetty asiakkaalle"); await put("offers", r);
      toast("Tarjous lähetetty"); return go("offers", "", {replace:true});
    }
    case "delete-offer": {
      if (!await confirmBox("Poista tarjous", `Poistetaanko tarjous ${esc(o.no)} pysyvästi? Tarjousta ei ole lähetetty asiakkaalle.`, "Poista tarjous", true)) return;
      await del("offers", o.id); toast("Tarjous poistettu"); return go("offers", "", {replace:true});
    }
    case "accept-offer": {
      const choice = await choiceBox("Merkitse hyväksytyksi", `<p style="margin:0 0 10px">Onko asiakas varmasti hyväksynyt tarjouksen <b>${esc(o.no)}</b>?</p><p class="sub small" style="margin:0">Valitse, mitä tehdään samalla. Tilauksen voi luoda myöhemminkin tarjouksen sivulta.</p>`, [
        {label:"Hyväksy ja luo tilaus", value:"order", tone:"G"},
        {label:"Hyväksy ja aloita tuotanto heti", value:"prod", tone:"O"},
        {label:"Vain hyväksy (tilaus myöhemmin)", value:"accept", tone:"H"},
        {label:"Peruuta", value:null, tone:"W"}]);
      if (!choice) return;
      const r = clone(o); r.status = "Hyväksytty"; r.acceptedAt = new Date().toISOString(); log(r, "Asiakas hyväksyi tarjouksen"); await put("offers", r);
      if (choice === "accept") { toast("Tarjous hyväksytty"); return render(); }
      return createOrderFromOffer(r, choice === "prod");
    }
    case "reject-offer": {
      if (!await confirmBox("Hylkää tarjous", "Merkitäänkö tarjous hylätyksi? Tilausta ei luoda.", "Hylkää tarjous", true)) return;
      const r = clone(o); r.status = "Hylätty"; log(r, "Tarjous hylätty"); await put("offers", r); toast("Tarjous hylätty"); return render();
    }
    case "create-order": case "create-order-prod": {
      const prod = name === "create-order-prod";
      if (!await confirmBox(prod ? "Luo tilaus ja aloita tuotanto" : "Luo tilaus", `Luodaan uusi tilaus tarjouksesta ${esc(o.no)}${prod ? " ja siirretään se suoraan tuotantoon" : ""}.`, prod ? "Luo ja aloita tuotanto" : "Luo tilaus")) return;
      return createOrderFromOffer(o, prod);
    }
    case "copy-offer": {
      const r = clone(o); Object.assign(r, {id:uid(), no:"", status:"Luonnos", history:[], date:today(), deadline:"", copiedFrom:o.no});
      ["orderId","sentAt","acceptedAt"].forEach(k => delete r[k]);
      return startEdit("offer", r, true);
    }
    case "copy-order": {
      const r = clone(o);
      Object.assign(r, {id:uid(), no:"", status:"Vahvistettu", history:[], date:today(), deadline:"", copiedFrom:o.no});
      ["offerId","offerNo","stage","payMethod","receiptDate","invoicedAt","finishedAt","reference","prodNotes"].forEach(k => delete r[k]);
      return startEdit("order", r, true);
    }
    case "start-prod": {
      if (!await confirmBox("Aloita tuotanto", `Siirretäänkö ${esc(o.no)} tuotantoon?`, "Aloita tuotanto")) return;
      const r = clone(o); r.status = "Tuotannossa"; r.stage = "Aloitettu"; log(r, "Tuotanto aloitettu"); await put("orders", r); return render();
    }
    case "save-costs": {
      const r = clone(o); r.costs = {};
      $$("#costs [data-cost]").forEach(i => { if (String(i.value).trim() !== "") r.costs[i.dataset.cost] = num(i.value); });
      const m = marginOf(r); log(r, `Kustannukset kirjattu: ${eur(m.cost)}, kate ${pctTxt(m.pct)}`);
      await put("orders", r); pageDirty = false; toast("Kustannukset tallennettu"); return render();
    }
    case "save-wo": { const r = clone(o); readWO(r); log(r, "Työmääräystä päivitetty"); await put("orders", r); toast("Muutokset tallennettu"); return render(); }
    case "finish-prod": {
      if (!await confirmBox("Kuittaa valmiiksi", "Onko tuotanto valmis? Työmääräyksen muutokset tallennetaan samalla.", "Kuittaa valmiiksi")) return;
      const r = clone(o); readWO(r); r.status = "Valmis"; r.stage = "Valmis"; r.finishedAt = new Date().toISOString(); log(r, "Tuotanto kuitattu valmiiksi"); await put("orders", r); return render();
    }
    case "to-invoice": {
      if (!await confirmBox("Siirrä laskun tarkastukseen", "Siirretäänkö tilaus laskun tarkastukseen?", "Siirrä")) return;
      const r = clone(o); r.status = "Laskutusvalmis"; log(r, "Siirretty laskun tarkastukseen"); await put("orders", r); return render();
    }
    case "back-to-order": {
      if (!await confirmBox("Takaisin tilaukseen", "Palautetaanko tilaus tilaan Valmis?", "Palauta")) return;
      const r = clone(o); r.status = "Valmis"; log(r, "Palautettu laskun tarkastuksesta tilaan Valmis"); await put("orders", r); return render();
    }
    case "approve-invoice": {
      if (!await confirmBox("Hyväksy lasku", `Hyväksytäänkö lasku ${eur(totals(o).total)} (sis. alv)? Työ arkistoidaan eikä sitä voi enää muokata.`, "Hyväksy lasku")) return;
      const r = clone(o); r.status = "Laskutettu"; r.invoicedAt = new Date().toISOString(); log(r, "Lasku hyväksytty, työ arkistoitu"); await put("orders", r);
      toast("Lasku hyväksytty"); return render();
    }
    case "delete-order": {
      if (!await confirmBox("Poista tilaus", `Poistetaanko ${esc(o.no)} pysyvästi?`, "Poista tilaus", true)) return;
      if (o.offerId && S.offers[o.offerId]) { const of = clone(S.offers[o.offerId]); delete of.orderId; log(of, `Tilaus ${o.no} poistettu`); await put("offers", of); }
      await del("orders", o.id); toast("Tilaus poistettu"); return go("orders", "", {replace:true});
    }
    case "save-settings": case "save-admin": {
      if (!isAdmin) return toast("Vain ylläpitäjä voi muuttaa asetuksia");
      $$("[data-se]").forEach(i => S.settings[i.dataset.se] = /startCost|billingFee|terms|vat|margin|offerValidity|hourlyCost|costPct|extrasCostPct/.test(i.dataset.se) ? num(i.value) : i.value);
      if (themeDraft) S.settings.theme = clone(themeDraft);
      try { await putSettings(); } catch(_) { return; }
      themeDraft = null; pageDirty = false; applyTheme(); toast("Ylläpidon muutokset tallennettu"); return render();
    }
    case "export-data": {
      const data = {app:"copyset-erp", version:1, exportedAt:new Date().toISOString(), settings:S.settings};
      COLLS.forEach(k => data[k] = S[k]);
      $("#exportbox").value = JSON.stringify(data); pageDirty = true;
      return toast(`Varmuuskopio luotu: ${COLLS.map(k => Object.keys(S[k]).length).reduce((a, b) => a + b, 0)} tietuetta`);
    }
    case "copy-export": {
      const t = $("#exportbox"); if (!t.value) return toast("Luo varmuuskopio ensin");
      try { await navigator.clipboard.writeText(t.value); toast("Kopioitu leikepöydälle"); }
      catch(_) { t.select(); try { document.execCommand("copy"); toast("Kopioitu leikepöydälle"); } catch(__) { toast("Valitse teksti ja kopioi"); } }
      return;
    }
    case "import-data": {
      let data; try { data = JSON.parse($("#importbox").value); } catch(_) { return toast("Varmuuskopio ei ole kelvollista JSON-tekstiä"); }
      if (data?.app !== "copyset-erp") return toast("Tämä ei ole Copy-Set ERP:n varmuuskopio");
      const count = COLLS.reduce((a, k) => a + Object.keys(data[k] || {}).length, 0);
      if (!await confirmBox("Tuo tiedot", `Tuodaanko ${count} tietuetta ja asetukset? Samat tietueet päivitetään, muita ei poisteta.`, "Tuo tiedot")) return;
      try {
        let n = 0;
        for (const k of COLLS) for (const [id, o] of Object.entries(data[k] || {})) { await put(k, norm(k, {...clone(o), id})); if (++n % 20 === 0) toast(`Tuodaan… ${n} / ${count}`); }
        if (data.settings) { S.settings = normSettings(clone(data.settings)); await putSettings(); }
      } catch(_) { return toast("Tuonti keskeytyi – yritä uudelleen"); }
      pageDirty = false; $("#importbox").value = ""; toast(`Tuotu ${count} tietuetta`); return render();
    }
    case "reset-tones": { themeDraft = DEFAULT_THEME(); pageDirty = true; applyTheme(); return render(); }
    case "save-pricelist": {
      if (!isAdmin) return;
      const changed = {};
      $$("[data-pl]").forEach(i => { const [id, k] = i.dataset.pl.split("."); const p = S.products[id]; if (!p) return; const v = k === "unit" ? i.value.trim() : num(i.value); if (String(p[k]) !== String(v)) { changed[id] = changed[id] || clone(p); changed[id][k] = v; } });
      $$("[data-plt]").forEach(i => { const [id, ix, k] = i.dataset.plt.split("."); const p = S.products[id]; if (!p || !p.prices?.[ix]) return; const v = num(i.value); if (num(p.prices[ix][k]) !== v) { changed[id] = changed[id] || clone(p); changed[id].prices[ix][k] = v; } });
      Object.values(changed).forEach(p => { p.prices = (p.prices || []).filter(t => num(t.qty) > 0).sort((a, b) => a.qty - b.qty); if (p.prices.length) p.baseCost = Math.round(p.prices[0].price / p.prices[0].qty * 10000) / 10000; });
      const list = Object.values(changed);
      if (!list.length) return toast("Ei muutoksia hinnastoon");
      try { for (const p of list) await put("products", p); } catch(_) { return; }
      pageDirty = false; toast(`Perushinnasto tallennettu (${list.length} tuotetta)`); return render();
    }
    case "clear-archive": { const st = ls("archive"); st.q = ""; st.from = ""; st.to = ""; return render(); }
    case "calc-to-offer": {
      if ($("#calcdlg").open) $("#calcdlg").close();
      const res = calcResult(), p = res.p;
      if (!res.pc.q) return toast("Anna määrä");
      const cc = {base:calc.base, prod:calc.prod, mat:calc.mat, other:"0", margin:calc.margin};
      const item = p ? itemFromProduct(p, calc.qty, String(res.pc.unitPrice), calc.opts, cc) : {...blankItem(), product:calc.product || OWN, qty:String(res.pc.q), unit:calc.unit || "kpl", price:String(res.pc.unitPrice), calc:{...cc, base:calc.base}};
      if (calc.product) item.product = calc.product;
      const base = calc.target !== "new" && S.offers[calc.target] ? clone(S.offers[calc.target]) : blankRecord("offer");
      const isNew = !base.no;
      if (isNew) base.items = [];
      base.items.push(item);
      res.exList.forEach(e => base.extras.push({name:e.name + (base.items.length > 1 ? " – " + item.product : ""), qty:String(e.qty), unitPrice:String(e.unitPrice), unit:e.per === "yks" ? item.unit : (e.per === "oma" && e.qty !== 1 ? "kpl" : "työ"), src:e.k == null ? "" : item.iid + ":" + e.k, link:e.per === "yks" ? item.iid : "", price:e.total}));
      base.startCost = String(isNew ? res.start : Math.max(num(base.startCost), res.start));
      base.deliveryCost = String(num(base.deliveryCost) + num(calc.delivery));
      if (isNew) base.billingFee = String(res.fee);
      if (num(calc.discount) && (isNew || !num(base.discount))) base.discount = String(num(calc.discount));
      if (calc.vat && calc.vat !== "fi") { base.vatMode = calc.vat === "0" ? "export" : calc.vat; base.vatRate = 0; }
      return startEdit("offer", base, isNew);
    }
    case "calc-add-extra": calc.custom = calc.custom || []; calc.custom.push({name:"", qty:"1", price:"0"}); return refreshCalc();
    case "calc-del-extra": calc.custom.splice(+el.dataset.n, 1); return refreshCalc();
    case "mkt-all": mktCustomers().forEach(x => mkt.selected.add(x.c.id)); return render();
    case "mkt-none": mkt.selected.clear(); return render();
    case "copy-bcc": {
      const t = $("#bcc");
      try { await navigator.clipboard.writeText(t.value); toast("BCC-lista kopioitu"); }
      catch(e){ t.select(); try { document.execCommand("copy"); toast("BCC-lista kopioitu"); } catch(_) { toast("Kopioi lista valitsemalla teksti"); } }
      return;
    }
  }
}
function readWO(r){
  pageDirty = false;
  $$("#wo [data-wo]").forEach(el => { const [n, k] = el.dataset.wo.split("."); if (r.items[n]) r.items[n][k] = el.value; });
  $$("#wo [data-wof]").forEach(el => r[el.dataset.wof] = el.value);
}

/* ================= events ================= */
document.addEventListener("click", async e => {
  const t = e.target.closest("button,tr,a");
  if (!t || t.tagName === "A") return;
  const d = t.dataset;
  { const k = btnKey(t); if (k && t.classList.contains("btn")) lastTone = toneOf(k) || "O"; }
  if (d.pick) return pickCustomer(S.customers[d.pick]);
  if (d.ed) { e.preventDefault(); return editorAction(d.ed, +d.n, t); }
  if (d.nav) { editing = null; const st = ls(d.nav); st.scroll = 0; return go(d.nav); }
  if (d.back) { saveScroll(); return goBack(d.back); }
  if (d.filter) { ls(route.view).filter = d.filter; return render(); }
  if (d.period) { const st = ls("dashboard"); st.period = d.period; if (d.period !== "Oma väli") [st.from, st.to] = rangeFor(d.period); return render(); }
  if (d.supq) { const st = ls("suppliers"); st.q = st.q === d.supq ? "" : d.supq; return render(); }
  if (d.mg) { mkt.groups.has(d.mg) ? mkt.groups.delete(d.mg) : mkt.groups.add(d.mg); mkt.selected = new Set(mktCustomers().map(x => x.c.id)); return render(); }
  if (d.openOffer) return go("offer", d.openOffer);
  if (d.openOrder) return go("order", d.openOrder);
  if (d.openCustomer) return go("customer", d.openCustomer);
  if (d.openSupplier) return go("supplier", d.openSupplier);
  if (d.doc) return openDoc(d.doc);
  if (d.prodOffer) { const p = S.products[d.prodOffer]; const r = blankRecord("offer"); r.items = [itemFromProduct(p)]; r.startCost = String(Math.max(num(S.settings.startCost), num(p.startCost))); return startEdit("offer", r, true); }
  if (d.prodCalc) return openQuickCalc(S.products[d.prodCalc]);
  if (d.prodEdit) return startEdit("product", S.products[d.prodEdit], false);
  if (d.stage) {
    const o = clone(S.orders[route.id]); if (o.stage === d.stage) return;
    readWO(o); o.stage = d.stage; log(o, "Tuotantovaihe: " + o.stage); await put("orders", o); return render();
  }
  if (d.act) return act(d.act, t);
});
let qT;
document.addEventListener("input", e => {
  const el = e.target, d = el.dataset;
  if (el.closest("#wo") || el.closest("#admin") || el.closest("#costs")) pageDirty = true;
  if (d.bg || d.bghex) { const k = d.bg || d.bghex, v = el.value.trim(); if (!/^#[0-9a-fA-F]{6}$/.test(v)) return; themeDraft = themeDraft || clone(S.settings.theme); themeDraft.bg = themeDraft.bg || {...BG_DEFAULTS}; themeDraft.bg[k] = v; applyTheme();
    const other = document.querySelector(d.bg ? `[data-bghex="${k}"]` : `[data-bg="${k}"]`); if (other) other.value = v;
    const w = document.querySelector(`[data-bgwarn="${k}"]`); if (w) w.textContent = lum(v) < 0.45 ? "Liian tumma – teksti voi olla vaikealukuinen" : ""; return; }
  if (d.tone || d.tonehex) { const k = d.tone || d.tonehex, v = el.value.trim(); if (!/^#[0-9a-fA-F]{6}$/.test(v)) return; themeDraft = themeDraft || clone(S.settings.theme); themeDraft.tones[k] = v; applyTheme();
    const other = document.querySelector(d.tone ? `[data-tonehex="${k}"]` : `[data-tone="${k}"]`); if (other) other.value = v; return; }
  if (d.q) { ls(d.q).q = el.value; clearTimeout(qT); qT = setTimeout(() => { const pos = el.selectionStart; render(); const n = document.querySelector(`[data-q="${d.q}"]`); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch(_){} } }, 180); return; }
  if (d.calc && el.tagName === "INPUT") { calc[d.calc] = el.value; $("#calcres").innerHTML = calcResultHTML(calcResult()); const t = $("#tiers"); if (t) { const pp = S.products[calc.productId]; t.innerHTML = tableRows(pp).length ? priceTableText(pp, calc.qty) : tiersText(pp, calc.qty); } return; }
  if (d.ccx) { const [n, k] = d.ccx.split("."); calc.custom[n][k] = el.value; const c = calc.custom[n]; const l = document.querySelector(`[data-ccxl="${n}"]`); if (l) l.value = eur(num(c.price) * (num(c.qty) || 1)); $("#calcres").innerHTML = calcResultHTML(calcResult()); return; }
  if (d.cexp != null) { calc.ex[d.cexp] = calc.ex[d.cexp] || {on:false}; calc.ex[d.cexp].price = el.value; $("#calcres").innerHTML = calcResultHTML(calcResult()); return; }
  if (editing && d.i && d.i.endsWith(".price")) { const it = editing.rec.items[+d.i.split(".")[0]]; if (it) it.autoPrice = false; }
  if (d.mk) { mkt[d.mk] = el.value; const list = mktCustomers().filter(x => mkt.selected.has(x.c.id)); $("#olprev").innerHTML = outlookHTML("", list.length); return; }
  if (editing && d.x && d.x.endsWith(".qty")) { const x = editing.rec.extras[+d.x.split(".")[0]]; if (x) x.link = ""; }
  if (editing && el.matches("[data-i$='.qty'],[data-i$='.price'],[data-x$='.qty'],[data-x$='.unitPrice'],[data-ic],[data-io],[data-f=startCost],[data-f=billingFee],[data-f=deliveryCost],[data-f=discount]")) {
    readEditor();
    const nn = d.i ? +d.i.split(".")[0] : d.ic ? +d.ic.split(".")[0] : d.io ? +d.io.split(".")[0] : null;
    if (nn != null && editing.rec.items[nn]) { const it = editing.rec.items[nn], p = S.products[it.productId];
      if (it.autoPrice && p && !(d.i && d.i.endsWith(".price"))) { it.price = String(priceConfig(p, it.qty, it.opts, it.calc).unitPrice); const pe = document.querySelector(`[data-i="${nn}.price"]`); if (pe) pe.value = it.price; }
      const h = document.querySelector(`[data-hint="${nn}"]`); if (h) h.innerHTML = priceHint(it); }
    if (d.i && d.i.endsWith(".qty")) { const it = editing.rec.items[+d.i.split(".")[0]]; editing.rec.extras.forEach(x => { if (x.link && x.link === it.iid) { x.qty = it.qty; x.price = xTotal(x); } }); }
    updateTotals();
  }
});
document.addEventListener("change", e => {
  const el = e.target, d = el.dataset;
  if (d.bmap) { themeDraft = themeDraft || clone(S.settings.theme); themeDraft.buttons[d.bmap] = el.value; pageDirty = true; const y = window.scrollY; render(); window.scrollTo(0, y); return; }
  if (d.edChange) return editorChange(d.edChange, el);
  if (editing && el.id === "files") { readEditor(); [...el.files].forEach(f => editing.rec.attachments.push({name:f.name, size:f.size, type:f.type, addedAt:new Date().toISOString()})); return rerenderEditor(); }

  if (d.range) { const st = ls("dashboard"); st[d.range] = el.value; st.period = "Oma väli"; return render(); }
  if (d.arch) { ls("archive")[d.arch] = el.value; return render(); }
  if (d.calc && el.tagName === "SELECT") {
    calc[d.calc] = el.value;
    if (d.calc === "productId") calcSetProduct(S.products[el.value]);
    return refreshCalc();
  }
  if (d.mc) { el.checked ? mkt.selected.add(d.mc) : mkt.selected.delete(d.mc); return render(); }
  if (d.copt != null) { calc.opts[d.copt] = el.value; return refreshCalc(); }
  if (d.cex != null) { const p = S.products[calc.productId]; calc.ex[d.cex] = calc.ex[d.cex] || {price:String(p?.extras?.[d.cex]?.price ?? 0)}; calc.ex[d.cex].on = el.checked; $("#calcres").innerHTML = calcResultHTML(calcResult()); return; }
  if (editing && d.io) { readEditor(); const n = +d.io.split(".")[0], it = editing.rec.items[n]; const p = S.products[it.productId]; if (it.autoPrice && p) { it.price = String(priceConfig(p, it.qty, it.opts, it.calc).unitPrice); Object.assign(it, optFields(p, it.opts)); rerenderEditor(); } return; }
});
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.id === "custq") { const b = $("#custres button"); if (b) { e.preventDefault(); b.click(); } }
});

/* start: connect storage, then restore the previous view */
(async function init(){
  $("#main").innerHTML = `<div class="empty">Ladataan…</div>`;
  if (!(await startStorage())) return;
  booted = true;
  let h = location.hash;
  if (!h || h === "#") { try { h = sessionStorage.getItem("copyset-last") || ""; } catch(e){} }
  if (!h || h.startsWith("#/edit")) h = "#/dashboard";
  history.replaceState({d:0}, "", h);
  applyRoute();
})();
