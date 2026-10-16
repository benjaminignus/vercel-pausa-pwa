'use strict';
// Icono de la app (símbolo de pausa), generado al vuelo: /api/icon?size=192|512
// Así el proyecto no necesita archivos binarios.
const zlib = require('zlib');

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function png(size) {
  const bg = [0x11, 0x18, 0x27];
  const fg = [0xfb, 0xbf, 0x24];
  // Dos barras centradas dentro de la zona segura (60 % central) para icono «maskable».
  const barW = Math.round(size * 0.11), gap = Math.round(size * 0.09), barH = Math.round(size * 0.36);
  const totalW = barW * 2 + gap;
  const x0 = Math.round((size - totalW) / 2), y0 = Math.round((size - barH) / 2);
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    const inY = y >= y0 && y < y0 + barH;
    for (let x = 0; x < size; x++) {
      const inBar = inY && ((x >= x0 && x < x0 + barW) || (x >= x0 + barW + gap && x < x0 + totalW));
      raw.set(inBar ? fg : bg, y * stride + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8 bits, RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const cache = {};

module.exports = (req, res) => {
  const asked = Number(new URL(req.url, 'http://x').searchParams.get('size'));
  const size = asked === 512 ? 512 : 192;
  cache[size] = cache[size] || png(size);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.end(cache[size]);
};
