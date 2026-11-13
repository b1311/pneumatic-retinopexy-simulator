// Axisymmetric capillary equilibrium of a gas bubble in a spherical vitreous cavity.
//
// Coordinates: lengths in mm. The axis points along buoyancy ("up"); Z is the axial
// position measured from the cavity centre, so the wall is x² + Z² = R².
// The gas–liquid interface is traced from its apex on the axis (Z = a) outward to the
// wall. With φ the tangent angle from horizontal and z = Z − a, the Young–Laplace
// equation for a buoyant gas over a liquid reads
//   dφ/ds = k0 + z / lc² − sin φ / x,   dx/ds = cos φ,   dz/ds = sin φ
// where k0 is the total curvature at the apex and lc = √(γ / (Δρ g)) the capillary length.
// k0 > 0 is a smile-shaped (convex-down) bubble bottom, k0 < 0 a domed liquid pool.
// At the wall the interface must meet the retina at the contact angle θ, measured
// through the aqueous phase (captive-bubble convention, Fawcett et al. 1994).
// Two unknowns (a, k0) are found from two conditions (contact angle and gas volume).

const STEP_FRACTION = 1 / 240;

export function capillaryLength(gamma, deltaRho, g = 9.81) {
  return Math.sqrt(gamma / (deltaRho * g)) * 1000; // mm
}

export function capVolume(R, h) {
  return Math.PI * h * h * (3 * R - h) / 3;
}

// Flat-meniscus spherical cap holding volume V; returns the meniscus level Z.
export function flatCapLevel(R, V) {
  let lo = 0, hi = 2 * R;
  for (let i = 0; i < 60; i++) {
    const h = (lo + hi) / 2;
    if (capVolume(R, h) > V) hi = h; else lo = h;
  }
  return R - (lo + hi) / 2;
}

// Trace one interface. Returns the contact point, the angle there and the gas volume.
function trace(R, a, k0, lc2, record) {
  const ds = R * STEP_FRACTION, maxSteps = 4000;
  // Start a short way off the axis using the apex series (both principal curvatures k0/2).
  const s0 = ds * 0.5;
  let x = s0, z = k0 * s0 * s0 / 4, phi = k0 * s0 / 2, vol = 0;
  const pts = record ? [[0, a], [x, a + z]] : null;
  const f = (x, z, phi) => k0 + z / lc2 - Math.sin(phi) / x;
  for (let i = 0; i < maxSteps; i++) {
    // RK4 on (x, z, phi) and the volume integral ∫ π x² sinφ ds.
    const k1x = Math.cos(phi), k1z = Math.sin(phi), k1p = f(x, z, phi);
    const x2 = x + k1x * ds / 2, z2 = z + k1z * ds / 2, p2 = phi + k1p * ds / 2;
    const k2x = Math.cos(p2), k2z = Math.sin(p2), k2p = f(x2, z2, p2);
    const x3 = x + k2x * ds / 2, z3 = z + k2z * ds / 2, p3 = phi + k2p * ds / 2;
    const k3x = Math.cos(p3), k3z = Math.sin(p3), k3p = f(x3, z3, p3);
    const x4 = x + k3x * ds, z4 = z + k3z * ds, p4 = phi + k3p * ds;
    const k4x = Math.cos(p4), k4z = Math.sin(p4), k4p = f(x4, z4, p4);
    const nx = x + ds * (k1x + 2 * k2x + 2 * k3x + k4x) / 6;
    const nz = z + ds * (k1z + 2 * k2z + 2 * k3z + k4z) / 6;
    const np = phi + ds * (k1p + 2 * k2p + 2 * k3p + k4p) / 6;
    const dv = Math.PI * ds * (x * x * Math.sin(phi) + 4 * x3 * x3 * Math.sin(p3) + nx * nx * Math.sin(np)) / 6;
    if (nx <= 0 || Math.abs(np) >= Math.PI) return { hit: false, folded: np > 0 ? 1 : -1 };
    const r0 = x * x + (a + z) ** 2 - R * R, r1 = nx * nx + (a + nz) ** 2 - R * R;
    if (r1 >= 0) {
      const t = r0 / (r0 - r1);
      const cx = x + (nx - x) * t, cz = z + (nz - z) * t, cp = phi + (np - phi) * t;
      vol += dv * t;
      const Z = a + cz, norm = Math.hypot(cx, Z);
      const px = cx * R / norm, pz = Z * R / norm; // snap onto the wall
      // Liquid wedge between the wall heading down and the interface heading inward.
      const cos = (-pz * Math.cos(cp) + px * Math.sin(cp)) / R;
      const theta = Math.acos(Math.max(-1, Math.min(1, cos)));
      if (record) pts.push([px, pz]);
      return { hit: true, theta, xc: px, Zc: pz, vol, pts };
    }
    x = nx; z = nz; phi = np; vol += dv;
    if (record) pts.push([x, a + z]);
  }
  return { hit: false, folded: phi > 0 ? 1 : -1 };
}

