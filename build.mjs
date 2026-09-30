#!/usr/bin/env node
/* Copy-Set ERP build – no dependencies, Node 18+.
   src/ + vendor/  →  dist/                    Hailer App (publish with npm run publish-production)
                  →  single/copyset-erp.html   one self-contained file (browser, Claude artifact)
   Both outputs contain exactly the same app.js and styles.css. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const rd = p => fs.readFileSync(path.join(ROOT, p), "utf8");
const wr = (p, t) => { fs.mkdirSync(path.dirname(path.join(ROOT, p)), {recursive:true}); fs.writeFileSync(path.join(ROOT, p), t); };
const cp = (a, b) => { fs.mkdirSync(path.dirname(path.join(ROOT, b)), {recursive:true}); fs.copyFileSync(path.join(ROOT, a), path.join(ROOT, b)); };

const tpl = rd("src/index.html"), css = rd("src/styles.css"), js = rd("src/app.js");
const manifest = JSON.parse(rd("public/manifest.json"));

/* Archivo variable font (OFL), latin + latin-ext, width and weight axes */
const LATIN = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const LATIN_EXT = "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";
const face = (src, range) => `@font-face{font-family:"Archivo";font-style:normal;font-display:swap;font-weight:100 900;font-stretch:62% 125%;src:${src};unicode-range:${range}}`;
const FONTS = [["archivo-latin-wdth-normal.woff2", LATIN], ["archivo-latin-ext-wdth-normal.woff2", LATIN_EXT]];

/* NOTE: replacements use functions – a plain string replacement would interpret "$'" etc. inside the code. */
/* ---------- dist/ (Hailer) ---------- */
fs.rmSync(path.join(ROOT, "dist"), {recursive:true, force:true});
wr("dist/index.html", tpl
  .replace("<!--FONTS-->", () => '<link rel="stylesheet" href="fonts/fonts.css">')
  .replace("<!--STYLES-->", () => '<link rel="stylesheet" href="styles.css">')
  .replace("<!--SCRIPTS-->", () => '<script type="module" src="hailer-boot.js"></script>\n<script src="app.js" defer></script>'));
wr("dist/styles.css", css);
wr("dist/app.js", js);
wr("dist/hailer-boot.js",
  "/* Loads the Hailer App SDK and hands it to app.js, which connects to Hailer when the app is opened inside it. */\n" +
  "import { HailerApi } from \"./vendor/app-sdk.js\";\n" +
  "window.HailerApi = HailerApi;\n");
cp("vendor/app-sdk.js", "dist/vendor/app-sdk.js");
for (const [f] of FONTS) cp("vendor/fonts/" + f, "dist/fonts/" + f);
cp("vendor/fonts/OFL-LICENSE.txt", "dist/fonts/OFL-LICENSE.txt");
wr("dist/fonts/fonts.css", FONTS.map(([f, r]) => face(`url(${f}) format("woff2-variations"),url(${f}) format("woff2")`, r)).join("\n") + "\n");
wr("dist/manifest.json", JSON.stringify(manifest, null, 2) + "\n");

/* ---------- single/ (one file) ---------- */
const embedded = FONTS.map(([f, r]) => {
  const b64 = fs.readFileSync(path.join(ROOT, "vendor/fonts", f)).toString("base64");
  return face(`url(data:font/woff2;base64,${b64}) format("woff2")`, r);
}).join("\n");
wr("single/copyset-erp.html", tpl
  .replace("<!--FONTS-->", () => `<style>\n${embedded}\n</style>\n<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap" rel="stylesheet">`)
  .replace("<!--STYLES-->", () => "<style>\n" + css + "</style>")
  .replace("<!--SCRIPTS-->", () => "<script>\n" + js + "</script>"));

console.log("Built dist/ and single/copyset-erp.html (version " + manifest.version + ")");
