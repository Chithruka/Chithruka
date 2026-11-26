/* ==========================================================================
   KODEX Utilities, Storage & Proxy-Aware Fetch
   ========================================================================== */

(function (global) {
  const Kodex = (global.Kodex = global.Kodex || {});

  const STORAGE_KEYS = {
    LIBRARY: 'kodex_library_v1',
    HISTORY: 'kodex_history_v1',
    PREFS: 'kodex_prefs_v1',
    BOOKMARKS: 'kodex_bookmarks_v1'
  };

  function $(selector, root = document) {
    return root.querySelector(selector);
  }

  function $$(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeHtml(html) {
    // Strip dangerous tags/attributes from external EPUB or API HTML
    const tpl = document.createElement('template');
    tpl.innerHTML = html || '';
    const blocked = tpl.content.querySelectorAll('script, style, iframe, object, embed, link[rel="import"]');
    blocked.forEach((el) => el.remove());
    tpl.content.querySelectorAll('*').forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        const name = attr.name.toLowerCase();
        const val = attr.value.trim().toLowerCase();
        if (name.startsWith('on') || val.startsWith('javascript:')) {
          el.removeAttribute(attr.name);
        }
      }
    });
    return tpl.innerHTML;
  }

  function debounce(fn, delay = 250) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function toast(message, duration = 3200) {
    const container = $('#toastContainer');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      el.style.transition = 'all 0.2s ease';
      setTimeout(() => el.remove(), 220);
    }, duration);
  }

  /* Simple clean Markdown -> HTML converter for local .md books */
  function markdownToHtml(md) {
    const lines = String(md || '').replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let inList = false;
    let inCode = false;

    const inline = (txt) =>
      escapeHtml(txt)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');

    for (const raw of lines) {
      if (raw.trim().startsWith('```')) {
        if (!inCode) {
          out.push('<pre><code>');
          inCode = true;
        } else {
          out.push('</code></pre>');
          inCode = false;
        }
        continue;
      }
      if (inCode) {
        out.push(escapeHtml(raw) + '\n');
        continue;
      }
      const line = raw.trim();
      if (!line) {
        if (inList) {
          out.push('</ul>');
          inList = false;
        }
        continue;
      }
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        if (inList) { out.push('</ul>'); inList = false; }
        const lvl = h[1].length;
        out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
      } else if (/^[-*]\s+/.test(line)) {
        if (!inList) { out.push('<ul>'); inList = true; }
        out.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`);
      } else if (line.startsWith('>')) {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push(`<blockquote>${inline(line.slice(1).trim())}</blockquote>`);
      } else {
        if (inList) { out.push('</ul>'); inList = false; }
        out.push(`<p>${inline(line)}</p>`);
      }
    }
    if (inList) out.push('</ul>');
    if (inCode) out.push('</code></pre>');
    return out.join('\n');
  }

  /* Z-Library inspired search operator parser:
     e.g. "author:Shelley type:books frankenstein" */
  function parseSearchQuery(raw) {
    const tokens = String(raw || '').trim().split(/\s+/).filter(Boolean);
    const parsed = { text: [], author: '', type: '', format: '', tag: '' };
    for (const t of tokens) {
      const idx = t.indexOf(':');
      if (idx > 0) {
        const key = t.slice(0, idx).toLowerCase();
        const val = t.slice(idx + 1).replace(/^"|"$/g, '');
        if (['author', 'type', 'format', 'tag'].includes(key) && val) {
          parsed[key] = val;
          continue;
        }
      }
      parsed.text.push(t);
    }
    parsed.query = parsed.text.join(' ');
    return parsed;
  }

  /* Preferences & Proxy Detection */
  const defaultPrefs = {
    appTheme: 'obsidian',
    proxyUrl: '',
    bookTheme: 'obsidian',
    bookFont: 'serif',
    bookFontSize: 19,
    bookLineHeight: 1.75,
    bookWidth: '720px',
    bookAlign: 'left',
    bookMode: 'scroll', // 'scroll' | 'paginated'
    visualMode: 'webtoon', // 'webtoon' | 'single' | 'spread'
    visualDir: 'rtl', // 'rtl' | 'ltr'
    visualFit: 'fit-width', // 'fit-width' | 'fit-height' | 'fit-original'
    visualBrightness: 100,
    visualGap: false
  };

  function getPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.PREFS) || '{}');
      return { ...defaultPrefs, ...saved };
    } catch {
      return { ...defaultPrefs };
    }
  }

  function savePrefs(patch) {
    const next = { ...getPrefs(), ...patch };
    try {
      localStorage.setItem(STORAGE_KEYS.PREFS, JSON.stringify(next));
    } catch { /* ignore quota */ }
    return next;
  }

  /* Library & History Persistence */
  function readJson(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      toast('Storage limit reached — consider exporting and clearing old history.');
    }
  }

  const Store = {
    getLibrary() {
      return readJson(STORAGE_KEYS.LIBRARY, []);
    },
    getItem(id) {
      return this.getLibrary().find((x) => x.id === id) || null;
    },
    upsertLibrary(item, shelf = 'reading') {
      const list = this.getLibrary();
      const idx = list.findIndex((x) => x.id === item.id);
      const entry = {
        ...item,
        shelf: shelf || (idx >= 0 ? list[idx].shelf : 'reading'),
        savedAt: Date.now()
      };
      if (idx >= 0) list[idx] = { ...list[idx], ...entry };
      else list.unshift(entry);
      writeJson(STORAGE_KEYS.LIBRARY, list);
      return entry;
    },
    removeLibrary(id) {
      const list = this.getLibrary().filter((x) => x.id !== id);
      writeJson(STORAGE_KEYS.LIBRARY, list);
    },
    getHistory() {
      return readJson(STORAGE_KEYS.HISTORY, []);
    },
    recordProgress(item, progress) {
      // progress: { percent, label, chapterIndex, pageIndex, scrollRatio }
      const list = this.getHistory().filter((x) => x.id !== item.id);
      list.unshift({
        id: item.id,
        title: item.title,
        author: item.author || '',
        mediaType: item.mediaType,
        source: item.source,
        cover: item.cover || '',
        meta: item.meta || {},
        progress: { ...progress, updatedAt: Date.now() }
      });
      writeJson(STORAGE_KEYS.HISTORY, list.slice(0, 60));
    },
    getProgress(id) {
      const found = this.getHistory().find((x) => x.id === id);
      return found ? found.progress : null;
    },
    clearHistory() {
      writeJson(STORAGE_KEYS.HISTORY, []);
    },
    getBookmarks(itemId) {
      const all = readJson(STORAGE_KEYS.BOOKMARKS, {});
      return itemId ? all[itemId] || [] : all;
    },
    addBookmark(itemId, bm) {
      const all = readJson(STORAGE_KEYS.BOOKMARKS, {});
      all[itemId] = all[itemId] || [];
      all[itemId].unshift({ ...bm, createdAt: Date.now() });
      writeJson(STORAGE_KEYS.BOOKMARKS, all);
      return all[itemId];
    },
    exportAll() {
      return {
        exportedAt: new Date().toISOString(),
        app: 'KODEX',
        library: this.getLibrary(),
        history: this.getHistory(),
        bookmarks: this.getBookmarks()
      };
    },
    importData(data) {
      if (Array.isArray(data.library)) {
        const existing = this.getLibrary();
        const merged = [...data.library];
        for (const item of existing) {
          if (!merged.some((m) => m.id === item.id)) merged.push(item);
        }
        writeJson(STORAGE_KEYS.LIBRARY, merged);
      }
      if (Array.isArray(data.history)) {
        writeJson(STORAGE_KEYS.HISTORY, data.history.slice(0, 60));
      }
    }
  };

  /* Proxy State & Smart Fetch */
  const Proxy = {
    activeUrl: '',
    isLocalAvailable: false,
    async detect() {
      const prefs = getPrefs();
      if (prefs.proxyUrl) {
        const ok = await this.testProxy(prefs.proxyUrl);
        if (ok) return true;
      }
      // Check same-origin /proxy when served from start-server.ps1
      if (location.protocol.startsWith('http')) {
        const candidate = `${location.origin}/proxy?url=`;
        if (await this.testProxy(candidate, true)) return true;
      }
      // Check localhost:8080 if opened via file://
      const localCandidate = 'http://localhost:8080/proxy?url=';
      if (await this.testProxy(localCandidate, true)) return true;
      this.activeUrl = '';
      this.isLocalAvailable = false;
      return false;
    },
    async testProxy(prefix, silent = false) {
      if (!prefix) return false;
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 1800);
        const pingBase = prefix.replace(/\/proxy\?url=$/, '');
        const res = await fetch(`${pingBase}/health`, { signal: controller.signal });
        clearTimeout(t);
        if (res.ok) {
          this.activeUrl = prefix;
          this.isLocalAvailable = true;
          return true;
        }
      } catch {
        if (!silent) toast('Could not reach proxy endpoint.');
      }
      return false;
    },
    wrap(url) {
      if (!this.activeUrl) return url;
      return `${this.activeUrl}${encodeURIComponent(url)}`;
    }
  };

  async function smartFetch(url, options = {}) {
    const { preferProxy = false, timeoutMs = 12000, responseType = 'json' } = options;
    const tryRequest = async (targetUrl) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(targetUrl, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (responseType === 'text') return await res.text();
        if (responseType === 'arrayBuffer') return await res.arrayBuffer();
        if (responseType === 'blob') return await res.blob();
        return await res.json();
      } catch (err) {
        clearTimeout(timer);
        throw err;
      }
    };

    if (preferProxy && Proxy.activeUrl) {
      return tryRequest(Proxy.wrap(url));
    }

    try {
      return await tryRequest(url);
    } catch (directErr) {
      if (Proxy.activeUrl) {
        return tryRequest(Proxy.wrap(url));
      }
      throw directErr;
    }
  }

  function renderSkeletons(container, count = 6) {
    if (!container) return;
    container.innerHTML = Array.from({ length: count })
      .map(
        () => `
      <div class="skeleton-card">
        <div class="skeleton-box" style="aspect-ratio: 2/3;"></div>
        <div style="padding: 0.75rem; display: grid; gap: 0.45rem;">
          <div class="skeleton-box" style="height: 14px; border-radius: 4px; width: 85%;"></div>
          <div class="skeleton-box" style="height: 11px; border-radius: 4px; width: 55%;"></div>
        </div>
      </div>`
      )
      .join('');
  }

  Kodex.Utils = {
    $,
    $$,
    escapeHtml,
    sanitizeHtml,
    debounce,
    toast,
    markdownToHtml,
    parseSearchQuery,
    getPrefs,
    savePrefs,
    Store,
    Proxy,
    smartFetch,
    renderSkeletons
  };
})(window);
