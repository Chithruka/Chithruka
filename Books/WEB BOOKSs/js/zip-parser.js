/* ==========================================================================
   KODEX Zero-Dependency Client-Side ZIP, CBZ & EPUB Parser
   Uses native browser DecompressionStream('deflate-raw') + DataView
   ========================================================================== */

(function (global) {
  const Kodex = (global.Kodex = global.Kodex || {});

  function readUint16(view, offset) {
    return view.getUint16(offset, true);
  }

  function readUint32(view, offset) {
    return view.getUint32(offset, true);
  }

  async function inflateRaw(compressedBytes) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('This browser does not support native DecompressionStream for compressed EPUB/CBZ files.');
    }
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([compressedBytes]).stream().pipeThrough(ds);
    const buffer = await new Response(stream).arrayBuffer();
    return new Uint8Array(buffer);
  }

  async function parseZip(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);

    // Find End of Central Directory (EOCD) signature 0x06054b50
    let eocdOffset = -1;
    const minSearch = Math.max(0, bytes.length - 65557);
    for (let i = bytes.length - 22; i >= minSearch; i--) {
      if (readUint32(view, i) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset < 0) {
      throw new Error('Invalid ZIP/CBZ/EPUB archive (missing EOCD header).');
    }

    const totalEntries = readUint16(view, eocdOffset + 10);
    const cdOffset = readUint32(view, eocdOffset + 16);
    const decoder = new TextDecoder('utf-8');

    const entries = new Map();
    let ptr = cdOffset;

    for (let idx = 0; idx < totalEntries; idx++) {
      if (readUint32(view, ptr) !== 0x02014b50) break;
      const method = readUint16(view, ptr + 10);
      const compSize = readUint32(view, ptr + 20);
      const uncompSize = readUint32(view, ptr + 24);
      const nameLen = readUint16(view, ptr + 28);
      const extraLen = readUint16(view, ptr + 30);
      const commentLen = readUint16(view, ptr + 32);
      const localHeaderOffset = readUint32(view, ptr + 42);

      const fileName = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
      ptr += 46 + nameLen + extraLen + commentLen;

      if (fileName.endsWith('/')) continue;

      entries.set(fileName, {
        name: fileName,
        method,
        compSize,
        uncompSize,
        localHeaderOffset,
        async getBytes() {
          const lh = this.localHeaderOffset;
          if (readUint32(view, lh) !== 0x04034b50) {
            throw new Error(`Corrupt entry header for ${this.name}`);
          }
          const lhNameLen = readUint16(view, lh + 26);
          const lhExtraLen = readUint16(view, lh + 28);
          const dataStart = lh + 30 + lhNameLen + lhExtraLen;
          const slice = bytes.subarray(dataStart, dataStart + this.compSize);
          if (this.method === 0) return slice;
          if (this.method === 8) return inflateRaw(slice);
          throw new Error(`Unsupported ZIP compression method (${this.method}) for ${this.name}`);
        },
        async getText() {
          const data = await this.getBytes();
          return new TextDecoder('utf-8').decode(data);
        },
        async getBlobUrl(mime = '') {
          const data = await this.getBytes();
          const blob = new Blob([data], mime ? { type: mime } : undefined);
          return URL.createObjectURL(blob);
        }
      });
    }

    return entries;
  }

  function guessMime(path) {
    const ext = path.split('.').pop().toLowerCase();
    const map = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      avif: 'image/avif'
    };
    return map[ext] || 'application/octet-stream';
  }

  function resolveRelativePath(baseDir, relPath) {
    const cleanRel = decodeURIComponent(relPath.split('#')[0].split('?')[0]);
    if (!baseDir) return cleanRel.replace(/^\.\//, '');
    const stack = baseDir.split('/').filter(Boolean);
    for (const part of cleanRel.split('/')) {
      if (part === '.' || part === '') continue;
      if (part === '..') stack.pop();
      else stack.push(part);
    }
    return stack.join('/');
  }

  /* Extract CBZ comic/manga pages in natural sort order */
  async function parseCbz(arrayBuffer, fileName = 'Comic.cbz') {
    const entries = await parseZip(arrayBuffer);
    const imageRegex = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
    const imageEntries = Array.from(entries.values())
      .filter((e) => imageRegex.test(e.name) && !e.name.startsWith('__MACOSX'))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    if (!imageEntries.length) {
      throw new Error('No image pages found inside this CBZ archive.');
    }

    const pages = [];
    for (const entry of imageEntries) {
      pages.push(await entry.getBlobUrl(guessMime(entry.name)));
    }

    return {
      title: fileName.replace(/\.(cbz|zip)$/i, ''),
      pages,
      cover: pages[0]
    };
  }

  /* Extract EPUB metadata, cover, spine chapters & inline images */
  async function parseEpub(arrayBuffer, fileName = 'Book.epub') {
    const entries = await parseZip(arrayBuffer);
    const containerEntry = entries.get('META-INF/container.xml');
    if (!containerEntry) {
      throw new Error('Invalid EPUB: missing META-INF/container.xml');
    }

    const parser = new DOMParser();
    const containerXml = parser.parseFromString(await containerEntry.getText(), 'application/xml');
    const rootfileEl = containerXml.querySelector('rootfile');
    const opfPath = rootfileEl ? rootfileEl.getAttribute('full-path') : '';
    const opfEntry = entries.get(opfPath);
    if (!opfEntry) {
      throw new Error(`Invalid EPUB: missing OPF manifest (${opfPath})`);
    }

    const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';
    const opfDoc = parser.parseFromString(await opfEntry.getText(), 'application/xml');

    const title =
      opfDoc.querySelector('metadata title, dc\\:title')?.textContent?.trim() ||
      fileName.replace(/\.epub$/i, '');
    const author =
      opfDoc.querySelector('metadata creator, dc\\:creator')?.textContent?.trim() || 'Unknown Author';
    const description =
      opfDoc.querySelector('metadata description, dc\\:description')?.textContent?.trim() || '';

    const manifest = new Map();
    opfDoc.querySelectorAll('manifest > item').forEach((item) => {
      manifest.set(item.getAttribute('id'), {
        id: item.getAttribute('id'),
        href: item.getAttribute('href'),
        mediaType: item.getAttribute('media-type') || ''
      });
    });

    // Cover image detection
    let coverUrl = '';
    const coverMeta = opfDoc.querySelector('meta[name="cover"]');
    let coverItem = coverMeta ? manifest.get(coverMeta.getAttribute('content')) : null;
    if (!coverItem) {
      for (const item of manifest.values()) {
        if (/cover/i.test(item.id) && item.mediaType.startsWith('image/')) {
          coverItem = item;
          break;
        }
      }
    }
    if (coverItem) {
      const coverPath = resolveRelativePath(opfDir, coverItem.href);
      const coverEntry = entries.get(coverPath);
      if (coverEntry) coverUrl = await coverEntry.getBlobUrl(coverItem.mediaType);
    }

    // Build image Blob URL cache so XHTML <img> references render cleanly
    const imageUrlCache = new Map();
    for (const [path, entry] of entries.entries()) {
      if (/\.(jpe?g|png|webp|gif|svg)$/i.test(path)) {
        imageUrlCache.set(path, await entry.getBlobUrl(guessMime(path)));
      }
    }

    // Spine chapter extraction
    const spineIds = Array.from(opfDoc.querySelectorAll('spine > itemref')).map((ref) =>
      ref.getAttribute('idref')
    );

    const chapters = [];
    for (let i = 0; i < spineIds.length; i++) {
      const item = manifest.get(spineIds[i]);
      if (!item) continue;
      const chapPath = resolveRelativePath(opfDir, item.href);
      const chapDir = chapPath.includes('/') ? chapPath.slice(0, chapPath.lastIndexOf('/')) : '';
      const entry = entries.get(chapPath);
      if (!entry) continue;

      const rawXml = await entry.getText();
      const doc = parser.parseFromString(rawXml, 'text/html');
      const body = doc.body || doc.documentElement;

      // Resolve relative <img> src and SVG <image> xlink:href / href
      body.querySelectorAll('img').forEach((img) => {
        const src = img.getAttribute('src');
        if (src && !src.startsWith('http') && !src.startsWith('data:')) {
          const resolved = resolveRelativePath(chapDir, src);
          if (imageUrlCache.has(resolved)) img.setAttribute('src', imageUrlCache.get(resolved));
        }
      });

      const headingText =
        body.querySelector('h1, h2, h3, title')?.textContent?.trim() || `Section ${i + 1}`;
      const cleanHtml = Kodex.Utils.sanitizeHtml(body.innerHTML);
      if (body.textContent.trim().length > 0 || body.querySelector('img')) {
        chapters.push({
          title: headingText.slice(0, 80),
          html: cleanHtml
        });
      }
    }

    if (!chapters.length) {
      throw new Error('Could not extract readable chapters from this EPUB.');
    }

    return {
      title,
      author,
      description,
      cover: coverUrl,
      chapters
    };
  }

  Kodex.ZipParser = {
    parseCbz,
    parseEpub
  };
})(window);
