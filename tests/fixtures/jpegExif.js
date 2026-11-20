/** Fabrique de JPEG minimaux avec EXIF (W102) pour les tests. */
/** JPEG minimal : IFD0 → Exif IFD (DateTimeOriginal) + GPS IFD. */
export function jpeg({ le = true, date = '2026:11:16 08:42:10', gps = true,
               lat = [50, 31, 30], latRef = 'N', lon = [2, 37, 48], lonRef = 'E' } = {}) {
  const tiff = new DataView(new ArrayBuffer(200));
  const w16 = (p, v) => tiff.setUint16(p, v, le);
  const w32 = (p, v) => tiff.setUint32(p, v, le);
  const entry = (p, tag, type, count, val) => { w16(p, tag); w16(p + 2, type); w32(p + 4, count); w32(p + 8, val); };
  const str = (p, s) => [...s].forEach((c, i) => tiff.setUint8(p + i, c.charCodeAt(0)));
  w16(0, le ? 0x4949 : 0x4D4D); w16(2, 42); w32(4, 8);
  // IFD0 @8 : Exif (0x8769) et GPS (0x8825)
  w16(8, gps ? 2 : 1);
  entry(10, 0x8769, 4, 1, 40);
  if (gps) entry(22, 0x8825, 4, 1, 78);
  // Exif IFD @40 : DateTimeOriginal ASCII 20 octets @58
  w16(40, 1); entry(42, 0x9003, 2, 20, 58); str(58, date);
  // GPS IFD @78 : réfs inline, rationnels @132 et @156
  w16(78, 4);
  entry(80, 1, 2, 2, 0); str(88, latRef);
  entry(92, 2, 5, 3, 132);
  entry(104, 3, 2, 2, 0); str(112, lonRef);
  entry(116, 4, 5, 3, 156);
  [lat, lon].forEach((v, k) => v.forEach((n, i) => { w32(132 + k * 24 + i * 8, n); w32(136 + k * 24 + i * 8, 1); }));
  const app1 = 2 + 6 + 200;
  const out = new Uint8Array(4 + 2 + app1);
  out.set([0xFF, 0xD8, 0xFF, 0xE1, app1 >> 8, app1 & 0xFF, 0x45, 0x78, 0x69, 0x66, 0, 0]);
  out.set(new Uint8Array(tiff.buffer), 12);
  return out;
}
