# cutitoutbg.com

A privacy-first, in-browser background remover + manual cutout tool. 100%
client-side — images never leave the device. Static site, no build step.

## Structure
```
index.html                 the tool (drop image → remove bg → cut → export PNG)
css/style.css              styles
js/tool.js                 the tool logic (canvas, magic wand, eraser, undo, export)
privacy.html               privacy policy (required for AdSense)
articles/                  SEO content pages (drive traffic → ad revenue)
  remove-background-from-signature.html
  make-logo-transparent.html
  transparent-png-from-photo.html
robots.txt · sitemap.xml   SEO
ads.txt                    AdSense ownership file
```

## Before you go live — replace the placeholders
Search-and-replace these across the project:
- `ca-pub-XXXXXXXXXXXXXXXX` → your real Google AdSense publisher ID
  (in `index.html`, `privacy.html`, and every file in `articles/`).
- `pub-XXXXXXXXXXXXXXXX` in `ads.txt` → the same publisher ID.
- `data-ad-slot="…"` → real ad-unit slot IDs (after you create ad units in AdSense).
- If your domain is **not** `cutitoutbg.com`, update the `canonical` links and
  `sitemap.xml` / `robots.txt` URLs.

## Push to GitHub
```bash
cd cutitoutbg
git init
git add .
git commit -m "Initial cutitoutbg site"
git branch -M main
git remote add origin https://github.com/<your-username>/cutitoutbg.git
git push -u origin main
```

## Deploy on Cloudflare Pages (recommended)
1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pick the `cutitoutbg` repo.
3. Build settings: **Framework preset = None**, **Build command = (empty)**,
   **Build output directory = `/`**. Deploy.
4. **Custom domains** → add `cutitoutbg.com` (Cloudflare handles SSL automatically).

(GitHub Pages also works: repo Settings → Pages → deploy from `main` / root.)

## AdSense approval
1. Deploy on your **own domain** first (AdSense is unreliable on `*.github.io`).
2. In AdSense, add the site; the verification snippet is already in every `<head>`.
3. Approval takes days–weeks and needs real content (you have articles + privacy)
   and some traffic. Once approved, create ad units and paste the real slot IDs.

## Still needs real-device testing (flagged by the build team)
- Pointer/touch behavior on a real iPhone + Android.
- CSP vs. a live AdSense unit — open the console and add any CSP-blocked ad domains.
- Flood-fill / magic-wand tolerance tuning on real photos.
- Hi-DPI coordinate mapping and large-image memory (undo keeps up to 15 snapshots).
