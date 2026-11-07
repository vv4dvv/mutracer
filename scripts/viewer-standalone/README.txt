MuTracer Viewer — standalone build (0.3.1)
=========================================

Run
  1. Install Node.js 18 or newer (https://nodejs.org/) if it is not installed yet.
  2. Double-click "打开查看器.bat".
  3. The browser opens http://127.0.0.1:8080/ automatically.
  4. Close the console window (or press Ctrl+C) to stop it.

Why a local server instead of opening index.html
  Browsers block ES modules, Web Workers, WebAssembly and fetch() on file://
  URLs, so the viewer has to be served over http.

Other ways to serve this folder
  node serve.mjs [folder] [port]
  python -m http.server 8080 --bind 127.0.0.1
  Any static host (GitHub Pages, Netlify, nginx, ...) works too: upload the
  whole folder, index.html is the entry point. Serve it from the site root:
  the large OIDN networks are fetched from /oidn/weights/.

Notes
  - WebGPU needs a current Chrome/Edge (or Safari 18+). Without it the viewer
    falls back to WebGL 2.
  - Sample models, Poly Haven HDRIs and textures are downloaded on demand, so
    those need internet access. The interface and locally opened files work
    offline.
  - OIDN denoising weights are included in oidn/weights/.
  - Port 8080 is used by default; if it is busy the next free port is chosen and
    printed in the console window.
