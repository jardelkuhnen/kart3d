import { PNG } from 'pngjs';

export type RgbColor = readonly [number, number, number];
export type RgbaColor = readonly [number, number, number, number];

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hash2D(ix: number, iy: number, seed: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function valueNoise2D(x: number, y: number, period = 64, seed = 1337): number {
  const fx = ((x % period) + period) % period;
  const fy = ((y % period) + period) % period;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);

  const v00 = hash2D(x0, y0, seed);
  const v10 = hash2D(x1, y0, seed);
  const v01 = hash2D(x0, y1, seed);
  const v11 = hash2D(x1, y1, seed);

  return lerp(lerp(v00, v10, sx), lerp(v01, v11, sx), sy);
}

export function fbm2D(
  u: number,
  v: number,
  basePeriod = 8,
  octaves = 4,
  seed = 1337,
): number {
  let total = 0;
  let amplitude = 0.5;
  let norm = 0;
  let freq = basePeriod;

  for (let i = 0; i < octaves; i += 1) {
    total += valueNoise2D(u * freq, v * freq, freq, seed + i * 97) * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    freq *= 2;
  }

  return total / norm;
}

export function renderPng(
  width: number,
  height: number,
  pixelFn: (x: number, y: number, u: number, v: number) => RgbaColor,
): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const [r, g, b, a] = pixelFn(x, y, u, v);
      const idx = (width * y + x) << 2;
      png.data[idx] = clampByte(r);
      png.data[idx + 1] = clampByte(g);
      png.data[idx + 2] = clampByte(b);
      png.data[idx + 3] = clampByte(a);
    }
  }
  return PNG.sync.write(png);
}

/**
 * Tileable road asphalt albedo + roughness maps with mineral aggregate micro-grain,
 * longitudinal tire wear tracks, subtle outer edge shoulder markings, and crisp centerline.
 */
export function createAsphaltTextures(size = 512): { albedo: Buffer; roughness: Buffer } {
  const albedoData = new Float32Array(size * size * 3);
  const roughData = new Float32Array(size * size);

  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const grain = fbm2D(u, v, 16, 4, 41);
      const micro = valueNoise2D(u * 128, v * 128, 128, 89);

      // Subtle worn racing grooves around +/- 0.22 from center
      const leftGroove = Math.exp(-Math.pow((u - 0.28) / 0.085, 2));
      const rightGroove = Math.exp(-Math.pow((u - 0.72) / 0.085, 2));
      const wear = Math.max(leftGroove, rightGroove);

      const base = 66 + (grain - 0.5) * 26 + (micro - 0.5) * 18 - wear * 11;
      let r = base * 0.98;
      let g = base * 1.0;
      let b = base * 1.05;

      // Crisp shoulder lines along u = 0.055 and u = 0.945
      if (Math.abs(u - 0.055) < 0.012 || Math.abs(u - 0.945) < 0.012) {
        const edgeFade = 1 - Math.min(Math.abs(u - 0.055), Math.abs(u - 0.945)) / 0.012;
        const mix = smoothstep(0.0, 0.5, edgeFade) * 0.88;
        r = lerp(r, 232, mix);
        g = lerp(g, 236, mix);
        b = lerp(b, 240, mix);
      }

      // Dashed yellow-white centerline
      const dashPhase = (v * 4) % 1;
      if (Math.abs(u - 0.5) < 0.012 && dashPhase < 0.55) {
        const centerFade = smoothstep(0.012, 0.004, Math.abs(u - 0.5));
        r = lerp(r, 246, centerFade * 0.92);
        g = lerp(g, 198, centerFade * 0.92);
        b = lerp(b, 64, centerFade * 0.92);
      }

      const idx = (y * size + x) * 3;
      albedoData[idx] = r;
      albedoData[idx + 1] = g;
      albedoData[idx + 2] = b;

      // Tire tracks are slightly smoother (lower roughness) than raw aggregate
      const rough = 0.86 - wear * 0.14 + (grain - 0.5) * 0.14;
      roughData[y * size + x] = Math.max(0.45, Math.min(0.98, rough));
    }
  }

  const albedo = renderPng(size, size, (x, y) => {
    const idx = (y * size + x) * 3;
    return [albedoData[idx], albedoData[idx + 1], albedoData[idx + 2], 255];
  });

  const roughness = renderPng(size, size, (x, y) => {
    const val = roughData[y * size + x] * 255;
    return [val, val, val, 255];
  });

  return { albedo, roughness };
}