function gasVolume(R, tr) {
  return capVolume(R, R - tr.Zc) + tr.vol;
}

// Find the apex curvature that meets the wall at angle theta for apex height a.
function solveCurvature(R, a, theta, lc2) {
  const kmax = 6 / Math.max(1e-3, Math.sqrt(lc2)) + 40 / R;
  let lo = -kmax, hi = kmax, best = null;
  for (let i = 0; i < 38; i++) {
    const k = (lo + hi) / 2, tr = trace(R, a, k, lc2, false);
    // θ falls as k0 rises; a fold-back counts as θ→0 (k too high) or θ→π (k too low).
    const th = tr.hit ? tr.theta : (tr.folded > 0 ? 0 : Math.PI);
    if (tr.hit) best = { k, tr };
    if (th > theta) lo = k; else hi = k;
  }
  const k = (lo + hi) / 2, tr = trace(R, a, k, lc2, false);
  return tr.hit ? { k, tr } : best;
}

/**
 * Solve the bubble shape.
 * @param {object} p R (mm), V (mm³), gamma (N/m), theta (rad, through liquid), deltaRho (kg/m³)
 * @returns {{apex:number, k0:number, contactLevel:number, contactRadius:number,
 *            profile:Array<[number,number]>, laplacePa:number, lc:number}}
 */
export function solveBubble({ R, V, gamma, theta, deltaRho, g = 9.81 }) {
  const lc = capillaryLength(gamma, deltaRho, g), lc2 = lc * lc;
  const total = 4 / 3 * Math.PI * R ** 3;
  if (V <= 0 || V >= total) return null;
  // Gas volume falls as the apex rises. Bracket the apex inside the cavity.
  let lo = -R + 1e-4, hi = R - 1e-4, sol = null;
  for (let i = 0; i < 36; i++) {
    const a = (lo + hi) / 2, s = solveCurvature(R, a, theta, lc2);
    if (!s) { hi = a; continue; }
    const v = gasVolume(R, s.tr);
    sol = { a, ...s };
    if (v > V) lo = a; else hi = a;
  }
  if (!sol) return null;
  const tr = trace(R, sol.a, sol.k, lc2, true);
  // Interface profile from apex to wall, then thin it for meshing.
  const step = Math.max(1, Math.floor(tr.pts.length / 140));
  const profile = tr.pts.filter((_, i) => i % step === 0 || i === tr.pts.length - 1);
  return {
    apex: sol.a,
    k0: sol.k,
    contactLevel: tr.Zc,
    contactRadius: tr.xc,
    profile,
    laplacePa: gamma * sol.k * 1000, // γ·k0, with k0 in 1/mm
    lc,
    volume: gasVolume(R, tr),
  };
}

// Arc of retinal contact (degrees) subtended by a contact ring at level Z.
export function arcDegrees(R, Z) {
  return 2 * Math.acos(Math.max(-1, Math.min(1, Z / R))) * 180 / Math.PI;
}

