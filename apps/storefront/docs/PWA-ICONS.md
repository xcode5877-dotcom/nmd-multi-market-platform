# PWA Icons (Storefront)

The storefront uses two PNG icons for “Add to Home Screen” and splash screens:

- **192×192** — `public/icons/icon-192.png`
- **512×512** — `public/icons/icon-512.png`

They are referenced in `public/manifest.json` with `"purpose": "any maskable"` so Android and iOS use them for the app icon and splash.

## Branding (MS Brands logo on teal)

To use your own **MS Brands** logo:

### 1. Export two PNGs

- **Size:** 192×192 and 512×512 pixels.
- **Background:** Solid teal `#0f766e` (matches `theme_color` and splash).
- **Content:** MS Brands logo (or “MS” wordmark) in white or light color, centered.
- **Format:** PNG, 24-bit or 32-bit (with transparency if you want a non-rectangular logo).

### 2. Maskable safe zone

For **maskable** icons, Android may crop the image into a circle or rounded square. Keep the important part (logo) inside the **inner 80%** of the canvas so it’s never cut off.

- Center the logo.
- Avoid important detail at the very edges.
- Optional: add ~10% padding around the logo.

### 3. Replace the files

Overwrite the existing files (keep the same names and folder):

```
apps/storefront/public/icons/icon-192.png   ← 192×192 PNG
apps/storefront/public/icons/icon-512.png   ← 512×512 PNG
```

### 4. No code changes

`manifest.json` already points to these paths. After replacing the files, redeploy or refresh; no edits to the manifest are required unless you add more sizes.

## Tools

- **Figma / Sketch / Illustrator:** Artboard 192×192 and 512×512, export as PNG.
- **ImageMagick** (from a logo file):  
  `convert logo.png -resize 192x192 -background '#0f766e' -gravity center -extent 192x192 icon-192.png`
- **Online:** [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator), [RealFaviconGenerator](https://realfavicongenerator.net/) (can output multiple sizes).

## Current files

Placeholder icons (teal background with “MS” style) are already in `public/icons/`. Replace them with your MS Brands assets when ready.
