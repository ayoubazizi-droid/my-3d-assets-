# pix3lware — Blogger theme and 3D garage

Live site: https://ayoubazizi-droid.github.io/my-3d-assets-/

The design comes from the supplied pix3lware Blogger theme: original pixel artwork, fonts, colors, and page sections. A 3D garage is added below the gallery. The footer wraps on small screens.

- `index.html` / `theme.css`: standalone static version of the design. Blogger's live post list is omitted here. The original inactive newsletter form is replaced with a garage link on this static page.
- `blogger-theme.xml`: complete Blogger theme with its original Blog1 post widget and the embedded 3D garage. The original newsletter form and placeholder social links are preserved; subscribing is not connected to a mailing service.
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
