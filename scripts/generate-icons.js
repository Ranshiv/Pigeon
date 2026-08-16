// scripts/generate-icons.js
//
// Regenerates the raster app icons in client/public from the Pigeon "P" mark.
//
// This is a DEV-ONLY utility. It is deliberately NOT wired into any build:
// `canvas` is a native module and is a root dependency only, so pulling it into
// the client build would break the Vercel deploy. Run it by hand when the mark
// changes, then commit the generated binaries.
//
//   node scripts/generate-icons.js
//
// Source of truth for the artwork is client/public/favicon.svg. The glyph path
// below is the same outline (Inter Bold "P", SIL OFL 1.1) with the font-unit
// transform already baked into the coordinates.

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const OUT_DIR = path.join(__dirname, '..', 'client', 'public');
const SVG_PATH = path.join(OUT_DIR, 'favicon.svg');

const TILE_COLOR = '#111114';
const GLYPH_COLOR = '#ffffff';
const VIEWBOX = 64;   // favicon.svg viewBox is "0 0 64 64"
const TILE_RADIUS = 14; // matches rx="14" on the <rect>

const GLYPH_PATH = 'M17.05 52L17.05 12L32.65 12Q37.21 12 40.41 13.73Q43.6 15.46 45.28 18.51Q46.96 21.56 46.96 25.5Q46.96 29.48 45.25 32.5Q43.55 35.52 40.31 37.22Q37.08 38.93 32.46 38.93L22.42 38.93L22.42 32.32L31.14 32.32Q33.67 32.32 35.29 31.45Q36.92 30.58 37.71 29.05Q38.5 27.52 38.5 25.5Q38.5 23.49 37.71 21.97Q36.92 20.46 35.28 19.61Q33.64 18.77 31.12 18.77L25.24 18.77L25.24 52Z';

// canvas v3 does not export Path2D, so the outline is traced by hand. The path
// uses only absolute M / L / Q / Z commands, which map directly onto the 2D
// context primitives.
function traceGlyph(ctx, d, scale) {
    const token = /([MLQZ])|(-?[\d.]+)/g;
    let match;
    let cmd = null;
    let nums = [];

    const emit = () => {
        if (!cmd) return;
        const s = scale;
        if (cmd === 'M') ctx.moveTo(nums[0] * s, nums[1] * s);
        else if (cmd === 'L') ctx.lineTo(nums[0] * s, nums[1] * s);
        else if (cmd === 'Q') ctx.quadraticCurveTo(nums[0] * s, nums[1] * s, nums[2] * s, nums[3] * s);
        else if (cmd === 'Z') ctx.closePath();
        nums = [];
    };

    while ((match = token.exec(d))) {
        if (match[1]) {
            emit();
            cmd = match[1];
            if (cmd === 'Z') { emit(); cmd = null; }
            continue;
        }
        nums.push(parseFloat(match[2]));
        // Implicit repetition: "L10 20 30 40" repeats the previous command.
        if ((cmd === 'M' || cmd === 'L') && nums.length === 2) { emit(); cmd = 'L'; }
        else if (cmd === 'Q' && nums.length === 4) emit();
    }
    emit();
}

function roundedTile(ctx, size, radius) {
    const r = Math.min(radius, size / 2);
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);
    ctx.quadraticCurveTo(size, 0, size, r);
    ctx.lineTo(size, size - r);
    ctx.quadraticCurveTo(size, size, size - r, size);
    ctx.lineTo(r, size);
    ctx.quadraticCurveTo(0, size, 0, size - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
}

function render(size) {
    const scale = size / VIEWBOX;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    roundedTile(ctx, size, TILE_RADIUS * scale);
    ctx.fillStyle = TILE_COLOR;
    ctx.fill();

    ctx.beginPath();
    traceGlyph(ctx, GLYPH_PATH, scale);
    ctx.fillStyle = GLYPH_COLOR;
    ctx.fill();

    // Guard against silently emitting a blank tile if the path ever breaks.
    const px = ctx.getImageData(0, 0, size, size).data;
    let ink = 0;
    for (let i = 0; i < px.length; i += 4) {
        if (px[i] > 200 && px[i + 1] > 200 && px[i + 2] > 200) ink++;
    }
    if (ink < 4) throw new Error(`glyph rendered blank at ${size}px (ink=${ink})`);

    return { buffer: canvas.toBuffer('image/png'), ink };
}

// ICO container. PNG-compressed entries are valid from Windows Vista onward and
// are what every current browser reads.
function buildIco(entries) {
    const HEADER = 6;
    const DIR_ENTRY = 16;
    const header = Buffer.alloc(HEADER);
    header.writeUInt16LE(0, 0); // reserved
    header.writeUInt16LE(1, 2); // type: 1 = icon
    header.writeUInt16LE(entries.length, 4);

    const dir = Buffer.alloc(DIR_ENTRY * entries.length);
    let offset = HEADER + DIR_ENTRY * entries.length;

    entries.forEach((entry, i) => {
        const at = i * DIR_ENTRY;
        // 256px is encoded as 0 in the ICO spec; all our sizes are < 256.
        dir.writeUInt8(entry.size >= 256 ? 0 : entry.size, at + 0);
        dir.writeUInt8(entry.size >= 256 ? 0 : entry.size, at + 1);
        dir.writeUInt8(0, at + 2);  // palette count
        dir.writeUInt8(0, at + 3);  // reserved
        dir.writeUInt16LE(1, at + 4);   // colour planes
        dir.writeUInt16LE(32, at + 6);  // bits per pixel
        dir.writeUInt32LE(entry.buffer.length, at + 8);
        dir.writeUInt32LE(offset, at + 12);
        offset += entry.buffer.length;
    });

    return Buffer.concat([header, dir, ...entries.map((e) => e.buffer)]);
}

function main() {
    if (!fs.existsSync(SVG_PATH)) {
        throw new Error(`missing source mark: ${SVG_PATH}`);
    }

    const png = [
        { size: 192, file: 'logo192.png' },
        { size: 512, file: 'logo512.png' },
        { size: 180, file: 'apple-touch-icon.png' }
    ];

    for (const { size, file } of png) {
        const { buffer, ink } = render(size);
        fs.writeFileSync(path.join(OUT_DIR, file), buffer);
        console.log(`wrote ${file} (${size}px, ${buffer.length} bytes, ink=${ink})`);
    }

    const icoSizes = [16, 32, 48];
    const icoEntries = icoSizes.map((size) => {
        const { buffer, ink } = render(size);
        console.log(`  ico entry ${size}px (${buffer.length} bytes, ink=${ink})`);
        return { size, buffer };
    });
    const ico = buildIco(icoEntries);
    fs.writeFileSync(path.join(OUT_DIR, 'favicon.ico'), ico);
    console.log(`wrote favicon.ico (${icoSizes.join('/')}px, ${ico.length} bytes)`);
}

main();
