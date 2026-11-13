# Pneumatic Retinopexy 3D Physics Lab

Interactive educational visualization of an intraocular gas bubble and posterior-segment anatomy.

Free, open-source software under the [MIT license](LICENSE). Runs in the browser using Three.js and WebGL 2. No backend, database, login, or API keys are required.

## Run locally

Install Node.js 24, then:

```bash
npm ci
npm run dev
```

For a production build, run `npm run build`. To check the built site locally, run `npm run preview` and open the URL printed in the terminal. Only the generated `dist/` directory needs hosting; Node.js is used for development and building, not by visitors.

## Deploy with GitHub and Vercel

1. Push this project to a public GitHub repository, keeping `package-lock.json` committed. `node_modules/`, `dist/`, credentials, and Vercel local metadata are excluded by `.gitignore`.
2. In Vercel, choose **Add New → Project** and import that repository.
3. Use **Vite**, repository root (`./`), Node.js **24.x**, install command **npm ci**, build command **npm run build**, and output directory **dist**. These build settings are also in `vercel.json`. No environment variables are needed.
4. Deploy, then open the assigned HTTPS URL and check the 3D scene and controls. Subsequent pushes to the production branch deploy automatically through the Vercel GitHub integration.

## Use and contribute

Drag to orbit, scroll to zoom, and right-drag to pan. Adjust gas, fill, time, and orientation using the controls. On narrow screens, scroll below the scene to reach the controls. A modern browser with WebGL 2 and hardware acceleration is required.

Issues and pull requests are welcome. Before submitting a change, run `npm ci` and `npm run build`, then check the browser preview, including gas selection, fill extremes, orientation presets, fundus view, retinal breaks, and narrow-screen controls. Explain and source any changes to physical or gas-kinetics assumptions.

The application has no analytics, accounts, or simulation-data uploads. Typography is currently loaded from Google Fonts, so visitors' browsers make external font requests. The hosting provider may keep ordinary access logs.

## Model

The globe uses a 24 mm nominal diameter and a spherical vitreous cavity of radius 10.55 mm (4.9 mL). All physics lives in `src/physics.js`.

**Bubble shape.** The gas–liquid interface is solved from the axisymmetric Young–Laplace equation, `γ(dφ/ds + sin φ / x) = γk₀ + Δρ g z`, traced from the interface apex to the retina. The apex height and curvature are found so the bubble holds the required volume and meets the retina at the selected contact angle (measured through the aqueous; default 39°, the air–retina value measured by Fawcett, Williams and Wong, Graefe's 1994). Surface tension (default 60 mN/m, gas–saline, Duane's Ophthalmology) and contact angle therefore change the shape. The readout gives the wetted arc of contact and, for comparison with published tables such as Parver and Lincoff's glass-eye data, the arc of a flat-meniscus cap of the same volume.

**Gas kinetics.** Gas is absorbed through the retina it touches, so `dV/dt = −k · A(V)`, where `A` is the wetted area (the contact-area assumption of the multi-gas model of Hall, Williamson et al.). Large bubbles shrink slowly and small ones quickly, so no single half-life fits a bubble's whole life. For each gas and concentration, `k` is set so a 90% fill clears (below 1% of the cavity) at a published clinical duration (Vaziri et al., Retinal Physician 2015; Kontos et al., Graefe's 2017; Thompson, Arch Ophthalmol 1989 and 1992), and users can change that duration. The panel shows the model's halving time next to the published single-exponential half-life. Lens status scales the rate by Thompson's (1989) aphakic and pseudophakic half-life ratios. Pure gas first expands smoothly to its published factor and peak day (SF6 2× at 1.5 days, C2F6 3.3× at 2 days, C3F8 4× at 3.5 days), then is absorbed at the rate of its longest-acting diluted mix.

A damped second-order response approximates bubble migration after changes in head orientation.

This is a reduced-order educational model, not a validated treatment planner or medical device. It does not solve gas transport between species, pressure-driven aqueous outflow, Navier–Stokes flow, patient-specific anatomy, retinal compliance, or surgical outcomes, and must not be used for clinical decisions.
