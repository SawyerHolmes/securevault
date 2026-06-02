// ============================================================
// QR.JS — minimal QR Code encoder for offline use.
// Byte-mode only, error correction level M (~15%), versions
// 1-10 (up to 122 byte payload). That's enough for any
// otpauth:// URI; the only consumer here. Output is inline SVG.
//
// No external deps. Public API: window.generateQR(text, opts?).
// Returns an SVG string or null if the payload exceeds v10/M.
// ============================================================

(function () {

// ---------- GF(256) tables (primitive polynomial 0x11d) ----------
const EXP = new Uint8Array(256);
const LOG = new Uint8Array(256);
(function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
        EXP[i] = x;
        LOG[x] = i;
        x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
    }
    EXP[255] = EXP[0];
})();

function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[(LOG[a] + LOG[b]) % 255];
}

// ---------- Reed-Solomon encoder ----------
function rsGenerator(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
        const next = new Array(poly.length + 1).fill(0);
        for (let j = 0; j < poly.length; j++) {
            next[j]     ^= poly[j];
            next[j + 1] ^= gfMul(poly[j], EXP[i]);
        }
        poly = next;
    }
    return poly;
}

function rsEncode(data, eccLen) {
    const gen = rsGenerator(eccLen);
    const out = data.concat(new Array(eccLen).fill(0));
    for (let i = 0; i < data.length; i++) {
        const coef = out[i];
        if (coef !== 0) {
            for (let j = 0; j < gen.length; j++) {
                out[i + j] ^= gfMul(gen[j], coef);
            }
        }
    }
    return out.slice(data.length);
}

// ---------- Capacity / block tables for ECL=M, versions 1..10 ----------
// { total: codewords for whole code, data: codewords for data,
//   blocks: [[count, dataPerBlock], ...] }
const QR_M = [
    { total: 26,  data: 16,  blocks: [[1, 16]] },
    { total: 44,  data: 28,  blocks: [[1, 28]] },
    { total: 70,  data: 44,  blocks: [[1, 44]] },
    { total: 100, data: 64,  blocks: [[2, 32]] },
    { total: 134, data: 86,  blocks: [[2, 43]] },
    { total: 172, data: 108, blocks: [[4, 27]] },
    { total: 196, data: 124, blocks: [[4, 31]] },
    { total: 242, data: 154, blocks: [[2, 38], [2, 39]] },
    { total: 292, data: 182, blocks: [[3, 36], [2, 37]] },
    { total: 346, data: 216, blocks: [[4, 43], [1, 44]] },
];

function eccPerBlock(version) {
    const t = QR_M[version - 1];
    const totalBlocks = t.blocks.reduce((s, [c]) => s + c, 0);
    return Math.floor(t.total / totalBlocks) - t.blocks[0][1];
}

// Alignment pattern centres for v1..v10
const ALIGN_POS = [
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34],
    [6, 22, 38],
    [6, 24, 42],
    [6, 26, 46],
    [6, 28, 50],
];

// ---------- Byte-mode encoding ----------
function chooseVersion(byteLen) {
    for (let v = 1; v <= 10; v++) {
        const ccBits = v <= 9 ? 8 : 16;
        const need = 4 + ccBits + 8 * byteLen + 4;       // mode + count + data + terminator
        const have = QR_M[v - 1].data * 8;
        if (need <= have) return v;
    }
    return null;
}

function encodeBytes(bytes, version) {
    const totalBits = QR_M[version - 1].data * 8;
    const bits = [];
    // Mode indicator: byte = 0100
    bits.push(0, 1, 0, 0);
    // Character count
    const ccBits = version <= 9 ? 8 : 16;
    for (let i = ccBits - 1; i >= 0; i--) bits.push((bytes.length >> i) & 1);
    // Data
    for (const b of bytes) for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
    // Terminator
    for (let i = 0; i < Math.min(4, totalBits - bits.length); i++) bits.push(0);
    // Byte-align
    while (bits.length % 8) bits.push(0);
    // Pad bytes 0xEC, 0x11 alternating
    const padBytes = [0xEC, 0x11];
    let p = 0;
    while (bits.length < totalBits) {
        const pad = padBytes[p++ % 2];
        for (let i = 7; i >= 0; i--) bits.push((pad >> i) & 1);
    }
    // Pack to bytes
    const out = [];
    for (let i = 0; i < bits.length; i += 8) {
        let b = 0;
        for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
        out.push(b);
    }
    return out;
}

