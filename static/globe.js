// El globito del formulario: un globo terráqueo chico, girado para que el lugar elegido quede en el centro.
// Se dibuja en un <canvas> punto por punto (proyección ortográfica inversa) sobre land.png, un mapa de tierra/agua
// equirectangular de 1024×512 hecho con Natural Earth 1:50m (dominio público). Sin internet: todo está en la app.

const D2R = Math.PI / 180;
let mask = null;            // { w, h, a: Uint8Array } (0 = agua … 255 = tierra)
let loading = null;

function loadMask() {
  if (mask) return Promise.resolve(mask);
  if (!loading) {
    loading = new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const g = c.getContext("2d", { willReadFrequently: true });
        g.drawImage(img, 0, 0);
        const px = g.getImageData(0, 0, c.width, c.height).data;
        const a = new Uint8Array(c.width * c.height);
        for (let i = 0; i < a.length; i++) a[i] = px[i * 4];
        mask = { w: c.width, h: c.height, a };
        res(mask);
      };
      img.onerror = () => { loading = null; rej(new Error("no se pudo cargar land.png")); };
      img.src = "land.png";
    });
  }
  return loading;
}

/** Un color CSS cualquiera (con transparencia, var() ya resuelto) → [r, g, b] sobre `under`. */
function rgbOf(css, under = "#fff") {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.fillStyle = under; g.fillRect(0, 0, 1, 1);
  g.fillStyle = "#000"; g.fillStyle = css; g.fillRect(0, 0, 1, 1);
  const [r, gg, b] = g.getImageData(0, 0, 1, 1).data;
  return [r, gg, b];
}
const mix = (a, b, t) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);

function palette(el) {
  const cs = getComputedStyle(el);
  const v = (n, d) => cs.getPropertyValue(n).trim() || d;
  const field = rgbOf(v("--field", "#fff"));
  const fieldCss = `rgb(${field.join(",")})`;
  const soft = rgbOf(v("--accent-soft", "#DCEAF6"), fieldCss);
  const strong = rgbOf(v("--line-strong", "#A9BDCD"), fieldCss);
  const line = rgbOf(v("--line", "#D5E0EA"), fieldCss);
  const dark = field[0] + field[1] + field[2] < 300;
  return {
    field, sea: mix(field, soft, 0.7), land: mix(field, strong, dark ? 0.75 : 0.95), grat: line,
    rim: `rgb(${strong.join(",")})`, accent: v("--accent-2", "#1F6FB2"), fieldCss,
  };
}

// tierra en (lon, lat), con interpolación bilineal: 0…1
function landAt(lon, lat) {
  const { w, h, a } = mask;
  let x = ((lon + 180) / 360) * w - 0.5, y = ((90 - lat) / 180) * h - 0.5;
  x = ((x % w) + w) % w;
  y = Math.max(0, Math.min(h - 1.001, y));
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, x1 = (x0 + 1) % w;
  const r0 = y0 * w, r1 = (y0 + 1) * w;
  const top = a[r0 + x0] * (1 - fx) + a[r0 + x1] * fx, bot = a[r1 + x0] * (1 - fx) + a[r1 + x1] * fx;
  return (top * (1 - fy) + bot * fy) / 255;
}

/** Dibuja el globo en `canvas` (tamaño CSS `size` px), centrado en lat/lon, con una marca en el lugar. */
export async function drawGlobe(canvas, lat, lon, size = 72) {
  await loadMask();
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const n = Math.round(size * dpr);
  if (canvas.width !== n) { canvas.width = n; canvas.height = n; }
  canvas.style.width = canvas.style.height = `${size}px`;
  const g = canvas.getContext("2d");
  const P = palette(canvas);
  const img = g.createImageData(n, n);
  const d = img.data;
  const R = n / 2 - 1.2 * dpr, cx = n / 2, cy = n / 2;
  const phi0 = lat * D2R, sin0 = Math.sin(phi0), cos0 = Math.cos(phi0);
  const degPx = 180 / (2 * R);                  // grados por pixel en el centro
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5 - cx) / R, y = (cy - j - 0.5) / R;
      const rr = x * x + y * y;
      if (rr > 1) continue;
      const z = Math.sqrt(1 - rr);              // de frente = 1, en el borde = 0
      // ortográfica inversa
      const latP = Math.asin(z * sin0 + y * cos0) / D2R;
      const lonP = lon + Math.atan2(x, z * cos0 - y * sin0) / D2R;
      let c = mix(P.sea, P.land, landAt(lonP, latP));
      // la grilla cada 30° (más fina cerca del borde, donde se achata)
      const wdt = (degPx * 0.55) / Math.max(z, 0.25);
      const dl = Math.abs(((latP + 15) % 30 + 30) % 30 - 15), dn = Math.abs(((lonP + 15) % 30 + 30) % 30 - 15);
      const gl = Math.max(0, 1 - Math.min(dl, Math.abs(latP) > 80 ? 99 : dn) / wdt) * 0.55;
      if (gl > 0) c = mix(c, P.grat, gl * (1 - landAt(lonP, latP) * 0.6));
      const shade = 0.9 + 0.1 * z;              // un poco más oscuro hacia el borde, para que se vea redondo
      const k = (j * n + i) * 4;
      d[k] = c[0] * shade; d[k + 1] = c[1] * shade; d[k + 2] = c[2] * shade;
      d[k + 3] = 255;
    }
  }
  g.clearRect(0, 0, n, n);
  g.putImageData(img, 0, 0);
  // borde suave
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2);
  g.lineWidth = 1.1 * dpr; g.strokeStyle = P.rim; g.stroke();
  // la marca, en el centro
  g.beginPath(); g.arc(cx, cy, 7.5 * dpr, 0, Math.PI * 2);
  g.globalAlpha = 0.22; g.fillStyle = P.accent; g.fill(); g.globalAlpha = 1;
  g.beginPath(); g.arc(cx, cy, 3.4 * dpr, 0, Math.PI * 2);
  g.fillStyle = P.accent; g.fill();
  g.lineWidth = 1.5 * dpr; g.strokeStyle = P.fieldCss; g.stroke();
}
