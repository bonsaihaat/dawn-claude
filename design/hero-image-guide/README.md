# Homepage hero — image guide for designers

Reference files for the homepage hero slider (`sections/bonsai-home.liquid`, `snippets/bonsai-hero-slide.liquid`).
The measurements come from the theme's live CSS (`assets/bonsai-theme.css`, `.bh-hero` / `.bh-slide__*`).

## Desktop (screens 820 px and wider)

| | |
|---|---|
| Export size | **1920 × 1080 px** (16:9), JPG/WebP, sRGB, ideally < 500 KB |
| Shown on site at | 1140 × 641 CSS px (1920 is ≈1.7×; on retina screens, 2400 × 1350 would be slightly sharper) |
| Headline zone (top-left, white bold text, up to 4 lines) | 845 × 480 px from the top-left corner |
| Subline chip (bottom-left, cream label covers the image) | 960 × 176 px from the bottom-left corner |
| Product / focal point | right side, x 944–1832, y 96–976 |
| Zoom-safe area (slides slowly zoom 8%) | inset 72 px left/right, 40 px top/bottom |
| Rounded corners | ≈44 px radius |
| Arrows / dots | vertical centre at each edge; bottom centre |

Do not put text, logos or prices in the image. The headline and subline are live text that the site adds.

### Files

- `hero-desktop-guide.png`: annotated reference sheet (send this to the designer)
- `hero-desktop-overlay-1920x1080.png` / `.svg`: transparent overlay; place it as the top layer in Photoshop/Figma and hide it before export
- `hero-desktop-preview-1920x1080.png`: dummy photo with the real headline, chip and controls, showing how the result looks on the site

## Mobile (screens narrower than 820 px)

| | |
|---|---|
| Export size | **1080 × 1350 px** (4:5 portrait), JPG/WebP, sRGB, ideally < 400 KB |
| Shown on site at | screen width − 40 px, e.g. 350 × 437 CSS px on a 390 px phone (≈3×) |
| Headline zone (top-left, white bold text, up to 4 lines) | 800 × 480 px from the top-left corner |
| Subline chip (bottom, full width, wraps to 2 lines) | 1080 × 230 px along the bottom |
| Product / focal point | centre, x 170–910, y 480–1100 (crown may rise into the top-right corner) |
| Zoom-safe area (slides slowly zoom 8%) | inset 40 px left/right, 50 px top/bottom |
| Rounded corners | ≈80 px radius |
| Arrows | vertical centre at each edge; no slide dots on mobile |

Zones are measured for a 390 px phone. Larger phones and tablets leave more room around the text. On a 320 px phone the headline runs about 10% wider and lower.

Upload the image in the slide's **Mobile image** field (Shopify admin → Content → Metaobjects → Hero slides). If a slide has no mobile image, phones show the desktop image cropped to 4:5 around its centre.

### Files

- `hero-mobile-guide.png`: annotated reference sheet
- `hero-mobile-overlay-1080x1350.png` / `.svg`: transparent overlay for Photoshop/Figma
- `hero-mobile-preview-1080x1350.png`: dummy photo with the real headline, chip and arrows, rendered from the site CSS at a 390 px phone width