// ---------- Build final codeword stream with block interleave ----------
function interleave(version, dataBytes) {
    const t = QR_M[version - 1];
    const ecc = eccPerBlock(version);
    // Split data
    const dBlocks = [];
    let idx = 0;
    for (const [count, perBlock] of t.blocks) {
        for (let i = 0; i < count; i++) {
            dBlocks.push(dataBytes.slice(idx, idx + perBlock));
            idx += perBlock;
        }
    }
    const eBlocks = dBlocks.map(b => rsEncode(b, ecc));
    // Interleave data columns then ecc columns
    const out = [];
    const maxData = Math.max(...dBlocks.map(b => b.length));
    for (let i = 0; i < maxData; i++)
        for (const b of dBlocks) if (i < b.length) out.push(b[i]);
    for (let i = 0; i < ecc; i++)
        for (const b of eBlocks) out.push(b[i]);
    return out;
}

// ---------- BCH-encoded format + version info ----------
function formatBits(maskNum) {
    // ECL M = 00, mask = 3 bits → 5-bit data
    const data = maskNum;          // 0b00 << 3 | maskNum
    let bits = data << 10;
    for (let i = 0; i < 5; i++) {
        if (bits & (1 << (14 - i))) bits ^= 0x537 << (4 - i);
    }
    return ((data << 10) | bits) ^ 0x5412;
}

function versionBits(version) {
    let bits = version << 12;
    for (let i = 0; i < 6; i++) {
        if (bits & (1 << (17 - i))) bits ^= 0x1f25 << (5 - i);
    }
    return (version << 12) | bits;
}

// ---------- Matrix construction ----------
function buildMatrix(version, codewords) {
    const size = 17 + 4 * version;
    // null = unset, 0/1 = data, 2 = reserved-light, 3 = reserved-dark
    const m = Array.from({ length: size }, () => new Array(size).fill(null));

    function placeFinder(cx, cy) {
        for (let y = -1; y <= 7; y++) for (let x = -1; x <= 7; x++) {
            const xx = cx + x, yy = cy + y;
            if (xx < 0 || xx >= size || yy < 0 || yy >= size) continue;
            const dark = (
                (x >= 0 && x <= 6 && (y === 0 || y === 6)) ||
                (y >= 0 && y <= 6 && (x === 0 || x === 6)) ||
                (x >= 2 && x <= 4 && y >= 2 && y <= 4)
            );
            m[yy][xx] = dark ? 3 : 2;
        }
    }
    placeFinder(0, 0);
    placeFinder(size - 7, 0);
    placeFinder(0, size - 7);

    // Timing
    for (let i = 8; i < size - 8; i++) {
        if (m[6][i] === null) m[6][i] = (i % 2 === 0) ? 3 : 2;
        if (m[i][6] === null) m[i][6] = (i % 2 === 0) ? 3 : 2;
    }

    // Alignment (v >= 2)
    for (const ay of ALIGN_POS[version - 1])
        for (const ax of ALIGN_POS[version - 1]) {
            if (m[ay][ax] !== null) continue;
            for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
                const dark = (Math.abs(dx) === 2 || Math.abs(dy) === 2 || (dx === 0 && dy === 0));
                m[ay + dy][ax + dx] = dark ? 3 : 2;
            }
        }

    // Format info reservation (filled later by placeFormat)
    for (let i = 0; i < 9; i++) {
        if (m[8][i] === null) m[8][i] = 2;
        if (m[i][8] === null) m[i][8] = 2;
    }
    for (let i = 0; i < 8; i++) {
        if (m[size - 1 - i][8] === null) m[size - 1 - i][8] = 2;
        if (m[8][size - 1 - i] === null) m[8][size - 1 - i] = 2;
    }
    m[size - 8][8] = 3; // always-dark module

    // Version info (v >= 7)
    if (version >= 7) {
        const vb = versionBits(version);
        for (let i = 0; i < 18; i++) {
            const bit = (vb >> i) & 1;
            const row = Math.floor(i / 3);
            const col = (i % 3) + size - 11;
            m[row][col] = bit ? 3 : 2;
            m[col][row] = bit ? 3 : 2;
        }
    }

    // Place data — zig-zag right-to-left, skip vertical timing column 6
    let bitIdx = 0;
    let goingUp = true;
    for (let x = size - 1; x > 0; x -= 2) {
        if (x === 6) x--;
        for (let yi = 0; yi < size; yi++) {
            const y = goingUp ? size - 1 - yi : yi;
            for (let dx = 0; dx < 2; dx++) {
                const xx = x - dx;
                if (m[y][xx] !== null) continue;
                const byte = codewords[bitIdx >> 3];
                const bit  = byte === undefined ? 0 : ((byte >> (7 - (bitIdx & 7))) & 1);
                m[y][xx] = bit;
                bitIdx++;
            }
        }
        goingUp = !goingUp;
    }
    return m;
}

