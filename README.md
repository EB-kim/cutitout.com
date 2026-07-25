# cutitoutbg.com

A privacy-first, in-browser background remover, cutout tool and collage maker.
100% client-side — images never leave the device. Static site, no build step.

Live at **https://www.cutitoutbg.com**

## Structure

Everything is inlined into one file. There is no `css/` or `js/` directory —
the previous README described a split that never existed.

```
index.html      the whole app: styles, markup and module script
privacy.html    privacy policy (required for AdSense)
sitemap.xml     submitted via Google Search Console
robots.txt      points at sitemap.xml
ads.txt         AdSense ownership file
CNAME           www.cutitoutbg.com
```

## AdSense status

Publisher ID `pub-6423038605227421` is now consistent across `ads.txt`,
`privacy.html` and `index.html`. Previously the placeholder was only replaced in
`ads.txt`, so the site served no ads at all.

**One thing still to do:** create a display ad unit in the AdSense dashboard and
replace `REPLACE_WITH_YOUR_SLOT_ID` in `index.html` with its slot ID.

**Keep Auto Ads OFF for this site.** The app is a full-viewport canvas editor;
auto-injected overlays will land on top of the canvas and generate accidental
clicks, which is the fastest route to an account ban. The manual unit at the foot
of the sidebar is deliberately placed away from the header's Download/Export
buttons.

## Licensing — read before monetising

This app depends on `@imgly/background-removal`, which is **AGPL-3.0**. That has
two consequences:

- Ads and donations are fine. AGPL restricts licensing, not commerce.
- A **closed-source paid tier is not permitted** while this dependency is in use.
  To sell features you would need commercial terms from IMG.LY
  (support@img.ly), or a swap to a permissive model — BiRefNet is MIT, U2-Net is
  Apache-2.0, both runnable via transformers.js.

This repo has **no LICENSE file**, which defaults to all-rights-reserved and is
inconsistent with shipping AGPL-derived code. Add one:
*Add file -> Create new file -> name it `LICENSE` -> Choose a license template ->
GNU Affero General Public License v3.0*.

## Hosting

Currently GitHub Pages. GitHub's terms permit donation buttons but prohibit
running an e-commerce site or SaaS on Pages, so **migrate to Cloudflare Pages
before taking any payment**:

1. Cloudflare dashboard -> **Workers & Pages** -> **Create** -> **Pages** -> **Connect to Git**
2. Pick this repo. Framework preset **None**, build command **empty**, output directory **`/`**
3. **Custom domains** -> add `cutitoutbg.com` and `www.cutitoutbg.com`

GitHub stays the source of truth; only the serving layer changes.

## Not yet done

- **Articles.** The traffic plan depends on them and none exist. Targets:
  combine-two-photos-into-one, add-someone-to-a-photo, make-stickers-from-photos,
  transparent-png-from-photo. Do **not** target "background remover" — remove.bg,
  Canva and Adobe own it.
- **`og-image.png`** (1200x630) at repo root. The head references it; until it
  exists, shared links show no preview image.
- **Google Search Console** verification and sitemap submission.

## Still needs real-device testing

- Pointer/touch behaviour on a real iPhone and Android.
- A live AdSense unit against the page's CSP — check the console for blocked domains.
- Magic-wand tolerance tuning on real photos.
- Hi-DPI coordinate mapping.
