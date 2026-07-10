// Flat ΛCDM cosmology (Planck 2018 parameters). Converts redshift to comoving
// distance by numerically integrating the FLRW line element — no external
// dependency (Astropy not required). Validated against published values in the
// self-test at the bottom (run: node scripts/cosmology.mjs).

export const C_KM_S = 299792.458;      // speed of light, km/s
export const H0 = 67.66;               // Hubble constant, km/s/Mpc (Planck18)
export const OMEGA_M = 0.30966;        // matter density
export const OMEGA_L = 0.68885;        // dark energy density
export const OMEGA_R = 9.182e-5;       // radiation density (photons+neutrinos)
export const D_H_MPC = C_KM_S / H0;    // Hubble distance ≈ 4431 Mpc
export const MPC_TO_LY = 3.2615638e6;  // 1 Mpc in light-years
export const MPC_TO_PC = 1e6;

// E(z) = H(z)/H0 for a flat universe.
export function Ez(z) {
  const zp = 1 + z;
  return Math.sqrt(OMEGA_R * zp * zp * zp * zp + OMEGA_M * zp * zp * zp + OMEGA_L);
}

// Comoving distance (line of sight), in Mpc. Adaptive Simpson over [0, z].
export function comovingDistanceMpc(z, steps = 0) {
  if (z <= 0) return 0;
  // scale integration steps with z so high-z (CMB) stays accurate
  const n = steps || Math.max(64, Math.min(20000, Math.ceil(z * 200)) & ~1);
  const h = z / n;
  let s = 1 / Ez(0) + 1 / Ez(z);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) / Ez(i * h);
  return D_H_MPC * (h / 3) * s;
}

// Light-travel (lookback) distance in Mpc: c * ∫ dz / ((1+z) H(z)).
export function lightTravelDistanceMpc(z, steps = 0) {
  if (z <= 0) return 0;
  const n = steps || Math.max(64, Math.min(20000, Math.ceil(z * 200)) & ~1);
  const h = z / n;
  const f = (zz) => 1 / ((1 + zz) * Ez(zz));
  let s = f(0) + f(z);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(i * h);
  return D_H_MPC * (h / 3) * s;
}

export const comovingDistanceLy = (z) => comovingDistanceMpc(z) * MPC_TO_LY;
export const lookbackGyr = (z) => (lightTravelDistanceMpc(z) * MPC_TO_LY) / 1e9; // ly→Gyr (c=1 ly/yr)

// ---- self test ----
if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = [
    [0.1, 424], [0.5, 1888], [1.0, 3396], [2.0, 5179], [3.0, 6349], [1100, 13871],
  ];
  console.log('z        Dc(Mpc)   ref(Mpc)   Dc(Gly)   lookback(Gyr)');
  for (const [z, ref] of rows) {
    const dc = comovingDistanceMpc(z);
    console.log(
      `${String(z).padEnd(7)} ${dc.toFixed(1).padStart(8)} ${String(ref).padStart(9)}   ${(dc * MPC_TO_LY / 1e9).toFixed(2).padStart(6)}   ${lookbackGyr(z).toFixed(3).padStart(8)}`
    );
  }
  const edge = comovingDistanceMpc(1100);
  console.log(`\nObservable horizon (z=1100): ${(edge * MPC_TO_LY / 1e9).toFixed(1)} Gly radius = ${(2 * edge * MPC_TO_LY / 1e9).toFixed(0)} Gly diameter`);
}
