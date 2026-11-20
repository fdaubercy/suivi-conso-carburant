/* ─── W102 — Lecture EXIF minimale d'une photo JPEG ──────────────────── *
 *  Date de prise de vue (DateTimeOriginal, sinon DateTime) et position    *
 *  GPS. Le redimensionnement (canvas) efface l'EXIF : lire le fichier     *
 *  d'origine. HEIC/PNG et photos sans EXIF → null.                        *
 * ─────────────────────────────────────────────────────────────────────  */

/** { date: 'YYYY-MM-DD' | null, lat, lon } ou null (pas un JPEG avec EXIF). */
export async function lireExif(file) {
  try {
    return parseExif(new DataView(await file.slice(0, 256 * 1024).arrayBuffer()));
  } catch { return null; }
}

export function parseExif(dv) {
  try {
    if (dv.getUint16(0) !== 0xFFD8) return null;
    for (let o = 2; o + 4 <= dv.byteLength;) {
      const marker = dv.getUint16(o);
      if ((marker & 0xFF00) !== 0xFF00 || marker === 0xFFDA) return null;   // fin des en-têtes
      if (marker === 0xFFE1 && dv.getUint32(o + 4) === 0x45786966) return lireTiff(dv, o + 10);   // « Exif »
      o += 2 + dv.getUint16(o + 2);
    }
  } catch { /* EXIF tronqué ou corrompu */ }
  return null;
}

function lireTiff(dv, t) {
  const le  = dv.getUint16(t) === 0x4949;   // « II » = little-endian
  const u16 = p => dv.getUint16(p, le);
  const u32 = p => dv.getUint32(p, le);
  const ifd = off => {
    const tags = {}, p = t + off;
    for (let i = 0, n = u16(p); i < n; i++) {
      const e = p + 2 + i * 12;
      tags[u16(e)] = { count: u32(e + 4), val: e + 8 };
    }
    return tags;
  };
  const ascii = x => {
    if (!x) return '';
    const p = x.count > 4 ? t + u32(x.val) : x.val;
    let s = '';
    for (let i = 0; i < x.count; i++) { const c = dv.getUint8(p + i); if (!c) break; s += String.fromCharCode(c); }
    return s;
  };
  const dms = x => {
    const p = t + u32(x.val);
    const r = i => u32(p + i * 8) / u32(p + i * 8 + 4);
    return r(0) + r(1) / 60 + r(2) / 3600;
  };

  const ifd0 = ifd(u32(t + 4));
  const exif = ifd0[0x8769] ? ifd(u32(ifd0[0x8769].val)) : {};
  const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(ascii(exif[0x9003]) || ascii(ifd0[0x0132]));
  const res = { date: m ? `${m[1]}-${m[2]}-${m[3]}` : null, lat: null, lon: null };

  if (ifd0[0x8825]) {
    const g = ifd(u32(ifd0[0x8825].val));
    if (g[2] && g[4]) {
      const lat = dms(g[2]) * (ascii(g[1]) === 'S' ? -1 : 1);
      const lon = dms(g[4]) * (ascii(g[3]) === 'W' ? -1 : 1);
      // 0/0 = position absente (dénominateurs nuls ou appareil sans fix)
      if (isFinite(lat) && isFinite(lon) && (lat || lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        res.lat = lat; res.lon = lon;
      }
    }
  }
  return res;
}
