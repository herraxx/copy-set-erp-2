# Copy-Set ERP

> **Toiselle Claudelle / kehittäjälle:** sovellus on valmis. Älä rakenna sitä uudelleen – julkaise `dist/`
> sellaisenaan tai käytä `single/copyset-erp.html` muuttamattomana. Katso `CLAUDE.md` ja `CHECKSUMS.txt`.


Tarjoukset, tilaukset, tuotanto, laskutus, CRM, tuotteet & hinnat, alihankkijat, markkinointi,
ylläpito ja dashboard painotalolle. Sama sovellus toimii Hailerissa, selaimessa ja Claude-artifaktina.

- **CLAUDE.md** – tarkka tekninen kuvaus (tietomalli, työnkulut, hinnoittelu, tallennus). Anna tämä
  tiedosto ensimmäisenä toiselle Claudelle tai kehittäjälle.
- **data/copyset-erp-backup.json** – kaikki nykyiset tiedot (asiakkaat, tarjoukset, tilaukset,
  tuotteet hintataulukkoineen, alihankkijat, asetukset ja värit).

## Käyttöönotto Hailerissa

### 1. Datatyönkulku (kerran)
1. Työtilan asetukset → Työnkulut → **Uusi työnkulku** (datasetti / unlinked mode): **Copy-Set ERP data**
2. Työnkulun avain (key): `copyset_erp_data`
3. Kenttä: tyyppi **Pitkä teksti (textarea)**, nimi **Data**, avain `erp_json`
4. Yksi vaihe riittää. Anna käyttäjille luku- ja muokkausoikeus.

Jos tämä puuttuu, sovellus näyttää ohjeen itse.

### 2. Julkaisu
Tarvitaan Node.js 20+ ja Hailerin käyttäjä-API-avain.
```bash
npm install
npm run publish-production -- --create --app-name "Copy-Set ERP" --workspace <työtilan-id> --user-api-key <avain> --force
# päivitykset myöhemmin:
npm run publish-production -- --user-api-key <avain> --force
```
`npm pack` rakentaa sovelluksen automaattisesti (`node build.mjs`) ja pakkaa vain `dist/`-kansion.

### 3. Tiedot 100 % samoiksi
Avaa sovellus Hailerissa → **Ylläpito → Varmuuskopio ja siirto → Tuo tiedot** → liitä
`data/copyset-erp-backup.json`-tiedoston koko sisältö → **Tuo tiedot**. Tuonti lisää ja päivittää,
se ei poista mitään, joten sen voi ajaa uudelleen.

Kun haluat myöhemmin uuden varmuuskopion: Ylläpito → Luo varmuuskopio → Kopioi.

## Kehitys
```bash
node build.mjs          # src/ → dist/ ja single/copyset-erp.html
npm run dev             # dist/ osoitteeseen http://localhost:3000 (Hailerissa: Local Development -sovellus)
bash tests/run_all.sh   # kaikki testit (pip install playwright && playwright install chromium)
```
Muokkaa vain `src/`-kansiota; `dist/` ja `single/` syntyvät rakennuksessa.

## Rakenne
```
src/            index.html, styles.css, app.js  ← lähdekoodi
vendor/         Hailer App SDK 2.9.0 ja Archivo-fontti (sisältyy, ei tarvitse verkkoa)
dist/           valmis Hailer-sovellus
single/         sama sovellus yhtenä tiedostona
data/           nykyiset tiedot
tests/          automaattiset testit (myös simuloitu Hailer)
build.mjs       rakennusskripti
public/manifest.json   sovelluksen nimi ja versio (appId tallentuu tähän)
```
