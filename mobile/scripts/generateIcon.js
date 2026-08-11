const fs = require('fs');
const path = require('path');

const SIZE = 1024;
const SAMPLE_RATE = SIZE;

function createPNG(width, height, pixelFn) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c;
    }
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function createChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeAndData = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData));
    return Buffer.concat([len, typeAndData, crc]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rawData = Buffer.alloc(height * (1 + width * 3));

  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    rawData[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const idx = rowStart + 1 + x * 3;
      const [r, g, b] = pixelFn(x, y, width, height);
      rawData[idx] = Math.max(0, Math.min(255, Math.round(r)));
      rawData[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      rawData[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
    }
  }

  const maxBlock = 65535;
  const blocks = [];
  let offset = 0;
  while (offset < rawData.length) {
    const blockLen = Math.min(maxBlock, rawData.length - offset);
    const isFinal = (offset + blockLen >= rawData.length) ? 1 : 0;
    const header = Buffer.alloc(5);
    header[0] = isFinal;
    header.writeUInt16LE(blockLen, 1);
    header.writeUInt16LE(blockLen ^ 0xFFFF, 3);
    blocks.push(header);
    blocks.push(rawData.slice(offset, offset + blockLen));
    offset += blockLen;
  }

  let s1 = 1, s2 = 0;
  for (let i = 0; i < rawData.length; i++) {
    s1 = (s1 + rawData[i]) % 65521;
    s2 = (s2 + s1) % 65521;
  }
  const adler = Buffer.alloc(4);
  adler.writeUInt32BE((s2 << 16) | s1);

  const zlibHeader = Buffer.from([0x78, 0x01]);
  const deflated = Buffer.concat([zlibHeader, ...blocks, adler]);

  return Buffer.concat([
    signature,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', deflated),
    createChunk('IEND', Buffer.alloc(0)),
  ]);
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

function lerp(a, b, t) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function iconPixel(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const nx = x / w;
  const ny = y / h;

  // Background: dark green with radial gradient
  const d = dist(nx, ny * 0.8, 0.5, 0.35) / 0.7;
  let bgR = lerp(10, 2, d);
  let bgG = lerp(31, 8, d);
  let bgB = lerp(10, 2, d);

  // Subtle grid
  const gridSize = w / 16;
  const gx = x % gridSize;
  const gy = y % gridSize;
  if (gx < 1.2 || gy < 1.2) {
    bgR += 3; bgG += 10; bgB += 3;
  }

  // Central glow
  const glowD = dist(nx, ny, 0.5, 0.42) / 0.4;
  if (glowD < 1) {
    const glowI = (1 - glowD) * 0.18;
    bgR += 74 * glowI;
    bgG += 222 * glowI;
    bgB += 128 * glowI;
  }

  // Question mark - drawn as thick parametric curve
  // The curve of the question mark top
  const qCx = cx;
  const qCy = cy * 0.72;
  const qR = w * 0.18;

  // Arc part (top half of ?)
  const arcCx = qCx;
  const arcCy = qCy - qR * 0.5;

  // Check if pixel is on the question mark stroke
  let onQ = false;
  const strokeW = w * 0.035;

  // Top arc
  const dArc = dist(x, y, arcCx, arcCy);
  if (dArc > qR - strokeW && dArc < qR + strokeW) {
    const angle = Math.atan2(y - arcCy, x - arcCx);
    if (angle > -Math.PI && angle < Math.PI * 0.55) {
      onQ = true;
    }
  }

  // Vertical stem going down from right side of arc
  const stemX = arcCx + qR * Math.cos(Math.PI * 0.5);
  const stemTopY = arcCy + qR * Math.sin(Math.PI * 0.5);
  const stemBotY = stemTopY + qR * 0.7;
  if (Math.abs(x - qCx) < strokeW && y >= stemTopY - strokeW * 0.5 && y <= stemBotY) {
    onQ = true;
  }

  // Curved connection from arc to stem
  const connR = qR * 0.5;
  const connCx = qCx + connR;
  const connCy = stemTopY - connR * 0.3;
  const dConn = dist(x, y, connCx, connCy);
  if (dConn > connR - strokeW && dConn < connR + strokeW) {
    const cAngle = Math.atan2(y - connCy, x - connCx);
    if (cAngle > Math.PI * 0.3 && cAngle < Math.PI) {
      onQ = true;
    }
  }

  // Dot below
  const dotCx = qCx;
  const dotCy = stemBotY + strokeW * 3.5;
  const dotR = strokeW * 1.4;
  const dDot = dist(x, y, dotCx, dotCy);
  const onDot = dDot < dotR;

  if (onQ) {
    // Green gradient for question mark
    const t = (y - (arcCy - qR)) / (stemBotY - (arcCy - qR));
    const r = lerp(74, 22, t);
    const g = lerp(222, 197, t);
    const b = lerp(128, 94, t);

    // Glow effect
    const glowStr = 0.3;
    return [
      bgR * (1 - glowStr) + r * glowStr + r * 0.6,
      bgG * (1 - glowStr) + g * glowStr + g * 0.6,
      bgB * (1 - glowStr) + b * glowStr + b * 0.6,
    ];
  }

  if (onDot) {
    const di = 1 - (dDot / dotR);
    return [
      lerp(22, 74, di),
      lerp(197, 222, di),
      lerp(94, 128, di),
    ];
  }

  // Glow around Q mark (soft)
  const nearestQDist = Math.min(
    Math.abs(dist(x, y, arcCx, arcCy) - qR),
    (Math.abs(x - qCx) < strokeW * 4) ? Math.abs(y - (stemTopY + stemBotY) / 2) - (stemBotY - stemTopY) / 2 : 999,
    dist(x, y, dotCx, dotCy) - dotR,
  );

  if (nearestQDist < strokeW * 5 && nearestQDist > 0) {
    const gi = Math.exp(-nearestQDist / (strokeW * 2)) * 0.15;
    bgR += 74 * gi;
    bgG += 222 * gi;
    bgB += 128 * gi;
  }

  // Lightning bolt accents (right)
  const bx1 = w * 0.78, by1 = h * 0.25;
  const boltSize = w * 0.06;
  const boltD = dist(x, y, bx1, by1 + boltSize);
  if (boltD < boltSize * 1.2) {
    // Simplified bolt check
    const lx = (x - bx1) / boltSize;
    const ly = (y - by1) / boltSize;
    if (ly > -0.5 && ly < 2 && Math.abs(lx - ly * 0.15) < 0.3) {
      return [245, 158, 11];
    }
  }

  // Lightning bolt (left)
  const bx2 = w * 0.22, by2 = h * 0.3;
  const boltD2 = dist(x, y, bx2, by2 + boltSize);
  if (boltD2 < boltSize * 1.2) {
    const lx = (x - bx2) / boltSize;
    const ly = (y - by2) / boltSize;
    if (ly > -0.3 && ly < 1.8 && Math.abs(lx + ly * 0.15) < 0.25) {
      return [245, 158, 11];
    }
  }

  // Corner dots
  const corners = [[0.12, 0.12], [0.88, 0.12], [0.12, 0.92], [0.88, 0.92]];
  for (const [cx2, cy2] of corners) {
    if (dist(nx, ny, cx2, cy2) < 0.012) {
      return [bgR + 30, bgG + 60, bgB + 30];
    }
  }

  return [bgR, bgG, bgB];
}

const assetsDir = path.join(__dirname, '..', 'assets');

console.log('Generating 1024x1024 icon...');
const iconBuf = createPNG(1024, 1024, iconPixel);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), iconBuf);

console.log('Generating adaptive icon...');
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), iconBuf);

// Smaller favicon
console.log('Generating favicon...');
const faviconBuf = createPNG(48, 48, iconPixel);
fs.writeFileSync(path.join(assetsDir, 'favicon.png'), faviconBuf);

console.log('Icons generated successfully!');
