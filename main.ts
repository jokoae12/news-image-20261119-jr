// news-image-20261119 — The World in One Image: Thursday 19 November 2026.
// A deterministic editorial poster that sums up one day of world news on a
// single 1024x1024 page. Every letter is drawn with the program's own 5x7
// bitmap font and every picture with plain geometry: no assets, no network,
// no clock. Two runs write exactly the same bytes.
// Run: node main.ts   (writes entry.png to MAKEFUN_OUTPUT_DIR, /output, or ./output)
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------- PNG encoder (own implementation, zlib for IDAT) ----------
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const td = new Uint8Array(4 + data.length);
  for (let i = 0; i < 4; i++) td[i] = type.charCodeAt(i);
  td.set(data, 4);
  dv.setUint32(8 + data.length, crc32(td));
  return out;
}
function encodePng(w: number, h: number, rgb: Uint8Array): Uint8Array {
  const raw = new Uint8Array(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0;
    raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (1 + w * 3) + 1);
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array(0)),
  ];
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

// ---------- Canvas ----------
const W = 1024, H = 1024;
const px = new Uint8Array(W * H * 3);
type RGB = [number, number, number];
const INK: RGB = [17, 17, 17];
const PAPER: RGB = [246, 241, 231];
const RED: RGB = [193, 39, 45];
const GOLD: RGB = [232, 176, 32];
const BLUE: RGB = [31, 78, 140];
const GRAY: RGB = [96, 96, 96];
const WHITE: RGB = [255, 255, 255];
function setPx(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPx(xx, yy, c);
}
function strokeRect(x: number, y: number, w: number, h: number, t: number, c: RGB): void {
  fillRect(x, y, w, t, c); fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c); fillRect(x + w - t, y, t, h, c);
}
function line(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
  const dx = x1 - x0, dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  const r = Math.floor(t / 2);
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + (dx * i) / steps), y = Math.round(y0 + (dy * i) / steps);
    fillRect(x - r, y - r, t, t, c);
  }
}
function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) setPx(x, y, c);
  }
}
function ring(cx: number, cy: number, r: number, t: number, c: RGB): void {
  for (let y = cy - r - t; y <= cy + r + t; y++) for (let x = cx - r - t; x <= cx + r + t; x++) {
    const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
    if (d >= r - t && d <= r + t) setPx(x, y, c);
  }
}

