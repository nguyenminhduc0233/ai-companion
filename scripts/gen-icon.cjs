// Generates a valid 512x512 PNG app icon (no external deps) — an ethereal
// violet orb on an indigo aurora, matching the app theme. Produces
// public/icons/icon.png. Replace with your own art anytime.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const S = 512;
const buf = Buffer.alloc(S * S * 4);

function px(x, y, r, g, b, a) {
  const i = (y * S + x) * 4;
  buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
}
function mix(a, b, t) { return Math.round(a + (b - a) * t); }

const cx = S * 0.5, cy = S * 0.44;
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    // Background: diagonal indigo → violet
    const gx = x / S, gy = y / S;
    let r = mix(11, 40, gy), g = mix(11, 26, gy), b = mix(22, 74, (gx + gy) / 2);
    // Radial orb glow
    const d = Math.hypot(x - cx, y - cy) / (S * 0.5);
    const glow = Math.max(0, 1 - d);
    const orb = Math.max(0, 1 - d * 1.8);
    r = mix(r, 154, glow * 0.55); g = mix(g, 134, glow * 0.5); b = mix(b, 255, glow * 0.6);
    r = mix(r, 255, orb * orb); g = mix(g, 245, orb * orb); b = mix(b, 255, orb * orb);
    px(x, y, r, g, b, 255);
  }
}
// Sparkles
const stars = [[0.72, 0.24], [0.30, 0.30], [0.66, 0.66], [0.24, 0.62], [0.80, 0.50]];
for (const [sx, sy] of stars) {
  const X = Math.round(sx * S), Y = Math.round(sy * S);
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
    const X2 = X + dx, Y2 = Y + dy;
    if (X2 < 0 || Y2 < 0 || X2 >= S || Y2 >= S) continue;
    const falloff = Math.max(0, 1 - Math.hypot(dx, dy) / 6);
    const i = (Y2 * S + X2) * 4;
    buf[i] = mix(buf[i], 255, falloff * 0.9);
    buf[i + 1] = mix(buf[i + 1], 255, falloff * 0.9);
    buf[i + 2] = mix(buf[i + 2], 255, falloff * 0.9);
  }
}

// Assemble PNG
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([len, body, crc]);
}
function crc32(b) {
  let c = ~0;
  for (let i = 0; i < b.length; i++) {
    c ^= b[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c;
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
// raw scanlines with filter byte 0
const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0;
  buf.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
}
const idat = zlib.deflateSync(raw, { level: 9 });
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))
]);
const out = path.join(__dirname, '..', 'public', 'icons', 'icon.png');
fs.writeFileSync(out, png);
console.log('Wrote', out, png.length, 'bytes');
