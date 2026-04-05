/**
 * Red–white–blue color scale.
 * margin > 0  → FH Families (red)
 * margin < 0  → FH Forward (blue)
 * margin = 0  → white/neutral
 *
 * Scale anchors (absolute margin):
 *   ±20%+ → deep color
 *   ±10%  → medium color
 *    0%   → white
 */

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function lerpColor(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

const WHITE  = [255, 255, 255];
const RED_LT = [252, 165, 165]; // #FCA5A5
const RED_DK = [220,  38,  38]; // #DC2626
const BLU_LT = [147, 197, 253]; // #93C5FD
const BLU_DK = [ 37,  99, 235]; // #2563EB

/**
 * margin: number in [-1, 1]
 * Returns CSS hex color string.
 */
export function marginToColor(margin) {
  if (margin === null || margin === undefined || isNaN(margin)) {
    return '#e5e7eb'; // light gray for no data
  }

  const abs = Math.abs(margin);
  // Clamp: 0–10% → light, 10–20% → medium→dark, 20%+ → deep
  const t = Math.min(abs / 0.20, 1); // 0 at 0%, 1 at ≥20%

  if (margin > 0) {
    // FH Families → red
    const [r, g, b] = lerpColor(WHITE, RED_DK, t);
    return `rgb(${r},${g},${b})`;
  } else if (margin < 0) {
    // FH Forward → blue
    const [r, g, b] = lerpColor(WHITE, BLU_DK, t);
    return `rgb(${r},${g},${b})`;
  } else {
    return '#ffffff';
  }
}

/** Text color for readability against background */
export function marginToTextColor(margin) {
  if (margin === null || isNaN(margin)) return '#374151';
  return Math.abs(margin) > 0.15 ? '#ffffff' : '#1f2937';
}