/**
 * High-contrast racing apex curb texture with concrete bevel shading.
 */
export function createCurbTexture(
  size = 256,
  primary: RgbColor = [235, 58, 52],
  secondary: RgbColor = [245, 247, 250],
): Buffer {
  return renderPng(size, size, (_x, _y, u, v) => {
    const stripeIndex = Math.floor(v * 6);
    const col = stripeIndex % 2 === 0 ? primary : secondary;
    const concreteNoise = (fbm2D(u, v, 12, 3, 211) - 0.5) * 18;
    const bevel = 1.0 - Math.pow(Math.abs(u - 0.5) * 1.4, 3) * 0.22;
    // Thin dark seam between curb blocks
    const blockEdge = Math.min((v * 6) % 1, 1 - ((v * 6) % 1));
    const seam = smoothstep(0.0, 0.05, blockEdge) * 0.18 + 0.82;
    return [
      col[0] * bevel * seam + concreteNoise,
      col[1] * bevel * seam + concreteNoise,
      col[2] * bevel * seam + concreteNoise,
      255,
    ];
  });
}

/**
 * Crisp checkered start/finish strip with asphalt grain and gold border accents.
 */
export function createCheckeredStartTexture(size = 512): Buffer {
  return renderPng(size, size, (_x, _y, u, v) => {
    const grain = (fbm2D(u, v, 20, 3, 503) - 0.5) * 14;
    if (v < 0.08 || v > 0.92) {
      return [245 + grain * 0.4, 178 + grain * 0.4, 24, 255];
    }
    const cols = 16;
    const rows = 4;
    const cx = Math.floor(u * cols);
    const cy = Math.floor(((v - 0.08) / 0.84) * rows);
    const isWhite = (cx + cy) % 2 === 0;
    const base = isWhite ? 242 : 24;
    return [base + grain, base + grain, base + grain + (isWhite ? 4 : 8), 255];
  });
}

/**
 * High-contrast turn-warning chevron board texture (`>>>`).
 */
export function createChevronSignTexture(size = 256): Buffer {
  return renderPng(size, size, (_x, _y, u, v) => {
    // Dark slate outer frame
    if (u < 0.05 || u > 0.95 || v < 0.08 || v > 0.92) {
      return [30, 36, 52, 255];
    }

    // 3 bold white-and-amber chevrons pointing right on crimson field
    const localV = Math.abs(v - 0.5) * 2; // 0 at center, 1 at top/bottom
    let inChevron = false;
    for (let i = 0; i < 3; i += 1) {
      const centerU = 0.26 + i * 0.24 - localV * 0.14;
      if (Math.abs(u - centerU) < 0.068 && localV < 0.72) {
        inChevron = true;
      }
    }

    const sheen = (1 - v) * 16;
    if (inChevron) {
      return [250, 250, 252, 255];
    }

    // Alternating diagonal border accent stripes at top/bottom
    if (v < 0.15 || v > 0.85) {
      return [255, 184, 0, 255];
    }

    return [218 + sheen, 38, 56, 255];
  });
}

/**
 * Reusable stylized grass turf texture with mottled meadow variation (for upcoming tracks).
 */
export function createGrassTurfTexture(size = 256): Buffer {
  return renderPng(size, size, (_x, _y, u, v) => {
    const n1 = fbm2D(u, v, 8, 4, 701);
    const n2 = valueNoise2D(u * 32, v * 32, 32, 709);
    const patch = smoothstep(0.35, 0.7, n1);
    return [
      lerp(56, 98, patch) + (n2 - 0.5) * 16,
      lerp(138, 184, patch) + (n2 - 0.5) * 18,
      lerp(52, 72, patch) + (n2 - 0.5) * 10,
      255,
    ];
  });
}

