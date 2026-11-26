# KODEX — Unified Books, Comics & Manga Web Reader

**KODEX** is a zero-dependency HTML, CSS, and JavaScript web application for discovering and reading **Books, Poetry, Comics, and Manga** in one unified interface.

## Design & Ecosystem Inspiration
- **Z-Library (`z-lib.gd`)**: Multi-format cataloging (`EPUB`, `PDF`, `TXT`, `CBZ`), advanced search filters, inline search operators (`author:Poe`, `type:manga`), and personal reading shelves.
- **Kagane (`kagane.moe`) & Toonkotsu (`toonkotsu.com`)**: Ad-free multi-source aggregator UX, demographic/status filtering, library JSON/CSV portability, and a high-control visual reader with **RTL**, **LTR**, **Single Page**, **Double-Page Spread**, and **Webtoon Long-Strip** modes.

## Integrated Open APIs
- **PoetryDB** (`poetrydb.org`) — Live CORS-enabled classic poetry search and poet anthologies.
- **Jikan v4** (`api.jikan.moe`) — MyAnimeList manga discovery, scores, genres, and synopses.
- **MangaDex** (`api.mangadex.org`) — Manga search, chapter feeds, and page streaming.
- **Gutendex** (`gutendex.com`) — Project Gutenberg public-domain eBook catalog.
- **Open Library** (`openlibrary.org`) — Open catalog search, covers, and Internet Archive links.
- **Internet Archive** (`archive.org`) — Golden/Silver Age public domain comics, vintage books, `.cbz`/`.epub`/`.pdf` inspection, and embedded BookReader.

## Local File Reader (Zero Dependencies)
Drag and drop or click **Open File** to read directly in your browser without uploading anything:
- `.epub` (parsed natively in JS via `DecompressionStream` + OPF/XHTML/image extraction)
- `.cbz` (unpacked natively into ordered comic/manga pages)
- `.pdf` (rendered in native browser viewer)
- `.txt`, `.md`, `.html`
- Multi-image folders/selections (automatically sorted as manga/comic pages)

## Running the Project
1. **Standalone**: Double-click `index.html` to open directly in Chrome, Edge, or Firefox.
2. **With Optional Local Proxy (Recommended for MangaDex chapter images & Archive/Gutenberg binary streams)**:
   Double-click `start-server.bat` (uses Windows PowerShell, no Node.js or Python needed) and visit `http://localhost:8080`.