// ---------- Mask + format placement ----------
function applyMask(matrix, maskNum) {
    const size = matrix.length;
    const out = matrix.map(r => r.slice());
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const v = out[y][x];
        if (v === 2 || v === 3) continue;
        let inv;
        switch (maskNum) {
            case 0: inv = (y + x) % 2 === 0; break;
            case 1: inv = y % 2 === 0; break;
            case 2: inv = x % 3 === 0; break;
            case 3: inv = (y + x) % 3 === 0; break;
            case 4: inv = (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0; break;
            case 5: inv = ((y * x) % 2 + (y * x) % 3) === 0; break;
            case 6: inv = (((y * x) % 2 + (y * x) % 3) % 2) === 0; break;
            case 7: inv = (((y + x) % 2 + (y * x) % 3) % 2) === 0; break;
        }
        if (inv) out[y][x] = 1 - v;
    }
    return out;
}

function placeFormat(matrix, maskNum) {
    const size = matrix.length;
    const fmt = formatBits(maskNum);
    for (let i = 0; i < 15; i++) {
        const bit = (fmt >> i) & 1;
        // Primary placement (around top-left finder)
        if (i <= 5)       matrix[8][i] = bit;
        else if (i === 6) matrix[8][7] = bit;
        else if (i === 7) matrix[8][8] = bit;
        else if (i === 8) matrix[7][8] = bit;
        else              matrix[14 - i][8] = bit;
        // Secondary (split top-right + bottom-left), skips always-dark cell.
        if (i <= 6)        matrix[size - 1 - i][8] = bit;
        else if (i === 7)  { /* always-dark module sits here */ }
        else               matrix[8][size - 15 + i] = bit;
    }
}

// Penalty score (rules 1 + 2; 3 + 4 omitted — output still scans fine,
// only the chosen mask may not be the absolute optimum).
function penalty(matrix) {
    const size = matrix.length;
    let p = 0;
    for (let i = 0; i < size; i++) {
        let runH = 1, runV = 1, lastH = matrix[i][0], lastV = matrix[0][i];
        for (let j = 1; j < size; j++) {
            const h = matrix[i][j], v = matrix[j][i];
            if (h === lastH) runH++; else { if (runH >= 5) p += 3 + (runH - 5); runH = 1; lastH = h; }
            if (v === lastV) runV++; else { if (runV >= 5) p += 3 + (runV - 5); runV = 1; lastV = v; }
        }
        if (runH >= 5) p += 3 + (runH - 5);
        if (runV >= 5) p += 3 + (runV - 5);
    }
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
        const v = matrix[y][x];
        if (v === matrix[y][x + 1] && v === matrix[y + 1][x] && v === matrix[y + 1][x + 1]) p += 3;
    }
    return p;
}

// ---------- SVG output ----------
function renderSVG(matrix, opts) {
    const size = matrix.length;
    const m = (opts && opts.moduleSize) || 6;
    const q = (opts && opts.quietZone)  || 4;
    const dim = (size + 2 * q) * m;
    let path = "";
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const v = matrix[y][x];
        if (v === 1 || v === 3) {
            path += `M${(x + q) * m},${(y + q) * m}h${m}v${m}h-${m}z`;
        }
    }
    const fg = (opts && opts.fg) || "#000";
    const bg = (opts && opts.bg) || "#fff";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" shape-rendering="crispEdges">` +
           `<rect width="${dim}" height="${dim}" fill="${bg}"/>` +
           `<path d="${path}" fill="${fg}"/></svg>`;
}

// ---------- Public API ----------
window.generateQR = function (text, opts) {
    const bytes = Array.from(new TextEncoder().encode(text));
    const version = chooseVersion(bytes.length);
    if (version === null) return null;
    const cw = interleave(version, encodeBytes(bytes, version));
    const base = buildMatrix(version, cw);

    let bestMatrix = null, bestPenalty = Infinity;
    for (let mn = 0; mn < 8; mn++) {
        const masked = applyMask(base, mn);
        placeFormat(masked, mn);
        const p = penalty(masked);
        if (p < bestPenalty) { bestPenalty = p; bestMatrix = masked; }
    }
    // Normalise reserved cells (2/3) into 0/1 for output.
    for (let y = 0; y < bestMatrix.length; y++) for (let x = 0; x < bestMatrix.length; x++) {
        if (bestMatrix[y][x] === 2) bestMatrix[y][x] = 0;
        else if (bestMatrix[y][x] === 3) bestMatrix[y][x] = 1;
    }
    return renderSVG(bestMatrix, opts);
};

})();