// ---------- 5x7 bitmap font (own design, drawn from these rows) ----------
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "01010", "00100", "00100", "00100", "01010", "10001"],
  Y: ["10001", "01010", "00100", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00010", "00100", "01000", "10000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "+": ["00000", "00100", "00100", "01110", "00100", "00100", "00000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "$": ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
};
function drawText(s: string, x: number, y: number, scale: number, c: RGB): number {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] ?? FONT["?"];
    for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++) {
      if (g[r][col] === "1") fillRect(cx + col * scale, y + r * scale, scale, scale, c);
    }
    cx += 6 * scale;
  }
  return cx - x;
}
function textWidth(s: string, scale: number): number { return s.length * 6 * scale - scale; }
function wrap(s: string, scale: number, maxW: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const wd of words) {
    const trial = cur ? cur + " " + wd : wd;
    if (textWidth(trial, scale) > maxW && cur) { lines.push(cur); cur = wd; }
    else cur = trial;
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawWrapped(s: string, x: number, y: number, scale: number, c: RGB, maxW: number, lineGap: number): number {
  let yy = y;
  for (const ln of wrap(s, scale, maxW)) { drawText(ln, x, yy, scale, c); yy += 7 * scale + lineGap; }
  return yy;
}

// ---------- Geometric icons ----------
// Three flags behind an oval summit table, with three seated heads.
function drawSummit(x: number, y: number): void {
  // flag poles
  line(x + 20, y, x + 20, y + 92, 4, INK);
  line(x + 110, y, x + 110, y + 92, 4, INK);
  line(x + 200, y, x + 200, y + 92, 4, INK);
  // US flag: red stripes + blue canton
  fillRect(x + 22, y + 2, 72, 44, WHITE); strokeRect(x + 22, y + 2, 72, 44, 2, INK);
  for (let i = 0; i < 3; i++) fillRect(x + 22, y + 8 + i * 13, 72, 6, RED);
  fillRect(x + 22, y + 2, 30, 20, BLUE);
  // China flag: red field + gold disc
  fillRect(x + 112, y + 2, 72, 44, RED); strokeRect(x + 112, y + 2, 72, 44, 2, INK);
  disc(x + 132, y + 16, 7, GOLD); disc(x + 150, y + 10, 3, GOLD); disc(x + 154, y + 20, 3, GOLD);
  // Russia flag: white / blue / red bands
  fillRect(x + 202, y + 2, 72, 44, WHITE); strokeRect(x + 202, y + 2, 72, 44, 2, INK);
  fillRect(x + 202, y + 17, 72, 14, BLUE); fillRect(x + 202, y + 31, 72, 15, RED);
  // heads
  disc(x + 58, y + 66, 15, INK); disc(x + 148, y + 62, 15, RED); disc(x + 238, y + 66, 15, INK);
  // oval table
  for (let yy = y + 92; yy < y + 116; yy++) {
    const t = (yy - (y + 92)) / 24;
    const half = Math.round(150 * Math.sin(Math.acos(Math.abs(t - 0.5) * 2)) * 0.5 + 75);
    fillRect(x + 148 - half, yy, half * 2, 1, [122, 84, 44]);
  }
  line(x + 8, y + 118, x + 288, y + 118, 3, INK);
}
// Scales of justice.
function drawScales(x: number, y: number): void {
  line(x + 40, y, x + 40, y + 74, 4, INK);
  line(x + 4, y + 8, x + 76, y + 8, 4, INK);
  line(x + 10, y + 8, x + 2, y + 30, 2, INK); line(x + 10, y + 8, x + 18, y + 30, 2, INK);
  line(x + 70, y + 8, x + 62, y + 30, 2, INK); line(x + 70, y + 8, x + 78, y + 30, 2, INK);
  for (let xx = 0; xx < 22; xx++) fillRect(x - 1 + xx, y + 30 + Math.round(Math.abs(xx - 10) * 0.4), 2, 3, GOLD);
  for (let xx = 0; xx < 22; xx++) fillRect(x + 59 + xx, y + 30 + Math.round(Math.abs(xx - 10) * 0.4), 2, 3, GOLD);
  fillRect(x + 22, y + 74, 36, 5, INK); disc(x + 40, y - 2, 5, GOLD);
}
// Tower with a missile streak.
function drawTower(x: number, y: number): void {
  fillRect(x + 26, y + 6, 26, 72, BLUE);
  fillRect(x + 31, y + 14, 5, 8, GOLD); fillRect(x + 42, y + 14, 5, 8, GOLD);
  fillRect(x + 31, y + 30, 5, 8, GOLD); fillRect(x + 42, y + 30, 5, 8, GOLD);
  fillRect(x + 31, y + 46, 5, 8, GOLD); fillRect(x + 42, y + 46, 5, 8, WHITE);
  line(x + 2, y + 2, x + 22, y + 22, 5, RED);
  disc(x + 26, y + 26, 7, GOLD); disc(x + 30, y + 22, 4, RED);
  fillRect(x + 6, y + 78, 66, 4, INK);
}
// Falling market chart.
function drawChart(x: number, y: number): void {
  line(x + 4, y + 4, x + 4, y + 72, 3, INK); line(x + 4, y + 72, x + 78, y + 72, 3, INK);
  line(x + 10, y + 14, x + 30, y + 30, 4, RED); line(x + 30, y + 30, x + 46, y + 24, 4, RED);
  line(x + 46, y + 24, x + 72, y + 58, 4, RED);
  line(x + 72, y + 58, x + 60, y + 56, 4, RED); line(x + 72, y + 58, x + 70, y + 46, 4, RED);
}

// ---------- Page ----------
fillRect(0, 0, W, H, PAPER);
// Masthead
fillRect(0, 0, W, 104, INK);
drawText("THE WORLD IN ONE IMAGE", 24, 16, 6, WHITE);
drawText("THURSDAY 19 NOVEMBER 2026", 24, 70, 3, GOLD);
const dayBox = "19 NOV";
fillRect(1024 - 24 - textWidth(dayBox, 4) - 20, 18, textWidth(dayBox, 4) + 20, 68, RED);
drawText(dayBox, 1024 - 24 - textWidth(dayBox, 4) - 10, 40, 4, WHITE);
fillRect(0, 104, W, 8, RED);

// Hero: Shenzhen summit
strokeRect(24, 128, 976, 342, 4, INK);
drawText("SHENZHEN - APEC SUMMIT", 44, 146, 3, RED);
drawText("FIRST THREE-WAY", 44, 182, 7, INK);
drawText("SUMMIT IN SHENZHEN", 44, 240, 7, RED);
drawSummit(676, 330);
drawWrapped(
  "TRUMP, XI AND PUTIN - THE LEADERS OF THE US, CHINA AND RUSSIA - MET FACE TO FACE FOR THE FIRST TIME AND SIGNED A PEACE DECLARATION: A NUCLEAR WAR CAN NEVER BE WON AND MUST NEVER BE FOUGHT.",
  44, 306, 2, INK, 600, 7);
drawWrapped(
  "FOUR POINTS COVER NUCLEAR RISK, UN REFORM, ENERGY SUPPLY AND THE WORLD COURT. UKRAINE AND IRAN GO UNMENTIONED. NO BREAKTHROUGH IN 70 MINUTES.",
  44, 392, 2, GRAY, 600, 7);

// Middle row: three panels
const panels: { x: number; kicker: string; head: string[]; body: string; icon: (x: number, y: number) => void }[] = [
  {
    x: 24, kicker: "THE HAGUE", head: ["MYANMAR", "GUILTY OF", "GENOCIDE"],
    body: "WORLD COURT RULES MYANMAR COMMITTED GENOCIDE AGAINST THE ROHINGYA, 9-6 - FIRST SUCH FINDING AGAINST A STATE.",
    icon: drawScales,
  },
  {
    x: 357, kicker: "RIYADH", head: ["MISSILES", "DAMAGE", "PIF TOWER"],
    body: "HOUTHI MISSILES STRUCK THE FINANCIAL DISTRICT AND DAMAGED SAUDI ARABIA'S SOVEREIGN WEALTH FUND TOWER.",
    icon: drawTower,
  },
  {
    x: 691, kicker: "MARKETS", head: ["STOCKS", "TUMBLE", "WORLDWIDE"],
    body: "S+P 500 -2.0%, A FIFTH DAILY FALL. NIKKEI -4.8%, GOLD -4.2% AS AI VALUES WOBBLED. ANTHROPIC +17% ON DEBUT.",
    icon: drawChart,
  },
];
for (const p of panels) {
  strokeRect(p.x, 486, 309, 272, 3, INK);
  drawText(p.kicker, p.x + 16, 500, 2, RED);
  p.icon(p.x + 212, 512);
  let hy = 530;
  for (const ln of p.head) { drawText(ln, p.x + 16, hy, 4, INK); hy += 34; }
  drawWrapped(p.body, p.x + 16, 640, 2, INK, 277, 5);
}

// Briefs
drawText("AROUND THE WORLD IN BRIEF", 24, 772, 3, INK);
fillRect(24, 800, 976, 4, RED);
const briefs: [string, string][] = [
  ["ANTALYA - CLIMATE", "COP31 DRAFT DROPS FOSSIL FUEL PHASE-OUT CALL"],
  ["HORMUZ - WAR", "IRAN WAR MONTH NINE: TANKERS ATTACKED IN HORMUZ"],
  ["CRIMEA - WAR", "THIRD UKRAINIAN STRIKE THIS WEEK HITS CRIMEA BRIDGE"],
  ["KENYA - HEALTH", "LAST EBOLA PATIENT GOES HOME AFTER 37 DAYS"],
  ["GAZA - TRUCE", "ISRAELI TROOPS CROSS GAZA YELLOW LINE"],
  ["SPACE - SCIENCE", "BEPICOLOMBO REACHES MERCURY AFTER 8 YEARS"],
  ["SENEGAL - MIGRATION", "DOZENS MISSING AS MIGRANT BOAT CAPSIZES"],
  ["N. KOREA - NUCLEAR", "IAEA: NORTH KOREA EXPANDS URANIUM ENRICHMENT"],
];
briefs.forEach(([label, head], i) => {
  const col = i % 4, row = Math.floor(i / 4);
  const bx = 24 + col * 250, by = 814 + row * 80;
  drawText(label, bx, by, 2, RED);
  drawWrapped(head, bx, by + 22, 2, INK, 238, 4);
});

// Footer
fillRect(0, 976, W, 48, INK);
drawText("SOURCES: REUTERS - AP - BBC - GUARDIAN - EURONEWS", 24, 990, 2, WHITE);
const foot2 = "DRAWN IN CODE - NO PHOTOS";
drawText(foot2, 1024 - 24 - textWidth(foot2, 2), 990, 2, GOLD);

// ---------- Write ----------
const png = encodePng(W, H, px);
const dirs = [process.env.MAKEFUN_OUTPUT_DIR, "/output", "output"].filter(Boolean) as string[];
let written = "";
for (const d of dirs) {
  try {
    mkdirSync(d, { recursive: true });
    const p = join(d, "entry.png");
    writeFileSync(p, png);
    written = p;
    break;
  } catch { /* try the next candidate */ }
}
if (!written) throw new Error("no writable output directory");
console.log("wrote", written, png.length, "bytes");