// ---------------------------------------------------------------------------
// Gas kinetics
//
// Absorption is limited by the retina the bubble touches: dV/dt = −k · A(V), with A the
// wetted area of a flat-meniscus cap (2πRh). This is the contact-area assumption of the
// multi-gas model of Hall, Williamson et al. It makes a large bubble shrink slowly and a
// small one quickly, so a single "half-life" is not constant over a bubble's life.
// k is calibrated per gas so that a 90% post-vitrectomy fill disappears (below 1% of the
// cavity) at the clinical duration in `durationDays`. Users can change that duration.

export const REFERENCE_FILL = 0.9;
export const DISAPPEARANCE_FILL = 0.01;

// Molar masses (g/mol) give densities at 37 °C and 1 atm.
// Lens multipliers scale the absorption rate (Thompson 1989 half-life ratios).
export const GASES = {
  Air: {
    molarMass: 28.97, isoexpansile: null,
    lensRate: { Phakic: 1, Pseudophakic: 1.78, Aphakic: 1.78 },
    options: [
      { c: 0, durationDays: 6, durationSource: 'Air lasts 5–7 days (Vaziri et al. 2015)', publishedHalfLife: '1.6 d phakic, 0.9 d aphakic (Thompson 1989)' },
    ],
  },
  SF6: {
    molarMass: 146.06, isoexpansile: 20,
    lensRate: { Phakic: 1, Pseudophakic: 1.17, Aphakic: 1.17 },
    options: [
      { c: 20, durationDays: 14, durationSource: 'About 2 weeks (Vaziri et al. 2015)', publishedHalfLife: '2.8 d phakic, 2.4 d aphakic (Thompson 1989)' },
      { c: 30, durationDays: 18, durationSource: '18.0 ± 2.6 days, 114 patients (Kontos et al. 2017)', publishedHalfLife: 'not reported' },
      { c: 100, durationDays: 18, pure: { factor: 2, peakDay: 1.5 }, durationSource: 'Rate taken from 30% SF6; expands 2× at 1–2 days (Vaziri et al. 2015)', publishedHalfLife: '2.6 d predicted for 0.5 mL (Hall et al. model)' },
    ],
  },
  C2F6: {
    molarMass: 138.01, isoexpansile: 16,
    lensRate: { Phakic: 1, Pseudophakic: 1.33, Aphakic: 1.27 },
    options: [
      { c: 16, durationDays: 32, durationSource: '4–5 weeks (Vaziri et al. 2015)', publishedHalfLife: 'not reported' },
      { c: 20, durationDays: 34.5, durationSource: '34.5 ± 3.3 days (Kontos et al. 2017)', publishedHalfLife: 'not reported' },
      { c: 100, durationDays: 34.5, pure: { factor: 3.3, peakDay: 2 }, durationSource: 'Rate taken from 20% C2F6; expands 3.3× (Duane’s)', publishedHalfLife: 'not reported' },
    ],
  },
  C3F8: {
    molarMass: 188.02, isoexpansile: 14,
    lensRate: { Phakic: 1, Pseudophakic: 1.33, Aphakic: 1.27 },
    options: [
      { c: 5, durationDays: 27, durationSource: 'From a 4.2 d half-life (Thompson 1992), single-exponential', publishedHalfLife: '4.2 d (Thompson 1992)' },
      { c: 10, durationDays: 42, durationSource: 'From a 6.5 d half-life (Thompson 1992), single-exponential', publishedHalfLife: '6.5 d (Thompson 1992); 5.7 d phakic (Thompson 1989)' },
      { c: 15, durationDays: 67.7, durationSource: '67.7 ± 5.5 days (Kontos et al. 2017)', publishedHalfLife: '8.0 d (Thompson 1992)' },
      { c: 20, durationDays: 81, durationSource: 'From a 12.5 d half-life (Thompson 1992), single-exponential', publishedHalfLife: '12.5 d (Thompson 1992)' },
      { c: 100, durationDays: 67.7, pure: { factor: 4, peakDay: 3.5 }, durationSource: 'Rate taken from 15% C3F8; expands 4× at 3–4 days (Vaziri et al. 2015)', publishedHalfLife: '9.9 d predicted for 0.5 mL (Hall et al. model)' },
    ],
  },
};

