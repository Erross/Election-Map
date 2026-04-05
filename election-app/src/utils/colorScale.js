/**
 * Teal–white–amber color scale.
 * margin > 0  → FH Families (amber/gold)
 * margin < 0  → FH Forward (teal)
 * margin = 0  → near-white neutral
 *
 * Scale anchors (absolute margin fraction):
 *   ±0.20+ → deep color (fully saturated)
 *    0     → near-white
 */

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function lerpColor(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

const WHITE  = [248, 250, 252]; // #F8FAFC — off-white neutral midpoint
const AMB_DK = [180,  83,   9]; // #B45309 — amber-700, FH Families strong
const TEA_DK = [ 15, 118, 110]; // #0F766E — teal-700,  FH Forward strong

/**
 * margin: number in [-1, 1]
 * Returns CSS rgb() color string.
 */
export function marginToColor(margin) {
  if (margin === null || margin === undefined || isNaN(margin)) {
    return '#e5e7eb'; // light gray for no data
  }

  const abs = Math.abs(margin);
  const t = Math.min(abs / 0.20, 1); // 0 at 0%, 1 at ≥20%

  if (margin > 0) {
    const [r, g, b] = lerpColor(WHITE, AMB_DK, t);
    return `rgb(${r},${g},${b})`;
  } else if (margin < 0) {
    const [r, g, b] = lerpColor(WHITE, TEA_DK, t);
    return `rgb(${r},${g},${b})`;
  }
  return `rgb(${WHITE[0]},${WHITE[1]},${WHITE[2]})`;
}

/** Text color for readability against the fill background */
export function marginToTextColor(margin) {
  if (margin === null || isNaN(margin)) return '#374151';
  return Math.abs(margin) > 0.15 ? '#ffffff' : '#1f2937';
}

// Named constants for use in UI components
export const COLOR_FAMILIES = '#b45309'; // amber-700
export const COLOR_FORWARD  = '#0f766e'; // teal-700
