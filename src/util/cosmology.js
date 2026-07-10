// Frontend cosmology: redshift -> comoving distance (flat ΛCDM, Planck18) via a
// precomputed lookup table, plus a distance colour ramp and formatters. Positions
// on the map use a logarithmic radius so the whole observable universe fits.

export const C_KM_S = 299792.458;
export const H0 = 67.66;
export const OMEGA_M = 0.30966, OMEGA_L = 0.68885, OMEGA_R = 9.182e-5;
export const D_H_MPC = C_KM_S / H0;
export const MPC_TO_LY = 3.2615638e6;
export const MPC_TO_PC = 1e6;

function Ez(z) {
  const zp = 1 + z;
  return Math.sqrt(OMEGA_R * zp ** 4 + OMEGA_M * zp ** 3 + OMEGA_L);
}

function comovingIntegral(z) {
  const n = Math.max(64, Math.min(8000, Math.ceil(z * 200)) & ~1);
  const h = z / n;
  let s = 1 / Ez(0) + 1 / Ez(z);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) / Ez(i * h);
  return D_H_MPC * (h / 3) * s;
}

// Lookup table over z in [0, ZMAX]; O(1) interpolation for hundreds of thousands
// of objects at load.
const ZMAX = 7, STEPS = 2800;
const LUT = new Float64Array(STEPS + 1);
for (let i = 0; i <= STEPS; i++) LUT[i] = comovingIntegral((i / STEPS) * ZMAX);

export function comovingMpc(z) {
  if (z <= 0) return 0;
  if (z >= ZMAX) return comovingIntegral(z);
  const t = (z / ZMAX) * STEPS;
  const i = t | 0;
  return LUT[i] + (LUT[i + 1] - LUT[i]) * (t - i);
}

export const comovingLy = (z) => comovingMpc(z) * MPC_TO_LY;

// Logarithmic display radius from a real distance in parsecs.
export function displayRadius(distPc, decadeUnit) {
  return distPc <= 1 ? 0 : decadeUnit * Math.log10(distPc);
}
export const displayRadiusFromMpc = (mpc, decadeUnit) => displayRadius(mpc * MPC_TO_PC, decadeUnit);

// Distance colour ramp: near = cyan, far = crimson (mirrors cosmological redshift).
const RAMP = [
  [0.00, [0.55, 0.90, 1.00]],
  [0.32, [0.52, 1.00, 0.72]],
  [0.52, [1.00, 0.92, 0.42]],
  [0.70, [1.00, 0.62, 0.32]],
  [0.85, [1.00, 0.38, 0.40]],
  [1.00, [0.78, 0.22, 0.42]],
];
export function distanceColor(frac) {
  const f = frac < 0 ? 0 : frac > 1 ? 1 : frac;
  for (let i = 1; i < RAMP.length; i++) {
    if (f <= RAMP[i][0]) {
      const [a, ca] = RAMP[i - 1], [b, cb] = RAMP[i];
      const k = (f - a) / (b - a);
      return [ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k];
    }
  }
  return RAMP[RAMP.length - 1][1];
}

// ---- formatting ----
export function fmtCosmoDist(mpc) {
  const ly = mpc * MPC_TO_LY;
  if (ly >= 1e9) return `${(ly / 1e9).toFixed(2)} Gly`;
  if (ly >= 1e6) return `${(ly / 1e6).toFixed(1)} Mly`;
  if (ly >= 1e3) return `${(ly / 1e3).toFixed(0)} kly`;
  return `${ly.toFixed(0)} ly`;
}
export function fmtMpc(mpc) {
  if (mpc >= 1000) return `${(mpc / 1000).toFixed(2)} Gpc`;
  if (mpc >= 1) return `${mpc.toFixed(1)} Mpc`;
  return `${(mpc * 1000).toFixed(0)} kpc`;
}
export function fmtZ(z) { return z < 0.001 ? z.toExponential(1) : z.toFixed(z < 0.1 ? 4 : 3); }

// Lookback time in Gyr (approx): light-travel distance / c.
export function lookbackGyr(z) {
  if (z <= 0) return 0;
  const n = Math.max(64, Math.min(8000, Math.ceil(z * 200)) & ~1);
  const h = z / n;
  const f = (zz) => 1 / ((1 + zz) * Ez(zz));
  let s = f(0) + f(z);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(i * h);
  return (D_H_MPC * (h / 3) * s * MPC_TO_LY) / 1e9;
}
