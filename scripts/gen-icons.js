// Generates PNG icons for the PWA without external dependencies (raw PNG encoder via zlib).
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeData), 0);
  return Buffer.concat([len, typeData, crc]);
}

function encodePNG(width, height, pixels /* RGBA buffer */) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

function drawIcon(size, { transparentBg = true, padding = 0.16 } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const bg = hex('#0a0908');
  const orange = hex('#ff7a1a');
  const orangeDark = hex('#c9530a');

  const cx = size / 2, cy = size / 2;
  const r = size * (0.5 - 0);

  function setPixel(x, y, rgb, a = 255) {
    const idx = (y * size + x) * 4;
    px[idx] = rgb[0]; px[idx + 1] = rgb[1]; px[idx + 2] = rgb[2]; px[idx + 3] = a;
  }

  // rounded-square dark background
  const radius = size * 0.22;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inCorner = (px_, py_, ox, oy) => {
        const dx = px_ - ox, dy = py_ - oy;
        return dx * dx + dy * dy <= radius * radius;
      };
      let inside = true;
      if (x < radius && y < radius) inside = inCorner(x, y, radius, radius);
      else if (x > size - radius && y < radius) inside = inCorner(x, y, size - radius, radius);
      else if (x < radius && y > size - radius) inside = inCorner(x, y, radius, size - radius);
      else if (x > size - radius && y > size - radius) inside = inCorner(x, y, size - radius, size - radius);
      if (inside) setPixel(x, y, bg, transparentBg ? 255 : 255);
      else setPixel(x, y, bg, transparentBg ? 0 : 255);
    }
  }

  // Skeelo Evolution mark: a three-level stepped pyramid (Corpo / Mente /
  // Comunidade), apex up, with thin dark gaps separating the bands.
  const apexY = size * (padding * 0.9);
  const baseY = size * (1 - padding * 0.9);
  const halfWidthAt = f => (size * (0.5 - padding * 0.9)) * f;
  const gapPx = Math.max(1, Math.round(size * 0.018));
  const bandColors = [orange, orange, orangeDark]; // top, mid, base

  for (let bandIdx = 0; bandIdx < 3; bandIdx++) {
    const f0 = bandIdx / 3;
    const f1 = (bandIdx + 1) / 3;
    const y0 = Math.round(apexY + (baseY - apexY) * f0) + (bandIdx > 0 ? gapPx : 0);
    const y1 = Math.round(apexY + (baseY - apexY) * f1) - (bandIdx < 2 ? gapPx : 0);
    for (let y = y0; y <= y1; y++) {
      const f = (y - apexY) / (baseY - apexY);
      const hw = halfWidthAt(f);
      const xLeft = Math.round(cx - hw);
      const xRight = Math.round(cx + hw);
      for (let x = xLeft; x <= xRight; x++) {
        if (x >= 0 && x < size && y >= 0 && y < size) setPixel(x, y, bandColors[bandIdx], 255);
      }
    }
  }

  return px;
}

const outDir = path.join(__dirname, '..', 'icons');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

for (const size of [192, 512]) {
  const px = drawIcon(size, { transparentBg: false });
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), encodePNG(size, size, px));
}
for (const size of [192, 512]) {
  const px = drawIcon(size, { transparentBg: false, padding: 0.22 });
  fs.writeFileSync(path.join(outDir, `maskable-${size}.png`), encodePNG(size, size, px));
}
{
  const size = 180;
  const px = drawIcon(size, { transparentBg: false });
  fs.writeFileSync(path.join(outDir, `apple-touch-icon.png`), encodePNG(size, size, px));
}
console.log('Icons generated at', outDir);
