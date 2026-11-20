/**
 * Tests — W102 : lecture EXIF (date de prise de vue + GPS) d'une photo JPEG.
 * Les JPEG sont fabriqués octet par octet (en-tête APP1 « Exif » + TIFF).
 */
import { describe, it, expect } from 'vitest';
import { parseExif, lireExif } from '../js/exif.js';
import { jpeg } from './fixtures/jpegExif.js';

const dv = u8 => new DataView(u8.buffer);

describe('parseExif (W102)', () => {
  it('lit la date de prise de vue et la position GPS (little-endian)', () => {
    const r = parseExif(dv(jpeg()));
    expect(r.date).toBe('2026-11-16');
    expect(r.lat).toBeCloseTo(50 + 31 / 60 + 30 / 3600, 6);
    expect(r.lon).toBeCloseTo(2 + 37 / 60 + 48 / 3600, 6);
  });
  it('gère le big-endian et les hémisphères Sud / Ouest', () => {
    const r = parseExif(dv(jpeg({ le: false, latRef: 'S', lonRef: 'W' })));
    expect(r.date).toBe('2026-11-16');
    expect(r.lat).toBeLessThan(0);
    expect(r.lon).toBeLessThan(0);
  });
  it('sans bloc GPS : date seule', () => {
    const r = parseExif(dv(jpeg({ gps: false })));
    expect(r).toEqual({ date: '2026-11-16', lat: null, lon: null });
  });
  it('position 0/0 = absente', () => {
    const r = parseExif(dv(jpeg({ lat: [0, 0, 0], lon: [0, 0, 0] })));
    expect(r.lat).toBeNull();
  });
  it('rend null pour un fichier qui n\'est pas un JPEG ou un EXIF tronqué', () => {
    expect(parseExif(dv(new Uint8Array([0x89, 0x50, 0x4E, 0x47])))).toBeNull();
    expect(parseExif(dv(jpeg().slice(0, 40)))).toBeNull();
  });
  it('lireExif lit un File', async () => {
    const r = await lireExif(new File([jpeg()], 'a.jpg', { type: 'image/jpeg' }));
    expect(r.date).toBe('2026-11-16');
    expect(await lireExif(new File(['x'], 'a.jpg'))).toBeNull();
  });
});
