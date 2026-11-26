/* ==========================================================================
   KODEX Book, Poetry, EPUB & PDF Reader Engine
   ========================================================================== */

(function (global) {
  const Kodex = (global.Kodex = global.Kodex || {});
  const { $, escapeHtml, getPrefs, savePrefs, Store, toast } = Kodex.Utils;

  const BOOK_THEMES = {
    obsidian: { label: 'Obsidian', bg: '#111318', fg: '#e2e8f0' },
    amoled: { label: 'AMOLED', bg: '#000000', fg: '#d4d4d8' },
    sepia: { label: 'Warm Sepia', bg: '#f4ecd8', fg: '#3b2f23' },
    paper: { label: 'Paper Light', bg: '#fafaf9', fg: '#1e293b' }
  };

  const FONT_MAP = {
    serif: "'Newsreader', Georgia, 'Times New Roman', serif",
    sans: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace"
  };

  class BookReaderEngine {
    constructor() {
      this.item = null;
      this.chapters = [];
      this.chapterIndex = 0;
      this.paginatedPage = 0;
      this.totalPaginatedPages = 1;
      this.ttsActive = false;
      this.searchTerm = '';
      this.onExit = null;
    }

    open(item, opts = {}) {
      this.item = item;
      this.chapters = item.chapters || [];
      this.stopTts();

      const saved = Store.getProgress(item.id);
      this.chapterIndex =
        typeof opts.chapterIndex === 'number'
          ? opts.chapterIndex
          : saved?.chapterIndex || 0;
      if (this.chapterIndex >= this.chapters.length) this.chapterIndex = 0;

      this.applyBookStyles();
      this.renderCenterControls();
      this.renderSettings();
      this.renderToc();

      if (item.pdfUrl) {
        this.renderPdf(item.pdfUrl);
      } else if (item.embedUrl) {
        this.renderEmbed(item.embedUrl);
      } else {
        this.renderCurrentChapter(saved?.scrollRatio || 0);
      }
    }

    applyBookStyles() {
      const prefs = getPrefs();
      const theme = BOOK_THEMES[prefs.bookTheme] || BOOK_THEMES.obsidian;
      const root = document.documentElement;
      root.style.setProperty('--reader-bg', theme.bg);
      root.style.setProperty('--reader-fg', theme.fg);
      root.style.setProperty('--reader-font', FONT_MAP[prefs.bookFont] || FONT_MAP.serif);
      root.style.setProperty('--reader-font-size', `${prefs.bookFontSize}px`);
      root.style.setProperty('--reader-line-height', String(prefs.bookLineHeight));
      root.style.setProperty('--reader-max-width', prefs.bookWidth || '720px');
      root.style.setProperty('--reader-align', prefs.bookAlign || 'left');
    }

    renderCenterControls() {
      const center = $('#readerCenterControls');
      if (!center) return;
      if (this.item?.pdfUrl || this.item?.embedUrl) {
        center.innerHTML = `<span class="tag tag-outline">Embedded Viewer</span>`;
        return;
      }

      center.innerHTML = `
        <button id="bookPrevChapBtn" class="btn btn-ghost btn-sm" title="Previous Chapter">‹ Prev</button>
        <span id="bookChapterIndicator" style="font-size:0.8rem;font-family:var(--font-mono);color:#cbd5e1;">
          ${this.chapterIndex + 1} / ${Math.max(1, this.chapters.length)}
        </span>
        <button id="bookNextChapBtn" class="btn btn-ghost btn-sm" title="Next Chapter">Next ›</button>
        <button id="bookTtsBtn" class="btn btn-secondary btn-sm" title="Read Aloud (Web Speech)">
          ${this.ttsActive ? '⏹ Stop Audio' : '🔊 Read Aloud'}
        </button>
      `;

      $('#bookPrevChapBtn').onclick = () => this.goChapter(this.chapterIndex - 1);
      $('#bookNextChapBtn').onclick = () => this.goChapter(this.chapterIndex + 1);
      $('#bookTtsBtn').onclick = () => this.toggleTts();
    }

    renderPdf(url) {
      const vp = $('#readerViewport');
      vp.innerHTML = `<iframe class="embed-reader-frame" src="${escapeHtml(url)}" title="${escapeHtml(this.item.title)}"></iframe>`;
      $('#readerWorkSub').textContent = 'PDF Document';
      $('#readerProgressLeft').textContent = 'PDF';
      $('#readerProgressRight').textContent = 'Native Viewer';
    }

    renderEmbed(url) {
      const vp = $('#readerViewport');
      vp.innerHTML = `<iframe class="embed-reader-frame" src="${escapeHtml(url)}" allowfullscreen title="${escapeHtml(this.item.title)}"></iframe>`;
      $('#readerWorkSub').textContent = 'Internet Archive BookReader';
      $('#readerProgressLeft').textContent = 'LIVE';
      $('#readerProgressRight').textContent = 'Embedded Stream';
    }

    renderCurrentChapter(restoreScrollRatio = 0) {
      const vp = $('#readerViewport');
      const prefs = getPrefs();
      const ch = this.chapters[this.chapterIndex] || { title: 'Empty', html: '<p>No content.</p>' };
      const isPaginated = prefs.bookMode === 'paginated';

      $('#readerWorkTitle').textContent = this.item.title;
      $('#readerWorkSub').textContent = ch.title || `Section ${this.chapterIndex + 1}`;
      const ind = $('#bookChapterIndicator');
      if (ind) ind.textContent = `${this.chapterIndex + 1} / ${this.chapters.length}`;

      let contentHtml = ch.html || '';
      if (this.searchTerm) {
        const safe = this.searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(${safe})(?![^<]*>)`, 'gi');
        contentHtml = contentHtml.replace(re, '<mark class="reader-hit">$1</mark>');
      }

      vp.innerHTML = `
        <div id="bookStage" class="book-reader-stage ${isPaginated ? 'paginated' : ''}">
          <article id="bookArticle" class="book-article">
            ${contentHtml}
            ${
              !isPaginated
                ? `<div class="book-chapter-nav">
                    <button class="btn btn-secondary" id="stagePrevBtn" ${this.chapterIndex <= 0 ? 'disabled' : ''}>← Previous Section</button>
                    <button class="btn btn-primary" id="stageNextBtn" ${this.chapterIndex >= this.chapters.length - 1 ? 'disabled' : ''}>Next Section →</button>
                  </div>`
                : ''
            }
          </article>
        </div>
      `;

      if (!isPaginated) {
        const prevBtn = $('#stagePrevBtn');
        const nextBtn = $('#stageNextBtn');
        if (prevBtn) prevBtn.onclick = () => this.goChapter(this.chapterIndex - 1);
        if (nextBtn) nextBtn.onclick = () => this.goChapter(this.chapterIndex + 1);

        vp.onscroll = () => this.updateScrollProgress();
        if (restoreScrollRatio > 0) {
          requestAnimationFrame(() => {
            const max = vp.scrollHeight - vp.clientHeight;
            vp.scrollTop = max * restoreScrollRatio;
            this.updateScrollProgress();
          });
        } else {
          vp.scrollTop = 0;
          this.updateScrollProgress();
        }
      } else {
        vp.onscroll = null;
        this.paginatedPage = 0;
        requestAnimationFrame(() => this.setupPaginatedView());
      }

      this.renderToc();
    }

    setupPaginatedView() {
      const article = $('#bookArticle');
      if (!article) return;
      const colWidth = article.clientWidth;
      const gap = 56;
      const stride = colWidth + gap;
      this.totalPaginatedPages = Math.max(1, Math.ceil((article.scrollWidth + gap) / stride));
      if (this.paginatedPage >= this.totalPaginatedPages) {
        this.paginatedPage = this.totalPaginatedPages - 1;
      }
      article.scrollTo({ left: this.paginatedPage * stride, behavior: 'instant' });
      this.updatePaginatedProgress();
    }

    stepPaginated(delta) {
      const prefs = getPrefs();
      if (prefs.bookMode !== 'paginated') return;
      const next = this.paginatedPage + delta;
      if (next < 0) {
        if (this.chapterIndex > 0) this.goChapter(this.chapterIndex - 1);
        return;
      }
      if (next >= this.totalPaginatedPages) {
        if (this.chapterIndex < this.chapters.length - 1) this.goChapter(this.chapterIndex + 1);
        return;
      }
      this.paginatedPage = next;
      const article = $('#bookArticle');
      if (article) {
        article.scrollTo({ left: this.paginatedPage * (article.clientWidth + 56), behavior: 'smooth' });
      }
      this.updatePaginatedProgress();
    }

    updatePaginatedProgress() {
      const pct = Math.round(((this.paginatedPage + 1) / this.totalPaginatedPages) * 100);
      $('#readerProgressLeft').textContent = `${pct}%`;
      $('#readerProgressRight').textContent = `Spread ${this.paginatedPage + 1} / ${this.totalPaginatedPages}`;
      const scrubber = $('#readerScrubber');
      scrubber.value = String(pct);
      scrubber.oninput = (e) => {
        const target = Math.floor((Number(e.target.value) / 100) * (this.totalPaginatedPages - 1));
        this.paginatedPage = Math.max(0, target);
        this.setupPaginatedView();
      };
      this.saveCurrentProgress(pct);
    }

    updateScrollProgress() {
      const vp = $('#readerViewport');
      const max = Math.max(1, vp.scrollHeight - vp.clientHeight);
      const ratio = Math.min(1, Math.max(0, vp.scrollTop / max));
      const overallPct = Math.round(
        ((this.chapterIndex + ratio) / Math.max(1, this.chapters.length)) * 100
      );
      $('#readerProgressLeft').textContent = `${overallPct}%`;
      $('#readerProgressRight').textContent = `Sec ${this.chapterIndex + 1}/${this.chapters.length}`;

      const scrubber = $('#readerScrubber');
      scrubber.value = String(Math.round(ratio * 100));
      scrubber.oninput = (e) => {
        const r = Number(e.target.value) / 100;
        vp.scrollTop = max * r;
      };

      this.saveCurrentProgress(overallPct, ratio);
    }

    saveCurrentProgress(percent, scrollRatio = 0) {
      if (!this.item) return;
      Store.recordProgress(this.item, {
        percent,
        label: this.chapters[this.chapterIndex]?.title || `Section ${this.chapterIndex + 1}`,
        chapterIndex: this.chapterIndex,
        scrollRatio
      });
    }

    goChapter(index) {
      if (index < 0 || index >= this.chapters.length) return;
      this.stopTts();
      this.chapterIndex = index;
      this.renderCurrentChapter(0);
    }

    renderToc() {
      const body = $('#readerTocBody');
      if (!body) return;
      const bookmarks = this.item ? Store.getBookmarks(this.item.id) : [];

      body.innerHTML = `
        <div class="setting-group">
          <label>Search Inside Section</label>
          <div style="display:flex;gap:0.4rem;">
            <input id="inBookSearch" type="text" value="${escapeHtml(this.searchTerm)}" placeholder="Find word..." style="flex:1;background:#1b2130;border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:0.4rem 0.6rem;font-size:0.84rem;" />
            <button id="inBookSearchBtn" class="btn btn-secondary btn-sm">Find</button>
          </div>
        </div>

        <div class="setting-group">
          <label>Chapters / Sections (${this.chapters.length})</label>
          <div style="display:flex;flex-direction:column;gap:0.35rem;">
            ${this.chapters
              .map(
                (c, i) => `
              <button class="chapter-item ${i === this.chapterIndex ? 'active' : ''}" data-toc-idx="${i}" style="${i === this.chapterIndex ? 'border-color:var(--accent-primary);' : ''}">
                <span>${escapeHtml(c.title || `Section ${i + 1}`)}</span>
                <small>#${i + 1}</small>
              </button>`
              )
              .join('')}
          </div>
        </div>

        <div class="setting-group">
          <label>Saved Bookmarks (${bookmarks.length})</label>
          ${
            bookmarks.length
              ? bookmarks
                  .map(
                    (b) => `
                <button class="chapter-item" data-bm-chap="${b.chapterIndex || 0}">
                  <span>${escapeHtml(b.label)}</span>
                  <small>${new Date(b.createdAt).toLocaleDateString()}</small>
                </button>`
                  )
                  .join('')
              : '<p style="font-size:0.82rem;color:#94a3b8;margin:0;">Click the bookmark icon in the top bar to save your spot.</p>'
          }
        </div>
      `;

      $('#inBookSearchBtn').onclick = () => {
        this.searchTerm = $('#inBookSearch').value.trim();
        this.renderCurrentChapter(0);
      };
      body.querySelectorAll('[data-toc-idx]').forEach((btn) => {
        btn.onclick = () => {
          this.goChapter(Number(btn.dataset.tocIdx));
          $('#readerTocDrawer').classList.add('hidden');
        };
      });
      body.querySelectorAll('[data-bm-chap]').forEach((btn) => {
        btn.onclick = () => {
          this.goChapter(Number(btn.dataset.bmChap));
          $('#readerTocDrawer').classList.add('hidden');
        };
      });
    }

    renderSettings() {
      const body = $('#readerSettingsBody');
      if (!body) return;
      const prefs = getPrefs();

      body.innerHTML = `
        <div class="setting-group">
          <label>Reading Theme</label>
          <div class="theme-swatches">
            ${Object.entries(BOOK_THEMES)
              .map(
                ([key, t]) => `
              <button class="swatch-btn ${prefs.bookTheme === key ? 'active' : ''}"
                data-btheme="${key}"
                style="background:${t.bg};color:${t.fg};border-color:${prefs.bookTheme === key ? 'var(--accent-primary)' : 'rgba(255,255,255,0.16)'};">
                ${t.label}
              </button>`
              )
              .join('')}
          </div>
        </div>

        <div class="setting-group">
          <label>Reading Layout</label>
          <div class="segmented">
            <button data-bmode="scroll" class="${prefs.bookMode === 'scroll' ? 'active' : ''}">Vertical Scroll</button>
            <button data-bmode="paginated" class="${prefs.bookMode === 'paginated' ? 'active' : ''}">Page Columns</button>
          </div>
        </div>

        <div class="setting-group">
          <label>Typeface</label>
          <div class="segmented">
            <button data-bfont="serif" class="${prefs.bookFont === 'serif' ? 'active' : ''}">Serif</button>
            <button data-bfont="sans" class="${prefs.bookFont === 'sans' ? 'active' : ''}">Sans</button>
            <button data-bfont="mono" class="${prefs.bookFont === 'mono' ? 'active' : ''}">Mono</button>
          </div>
        </div>

        <div class="setting-group">
          <label>Font Size: <span id="lblFontSize">${prefs.bookFontSize}px</span></label>
          <input id="rngFontSize" type="range" min="14" max="28" step="1" value="${prefs.bookFontSize}" />
        </div>

        <div class="setting-group">
          <label>Line Height: <span id="lblLineHeight">${prefs.bookLineHeight}</span></label>
          <input id="rngLineHeight" type="range" min="1.35" max="2.15" step="0.05" value="${prefs.bookLineHeight}" />
        </div>

        <div class="setting-group">
          <label>Column Width</label>
          <div class="segmented">
            <button data-bwidth="580px" class="${prefs.bookWidth === '580px' ? 'active' : ''}">Narrow</button>
            <button data-bwidth="720px" class="${prefs.bookWidth === '720px' ? 'active' : ''}">Balanced</button>
            <button data-bwidth="900px" class="${prefs.bookWidth === '900px' ? 'active' : ''}">Wide</button>
          </div>
        </div>

        <div class="setting-group">
          <label>Text Alignment</label>
          <div class="segmented">
            <button data-balign="left" class="${prefs.bookAlign === 'left' ? 'active' : ''}">Left</button>
            <button data-balign="justify" class="${prefs.bookAlign === 'justify' ? 'active' : ''}">Justify</button>
          </div>
        </div>
      `;

      body.querySelectorAll('[data-btheme]').forEach((btn) => {
        btn.onclick = () => {
          savePrefs({ bookTheme: btn.dataset.btheme });
          this.applyBookStyles();
          this.renderSettings();
        };
      });
      body.querySelectorAll('[data-bmode]').forEach((btn) => {
        btn.onclick = () => {
          savePrefs({ bookMode: btn.dataset.bmode });
          this.renderCurrentChapter(0);
          this.renderSettings();
        };
      });
      body.querySelectorAll('[data-bfont]').forEach((btn) => {
        btn.onclick = () => {
          savePrefs({ bookFont: btn.dataset.bfont });
          this.applyBookStyles();
          this.renderSettings();
        };
      });
      body.querySelectorAll('[data-bwidth]').forEach((btn) => {
        btn.onclick = () => {
          savePrefs({ bookWidth: btn.dataset.bwidth });
          this.applyBookStyles();
          this.renderSettings();
        };
      });
      body.querySelectorAll('[data-balign]').forEach((btn) => {
        btn.onclick = () => {
          savePrefs({ bookAlign: btn.dataset.balign });
          this.applyBookStyles();
          this.renderSettings();
        };
      });

      $('#rngFontSize').oninput = (e) => {
        const val = Number(e.target.value);
        $('#lblFontSize').textContent = `${val}px`;
        savePrefs({ bookFontSize: val });
        this.applyBookStyles();
        if (getPrefs().bookMode === 'paginated') this.setupPaginatedView();
      };

      $('#rngLineHeight').oninput = (e) => {
        const val = Number(e.target.value);
        $('#lblLineHeight').textContent = String(val);
        savePrefs({ bookLineHeight: val });
        this.applyBookStyles();
        if (getPrefs().bookMode === 'paginated') this.setupPaginatedView();
      };
    }

    toggleTts() {
      if (!('speechSynthesis' in window)) {
        toast('Text-to-Speech is not supported in this browser.');
        return;
      }
      if (this.ttsActive) {
        this.stopTts();
        return;
      }
      const article = $('#bookArticle');
      const text = article ? article.innerText.trim() : '';
      if (!text) return;

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 12000));
      utterance.rate = 1.0;
      utterance.onend = () => {
        this.ttsActive = false;
        this.renderCenterControls();
      };
      this.ttsActive = true;
      this.renderCenterControls();
      window.speechSynthesis.speak(utterance);
      toast('Reading current section aloud...');
    }

    stopTts() {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      this.ttsActive = false;
      const btn = $('#bookTtsBtn');
      if (btn) btn.textContent = '🔊 Read Aloud';
    }

    handleKey(e) {
      if (getPrefs().bookMode === 'paginated') {
        if (e.key === 'ArrowRight' || e.key === ' ') {
          e.preventDefault();
          this.stepPaginated(1);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.stepPaginated(-1);
        }
      }
    }

    destroy() {
      this.stopTts();
      const vp = $('#readerViewport');
      if (vp) vp.onscroll = null;
    }
  }

  Kodex.BookReader = new BookReaderEngine();
})(window);
