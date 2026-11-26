/* ==========================================================================
   KODEX Live API Adapters
   PoetryDB · Gutendex · Open Library · Jikan v4 · MangaDex · Internet Archive
   ========================================================================== */

(function (global) {
  const Kodex = (global.Kodex = global.Kodex || {});
  const { smartFetch, Proxy } = Kodex.Utils;
  const { makeBookCover } = Kodex.SampleData;

  /* ------------------------------------------------------------------------
     1. PoetryDB (https://poetrydb.org) — Direct CORS supported
     ------------------------------------------------------------------------ */
  const PoetryApi = {
    async search({ query = '', author = '' }) {
      let url = 'https://poetrydb.org/random/12';
      if (author && author !== 'random') {
        url = `https://poetrydb.org/author/${encodeURIComponent(author)}`;
      } else if (query.trim()) {
        url = `https://poetrydb.org/title/${encodeURIComponent(query.trim())}`;
      }
      const data = await smartFetch(url, { timeoutMs: 10000 });
      if (!Array.isArray(data)) return [];
      return data.slice(0, 24).map((poem, idx) => ({
        id: `poetrydb-${encodeURIComponent(poem.title)}-${idx}`,
        title: poem.title,
        author: poem.author,
        mediaType: 'poetry',
        source: 'PoetryDB',
        format: 'POEM',
        tags: ['Poetry', `${poem.linecount || poem.lines?.length || '?'} lines`],
        cover: makeBookCover(
          poem.title.slice(0, 22),
          poem.author,
          '#2e1065',
          '#78350f'
        ),
        description: `${poem.title} by ${poem.author} (${poem.linecount || poem.lines?.length || ''} lines).`,
        chapters: [
          {
            title: poem.title,
            html: `<h2>${Kodex.Utils.escapeHtml(poem.title)}</h2>
              <p><em>by ${Kodex.Utils.escapeHtml(poem.author)}</em></p>
              <div class="poem-stanza">${(poem.lines || [])
                .map((l) => Kodex.Utils.escapeHtml(l))
                .join('\n')}</div>`
          }
        ]
      }));
    }
  };

  /* ------------------------------------------------------------------------
     2. Gutendex (Project Gutenberg JSON API)
     ------------------------------------------------------------------------ */
  const GutendexApi = {
    async search({ query = '', topic = '', language = 'en', sort = 'popular', page = 1 }) {
      const params = new URLSearchParams();
      if (query.trim()) params.set('search', query.trim());
      if (topic) params.set('topic', topic);
      if (language) params.set('languages', language);
      if (sort) params.set('sort', sort);
      params.set('page', String(page));

      const data = await smartFetch(`https://gutendex.com/books/?${params.toString()}`, {
        timeoutMs: 18000
      });

      const results = (data.results || []).map((b) => {
        const authors = (b.authors || []).map((a) => a.name).join(', ') || 'Project Gutenberg';
        const formats = b.formats || {};
        const rawCover = formats['image/jpeg'] || '';
        const cover = rawCover
          ? Proxy.isLocalAvailable
            ? Proxy.wrap(rawCover)
            : rawCover
          : makeBookCover(b.title.slice(0, 22), authors, '#1e293b', '#0f766e');
        const txtUrl =
          formats['text/plain; charset=utf-8'] ||
          formats['text/plain; charset=us-ascii'] ||
          formats['text/plain'] ||
          '';
        const htmlUrl =
          formats['text/html; charset=utf-8'] ||
          formats['text/html'] ||
          '';
        const epubUrl = formats['application/epub+zip'] || '';

        return {
          id: `gutendex-${b.id}`,
          gutenbergId: b.id,
          title: b.title,
          author: authors,
          mediaType: 'books',
          source: 'Gutendex',
          format: epubUrl ? 'EPUB / TXT' : 'TXT / HTML',
          downloads: b.download_count || 0,
          tags: (b.subjects || []).slice(0, 3),
          cover,
          description: `Project Gutenberg #${b.id}. Subjects: ${(b.subjects || []).slice(0, 4).join(' · ') || 'Classic Literature'}.`,
          externalUrl: `https://www.gutenberg.org/ebooks/${b.id}`,
          readableUrls: { txtUrl, htmlUrl, epubUrl }
        };
      });

      return { items: results, hasNext: Boolean(data.next), count: data.count || results.length };
    },

    async fetchBookChapters(book) {
      const { txtUrl, epubUrl, htmlUrl } = book.readableUrls || {};
      // Prefer EPUB if proxy is active so we get full rich chapters
      if (epubUrl && Proxy.isLocalAvailable) {
        const buf = await smartFetch(epubUrl, {
          preferProxy: true,
          responseType: 'arrayBuffer',
          timeoutMs: 25000
        });
        const parsed = await Kodex.ZipParser.parseEpub(buf, `${book.title}.epub`);
        return parsed.chapters;
      }

      if (txtUrl) {
        const rawText = await smartFetch(txtUrl, {
          responseType: 'text',
          timeoutMs: 18000
        });
        return splitPlainTextIntoChapters(rawText, book.title);
      }

      if (htmlUrl) {
        const rawHtml = await smartFetch(htmlUrl, { responseType: 'text', timeoutMs: 18000 });
        return [{ title: book.title, html: Kodex.Utils.sanitizeHtml(rawHtml) }];
      }

      throw new Error('No direct readable format available without proxy.');
    }
  };

  function splitPlainTextIntoChapters(rawText, fallbackTitle) {
    const clean = String(rawText || '').replace(/\r\n/g, '\n');
    // Split into readable ~18,000 char chunks on paragraph boundaries
    const paragraphs = clean.split(/\n{2,}/);
    const chapters = [];
    let current = [];
    let charCount = 0;

    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (!trimmed) continue;
      current.push(`<p>${Kodex.Utils.escapeHtml(trimmed)}</p>`);
      charCount += trimmed.length;
      if (charCount > 14000) {
        chapters.push({
          title: `Part ${chapters.length + 1}`,
          html: current.join('\n')
        });
        current = [];
        charCount = 0;
      }
    }
    if (current.length) {
      chapters.push({
        title: chapters.length ? `Part ${chapters.length + 1}` : fallbackTitle,
        html: current.join('\n')
      });
    }
    return chapters.slice(0, 60);
  }

  /* ------------------------------------------------------------------------
     3. Open Library (https://openlibrary.org) — Direct CORS search
     ------------------------------------------------------------------------ */
  const OpenLibraryApi = {
    async search({ query = 'classic literature', page = 1 }) {
      const q = query.trim() || 'classic literature';
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&page=${page}&limit=18&fields=key,title,author_name,first_publish_year,cover_i,ia,subject,edition_count`;
      const data = await smartFetch(url, { timeoutMs: 12000 });
      const docs = (data.docs || []).map((d) => {
        const author = (d.author_name || []).slice(0, 2).join(', ') || 'Unknown Author';
        const cover = d.cover_i
          ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`
          : makeBookCover(d.title.slice(0, 22), author, '#1e1b4b', '#312e81');
        const iaId = Array.isArray(d.ia) ? d.ia[0] : '';
        return {
          id: `ol-${d.key}`,
          title: d.title,
          author,
          year: d.first_publish_year || '',
          mediaType: 'books',
          source: 'Open Library',
          format: iaId ? 'ARCHIVE / ONLINE' : 'CATALOG',
          tags: (d.subject || []).slice(0, 3),
          cover,
          iaId,
          description: `First published ${d.first_publish_year || 'unknown'}. Editions indexed: ${d.edition_count || 1}.${iaId ? ' Readable via Internet Archive integration.' : ''}`,
          externalUrl: `https://openlibrary.org${d.key}`
        };
      });
      return { items: docs, hasNext: docs.length >= 18, count: data.numFound || docs.length };
    }
  };

  /* ------------------------------------------------------------------------
     4. Jikan v4 (MyAnimeList Unofficial API) — Direct CORS supported
     ------------------------------------------------------------------------ */
  const JikanApi = {
    async search({ query = '', status = '', orderBy = 'members', page = 1 }) {
      let url;
      if (!query.trim() && !status) {
        url = `https://api.jikan.moe/v4/top/manga?page=${page}&limit=18`;
      } else {
        const params = new URLSearchParams({
          page: String(page),
          limit: '18',
          sfw: 'true'
        });
        if (query.trim()) params.set('q', query.trim());
        if (status) params.set('status', status === 'ongoing' ? 'publishing' : status === 'completed' ? 'complete' : status);
        if (orderBy === 'rating') params.set('order_by', 'score');
        else params.set('order_by', 'members');
        params.set('sort', 'desc');
        url = `https://api.jikan.moe/v4/manga?${params.toString()}`;
      }

      const res = await smartFetch(url, { timeoutMs: 18000 });
      const items = (res.data || []).map((m) => ({
        id: `jikan-${m.mal_id}`,
        malId: m.mal_id,
        title: m.title_english || m.title,
        author: (m.authors || []).map((a) => a.name).join(', ') || m.type || 'Manga',
        mediaType: 'manga',
        source: 'Jikan (MAL)',
        format: (m.type || 'MANGA').toUpperCase(),
        score: m.score ? m.score.toFixed(1) : '',
        status: m.status || '',
        year: m.published?.prop?.from?.year || '',
        tags: (m.genres || []).map((g) => g.name).slice(0, 4),
        cover: m.images?.webp?.large_image_url || m.images?.jpg?.large_image_url || '',
        description: m.synopsis || 'No synopsis provided.',
        externalUrl: m.url
      }));
      return {
        items,
        hasNext: Boolean(res.pagination?.has_next_page),
        count: res.pagination?.items?.total || items.length
      };
    }
  };

  /* ------------------------------------------------------------------------
     5. MangaDex API (https://api.mangadex.org)
     ------------------------------------------------------------------------ */
  const MangaDexApi = {
    async search({ query = '', status = '', demographic = '', sort = 'followedCount', page = 1 }) {
      const limit = 18;
      const offset = (page - 1) * limit;
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      params.append('includes[]', 'cover_art');
      params.append('includes[]', 'author');
      params.append('contentRating[]', 'safe');
      params.append('contentRating[]', 'suggestive');
      if (query.trim()) params.set('title', query.trim());
      if (status) params.append('status[]', status);
      if (demographic) params.append('publicationDemographic[]', demographic);
      params.set(`order[${sort}]`, 'desc');

      const res = await smartFetch(`https://api.mangadex.org/manga?${params.toString()}`, {
        timeoutMs: 12000
      });

      const items = (res.data || []).map((m) => {
        const attr = m.attributes || {};
        const titleObj = attr.title || {};
        const title = titleObj.en || titleObj['ja-ro'] || Object.values(titleObj)[0] || 'Untitled';
        const coverRel = (m.relationships || []).find((r) => r.type === 'cover_art');
        const authorRel = (m.relationships || []).find((r) => r.type === 'author');
        const coverFile = coverRel?.attributes?.fileName;
        const rawCover = coverFile
          ? `https://uploads.mangadex.org/covers/${m.id}/${coverFile}.256.jpg`
          : '';
        const cover = rawCover ? (Proxy.isLocalAvailable ? Proxy.wrap(rawCover) : rawCover) : '';

        return {
          id: `mangadex-${m.id}`,
          mangadexId: m.id,
          title,
          author: authorRel?.attributes?.name || attr.publicationDemographic || 'MangaDex',
          mediaType: 'manga',
          source: 'MangaDex',
          format: (attr.originalLanguage || 'JA').toUpperCase(),
          status: attr.status || '',
          year: attr.year || '',
          tags: (attr.tags || [])
            .map((t) => t.attributes?.name?.en)
            .filter(Boolean)
            .slice(0, 4),
          cover,
          description: attr.description?.en || Object.values(attr.description || {})[0] || 'No description available.',
          externalUrl: `https://mangadex.org/title/${m.id}`
        };
      });

      return { items, hasNext: (res.total || 0) > offset + limit, count: res.total || items.length };
    },

    async getChapters(mangaId) {
      const params = new URLSearchParams();
      params.set('limit', '60');
      params.append('translatedLanguage[]', 'en');
      params.set('order[chapter]', 'asc');
      params.append('includes[]', 'scanlation_group');

      const res = await smartFetch(
        `https://api.mangadex.org/manga/${mangaId}/feed?${params.toString()}`,
        { timeoutMs: 12000 }
      );
      return (res.data || [])
        .filter((ch) => !ch.attributes?.externalUrl) // keep natively readable chapters
        .map((ch) => {
          const a = ch.attributes || {};
          const group = (ch.relationships || []).find((r) => r.type === 'scanlation_group')?.attributes?.name;
          return {
            id: ch.id,
            chapterNum: a.chapter || 'One-Shot',
            title: `Ch. ${a.chapter || '?'}${a.title ? ' — ' + a.title : ''}`,
            pagesCount: a.pages || 0,
            group: group || 'Scanlation'
          };
        });
    },

    async getChapterPages(chapterId) {
      const res = await smartFetch(`https://api.mangadex.org/at-home/server/${chapterId}`, {
        timeoutMs: 12000
      });
      const base = res.baseUrl;
      const hash = res.chapter?.hash;
      const files = res.chapter?.dataSaver?.length ? res.chapter.dataSaver : res.chapter?.data || [];
      const mode = res.chapter?.dataSaver?.length ? 'data-saver' : 'data';
      return files.map((file) => {
        const directUrl = `${base}/${mode}/${hash}/${file}`;
        return Proxy.isLocalAvailable ? Proxy.wrap(directUrl) : directUrl;
      });
    }
  };

  /* ------------------------------------------------------------------------
     6. Internet Archive (Comics & Books) — Direct CORS search & metadata
     ------------------------------------------------------------------------ */
  const ArchiveApi = {
    async search({ query = '', collection = 'comics', sort = 'downloads desc', page = 1, mediaType = 'comics' }) {
      const qParts = [`mediatype:(texts)`];
      if (collection) qParts.push(`collection:(${collection})`);
      if (query.trim()) qParts.push(`(${query.trim()})`);

      const params = new URLSearchParams({
        q: qParts.join(' AND '),
        'fl[]': 'identifier,title,creator,date,downloads,avg_rating,description',
        'sort[]': sort,
        rows: '18',
        page: String(page),
        output: 'json'
      });

      const res = await smartFetch(`https://archive.org/advancedsearch.php?${params.toString()}`, {
        timeoutMs: 14000
      });
      const docs = res.response?.docs || [];
      const items = docs.map((d) => ({
        id: `ia-${d.identifier}`,
        iaId: d.identifier,
        title: d.title || d.identifier,
        author: Array.isArray(d.creator) ? d.creator.join(', ') : d.creator || 'Internet Archive',
        mediaType,
        source: 'Internet Archive',
        format: mediaType === 'comics' ? 'CBZ / ARCHIVE' : 'EPUB / ARCHIVE',
        year: d.date ? String(d.date).slice(0, 4) : '',
        score: d.avg_rating ? Number(d.avg_rating).toFixed(1) : '',
        downloads: d.downloads || 0,
        tags: [collection, 'Public Domain'],
        cover: `https://archive.org/services/img/${encodeURIComponent(d.identifier)}`,
        description: Array.isArray(d.description) ? d.description[0] : d.description || 'Public domain item hosted on Internet Archive.',
        externalUrl: `https://archive.org/details/${encodeURIComponent(d.identifier)}`
      }));

      return { items, hasNext: docs.length >= 18, count: res.response?.numFound || items.length };
    },

    async inspectItemFiles(iaId) {
      const meta = await smartFetch(`https://archive.org/metadata/${encodeURIComponent(iaId)}`, {
        timeoutMs: 14000
      });
      const files = (meta.files || []).filter((f) =>
        /\.(cbz|epub|pdf|txt)$/i.test(f.name)
      );
      return {
        files: files.map((f) => ({
          name: f.name,
          format: f.format || f.name.split('.').pop().toUpperCase(),
          sizeMb: f.size ? (Number(f.size) / (1024 * 1024)).toFixed(1) : '?',
          url: `https://archive.org/download/${encodeURIComponent(iaId)}/${encodeURIComponent(f.name)}`
        })),
        embedUrl: `https://archive.org/embed/${encodeURIComponent(iaId)}`
      };
    }
  };

  Kodex.Apis = {
    PoetryApi,
    GutendexApi,
    OpenLibraryApi,
    JikanApi,
    MangaDexApi,
    ArchiveApi
  };
})(window);