export function gasOption(gas, c) {
  const opts = GASES[gas].options;
  return opts.find(o => o.c === c) || opts[0];
}

// Gas density (kg/m³) at 37 °C for a mixture with air.
export function gasDensity(gas, c) {
  const rho = m => 101325 * m / 1000 / (8.314 * 310.15);
  const f = gas === 'Air' ? 0 : c / 100;
  return f * rho(GASES[gas].molarMass) + (1 - f) * rho(GASES.Air.molarMass);
}

// G(f) = ∫ dV / A(V) from the disappearance fill to f, tabulated once per cavity radius.
const gTables = new Map();
function gTable(R) {
  if (gTables.has(R)) return gTables.get(R);
  const n = 2000, total = 4 / 3 * Math.PI * R ** 3, fs = new Float64Array(n + 1), gs = new Float64Array(n + 1);
  const area = f => 2 * Math.PI * R * (R - flatCapLevel(R, f * total));
  let g = 0;
  for (let i = 0; i <= n; i++) {
    const f = DISAPPEARANCE_FILL / 4 + (1 - DISAPPEARANCE_FILL / 4) * i / n;
    if (i > 0) {
      const f0 = fs[i - 1], fm = (f0 + f) / 2;
      g += total * (f - f0) * (1 / area(f0) + 4 / area(fm) + 1 / area(f)) / 6;
    }
    fs[i] = f; gs[i] = g;
  }
  const g0 = interp(fs, gs, DISAPPEARANCE_FILL);
  for (let i = 0; i <= n; i++) gs[i] -= g0;
  const t = { fs, gs };
  gTables.set(R, t);
  return t;
}
function interp(xs, ys, x) {
  let lo = 0, hi = xs.length - 1;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[hi]) return ys[hi];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
  const p = (x - xs[lo]) / (xs[hi] - xs[lo]);
  return ys[lo] + (ys[hi] - ys[lo]) * p;
}

/**
 * Bubble fill over time.
 * @param {object} p gas, concentration, fill (0–100, injected or current), lens, durationDays, R (mm)
 */
export function makeKinetics({ gas, concentration, fill, lens, durationDays, R }) {
  const opt = gasOption(gas, concentration), { fs, gs } = gTable(R);
  const G = f => interp(fs, gs, f), Ginv = g => interp(gs, fs, g);
  const k = G(REFERENCE_FILL) / durationDays * (GASES[gas].lensRate[lens] || 1); // mm/day
  const f0 = fill / 100, pure = opt.pure || null;
  const peakDay = pure ? pure.peakDay : 0;
  const rawPeak = pure ? f0 * pure.factor : f0;
  const start = Math.min(rawPeak, 0.999); // absorption starts from the (capped) peak
  const absorbed = tau => (tau <= 0 ? start : Math.max(0, Ginv(G(start) - k * tau)));
  const fillAt = t => {
    if (f0 <= 0) return 0;
    if (pure && t < peakDay) { const x = t / peakDay, s = x * x * (3 - 2 * x); return f0 * (1 + (pure.factor - 1) * s); }
    const v = absorbed(t - peakDay);
    return v < DISAPPEARANCE_FILL ? 0 : v;
  };
  const disappearanceDay = f0 <= DISAPPEARANCE_FILL ? 0 : peakDay + G(start) / k;
  const halvingFrom = f => (G(f) - G(f / 2)) / k;
  return {
    k, option: opt, pure, peakDay, rawPeak, disappearanceDay,
    firstHalving: halvingFrom(start),
    // Apparent half-life at the current fill: instantaneous rate converted to days.
    halvingFrom,
    fillAt: t => 100 * fillAt(t),
    rawFillAt: t => (pure && t < peakDay ? 100 * fillAt(t) : 100 * (t <= peakDay ? rawPeak : fillAt(t))),
    phaseAt: t => (pure && t < peakDay ? 'Expansion' : 'Absorption'),
  };
}
