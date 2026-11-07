# DIWALI — A letter in light

A responsive Diwali keepsake built with React, TypeScript, Vite and Three.js. The parent scene provides the midnight sky, layered stars, floating embers, pooled fireworks and glowing diyas. The central paper remains in its authored Three.js r149 sandboxed document.

## Run locally

```sh
npm install
npm run dev
```

Create a production build with `npm run build`, then serve it with `npm run preview`.

## ThreeDPaper source

The untouched supplied component, shared styles and four original HTML scenes are preserved under `src/shaders/`. Their SHA-256 hashes match the supplied bundle. `diwali-letter.html` is a separate Certificate scene; only its `drawOld(ctx)` CanvasTexture artwork function differs. The original `ThreeDPaper.tsx` retains the opaque `sandbox="allow-scripts"` iframe, visibility lifecycle, loading state and event cleanup. `DiwaliPaper.tsx` uses the same host boundary and lifecycle while pointing at the customized Certificate HTML.

The custom letter keeps the authored renderer, bundled Three.js r149, paper geometry, GLSL, deformation, glass shading, parallax, pointer dragging, inertial release and responsiveness. The outer scene intentionally sits behind the opaque iframe.