/**
 * Reusable stone cobblestone texture with mortar grooves.
 */
export function createCobbleTexture(size = 256): Buffer {
  return renderPng(size, size, (_x, _y, u, v) => {
    const rows = 8;
    const cols = 6;
    const row = Math.floor(v * rows);
    const offsetU = (u + (row % 2) * (0.5 / cols)) % 1;
    const cu = (offsetU * cols) % 1;
    const cv = (v * rows) % 1;
    const mortar =
      cu < 0.08 || cu > 0.92 || cv < 0.1 || cv > 0.9
        ? 0.55
        : 1.0;
    const cellSeed = Math.floor(offsetU * cols) + row * 17;
    const tint = (hash2D(cellSeed, row, 911) - 0.5) * 28;
    const grain = (fbm2D(u, v, 16, 3, 919) - 0.5) * 20;
    return [
      (148 + tint + grain) * mortar,
      (142 + tint + grain) * mortar,
      (136 + tint + grain) * mortar,
      255,
    ];
  });
}

/**
 * Reusable glowing boost-pad chevron texture.
 */
export function createBoostPadTexture(size = 256): Buffer {
  return renderPng(size, size, (_x, _y, u, v) => {
    const dx = Math.abs(u - 0.5) * 2;
    const phase = (v * 3 + dx * 0.45) % 1;
    const band = phase < 0.45 && dx < 0.86;
    if (band) {
      const pulse = 1 - Math.abs(phase - 0.225) / 0.225;
      return [
        lerp(0, 190, pulse),
        lerp(210, 255, pulse),
        255,
        255,
      ];
    }
    return [14, 28, 56, 255];
  });
}

/**
 * Tileable warm dirt shortcut & off-road track texture.
 */
export function createDirtTrackTexture(size = 256): Buffer {
  return renderPng(size, size, (_x, _y, u, v) => {
    const n1 = fbm2D(u, v, 8, 4, 311);
    const pebble = valueNoise2D(u * 48, v * 48, 48, 317);
    const rut = Math.exp(-Math.pow((u - 0.3) / 0.12, 2)) + Math.exp(-Math.pow((u - 0.7) / 0.12, 2));
    const shade = 1 - rut * 0.12;
    return [
      (148 + (n1 - 0.5) * 34 + (pebble - 0.5) * 24) * shade,
      (104 + (n1 - 0.5) * 26 + (pebble - 0.5) * 18) * shade,
      (64 + (n1 - 0.5) * 20 + (pebble - 0.5) * 12) * shade,
      255,
    ];
  });
}

/**
 * Tileable wind-rippled coastal sand texture.
 */
export function createSandTexture(size = 256): Buffer {
  return renderPng(size, size, (_x, _y, u, v) => {
    const ripple = Math.sin((u * 8 + v * 4 + fbm2D(u, v, 6, 3, 419) * 1.4) * Math.PI * 2);
    const grain = (valueNoise2D(u * 64, v * 64, 64, 421) - 0.5) * 14;
    return [
      226 + ripple * 12 + grain,
      196 + ripple * 10 + grain * 0.9,
      138 + ripple * 8 + grain * 0.7,
      255,
    ];
  });
}

/**
 * Tileable warm Mediterranean terracotta roof tile texture.
 */
export function createTerracottaTexture(size = 256): Buffer {
  return renderPng(size, size, (_x, _y, u, v) => {
    const wave = Math.sin(u * Math.PI * 16) * 14;
    const rowEdge = (v * 8) % 1;
    const shadow = rowEdge < 0.12 ? 0.72 : 1.0;
    const grain = (fbm2D(u, v, 12, 3, 613) - 0.5) * 20;
    return [
      (196 + wave + grain) * shadow,
      (84 + wave * 0.5 + grain * 0.6) * shadow,
      (52 + wave * 0.3 + grain * 0.4) * shadow,
      255,
    ];
  });
}

