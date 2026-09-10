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

The globe uses a 24 mm nominal diameter. Bubble volume is derived from a spherical vitreous cavity, then deformed using the Bond number `Bo = Δρ g R² / γ`. Interface pressure uses the Young–Laplace relation `ΔP = 2γ/R`. A damped second-order response approximates bubble migration following changes in head orientation; the displayed contact ring is adjusted by the selected wetting angle.

This is a reduced-order, quasi-static educational model, not a validated treatment planner or medical device. Gas kinetics use approximate concentration-dependent decay and pure-gas expansion curves; they do not solve gas transport. The model does not solve full Navier–Stokes flow, patient-specific anatomy, retinal compliance, or surgical outcomes, and must not be used for clinical decisions.
