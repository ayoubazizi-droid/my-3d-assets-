# pix3lware — Blogger theme and 3D garage

Live site: https://ayoubazizi-droid.github.io/my-3d-assets-/

The design comes from the supplied pix3lware Blogger theme: original pixel artwork, fonts, colors, and page sections. A 3D garage is added below the gallery. The footer wraps on small screens.

- `index.html` / `theme.css`: standalone static version of the design. Blogger's live post list is omitted here. The original inactive newsletter form is replaced with a garage link on this static page.
- `blogger-theme.xml`: complete Blogger theme with its original Blog1 post widget and the embedded 3D garage. The Contact footer links to TikTok, Pinterest, Instagram, and X. The original newsletter form is preserved; subscribing is not connected to a mailing service.
- `viewer.html` / `style.css` / `app.js`: compact Three.js viewer, styled to match the theme.
- `models/Ud.glb`: baked Bronco, with embedded textures, approximately 26 MB.
- `blogger-embed.html`: optional snippet for an individual Blogger page; unnecessary if installing the complete theme.

## Install the Blogger theme

In Blogger, open Theme, save a backup of the current theme, then use the theme menu's Restore / Upload option to select `blogger-theme.xml`. Alternatively, replace the contents of Theme → Edit HTML with this XML and save. This theme already includes the viewer, so a separate page embed is not required.

Local copies: `/home/liveuser/Documents/pix3lware-theme/pix3lware-3d.xml` and `original.xml` (the supplied unmodified theme).

Blogger renders the dynamic posts. GitHub Pages hosts the 3D viewer and model. The iframe uses the absolute GitHub Pages viewer URL and has desktop/mobile heights.

## Validation

Theme XML parses and retains Blog1. The model passes Khronos glTF validation with zero errors or warnings. Brave desktop (1365 px) and phone (390 px) checks confirmed the model loads, rotation toggles, reset works, and the main page has no horizontal overflow. No page JavaScript errors were observed. Actual Blogger installation still needs to be performed in Blogger.

Local preview: `python3 -m http.server 8011` from this directory. Open `http://localhost:8011/`; the theme iframe points to the deployed viewer.

## Pixel rendering

The viewer starts in Pixel art mode. The Look selector offers Fine pixels (2 CSS pixels), Pixel art (4), Chunky pixels (7), and Smooth 3D. EffectComposer runs RenderPixelatedPass and OutputPass; smooth mode renders directly. Pixel size accounts for device pixel ratio. Text and buttons remain sharp HTML controls. Render targets resize with the viewer; no change to the GLB or Blogger theme installation is needed.

The display also has a CRT treatment: four-pixel scanlines, mild red/green phosphor fringing, a curved-screen vignette, softened contrast, and an inset glass highlight. It is applied as a CSS screen layer above the rendered canvas, so it stays lightweight and keeps the model controls accessible.

The CRT layer is enabled by default on the deployed viewer and works together with every Look mode.

Validated all four modes in Brave at 1040px / DPR 1 and 390px / DPR 2, including rotation/reset and checks for overflow and console errors.

Reference: https://threejs.org/docs/pages/RenderPixelatedPass.html

## Scroll experience

The motion layer (`motion.js` and `motion.css`) adds alternating side entrances, a pinned typography sequence, parallax, scroll progress, and a horizontal gallery driven by native vertical scrolling. The Motion button and system reduced-motion preference restore a static layout.

The looping loader uses `/home/liveuser/Videos/0001-0148.mkv`, converted to H.264 MP4 (960px) and VP9 WebM (720px), with a poster fallback. It tracks page assets and the viewer, offers Continue after 12 seconds, and releases the page after 20 seconds even if media stalls.

Run `python3 scripts/sync-motion.py` after motion edits to update the static page, Blogger XML, and local Blogger install copies. The static iframe uses a relative URL so previews use the local viewer.
