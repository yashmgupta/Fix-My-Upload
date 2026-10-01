# Fix My Upload — V3 GitHub-ready

**Concept & implementation © 2026 Yash M Gupta. All rights reserved.**

A privacy-first static web app that checks and adjusts images to match upload requirements such as JPG, 35–50 KB, 100 KB, 2 MB, or 300 × 400 px.

## V3 launch additions
- `sitemap.xml`
- `robots.txt`
- self-canonical URL generated automatically during GitHub Pages deployment
- Open Graph + Twitter social metadata
- `WebApplication` JSON-LD structured data
- `site.webmanifest`
- favicon + 192/512 PWA icons
- 1200×630 social preview image
- `404.html` with `noindex`
- `.nojekyll`
- GitHub Actions Pages deployment workflow
- visible search-focused explanatory copy without keyword stuffing
- copyright / ownership notice for Yash M Gupta
- All Rights Reserved `LICENSE.txt`

## Deploy on GitHub Pages
1. Create a GitHub repository and copy all files from this folder into it.
2. Use `main` as the default branch.
3. Push the repository.
4. In **Settings → Pages**, set the build/deployment source to **GitHub Actions** if GitHub does not select it automatically.
5. The included workflow calculates the correct GitHub Pages URL from the repository owner/name, replaces `__SITE_URL__` in the canonical tag, Open Graph metadata, JSON-LD, `robots.txt`, `sitemap.xml`, and the 404 link, then deploys the finished site.

This works both for:
- `https://USERNAME.github.io/REPOSITORY/`
- a user site repository named `USERNAME.github.io`

## After the site is live: Google Search Console
Technical SEO files make the site crawlable and understandable, but **they do not guarantee rankings**.

After deployment:
1. Add the live URL to Google Search Console.
2. Use **URL Inspection** on the homepage and request indexing.
3. Submit `sitemap.xml` in the Sitemaps report.
4. Validate the page in Google Rich Results Test.
5. Monitor queries and impressions before adding more search landing pages.

## Local test
```bash
python -m http.server 8000
```
Open `http://localhost:8000`.

`__SITE_URL__` is intentionally left as a template in the source repository. The GitHub Actions workflow replaces it only in the deployed `_site` artifact, so you do not need to know the final GitHub username/repository URL in advance.

## V3 processing support
- Input: JPG, PNG, WebP
- Output: JPG, PNG, WebP
- Thai/English requirement parsing for common format, min/max/range size, and exact pixel dimensions
- Paste mode always converts text into editable structured rules before processing
- Manual Select mode remains the fallback for unusual wording
- Browser-only processing; no image backend required

## Copyright
See `LICENSE.txt`. The repository is **not open source** unless the copyright holder grants a separate license.
