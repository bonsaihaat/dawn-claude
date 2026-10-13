# Homepage hero — image guide for designers

Reference files for the homepage hero slider (`sections/bonsai-home.liquid`, `snippets/bonsai-hero-slide.liquid`).
The measurements come from the theme's live CSS (`assets/bonsai-theme.css`, `.bh-hero` / `.bh-slide__*`).

## Desktop (screens 820 px and wider)

| | |
|---|---|
| Export size | **2400 × 1350 px** (16:9), JPG/WebP, sRGB, ideally < 500 KB |
| Shown on site at | 1140 × 641 CSS px (≈2.1× for sharp retina) |
| Headline zone (top-left, white bold text, up to 4 lines) | 1056 × 600 px from the top-left corner |
| Subline chip (bottom-left, cream label covers the image) | 1200 × 220 px from the bottom-left corner |
| Product / focal point | right side, x 1180–2290, y 120–1220 |
| Zoom-safe area (slides slowly zoom 8%) | inset 90 px left/right, 50 px top/bottom |
| Rounded corners | ≈55 px radius |
| Arrows / dots | vertical centre at each edge; bottom centre |

Do not put text, logos or prices in the image. The headline and subline are live text that the site adds.

### Files

- `hero-desktop-guide.png`: annotated reference sheet (send this to the designer)
- `hero-desktop-overlay-2400x1350.png` / `.svg`: transparent overlay; place it as the top layer in Photoshop/Figma and hide it before export
- `hero-desktop-preview-2400x1350.png`: dummy photo with the real headline, chip and controls, showing how the result looks on the site

## Mobile

To follow. Below 820 px the hero is 4:5. If a slide has no separate mobile image, the desktop image is cropped to 4:5 around its centre.
