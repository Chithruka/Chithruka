/* ==========================================================================
   NETFLIX RADIO — MULTI-SOURCE AUDIO ENGINE, GLOBE & UI CONTROLLER
   Combines Famelack directories, Radio-Browser live API, Curated 320k mixes,
   HLS.js adaptive streaming, and an interactive D3 3D Orthographic World Globe.
   ========================================================================== */

(function () {
    "use strict";

    // --- CONSTANTS & CONFIG ---
    const FAMELACK_ROOTS = [
        "https://data.famelack.com/radio",
        "https://raw.githubusercontent.com/famelack/famelack-data/main/radio"
    ];

    const RADIO_BROWSER_SERVERS = [
        "https://de1.api.radio-browser.info",
        "https://de2.api.radio-browser.info",
        "https://fi1.api.radio-browser.info",
        "https://at1.api.radio-browser.info",
        "https://nl1.api.radio-browser.info"
    ];

    const WORLD_ATLAS_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

    const STORAGE_KEYS = {
        FAVORITES: "nf_radio_favorites_v1",
        HISTORY: "nf_radio_history_v1",
        PREFS: "nf_radio_prefs_v1"
    };

    const NETFLIX_N_SVG = `<svg viewBox="0 0 16 16" width="16" height="16" data-icon="NetflixSmall" data-icon-id="_r_m_" class="default-ltr-iqcdef-cache-1i3oso3" xmlns="http://www.w3.org/2000/svg" fill="none" role="img"><path fill="currentColor" d="M9.12.67v6.52L6.82.67h-2.9v14.66s1.7-.21 2.88-.24V8.8l2.22 6.28c1.4.03 2.97.24 2.97.24V.67z"></path></svg>`;

    const CARD_PALETTES = [
        ["#8b0000", "#1f080a"],
        ["#b91c1c", "#18181b"],
        ["#7c2d12", "#1c1917"],
        ["#312e81", "#0f172a"],
        ["#0f766e", "#111827"],
        ["#6d28d9", "#181029"],
        ["#be123c", "#1a0b12"],
        ["#1d4ed8", "#0b132b"]
    ];

    // Curated high-reliability HTTPS streams (inspired by RiveStream Radio)
    const CURATED_MIXES = [
        {
            id: "cur-rp-main",
            name: "Radio Paradise — Main Mix",
            country: "United States",
            countryCode: "US",
            streams: ["https://stream.radioparadise.com/mp3-320", "https://stream.radioparadise.com/aac-320"],
            favicon: "https://radioparadise.com/apple-touch-icon.png",
            tags: ["eclectic", "rock", "indie", "320k"],
            languages: ["english"],
            codec: "MP3",
            bitrate: 320,
            homepage: "https://radioparadise.com/",
            isFeatured: true
        },
        {
            id: "cur-rp-mellow",
            name: "Radio Paradise — Mellow Mix",
            country: "United States",
            countryCode: "US",
            streams: ["https://stream.radioparadise.com/mellow-320"],
            favicon: "https://radioparadise.com/apple-touch-icon.png",
            tags: ["mellow", "chill", "acoustic", "320k"],
            languages: ["english"],
            codec: "MP3",
            bitrate: 320,
            homepage: "https://radioparadise.com/",
            isFeatured: true
        },
        {
            id: "cur-rp-rock",
            name: "Radio Paradise — Rock Mix",
            country: "United States",
            countryCode: "US",
            streams: ["https://stream.radioparadise.com/rock-320"],
            favicon: "https://radioparadise.com/apple-touch-icon.png",
            tags: ["rock", "classic rock", "alternative", "320k"],
            languages: ["english"],
            codec: "MP3",
            bitrate: 320,
            homepage: "https://radioparadise.com/",
            isFeatured: true
        },
        {
            id: "cur-rp-global",
            name: "Radio Paradise — Global Mix",
            country: "United States",
            countryCode: "US",
            streams: ["https://stream.radioparadise.com/global-320"],
            favicon: "https://radioparadise.com/apple-touch-icon.png",
            tags: ["world", "global", "eclectic", "320k"],
            languages: ["english"],
            codec: "MP3",
            bitrate: 320,
            homepage: "https://radioparadise.com/",
            isFeatured: true
        },
        {
            id: "cur-rp-2050",
            name: "Radio Paradise — Radio 2050",
            country: "United States",
            countryCode: "US",
            streams: ["https://stream.radioparadise.com/radio2050-320"],
            favicon: "https://radioparadise.com/apple-touch-icon.png",
            tags: ["electronic", "ambient", "future", "320k"],
            languages: ["english"],
            codec: "MP3",
            bitrate: 320,
            homepage: "https://radioparadise.com/",
            isFeatured: true
        },
        {
            id: "cur-calm-piano",
            name: "Calm Radio — Solo Piano",
            country: "Canada",
            countryCode: "CA",
            streams: ["https://drive.uber.radio/uber/calmpiano/icecast.audio"],
            tags: ["calm", "piano", "classical", "focus"],
            languages: ["instrumental"],
            codec: "MP3",
            bitrate: 192,
            isFeatured: true
        },
        {
            id: "cur-calm-classical",
            name: "Calm Radio — Classical",
            country: "Canada",
            countryCode: "CA",
            streams: ["https://drive.uber.radio/uber/calmclassical/icecast.audio"],
            tags: ["calm", "classical", "symphony"],
            languages: ["instrumental"],
            codec: "MP3",
            bitrate: 192,
            isFeatured: true
        },
        {
            id: "cur-calm-zen",
            name: "Calm Radio — Zen & Spa",
            country: "Canada",
            countryCode: "CA",
            streams: ["https://drive.uber.radio/uber/calmzen/icecast.audio", "https://drive.uber.radio/uber/calmspa/icecast.audio"],
            tags: ["calm", "zen", "meditation", "chill"],
            languages: ["instrumental"],
            codec: "MP3",
            bitrate: 192,
            isFeatured: false
        },
        {
            id: "cur-calm-ocean",
            name: "Calm Radio — Ocean Waves",
            country: "Canada",
            countryCode: "CA",
            streams: ["https://drive.uber.radio/uber/calmocean/icecast.audio"],
            tags: ["calm", "ambient", "nature", "sleep"],
            languages: ["instrumental"],
            codec: "MP3",
            bitrate: 192,
            isFeatured: false
        },
        {
            id: "cur-er-coldplay",
            name: "Exclusive Radio — Coldplay",
            country: "United Kingdom",
            countryCode: "GB",
            streams: ["https://streaming.exclusive.radio/er/coldplay/icecast.audio"],
            tags: ["artist", "rock", "pop", "hits"],
            languages: ["english"],
            codec: "MP3",
            bitrate: 128,
            isFeatured: true
        },
        {
            id: "cur-er-weeknd",
            name: "Exclusive Radio — The Weeknd",
            country: "United Kingdom",
            countryCode: "GB",
            streams: ["https://streaming.exclusive.radio/er/theweeknd/icecast.audio"],
            tags: ["artist", "pop", "r&b", "hits"],
            languages: ["english"],
            codec: "MP3",
            bitrate: 128,
            isFeatured: true
        },
        {
            id: "cur-er-taylor",
            name: "Exclusive Radio — Taylor Swift",
            country: "United Kingdom",
            countryCode: "GB",
            streams: ["https://streaming.exclusive.radio/er/taylorswift/icecast.audio"],
            tags: ["artist", "pop", "hits"],
            languages: ["english"],
            codec: "MP3",
            bitrate: 128,
            isFeatured: false
        },
        {
            id: "cur-er-bts",
            name: "Exclusive Radio — BTS",
            country: "South Korea",
            countryCode: "KR",
            streams: ["https://streaming.exclusive.radio/er/bts/icecast.audio"],
            tags: ["artist", "k-pop", "pop"],
            languages: ["korean", "english"],
            codec: "MP3",
            bitrate: 128,
            isFeatured: false
        },
        {
            id: "cur-er-adele",
            name: "Exclusive Radio — Adele",
            country: "United Kingdom",
            countryCode: "GB",
            streams: ["https://streaming.exclusive.radio/er/adele/icecast.audio"],
            tags: ["artist", "soul", "pop"],
            languages: ["english"],
            codec: "MP3",
            bitrate: 128,
            isFeatured: false
        },
        {
            id: "cur-workout-cardio",
            name: "Workout — Cardio 145 BPM",
            country: "United Kingdom",
            countryCode: "GB",
            streams: ["https://drive.uber.radio/uber-app/sportifybpm145/icecast.audio"],
            tags: ["workout", "electronic", "dance", "fitness"],
            languages: ["english"],
            codec: "MP3",
            bitrate: 128,
            isFeatured: false
        },
        {
            id: "cur-workout-dance",
            name: "Workout — Dance Energy",
            country: "United Kingdom",
            countryCode: "GB",
            streams: ["https://drive.uber.radio/uber-app/sportifydance/icecast.audio"],
            tags: ["workout", "dance", "electronic", "pop"],
            languages: ["english"],
            codec: "MP3",
            bitrate: 128,
            isFeatured: false
        }
    ];

    const QUICK_COUNTRY_CODES = ["LK", "US", "GB", "JP", "IN", "DE", "FR", "CA", "AU", "BR", "KR", "NL"];

    // Map world-atlas country names to ISO-2 codes for Famelack matching
    const ATLAS_NAME_TO_ISO = {
        "United States of America": "US",
        "United Kingdom": "GB",
        "Russia": "RU",
        "South Korea": "KR",
        "North Korea": "KP",
        "Czechia": "CZ",
        "Taiwan": "TW",
        "Vietnam": "VN",
        "Iran": "IR",
        "Syria": "SY",
        "Venezuela": "VE",
        "Bolivia": "BO",
        "Tanzania": "TZ",
        "Moldova": "MD",
        "Laos": "LA",
        "Brunei": "BN",
        "Dem. Rep. Congo": "CD",
        "Congo": "CG",
        "Côte d'Ivoire": "CI",
        "Dominican Rep.": "DO",
        "Bosnia and Herz.": "BA",
        "Central African Rep.": "CF",
        "Eq. Guinea": "GQ",
        "S. Sudan": "SS",
        "eSwatini": "SZ",
        "North Macedonia": "MK",
        "Palestine": "PS",
        "United Arab Emirates": "AE",
        "Saudi Arabia": "SA",
        "Sri Lanka": "LK",
        "New Zealand": "NZ",
        "South Africa": "ZA",
        "Netherlands": "NL",
        "Switzerland": "CH",
        "Philippines": "PH",
        "Indonesia": "ID",
        "Turkey": "TR",
        "Macedonia": "MK",
        "Swaziland": "SZ",
        "United States": "US",
        "South Sudan": "SS",
        "Ivory Coast": "CI"
    };

    const FALLBACK_COORDS = {
        SG: [103.82, 1.35],
        HK: [114.17, 22.32],
        MT: [14.51, 35.9],
        BH: [50.55, 26.07],
        MV: [73.22, 3.2],
        MU: [57.55, -20.35],
        MC: [7.42, 43.73],
        LI: [9.55, 47.16],
        AD: [1.52, 42.5],
        LU: [6.13, 49.61]
    };

    // --- APPLICATION STATE ---
    const state = {
        famelackBase: FAMELACK_ROOTS[0],
        rbServer: RADIO_BROWSER_SERVERS[0],
        countriesMeta: {},          // { LK: { country, capital, timeZone, hasChannels, channelCount }, ... }
        countryCodeList: [],        // sorted list of { code, ...meta }
        countryCache: new Map(),    // code -> Station[]
        categoryCache: new Map(),   // slug -> Station[]
        stationRegistry: new Map(), // id -> Station

        userLocation: { code: "LK", country: "Sri Lanka", lat: 7.87, lon: 80.77 },
        activeView: "browse",
        selectedGenre: "all",
        selectedCountry: "",
        searchQuery: "",
        httpsOnly: location.protocol === "https:",

        heroPool: [],
        heroIndex: 0,

        favorites: [],
        history: [],

        // Playback state
        currentStation: null,
        currentQueue: [],
        currentStreamIndex: 0,
        playbackStatus: "idle", // idle | loading | playing | paused | error
        volume: 85,
        muted: false,
        hls: null,
        tuneToken: 0,
        mirrorTimer: null,
        cleanupAudioListeners: null,
        sleepTimerEnd: null,
        sleepTimerInterval: null,

        // Globe state
        globe: {
            loaded: false,
            loading: false,
            worldData: null,
            landFeatures: [],
            countryNodes: [],
            selectedCode: "LK",
            hoveredNode: null,
            rotation: [-80.7, -7.8, 0],
            scaleFactor: 1,
            autoSpin: true,
            dragging: false,
            lastPointer: null,
            dragDistance: 0
        }
    };

    // --- DOM REFERENCES ---
    const dom = {
        navbar: document.getElementById("nf-navbar"),
        navLinks: document.querySelectorAll(".nf-nav-link"),
        mobileTabs: document.querySelectorAll(".nf-mobile-tab"),
        navFavBadge: document.getElementById("navFavBadge"),
        navLocationPill: document.getElementById("navLocationPill"),
        navLocFlag: document.getElementById("navLocFlag"),
        navLocName: document.getElementById("navLocName"),
        navLocClock: document.getElementById("navLocClock"),

        searchBox: document.getElementById("searchBox"),
        searchToggleBtn: document.getElementById("searchToggleBtn"),
        searchInput: document.getElementById("search-input") || document.getElementById("searchInput"),
        searchClearBtn: document.getElementById("searchClearBtn"),
        surpriseMeBtn: document.getElementById("surpriseMeBtn"),

        views: {
            browse: document.getElementById("viewBrowse"),
            globe: document.getElementById("viewGlobe"),
            countries: document.getElementById("viewCountries"),
            mylist: document.getElementById("viewMyList")
        },

        heroSection: document.getElementById("heroSection"),
        heroWaveCanvas: document.getElementById("heroWaveCanvas"),
        heroTitle: document.getElementById("heroTitle"),
        heroDesc: document.getElementById("heroDesc"),
        heroCountryChip: document.getElementById("heroCountryChip"),
        heroCodecChip: document.getElementById("heroCodecChip"),
        heroGenreChip: document.getElementById("heroGenreChip"),
        heroPlayBtn: document.getElementById("heroPlayBtn"),
        heroPlayIcon: document.getElementById("heroPlayIcon"),
        heroPauseIcon: document.getElementById("heroPauseIcon"),
        heroPlayLabel: document.getElementById("heroPlayLabel"),
        heroFavBtn: document.getElementById("heroFavBtn"),
        heroFavLabel: document.getElementById("heroFavLabel"),
        heroInfoBtn: document.getElementById("heroInfoBtn"),
        heroShuffleBtn: document.getElementById("heroShuffleBtn"),

        genreChipBar: document.getElementById("genreChipBar"),
        countrySelect: document.getElementById("countrySelect"),
        httpsOnlyToggle: document.getElementById("httpsOnlyToggle"),
        openGlobeQuickBtn: document.getElementById("openGlobeQuickBtn"),

        searchResultsSection: document.getElementById("searchResultsSection"),
        searchResultsTitle: document.getElementById("searchResultsTitle"),
        searchResultsSubtitle: document.getElementById("searchResultsSubtitle"),
        searchResultsGrid: document.getElementById("searchResultsGrid"),
        resetFilterBtn: document.getElementById("resetFilterBtn"),
        browseRowsContainer: document.getElementById("browseRowsContainer"),

        globeCanvas: document.getElementById("globeCanvas"),
        globeTooltip: document.getElementById("globeTooltip"),
        globeZoomIn: document.getElementById("globeZoomIn"),
        globeZoomOut: document.getElementById("globeZoomOut"),
        globeAutoSpin: document.getElementById("globeAutoSpin"),
        globeFlyHome: document.getElementById("globeFlyHome"),
        globeCountryFlag: document.getElementById("globeCountryFlag"),
        globeCountryName: document.getElementById("globeCountryName"),
        globeCountrySub: document.getElementById("globeCountrySub"),
        globeLocalTime: document.getElementById("globeLocalTime"),
        globeCountrySearch: document.getElementById("globeCountrySearch"),
        globeQuickPills: document.getElementById("globeQuickPills"),
        globeStationList: document.getElementById("globeStationList"),

        directoryCountryFilter: document.getElementById("directoryCountryFilter"),
        countriesDirectoryGrid: document.getElementById("countriesDirectoryGrid"),
        myListFavoritesGrid: document.getElementById("myListFavoritesGrid"),
        myListHistoryGrid: document.getElementById("myListHistoryGrid"),
        clearHistoryBtn: document.getElementById("clearHistoryBtn"),

        playerDock: document.getElementById("playerDock"),
        dockExpandTrigger: document.getElementById("dockExpandTrigger"),
        dockLogoImg: document.getElementById("dockLogoImg"),
        dockLogoFallback: document.getElementById("dockLogoFallback"),
        dockStationName: document.getElementById("dockStationName"),
        dockStatusPill: document.getElementById("dockStatusPill"),
        dockCountryMeta: document.getElementById("dockCountryMeta"),
        prevStationBtn: document.getElementById("prevStationBtn"),
        playPauseBtn: document.getElementById("playPauseBtn"),
        playIconSvg: document.getElementById("playIconSvg"),
        pauseIconSvg: document.getElementById("pauseIconSvg"),
        playBtnSpinner: document.getElementById("playBtnSpinner"),
        nextStationBtn: document.getElementById("nextStationBtn"),
        dockFavBtn: document.getElementById("dockFavBtn"),
        sleepTimerBtn: document.getElementById("sleepTimerBtn"),
        sleepTimerBadge: document.getElementById("sleepTimerBadge"),
        sleepTimerMenu: document.getElementById("sleepTimerMenu"),
        muteBtn: document.getElementById("muteBtn"),
        volHighIcon: document.getElementById("volHighIcon"),
        volMutedIcon: document.getElementById("volMutedIcon"),
        volumeSlider: document.getElementById("volumeSlider"),
        expandStudioBtn: document.getElementById("expandStudioBtn"),

        studioModal: document.getElementById("studioModal"),
        closeStudioModalBtn: document.getElementById("closeStudioModalBtn"),
        studioDisc: document.getElementById("studioDisc"),
        studioArtImg: document.getElementById("studioArtImg"),
        studioArtFallback: document.getElementById("studioArtFallback"),
        studioStatusPill: document.getElementById("studioStatusPill"),
        studioTitle: document.getElementById("studioTitle"),
        studioSubtitle: document.getElementById("studioSubtitle"),
        studioChips: document.getElementById("studioChips"),
        studioPlayBtn: document.getElementById("studioPlayBtn"),
        studioPlayIcon: document.getElementById("studioPlayIcon"),
        studioPauseIcon: document.getElementById("studioPauseIcon"),
        studioPlayLabel: document.getElementById("studioPlayLabel"),
        studioFavBtn: document.getElementById("studioFavBtn"),
        studioFavLabel: document.getElementById("studioFavLabel"),
        studioCopyUrlBtn: document.getElementById("studioCopyUrlBtn"),
        studioHomepageLink: document.getElementById("studioHomepageLink"),
        studioVizCanvas: document.getElementById("studioVizCanvas"),
        studioMirrorList: document.getElementById("studioMirrorList"),
        studioUpNextList: document.getElementById("studioUpNextList"),

        audio: document.getElementById("radioAudio"),
        toast: document.getElementById("toast")
    };

    // --- UTILITIES ---
    function escapeHtml(str) {
        return String(str || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function hashString(str) {
        let h = 2166136261;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return Math.abs(h);
    }

    function getPalette(seed) {
        return CARD_PALETTES[hashString(String(seed || "radio")) % CARD_PALETTES.length];
    }

    function getInitials(name) {
        const words = String(name || "FM")
            .replace(/[^a-zA-Z0-9\s]/g, " ")
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
        return (words[0] || "FM").slice(0, 3).toUpperCase();
    }

    function countryCodeToFlag(code) {
        const clean = String(code || "").trim().toUpperCase();
        if (!/^[A-Z]{2}$/.test(clean)) return "📻";
        return String.fromCodePoint(...[...clean].map(ch => 127397 + ch.charCodeAt(0)));
    }

    function countryFlagHtml(code) {
        const clean = String(code || "").trim().toUpperCase();
        if (!/^[A-Z]{2}$/.test(clean)) return `<span>🌐</span>`;
        const lower = clean.toLowerCase();
        return `<img class="nf-flag-img" src="https://flagcdn.com/w40/${lower}.png" alt="${clean}" loading="lazy" onerror="this.replaceWith(document.createTextNode('${clean}'))">`;
    }

    function getLocalTimeForZone(timeZone) {
        if (!timeZone) return "";
        try {
            return new Intl.DateTimeFormat(undefined, {
                timeZone,
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            }).format(new Date());
        } catch {
            return "";
        }
    }

    async function fetchJsonWithTimeout(url, timeoutMs = 8000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { signal: controller.signal });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } finally {
            clearTimeout(timer);
        }
    }

    async function fetchFamelackJson(path) {
        for (const root of FAMELACK_ROOTS) {
            try {
                const data = await fetchJsonWithTimeout(`${root}/${path}`, 8000);
                state.famelackBase = root;
                return data;
            } catch {
                // Try next mirror
            }
        }
        throw new Error(`All Famelack endpoints failed for ${path}`);
    }

    async function fetchRadioBrowser(path) {
        const ordered = [
            state.rbServer,
            ...RADIO_BROWSER_SERVERS.filter(s => s !== state.rbServer)
        ];
        for (const server of ordered) {
            try {
                const data = await fetchJsonWithTimeout(`${server}${path}`, 8500);
                state.rbServer = server;
                return data;
            } catch {
                // Rotate to next mirror
            }
        }
        throw new Error(`All Radio-Browser mirrors failed for ${path}`);
    }

    let toastTimer = null;
    function showToast(msg) {
        dom.toast.textContent = msg;
        dom.toast.classList.remove("hidden");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => dom.toast.classList.add("hidden"), 3200);
    }

    // --- STATION NORMALIZATION & DEDUPLICATION ---
    function inferCodec(url, rawCodec) {
        const path = String(url || "").split(/[?#]/)[0].toLowerCase();
        if (path.endsWith(".m3u8") || path.includes(".m3u8")) return "HLS";
        if (path.endsWith(".aac") || path.endsWith(".aacp") || /\/aac[-_/]|aacp/.test(path)) return "AAC";
        if (path.endsWith(".ogg") || path.endsWith(".opus") || /\/ogg[-_/]|opus/.test(path)) return "OGG";
        if (path.endsWith(".flac") || /\/flac/.test(path)) return "FLAC";
        if (path.endsWith(".mp3") || /\/mp3[-_/]/.test(path)) return "MP3";
        const cleanCodec = String(rawCodec || "").trim().toUpperCase();
        if (cleanCodec) return cleanCodec;
        return "MP3";
    }

    function normalizeFamelackStation(raw, fallbackCountryCode = "") {
        const streams = Array.isArray(raw?.sources?.streams) ? raw.sources.streams.filter(Boolean) : [];
        if (!streams.length) return null;
        const code = String(raw.country || fallbackCountryCode || "").toUpperCase();
        const meta = state.countriesMeta[code];
        return {
            id: `fl-${raw.nanoid || hashString(raw.name + streams[0])}`,
            name: String(raw.name || "Untitled Radio").trim(),
            country: meta?.country || code || "International",
            countryCode: code,
            streams: [...new Set(streams)],
            favicon: "",
            tags: Array.isArray(raw.categories) ? raw.categories : [],
            languages: Array.isArray(raw.languages) ? raw.languages : [],
            codec: inferCodec(streams[0]),
            bitrate: 0,
            votes: 0,
            homepage: "",
            isFeatured: false,
            isGeoBlocked: Boolean(raw.isGeoBlocked),
            source: "famelack"
        };
    }

    function normalizeRBStation(raw) {
        const urlResolved = String(raw?.url_resolved || "").trim();
        const urlDirect = String(raw?.url || "").trim();
        const streams = [...new Set([urlResolved, urlDirect].filter(Boolean))];
        if (!streams.length) return null;
        const code = String(raw.countrycode || "").toUpperCase();
        const meta = state.countriesMeta[code];
        const tags = String(raw.tags || "")
            .split(",")
            .map(t => t.trim())
            .filter(Boolean)
            .slice(0, 5);
        const rawFav = String(raw?.favicon || "").trim();
        const favicon = /^https?:\/\//i.test(rawFav) ? rawFav : "";
        return {
            id: `rb-${raw.stationuuid || hashString(raw.name + streams[0])}`,
            name: String(raw.name || "Untitled Station").trim(),
            country: meta?.country || String(raw.country || "Global").trim(),
            countryCode: code,
            streams,
            favicon,
            tags,
            languages: String(raw.language || "").split(",").map(s => s.trim()).filter(Boolean),
            codec: raw.hls === 1 ? "HLS" : inferCodec(streams[0], raw.codec),
            bitrate: Number(raw.bitrate) || 0,
            votes: Number(raw.votes) || 0,
            homepage: String(raw.homepage || "").trim(),
            isFeatured: (Number(raw.votes) || 0) >= 50000,
            isGeoBlocked: false,
            source: "radiobrowser"
        };
    }

    function normalizeCurated(raw) {
        return {
            ...raw,
            country: raw.country || state.countriesMeta[raw.countryCode]?.country || "Global",
            streams: [...new Set(raw.streams)],
            favicon: raw.favicon || "",
            tags: raw.tags || [],
            languages: raw.languages || ["english"],
            bitrate: raw.bitrate || 192,
            votes: 99999,
            homepage: raw.homepage || "",
            isGeoBlocked: false,
            source: "curated"
        };
    }

    function registerStation(st) {
        if (!st || !st.id) return st;
        state.stationRegistry.set(st.id, st);
        return st;
    }

    function mergeStations(primaryList, secondaryList) {
        const byKey = new Map();
        const result = [];

        const makeNameKey = s => `${s.name.toLowerCase().replace(/[^a-z0-9]/g, "")}|${s.countryCode}`;

        for (const st of [...primaryList, ...secondaryList]) {
            if (!st || !st.streams?.length) continue;
            const nameKey = makeNameKey(st);
            const existing = byKey.get(nameKey);
            if (existing) {
                existing.streams = [...new Set([...existing.streams, ...st.streams])];
                if (!existing.favicon && st.favicon) existing.favicon = st.favicon;
                if (!existing.bitrate && st.bitrate) existing.bitrate = st.bitrate;
                if (!existing.tags.length && st.tags.length) existing.tags = st.tags;
                if (!existing.homepage && st.homepage) existing.homepage = st.homepage;
                registerStation(existing);
            } else {
                const cloned = { ...st, streams: [...st.streams] };
                byKey.set(nameKey, cloned);
                registerStation(cloned);
                result.push(cloned);
            }
        }
        return result;
    }

    function getPlayableStreams(station) {
        if (!station || !Array.isArray(station.streams)) return [];
        let list = station.streams.filter(Boolean);
        // Prefer HTTPS streams first
        list.sort((a, b) => (b.startsWith("https://") ? 1 : 0) - (a.startsWith("https://") ? 1 : 0));
        if (state.httpsOnly) {
            list = list.filter(url => url.startsWith("https://") || url.startsWith("//"));
        }
        return list;
    }

    function filterStations(stations) {
        if (!state.httpsOnly) return stations;
        return stations.filter(st => getPlayableStreams(st).length > 0);
    }

    // --- PERSISTENCE (FAVORITES, HISTORY, PREFS) ---
    function loadPersistedState() {
        try {
            const favs = JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES) || "[]");
            if (Array.isArray(favs)) {
                state.favorites = favs.map(registerStation);
            }
        } catch { state.favorites = []; }

        try {
            const hist = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || "[]");
            if (Array.isArray(hist)) {
                state.history = hist.map(registerStation);
            }
        } catch { state.history = []; }

        try {
            const prefs = JSON.parse(localStorage.getItem(STORAGE_KEYS.PREFS) || "{}");
            if (typeof prefs.volume === "number") state.volume = Math.max(0, Math.min(100, prefs.volume));
            if (typeof prefs.httpsOnly === "boolean") state.httpsOnly = prefs.httpsOnly;
        } catch { /* ignore */ }

        dom.volumeSlider.value = state.volume;
        dom.audio.volume = state.volume / 100;
        dom.httpsOnlyToggle.checked = state.httpsOnly;
        updateFavBadges();
    }

    function savePrefs() {
        try {
            localStorage.setItem(STORAGE_KEYS.PREFS, JSON.stringify({
                volume: state.volume,
                httpsOnly: state.httpsOnly
            }));
        } catch { /* ignore */ }
    }

    function isFavorited(stationId) {
        return state.favorites.some(f => f.id === stationId);
    }

    function toggleFavorite(station) {
        if (!station) return;
        const idx = state.favorites.findIndex(f => f.id === station.id);
        if (idx >= 0) {
            state.favorites.splice(idx, 1);
            showToast(`Removed "${station.name}" from My List`);
        } else {
            state.favorites.unshift(station);
            showToast(`Added "${station.name}" to My List`);
        }
        try {
            localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(state.favorites.slice(0, 80)));
        } catch { /* ignore */ }

        updateFavBadges();
        refreshPersonalUI();
    }

    function recordHistory(station) {
        if (!station) return;
        state.history = [station, ...state.history.filter(h => h.id !== station.id)].slice(0, 24);
        try {
            localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(state.history));
        } catch { /* ignore */ }
        refreshPersonalUI();
    }

    function updateFavBadges() {
        const count = state.favorites.length;
        dom.navFavBadge.textContent = String(count);
        dom.navFavBadge.classList.toggle("hidden", count === 0);
        const menuFavCount = document.getElementById("menu-fav-count");
        if (menuFavCount) menuFavCount.textContent = String(count);

        if (state.currentStation) {
            const fav = isFavorited(state.currentStation.id);
            dom.dockFavBtn.classList.toggle("active", fav);
            dom.studioFavBtn.classList.toggle("active", fav);
            dom.studioFavLabel.textContent = fav ? "In My List" : "Save to My List";
        }
        const heroSt = state.heroPool[state.heroIndex];
        if (heroSt) {
            const heroFav = isFavorited(heroSt.id);
            dom.heroFavLabel.textContent = heroFav ? "In My List" : "My List";
        }
    }

    function refreshPersonalUI() {
        updateFavBadges();
        // Update visible My List / History row in Browse view if rendered
        const favTrack = document.getElementById("row-track-favorites");
        if (favTrack) renderRowTrack(favTrack, filterStations(state.favorites));
        const histTrack = document.getElementById("row-track-recent");
        if (histTrack) renderRowTrack(histTrack, filterStations(state.history));

        // Update My List tab view
        renderGrid(dom.myListFavoritesGrid, state.favorites, "No saved stations yet. Click + or ♥ on any station card to build your list.");
        renderGrid(dom.myListHistoryGrid, state.history, "Stations you listen to will appear here automatically.");

        // Update active card heart buttons
        document.querySelectorAll(".nf-card[data-station-id]").forEach(card => {
            const id = card.dataset.stationId;
            const favBtn = card.querySelector(".js-fav-btn");
            if (favBtn) favBtn.classList.toggle("active", isFavorited(id));
        });
    }

    // --- DATA FETCHERS ---
    async function loadCountriesMetadata() {
        try {
            const meta = await fetchFamelackJson("countries_metadata.json");
            state.countriesMeta = meta || {};
            state.countryCodeList = Object.entries(state.countriesMeta)
                .map(([code, info]) => ({ code: code.toUpperCase(), ...info }))
                .sort((a, b) => a.country.localeCompare(b.country));
            populateCountryDropdowns();
        } catch (err) {
            console.warn("Countries metadata failed:", err);
        }
    }

    function populateCountryDropdowns() {
        const frag = document.createDocumentFragment();
        const allOpt = document.createElement("option");
        allOpt.value = "";
        allOpt.textContent = "All Countries (Global)";
        frag.appendChild(allOpt);

        for (const item of state.countryCodeList) {
            const opt = document.createElement("option");
            opt.value = item.code;
            const countHint = item.channelCount ? ` (${item.channelCount})` : "";
            opt.textContent = `${countryCodeToFlag(item.code)} ${item.country}${countHint}`;
            frag.appendChild(opt);
        }
        dom.countrySelect.innerHTML = "";
        dom.countrySelect.appendChild(frag);
    }

    async function detectUserLocation() {
        try {
            const d = await fetchJsonWithTimeout("https://ipwho.is/", 4500);
            if (d && d.success && d.country_code) {
                state.userLocation = {
                    code: d.country_code.toUpperCase(),
                    country: d.country,
                    lat: d.latitude,
                    lon: d.longitude
                };
                updateNavClock();
                return;
            }
        } catch { /* fallback */ }

        try {
            const d = await fetchJsonWithTimeout("https://api.bigdatacloud.net/data/reverse-geocode-client", 4500);
            if (d && d.countryCode) {
                state.userLocation = {
                    code: d.countryCode.toUpperCase(),
                    country: d.countryName || d.countryCode,
                    lat: d.latitude || 7.87,
                    lon: d.longitude || 80.77
                };
                updateNavClock();
                return;
            }
        } catch { /* fallback to LK */ }

        updateNavClock();
    }

    function updateNavClock() {
        const code = state.userLocation.code;
        const meta = state.countriesMeta[code];
        dom.navLocFlag.innerHTML = countryFlagHtml(code);
        dom.navLocName.textContent = meta?.country || state.userLocation.country || code;
        const timeStr = getLocalTimeForZone(meta?.timeZone);
        dom.navLocClock.textContent = timeStr || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    }

    async function getStationsForCountry(code) {
        const upper = String(code || "").toUpperCase();
        if (!upper) return [];
        if (state.countryCache.has(upper)) return state.countryCache.get(upper);

        const meta = state.countriesMeta[upper];
        const famelackPromise = meta?.hasChannels
            ? fetchFamelackJson(`countries/${upper.toLowerCase()}.json`)
                .then(list => (Array.isArray(list) ? list.map(s => normalizeFamelackStation(s, upper)).filter(Boolean) : []))
                .catch(() => [])
            : Promise.resolve([]);

        const rbPromise = fetchRadioBrowser(`/json/stations/bycountrycodeexact/${encodeURIComponent(upper)}?limit=60&hidebroken=true&order=votes&reverse=true`)
            .then(list => (Array.isArray(list) ? list.map(normalizeRBStation).filter(Boolean) : []))
            .catch(() => []);

        const [flList, rbList] = await Promise.all([famelackPromise, rbPromise]);
        const merged = mergeStations(flList, rbList);
        state.countryCache.set(upper, merged);
        return merged;
    }

    async function getStationsForGenre(slug, limit = 30) {
        const key = `${slug}:${limit}`;
        if (state.categoryCache.has(key)) return state.categoryCache.get(key);

        const famelackSlugMap = {
            chill: "chill",
            pop: "pop",
            hits: "hits",
            rock: "rock",
            electronic: "electronic",
            jazz: "jazz",
            classical: "classical",
            "hip-hop": "hip-hop",
            "80s": "80s",
            "90s": "90s",
            indie: "indie",
            news: "news",
            talk: "talk",
            sports: "sports"
        };

        const flPromise = famelackSlugMap[slug]
            ? fetchFamelackJson(`categories/${famelackSlugMap[slug]}.json`)
                .then(list => (Array.isArray(list) ? list.slice(0, limit).map(s => normalizeFamelackStation(s)).filter(Boolean) : []))
                .catch(() => [])
            : Promise.resolve([]);

        const rbPromise = fetchRadioBrowser(`/json/stations/bytag/${encodeURIComponent(slug)}?limit=${limit}&hidebroken=true&order=votes&reverse=true`)
            .then(list => (Array.isArray(list) ? list.map(normalizeRBStation).filter(Boolean) : []))
            .catch(() => []);

        const [flList, rbList] = await Promise.all([flPromise, rbPromise]);
        const merged = mergeStations(rbList, flList).slice(0, limit);
        state.categoryCache.set(key, merged);
        return merged;
    }

    // --- RENDERING HELPERS ---
    function buildStationCard(station, options = {}) {
        const { rank = null, isTop10 = false } = options;
        registerStation(station);
        const [c1, c2] = getPalette(station.id + station.name);
        const flagHtml = countryFlagHtml(station.countryCode);
        const isPlaying = state.currentStation?.id === station.id && state.playbackStatus === "playing";
        const isFav = isFavorited(station.id);
        const playable = getPlayableStreams(station);
        const primaryUrl = playable[0] || station.streams[0] || "";
        const isHls = station.codec === "HLS" || primaryUrl.includes(".m3u8");
        const isHd = station.bitrate >= 192;

        const card = document.createElement("article");
        card.className = `nf-card${isPlaying ? " is-playing" : ""}`;
        card.dataset.stationId = station.id;

        const metaBadge = isHls
            ? `<span class="nf-card-badge hls">HLS</span>`
            : isHd
                ? `<span class="nf-card-badge hd">${station.bitrate}k</span>`
                : `<span class="nf-card-badge">${escapeHtml(station.codec || "LIVE")}</span>`;

        const tagText = station.tags.length
            ? station.tags.slice(0, 3).join(" • ")
            : (station.languages[0] ? station.languages[0].toUpperCase() : "Live Stream");

        card.innerHTML = `
            <div class="nf-card-cover" style="background: linear-gradient(135deg, ${c1}, ${c2});">
                ${station.isFeatured || station.source === "curated"
                    ? `<span class="nf-card-n-corner" title="Featured Broadcast">${NETFLIX_N_SVG}</span>`
                    : ""}
                <div class="nf-card-top-right">
                    ${metaBadge}
                </div>
                <div class="nf-card-art-bg">
                    <span class="nf-card-monogram">${escapeHtml(getInitials(station.name))}</span>
                </div>
                ${station.favicon
                    ? `<img class="js-card-logo" src="${escapeHtml(station.favicon)}" alt="" loading="lazy">`
                    : ""}
                <div class="nf-card-overlay">
                    <button type="button" class="nf-card-quick-play js-play-btn" title="Listen Live" aria-label="Play ${escapeHtml(station.name)}">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                    <div class="nf-card-mini-actions">
                        <button type="button" class="nf-card-mini-btn js-fav-btn${isFav ? " active" : ""}" title="Save to My List" aria-label="Favorite ${escapeHtml(station.name)}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                        </button>
                        <button type="button" class="nf-card-mini-btn js-info-btn" title="Studio Info &amp; Mirrors" aria-label="Details for ${escapeHtml(station.name)}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            <div class="nf-card-body">
                <div class="nf-card-title" title="${escapeHtml(station.name)}">${escapeHtml(station.name)}</div>
                <div class="nf-card-meta">
                    <span class="nf-card-country">${flagHtml} <span>${escapeHtml(station.country)}</span></span>
                    ${isPlaying
                        ? `<span class="nf-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`
                        : `<span>${station.streams.length > 1 ? `${station.streams.length} streams` : "Live"}</span>`}
                </div>
                <div class="nf-card-tags">${escapeHtml(tagText)}</div>
            </div>
        `;

        const coverEl = card.querySelector(".nf-card-cover");
        const logoImg = card.querySelector(".js-card-logo");
        if (logoImg) {
            if (logoImg.complete && logoImg.naturalWidth > 0) {
                coverEl.classList.add("has-logo");
            }
            logoImg.addEventListener("load", () => coverEl.classList.add("has-logo"));
            logoImg.addEventListener("error", () => logoImg.remove());
        }

        card.addEventListener("click", e => {
            if (e.target.closest(".js-fav-btn")) {
                e.stopPropagation();
                toggleFavorite(station);
                return;
            }
            if (e.target.closest(".js-info-btn")) {
                e.stopPropagation();
                openStudioModal(station);
                return;
            }
            const rowQueue = options.queue || [station];
            tuneStation(station, rowQueue);
        });

        if (isTop10 && rank !== null) {
            const wrapper = document.createElement("div");
            wrapper.className = "nf-top10-item";
            const rankEl = document.createElement("span");
            rankEl.className = "nf-top10-rank";
            rankEl.textContent = String(rank);
            wrapper.appendChild(rankEl);
            wrapper.appendChild(card);
            return wrapper;
        }
        return card;
    }

    function renderRowTrack(trackEl, stations, isTop10 = false) {
        trackEl.innerHTML = "";
        if (!stations || !stations.length) {
            const empty = document.createElement("div");
            empty.className = "nf-empty-inline";
            empty.textContent = "No stations match current filter.";
            trackEl.appendChild(empty);
            return;
        }
        const frag = document.createDocumentFragment();
        stations.forEach((st, idx) => {
            frag.appendChild(buildStationCard(st, {
                rank: isTop10 ? idx + 1 : null,
                isTop10,
                queue: stations
            }));
        });
        trackEl.appendChild(frag);
        requestAnimationFrame(() => updateScrollArrows(trackEl));
    }

    function renderGrid(gridEl, stations, emptyMessage = "No matching radio stations found.") {
        gridEl.innerHTML = "";
        const list = filterStations(stations);
        if (!list.length) {
            const box = document.createElement("div");
            box.className = "nf-empty-box";
            box.textContent = emptyMessage;
            gridEl.appendChild(box);
            return;
        }
        const frag = document.createDocumentFragment();
        list.forEach(st => frag.appendChild(buildStationCard(st, { queue: list })));
        gridEl.appendChild(frag);
    }

    function createRowSection({ id, title, subtitle = "", isTop10 = false, skeletonCount = 8 }) {
        const section = document.createElement("section");
        section.className = "nf-row";
        section.id = `row-sec-${id}`;
        section.innerHTML = `
            <div class="nf-row-head">
                <div class="nf-row-title-wrap">
                    <span class="nf-row-accent-bar"></span>
                    <h2 class="nf-row-title" id="row-title-${id}">${escapeHtml(title)}</h2>
                </div>
                <span class="nf-row-count" id="row-count-${id}">${escapeHtml(subtitle)}</span>
            </div>
            <div class="nf-carousel-wrap">
                <button type="button" class="nf-scroll-arrow left" aria-label="Scroll left">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                </button>
                <div class="nf-carousel-track" id="row-track-${id}"></div>
                <button type="button" class="nf-scroll-arrow right" aria-label="Scroll right">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>
                </button>
            </div>
        `;

        const track = section.querySelector(".nf-carousel-track");
        const leftBtn = section.querySelector(".nf-scroll-arrow.left");
        const rightBtn = section.querySelector(".nf-scroll-arrow.right");

        for (let i = 0; i < skeletonCount; i++) {
            const sk = document.createElement("div");
            sk.className = "nf-skeleton-card";
            track.appendChild(sk);
        }

        leftBtn.addEventListener("click", () => track.scrollBy({ left: -Math.max(400, track.clientWidth * 0.78), behavior: "smooth" }));
        rightBtn.addEventListener("click", () => track.scrollBy({ left: Math.max(400, track.clientWidth * 0.78), behavior: "smooth" }));
        track.addEventListener("scroll", () => updateScrollArrows(track), { passive: true });

        return { section, track, titleEl: section.querySelector(`#row-title-${id}`), countEl: section.querySelector(`#row-count-${id}`), isTop10 };
    }

    function updateScrollArrows(track) {
        const wrap = track.parentElement;
        if (!wrap) return;
        const left = wrap.querySelector(".nf-scroll-arrow.left");
        const right = wrap.querySelector(".nf-scroll-arrow.right");
        if (!left || !right) return;
        left.classList.toggle("visible", track.scrollLeft > 12);
        right.classList.toggle("visible", track.scrollLeft + track.clientWidth < track.scrollWidth - 12);
    }

    // --- BROWSE ROWS ORCHESTRATION ---
    async function buildBrowseRows() {
        const container = dom.browseRowsContainer;
        container.innerHTML = "";

        const curated = CURATED_MIXES.map(normalizeCurated);
        curated.forEach(registerStation);

        // Prepare Hero Pool from top curated streams
        state.heroPool = curated.slice(0, 6);
        renderHero();

        // 1. Optional Personal Rows (Recently Played & My List)
        if (state.history.length > 0) {
            const recentRow = createRowSection({ id: "recent", title: "Continue Listening", subtitle: `${state.history.length} recent` });
            container.appendChild(recentRow.section);
            renderRowTrack(recentRow.track, filterStations(state.history));
        }
        if (state.favorites.length > 0) {
            const favRow = createRowSection({ id: "favorites", title: "My List", subtitle: `${state.favorites.length} saved` });
            container.appendChild(favRow.section);
            renderRowTrack(favRow.track, filterStations(state.favorites));
        }

        // 2. Curated Studio Mixes (Instant render!)
        const curatedRow = createRowSection({ id: "curated", title: "Netflix Studio Mixes — 320k & Artist Channels", subtitle: `${curated.length} curated` });
        container.appendChild(curatedRow.section);
        renderRowTrack(curatedRow.track, filterStations(curated));

        // 3. Top 10 Global Stations Today
        const top10Row = createRowSection({ id: "top10", title: "Top 10 Global Stations Today", subtitle: "Most voted worldwide", isTop10: true, skeletonCount: 6 });
        container.appendChild(top10Row.section);

        // 4. Local Country Spotlight
        const userCode = state.userLocation.code;
        const localMeta = state.countriesMeta[userCode];
        const localCountryName = localMeta?.country || state.userLocation.country || "Your Region";
        const localTime = getLocalTimeForZone(localMeta?.timeZone);
        const localRow = createRowSection({
            id: "local",
            title: `Popular in ${countryCodeToFlag(userCode)} ${localCountryName}`,
            subtitle: localTime ? `Local time ${localTime}` : "Local broadcast"
        });
        container.appendChild(localRow.section);

        // 5. Genre Rows (Lazy-loaded via IntersectionObserver or parallel batches)
        const genreDefs = [
            { id: "chill", title: "Chill, Lo-Fi & Late Night Vibes", tag: "chill" },
            { id: "pop", title: "Pop, Hits & Global Charts", tag: "pop" },
            { id: "rock", title: "Rock, Classic & Indie", tag: "rock" },
            { id: "electronic", title: "Electronic, House & Synthwave", tag: "electronic" },
            { id: "jazz", title: "Jazz, Classical & Acoustic", tag: "jazz" },
            { id: "news", title: "World News, Talk & Sports", tag: "news" }
        ];

        const genreRows = genreDefs.map(g => {
            const row = createRowSection({ id: g.id, title: g.title, subtitle: "Live stations" });
            container.appendChild(row.section);
            return { ...g, row };
        });

        // Load Top 10 + Local immediately
        fetchRadioBrowser("/json/stations/topvote/10?hidebroken=true")
            .then(raw => {
                const top10 = (Array.isArray(raw) ? raw : []).map(normalizeRBStation).filter(Boolean).slice(0, 10);
                top10.forEach(s => { s.isFeatured = true; registerStation(s); });
                renderRowTrack(top10Row.track, filterStations(top10), true);
                if (top10.length) {
                    state.heroPool = [...curated.slice(0, 4), ...top10.slice(0, 4)];
                }
            })
            .catch(() => {
                renderRowTrack(top10Row.track, curated.slice(0, 10), true);
            });

        getStationsForCountry(userCode)
            .then(localStations => {
                const filtered = filterStations(localStations);
                localRow.countEl.textContent = `${filtered.length} stations${localTime ? ` • ${localTime}` : ""}`;
                renderRowTrack(localRow.track, filtered);
            });

        // Load Genre Rows smoothly
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const match = genreRows.find(g => g.row.section === entry.target);
                if (!match) return;
                obs.unobserve(entry.target);
                getStationsForGenre(match.tag, 26).then(stations => {
                    const list = filterStations(stations);
                    match.row.countEl.textContent = `${list.length} channels`;
                    renderRowTrack(match.row.track, list);
                });
            });
        }, { rootMargin: "320px" });

        genreRows.forEach(g => observer.observe(g.row.section));
    }

    function renderHero() {
        const station = state.heroPool[state.heroIndex] || normalizeCurated(CURATED_MIXES[0]);
        if (!station) return;
        const [accent1, accent2] = getPalette(station.id + station.name);
        dom.heroSection.style.setProperty("--hero-accent", accent1);
        dom.heroSection.style.setProperty("--hero-accent-2", accent2);

        dom.heroTitle.textContent = station.name;
        const tagLine = station.tags.length ? station.tags.slice(0, 3).join(" • ").toUpperCase() : "LIVE BROADCAST";
        dom.heroDesc.textContent = `Streaming live from ${station.country}. Enjoy ${tagLine} with automatic multi-mirror failover, zero ads, and studio audio controls.`;
        dom.heroCountryChip.innerHTML = `${countryFlagHtml(station.countryCode)} <span>${escapeHtml(station.country)}</span>`;
        dom.heroCodecChip.textContent = `${station.codec || "MP3"}${station.bitrate ? ` • ${station.bitrate} kbps` : ""}`;
        dom.heroGenreChip.textContent = station.tags.slice(0, 2).join(" / ") || "Global Radio";

        const isThisPlaying = state.currentStation?.id === station.id && state.playbackStatus === "playing";
        dom.heroPlayLabel.textContent = isThisPlaying ? "Pause Stream" : "Listen Live";
        dom.heroPlayIcon.classList.toggle("hidden", isThisPlaying);
        dom.heroPauseIcon.classList.toggle("hidden", !isThisPlaying);
        updateFavBadges();
    }

    // --- SEARCH & FILTERING ---
    let searchDebounceTimer = null;
    async function runSearchOrFilter() {
        const query = state.searchQuery.trim();
        const genre = state.selectedGenre;
        const country = state.selectedCountry;

        const isFiltered = query.length >= 2 || genre !== "all" || Boolean(country);
        dom.searchResultsSection.classList.toggle("hidden", !isFiltered);
        dom.browseRowsContainer.classList.toggle("hidden", isFiltered);

        if (!isFiltered) return;

        dom.searchResultsGrid.innerHTML = "";
        for (let i = 0; i < 8; i++) {
            const sk = document.createElement("div");
            sk.className = "nf-skeleton-card";
            sk.style.width = "100%";
            dom.searchResultsGrid.appendChild(sk);
        }

        const parts = [];
        if (query) parts.push(`"${query}"`);
        if (genre !== "all") parts.push(genre.toUpperCase());
        if (country) parts.push(`${countryCodeToFlag(country)} ${state.countriesMeta[country]?.country || country}`);
        dom.searchResultsTitle.textContent = `Results for ${parts.join(" • ")}`;
        dom.searchResultsSubtitle.textContent = "Querying Famelack & Radio-Browser directories...";

        try {
            let results = [];
            if (country && !query && genre === "all") {
                results = await getStationsForCountry(country);
            } else if (genre !== "all" && !query && !country) {
                results = await getStationsForGenre(genre, 48);
            } else {
                const params = new URLSearchParams({
                    limit: "60",
                    hidebroken: "true",
                    order: "votes",
                    reverse: "true"
                });
                if (query) params.set("name", query);
                if (genre !== "all") params.set("tag", genre);
                if (country) params.set("countrycode", country);

                const rbPromise = fetchRadioBrowser(`/json/stations/search?${params.toString()}`)
                    .then(list => (Array.isArray(list) ? list.map(normalizeRBStation).filter(Boolean) : []))
                    .catch(() => []);

                // Also filter matching cached Famelack/curated stations locally
                const qLower = query.toLowerCase();
                const localMatches = [...state.stationRegistry.values()].filter(st => {
                    const matchQ = !qLower || st.name.toLowerCase().includes(qLower) || st.tags.some(t => t.toLowerCase().includes(qLower)) || st.country.toLowerCase().includes(qLower);
                    const matchC = !country || st.countryCode === country;
                    const matchG = genre === "all" || st.tags.some(t => t.toLowerCase().includes(genre));
                    return matchQ && matchC && matchG;
                });

                const rbList = await rbPromise;
                results = mergeStations(localMatches, rbList);
            }

            const finalResults = filterStations(results);
            dom.searchResultsSubtitle.textContent = `${finalResults.length} playable station${finalResults.length === 1 ? "" : "s"} found`;
            renderGrid(dom.searchResultsGrid, finalResults);
        } catch (err) {
            dom.searchResultsSubtitle.textContent = "Could not reach search directory.";
            renderGrid(dom.searchResultsGrid, []);
        }
    }

    // --- AUDIO ENGINE WITH HLS.JS + MULTI-MIRROR ROTATION ---
    function destroyHls() {
        if (state.hls) {
            try { state.hls.destroy(); } catch { /* ignore */ }
            state.hls = null;
        }
    }

    function clearMirrorTimer() {
        if (state.mirrorTimer) {
            clearTimeout(state.mirrorTimer);
            state.mirrorTimer = null;
        }
    }

    function setPlaybackStatus(status, customLabel = null) {
        state.playbackStatus = status;

        const isPlaying = status === "playing";
        const isLoading = status === "loading";

        dom.playerDock.classList.toggle("is-playing", isPlaying);
        dom.studioDisc.classList.toggle("spinning", isPlaying);
        dom.playIconSvg.classList.toggle("hidden", isPlaying || isLoading);
        dom.pauseIconSvg.classList.toggle("hidden", !isPlaying);
        dom.playBtnSpinner.classList.toggle("hidden", !isLoading);

        const pillConfig = {
            idle: { cls: "idle", text: "IDLE" },
            loading: { cls: "loading", text: customLabel || "CONNECTING" },
            playing: { cls: "live", text: "LIVE ON AIR" },
            paused: { cls: "idle", text: "PAUSED" },
            error: { cls: "error", text: customLabel || "OFFLINE" }
        }[status] || { cls: "idle", text: "IDLE" };

        [dom.dockStatusPill, dom.studioStatusPill].forEach(el => {
            el.className = `nf-status-pill ${pillConfig.cls}`;
            el.textContent = pillConfig.text;
        });

        dom.studioPlayLabel.textContent = isPlaying ? "Pause Stream" : "Listen Live";
        dom.studioPlayIcon.classList.toggle("hidden", isPlaying);
        dom.studioPauseIcon.classList.toggle("hidden", !isPlaying);
        renderHero();

        // Update active card highlights
        document.querySelectorAll(".nf-card[data-station-id]").forEach(card => {
            card.classList.toggle("is-playing", isPlaying && card.dataset.stationId === state.currentStation?.id);
        });
        document.querySelectorAll(".nf-list-item[data-station-id]").forEach(item => {
            item.classList.toggle("is-playing", isPlaying && item.dataset.stationId === state.currentStation?.id);
        });
    }

    function updatePlayerMetadataUI(station) {
        if (!station) return;
        dom.playerDock.classList.remove("hidden");
        document.body.classList.add("has-dock");

        dom.dockStationName.textContent = station.name;
        const meta = state.countriesMeta[station.countryCode];
        const localClock = getLocalTimeForZone(meta?.timeZone);
        dom.dockCountryMeta.innerHTML = `${countryFlagHtml(station.countryCode)} <span>${escapeHtml(station.country)}${localClock ? ` • ${localClock}` : ""} • ${escapeHtml(station.codec || "LIVE")}</span>`;

        dom.dockLogoFallback.textContent = getInitials(station.name);
        dom.studioArtFallback.textContent = getInitials(station.name);

        if (station.favicon) {
            dom.dockLogoImg.src = station.favicon;
            dom.dockLogoImg.classList.remove("hidden");
            dom.dockLogoFallback.classList.add("hidden");
            dom.dockLogoImg.onerror = () => {
                dom.dockLogoImg.classList.add("hidden");
                dom.dockLogoFallback.classList.remove("hidden");
            };

            dom.studioArtImg.src = station.favicon;
            dom.studioArtImg.classList.remove("hidden");
            dom.studioArtFallback.classList.add("hidden");
            dom.studioArtImg.onerror = () => {
                dom.studioArtImg.classList.add("hidden");
                dom.studioArtFallback.classList.remove("hidden");
            };
        } else {
            dom.dockLogoImg.classList.add("hidden");
            dom.dockLogoFallback.classList.remove("hidden");
            dom.studioArtImg.classList.add("hidden");
            dom.studioArtFallback.classList.remove("hidden");
        }

        // Studio modal text
        dom.studioTitle.textContent = station.name;
        dom.studioSubtitle.textContent = `${countryCodeToFlag(station.countryCode)} ${station.country}${localClock ? ` (${localClock})` : ""}${station.languages.length ? ` • ${station.languages.join(", ").toUpperCase()}` : ""}`;

        dom.studioChips.innerHTML = "";
        const chipLabels = [
            station.codec || "Audio",
            station.bitrate ? `${station.bitrate} kbps` : null,
            ...station.tags.slice(0, 4)
        ].filter(Boolean);
        chipLabels.forEach(txt => {
            const span = document.createElement("span");
            span.className = "nf-meta-pill";
            span.textContent = txt;
            dom.studioChips.appendChild(span);
        });

        if (station.homepage) {
            dom.studioHomepageLink.href = station.homepage;
            dom.studioHomepageLink.classList.remove("hidden");
        } else {
            dom.studioHomepageLink.classList.add("hidden");
        }

        renderStudioMirrors(station);
        renderStudioUpNext();
        updateFavBadges();
        updateMediaSession(station);
    }

    function updateMediaSession(station) {
        if (!("mediaSession" in navigator) || !station) return;
        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: station.name,
                artist: `${station.country} • Netflix Radio`,
                album: station.tags.slice(0, 2).join(" / ") || "Live Stream",
                artwork: station.favicon ? [{ src: station.favicon, sizes: "192x192", type: "image/png" }] : []
            });
            navigator.mediaSession.setActionHandler("play", () => togglePlayPause());
            navigator.mediaSession.setActionHandler("pause", () => togglePlayPause());
            navigator.mediaSession.setActionHandler("previoustrack", () => playAdjacentStation(-1));
            navigator.mediaSession.setActionHandler("nexttrack", () => playAdjacentStation(1));
        } catch { /* ignore unsupported fields */ }
    }

    async function tuneStation(station, queue = null, startMirrorIndex = 0) {
        if (!station) return;
        registerStation(station);

        const token = ++state.tuneToken;
        state.currentStation = station;
        if (Array.isArray(queue) && queue.length) {
            state.currentQueue = queue;
        } else if (!state.currentQueue.some(s => s.id === station.id)) {
            state.currentQueue = [station, ...state.currentQueue];
        }

        const streams = getPlayableStreams(station);
        if (!streams.length) {
            updatePlayerMetadataUI(station);
            setPlaybackStatus("error", "HTTP ONLY");
            showToast(`"${station.name}" has no HTTPS stream under HTTPS Safe mode.`);
            return;
        }

        recordHistory(station);
        updatePlayerMetadataUI(station);
        await attemptStreamIndex(station, streams, startMirrorIndex, token);
    }

    async function attemptStreamIndex(station, streams, index, token) {
        if (token !== state.tuneToken) return;
        clearMirrorTimer();
        destroyHls();
        if (state.cleanupAudioListeners) {
            state.cleanupAudioListeners();
            state.cleanupAudioListeners = null;
        }

        if (index >= streams.length) {
            setPlaybackStatus("error", "OFFLINE");
            showToast(`"${station.name}" stream is offline or blocked by broadcaster.`);
            return;
        }

        state.currentStreamIndex = index;
        renderStudioMirrors(station);

        const url = streams[index].startsWith("//") ? `https:${streams[index]}` : streams[index];
        const statusLabel = streams.length > 1 ? `MIRROR ${index + 1}/${streams.length}` : "CONNECTING";
        setPlaybackStatus("loading", statusLabel);

        const audio = dom.audio;
        try {
            audio.pause();
            audio.removeAttribute("src");
            audio.load();
        } catch { /* ignore */ }

        let settled = false;
        const cleanup = () => {
            audio.removeEventListener("playing", onPlayingOnce);
            audio.removeEventListener("error", onErrorOnce);
        };

        const failAndRotate = reason => {
            if (settled || token !== state.tuneToken) return;
            settled = true;
            cleanup();
            clearMirrorTimer();
            console.warn(`[Radio] Mirror ${index + 1} failed (${reason}): ${url}`);
            attemptStreamIndex(station, streams, index + 1, token);
        };

        // 11s connection timeout watchdog
        state.mirrorTimer = setTimeout(() => failAndRotate("timeout"), 11000);

        const onPlayingOnce = () => {
            if (token !== state.tuneToken) return;
            settled = true;
            cleanup();
            clearMirrorTimer();
            setPlaybackStatus("playing");
        };

        const onErrorOnce = () => {
            failAndRotate("media error");
        };

        state.cleanupAudioListeners = cleanup;
        audio.addEventListener("playing", onPlayingOnce, { once: true });
        audio.addEventListener("error", onErrorOnce, { once: true });

        const isHls = url.toLowerCase().includes(".m3u8") || station.codec === "HLS";

        if (isHls && typeof window.Hls !== "undefined" && window.Hls.isSupported()) {
            const hls = new window.Hls({
                enableWorker: true,
                lowLatencyMode: true,
                manifestLoadingTimeOut: 9000
            });
            state.hls = hls;
            hls.loadSource(url);
            hls.attachMedia(audio);
            hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                if (token !== state.tuneToken) return;
                audio.play().catch(err => {
                    if (err?.name === "NotAllowedError") {
                        clearMirrorTimer();
                        settled = true;
                        setPlaybackStatus("paused");
                        showToast("Click Play to allow browser audio playback.");
                    } else {
                        failAndRotate("hls play rejected");
                    }
                });
            });
            hls.on(window.Hls.Events.ERROR, (_, data) => {
                if (data && data.fatal) {
                    failAndRotate(`hls ${data.type}`);
                }
            });
        } else {
            audio.src = url;
            audio.load();
            audio.play().catch(err => {
                if (err?.name === "NotAllowedError") {
                    clearMirrorTimer();
                    settled = true;
                    setPlaybackStatus("paused");
                    showToast("Click Play to allow browser audio playback.");
                } else {
                    failAndRotate("play rejected");
                }
            });
        }
    }

    function togglePlayPause() {
        if (!state.currentStation) {
            const hero = state.heroPool[state.heroIndex];
            if (hero) tuneStation(hero, state.heroPool);
            return;
        }
        const audio = dom.audio;
        if (state.playbackStatus === "playing") {
            audio.pause();
            setPlaybackStatus("paused");
        } else if (state.playbackStatus === "error" || !audio.src) {
            tuneStation(state.currentStation, state.currentQueue, 0);
        } else {
            setPlaybackStatus("loading", "RESUMING");
            audio.play()
                .then(() => setPlaybackStatus("playing"))
                .catch(() => tuneStation(state.currentStation, state.currentQueue, 0));
        }
    }

    function playAdjacentStation(delta) {
        const q = state.currentQueue.length ? state.currentQueue : state.heroPool;
        if (!q.length) return;
        const idx = q.findIndex(s => s.id === state.currentStation?.id);
        const nextIdx = idx < 0 ? 0 : (idx + delta + q.length) % q.length;
        tuneStation(q[nextIdx], q);
    }

    async function tuneRandomWorldwide() {
        showToast("Scanning global frequencies for a live broadcast...");
        try {
            const raw = await fetchRadioBrowser("/json/stations/topclick/40?hidebroken=true");
            const pool = filterStations((Array.isArray(raw) ? raw : []).map(normalizeRBStation).filter(Boolean));
            const fallbackPool = [...CURATED_MIXES.map(normalizeCurated), ...pool];
            const pick = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
            if (pick) tuneStation(pick, fallbackPool);
        } catch {
            const curated = CURATED_MIXES.map(normalizeCurated);
            const pick = curated[Math.floor(Math.random() * curated.length)];
            tuneStation(pick, curated);
        }
    }

    // --- SLEEP TIMER ---
    function setSleepTimer(minutes) {
        clearInterval(state.sleepTimerInterval);
        state.sleepTimerInterval = null;
        state.sleepTimerEnd = null;
        dom.sleepTimerBadge.classList.add("hidden");
        dom.sleepTimerMenu.classList.add("hidden");

        if (!minutes || minutes <= 0) {
            showToast("Sleep timer turned off");
            return;
        }

        state.sleepTimerEnd = Date.now() + minutes * 60 * 1000;
        showToast(`Sleep timer set for ${minutes} minutes`);

        const tick = () => {
            const remainingMs = state.sleepTimerEnd - Date.now();
            if (remainingMs <= 0) {
                clearInterval(state.sleepTimerInterval);
                state.sleepTimerEnd = null;
                dom.sleepTimerBadge.classList.add("hidden");
                dom.audio.pause();
                setPlaybackStatus("paused");
                showToast("Sleep timer ended — playback paused");
                return;
            }
            const minsLeft = Math.ceil(remainingMs / 60000);
            dom.sleepTimerBadge.textContent = `${minsLeft}m`;
            dom.sleepTimerBadge.classList.remove("hidden");
        };
        tick();
        state.sleepTimerInterval = setInterval(tick, 15000);
    }

    // --- STUDIO MODAL ---
    function openStudioModal(station = state.currentStation) {
        if (!station) return;
        if (state.currentStation?.id !== station.id) {
            updatePlayerMetadataUI(station);
        }
        dom.studioModal.classList.remove("hidden");
        document.body.style.overflow = "hidden";
    }

    function closeStudioModal() {
        dom.studioModal.classList.add("hidden");
        document.body.style.overflow = "";
    }

    function renderStudioMirrors(station) {
        const list = dom.studioMirrorList;
        list.innerHTML = "";
        const streams = getPlayableStreams(station);
        if (!streams.length) {
            list.innerHTML = `<div class="nf-empty-inline">No HTTPS-safe stream URLs available. Toggle off "HTTPS Safe" if running locally.</div>`;
            return;
        }
        streams.forEach((url, i) => {
            const btn = document.createElement("button");
            btn.type = "button";
            const isActive = state.currentStation?.id === station.id && state.currentStreamIndex === i;
            btn.className = `nf-mirror-btn${isActive ? " active" : ""}`;
            const proto = url.startsWith("https://") ? "HTTPS" : "HTTP";
            const fmt = inferCodec(url, station.codec);
            btn.innerHTML = `
                <span class="nf-mirror-url">#${i + 1} • ${escapeHtml(url)}</span>
                <span class="nf-card-badge">${proto} • ${fmt}</span>
            `;
            btn.addEventListener("click", () => tuneStation(station, state.currentQueue, i));
            list.appendChild(btn);
        });
    }

    function renderStudioUpNext() {
        const list = dom.studioUpNextList;
        list.innerHTML = "";
        const q = state.currentQueue.filter(s => s.id !== state.currentStation?.id).slice(0, 8);
        if (!q.length) {
            list.innerHTML = `<div class="nf-empty-inline">Select a playlist row or country to queue stations.</div>`;
            return;
        }
        q.forEach(st => list.appendChild(buildCompactListItem(st, state.currentQueue)));
    }

    function buildCompactListItem(station, queue) {
        registerStation(station);
        const [c1, c2] = getPalette(station.id + station.name);
        const isPlaying = state.currentStation?.id === station.id && state.playbackStatus === "playing";
        const item = document.createElement("button");
        item.type = "button";
        item.className = `nf-list-item${isPlaying ? " is-playing" : ""}`;
        item.dataset.stationId = station.id;

        item.innerHTML = `
            <div class="nf-list-thumb" style="background: linear-gradient(135deg, ${c1}, ${c2});">
                ${station.favicon ? `<img src="${escapeHtml(station.favicon)}" alt="" loading="lazy" onerror="this.remove()">` : ""}
                <span>${escapeHtml(getInitials(station.name))}</span>
            </div>
            <div class="nf-list-info">
                <div class="nf-list-title">${escapeHtml(station.name)}</div>
                <div class="nf-list-sub">${countryFlagHtml(station.countryCode)} <span>${escapeHtml(station.country)} • ${escapeHtml(station.codec || "MP3")}${station.bitrate ? ` ${station.bitrate}k` : ""}</span></div>
            </div>
            <span class="nf-card-badge">${isPlaying ? "LIVE" : "PLAY"}</span>
        `;

        const img = item.querySelector("img");
        if (img) {
            img.addEventListener("load", () => {
                const span = item.querySelector(".nf-list-thumb span");
                if (span) span.style.display = "none";
            });
        }

        item.addEventListener("click", () => tuneStation(station, queue));
        return item;
    }

    // --- CANVAS VISUALIZERS (HERO WAVE + STUDIO SPECTRUM) ---
    function startVisualizers() {
        let phase = 0;
        const heroCanvas = dom.heroWaveCanvas;
        const heroCtx = heroCanvas.getContext("2d");
        const vizCanvas = dom.studioVizCanvas;
        const vizCtx = vizCanvas.getContext("2d");

        function drawFrame() {
            const playing = state.playbackStatus === "playing";
            const energy = playing ? (0.45 + (state.volume / 100) * 0.65) : 0.14;
            phase += playing ? 0.045 : 0.014;

            // 1. Hero ambient wave (only when browse view is visible)
            if (!dom.views.browse.classList.contains("hidden")) {
                const rect = heroCanvas.getBoundingClientRect();
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                const w = Math.floor(rect.width * dpr);
                const h = Math.floor(rect.height * dpr);
                if (w > 0 && h > 0) {
                    if (heroCanvas.width !== w || heroCanvas.height !== h) {
                        heroCanvas.width = w;
                        heroCanvas.height = h;
                    }
                    heroCtx.clearRect(0, 0, w, h);
                    const waves = [
                        { amp: 28 * energy, freq: 0.008, speed: 1, color: "rgba(229, 9, 20, 0.36)" },
                        { amp: 20 * energy, freq: 0.012, speed: 1.4, color: "rgba(255, 110, 120, 0.22)" },
                        { amp: 14 * energy, freq: 0.018, speed: 0.7, color: "rgba(255, 255, 255, 0.1)" }
                    ];
                    waves.forEach((wv, idx) => {
                        heroCtx.beginPath();
                        const baseY = h * (0.64 + idx * 0.05);
                        for (let x = 0; x <= w; x += 12) {
                            const y = baseY + Math.sin(x * wv.freq + phase * wv.speed) * wv.amp * dpr * Math.sin((x / w) * Math.PI);
                            if (x === 0) heroCtx.moveTo(x, y);
                            else heroCtx.lineTo(x, y);
                        }
                        heroCtx.strokeStyle = wv.color;
                        heroCtx.lineWidth = 2 * dpr;
                        heroCtx.stroke();
                    });
                }
            }

            // 2. Studio modal spectrum visualizer
            if (!dom.studioModal.classList.contains("hidden")) {
                const rect = vizCanvas.getBoundingClientRect();
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                const w = Math.floor(rect.width * dpr);
                const h = Math.floor(rect.height * dpr);
                if (w > 0 && h > 0) {
                    if (vizCanvas.width !== w || vizCanvas.height !== h) {
                        vizCanvas.width = w;
                        vizCanvas.height = h;
                    }
                    vizCtx.clearRect(0, 0, w, h);
                    const bars = 56;
                    const gap = 4 * dpr;
                    const barW = Math.max(2 * dpr, (w - gap * (bars + 1)) / bars);
                    for (let i = 0; i < bars; i++) {
                        const norm = Math.sin(phase * 2.2 + i * 0.38) * 0.5 + 0.5;
                        const beat = Math.cos(phase * 3.1 - i * 0.22) * 0.5 + 0.5;
                        const centerWeight = 1 - Math.abs((i / (bars - 1)) * 2 - 1) * 0.45;
                        const barH = Math.max(4 * dpr, (0.12 + norm * beat * 0.85 * energy) * h * centerWeight);
                        const x = gap + i * (barW + gap);
                        const y = (h - barH) / 2;
                        const grad = vizCtx.createLinearGradient(0, y, 0, y + barH);
                        grad.addColorStop(0, "#ff4d58");
                        grad.addColorStop(0.5, "#e50914");
                        grad.addColorStop(1, "#7f1d1d");
                        vizCtx.fillStyle = grad;
                        vizCtx.beginPath();
                        if (typeof vizCtx.roundRect === "function") {
                            vizCtx.roundRect(x, y, barW, barH, 3 * dpr);
                        } else {
                            vizCtx.rect(x, y, barW, barH);
                        }
                        vizCtx.fill();
                    }
                }
            }

            requestAnimationFrame(drawFrame);
        }
        requestAnimationFrame(drawFrame);
    }

    // --- 3D INTERACTIVE WORLD RADIO GLOBE (D3 ORTHOGRAPHIC CANVAS) ---
    function resolveIsoFromFeature(feature) {
        const name = feature?.properties?.name || "";
        if (ATLAS_NAME_TO_ISO[name]) return ATLAS_NAME_TO_ISO[name];
        const lower = name.toLowerCase();
        const found = state.countryCodeList.find(c => c.country.toLowerCase() === lower);
        return found ? found.code : null;
    }

    async function initGlobeIfNeeded() {
        const g = state.globe;
        if (g.loaded || g.loading) return;
        g.loading = true;

        renderGlobeQuickPills();
        try {
            const topology = await fetchJsonWithTimeout(WORLD_ATLAS_URL, 10000);
            if (typeof window.topojson !== "undefined" && typeof window.d3 !== "undefined") {
                const countriesGeo = window.topojson.feature(topology, topology.objects.countries);
                g.landFeatures = countriesGeo.features || [];

                const nodes = [];
                const seenCodes = new Set();

                g.landFeatures.forEach(feat => {
                    const code = resolveIsoFromFeature(feat);
                    if (!code || seenCodes.has(code)) return;
                    const meta = state.countriesMeta[code];
                    if (!meta) return;
                    const centroid = window.d3.geoCentroid(feat);
                    if (!centroid || Number.isNaN(centroid[0]) || Number.isNaN(centroid[1])) return;
                    seenCodes.add(code);
                    nodes.push({
                        code,
                        name: meta.country,
                        capital: meta.capital || "",
                        timeZone: meta.timeZone || "",
                        channelCount: meta.channelCount || 0,
                        coords: centroid,
                        feature: feat
                    });
                });

                // Add small islands / territories not captured in 110m atlas
                Object.entries(FALLBACK_COORDS).forEach(([code, coords]) => {
                    if (seenCodes.has(code) || !state.countriesMeta[code]) return;
                    const meta = state.countriesMeta[code];
                    seenCodes.add(code);
                    nodes.push({
                        code,
                        name: meta.country,
                        capital: meta.capital || "",
                        timeZone: meta.timeZone || "",
                        channelCount: meta.channelCount || 0,
                        coords,
                        feature: null
                    });
                });

                g.countryNodes = nodes;
            }
            g.loaded = true;
            bindGlobeInteractions();
            startGlobeRenderLoop();
            selectGlobeCountry(state.userLocation.code || "LK", true);
        } catch (err) {
            console.warn("Globe load error:", err);
            dom.globeStationList.innerHTML = `<div class="nf-empty-inline">3D globe geometry unavailable. Use quick country pills above to tune stations!</div>`;
        } finally {
            g.loading = false;
        }
    }

    function renderGlobeQuickPills(filterText = "") {
        const container = dom.globeQuickPills;
        container.innerHTML = "";
        const q = filterText.trim().toLowerCase();
        const list = q
            ? state.countryCodeList.filter(c => c.country.toLowerCase().includes(q) || c.code.toLowerCase() === q).slice(0, 18)
            : QUICK_COUNTRY_CODES.map(code => ({ code, ...(state.countriesMeta[code] || { country: code }) }));

        list.forEach(item => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = `nf-mini-pill${state.globe.selectedCode === item.code ? " active" : ""}`;
            btn.innerHTML = `${countryFlagHtml(item.code)} <span>${escapeHtml(item.country)}</span>`;
            btn.addEventListener("click", () => selectGlobeCountry(item.code, true));
            container.appendChild(btn);
        });
    }

    async function selectGlobeCountry(code, fly = false) {
        const upper = String(code || "LK").toUpperCase();
        state.globe.selectedCode = upper;
        const meta = state.countriesMeta[upper];

        dom.globeCountryFlag.innerHTML = countryFlagHtml(upper);
        dom.globeCountryName.textContent = meta?.country || upper;
        dom.globeCountrySub.textContent = meta?.capital ? `${meta.capital} • Loading stations...` : "Loading stations...";
        dom.globeLocalTime.textContent = getLocalTimeForZone(meta?.timeZone) || "--:--";

        if (fly) {
            const node = state.globe.countryNodes.find(n => n.code === upper);
            if (node) {
                state.globe.autoSpin = false;
                dom.globeAutoSpin.classList.remove("active");
                state.globe.rotation = [-node.coords[0], -node.coords[1], 0];
            }
        }

        renderGlobeQuickPills(dom.globeCountrySearch.value);
        dom.globeStationList.innerHTML = `<div class="nf-empty-inline">Tuning ${escapeHtml(meta?.country || upper)} frequencies...</div>`;

        const stations = filterStations(await getStationsForCountry(upper));
        dom.globeCountrySub.textContent = `${meta?.capital ? `${meta.capital} • ` : ""}${stations.length} live station${stations.length === 1 ? "" : "s"}`;

        dom.globeStationList.innerHTML = "";
        if (!stations.length) {
            dom.globeStationList.innerHTML = `<div class="nf-empty-inline">No playable stations found for this region. Try toggling HTTPS Safe or pick another country.</div>`;
            return;
        }
        const frag = document.createDocumentFragment();
        stations.forEach(st => frag.appendChild(buildCompactListItem(st, stations)));
        dom.globeStationList.appendChild(frag);
    }

    function bindGlobeInteractions() {
        const canvas = dom.globeCanvas;
        const g = state.globe;

        canvas.addEventListener("pointerdown", e => {
            g.dragging = true;
            g.dragDistance = 0;
            g.lastPointer = [e.clientX, e.clientY];
            canvas.setPointerCapture(e.pointerId);
        });

        canvas.addEventListener("pointermove", e => {
            const rect = canvas.getBoundingClientRect();
            const px = e.clientX - rect.left;
            const py = e.clientY - rect.top;

            if (g.dragging && g.lastPointer) {
                const dx = e.clientX - g.lastPointer[0];
                const dy = e.clientY - g.lastPointer[1];
                g.dragDistance += Math.hypot(dx, dy);
                g.lastPointer = [e.clientX, e.clientY];
                const sens = 0.28 / g.scaleFactor;
                g.rotation = [
                    g.rotation[0] + dx * sens,
                    Math.max(-85, Math.min(85, g.rotation[1] - dy * sens)),
                    0
                ];
                dom.globeTooltip.classList.add("hidden");
                return;
            }

            // Hit-test hovered radio node
            const hit = findNearestGlobeNode(px, py, rect.width, rect.height);
            g.hoveredNode = hit;
            if (hit) {
                canvas.style.cursor = "pointer";
                const time = getLocalTimeForZone(hit.timeZone);
                dom.globeTooltip.innerHTML = `
                    <strong>${countryFlagHtml(hit.code)} ${escapeHtml(hit.name)}</strong><br>
                    <span>${hit.channelCount || "Live"} stations${time ? ` • ${time}` : ""}</span>
                `;
                dom.globeTooltip.style.left = `${px}px`;
                dom.globeTooltip.style.top = `${py}px`;
                dom.globeTooltip.classList.remove("hidden");
            } else {
                canvas.style.cursor = "grab";
                dom.globeTooltip.classList.add("hidden");
            }
        });

        canvas.addEventListener("pointerup", e => {
            const wasClick = g.dragDistance < 6;
            g.dragging = false;
            g.lastPointer = null;
            if (wasClick) {
                const rect = canvas.getBoundingClientRect();
                const hit = findNearestGlobeNode(e.clientX - rect.left, e.clientY - rect.top, rect.width, rect.height);
                if (hit) selectGlobeCountry(hit.code, true);
            }
        });

        canvas.addEventListener("pointerleave", () => {
            g.dragging = false;
            g.hoveredNode = null;
            dom.globeTooltip.classList.add("hidden");
        });

        canvas.addEventListener("wheel", e => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 1.12 : 0.9;
            g.scaleFactor = Math.max(0.75, Math.min(3.2, g.scaleFactor * delta));
        }, { passive: false });
    }

    function getGlobeProjection(width, height) {
        const baseRadius = Math.min(width, height) * 0.39 * state.globe.scaleFactor;
        return window.d3.geoOrthographic()
            .scale(baseRadius)
            .translate([width / 2, height / 2])
            .rotate(state.globe.rotation)
            .clipAngle(90);
    }

    function findNearestGlobeNode(px, py, width, height) {
        if (!state.globe.loaded || typeof window.d3 === "undefined") return null;
        const proj = getGlobeProjection(width, height);
        const centerGeo = [-state.globe.rotation[0], -state.globe.rotation[1]];
        let best = null;
        let bestDist = 18;

        for (const node of state.globe.countryNodes) {
            if (window.d3.geoDistance(centerGeo, node.coords) > Math.PI / 2 - 0.05) continue;
            const pt = proj(node.coords);
            if (!pt) continue;
            const d = Math.hypot(pt[0] - px, pt[1] - py);
            if (d < bestDist) {
                bestDist = d;
                best = node;
            }
        }
        return best;
    }

    function startGlobeRenderLoop() {
        const canvas = dom.globeCanvas;
        const ctx = canvas.getContext("2d");
        const graticule = window.d3.geoGraticule10();
        let pulseTick = 0;

        function frame() {
            if (!dom.views.globe.classList.contains("hidden") && state.globe.loaded) {
                const rect = canvas.getBoundingClientRect();
                const dpr = Math.min(window.devicePixelRatio || 1, 2);
                const w = Math.floor(rect.width * dpr);
                const h = Math.floor(rect.height * dpr);
                if (w > 0 && h > 0) {
                    if (canvas.width !== w || canvas.height !== h) {
                        canvas.width = w;
                        canvas.height = h;
                    }
                    if (state.globe.autoSpin && !state.globe.dragging) {
                        state.globe.rotation[0] += 0.14;
                    }
                    pulseTick += 0.06;

                    ctx.save();
                    ctx.scale(dpr, dpr);
                    ctx.clearRect(0, 0, rect.width, rect.height);

                    const proj = getGlobeProjection(rect.width, rect.height);
                    const path = window.d3.geoPath(proj, ctx);
                    const cx = rect.width / 2;
                    const cy = rect.height / 2;
                    const r = proj.scale();

                    // Ocean Sphere
                    const oceanGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.1, cx, cy, r);
                    oceanGrad.addColorStop(0, "#1c202c");
                    oceanGrad.addColorStop(0.65, "#0d1018");
                    oceanGrad.addColorStop(1, "#05060a");

                    ctx.beginPath();
                    path({ type: "Sphere" });
                    ctx.fillStyle = oceanGrad;
                    ctx.fill();
                    ctx.strokeStyle = "rgba(229, 9, 20, 0.35)";
                    ctx.lineWidth = 1.5;
                    ctx.stroke();

                    // Graticule
                    ctx.beginPath();
                    path(graticule);
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.045)";
                    ctx.lineWidth = 0.7;
                    ctx.stroke();

                    // Countries Landmasses
                    for (const feat of state.globe.landFeatures) {
                        const iso = resolveIsoFromFeature(feat);
                        const isSelected = iso && iso === state.globe.selectedCode;
                        const isHovered = iso && state.globe.hoveredNode?.code === iso;

                        ctx.beginPath();
                        path(feat);
                        ctx.fillStyle = isSelected
                            ? "rgba(229, 9, 20, 0.42)"
                            : isHovered
                                ? "rgba(255, 255, 255, 0.22)"
                                : "#21242d";
                        ctx.fill();
                        ctx.strokeStyle = isSelected ? "#ff4c54" : "rgba(255, 255, 255, 0.12)";
                        ctx.lineWidth = isSelected ? 1.2 : 0.6;
                        ctx.stroke();
                    }

                    // Radio Pins
                    const centerGeo = [-state.globe.rotation[0], -state.globe.rotation[1]];
                    for (const node of state.globe.countryNodes) {
                        if (window.d3.geoDistance(centerGeo, node.coords) > Math.PI / 2 - 0.05) continue;
                        const pt = proj(node.coords);
                        if (!pt) continue;

                        const isSelected = node.code === state.globe.selectedCode;
                        const isHovered = state.globe.hoveredNode?.code === node.code;
                        const baseSize = node.channelCount > 100 ? 4.2 : node.channelCount > 15 ? 3.2 : 2.3;
                        const radius = isSelected ? 6 : isHovered ? 5.2 : baseSize;

                        if (isSelected || isHovered) {
                            const ringR = radius + 4 + Math.sin(pulseTick * 2) * 2.5;
                            ctx.beginPath();
                            ctx.arc(pt[0], pt[1], ringR, 0, Math.PI * 2);
                            ctx.strokeStyle = "rgba(229, 9, 20, 0.65)";
                            ctx.lineWidth = 1.6;
                            ctx.stroke();
                        }

                        ctx.beginPath();
                        ctx.arc(pt[0], pt[1], radius, 0, Math.PI * 2);
                        ctx.fillStyle = isSelected ? "#ffffff" : (node.channelCount > 0 || node.code === "GB" ? "#e50914" : "#888");
                        ctx.fill();
                    }

                    ctx.restore();
                }
            }
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    // --- COUNTRIES DIRECTORY VIEW ---
    function renderCountriesDirectory(filter = "") {
        const grid = dom.countriesDirectoryGrid;
        grid.innerHTML = "";
        const q = filter.trim().toLowerCase();
        const list = state.countryCodeList.filter(c =>
            !q || c.country.toLowerCase().includes(q) || (c.capital || "").toLowerCase().includes(q) || c.code.toLowerCase() === q
        );

        const frag = document.createDocumentFragment();
        list.forEach(item => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "nf-country-card";
            const localTime = getLocalTimeForZone(item.timeZone);
            const chText = item.channelCount ? `${item.channelCount} curated` : "Radio-Browser";
            btn.innerHTML = `
                <span class="nf-country-flag">${countryFlagHtml(item.code)}</span>
                <div class="nf-country-card-info">
                    <div class="nf-country-card-name">${escapeHtml(item.country)}</div>
                    <div class="nf-country-card-sub">${escapeHtml(item.capital || item.code)} • ${chText}${localTime ? ` • ${localTime}` : ""}</div>
                </div>
            `;
            btn.addEventListener("click", () => {
                state.selectedCountry = item.code;
                dom.countrySelect.value = item.code;
                switchView("browse");
                runSearchOrFilter();
                dom.searchResultsSection.scrollIntoView({ behavior: "smooth" });
            });
            frag.appendChild(btn);
        });
        grid.appendChild(frag);
    }

    // --- VIEW NAVIGATION ---
    function switchView(viewName) {
        state.activeView = viewName;
        Object.entries(dom.views).forEach(([key, el]) => {
            el.classList.toggle("hidden", key !== viewName);
        });
        dom.navLinks.forEach(btn => btn.classList.toggle("active", btn.dataset.view === viewName));
        dom.mobileTabs.forEach(btn => btn.classList.toggle("active", btn.dataset.view === viewName));

        if (viewName === "globe") {
            initGlobeIfNeeded();
        } else if (viewName === "countries") {
            renderCountriesDirectory(dom.directoryCountryFilter.value);
        } else if (viewName === "mylist") {
            refreshPersonalUI();
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // --- EVENT WIRING ---
    function bindEvents() {
        // Scroll navbar glass effect
        window.addEventListener("scroll", () => {
            dom.navbar.classList.toggle("scrolled", window.scrollY > 36);
        }, { passive: true });

        // Navigation buttons
        dom.navLinks.forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.view)));
        dom.mobileTabs.forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.view)));
        const brandHomeBtn = document.getElementById("brandHomeBtn");
        if (brandHomeBtn) brandHomeBtn.addEventListener("click", e => {
            e.preventDefault();
            switchView("browse");
        });
        dom.openGlobeQuickBtn.addEventListener("click", () => switchView("globe"));
        dom.navLocationPill.addEventListener("click", () => {
            state.selectedCountry = state.userLocation.code;
            dom.countrySelect.value = state.userLocation.code;
            switchView("browse");
            runSearchOrFilter();
        });

        // Search Bar
        if (dom.searchToggleBtn && dom.searchBox && dom.searchInput) {
            dom.searchToggleBtn.addEventListener("click", () => {
                dom.searchBox.classList.add("open");
                dom.searchInput.focus();
            });
        }

        if (dom.searchInput) {
            dom.searchInput.addEventListener("input", () => {
                const val = dom.searchInput.value;
                state.searchQuery = val;
                if (dom.searchClearBtn) dom.searchClearBtn.classList.toggle("hidden", !val);
                if (state.activeView !== "browse") switchView("browse");

                clearTimeout(searchDebounceTimer);
                searchDebounceTimer = setTimeout(runSearchOrFilter, 420);
            });

            dom.searchInput.addEventListener("blur", () => {
                if (dom.searchBox && !dom.searchInput.value.trim()) {
                    dom.searchBox.classList.remove("open");
                }
            });
        }

        if (dom.searchClearBtn) {
            dom.searchClearBtn.addEventListener("click", () => {
                if (dom.searchInput) dom.searchInput.value = "";
                state.searchQuery = "";
                dom.searchClearBtn.classList.add("hidden");
                if (dom.searchBox) dom.searchBox.classList.remove("open");
                runSearchOrFilter();
            });
        }

        dom.resetFilterBtn.addEventListener("click", () => {
            if (dom.searchInput) dom.searchInput.value = "";
            state.searchQuery = "";
            state.selectedGenre = "all";
            state.selectedCountry = "";
            dom.countrySelect.value = "";
            if (dom.searchClearBtn) dom.searchClearBtn.classList.add("hidden");
            dom.genreChipBar.querySelectorAll(".nf-chip").forEach(c => c.classList.toggle("active", c.dataset.genre === "all"));
            runSearchOrFilter();
        });

        // Genre chips
        dom.genreChipBar.addEventListener("click", e => {
            const chip = e.target.closest(".nf-chip");
            if (!chip) return;
            state.selectedGenre = chip.dataset.genre;
            dom.genreChipBar.querySelectorAll(".nf-chip").forEach(c => c.classList.toggle("active", c === chip));
            runSearchOrFilter();
        });

        // Country dropdown & HTTPS toggle
        dom.countrySelect.addEventListener("change", () => {
            state.selectedCountry = dom.countrySelect.value;
            runSearchOrFilter();
        });

        dom.httpsOnlyToggle.addEventListener("change", () => {
            state.httpsOnly = dom.httpsOnlyToggle.checked;
            savePrefs();
            buildBrowseRows();
            runSearchOrFilter();
            if (state.activeView === "globe" && state.globe.selectedCode) {
                selectGlobeCountry(state.globe.selectedCode, false);
            }
        });

        // Hero Actions
        dom.heroPlayBtn.addEventListener("click", () => {
            const hero = state.heroPool[state.heroIndex];
            if (!hero) return;
            if (state.currentStation?.id === hero.id && (state.playbackStatus === "playing" || state.playbackStatus === "paused")) {
                togglePlayPause();
            } else {
                tuneStation(hero, state.heroPool);
            }
        });
        dom.heroFavBtn.addEventListener("click", () => {
            const hero = state.heroPool[state.heroIndex];
            if (hero) toggleFavorite(hero);
        });
        dom.heroInfoBtn.addEventListener("click", () => {
            const hero = state.heroPool[state.heroIndex];
            if (hero) openStudioModal(hero);
        });
        dom.heroShuffleBtn.addEventListener("click", () => {
            if (!state.heroPool.length) return;
            state.heroIndex = (state.heroIndex + 1) % state.heroPool.length;
            renderHero();
        });

        // Globe controls
        dom.globeZoomIn.addEventListener("click", () => {
            state.globe.scaleFactor = Math.min(3.2, state.globe.scaleFactor * 1.2);
        });
        dom.globeZoomOut.addEventListener("click", () => {
            state.globe.scaleFactor = Math.max(0.75, state.globe.scaleFactor * 0.85);
        });
        dom.globeAutoSpin.addEventListener("click", () => {
            state.globe.autoSpin = !state.globe.autoSpin;
            dom.globeAutoSpin.classList.toggle("active", state.globe.autoSpin);
        });
        dom.globeFlyHome.addEventListener("click", () => {
            selectGlobeCountry(state.userLocation.code || "LK", true);
        });
        dom.globeCountrySearch.addEventListener("input", () => {
            renderGlobeQuickPills(dom.globeCountrySearch.value);
        });

        // Directory & History controls
        dom.directoryCountryFilter.addEventListener("input", () => {
            renderCountriesDirectory(dom.directoryCountryFilter.value);
        });
        dom.clearHistoryBtn.addEventListener("click", () => {
            state.history = [];
            localStorage.removeItem(STORAGE_KEYS.HISTORY);
            refreshPersonalUI();
            showToast("Listening history cleared");
        });

        // Player Dock & Studio Controls
        if (dom.surpriseMeBtn) dom.surpriseMeBtn.addEventListener("click", tuneRandomWorldwide);
        window.tuneRandomWorldwide = tuneRandomWorldwide;
        window.switchRadioView = switchView;
        dom.playPauseBtn.addEventListener("click", togglePlayPause);
        dom.studioPlayBtn.addEventListener("click", togglePlayPause);
        dom.prevStationBtn.addEventListener("click", () => playAdjacentStation(-1));
        dom.nextStationBtn.addEventListener("click", () => playAdjacentStation(1));
        dom.dockFavBtn.addEventListener("click", () => toggleFavorite(state.currentStation));
        dom.studioFavBtn.addEventListener("click", () => toggleFavorite(state.currentStation));

        dom.dockExpandTrigger.addEventListener("click", () => openStudioModal());
        dom.expandStudioBtn.addEventListener("click", () => openStudioModal());
        dom.closeStudioModalBtn.addEventListener("click", closeStudioModal);
        dom.studioModal.addEventListener("click", e => {
            if (e.target === dom.studioModal) closeStudioModal();
        });

        dom.studioCopyUrlBtn.addEventListener("click", async () => {
            if (!state.currentStation) return;
            const streams = getPlayableStreams(state.currentStation);
            const url = streams[state.currentStreamIndex] || streams[0] || "";
            if (!url) return;
            try {
                await navigator.clipboard.writeText(url);
                showToast("Stream URL copied to clipboard");
            } catch {
                showToast(url);
            }
        });

        // Volume & Mute
        const applyVolume = () => {
            dom.audio.volume = state.muted ? 0 : state.volume / 100;
            dom.volHighIcon.classList.toggle("hidden", state.muted || state.volume === 0);
            dom.volMutedIcon.classList.toggle("hidden", !state.muted && state.volume > 0);
        };
        applyVolume();

        dom.volumeSlider.addEventListener("input", () => {
            state.volume = Number(dom.volumeSlider.value);
            state.muted = state.volume === 0;
            applyVolume();
            savePrefs();
        });

        dom.muteBtn.addEventListener("click", () => {
            state.muted = !state.muted;
            applyVolume();
        });

        // Sleep Timer menu
        dom.sleepTimerBtn.addEventListener("click", e => {
            e.stopPropagation();
            dom.sleepTimerMenu.classList.toggle("hidden");
        });
        dom.sleepTimerMenu.addEventListener("click", e => {
            const btn = e.target.closest("button[data-minutes]");
            if (btn) setSleepTimer(Number(btn.dataset.minutes));
        });
        document.addEventListener("click", e => {
            if (!e.target.closest(".nf-sleep-wrap")) {
                dom.sleepTimerMenu.classList.add("hidden");
            }
        });

        // Audio element live state listeners
        dom.audio.addEventListener("waiting", () => {
            if (state.currentStation && state.playbackStatus === "playing") {
                setPlaybackStatus("loading", "BUFFERING");
            }
        });
        dom.audio.addEventListener("playing", () => {
            if (state.currentStation) setPlaybackStatus("playing");
        });

        // Keyboard Shortcuts
        document.addEventListener("keydown", e => {
            const tag = document.activeElement?.tagName;
            const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

            if (e.key === "Escape") {
                if (!dom.studioModal.classList.contains("hidden")) {
                    closeStudioModal();
                } else if (isTyping) {
                    document.activeElement.blur();
                }
                return;
            }

            if (isTyping) return;

            if (e.key === "/") {
                e.preventDefault();
                const dn = document.getElementById("desktop-navbar");
                const pn = document.getElementById("pill-nav");
                if (window.matchMedia("(min-width:992px)").matches) {
                    if (dn) dn.classList.add("search-open");
                } else {
                    if (pn) pn.classList.add("search-open");
                }
                if (dom.searchInput) setTimeout(() => dom.searchInput.focus(), 50);
            } else if (e.key === " ") {
                e.preventDefault();
                togglePlayPause();
            } else if (e.key === "ArrowRight") {
                playAdjacentStation(1);
            } else if (e.key === "ArrowLeft") {
                playAdjacentStation(-1);
            } else if (e.key.toLowerCase() === "m") {
                state.muted = !state.muted;
                applyVolume();
            } else if (e.key.toLowerCase() === "f" && state.currentStation) {
                toggleFavorite(state.currentStation);
            } else if (e.key.toLowerCase() === "g") {
                switchView(state.activeView === "globe" ? "browse" : "globe");
            }
        });
    }

    // --- BOOTSTRAP ---
    async function boot() {
        document.getElementById("footerYear").textContent = String(new Date().getFullYear());
        loadPersistedState();
        bindEvents();
        startVisualizers();

        // Render curated rows immediately while fetching country metadata & user IP geo
        await Promise.allSettled([loadCountriesMetadata(), detectUserLocation()]);
        await buildBrowseRows();
        refreshPersonalUI();

        // Keep clocks fresh every 30s
        setInterval(updateNavClock, 30000);
    }

    document.addEventListener("DOMContentLoaded", boot);
})();
