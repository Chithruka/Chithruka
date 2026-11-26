/* ==========================================================================
   KODEX Visual Reader Engine — Manga & Comics
   Supports Webtoon Long-Strip, Single Page, Double-Page Spread, RTL & LTR
   ========================================================================== */

(function (global) {
  const Kodex = (global.Kodex = global.Kodex || {});
  const { $, escapeHtml, getPrefs, savePrefs, Store, toast } = Kodex.Utils;

  class VisualReaderEngine {
    constructor() {
      this.item = null;
      this.chapters = []; // [{ id, title, pages: [...] }]
      this.chapterIndex = 0;
      this.pageIndex = 0;
      this.pages = [];
      this.onLoadChapter = null; // optional async loader for remote chapters (e.g. MangaDex)
    }

    async open(item, opts = {}) {
      this.item = item;
      this.chapters = item.visualChapters || [];
      this.onLoadChapter = opts.onLoadChapter || null;

      const saved = Store.getProgress(item.id);
      this.chapterIndex =
        typeof opts.chapterIndex === 'number'
          ? opts.chapterIndex
          : saved?.chapterIndex || 0;
      this.pageIndex =
        typeof opts.pageIndex === 'number'
          ? opts.pageIndex
          : saved?.pageIndex || 0;

      // Default RTL for manga, LTR for comics unless user changed
      if (opts.defaultDir) {
        savePrefs({ visualDir: opts.defaultDir });
      }

      this.applyVisualStyles();
      this.renderCenterControls();
      this.renderSettings();
      this.renderToc();
      await this.loadChapter(this.chapterIndex, this.pageIndex);
    }

    applyVisualStyles() {
      const prefs = getPrefs();
      document.documentElement.style.setProperty('--reader-bg', '#06070a');
      document.documentElement.style.setProperty('--visual-brightness', `${prefs.visualBrightness || 100}%`);
    }

    async loadChapter(chapIdx, startPage = 0) {
      if (chapIdx < 0 || chapIdx >= this.chapters.length) return;
      this.chapterIndex = chapIdx;
      const chap = this.chapters[chapIdx];
      $('#readerWorkTitle').textContent = this.item.title;
      $('#readerWorkSub').textContent = chap.title || `Chapter ${chapIdx + 1}`;

      const vp = $('#readerViewport');
      if ((!chap.pages || !chap.pages.length) && this.onLoadChapter) {
        vp.innerHTML = `<div style="height:70vh;display:grid;place-items:center;color:#94a3b8;">Loading chapter pages...</div>`;
        try {
          chap.pages = await this.onLoadChapter(chap, chapIdx);
        } catch (err) {
          vp.innerHTML = `
            <div style="max-width:520px;margin:4rem auto;padding:1.5rem;background:#12161f;border:1px solid rgba(255,255,255,0.1);border-radius:12px;text-align:center;">
              <h3 style="margin-top:0;">Could not load chapter images</h3>
              <p style="color:#94a3b8;font-size:0.9rem;">${escapeHtml(err.message)}. External manga/comic image hosts often require the local proxy server (<code>start-server.bat</code>) due to CORS.</p>
              ${
                this.item.externalUrl
                  ? `<a class="btn btn-primary" href="${escapeHtml(this.item.externalUrl)}" target="_blank" rel="noopener noreferrer">Open on Source Site ↗</a>`
                  : ''
              }
            </div>`;
          return;
        }
      }

      this.pages = chap.pages || [];
      this.pageIndex = Math.min(Math.max(0, startPage), Math.max(0, this.pages.length - 1));
      this.renderPages();
      this.renderCenterControls();
      this.renderToc();
      this.preloadNearby();
    }

    renderCenterControls() {
      const center = $('#readerCenterControls');
      if (!center) return;
      const prefs = getPrefs();
      center.innerHTML = `
        <button id="visPrevChapBtn" class="btn btn-ghost btn-sm" ${this.chapterIndex <= 0 ? 'disabled' : ''}>‹ Prev Ch</button>
        <button id="visModeCycleBtn" class="btn btn-secondary btn-sm" title="Switch Webtoon / Single / Spread">
          Mode: ${prefs.visualMode.toUpperCase()}
        </button>
        <button id="visDirToggleBtn" class="btn btn-secondary btn-sm" title="Toggle RTL / LTR">
          ${prefs.visualDir.toUpperCase()}
        </button>
        <button id="visNextChapBtn" class="btn btn-ghost btn-sm" ${this.chapterIndex >= this.chapters.length - 1 ? 'disabled' : ''}>Next Ch ›</button>
      `;

      $('#visPrevChapBtn').onclick = () => this.loadChapter(this.chapterIndex - 1, 0);
      $('#visNextChapBtn').onclick = () => this.loadChapter(this.chapterIndex + 1, 0);
      $('#visModeCycleBtn').onclick = () => {
        const order = ['webtoon', 'single', 'spread'];
        const cur = getPrefs().visualMode;
        const next = order[(order.indexOf(cur) + 1) % order.length];
        savePrefs({ visualMode: next });
        this.renderCenterControls();
        this.renderSettings();
        this.renderPages();
      };
      $('#visDirToggleBtn').onclick = () => {
        const next = getPrefs().visualDir === 'rtl' ? 'ltr' : 'rtl';
        savePrefs({ visualDir: next });
        toast(`Reading direction: ${next.toUpperCase()}`);
        this.renderCenterControls();
        this.renderSettings();
        this.renderPages();
      };
    }

    renderPages() {
      const vp = $('#readerViewport');
      const prefs = getPrefs();
      if (!this.pages.length) {
        vp.innerHTML = `<div style="padding:3rem;text-align:center;color:#94a3b8;">No pages available in this chapter.</div>`;
        return;
      }

      if (prefs.visualMode === 'webtoon') {
        vp.innerHTML = `
          <div class="visual-reader-stage">
            <div class="visual-strip ${prefs.visualGap ? 'spaced' : ''}">
              ${this.pages
                .map(
                  (src, idx) =>
                    `<img class="visual-page-img ${prefs.visualFit}" src="${escapeHtml(src)}" data-page-idx="${idx}" alt="Page ${idx + 1}" loading="lazy" />`
                )
                .join('')}
            </div>
            <div style="padding:2rem 1rem;display:flex;gap:0.75rem;justify-content:center;">
              <button class="btn btn-secondary" id="stripPrevChap" ${this.chapterIndex <= 0 ? 'disabled' : ''}>← Previous Chapter</button>
              <button class="btn btn-primary" id="stripNextChap" ${this.chapterIndex >= this.chapters.length - 1 ? 'disabled' : ''}>Next Chapter →</button>
            </div>
          </div>
        `;
        const prev = $('#stripPrevChap');
        const next = $('#stripNextChap');
        if (prev) prev.onclick = () => this.loadChapter(this.chapterIndex - 1, 0);
        if (next) next.onclick = () => this.loadChapter(this.chapterIndex + 1, 0);

        vp.onscroll = () => this.trackStripScroll();
        if (this.pageIndex > 0) {
          requestAnimationFrame(() => {
            const targetImg = vp.querySelector(`[data-page-idx="${this.pageIndex}"]`);
            if (targetImg) targetImg.scrollIntoView({ behavior: 'instant' });
            this.updateFooter();
          });
        } else {
          vp.scrollTop = 0;
          this.updateFooter();
        }
      } else {
        vp.onscroll = null;
        const isSpread = prefs.visualMode === 'spread';
        const isRtl = prefs.visualDir === 'rtl';

        let imagesHtml = '';
        if (isSpread && this.pageIndex + 1 < this.pages.length) {
          const p1 = this.pages[this.pageIndex];
          const p2 = this.pages[this.pageIndex + 1];
          imagesHtml = `
            <div class="visual-spread-pair ${isRtl ? 'rtl' : ''}">
              <img class="visual-page-img" src="${escapeHtml(p1)}" alt="Page ${this.pageIndex + 1}" />
              <img class="visual-page-img" src="${escapeHtml(p2)}" alt="Page ${this.pageIndex + 2}" />
            </div>`;
        } else {
          const p1 = this.pages[this.pageIndex];
          imagesHtml = `<img class="visual-page-img ${prefs.visualFit}" src="${escapeHtml(p1)}" alt="Page ${this.pageIndex + 1}" />`;
        }

        vp.innerHTML = `
          <div class="visual-reader-stage">
            <div class="visual-paged-container">
              ${imagesHtml}
            </div>
            <div class="tap-zone left" id="tapLeft" title="Turn Page"></div>
            <div class="tap-zone center" id="tapCenter" title="Toggle HUD"></div>
            <div class="tap-zone right" id="tapRight" title="Turn Page"></div>
          </div>
        `;

        const step = isSpread ? 2 : 1;
        $('#tapLeft').onclick = () => this.stepPage(isRtl ? step : -step);
        $('#tapRight').onclick = () => this.stepPage(isRtl ? -step : step);
        $('#tapCenter').onclick = () => $('#readerOverlay').classList.toggle('hud-hidden');
        this.updateFooter();
      }
    }

    stepPage(delta) {
      const next = this.pageIndex + delta;
      if (next < 0) {
        if (this.chapterIndex > 0) this.loadChapter(this.chapterIndex - 1, 0);
        else toast('Already on the first page.');
        return;
      }
      if (next >= this.pages.length) {
        if (this.chapterIndex < this.chapters.length - 1) this.loadChapter(this.chapterIndex + 1, 0);
        else toast('End of chapter reached!');
        return;
      }
      this.pageIndex = next;
      this.renderPages();
      this.preloadNearby();
    }

    preloadNearby() {
      for (let i = 1; i <= 3; i++) {
        const url = this.pages[this.pageIndex + i];
        if (url && !url.startsWith('data:')) {
          const img = new Image();
          img.src = url;
        }
      }
    }

    trackStripScroll() {
      const vp = $('#readerViewport');
      const imgs = vp.querySelectorAll('[data-page-idx]');
      const vpMid = vp.scrollTop + vp.clientHeight * 0.4;
      let current = 0;
      imgs.forEach((img) => {
        if (img.offsetTop <= vpMid) current = Number(img.dataset.pageIdx);
      });
      this.pageIndex = current;
      this.updateFooter(true);
    }

    updateFooter(fromStrip = false) {
      const total = Math.max(1, this.pages.length);
      const pct = Math.round(((this.pageIndex + 1) / total) * 100);
      $('#readerProgressLeft').textContent = `${pct}%`;
      $('#readerProgressRight').textContent = `Page ${this.pageIndex + 1} / ${total}`;

      const scrubber = $('#readerScrubber');
      scrubber.value = String(pct);
      scrubber.oninput = (e) => {
        const targetPage = Math.min(total - 1, Math.floor((Number(e.target.value) / 100) * total));
        this.pageIndex = targetPage;
        if (getPrefs().visualMode === 'webtoon') {
          const el = $('#readerViewport').querySelector(`[data-page-idx="${targetPage}"]`);
          if (el) el.scrollIntoView({ behavior: 'instant' });
        } else {
          this.renderPages();
        }
      };

      if (this.item) {
        Store.recordProgress(this.item, {
          percent: pct,
          label: `${this.chapters[this.chapterIndex]?.title || 'Ch.1'} · p.${this.pageIndex + 1}`,
          chapterIndex: this.chapterIndex,
          pageIndex: this.pageIndex
        });
      }
      if (!fromStrip) this.preloadNearby();
    }

    renderToc() {
      const body = $('#readerTocBody');
      if (!body) return;
      body.innerHTML = `
        <div class="setting-group">
          <label>Chapters (${this.chapters.length})</label>
          <div style="display:flex;flex-direction:column;gap:0.35rem;">
            ${this.chapters
              .map(
                (c, i) => `
              <button class="chapter-item" data-vchap="${i}" style="${i === this.chapterIndex ? 'border-color:var(--accent-primary);' : ''}">
                <span>${escapeHtml(c.title || `Chapter ${i + 1}`)}</span>
                <small>${c.pages?.length ? `${c.pages.length}p` : 'Load'}</small>
              </button>`
              )
              .join('')}
          </div>
        </div>
      `;
      body.querySelectorAll('[data-vchap]').forEach((btn) => {
        btn.onclick = () => {
          this.loadChapter(Number(btn.dataset.vchap), 0);
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
          <label>Reading Mode</label>
          <div class="segmented">
            <button data-vmode="webtoon" class="${prefs.visualMode === 'webtoon' ? 'active' : ''}">Long Strip</button>
            <button data-vmode="single" class="${prefs.visualMode === 'single' ? 'active' : ''}">Single</button>
            <button data-vmode="spread" class="${prefs.visualMode === 'spread' ? 'active' : ''}">Spread</button>
          </div>
        </div>

        <div class="setting-group">
          <label>Page Direction (Single &amp; Spread)</label>
          <div class="segmented">
            <button data-vdir="rtl" class="${prefs.visualDir === 'rtl' ? 'active' : ''}">RTL (Manga)</button>
            <button data-vdir="ltr" class="${prefs.visualDir === 'ltr' ? 'active' : ''}">LTR (Comic)</button>
          </div>
        </div>

        <div class="setting-group">
          <label>Image Fit</label>
          <div class="segmented">
            <button data-vfit="fit-width" class="${prefs.visualFit === 'fit-width' ? 'active' : ''}">Width</button>
            <button data-vfit="fit-height" class="${prefs.visualFit === 'fit-height' ? 'active' : ''}">Height</button>
            <button data-vfit="fit-original" class="${prefs.visualFit === 'fit-original' ? 'active' : ''}">Original</button>
          </div>
        </div>

        <div class="setting-group">
          <label>Panel Spacing (Long Strip)</label>
          <div class="segmented">
            <button data-vgap="false" class="${!prefs.visualGap ? 'active' : ''}">Seamless</button>
            <button data-vgap="true" class="${prefs.visualGap ? 'active' : ''}">Gapped</button>
          </div>
        </div>

        <div class="setting-group">
          <label>Night Dimmer: <span id="lblVisBright">${prefs.visualBrightness}%</span></label>
          <input id="rngVisBright" type="range" min="45" max="115" step="5" value="${prefs.visualBrightness}" />
        </div>
      `;

      body.querySelectorAll('[data-vmode]').forEach((b) => {
        b.onclick = () => {
          savePrefs({ visualMode: b.dataset.vmode });
          this.renderCenterControls();
          this.renderSettings();
          this.renderPages();
        };
      });
      body.querySelectorAll('[data-vdir]').forEach((b) => {
        b.onclick = () => {
          savePrefs({ visualDir: b.dataset.vdir });
          this.renderCenterControls();
          this.renderSettings();
          this.renderPages();
        };
      });
      body.querySelectorAll('[data-vfit]').forEach((b) => {
        b.onclick = () => {
          savePrefs({ visualFit: b.dataset.vfit });
          this.renderSettings();
          this.renderPages();
        };
      });
      body.querySelectorAll('[data-vgap]').forEach((b) => {
        b.onclick = () => {
          savePrefs({ visualGap: b.dataset.vgap === 'true' });
          this.renderSettings();
          this.renderPages();
        };
      });
      $('#rngVisBright').oninput = (e) => {
        const val = Number(e.target.value);
        $('#lblVisBright').textContent = `${val}%`;
        savePrefs({ visualBrightness: val });
        this.applyVisualStyles();
      };
    }

    handleKey(e) {
      const prefs = getPrefs();
      if (prefs.visualMode === 'webtoon') return;
      const step = prefs.visualMode === 'spread' ? 2 : 1;
      const isRtl = prefs.visualDir === 'rtl';
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.stepPage(isRtl ? -step : step);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.stepPage(isRtl ? step : -step);
      } else if (e.key === ' ') {
        e.preventDefault();
        this.stepPage(step);
      }
    }

    destroy() {
      const vp = $('#readerViewport');
      if (vp) vp.onscroll = null;
      document.documentElement.style.setProperty('--visual-brightness', '100%');
    }
  }

  Kodex.VisualReader = new VisualReaderEngine();
})(window);
