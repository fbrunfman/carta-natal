// Reparto angular de los planetas dentro de su casa. Sin DOM: se puede probar en node.
//
// Regla: el glifo de un planeta nunca sale de la casa a la que pertenece. Si varios
// planetas se pisan, se separan solo dentro de los límites de esa casa, moviéndose lo
// mínimo posible desde su posición real (regresión isotónica acotada).

const norm360 = (x) => ((x % 360) + 360) % 360;

export const MARGIN = 3.0;        // grados que un glifo se mantiene lejos de la cúspide
export const MARGIN_TIGHT = 1.6;  // margen reducido cuando la casa está muy poblada
export const SEP = 6.2;           // separación preferida entre glifos vecinos (grados)

/** Mínimos cuadrados con y no decreciente (pool adjacent violators). */
function isotonic(q) {
  const blocks = [];
  for (const v of q) {
    blocks.push({ sum: v, n: 1 });
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1];
      const a = blocks[blocks.length - 2];
      if (a.sum / a.n <= b.sum / b.n) break;
      a.sum += b.sum;
      a.n += b.n;
      blocks.pop();
    }
  }
  const y = [];
  for (const b of blocks) for (let i = 0; i < b.n; i++) y.push(b.sum / b.n);
  return y;
}

/**
 * @param bodies [{id, lon, house}] con la casa ya calculada
 * @param cusps  longitudes de las 12 cúspides
 * @param asc    longitud del Ascendente (origen de los ángulos de la rueda)
 * @returns {id: φ}  ángulo mostrado, medido desde el Ascendente, 0..360
 */
export function placePlanets(bodies, cusps, asc) {
  const out = {};
  for (let h = 1; h <= 12; h++) {
    const members = bodies.filter((b) => b.house === h);
    const k = members.length;
    if (!k) continue;

    const start = cusps[h - 1];
    const w = norm360(cusps[h % 12] - start) || 360;   // ancho de la casa
    const a = norm360(start - asc);                    // dónde empieza, desde el Ascendente

    const items = members
      .map((b) => {
        let u = norm360(b.lon - start);
        if (u > w) u = 360 - u < 0.01 ? 0 : w;         // ruido numérico justo sobre la cúspide
        return { id: b.id, u };
      })
      .sort((p, q) => p.u - q.u);

    let sep = SEP;
    let lo = MARGIN, hi = w - MARGIN;
    if ((k - 1) * sep > hi - lo) { lo = MARGIN_TIGHT; hi = w - MARGIN_TIGHT; }
    if (hi < lo) lo = hi = w / 2;                      // casa angostísima
    if ((k - 1) * sep > hi - lo) sep = k > 1 ? (hi - lo) / (k - 1) : 0;

    const up = hi - (k - 1) * sep;
    const y = isotonic(items.map((it, i) => it.u - i * sep)).map((v) => Math.min(Math.max(v, lo), up));
    items.forEach((it, i) => { out[it.id] = norm360(a + y[i] + i * sep); });
  }
  return out;
}

export const SEP_OUT = 4.8;       // separación entre pilas del anillo exterior (grados)

/**
 * Anillo exterior (tránsitos / otra carta): no hay casas que respetar, solo se evita que las
 * pilas se pisen. Se corta el círculo por el hueco más grande y se separa con la misma regresión
 * isotónica, así cada cuerpo se mueve lo mínimo y el orden no cambia.
 * @param items [{id, lon}]
 * @returns {id: longitud mostrada, 0..360}
 */
export function spreadRing(items, sep = SEP_OUT) {
  const n = items.length;
  if (!n) return {};
  const sorted = items.map((it) => ({ id: it.id, lon: norm360(it.lon) })).sort((p, q) => p.lon - q.lon);

  let cut = 0, widest = -1;                          // el hueco más ancho queda entre `cut` y el siguiente
  for (let i = 0; i < n; i++) {
    const gap = n === 1 ? 360 : norm360(sorted[(i + 1) % n].lon - sorted[i].lon);
    if (gap > widest) { widest = gap; cut = i; }
  }
  const first = (cut + 1) % n;
  const base = sorted[first].lon;
  const seq = Array.from({ length: n }, (_, k) => {
    const it = sorted[(first + k) % n];
    return { id: it.id, u: norm360(it.lon - base) };
  });

  const y = isotonic(seq.map((p, i) => p.u - i * sep)).map((v, i) => v + i * sep);
  const out = {};
  seq.forEach((p, i) => { out[p.id] = norm360(base + y[i]); });
  return out;
}
