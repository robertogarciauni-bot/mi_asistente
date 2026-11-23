// Cifra la app completa para que solo el celular de Robert pueda abrirla.
// Uso (Node 18+):  node herramientas/cifrar-app.mjs <fuente/index.html> [llave=roster.pub.json] [salida=app.enc.json]
//
// La fuente en claro (index.html con todo el código y los datos personales) NUNCA va al repositorio:
// vive en /mnt/project-files/asistente/fuente/index.html. Al repo solo suben app.enc.json y el
// index.html "cascarón" (sin datos), que descifra app.enc.json con la llave privada del celular.
// Esquema igual al del roster: ECDH P-256 (llave efímera) -> HKDF-SHA256 ("mi-asistente-roster-v2") -> AES-GCM 256,
// sobre el HTML comprimido con gzip. Además sube la versión del caché en sw.js para que el celular
// note la versión nueva al deslizar para actualizar.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { webcrypto as crypto } from "node:crypto";
import { gzipSync } from "node:zlib";

const [entrada, archivoLlave = "roster.pub.json", salida = "app.enc.json"] = process.argv.slice(2);
if (!entrada) { console.error("Uso: node herramientas/cifrar-app.mjs <fuente/index.html> [roster.pub.json] [app.enc.json]"); process.exit(1); }
const html = readFileSync(entrada, "utf8");
if (!/<script>/.test(html) || !/descifrarRoster/.test(html)) throw new Error("Eso no parece la fuente de la app (falta el código)");
if (/id="cascaron"/.test(html)) throw new Error("Ese es el cascarón, no la fuente. Usa /mnt/project-files/asistente/fuente/index.html");

let txt = readFileSync(archivoLlave, "utf8").trim();
if (txt.startsWith("ROSTER-PUB:")) txt = Buffer.from(txt.slice(11), "base64").toString("utf8");
const pubJwk = JSON.parse(txt);
const pub = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: pubJwk.x, y: pubJwk.y }, { name: "ECDH", namedCurve: "P-256" }, false, []);
const efimera = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
const secreto = await crypto.subtle.deriveBits({ name: "ECDH", public: pub }, efimera.privateKey, 256);
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const hk = await crypto.subtle.importKey("raw", secreto, "HKDF", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt, info: new TextEncoder().encode("mi-asistente-roster-v2") },
  hk, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, gzipSync(Buffer.from(html, "utf8"), { level: 9 }));
const epk = await crypto.subtle.exportKey("jwk", efimera.publicKey);
const b64 = (b) => Buffer.from(b).toString("base64");
writeFileSync(salida, JSON.stringify({ v: 2, alg: "ECDH-P256+HKDF-SHA256+A256GCM", z: "gzip", kid: pubJwk.kid || null,
  epk: { kty: epk.kty, crv: epk.crv, x: epk.x, y: epk.y }, salt: b64(salt), iv: b64(iv), ct: b64(ct) }) + "\n");

const sw = "sw.js";
if (existsSync(sw)) {
  const s = readFileSync(sw, "utf8"), m = s.match(/asistente-v(\d+)/);
  if (m) { writeFileSync(sw, s.replace(m[0], "asistente-v" + (+m[1] + 1))); console.log("sw.js -> asistente-v" + (+m[1] + 1)); }
}
console.log("Listo:", salida, "(" + Math.round(readFileSync(salida).length / 1024) + " KB) para la llave", pubJwk.kid);
