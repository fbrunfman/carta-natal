// Imágenes propias de cada carta (solo en la versión local). Acá: achicarlas antes de mandarlas y el buscador de la galería.
import { parseKey } from "./notes.js";

export const FULL_MAX = 2000;       // px del lado más largo: se ve bien grande en una pantalla retina y pesa poco
export const THUMB_MAX = 480;

/** Abre la imagen elegida (con la orientación de la foto). */
async function decode(file) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { src: bmp, w: bmp.width, h: bmp.height, done: () => bmp.close?.() };
  } catch { /* Safari viejo o un formato raro: por un <img> */ }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("No se pudo abrir esa imagen. Probá con un JPG, PNG o WebP.");
  }
  return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}

const toBlob = (c, type, q) => new Promise((res) => c.toBlob(res, type, q));
const toB64 = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(",", 2)[1] || "");
  r.onerror = () => rej(new Error("No se pudo leer la imagen."));
  r.readAsDataURL(blob);
});

/** La imagen achicada a `max` px (de a mitades, para que no quede serruchada), en WebP; si el navegador no sabe, en JPEG. */
async function shrink(img, max, q) {
  const k = Math.min(1, max / Math.max(img.w, img.h));
  const W = Math.max(1, Math.round(img.w * k)), H = Math.max(1, Math.round(img.h * k));
  let src = img.src, w = img.w, h = img.h;
  while (w / 2 >= W * 1.05 && h / 2 >= H) {            // de a mitades hasta acercarse
    const c = document.createElement("canvas");
    c.width = Math.round(w / 2); c.height = Math.round(h / 2);
    const g = c.getContext("2d");
    g.imageSmoothingQuality = "high";
    g.drawImage(src, 0, 0, c.width, c.height);
    src = c; w = c.width; h = c.height;
  }
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 0, 0, W, H);
  let blob = await toBlob(c, "image/webp", q);
  if (!blob || blob.type !== "image/webp") {           // (sin WebP: JPEG, sobre fondo claro por si tenía transparencias)
    const j = document.createElement("canvas");
    j.width = W; j.height = H;
    const jg = j.getContext("2d");
    jg.fillStyle = "#FBF5E6"; jg.fillRect(0, 0, W, H);
    jg.drawImage(c, 0, 0);
    blob = await toBlob(j, "image/jpeg", q);
  }
  if (!blob) throw new Error("No se pudo preparar la imagen.");
  return { b64: await toB64(blob), w: W, h: H, url: URL.createObjectURL(blob) };
}

/** Lo que se manda al servidor: la imagen (hasta 2000 px) y su miniatura; `preview` es para mostrarla antes de guardar. */
export async function prepImage(file) {
  if (!file || !/^image\//.test(file.type || "image/")) throw new Error("Eso no es una imagen.");
  const img = await decode(file);
  try {
    if (!img.w || !img.h) throw new Error("No se pudo abrir esa imagen.");
    const full = await shrink(img, FULL_MAX, 0.86);
    const thumb = await shrink(img, THUMB_MAX, 0.8);
    URL.revokeObjectURL(thumb.url);
    return { data: full.b64, thumb: thumb.b64, w: full.w, h: full.h, preview: full.url };
  } finally {
    img.done();
  }
}

const fold = (t) => String(t || "").toLocaleLowerCase("es").normalize("NFD").replace(/[̀-ͯ]/g, "");
export const HARD_TYPES = ["conjunction", "opposition", "square"];

/**
 * ¿La imagen entra en el filtro de la galería? f: { q, chart, pl, sign, house, a, asp, b } (vacío = cualquiera).
 * Busca por la foto de cada vínculo (cómo estaba la carta al vincular): Sol en Aries, en casa X, Sol □ Luna…
 */
export function imageMatches(img, f) {
  if (f.chart && img.chart !== f.chart) return false;
  if (f.q) {
    const q = fold(f.q).trim();
    if (q && !fold(`${img.title} ${img.text}`).includes(q)) return false;
  }
  const snap = img.snap || {};
  const sign = f.sign === "" || f.sign == null ? null : +f.sign;
  const house = f.house ? +f.house : null;
  if (f.pl || sign !== null || house) {
    const ok = (img.refs || []).some((r) => {
      const k = parseKey(r), s = snap[r] || {};
      if (!k) return false;
      if (k.kind === "pl") return (!f.pl || f.pl === k.ids[0]) && (sign === null || s.sign === sign) && (!house || s.house === house);
      if (k.kind === "angle") return (!f.pl || f.pl === r) && !house && (sign === null || s.sign === sign) && !!(f.pl || sign !== null);
      if (k.kind === "house") return !f.pl && house === k.n && (sign === null || s.sign === sign);
      if (k.kind === "asp") return !!f.pl && sign === null && !house && k.ids.includes(f.pl);
      return false;
    });
    if (!ok) return false;
  }
  if (f.a || f.asp || f.b) {
    const ok = (img.refs || []).some((r) => {
      const k = parseKey(r);
      if (!k || k.kind !== "asp") return false;
      const t = (snap[r] || {}).type;
      if (f.asp === "hard" ? !HARD_TYPES.includes(t) : f.asp && t !== f.asp) return false;
      const [x, y] = k.ids;
      if (f.a && f.b) return (x === f.a && y === f.b) || (x === f.b && y === f.a);
      if (f.a) return k.ids.includes(f.a);
      if (f.b) return k.ids.includes(f.b);
      return true;
    });
    if (!ok) return false;
  }
  return true;
}
