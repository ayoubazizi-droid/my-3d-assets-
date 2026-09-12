# Orbit — Three.js for Blogger

A responsive 3D gallery with three built-in objects, orbit/zoom controls,
automatic rotation, reduced-motion support, and optional GLB models.
No build step is required. Internet access is required for Three.js and fonts.

## 1. Publish on GitHub Pages

1. Create a public GitHub repository (for example, `orbit-3d`).
2. Upload `index.html`, `style.css`, `app.js`, `.nojekyll`, and the `models` folder
   at the repository root. Do not upload the enclosing `blogger-3d` folder.
3. Under repository **Settings → Pages**, select **Deploy from a branch**,
   choose **main** and **/(root)**, and save.
4. Wait for deployment and open `https://YOUR-USERNAME.github.io/orbit-3d/`.
   Confirm the gallery loads before embedding it.

## 2. Add your 3D objects

Upload a self-contained, uncompressed `.glb` into `models/`. In `app.js`, change
an object's empty `url` to `./models/your-file.glb`. Edit its title and category.
File names are case-sensitive. Use the published GitHub Pages URL for an external
model, never a GitHub `/blob/` page URL. Keeping models in the same Pages repository
avoids cross-origin setup. Other servers must allow cross-origin requests.

GLTFLoader supports GLB/glTF. This starter does not configure Draco, Meshopt,
or KTX2 decoders and does not play embedded animations. Export without those
compression extensions. Models are automatically centered and scaled; a failed
model load shows a sample object and a visible error message.

## 3. Display it on Blogger

1. Open `blogger-embed.html` and replace both GitHub placeholders.
2. In Blogger, create or edit a page and switch the editor to **HTML view**.
3. Paste the iframe snippet, then preview and publish the page.
   You can also use **Layout → Add a Gadget → HTML/JavaScript** for an embed.
4. Adjust the iframe's `height:1250px` for your theme. Use a wide page layout.

Blogger hosts the surrounding blog/page; GitHub Pages hosts the embedded website
and model files. This is an iframe integration, not a replacement Blogger XML theme.
The frame scrolls independently if its content is taller than its configured height.

## Local preview

From this folder run `python3 -m http.server 8000` and visit
`http://localhost:8000`. Opening index.html directly as a file is not supported.

## References

- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- https://threejs.org/manual/en/installation.html
- https://threejs.org/docs/pages/GLTFLoader.html
- https://support.google.com/blogger/answer/46888?hl=en

## Included Ford Bronco

The first object now loads `models/Ud.glb` (26.1 MB), with baked textures embedded. Studio reflections are configured for paint and chrome. This detailed model can load slowly on mobile connections. The model passed glTF validation with no errors or warnings.
