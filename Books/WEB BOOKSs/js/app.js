/* ==========================================================================
   KODEX Main Application Controller
   ========================================================================== */

(function (global) {
  const Kodex = (global.Kodex = global.Kodex || {});
  const {
    $,
    $$,
    escapeHtml,
    toast,
    markdownToHtml,
    parseSearchQuery,
    getPrefs,
    savePrefs,
    Store,
    Proxy,
    smartFetch,
    renderSkeletons
  } = Kodex.Utils;
  const { SAMPLE_CATALOG, makeBookCover } = Kodex.SampleData;
  const { PoetryApi, GutendexApi, OpenLibraryApi, JikanApi, MangaDexApi, ArchiveApi } = Kodex.Apis;

  const state = {
    currentView: 'discover',
    bookSource: 'gutendex',
    bookPage: 1,
    mangaSource: 'mangadex',
    mangaPage: 1,
    comicCollection: 'comics',
    comicPage: 1,
    libraryFilter: 'all',
    localItems: [], // in-memory uploaded files for this session
    itemCache: new Map(), // id -> item object
    activeReaderType: null, // 'book' | 'visual'
    activeReaderItem: null
  };

  /* ------------------------------------------------------------------------
     Card Renderer
     ------------------------------------------------------------------------ */
  function cacheItem(item) {
    state.itemCache.set(item.id, item);
    return item;
  }

  function renderCard(item, progressOverride = null) {
    cacheItem(item);
    const prog = progressOverride || Store.getProgress(item.id);
    const badgeClass = `badge-${item.mediaType || 'books'}`;
    const coverHtml = item.cover
      ? `<img class="card-cover" src="${escapeHtml(item.cover)}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.classList.remove('hidden');" />
         <div class="card-cover-fallback hidden">
           <span class="fallback-type">${escapeHtml(item.mediaType || 'READ')}</span>
           <span class="fallback-title">${escapeHtml(item.title)}</span>
           <span style="font-size:0.75rem;opacity:0.7;">${escapeHtml(item.author || '')}</span>
         </div>`
      : `<div class="card-cover-fallback">
           <span class="fallback-type">${escapeHtml(item.mediaType || 'READ')}</span>
           <span class="fallback-title">${escapeHtml(item.title)}</span>
           <span style="font-size:0.75rem;opacity:0.7;">${escapeHtml(item.author || '')}</span>
         </div>`;

    return `
      <article class="media-card" data-item-id="${escapeHtml(item.id)}" tabindex="0">
        <div class="card-cover-wrap">
          ${coverHtml}
          <div class="card-badges">
            <span class="badge-type ${badgeClass}">${escapeHtml(item.format || item.mediaType)}</span>
            ${item.score ? `<span class="badge-score">★ ${escapeHtml(item.score)}</span>` : ''}
          </div>
          ${
            prog && prog.percent > 0
              ? `<div class="card-progress-bar"><div class="card-progress-fill" style="width:${Math.min(100, prog.percent)}%"></div></div>`
              : ''
          }
        </div>
        <div class="card-body">
          <h3 class="card-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h3>
          <div class="card-author">${escapeHtml(item.author || 'Unknown')}</div>
          <div class="card-meta-row">
            <span>${escapeHtml(item.source || '')}</span>
            <span>${prog?.label ? escapeHtml(prog.label) : escapeHtml(item.year || '')}</span>
          </div>
        </div>
      </article>
    `;
  }

  function renderGrid(container, items, emptyTitle = 'No results found', emptySub = 'Try a different query or filter.') {
    if (!container) return;
    if (!items || !items.length) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>${escapeHtml(emptyTitle)}</h3>
          <p>${escapeHtml(emptySub)}</p>
        </div>`;
      return;
    }
    container.innerHTML = items.map((item) => renderCard(item)).join('');
  }

  /* ------------------------------------------------------------------------
     Navigation & View Switching
     ------------------------------------------------------------------------ */
  function switchView(viewName) {
    state.currentView = viewName;
    window.scrollTo({ top: 0, behavior: 'instant' });
    $$('.nav-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.view === viewName);
    });
    $$('.view-section').forEach((sec) => {
      sec.classList.toggle('active', sec.id === `view-${viewName}`);
    });

    if (viewName === 'books' && !$('#booksResultsGrid').children.length) {
      loadBooks();
    } else if (viewName === 'manga' && !$('#mangaResultsGrid').children.length) {
      loadManga();
    } else if (viewName === 'comics' && !$('#comicsResultsGrid').children.length) {
      loadComics();
    } else if (viewName === 'library') {
      renderLibraryView();
    }
  }

  /* ------------------------------------------------------------------------
     Discover View
     ------------------------------------------------------------------------ */
  async function initDiscover() {
    renderContinueReading();
    renderGrid($('#instantShowcaseGrid'), SAMPLE_CATALOG);

    // Load live shelves concurrently without blocking UI
    loadDiscoverShelf('manga');
    loadDiscoverShelf('books');
    loadDiscoverShelf('comics');
  }

  function renderContinueReading() {
    const history = Store.getHistory();
    const block = $('#continueReadingBlock');
    const grid = $('#continueReadingGrid');
    if (!history.length) {
      block.classList.add('hidden');
      return;
    }
    block.classList.remove('hidden');
    grid.innerHTML = history
      .slice(0, 10)
      .map((h) => renderCard(h, h.progress))
      .join('');
  }

  async function loadDiscoverShelf(type) {
    if (type === 'manga') {
      const grid = $('#discoverMangaGrid');
      renderSkeletons(grid, 6);
      try {
        const res = await JikanApi.search({ page: 1 });
        renderGrid(grid, res.items.slice(0, 6));
      } catch {
        // Fallback to MangaDex, then Internet Archive manga, then built-in sample
        try {
          const res = await MangaDexApi.search({ page: 1 });
          renderGrid(grid, res.items.slice(0, 6));
        } catch {
          try {
            const res = await ArchiveApi.search({ query: 'manga', collection: 'comics', page: 1, mediaType: 'manga' });
            renderGrid(grid, res.items.slice(0, 6));
          } catch {
            renderGrid(
              grid,
              SAMPLE_CATALOG.filter((x) => x.mediaType === 'manga'),
              'Live Manga feed offline',
              'Showing built-in demo manga.'
            );
          }
        }
      }
    } else if (type === 'books') {
      const grid = $('#discoverBooksGrid');
      renderSkeletons(grid, 6);
      try {
        const res = await GutendexApi.search({ page: 1 });
        renderGrid(grid, res.items.slice(0, 6));
      } catch {
        try {
          const res = await OpenLibraryApi.search({ query: 'science fiction', page: 1 });
          renderGrid(grid, res.items.slice(0, 6));
        } catch {
          renderGrid(
            grid,
            SAMPLE_CATALOG.filter((x) => x.mediaType === 'books' || x.mediaType === 'poetry')
          );
        }
      }
    } else if (type === 'comics') {
      const grid = $('#discoverComicsGrid');
      renderSkeletons(grid, 6);
      try {
        const res = await ArchiveApi.search({ collection: 'comics', page: 1, mediaType: 'comics' });
        renderGrid(grid, res.items.slice(0, 6));
      } catch {
        renderGrid(
          grid,
          SAMPLE_CATALOG.filter((x) => x.mediaType === 'comics')
        );
      }
    }
  }

  /* ------------------------------------------------------------------------
     Books & Poetry View
     ------------------------------------------------------------------------ */
  async function loadBooks(page = 1) {
    state.bookPage = page;
    const grid = $('#booksResultsGrid');
    const status = $('#booksStatusBar');
    const pag = $('#booksPagination');
    const query = $('#booksQueryInput').value;
    const topic = $('#booksTopicSelect').value;
    const language = $('#booksLangSelect').value;
    const sort = $('#booksSortSelect').value;

    renderSkeletons(grid, 6);
    status.textContent = `Fetching from ${state.bookSource}...`;
    pag.innerHTML = '';

    try {
      let items = [];
      let hasNext = false;
      let totalLabel = '';

      if (state.bookSource === 'poetrydb') {
        items = await PoetryApi.search({ query, author: state.selectedPoet || '' });
        totalLabel = `${items.length} poems loaded from PoetryDB`;
      } else if (state.bookSource === 'openlibrary') {
        const res = await OpenLibraryApi.search({ query: query || topic || 'classic', page });
        items = res.items;
        hasNext = res.hasNext;
        totalLabel = `${res.count.toLocaleString()} indexed works on Open Library`;
      } else if (state.bookSource === 'archive_books') {
        const res = await ArchiveApi.search({
          query: query || topic,
          collection: 'opensource',
          sort: 'downloads desc',
          page,
          mediaType: 'books'
        });
        items = res.items;
        hasNext = res.hasNext;
        totalLabel = `${res.count.toLocaleString()} items on Internet Archive`;
      } else {
        const res = await GutendexApi.search({ query, topic, language, sort, page });
        items = res.items;
        hasNext = res.hasNext;
        totalLabel = `${res.count.toLocaleString()} public domain books on Gutendex`;
      }

      status.textContent = totalLabel;
      renderGrid(grid, items);
      renderPagination(pag, page, hasNext, (p) => loadBooks(p));
    } catch (err) {
      status.textContent = `Could not reach ${state.bookSource}: ${err.message}`;
      renderGrid(
        grid,
        [],
        'Source temporarily unreachable',
        'Try switching to Open Library, PoetryDB, or Internet Archive tabs above, or read local EPUB/TXT files.'
      );
    }
  }

  /* ------------------------------------------------------------------------
     Manga View
     ------------------------------------------------------------------------ */
  async function loadManga(page = 1) {
    state.mangaPage = page;
    const grid = $('#mangaResultsGrid');
    const status = $('#mangaStatusBar');
    const pag = $('#mangaPagination');
    const query = $('#mangaQueryInput').value;
    const statusFilter = $('#mangaStatusSelect').value;
    const demographic = $('#mangaDemoSelect').value;
    const sort = $('#mangaSortSelect').value;

    renderSkeletons(grid, 6);
    status.textContent = `Querying ${state.mangaSource === 'jikan' ? 'Jikan (MAL)' : 'MangaDex'}...`;
    pag.innerHTML = '';

    try {
      let res;
      if (state.mangaSource === 'jikan') {
        res = await JikanApi.search({ query, status: statusFilter, orderBy: sort, page });
      } else {
        res = await MangaDexApi.search({ query, status: statusFilter, demographic, sort, page });
      }
      status.textContent = `${res.count.toLocaleString()} titles found via ${state.mangaSource === 'jikan' ? 'Jikan (MAL)' : 'MangaDex'}`;
      renderGrid(grid, res.items);
      renderPagination(pag, page, res.hasNext, (p) => loadManga(p));
    } catch (err) {
      status.textContent = `Error loading ${state.mangaSource}: ${err.message}`;
      renderGrid(
        grid,
        [],
        'Manga source error',
        'Try switching between MangaDex Live and Jikan (MyAnimeList), or drop a local .CBZ manga archive.'
      );
    }
  }

  /* ------------------------------------------------------------------------
     Comics View
     ------------------------------------------------------------------------ */
  async function loadComics(page = 1) {
    state.comicPage = page;
    const grid = $('#comicsResultsGrid');
    const status = $('#comicsStatusBar');
    const pag = $('#comicsPagination');
    const query = $('#comicsQueryInput').value;
    const sort = $('#comicsSortSelect').value;

    renderSkeletons(grid, 6);
    status.textContent = `Searching Internet Archive (${state.comicCollection})...`;
    pag.innerHTML = '';

    try {
      const res = await ArchiveApi.search({
        query,
        collection: state.comicCollection,
        sort,
        page,
        mediaType: 'comics'
      });
      status.textContent = `${res.count.toLocaleString()} archived issues found`;
      renderGrid(grid, res.items);
      renderPagination(pag, page, res.hasNext, (p) => loadComics(p));
    } catch (err) {
      status.textContent = `Archive error: ${err.message}`;
      renderGrid(grid, [], 'Internet Archive unreachable', 'Check network or drop a local .CBZ comic file.');
    }
  }

  function renderPagination(container, currentPage, hasNext, onPage) {
    if (currentPage <= 1 && !hasNext) {
      container.innerHTML = '';
      return;
    }
    container.innerHTML = `
      <button class="btn btn-secondary btn-sm" id="pgPrev" ${currentPage <= 1 ? 'disabled' : ''}>← Previous</button>
      <span style="font-family:var(--font-mono);font-size:0.82rem;color:var(--text-secondary);">Page ${currentPage}</span>
      <button class="btn btn-secondary btn-sm" id="pgNext" ${!hasNext ? 'disabled' : ''}>Next →</button>
    `;
    const prev = $('#pgPrev', container);
    const next = $('#pgNext', container);
    if (prev) prev.onclick = () => onPage(currentPage - 1);
    if (next) next.onclick = () => onPage(currentPage + 1);
  }

  /* ------------------------------------------------------------------------
     Library View & JSON/CSV Import/Export
     ------------------------------------------------------------------------ */
  function updateLibraryBadge() {
    $('#libraryCountBadge').textContent = String(Store.getLibrary().length);
  }

  function renderLibraryView() {
    const grid = $('#libraryGrid');
    const filter = state.libraryFilter;
    let items = [];

    if (filter === 'history') {
      items = Store.getHistory();
    } else if (filter === 'local') {
      items = state.localItems;
    } else {
      const lib = Store.getLibrary();
      items = filter === 'all' ? lib : lib.filter((x) => x.shelf === filter);
    }

    renderGrid(
      grid,
      items,
      'Your shelf is empty',
      filter === 'local'
        ? 'Drag and drop any .EPUB, .CBZ, .PDF, .TXT, or .MD file to read locally.'
        : 'Bookmark any book, manga, or comic to organize it here.'
    );
  }

  /* ------------------------------------------------------------------------
     Detail Modal & Launching Readers
     ------------------------------------------------------------------------ */
  async function openDetailModal(itemId) {
    let item = state.itemCache.get(itemId) || Store.getItem(itemId);
    if (!item) {
      item = Store.getHistory().find((h) => h.id === itemId);
    }
    if (!item) return;

    const modal = $('#detailModal');
    const body = $('#detailBody');
    modal.classList.remove('hidden');

    const savedEntry = Store.getItem(item.id);
    const currentShelf = savedEntry?.shelf || '';

    body.innerHTML = `
      <div class="detail-hero">
        <img class="detail-cover" src="${escapeHtml(item.cover || '')}" alt="${escapeHtml(item.title)}" onerror="this.style.visibility='hidden'" />
        <div class="detail-info">
          <div style="display:flex;flex-wrap:wrap;gap:0.4rem;">
            <span class="tag tag-accent">${escapeHtml(item.format || item.mediaType)}</span>
            <span class="tag tag-outline">${escapeHtml(item.source)}</span>
            ${item.score ? `<span class="tag tag-outline">★ ${escapeHtml(item.score)}</span>` : ''}
            ${item.status ? `<span class="tag tag-outline">${escapeHtml(item.status)}</span>` : ''}
          </div>
          <h2 id="detailTitle">${escapeHtml(item.title)}</h2>
          <div class="detail-author">${escapeHtml(item.author || 'Unknown')} ${item.year ? `· ${escapeHtml(item.year)}` : ''}</div>
          <div class="detail-tags">
            ${(item.tags || []).map((t) => `<span class="chip-sm">${escapeHtml(t)}</span>`).join('')}
          </div>
          <p class="detail-desc">${escapeHtml(item.description || 'No description available.')}</p>
          <div class="detail-actions">
            <button id="detailPrimaryReadBtn" class="btn btn-primary">Read Now</button>
            <select id="detailShelfSelect" class="search-scope" aria-label="Library Shelf">
              <option value="">+ Save to Shelf...</option>
              <option value="reading" ${currentShelf === 'reading' ? 'selected' : ''}>Reading</option>
              <option value="plan" ${currentShelf === 'plan' ? 'selected' : ''}>Plan to Read</option>
              <option value="completed" ${currentShelf === 'completed' ? 'selected' : ''}>Completed</option>
            </select>
            ${
              currentShelf
                ? `<button id="detailRemoveLibBtn" class="btn btn-danger-ghost btn-sm">Remove</button>`
                : ''
            }
            ${
              item.externalUrl
                ? `<a class="btn btn-ghost btn-sm" href="${escapeHtml(item.externalUrl)}" target="_blank" rel="noopener noreferrer">Source Page ↗</a>`
                : ''
            }
          </div>
        </div>
      </div>
      <div id="detailExtraPanel" class="chapter-list-panel"></div>
    `;

    $('#detailShelfSelect').onchange = (e) => {
      const shelf = e.target.value;
      if (!shelf) return;
      Store.upsertLibrary(item, shelf);
      updateLibraryBadge();
      toast(`Saved to "${shelf}" shelf!`);
      openDetailModal(item.id);
    };

    const removeBtn = $('#detailRemoveLibBtn');
    if (removeBtn) {
      removeBtn.onclick = () => {
        Store.removeLibrary(item.id);
        updateLibraryBadge();
        toast('Removed from library.');
        openDetailModal(item.id);
      };
    }

    const extra = $('#detailExtraPanel');
    const primaryBtn = $('#detailPrimaryReadBtn');

    // Contextual Chapter / File Inspector
    if (item.chapters?.length) {
      primaryBtn.onclick = () => launchBookReader(item, 0);
      extra.innerHTML = `
        <div class="chapter-list-header">
          <strong>Sections (${item.chapters.length})</strong>
        </div>
        <div class="chapter-list">
          ${item.chapters
            .map(
              (c, i) => `
            <button class="chapter-item" data-open-chap="${i}">
              <span>${escapeHtml(c.title)}</span><small>Read</small>
            </button>`
            )
            .join('')}
        </div>`;
      extra.querySelectorAll('[data-open-chap]').forEach((b) => {
        b.onclick = () => launchBookReader(item, Number(b.dataset.openChap));
      });
    } else if (item.visualChapters?.length) {
      primaryBtn.onclick = () => launchVisualReader(item, { chapterIndex: 0 });
      extra.innerHTML = `
        <div class="chapter-list-header">
          <strong>Chapters (${item.visualChapters.length})</strong>
        </div>
        <div class="chapter-list">
          ${item.visualChapters
            .map(
              (c, i) => `
            <button class="chapter-item" data-open-vchap="${i}">
              <span>${escapeHtml(c.title)}</span><small>${c.pages?.length || '?'}p</small>
            </button>`
            )
            .join('')}
        </div>`;
      extra.querySelectorAll('[data-open-vchap]').forEach((b) => {
        b.onclick = () => launchVisualReader(item, { chapterIndex: Number(b.dataset.openVchap) });
      });
    } else if (item.mangadexId) {
      extra.innerHTML = `<p style="color:var(--text-secondary);font-size:0.86rem;">Loading English chapters from MangaDex...</p>`;
      primaryBtn.disabled = true;
      try {
        const chapters = await MangaDexApi.getChapters(item.mangadexId);
        if (!chapters.length) {
          extra.innerHTML = `<p style="color:var(--text-secondary);">No direct English chapters found on MangaDex for this title.</p>`;
          primaryBtn.textContent = 'Open on MangaDex ↗';
          primaryBtn.disabled = false;
          primaryBtn.onclick = () => window.open(item.externalUrl, '_blank');
          return;
        }
        item.visualChapters = chapters.map((ch) => ({ id: ch.id, title: ch.title, pages: [] }));
        primaryBtn.disabled = false;
        primaryBtn.onclick = () =>
          launchVisualReader(item, {
            chapterIndex: 0,
            defaultDir: 'rtl',
            onLoadChapter: (chap) => MangaDexApi.getChapterPages(chap.id)
          });

        extra.innerHTML = `
          <div class="chapter-list-header">
            <strong>MangaDex Chapters (${chapters.length})</strong>
            <small style="color:var(--text-muted);">${Proxy.isLocalAvailable ? 'Local proxy active ✓' : 'Tip: run start-server.bat if images are CORS-blocked'}</small>
          </div>
          <div class="chapter-list">
            ${chapters
              .map(
                (c, i) => `
              <button class="chapter-item" data-mdx-idx="${i}">
                <span>${escapeHtml(c.title)}</span>
                <small>${escapeHtml(c.group)}</small>
              </button>`
              )
              .join('')}
          </div>`;
        extra.querySelectorAll('[data-mdx-idx]').forEach((b) => {
          b.onclick = () =>
            launchVisualReader(item, {
              chapterIndex: Number(b.dataset.mdxIdx),
              defaultDir: 'rtl',
              onLoadChapter: (chap) => MangaDexApi.getChapterPages(chap.id)
            });
        });
      } catch (err) {
        extra.innerHTML = `<p style="color:var(--accent-danger);">Could not fetch MangaDex feed: ${escapeHtml(err.message)}</p>`;
      }
    } else if (item.gutenbergId) {
      primaryBtn.onclick = async () => {
        primaryBtn.disabled = true;
        primaryBtn.textContent = 'Fetching Book...';
        try {
          item.chapters = await GutendexApi.fetchBookChapters(item);
          launchBookReader(item, 0);
        } catch (err) {
          toast(`Direct text fetch blocked by CORS (${err.message}). Opening Gutenberg page.`);
          window.open(item.externalUrl, '_blank');
        } finally {
          primaryBtn.disabled = false;
          primaryBtn.textContent = 'Read Now';
        }
      };
      extra.innerHTML = `<p style="color:var(--text-secondary);font-size:0.86rem;">Public domain eBook from Project Gutenberg. ${Proxy.isLocalAvailable ? 'Local proxy active: EPUB/TXT loads directly inside the KODEX reader!' : 'Tip: run start-server.bat for instant in-app Gutenberg EPUB/TXT loading.'}</p>`;
    } else if (item.iaId) {
      primaryBtn.textContent = 'Read in Archive Viewer';
      primaryBtn.onclick = () =>
        launchBookReader({ ...item, embedUrl: `https://archive.org/embed/${encodeURIComponent(item.iaId)}` });
      extra.innerHTML = `<p style="color:var(--text-secondary);font-size:0.86rem;">Inspecting Internet Archive files (.CBZ / .EPUB / .PDF)...</p>`;
      try {
        const info = await ArchiveApi.inspectItemFiles(item.iaId);
        if (!info.files.length) {
          extra.innerHTML = `<p style="color:var(--text-secondary);font-size:0.86rem;">Ready to stream via Internet Archive BookReader.</p>`;
          return;
        }
        extra.innerHTML = `
          <div class="chapter-list-header">
            <strong>Available Files (${info.files.length})</strong>
            <small style="color:var(--text-muted);">Click to read in-app (proxy) or open embed</small>
          </div>
          <div class="chapter-list">
            ${info.files
              .slice(0, 12)
              .map(
                (f, idx) => `
              <button class="chapter-item" data-ia-file="${idx}">
                <span>${escapeHtml(f.name.slice(0, 34))}</span>
                <small>${escapeHtml(f.sizeMb)} MB</small>
              </button>`
              )
              .join('')}
          </div>`;
        extra.querySelectorAll('[data-ia-file]').forEach((btn) => {
          btn.onclick = async () => {
            const f = info.files[Number(btn.dataset.iaFile)];
            if (/\.pdf$/i.test(f.name)) {
              launchBookReader({ ...item, pdfUrl: f.url });
              return;
            }
            if (!Proxy.isLocalAvailable) {
              toast('Opening Internet Archive embedded viewer (run start-server.bat to unpack CBZ/EPUB natively).');
              launchBookReader({ ...item, embedUrl: info.embedUrl });
              return;
            }
            toast(`Downloading & unpacking ${f.name}...`);
            try {
              const buf = await smartFetch(f.url, { preferProxy: true, responseType: 'arrayBuffer', timeoutMs: 45000 });
              if (/\.cbz$/i.test(f.name)) {
                const parsed = await Kodex.ZipParser.parseCbz(buf, f.name);
                launchVisualReader(
                  { ...item, visualChapters: [{ id: f.name, title: f.name, pages: parsed.pages }] },
                  { defaultDir: 'ltr' }
                );
              } else if (/\.epub$/i.test(f.name)) {
                const parsed = await Kodex.ZipParser.parseEpub(buf, f.name);
                launchBookReader({ ...item, chapters: parsed.chapters });
              } else {
                const txt = new TextDecoder('utf-8').decode(buf);
                launchBookReader({ ...item, chapters: [{ title: f.name, html: `<pre style="white-space:pre-wrap;">${escapeHtml(txt)}</pre>` }] });
              }
            } catch (err) {
              toast(`Stream error: ${err.message}. Falling back to Archive Embed.`);
              launchBookReader({ ...item, embedUrl: info.embedUrl });
            }
          };
        });
      } catch {
        extra.innerHTML = '';
      }
    } else if (item.malId) {
      primaryBtn.textContent = 'Find Readable Chapters on MangaDex';
      primaryBtn.onclick = () => {
        $('#detailModal').classList.add('hidden');
        switchView('manga');
        state.mangaSource = 'mangadex';
        $$('#mangaSourceTabs .chip').forEach((c) => c.classList.toggle('active', c.dataset.mangaSource === 'mangadex'));
        $('#mangaQueryInput').value = item.title;
        loadManga(1);
      };
      extra.innerHTML = `<p style="color:var(--text-secondary);font-size:0.86rem;">Jikan provides MyAnimeList ratings &amp; metadata. Click above to locate readable scanlations on MangaDex.</p>`;
    }
  }

  /* ------------------------------------------------------------------------
     Reader Workspace Lifecycle
     ------------------------------------------------------------------------ */
  function launchBookReader(item, chapterIndex = 0) {
    $('#detailModal').classList.add('hidden');
    $('#readerOverlay').classList.remove('hidden', 'hud-hidden');
    $('#readerTocDrawer').classList.add('hidden');
    $('#readerSettingsDrawer').classList.add('hidden');

    Kodex.VisualReader.destroy();
    state.activeReaderType = 'book';
    state.activeReaderItem = item;
    $('#readerModePill').textContent = (item.mediaType || 'BOOK').toUpperCase();
    Kodex.BookReader.open(item, { chapterIndex });
  }

  function launchVisualReader(item, opts = {}) {
    $('#detailModal').classList.add('hidden');
    $('#readerOverlay').classList.remove('hidden', 'hud-hidden');
    $('#readerTocDrawer').classList.add('hidden');
    $('#readerSettingsDrawer').classList.add('hidden');

    Kodex.BookReader.destroy();
    state.activeReaderType = 'visual';
    state.activeReaderItem = item;
    $('#readerModePill').textContent = (item.mediaType || 'MANGA').toUpperCase();
    Kodex.VisualReader.open(item, {
      defaultDir: item.mediaType === 'comics' ? 'ltr' : 'rtl',
      ...opts
    });
  }

  function closeReader() {
    Kodex.BookReader.destroy();
    Kodex.VisualReader.destroy();
    state.activeReaderType = null;
    state.activeReaderItem = null;
    $('#readerOverlay').classList.add('hidden');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    renderContinueReading();
    if (state.currentView === 'library') renderLibraryView();
  }

  /* ------------------------------------------------------------------------
     Local File Engine (.EPUB, .CBZ, .PDF, .TXT, .MD, Images)
     ------------------------------------------------------------------------ */
  async function handleLocalFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    // If user selected multiple images, bundle them as a comic/manga chapter!
    const imageFiles = files.filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif)$/i.test(f.name));
    if (imageFiles.length > 0 && imageFiles.length === files.length) {
      imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      const pages = imageFiles.map((f) => URL.createObjectURL(f));
      const item = {
        id: `local-imgs-${Date.now()}`,
        title: imageFiles.length === 1 ? imageFiles[0].name : `Image Pack (${imageFiles.length} pages)`,
        author: 'Local File',
        mediaType: 'manga',
        source: 'Local Disk',
        format: 'IMAGES',
        cover: pages[0],
        visualChapters: [{ id: 'ch-1', title: 'Local Pages', pages }]
      };
      state.localItems.unshift(item);
      cacheItem(item);
      toast(`Loaded ${pages.length} local pages.`);
      launchVisualReader(item);
      return;
    }

    for (const file of files) {
      const name = file.name;
      const lower = name.toLowerCase();
      try {
        if (lower.endsWith('.cbz')) {
          toast(`Unpacking ${name}...`);
          const parsed = await Kodex.ZipParser.parseCbz(await file.arrayBuffer(), name);
          const item = {
            id: `local-cbz-${name}-${file.size}`,
            title: parsed.title,
            author: 'Local CBZ Archive',
            mediaType: 'comics',
            source: 'Local Disk',
            format: 'CBZ',
            cover: parsed.cover,
            visualChapters: [{ id: 'cbz-1', title: parsed.title, pages: parsed.pages }]
          };
          state.localItems.unshift(item);
          cacheItem(item);
          launchVisualReader(item, { defaultDir: 'ltr' });
        } else if (lower.endsWith('.epub')) {
          toast(`Parsing EPUB ${name}...`);
          const parsed = await Kodex.ZipParser.parseEpub(await file.arrayBuffer(), name);
          const item = {
            id: `local-epub-${name}-${file.size}`,
            title: parsed.title,
            author: parsed.author,
            description: parsed.description,
            mediaType: 'books',
            source: 'Local Disk',
            format: 'EPUB',
            cover: parsed.cover || makeBookCover(parsed.title.slice(0, 22), parsed.author, '#1e293b', '#0f766e'),
            chapters: parsed.chapters
          };
          state.localItems.unshift(item);
          cacheItem(item);
          launchBookReader(item, 0);
        } else if (lower.endsWith('.pdf')) {
          const url = URL.createObjectURL(file);
          const item = {
            id: `local-pdf-${name}-${file.size}`,
            title: name.replace(/\.pdf$/i, ''),
            author: 'Local PDF',
            mediaType: 'books',
            source: 'Local Disk',
            format: 'PDF',
            cover: makeBookCover(name.slice(0, 22), 'PDF Document', '#3f3f46', '#991b1b'),
            pdfUrl: url
          };
          state.localItems.unshift(item);
          cacheItem(item);
          launchBookReader(item);
        } else if (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.txt') || lower.endsWith('.html') || lower.endsWith('.htm')) {
          const text = await file.text();
          let html = '';
          if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
            html = markdownToHtml(text);
          } else if (lower.endsWith('.html') || lower.endsWith('.htm')) {
            html = Kodex.Utils.sanitizeHtml(text);
          } else {
            html = text
              .split(/\n{2,}/)
              .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
              .join('\n');
          }
          const item = {
            id: `local-txt-${name}-${file.size}`,
            title: name.replace(/\.(txt|md|markdown|html|htm)$/i, ''),
            author: 'Local Document',
            mediaType: 'books',
            source: 'Local Disk',
            format: name.split('.').pop().toUpperCase(),
            cover: makeBookCover(name.slice(0, 22), 'Local Text', '#1e293b', '#334155'),
            chapters: [{ title: name, html }]
          };
          state.localItems.unshift(item);
          cacheItem(item);
          launchBookReader(item, 0);
        } else {
          toast(`Unsupported file type: ${name}`);
        }
      } catch (err) {
        toast(`Failed to open ${name}: ${err.message}`);
      }
    }
  }

  /* ------------------------------------------------------------------------
     Event Wiring & Initialization
     ------------------------------------------------------------------------ */
  function bindEvents() {
    // Nav Tabs & Jump Links
    $$('.nav-tab').forEach((tab) => {
      tab.onclick = () => switchView(tab.dataset.view);
    });
    $$('[data-jump-view]').forEach((btn) => {
      btn.onclick = () => switchView(btn.dataset.jumpView);
    });
    $('#brandHome').onclick = () => switchView('discover');

    // App Theme Toggle
    const prefs = getPrefs();
    document.documentElement.setAttribute('data-app-theme', prefs.appTheme || 'obsidian');
    $('#themeToggleBtn').onclick = () => {
      const cur = document.documentElement.getAttribute('data-app-theme');
      const next = cur === 'obsidian' ? 'daylight' : 'obsidian';
      document.documentElement.setAttribute('data-app-theme', next);
      savePrefs({ appTheme: next });
    };

    // Hero Quick Sample Actions
    $$('[data-quick-action]').forEach((btn) => {
      btn.onclick = () => {
        const act = btn.dataset.quickAction;
        if (act === 'open-sample-book') launchBookReader(SAMPLE_CATALOG[0], 0);
        if (act === 'open-sample-manga') launchVisualReader(SAMPLE_CATALOG[2], { defaultDir: 'rtl' });
        if (act === 'open-sample-comic') launchVisualReader(SAMPLE_CATALOG[3], { defaultDir: 'ltr' });
      };
    });

    // Global Omni-Search
    $('#globalSearchForm').onsubmit = (e) => {
      e.preventDefault();
      const raw = $('#globalSearchInput').value;
      const parsed = parseSearchQuery(raw);
      let scope = $('#globalSearchScope').value;
      if (parsed.type) scope = parsed.type;
      const q = parsed.author ? `${parsed.query} ${parsed.author}`.trim() : parsed.query;

      if (scope === 'manga') {
        switchView('manga');
        $('#mangaQueryInput').value = q;
        loadManga(1);
      } else if (scope === 'comics') {
        switchView('comics');
        $('#comicsQueryInput').value = q;
        loadComics(1);
      } else if (scope === 'poetry') {
        switchView('books');
        state.bookSource = 'poetrydb';
        state.selectedPoet = parsed.author || '';
        $$('#booksSourceTabs .chip').forEach((c) => c.classList.toggle('active', c.dataset.bookSource === 'poetrydb'));
        $('#poetQuickChips').classList.remove('hidden');
        $('#booksQueryInput').value = parsed.query;
        loadBooks(1);
      } else {
        switchView('books');
        $('#booksQueryInput').value = q;
        loadBooks(1);
      }
    };

    // Books View Events
    $$('#booksSourceTabs .chip').forEach((btn) => {
      btn.onclick = () => {
        state.bookSource = btn.dataset.bookSource;
        state.selectedPoet = '';
        $$('#booksSourceTabs .chip').forEach((c) => c.classList.toggle('active', c === btn));
        $('#poetQuickChips').classList.toggle('hidden', state.bookSource !== 'poetrydb');
        loadBooks(1);
      };
    });
    $$('#poetQuickChips .chip-sm').forEach((btn) => {
      btn.onclick = () => {
        state.bookSource = 'poetrydb';
        state.selectedPoet = btn.dataset.poet;
        loadBooks(1);
      };
    });
    $('#booksSearchBtn').onclick = () => {
      state.selectedPoet = '';
      loadBooks(1);
    };
    $('#booksQueryInput').onkeydown = (e) => {
      if (e.key === 'Enter') {
        state.selectedPoet = '';
        loadBooks(1);
      }
    };

    // Manga View Events
    $$('#mangaSourceTabs .chip').forEach((btn) => {
      btn.onclick = () => {
        state.mangaSource = btn.dataset.mangaSource;
        $$('#mangaSourceTabs .chip').forEach((c) => c.classList.toggle('active', c === btn));
        loadManga(1);
      };
    });
    $$('[data-manga-tag]').forEach((btn) => {
      btn.onclick = () => {
        $('#mangaQueryInput').value = btn.dataset.mangaTag;
        loadManga(1);
      };
    });
    $('#mangaSearchBtn').onclick = () => loadManga(1);
    $('#mangaQueryInput').onkeydown = (e) => {
      if (e.key === 'Enter') loadManga(1);
    };

    // Comics View Events
    $$('[data-comic-collection]').forEach((btn) => {
      btn.onclick = () => {
        state.comicCollection = btn.dataset.comicCollection;
        $$('[data-comic-collection]').forEach((c) => c.classList.toggle('active', c === btn));
        loadComics(1);
      };
    });
    $('#comicsSearchBtn').onclick = () => loadComics(1);
    $('#comicsQueryInput').onkeydown = (e) => {
      if (e.key === 'Enter') loadComics(1);
    };

    // Library View Events
    $$('#libraryFilterTabs .chip').forEach((btn) => {
      btn.onclick = () => {
        state.libraryFilter = btn.dataset.libFilter;
        $$('#libraryFilterTabs .chip').forEach((c) => c.classList.toggle('active', c === btn));
        renderLibraryView();
      };
    });
    $('#exportLibraryBtn').onclick = () => {
      const payload = JSON.stringify(Store.exportAll(), null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `kodex-library-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      toast('Exported library JSON backup.');
    };
    $('#importLibraryBtn').onclick = () => $('#importLibraryInput').click();
    $('#importLibraryInput').onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        if (file.name.endsWith('.json')) {
          Store.importData(JSON.parse(text));
        } else {
          // Basic CSV import (Title,Author,Shelf)
          const rows = text.split(/\r?\n/).slice(1).filter(Boolean);
          const imported = rows.map((r, i) => {
            const [title, author, shelf] = r.split(',').map((s) => s.replace(/^"|"$/g, '').trim());
            return {
              id: `csv-${i}-${title}`,
              title: title || 'Imported Title',
              author: author || 'Imported',
              mediaType: 'books',
              source: 'CSV Import',
              shelf: shelf || 'plan'
            };
          });
          Store.importData({ library: imported });
        }
        updateLibraryBadge();
        renderLibraryView();
        toast('Library imported successfully!');
      } catch {
        toast('Invalid JSON or CSV file.');
      }
      e.target.value = '';
    };
    $('#clearHistoryBtn').onclick = () => {
      Store.clearHistory();
      renderContinueReading();
      renderLibraryView();
      toast('Reading history cleared.');
    };

    // Card Click Delegation across entire app
    document.addEventListener('click', (e) => {
      const card = e.target.closest('.media-card[data-item-id]');
      if (card) openDetailModal(card.dataset.itemId);
    });

    // Detail Modal Close
    $('#closeDetailModal').onclick = () => $('#detailModal').classList.add('hidden');
    $('#detailModal').onclick = (e) => {
      if (e.target.id === 'detailModal') $('#detailModal').classList.add('hidden');
    };

    // Reader Overlay Controls
    $('#readerBackBtn').onclick = closeReader;
    $('#readerTocBtn').onclick = () => {
      $('#readerSettingsDrawer').classList.add('hidden');
      $('#readerTocDrawer').classList.toggle('hidden');
    };
    $('#readerSettingsBtn').onclick = () => {
      $('#readerTocDrawer').classList.add('hidden');
      $('#readerSettingsDrawer').classList.toggle('hidden');
    };
    $('#closeTocDrawer').onclick = () => $('#readerTocDrawer').classList.add('hidden');
    $('#closeSettingsDrawer').onclick = () => $('#readerSettingsDrawer').classList.add('hidden');
    $('#readerFullscreenBtn').onclick = () => {
      const overlay = $('#readerOverlay');
      if (!document.fullscreenElement) overlay.requestFullscreen?.().catch(() => {});
      else document.exitFullscreen?.().catch(() => {});
    };
    $('#readerBookmarkBtn').onclick = () => {
      const item = state.activeReaderItem;
      if (!item) return;
      Store.upsertLibrary(item, 'reading');
      if (state.activeReaderType === 'book') {
        Store.addBookmark(item.id, {
          chapterIndex: Kodex.BookReader.chapterIndex,
          label: item.chapters?.[Kodex.BookReader.chapterIndex]?.title || 'Bookmark'
        });
        Kodex.BookReader.renderToc();
      }
      updateLibraryBadge();
      toast('Bookmarked & saved to Library!');
    };

    // Global Keyboard Shortcuts inside Reader
    document.addEventListener('keydown', (e) => {
      if ($('#readerOverlay').classList.contains('hidden')) return;
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'Escape') closeReader();
      else if (e.key.toLowerCase() === 'f') $('#readerFullscreenBtn').click();
      else if (state.activeReaderType === 'book') Kodex.BookReader.handleKey(e);
      else if (state.activeReaderType === 'visual') Kodex.VisualReader.handleKey(e);
    });

    // Local File Upload & Global Drag-and-Drop
    $('#openUploadBtn').onclick = () => $('#localFileInput').click();
    $('#heroDropzone').onclick = () => $('#localFileInput').click();
    $('#localFileInput').onchange = (e) => {
      handleLocalFiles(e.target.files);
      e.target.value = '';
    };

    const dz = $('#heroDropzone');
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
      dz.classList.add('dragover');
    });
    document.addEventListener('dragleave', (e) => {
      if (e.relatedTarget === null) dz.classList.remove('dragover');
    });
    document.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.classList.remove('dragover');
      if (e.dataTransfer?.files?.length) handleLocalFiles(e.dataTransfer.files);
    });

    // Proxy Settings Save & Test
    $('#customProxyInput').value = prefs.proxyUrl || 'http://localhost:8080/proxy?url=';
    $('#saveProxyBtn').onclick = async () => {
      const val = $('#customProxyInput').value.trim();
      savePrefs({ proxyUrl: val });
      const ok = await Proxy.testProxy(val);
      updateProxyUI(ok);
      if (ok) toast('Proxy connected successfully!');
    };
  }

  function updateProxyUI(connected) {
    const pill = $('#proxyStatusBadge');
    const cardBadge = $('#proxyCardBadge');
    if (connected) {
      pill.classList.add('proxy-on');
      $('.status-label', pill).textContent = 'Proxy Active';
      cardBadge.className = 'tag tag-success';
      cardBadge.textContent = 'Connected';
    } else {
      pill.classList.remove('proxy-on');
      $('.status-label', pill).textContent = 'Standalone Mode';
      cardBadge.className = 'tag tag-outline';
      cardBadge.textContent = 'Not Running';
    }
  }

  async function boot() {
    bindEvents();
    updateLibraryBadge();
    const proxyOk = await Proxy.detect();
    updateProxyUI(proxyOk);
    initDiscover();
  }

  document.addEventListener('DOMContentLoaded', boot);
})(window);
