# Fix My Upload

A privacy-first browser tool for fixing image upload issues without sending files to a server.

This app helps you check and adjust images to meet upload requirements such as:

- JPG / PNG / WebP conversion
- file size limits like 35 KB, 100 KB, 2 MB, etc.
- exact pixel dimensions such as 300 × 400 px
- local browser-based processing only

## Features

- Upload JPG, PNG, or WebP images
- Detect common upload requirements from pasted website text
- Manually edit the detected rules before processing
- Convert format, resize dimensions, and optimize file size
- Keep work entirely in the browser
- Download a processed image ready for upload

## How it works

1. Choose an image file.
2. Paste the upload requirement from the website, or select the rules manually.
3. Review the detected conditions.
4. Click "Fix my file" to process the image locally.
5. Download the corrected image.

## Local development

Run a local web server in the project root:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## GitHub Pages deployment

This project is designed to work well on GitHub Pages as a static site.

1. Push the repository to GitHub.
2. Open the repository settings.
3. Go to Pages.
4. Set the deployment source to GitHub Actions if needed.
5. Deploy and open the generated Pages URL.

The project includes metadata and SEO support files such as:

- `robots.txt`
- `sitemap.xml`
- `site.webmanifest`
- `404.html`
- `favicon.svg`
- social preview metadata

## Privacy

Files are processed locally in the browser. Nothing is uploaded to a backend server.

## Project structure

```text
.
├── app.js
├── index.html
├── styles.css
├── README.md
├── robots.txt
├── sitemap.xml
├── site.webmanifest
├── 404.html
├── favicon.svg
├── icon-192.png
├── icon-512.png
├── og-image.png
├── LICENSE.txt
└── .nojekyll
```

## License

This repository is protected by copyright. See `LICENSE.txt` for details.

## Notes

This app is intended for image-processing workflows and is optimized for browser-based upload requirements rather than server-side processing.