/**
 * Tileable stylized turquoise coastal bay water texture with sun-caustic shimmer.
 */
export function createWaterTexture(size = 256): Buffer {
  return renderPng(size, size, (_x, _y, u, v) => {
    const n1 = fbm2D(u, v, 6, 4, 821);
    const n2 = fbm2D(u + 0.3, v + 0.15, 12, 3, 829);
    const caustic = smoothstep(0.62, 0.85, (n1 + n2) * 0.5);
    return [
      lerp(18, 120, caustic),
      lerp(116, 224, caustic),
      lerp(182, 248, caustic),
      255,
    ];
  });
}

/**
 * Stylized 2D character portrait / HUD emblem PNG with radial burst & clean silhouette.
 */
export function createCharacterPortraitPng(
  bgTop: RgbColor,
  bgBottom: RgbColor,
  primary: RgbColor,
  accent: RgbColor,
  size = 256,
  isIcon = false,
): Buffer {
  return renderPng(size, size, (_x, _y, u, v) => {
    const cx = u - 0.5;
    const cy = v - 0.52;
    const dist = Math.hypot(cx, cy);
    const angle = Math.atan2(cy, cx);

    // Rounded emblem frame border
    if (dist > 0.48) {
      return [0, 0, 0, 0];
    }
    if (dist > 0.44) {
      return [255, 204, 42, 255];
    }

    // Radial burst backdrop
    const burst = 0.88 + 0.12 * Math.sin(angle * 12);
    let r = lerp(bgTop[0], bgBottom[0], v) * burst;
    let g = lerp(bgTop[1], bgBottom[1], v) * burst;
    let b = lerp(bgTop[2], bgBottom[2], v) * burst;

    // Stylized character head & ears silhouette
    const inHead = Math.hypot(cx * 1.1, (cy - 0.04) * 1.15) < 0.24;
    const inLeftEar =
      cx < -0.05 && cx > -0.25 && cy < -0.08 && cy > -0.34 && Math.abs(cx + 0.15 + (cy + 0.21) * 0.35) < 0.095;
    const inRightEar =
      cx > 0.05 && cx < 0.25 && cy < -0.08 && cy > -0.34 && Math.abs(cx - 0.15 - (cy + 0.21) * 0.35) < 0.095;
    const inScarf = Math.hypot(cx * 0.72, (cy - 0.28) * 1.6) < 0.24;

    if (inScarf) {
      r = accent[0];
      g = accent[1];
      b = accent[2];
    }
    if (inLeftEar || inRightEar || inHead) {
      r = primary[0];
      g = primary[1];
      b = primary[2];
    }

    // Cream muzzle & aviator goggles highlight
    const inMuzzle = Math.hypot(cx * 1.25, (cy - 0.12) * 1.6) < 0.14;
    if (inMuzzle) {
      r = 252;
      g = 242;
      b = 222;
    }

    const inLeftGoggle = Math.hypot(cx + 0.09, cy + 0.12) < 0.068;
    const inRightGoggle = Math.hypot(cx - 0.09, cy + 0.12) < 0.068;
    if (inLeftGoggle || inRightGoggle) {
      const inner = Math.hypot(cx + (cx < 0 ? 0.09 : -0.09), cy + 0.12) < 0.045;
      r = inner ? 252 : 34;
      g = inner ? 196 : 42;
      b = inner ? 48 : 64;
    }

    // Glossy eyes
    if (!isIcon || dist < 0.42) {
      const inEyeL = Math.hypot(cx + 0.075, cy - 0.01) < 0.028;
      const inEyeR = Math.hypot(cx - 0.075, cy - 0.01) < 0.028;
      if (inEyeL || inEyeR) {
        r = 18;
        g = 24;
        b = 38;
      }
      const inNose = Math.hypot(cx, cy - 0.085) < 0.024;
      if (inNose) {
        r = 22;
        g = 24;
        b = 30;
      }
    }

    return [r, g, b, 255];
  });
}
