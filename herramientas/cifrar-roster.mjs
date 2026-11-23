// Cifra el roster para la app "Mi Asistente" con la llave pública del celular.
// Uso (Node 18 o más reciente):
//   node herramientas/cifrar-roster.mjs <roster.json> [llave=roster.pub.json] [salida=roster.enc.json]
//
// roster.json (NO lo subas a GitHub):
//   {"actualizado":"2027-01-01","unidad":"Nombre de la unidad",
//    "guardias":[{"subida":"2027-01-01","bajada":"2027-01-14"},{"subida":"2027-01-22","bajada":null}]}
//
// roster.pub.json es la llave pública que generó el celular (Roster → Activar roster automático).
// No es secreta. La llave privada nunca sale del celular, así que solo ese celular puede leer el roster.
// Esquema: ECDH P-256 con llave efímera -> HKDF-SHA256 (info "mi-asistente-roster-v2") -> AES-GCM 256.
// La app descifra con los mismos parámetros (ver descifrarRoster en index.html).
import { readFileSync, writeFileSync } from "node:fs";
import { webcrypto as crypto } from "node:crypto";

const [entrada, archivoLlave = "roster.pub.json", salida = "roster.enc.json"] = process.argv.slice(2);
if (!entrada) {
  console.error("Uso: node cifrar-roster.mjs <roster.json> [roster.pub.json] [roster.enc.json]");
  process.exit(1);
}

const roster = JSON.parse(readFileSync(entrada, "utf8"));
const fecha = /^\d{4}-\d{2}-\d{2}$/;
// También sirve para claves.json: {"claves":["frase 1","frase 2"]} -> claves.enc.json
// Y para finanzas.json: {"actualizado","diezmo":{pagos},"pucallpa":{dias},"constructora":{movs}} -> finanzas.enc.json
const esFinanzas = !!(roster.diezmo || roster.pucallpa || roster.constructora);
if (Array.isArray(roster.claves)) { if (!roster.claves.length) throw new Error("'claves' está vacío"); }
else if (Array.isArray(roster.ideas)) { if (!roster.ideas.length) throw new Error("'ideas' está vacío"); } // ideas.json: {"ideas":[{"id","fecha","texto"}]} -> ideas.enc.json
else if (esFinanzas) {
  for (const [k, campo] of [["diezmo", "pagos"], ["pucallpa", "dias"], ["constructora", "movs"]])
    for (const x of (roster[k] && roster[k][campo]) || [])
      if (!fecha.test(x.f || "")) throw new Error(k + ": fecha inválida " + JSON.stringify(x));
}
else if (!Array.isArray(roster.guardias) || !roster.guardias.length) throw new Error("roster.json no tiene 'guardias'");
for (const g of roster.guardias || []) {
  if (!fecha.test(g.subida || "")) throw new Error("subida inválida: " + JSON.stringify(g));
  if (g.bajada != null && !fecha.test(g.bajada)) throw new Error("bajada inválida: " + JSON.stringify(g));
}

let txt = readFileSync(archivoLlave, "utf8").trim();
if (txt.startsWith("ROSTER-PUB:")) txt = Buffer.from(txt.slice(11), "base64").toString("utf8");
const pubJwk = JSON.parse(txt);

const pub = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: pubJwk.x, y: pubJwk.y }, { name: "ECDH", namedCurve: "P-256" }, false, []);
const efimera = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
const secreto = await crypto.subtle.deriveBits({ name: "ECDH", public: pub }, efimera.privateKey, 256);
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const hk = await crypto.subtle.importKey("raw", secreto, "HKDF", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey(
  { name: "HKDF", hash: "SHA-256", salt, info: new TextEncoder().encode("mi-asistente-roster-v2") },
  hk, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(roster)));
const epk = await crypto.subtle.exportKey("jwk", efimera.publicKey);

const b64 = (b) => Buffer.from(b).toString("base64");
writeFileSync(salida, JSON.stringify({
  v: 2, alg: "ECDH-P256+HKDF-SHA256+A256GCM", kid: pubJwk.kid || null,
  epk: { kty: epk.kty, crv: epk.crv, x: epk.x, y: epk.y }, salt: b64(salt), iv: b64(iv), ct: b64(ct),
}) + "\n");
console.log(`Listo: ${salida} (${roster.claves ? roster.claves.length + " claves" : roster.ideas ? roster.ideas.length + " ideas" : esFinanzas ? "finanzas" : roster.guardias.length + " guardias"}). Sube solo ${salida}; nunca subas el archivo sin cifrar.`);
