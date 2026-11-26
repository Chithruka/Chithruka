/* ==========================================================================
   NETFLIX WEBCAMS — VIDSTACK HLS & YOUTUBE LIVE STREAMING ENGINE
   Combines Famelack Webcams Directory, Live-Environment-Streams (.m3u8 HLS),
   Vidstack Web Component Player, Dynamic YouTube Iframe Switching,
   Open-Meteo Live Weather Telemetry, 2x2 Multi-Cam Wall, and D3 3D Globe.
   ========================================================================== */

(function () {
    "use strict";

    // --- DATA ENDPOINTS & CONFIG ---
    const FAMELACK_ROOTS = [
        "https://data.famelack.com/webcams",
        "https://raw.githubusercontent.com/famelack/famelack-data/main/webcams"
    ];

    const ENV_STREAMS_GEOJSON_URL =
        "https://raw.githubusercontent.com/william-ricchiuti/Live-Environment-Streams/main/streams.geojson";

    const WORLD_ATLAS_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

    const STORAGE_KEYS = {
        FAVORITES: "nf_webcams_favorites_v1",
        HISTORY: "nf_webcams_history_v1",
        CUSTOM: "nf_webcams_custom_v1",
        WALL: "nf_webcams_wall_v1",
        PREFS: "nf_webcams_prefs_v1"
    };

    const NETFLIX_N_SVG = `<svg viewBox="0 0 16 16" width="16" height="16" data-icon="NetflixSmall" data-icon-id="_r_m_" class="default-ltr-iqcdef-cache-1i3oso3" xmlns="http://www.w3.org/2000/svg" fill="none" role="img"><path fill="currentColor" d="M9.12.67v6.52L6.82.67h-2.9v14.66s1.7-.21 2.88-.24V8.8l2.22 6.28c1.4.03 2.97.24 2.97.24V.67z"></path></svg>`;

    const CARD_PALETTES = [
        ["#8b0000", "#1c0a0d"],
        ["#991b1b", "#18181c"],
        ["#1e3a8a", "#0f172a"],
        ["#0f766e", "#111827"],
        ["#4c1d95", "#141026"],
        ["#9a3412", "#1c1917"],
        ["#be123c", "#1a0b12"],
        ["#0369a1", "#0c1424"]
    ];

    const QUICK_COUNTRY_CODES = ["US", "JP", "GB", "CA", "AU", "DE", "NO", "IT", "FR", "CH", "NL", "IS"];

    const CATEGORY_KEYWORDS = {
        city: /\b(city|skyline|downtown|square|street|plaza|tower|tokyo|shibuya|times square|avenue|bridge|panorama)\b/i,
        beach: /\b(beach|surf|coast|bay|shore|pier|boardwalk|ocean|island|cove|sand)\b/i,
        harbor: /\b(harbor|harbour|port|marina|dock|ferry|canal|quay|wharf|ship)\b/i,
        airport: /\b(airport|runway|aviation|plane|flight|airfield|tarmac)\b/i,
        train: /\b(train|rail|railcam|station|railway|locomotive|tram|depot)\b/i,
        traffic: /\b(traffic|highway|freeway|interchange|junction|road|route|intersection|bridge|tunnel)\b/i,
        mountain: /\b(mountain|alp|peak|ridge|summit|glacier|canyon|valley|pass)\b/i,
        volcano: /\b(volcano|etna|vesuvius|kilau|crater|lava|geyser)\b/i,
        nature: /\b(nature|forest|park|garden|waterfall|aurora|northern lights|sunset|horizon|woods|desert)\b/i,
        animals: /\b(zoo|animal|bird|eagle|osprey|feeder|wildlife|safari|penguin|panda|bear|lion|giraffe|cat|dog|owl|nest)\b/i,
        landmark: /\b(landmark|monument|cathedral|castle|palace|temple|statue|square|tower|abbey)\b/i,
        weather: /\b(weather|sky|cloud|storm|wind|radar|aurora|observatory)\b/i,
        ski: /\b(ski|snow|resort|slope|gondola|chairlift|lodge|winter)\b/i,
        lake: /\b(lake|pond|loch|reservoir|lagoon)\b/i,
        river: /\b(river|creek|stream|falls|rapids)\b/i,
        park: /\b(park|reserve|botanical|plaza|fountain)\b/i,
        sports: /\b(golf|stadium|arena|surf|skate|track|club)\b/i,
        space: /\b(space|iss|earth|orbit|nasa|astronomy|rocket|starbase|launch)\b/i,
        underwater: /\b(underwater|reef|aquarium|coral|shark|kelp|marine|dive)\b/i,
        construction: /\b(construction|crane|site|build|project)\b/i
    };

    const ATLAS_NAME_TO_ISO = {
        "United States of America": "US",
        "United States": "US",
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
        "Ivory Coast": "CI",
        "Dominican Rep.": "DO",
        "Bosnia and Herz.": "BA",
        "Central African Rep.": "CF",
        "Eq. Guinea": "GQ",
        "S. Sudan": "SS",
        "South Sudan": "SS",
        "eSwatini": "SZ",
        "Swaziland": "SZ",
        "North Macedonia": "MK",
        "Macedonia": "MK",
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
        "Turkey": "TR"
    };

    const FALLBACK_COORDS = {
        SG: [103.82, 1.35],
        HK: [114.17, 22.32],
        MT: [14.51, 35.9],
        MV: [73.22, 3.2],
        MU: [57.55, -20.35],
        MC: [7.42, 43.73],
        AW: [-69.97, 12.52],
        BB: [-59.54, 13.19],
        BQ: [-68.26, 12.17],
        AI: [-63.05, 18.22],
        VG: [-64.62, 18.42]
    };

    // --- VERIFIED SEED FALLBACK (observed live on famelack.com/webcams) ---
    const SEED_WEBCAMS = [
        {
            id: "fl-4ka0z9q25r5E8D",
            name: "Bonny Hills Beach House",
            country: "Australia",
            countryCode: "AU",
            categories: ["beach", "nature", "weather"],
            languages: ["en"],
            sources: [
                { type: "youtube", url: "https://www.youtube.com/watch?v=pAryMmKnBC8", videoId: "pAryMmKnBC8", label: "YouTube Live" }
            ],
            thumbnail: "https://i.ytimg.com/vi/pAryMmKnBC8/hqdefault.jpg",
            origin: "famelack",
            isFeatured: true
        }
    ];

    // --- APPLICATION STATE ---
    const state = {
        famelackBase: FAMELACK_ROOTS[0],
        countriesMeta: {},          // { US: { country, capital, timeZone, hasChannels, channelCount } }
        countryCodeList: [],
        camRegistry: new Map(),     // id -> Cam
        allCams: [],                // merged Famelack + GeoJSON HLS + Custom
        hlsGeoCams: [],             // live HLS cams from Live-Environment-Streams
        countryCache: new Map(),    // UPPER code -> Cam[]
        categoryCache: new Map(),   // slug -> Cam[]
        weatherCache: new Map(),    // cacheKey -> telemetry
        geoCache: new Map(),        // query -> { lat, lon }

        userLocation: { code: "US", country: "United States", lat: 40.71, lon: -74.0 },
        activeView: "browse",
        selectedCategory: "all",
        selectedStreamType: "all",  // all | hls | youtube
        selectedCountry: "",
        searchQuery: "",
        httpsOnly: location.protocol === "https:",
        tempUnit: "C",              // C | F
        hudVisible: true,
        theaterMode: false,
        retroMode: false,

        heroPool: [],
        heroIndex: 0,

        favorites: [],
        history: [],
        customCams: [],
        wallSlots: [null, null, null, null],
        activePickerSlot: 0,

        // Active Stage Playback
        currentCam: null,
        currentQueue: [],
        currentSourceIndex: 0,
        activeEngine: null,         // "hls" | "youtube" | null
        playbackStatus: "idle",     // idle | loading | playing | paused | error
        playToken: 0,
        streamTimer: null,
        autoTour: false,
        autoTourTimer: null,
        stageVisible: false,

        // 3D Globe state
        globe: {
            loaded: false,
            loading: false,
            landFeatures: [],
            countryNodes: [],
            hlsPinCoords: [],
            selectedCode: "US",
            hoveredNode: null,
            rotation: [74, -40, 0],
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
        brandHomeBtn: document.getElementById("brandHomeBtn"),
        navLinks: document.querySelectorAll(".nf-nav-link[data-view]"),
        mobileTabs: document.querySelectorAll(".nf-mobile-tab[data-view]"),
        navWallBadge: document.getElementById("navWallBadge"),
        navFavBadge: document.getElementById("navFavBadge"),
        navLocationPill: document.getElementById("navLocationPill"),
        navLocFlag: document.getElementById("navLocFlag"),
        navLocName: document.getElementById("navLocName"),
        navLocClock: document.getElementById("navLocClock"),

        searchBox: document.getElementById("searchBox"),
        searchToggleBtn: document.getElementById("searchToggleBtn"),
        searchInput: document.getElementById("search-input") || document.getElementById("searchInput"),
        searchClearBtn: document.getElementById("searchClearBtn"),
        randomCamBtn: document.getElementById("randomCamBtn"),
        openAddCamBtn: document.getElementById("openAddCamBtn"),

        // Cinema Stage
        cinemaStage: document.getElementById("cinemaStage"),
        stageEngineChip: document.getElementById("stageEngineChip"),
        stageStatusPill: document.getElementById("stageStatusPill"),
        toggleHudBtn: document.getElementById("toggleHudBtn"),
        autoTourBtn: document.getElementById("autoTourBtn"),
        autoTourLabel: document.getElementById("autoTourLabel"),
        snapshotBtn: document.getElementById("snapshotBtn"),
        vfxBtn: document.getElementById("vfxBtn"),
        theaterBtn: document.getElementById("theaterBtn"),
        sendToWallBtn: document.getElementById("sendToWallBtn"),
        closeStageBtn: document.getElementById("closeStageBtn"),

        stageGrid: document.getElementById("stageGrid"),
        playerWrapper: document.getElementById("playerWrapper"),
        vidstackPlayer: document.getElementById("vidstackPlayer"),
        youtubePlayer: document.getElementById("youtubePlayer"),
        playerHudOverlay: document.getElementById("playerHudOverlay"),
        hudCamTitle: document.getElementById("hudCamTitle"),
        hudDayNight: document.getElementById("hudDayNight"),
        hudLocalTime: document.getElementById("hudLocalTime"),
        hudWeatherSep: document.getElementById("hudWeatherSep"),
        hudWeather: document.getElementById("hudWeather"),

        playerOverlay: document.getElementById("playerOverlay"),
        overlaySpinner: document.getElementById("overlaySpinner"),
        overlayErrorIcon: document.getElementById("overlayErrorIcon"),
        overlayTitle: document.getElementById("overlayTitle"),
        overlayDesc: document.getElementById("overlayDesc"),
        overlayActions: document.getElementById("overlayActions"),
        overlayRetryBtn: document.getElementById("overlayRetryBtn"),
        overlayNextBtn: document.getElementById("overlayNextBtn"),
        overlayExternalLink: document.getElementById("overlayExternalLink"),

        npAvatar: document.getElementById("npAvatar"),
        npTitle: document.getElementById("npTitle"),
        npSourceTag: document.getElementById("npSourceTag"),
        npSub: document.getElementById("npSub"),
        streamVariants: document.getElementById("streamVariants"),
        prevCamBtn: document.getElementById("prevCamBtn"),
        nextCamBtn: document.getElementById("nextCamBtn"),
        stageFavBtn: document.getElementById("stageFavBtn"),
        copyUrlBtn: document.getElementById("copyUrlBtn"),
        fullscreenBtn: document.getElementById("fullscreenBtn"),

        tempUnitToggle: document.getElementById("tempUnitToggle"),
        railWeatherTemp: document.getElementById("railWeatherTemp"),
        railWeatherCond: document.getElementById("railWeatherCond"),
        railLocalClock: document.getElementById("railLocalClock"),
        railWind: document.getElementById("railWind"),
        railHumidity: document.getElementById("railHumidity"),
        railProtocol: document.getElementById("railProtocol"),
        railCoords: document.getElementById("railCoords"),
        railTags: document.getElementById("railTags"),
        upNextCount: document.getElementById("upNextCount"),
        stageUpNextList: document.getElementById("stageUpNextList"),

        // Views
        views: {
            browse: document.getElementById("viewBrowse"),
            globe: document.getElementById("viewGlobe"),
            wall: document.getElementById("viewWall"),
            countries: document.getElementById("viewCountries"),
            mylist: document.getElementById("viewMyList")
        },

        // Hero & Browse
        heroSection: document.getElementById("heroSection"),
        heroImageLayer: document.getElementById("heroImageLayer"),
        heroTitle: document.getElementById("heroTitle"),
        heroDesc: document.getElementById("heroDesc"),
        heroCountryChip: document.getElementById("heroCountryChip"),
        heroFormatChip: document.getElementById("heroFormatChip"),
        heroCategoryChip: document.getElementById("heroCategoryChip"),
        heroPlayBtn: document.getElementById("heroPlayBtn"),
        heroFavBtn: document.getElementById("heroFavBtn"),
        heroFavLabel: document.getElementById("heroFavLabel"),
        heroWallBtn: document.getElementById("heroWallBtn"),
        heroShuffleBtn: document.getElementById("heroShuffleBtn"),

        categoryChipBar: document.getElementById("categoryChipBar"),
        streamTypeFilter: document.getElementById("streamTypeFilter"),
        countrySelect: document.getElementById("countrySelect"),
        httpsOnlyToggle: document.getElementById("httpsOnlyToggle"),
        openGlobeQuickBtn: document.getElementById("openGlobeQuickBtn"),

        searchResultsSection: document.getElementById("searchResultsSection"),
        searchResultsTitle: document.getElementById("searchResultsTitle"),
        searchResultsSubtitle: document.getElementById("searchResultsSubtitle"),
        resetFilterBtn: document.getElementById("resetFilterBtn"),
        searchResultsGrid: document.getElementById("searchResultsGrid"),
        browseRowsContainer: document.getElementById("browseRowsContainer"),

        // Globe
        globeCanvas: document.getElementById("globeCanvas"),
        globeZoomIn: document.getElementById("globeZoomIn"),
        globeZoomOut: document.getElementById("globeZoomOut"),
        globeAutoSpin: document.getElementById("globeAutoSpin"),
        globeFlyHome: document.getElementById("globeFlyHome"),
        globeTooltip: document.getElementById("globeTooltip"),
        globeCountryFlag: document.getElementById("globeCountryFlag"),
        globeCountryName: document.getElementById("globeCountryName"),
        globeCountrySub: document.getElementById("globeCountrySub"),
        globeLocalTime: document.getElementById("globeLocalTime"),
        globeCountrySearch: document.getElementById("globeCountrySearch"),
        globeQuickPills: document.getElementById("globeQuickPills"),
        globeCamList: document.getElementById("globeCamList"),

        // Wall
        wallPresetScenic: document.getElementById("wallPresetScenic"),
        wallPresetHls: document.getElementById("wallPresetHls"),
        wallPresetBeach: document.getElementById("wallPresetBeach"),
        wallClearBtn: document.getElementById("wallClearBtn"),
        wallGrid: document.getElementById("wallGrid"),

        // Countries & My List
        directoryCountryFilter: document.getElementById("directoryCountryFilter"),
        countriesDirectoryGrid: document.getElementById("countriesDirectoryGrid"),
        myListAddCamBtn: document.getElementById("myListAddCamBtn"),
        clearHistoryBtn: document.getElementById("clearHistoryBtn"),
        myListFavoritesGrid: document.getElementById("myListFavoritesGrid"),
        myListCustomSection: document.getElementById("myListCustomSection"),
        myListCustomGrid: document.getElementById("myListCustomGrid"),
        myListHistoryGrid: document.getElementById("myListHistoryGrid"),

        // Mini Dock
        miniDock: document.getElementById("miniDock"),
        dockScrollToStage: document.getElementById("dockScrollToStage"),
        dockThumbImg: document.getElementById("dockThumbImg"),
        dockThumbFallback: document.getElementById("dockThumbFallback"),
        dockCamName: document.getElementById("dockCamName"),
        dockStatusPill: document.getElementById("dockStatusPill"),
        dockCamMeta: document.getElementById("dockCamMeta"),
        dockPrevBtn: document.getElementById("dockPrevBtn"),
        dockNextBtn: document.getElementById("dockNextBtn"),
        dockFocusBtn: document.getElementById("dockFocusBtn"),
        dockCloseBtn: document.getElementById("dockCloseBtn"),

        // Modals
        addCamModal: document.getElementById("addCamModal"),
        closeAddCamBtn: document.getElementById("closeAddCamBtn"),
        addCamForm: document.getElementById("addCamForm"),
        customCamName: document.getElementById("customCamName"),
        customCamUrl: document.getElementById("customCamUrl"),
        customCamCountry: document.getElementById("customCamCountry"),
        customCamCategory: document.getElementById("customCamCategory"),
        cancelAddCamBtn: document.getElementById("cancelAddCamBtn"),

        pickWallCamModal: document.getElementById("pickWallCamModal"),
        closePickWallBtn: document.getElementById("closePickWallBtn"),
        wallPickerSearch: document.getElementById("wallPickerSearch"),
        wallPickerList: document.getElementById("wallPickerList"),

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
        return CARD_PALETTES[hashString(String(seed || "cam")) % CARD_PALETTES.length];
    }

    function getInitials(name) {
        const words = String(name || "CAM")
            .replace(/[^a-zA-Z0-9\s]/g, " ")
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
        return (words[0] || "CAM").slice(0, 3).toUpperCase();
    }

    const COUNTRY_CODE_ALIASES = { UK: "GB", EL: "GR", FX: "FR" };
    function normalizeCountryCode(code) {
        const clean = String(code || "").trim().toUpperCase();
        return COUNTRY_CODE_ALIASES[clean] || clean;
    }

    function countryCodeToFlag(code) {
        const clean = normalizeCountryCode(code);
        if (!/^[A-Z]{2}$/.test(clean)) return "🌍";
        return String.fromCodePoint(...[...clean].map(ch => 127397 + ch.charCodeAt(0)));
    }

    function countryFlagHtml(code) {
        const clean = normalizeCountryCode(code);
        if (!/^[A-Z]{2}$/.test(clean)) return `<span>🌍</span>`;
        const lower = clean.toLowerCase();
        return `<img class="nf-flag-img" src="https://flagcdn.com/w40/${lower}.png" alt="${clean}" loading="lazy" onerror="this.replaceWith(document.createTextNode('${clean}'))">`;
    }

    function getLocalClockInfo(timeZone) {
        if (!timeZone) return { timeStr: "", hour: null, isDay: true };
        try {
            const now = new Date();
            const timeStr = new Intl.DateTimeFormat(undefined, {
                timeZone,
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            }).format(now);
            const hourStr = new Intl.DateTimeFormat("en-US", {
                timeZone,
                hour: "2-digit",
                hour12: false
            }).format(now);
            const hour = Number(hourStr);
            const isDay = Number.isFinite(hour) ? (hour >= 6 && hour < 18) : true;
            return { timeStr, hour, isDay };
        } catch {
            return { timeStr: "", hour: null, isDay: true };
        }
    }

    function extractYouTubeId(input) {
        const raw = String(input || "").trim();
        if (!raw) return null;
        if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
        try {
            const u = new URL(raw);
            if (u.hostname.includes("youtu.be")) {
                const seg = u.pathname.replace(/^\/+/, "").split("/")[0];
                return /^[a-zA-Z0-9_-]{6,}$/.test(seg) ? seg : null;
            }
            if (u.searchParams.get("v")) return u.searchParams.get("v");
            const parts = u.pathname.split("/").filter(Boolean);
            const embedIdx = parts.findIndex(p => p === "embed" || p === "live" || p === "shorts");
            if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
            const last = parts[parts.length - 1];
            return last && /^[a-zA-Z0-9_-]{6,}$/.test(last) ? last : null;
        } catch {
            const m = raw.match(/(?:v=|\/embed\/|\/live\/|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
            return m ? m[1] : null;
        }
    }

    function buildYouTubeEmbedUrl(videoId) {
        const params = new URLSearchParams({
            autoplay: "1",
            playsinline: "1",
            rel: "0",
            modestbranding: "1",
            enablejsapi: "1"
        });
        // Avoid passing origin=null on file:// which causes YouTube Error 153
        if (location.protocol.startsWith("http")) {
            params.set("origin", location.origin);
        }
        return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
    }

    function inferCategoriesFromName(name, existingCats = []) {
        const set = new Set(existingCats.map(c => String(c).toLowerCase()).filter(Boolean));
        for (const [cat, regex] of Object.entries(CATEGORY_KEYWORDS)) {
            if (regex.test(name)) set.add(cat);
        }
        return [...set];
    }

    async function fetchJsonWithTimeout(url, timeoutMs = 10000) {
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
                const data = await fetchJsonWithTimeout(`${root}/${path}`, 9000);
                state.famelackBase = root;
                return data;
            } catch {
                // Rotate to next Famelack endpoint
            }
        }
        throw new Error(`All Famelack endpoints failed for ${path}`);
    }

    let toastTimer = null;
    function showToast(msg) {
        dom.toast.textContent = msg;
        dom.toast.classList.remove("hidden");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => dom.toast.classList.add("hidden"), 3400);
    }

    // --- NORMALIZATION & MERGING ---
    function asArray(val) {
        return Array.isArray(val) ? val : typeof val === "string" && val.trim() ? [val.trim()] : [];
    }

    const UNRELIABLE_STREAM_URL_RE = /atcs-dishub\.bandung\.go\.id:1990|streaming\d*\.highwaytraffic\.go\.th/i;
    const UNRELIABLE_GEO_FAMILIES = new Set(["atcs-bandung", "trafficvision"]);

    function normalizeFamelackCam(raw, fallbackCountryCode = "", extraCategory = "") {
        if (!raw || raw.isUnavailable === true) return null;
        const streamUrls = [
            ...asArray(raw?.sources?.streams),
            ...asArray(raw?.stream_urls),
            ...asArray(raw?.iptv_urls),
            ...asArray(raw?.streams)
        ].filter(Boolean);

        const youtubeUrls = [
            ...asArray(raw?.sources?.youtube),
            ...asArray(raw?.youtube_urls)
        ].filter(Boolean);

        const sources = [];
        const seenUrl = new Set();

        // Add direct HLS / MP4 streams first
        streamUrls.forEach((url, idx) => {
            const clean = String(url).trim();
            if (!clean || seenUrl.has(clean) || UNRELIABLE_STREAM_URL_RE.test(clean)) return;
            seenUrl.add(clean);
            const isYt = /youtube\.com|youtu\.be/i.test(clean);
            if (isYt) {
                const videoId = extractYouTubeId(clean);
                if (videoId) {
                    sources.push({ type: "youtube", url: clean, videoId, label: "YouTube Live" });
                }
            } else {
                const isHls = clean.toLowerCase().includes(".m3u8");
                sources.push({
                    type: "hls",
                    format: isHls ? "hls" : "video",
                    url: clean,
                    label: streamUrls.length > 1 ? `HLS ${idx + 1}` : "HLS Stream"
                });
            }
        });

        // Add YouTube Live streams
        youtubeUrls.forEach((url, idx) => {
            const clean = String(url).trim();
            const videoId = extractYouTubeId(clean);
            if (!videoId) return;
            const canonical = `https://www.youtube.com/watch?v=${videoId}`;
            if (seenUrl.has(canonical) || seenUrl.has(clean)) return;
            seenUrl.add(canonical);
            sources.push({
                type: "youtube",
                url: canonical,
                videoId,
                label: youtubeUrls.length > 1 ? `YouTube ${idx + 1}` : "YouTube Live"
            });
        });

        if (!sources.length) return null;

        const rawCode = String(raw.country || fallbackCountryCode || "").trim().toUpperCase();
        const code = normalizeCountryCode(rawCode);
        const meta = state.countriesMeta[code] || state.countriesMeta[rawCode];
        const name = String(raw.name || "Live Webcam").trim();
        const rawCats = [
            ...asArray(raw.categories),
            ...asArray(raw.category),
            ...(extraCategory ? [extraCategory] : [])
        ];
        const categories = inferCategoriesFromName(name, rawCats);

        const ytSource = sources.find(s => s.type === "youtube");
        const thumbnail = raw.thumbnail || raw.poster ||
            (ytSource ? `https://i.ytimg.com/vi/${ytSource.videoId}/hqdefault.jpg` : "");

        return {
            id: `fl-${raw.nanoid || raw.id || hashString(name + sources[0].url)}`,
            name,
            country: meta?.country || code || "International",
            countryCode: code,
            capital: meta?.capital || "",
            timeZone: meta?.timeZone || "",
            categories,
            languages: asArray(raw.languages || raw.language),
            sources,
            thumbnail,
            lat: typeof raw.lat === "number" ? raw.lat : null,
            lon: typeof raw.lon === "number" ? raw.lon : null,
            origin: "famelack",
            attribution: "Famelack Open Webcams",
            isGeoBlocked: Boolean(raw.isGeoBlocked),
            isFeatured: false
        };
    }

    function normalizeGeoJsonFeature(feat) {
        const props = feat?.properties;
        const coords = feat?.geometry?.coordinates;
        if (!props || props.status !== "active") return null;
        if (props.url_type !== "hls" && props.url_type !== "mp4") return null;
        if (UNRELIABLE_GEO_FAMILIES.has(String(props.source_family || "").toLowerCase())) return null;
        const url = String(props.url || "").trim();
        if (!url || UNRELIABLE_STREAM_URL_RE.test(url)) return null;

        const rawCode = String(props.country_code || "").trim().toUpperCase();
        const code = normalizeCountryCode(rawCode);
        const meta = state.countriesMeta[code] || state.countriesMeta[rawCode];
        const rawName = String(props.name || "Public Environment Cam").trim();
        const name = rawName.replace(/^[A-Z]{2}\s*-\s*/, "");
        const categories = inferCategoriesFromName(rawName, ["traffic", "weather"]);
        const lon = Array.isArray(coords) && typeof coords[0] === "number" ? coords[0] : null;
        const lat = Array.isArray(coords) && typeof coords[1] === "number" ? coords[1] : null;

        return {
            id: `env-${hashString(url)}`,
            name,
            country: meta?.country || code || "Global",
            countryCode: code,
            capital: meta?.capital || "",
            timeZone: meta?.timeZone || "",
            categories,
            languages: [],
            sources: [{
                type: "hls",
                format: props.url_type === "hls" ? "hls" : "video",
                url,
                label: props.resolution ? `HLS ${props.resolution}` : "HLS Live"
            }],
            thumbnail: "",
            lat,
            lon,
            resolution: props.resolution || "",
            origin: "env",
            sourceFamily: String(props.source_family || "").toLowerCase(),
            attribution: props.attribution || props.source_family || "Public Road / Weather Cam",
            isGeoBlocked: false,
            isFeatured: false
        };
    }

    function registerCam(cam) {
        if (!cam || !cam.id) return cam;
        const existing = state.camRegistry.get(cam.id);
        if (existing) {
            // Merge categories & sources cleanly without losing metadata
            const catSet = new Set([...existing.categories, ...cam.categories]);
            existing.categories = [...catSet];
            if (!existing.thumbnail && cam.thumbnail) existing.thumbnail = cam.thumbnail;
            if (!existing.timeZone && cam.timeZone) existing.timeZone = cam.timeZone;
            if (!existing.country && cam.country) existing.country = cam.country;
            if (existing.lat === null && cam.lat !== null) {
                existing.lat = cam.lat;
                existing.lon = cam.lon;
            }
            const seenUrl = new Set(existing.sources.map(s => s.url));
            for (const s of cam.sources) {
                if (!seenUrl.has(s.url)) {
                    existing.sources.push(s);
                    seenUrl.add(s.url);
                }
            }
            return existing;
        }
        state.camRegistry.set(cam.id, cam);
        return cam;
    }

    function interleaveByGroup(items, keyFn) {
        const buckets = new Map();
        for (const item of items) {
            const key = keyFn(item);
            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key).push(item);
        }
        const queues = [...buckets.values()];
        const out = [];
        let added = true;
        while (added) {
            added = false;
            for (const q of queues) {
                if (q.length) {
                    out.push(q.shift());
                    added = true;
                }
            }
        }
        return out;
    }

    function rebuildAllCams() {
        const custom = [];
        const rest = [];
        const seen = new Set();
        const pushUnique = (cam, target) => {
            if (!cam || seen.has(cam.id)) return;
            seen.add(cam.id);
            target.push(registerCam(cam));
        };

        state.customCams.forEach(c => pushUnique(c, custom));
        for (const cam of state.camRegistry.values()) {
            pushUnique(cam, rest);
        }

        // Balance diversity across providers/countries so Norway, California, Hawaii, Seattle, and global YouTube cams mix evenly
        const diverse = interleaveByGroup(rest, cam => `${cam.origin}:${cam.sourceFamily || cam.countryCode || "intl"}`);
        state.allCams = [...custom, ...diverse];
    }

    function getPlayableSources(cam) {
        if (!cam || !Array.isArray(cam.sources)) return [];
        let list = [...cam.sources];
        // Sort HTTPS sources first
        list.sort((a, b) => {
            const aSafe = a.type === "youtube" || a.url.startsWith("https://") ? 1 : 0;
            const bSafe = b.type === "youtube" || b.url.startsWith("https://") ? 1 : 0;
            return bSafe - aSafe;
        });
        if (state.httpsOnly) {
            list = list.filter(s => s.type === "youtube" || s.url.startsWith("https://") || s.url.startsWith("//"));
        }
        if (state.selectedStreamType === "hls") {
            list = list.filter(s => s.type === "hls");
        } else if (state.selectedStreamType === "youtube") {
            list = list.filter(s => s.type === "youtube");
        }
        return list;
    }

    function filterCams(cams) {
        return cams.filter(cam => getPlayableSources(cam).length > 0);
    }

    function camHasType(cam, type) {
        return cam?.sources?.some(s => s.type === type);
    }

    // --- PERSISTENCE (FAVORITES, HISTORY, CUSTOM CAMS, WALL, PREFS) ---
    function loadPersistedState() {
        const readJson = (key, fallback) => {
            try {
                const v = JSON.parse(localStorage.getItem(key) || "null");
                return v ?? fallback;
            } catch {
                return fallback;
            }
        };

        state.favorites = (readJson(STORAGE_KEYS.FAVORITES, []) || []).map(registerCam).filter(Boolean);
        state.history = (readJson(STORAGE_KEYS.HISTORY, []) || []).map(registerCam).filter(Boolean);
        state.customCams = (readJson(STORAGE_KEYS.CUSTOM, []) || []).map(registerCam).filter(Boolean);
        state.wallSlots = readJson(STORAGE_KEYS.WALL, [null, null, null, null]) || [null, null, null, null];
        state.wallSlots = [0, 1, 2, 3].map(i => {
            const item = state.wallSlots[i];
            return item ? registerCam(item) : null;
        });

        const prefs = readJson(STORAGE_KEYS.PREFS, {});
        if (typeof prefs.httpsOnly === "boolean") state.httpsOnly = prefs.httpsOnly;
        if (prefs.tempUnit === "F" || prefs.tempUnit === "C") state.tempUnit = prefs.tempUnit;

        dom.httpsOnlyToggle.checked = state.httpsOnly;
        dom.tempUnitToggle.textContent = `°${state.tempUnit}`;
        updateBadges();
    }

    function savePrefs() {
        try {
            localStorage.setItem(STORAGE_KEYS.PREFS, JSON.stringify({
                httpsOnly: state.httpsOnly,
                tempUnit: state.tempUnit
            }));
        } catch { /* ignore */ }
    }

    function isFavorited(camId) {
        return state.favorites.some(f => f.id === camId);
    }

    function toggleFavorite(cam) {
        if (!cam) return;
        const idx = state.favorites.findIndex(f => f.id === cam.id);
        if (idx >= 0) {
            state.favorites.splice(idx, 1);
            showToast(`Removed "${cam.name}" from My List`);
        } else {
            state.favorites.unshift(cam);
            showToast(`Added "${cam.name}" to My List`);
        }
        try {
            localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(state.favorites.slice(0, 100)));
        } catch { /* ignore */ }
        updateBadges();
        refreshPersonalUI();
    }

    function recordHistory(cam) {
        if (!cam) return;
        state.history = [cam, ...state.history.filter(h => h.id !== cam.id)].slice(0, 24);
        try {
            localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(state.history));
        } catch { /* ignore */ }
        refreshPersonalUI();
    }

    function saveCustomCams() {
        try {
            localStorage.setItem(STORAGE_KEYS.CUSTOM, JSON.stringify(state.customCams));
        } catch { /* ignore */ }
    }

    function saveWallSlots() {
        try {
            localStorage.setItem(STORAGE_KEYS.WALL, JSON.stringify(state.wallSlots));
        } catch { /* ignore */ }
        updateBadges();
    }

    function updateBadges() {
        const favCount = state.favorites.length;
        dom.navFavBadge.textContent = String(favCount);
        dom.navFavBadge.classList.toggle("hidden", favCount === 0);
        const menuFavCount = document.getElementById("menu-fav-count");
        if (menuFavCount) menuFavCount.textContent = String(favCount);

        const wallCount = state.wallSlots.filter(Boolean).length;
        dom.navWallBadge.textContent = String(wallCount);
        dom.navWallBadge.classList.toggle("hidden", wallCount === 0);

        if (state.currentCam) {
            dom.stageFavBtn.classList.toggle("active", isFavorited(state.currentCam.id));
        }
        const heroCam = state.heroPool[state.heroIndex];
        if (heroCam) {
            dom.heroFavLabel.textContent = isFavorited(heroCam.id) ? "In My List" : "My List";
        }
    }

    function refreshPersonalUI() {
        updateBadges();
        const favTrack = document.getElementById("row-track-favorites");
        if (favTrack) renderRowTrack(favTrack, filterCams(state.favorites));
        const histTrack = document.getElementById("row-track-recent");
        if (histTrack) renderRowTrack(histTrack, filterCams(state.history));
        const customTrack = document.getElementById("row-track-custom");
        if (customTrack) renderRowTrack(customTrack, filterCams(state.customCams));

        renderGrid(dom.myListFavoritesGrid, state.favorites, "No saved webcams yet. Click the heart icon on any camera card to build your collection.");
        dom.myListCustomSection.classList.toggle("hidden", state.customCams.length === 0);
        if (state.customCams.length) {
            renderGrid(dom.myListCustomGrid, state.customCams, "");
        }
        renderGrid(dom.myListHistoryGrid, state.history, "Cameras you watch will appear here automatically.");

        document.querySelectorAll(".nf-card[data-cam-id]").forEach(card => {
            const favBtn = card.querySelector(".js-fav-btn");
            if (favBtn) favBtn.classList.toggle("active", isFavorited(card.dataset.camId));
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
            populateCountrySelect();
        } catch (err) {
            console.warn("Countries metadata unavailable:", err);
        }
    }

    function populateCountrySelect() {
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
            const d = await fetchJsonWithTimeout("https://api.bigdatacloud.net/data/reverse-geocode-client", 4500);
            if (d && d.countryCode) {
                state.userLocation = {
                    code: normalizeCountryCode(d.countryCode),
                    country: d.countryName || d.countryCode,
                    lat: d.latitude || 40.71,
                    lon: d.longitude || -74.0
                };
                updateNavClock();
                return;
            }
        } catch { /* fallback */ }

        try {
            const d = await fetchJsonWithTimeout("https://ipwho.is/", 4500);
            if (d && d.success && d.country_code) {
                state.userLocation = {
                    code: normalizeCountryCode(d.country_code),
                    country: d.country,
                    lat: d.latitude,
                    lon: d.longitude
                };
                updateNavClock();
                return;
            }
        } catch { /* keep default */ }

        updateNavClock();
    }

    function updateNavClock() {
        const code = state.userLocation.code;
        const meta = state.countriesMeta[code];
        dom.navLocFlag.innerHTML = countryFlagHtml(code);
        dom.navLocName.textContent = meta?.country || state.userLocation.country || code;
        const { timeStr } = getLocalClockInfo(meta?.timeZone);
        dom.navLocClock.textContent = timeStr || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    }

    async function loadAllFamelackCams() {
        try {
            const rawList = await fetchFamelackJson("categories/all.json");
            if (!Array.isArray(rawList)) return [];
            const parsed = rawList.map(r => normalizeFamelackCam(r)).filter(Boolean);
            parsed.forEach(registerCam);
            rebuildAllCams();
            return parsed;
        } catch (err) {
            console.warn("Famelack all.json failed:", err);
            return [];
        }
    }

    async function loadFamelackCategory(slug) {
        if (!slug || slug === "all") return state.allCams;
        if (state.categoryCache.has(slug)) return state.categoryCache.get(slug);

        try {
            const raw = await fetchFamelackJson(`categories/${encodeURIComponent(slug)}.json`);
            const parsed = (Array.isArray(raw) ? raw : [])
                .map(item => normalizeFamelackCam(item, "", slug))
                .filter(Boolean)
                .map(registerCam);

            // Also include any GeoJSON HLS cams matching this category
            const hlsMatches = state.hlsGeoCams.filter(c => c.categories.includes(slug));
            const combinedMap = new Map();
            [...hlsMatches, ...parsed].forEach(c => combinedMap.set(c.id, c));
            const result = [...combinedMap.values()];

            state.categoryCache.set(slug, result);
            rebuildAllCams();
            return result;
        } catch {
            // Fallback to keyword filter on already loaded cams
            const fallback = state.allCams.filter(c => c.categories.includes(slug));
            state.categoryCache.set(slug, fallback);
            return fallback;
        }
    }

    async function loadCamsForCountry(code) {
        const upper = String(code || "").toUpperCase();
        if (!upper) return [];
        if (state.countryCache.has(upper)) return state.countryCache.get(upper);

        const meta = state.countriesMeta[upper];
        let flList = [];
        if (!meta || meta.hasChannels !== false) {
            try {
                const raw = await fetchFamelackJson(`countries/${upper.toLowerCase()}.json`);
                flList = (Array.isArray(raw) ? raw : [])
                    .map(item => normalizeFamelackCam(item, upper))
                    .filter(Boolean)
                    .map(registerCam);
            } catch { /* country file optional */ }
        }

        const geoMatches = state.allCams.filter(c => c.countryCode === upper);
        const byId = new Map();
        [...flList, ...geoMatches].forEach(c => byId.set(c.id, c));
        const merged = [...byId.values()];
        state.countryCache.set(upper, merged);
        rebuildAllCams();
        return merged;
    }

    async function loadLiveEnvironmentHlsStreams() {
        try {
            const geojson = await fetchJsonWithTimeout(ENV_STREAMS_GEOJSON_URL, 14000);
            const features = Array.isArray(geojson?.features) ? geojson.features : [];
            const perCountryCap = new Map();
            const collected = [];
            const pinCoords = [];

            // Prioritize HTTPS + exact coords + HLS
            const candidates = features.filter(f =>
                f?.properties?.status === "active" &&
                f?.properties?.url_type === "hls" &&
                typeof f?.properties?.url === "string"
            );

            candidates.sort((a, b) => {
                const aHttps = a.properties.url.startsWith("https://") ? 1 : 0;
                const bHttps = b.properties.url.startsWith("https://") ? 1 : 0;
                if (bHttps !== aHttps) return bHttps - aHttps;
                const aExact = a.properties.coordinates_quality === "exact" ? 1 : 0;
                const bExact = b.properties.coordinates_quality === "exact" ? 1 : 0;
                return bExact - aExact;
            });

            for (const feat of candidates) {
                const cam = normalizeGeoJsonFeature(feat);
                if (!cam) continue;
                const cc = cam.countryCode || "XX";
                const count = perCountryCap.get(cc) || 0;
                if (count >= 45) continue; // Keep global variety fast & balanced
                perCountryCap.set(cc, count + 1);

                registerCam(cam);
                collected.push(cam);
                if (cam.lon !== null && cam.lat !== null && pinCoords.length < 450) {
                    pinCoords.push([cam.lon, cam.lat]);
                }
                if (collected.length >= 600) break;
            }

            state.hlsGeoCams = collected;
            state.globe.hlsPinCoords = pinCoords;
            rebuildAllCams();
            return collected;
        } catch (err) {
            console.warn("Live-Environment-Streams GeoJSON skipped:", err);
            return [];
        }
    }

    // --- WEATHER & LIVE TELEMETRY (OPEN-METEO) ---
    function describeWmoWeather(code) {
        if (code === 0) return "Clear Sky";
        if (code <= 3) return "Partly Cloudy";
        if (code <= 48) return "Fog / Mist";
        if (code <= 57) return "Drizzle";
        if (code <= 67) return "Rain";
        if (code <= 77) return "Snow";
        if (code <= 82) return "Rain Showers";
        if (code <= 86) return "Snow Showers";
        if (code >= 95) return "Thunderstorm";
        return "Live Conditions";
    }

    function degreesToCompass(deg) {
        if (typeof deg !== "number" || Number.isNaN(deg)) return "";
        const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
        return dirs[Math.round(deg / 45) % 8];
    }

    async function resolveCamCoords(cam) {
        if (typeof cam.lat === "number" && typeof cam.lon === "number") {
            return { lat: cam.lat, lon: cam.lon };
        }
        const query = cam.capital || cam.country || cam.countryCode;
        if (!query) return null;
        if (state.geoCache.has(query)) return state.geoCache.get(query);

        try {
            const data = await fetchJsonWithTimeout(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`,
                4500
            );
            const hit = data?.results?.[0];
            if (hit && typeof hit.latitude === "number" && typeof hit.longitude === "number") {
                const coords = { lat: hit.latitude, lon: hit.longitude };
                state.geoCache.set(query, coords);
                return coords;
            }
        } catch { /* ignore */ }
        return null;
    }

    async function fetchWeatherForCam(cam) {
        const coords = await resolveCamCoords(cam);
        if (!coords) {
            renderTelemetryUI(cam, null, null);
            return;
        }
        const key = `${coords.lat.toFixed(2)},${coords.lon.toFixed(2)}`;
        if (state.weatherCache.has(key)) {
            renderTelemetryUI(cam, coords, state.weatherCache.get(key));
            return;
        }

        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto`;
            const data = await fetchJsonWithTimeout(url, 5500);
            if (data?.current) {
                const telemetry = {
                    tempC: Math.round(data.current.temperature_2m),
                    humidity: data.current.relative_humidity_2m,
                    windKmh: Math.round(data.current.wind_speed_10m),
                    windDir: degreesToCompass(data.current.wind_direction_10m),
                    condition: describeWmoWeather(data.current.weather_code),
                    timeZone: data.timezone || cam.timeZone
                };
                state.weatherCache.set(key, telemetry);
                if (state.currentCam?.id === cam.id) {
                    renderTelemetryUI(cam, coords, telemetry);
                }
            }
        } catch {
            if (state.currentCam?.id === cam.id) {
                renderTelemetryUI(cam, coords, null);
            }
        }
    }

    function formatTemp(tempC) {
        if (typeof tempC !== "number" || Number.isNaN(tempC)) return "--°";
        if (state.tempUnit === "F") {
            return `${Math.round((tempC * 9) / 5 + 32)}°F`;
        }
        return `${tempC}°C`;
    }

    function renderTelemetryUI(cam, coords, telemetry) {
        const tz = telemetry?.timeZone || cam.timeZone || state.countriesMeta[cam.countryCode]?.timeZone;
        const { timeStr, isDay } = getLocalClockInfo(tz);
        const dayEmoji = timeStr ? (isDay ? "☀️" : "🌙") : "🌍";

        dom.hudDayNight.textContent = dayEmoji;
        dom.hudLocalTime.textContent = timeStr ? `${timeStr} Local` : cam.country;
        dom.railLocalClock.textContent = timeStr ? `${timeStr}${tz ? ` (${tz.split("/").pop().replace(/_/g, " ")})` : ""}` : cam.country;

        if (telemetry) {
            const tStr = formatTemp(telemetry.tempC);
            dom.railWeatherTemp.textContent = tStr;
            dom.railWeatherCond.textContent = telemetry.condition;
            dom.railWind.textContent = `${telemetry.windKmh} km/h ${telemetry.windDir}`;
            dom.railHumidity.textContent = `${telemetry.humidity}%`;

            dom.hudWeather.textContent = `${tStr} ${telemetry.condition}`;
            dom.hudWeather.classList.remove("hidden");
            dom.hudWeatherSep.classList.remove("hidden");
        } else {
            dom.railWeatherTemp.textContent = "--°";
            dom.railWeatherCond.textContent = "Live Camera Feed";
            dom.railWind.textContent = "--";
            dom.railHumidity.textContent = "--";
            dom.hudWeather.classList.add("hidden");
            dom.hudWeatherSep.classList.add("hidden");
        }

        const src = getPlayableSources(cam)[state.currentSourceIndex] || cam.sources[0];
        dom.railProtocol.textContent = src?.type === "youtube" ? "YouTube Iframe" : "Vidstack HLS";
        dom.railCoords.textContent = coords ? `${coords.lat.toFixed(2)}, ${coords.lon.toFixed(2)}` : (cam.countryCode || "Global");

        dom.railTags.innerHTML = "";
        (cam.categories.length ? cam.categories.slice(0, 6) : ["live webcam"]).forEach(tag => {
            const span = document.createElement("span");
            span.className = "wc-rail-tag";
            span.textContent = tag;
            dom.railTags.appendChild(span);
        });
    }

    // --- CARD & LIST RENDERING ---
    function buildCamCard(cam, options = {}) {
        const { rank = null, isTop10 = false, queue = null } = options;
        registerCam(cam);
        const [c1, c2] = getPalette(cam.id + cam.name);
        const flagHtml = countryFlagHtml(cam.countryCode);
        const isPlaying = state.currentCam?.id === cam.id && state.stageVisible;
        const isFav = isFavorited(cam.id);

        const hasHls = camHasType(cam, "hls");
        const hasYt = camHasType(cam, "youtube");

        let badgeHtml = `<span class="nf-card-badge">LIVE</span>`;
        if (hasHls && hasYt) {
            badgeHtml = `<span class="nf-card-badge dual">HLS + YT</span>`;
        } else if (hasHls) {
            badgeHtml = `<span class="nf-card-badge hls">HLS</span>`;
        } else if (hasYt) {
            badgeHtml = `<span class="nf-card-badge yt">YT LIVE</span>`;
        }

        const tagText = cam.categories.length
            ? cam.categories.slice(0, 3).join(" • ")
            : (hasHls ? "Direct HLS Stream" : "YouTube Live Cam");

        const card = document.createElement("article");
        card.className = `nf-card${isPlaying ? " is-playing" : ""}`;
        card.dataset.camId = cam.id;

        card.innerHTML = `
            <div class="nf-card-cover" style="background: linear-gradient(135deg, ${c1}, ${c2});">
                ${(cam.isFeatured || hasHls)
                    ? `<span class="nf-card-n-corner" title="Featured Live Cam">${NETFLIX_N_SVG}</span>`
                    : ""}
                <div class="nf-card-top-right">${badgeHtml}</div>
                <div class="nf-card-art-bg">
                    <span class="nf-card-monogram">${escapeHtml(getInitials(cam.name))}</span>
                    <span class="nf-card-art-sub">${hasHls ? "VIDSTACK HLS FEED" : "LIVE CAM"}</span>
                </div>
                ${cam.thumbnail
                    ? `<img class="js-card-thumb" src="${escapeHtml(cam.thumbnail)}" alt="${escapeHtml(cam.name)}" loading="lazy">`
                    : ""}
                <div class="nf-card-overlay">
                    <button type="button" class="nf-card-quick-play js-play-btn" title="Watch Live" aria-label="Watch ${escapeHtml(cam.name)}">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </button>
                    <div class="nf-card-mini-actions">
                        <button type="button" class="nf-card-mini-btn js-fav-btn${isFav ? " active" : ""}" title="Save to My List" aria-label="Favorite ${escapeHtml(cam.name)}">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                        </button>
                        <button type="button" class="nf-card-mini-btn js-wall-btn" title="Pin to Multi-Cam Wall" aria-label="Add ${escapeHtml(cam.name)} to Multi-Cam Wall">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                        </button>
                    </div>
                </div>
            </div>
            <div class="nf-card-body">
                <div class="nf-card-title" title="${escapeHtml(cam.name)}">${escapeHtml(cam.name)}</div>
                <div class="nf-card-meta">
                    <span class="nf-card-country">${flagHtml} <span>${escapeHtml(cam.country)}</span></span>
                    <span class="nf-card-live-tag"><span class="pulse-dot"></span>LIVE</span>
                </div>
                <div class="nf-card-tags">${escapeHtml(tagText)}</div>
            </div>
        `;

        const cover = card.querySelector(".nf-card-cover");
        const thumbImg = card.querySelector(".js-card-thumb");
        if (thumbImg) {
            if (thumbImg.complete && thumbImg.naturalWidth > 0) {
                cover.classList.add("has-thumb");
            }
            thumbImg.addEventListener("load", () => cover.classList.add("has-thumb"));
            thumbImg.addEventListener("error", () => thumbImg.remove());
        }

        card.addEventListener("click", e => {
            if (e.target.closest(".js-fav-btn")) {
                e.stopPropagation();
                toggleFavorite(cam);
                return;
            }
            if (e.target.closest(".js-wall-btn")) {
                e.stopPropagation();
                pinCamToWall(cam);
                return;
            }
            playWebcam(cam, queue || [cam]);
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

    function renderRowTrack(trackEl, cams, isTop10 = false) {
        trackEl.innerHTML = "";
        if (!cams || !cams.length) {
            const empty = document.createElement("div");
            empty.className = "nf-empty-inline";
            empty.textContent = "No webcams available for this filter.";
            trackEl.appendChild(empty);
            return;
        }
        const frag = document.createDocumentFragment();
        const slice = cams.slice(0, isTop10 ? 10 : 30);
        slice.forEach((cam, idx) => {
            frag.appendChild(buildCamCard(cam, {
                rank: isTop10 ? idx + 1 : null,
                isTop10,
                queue: slice
            }));
        });
        trackEl.appendChild(frag);
        requestAnimationFrame(() => updateScrollArrows(trackEl));
    }

    function renderGrid(gridEl, cams, emptyMsg = "No matching webcams found.") {
        gridEl.innerHTML = "";
        const list = filterCams(cams).slice(0, 120);
        if (!list.length) {
            const box = document.createElement("div");
            box.className = "nf-empty-box";
            box.textContent = emptyMsg;
            gridEl.appendChild(box);
            return;
        }
        const frag = document.createDocumentFragment();
        list.forEach(cam => frag.appendChild(buildCamCard(cam, { queue: list })));
        gridEl.appendChild(frag);
    }

    function createRowSection({ id, title, subtitle = "", isTop10 = false, skeletonCount = 7 }) {
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

        leftBtn.addEventListener("click", () => track.scrollBy({ left: -Math.max(420, track.clientWidth * 0.8), behavior: "smooth" }));
        rightBtn.addEventListener("click", () => track.scrollBy({ left: Math.max(420, track.clientWidth * 0.8), behavior: "smooth" }));
        track.addEventListener("scroll", () => updateScrollArrows(track), { passive: true });

        return { section, track, titleEl: section.querySelector(`#row-title-${id}`), countEl: section.querySelector(`#row-count-${id}`) };
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

    function buildCompactListItem(cam, queue) {
        registerCam(cam);
        const [c1, c2] = getPalette(cam.id + cam.name);
        const isPlaying = state.currentCam?.id === cam.id && state.stageVisible;
        const hasHls = camHasType(cam, "hls");
        const item = document.createElement("button");
        item.type = "button";
        item.className = `nf-list-item${isPlaying ? " is-playing" : ""}`;
        item.dataset.camId = cam.id;

        item.innerHTML = `
            <div class="nf-list-thumb" style="background: linear-gradient(135deg, ${c1}, ${c2});">
                ${cam.thumbnail ? `<img src="${escapeHtml(cam.thumbnail)}" alt="" loading="lazy" onerror="this.remove()">` : ""}
                <span>${escapeHtml(getInitials(cam.name))}</span>
            </div>
            <div class="nf-list-info">
                <div class="nf-list-title">${escapeHtml(cam.name)}</div>
                <div class="nf-list-sub">${countryFlagHtml(cam.countryCode)} <span>${escapeHtml(cam.country)} &bull; ${hasHls ? "HLS" : "YouTube"}</span></div>
            </div>
            <span class="nf-card-badge ${hasHls ? "hls" : "yt"}">${hasHls ? "HLS" : "YT"}</span>
        `;

        const img = item.querySelector("img");
        if (img) {
            img.addEventListener("load", () => {
                const span = item.querySelector(".nf-list-thumb span");
                if (span) span.style.display = "none";
            });
        }

        item.addEventListener("click", () => playWebcam(cam, queue));
        return item;
    }

    // --- BROWSE ROWS & HERO ORCHESTRATION ---
    function pickHeroPool() {
        const usable = filterCams(state.allCams);
        const withThumbs = usable.filter(c => c.thumbnail);
        const withHls = usable.filter(c => camHasType(c, "hls"));
        const pool = [];
        // Interleave iconic thumbnail cams and HLS cams
        const maxLen = Math.max(withThumbs.length, withHls.length);
        for (let i = 0; i < Math.min(maxLen, 12); i++) {
            if (withThumbs[i]) pool.push(withThumbs[i]);
            if (withHls[i] && pool.length < 14) pool.push(withHls[i]);
        }
        state.heroPool = pool.length ? pool : SEED_WEBCAMS;
        state.heroIndex = 0;
        renderHero();
    }

    function renderHero() {
        const cam = state.heroPool[state.heroIndex] || state.heroPool[0] || SEED_WEBCAMS[0];
        if (!cam) return;
        const [a1, a2] = getPalette(cam.id + cam.name);
        dom.heroSection.style.setProperty("--hero-accent", a1);
        dom.heroSection.style.setProperty("--hero-accent-2", a2);

        if (cam.thumbnail) {
            const hiRes = cam.thumbnail.replace("hqdefault.jpg", "maxresdefault.jpg");
            dom.heroImageLayer.style.backgroundImage = `url("${hiRes}"), url("${cam.thumbnail}")`;
            dom.heroImageLayer.style.opacity = "0.45";
        } else {
            dom.heroImageLayer.style.backgroundImage = "none";
            dom.heroImageLayer.style.opacity = "0";
        }

        dom.heroTitle.textContent = cam.name;
        const catText = cam.categories.length ? cam.categories.slice(0, 3).join(", ") : "Live Worldwide Feed";
        const isHls = camHasType(cam, "hls");
        dom.heroDesc.textContent = `Streaming live from ${cam.country}. Category: ${catText}. Powered by ${isHls ? "Vidstack adaptive HLS playback" : "seamless YouTube Live embed switching"} with live local weather & timezone telemetry.`;
        dom.heroCountryChip.innerHTML = `${countryFlagHtml(cam.countryCode)} <span>${escapeHtml(cam.country)}</span>`;
        dom.heroFormatChip.textContent = isHls && camHasType(cam, "youtube")
            ? "HLS + YouTube Dual"
            : isHls ? "Vidstack HLS (.m3u8)" : "YouTube Live Iframe";
        dom.heroCategoryChip.textContent = cam.categories.slice(0, 2).join(" / ") || "Global Webcam";
        updateBadges();
    }

    async function buildBrowseRows() {
        const container = dom.browseRowsContainer;
        container.innerHTML = "";

        // 1. Personal Rows
        if (state.history.length > 0) {
            const recentRow = createRowSection({ id: "recent", title: "Continue Watching", subtitle: `${state.history.length} recent`, skeletonCount: 4 });
            container.appendChild(recentRow.section);
            renderRowTrack(recentRow.track, filterCams(state.history));
        }
        if (state.favorites.length > 0) {
            const favRow = createRowSection({ id: "favorites", title: "My List", subtitle: `${state.favorites.length} saved`, skeletonCount: 4 });
            container.appendChild(favRow.section);
            renderRowTrack(favRow.track, filterCams(state.favorites));
        }
        if (state.customCams.length > 0) {
            const customRow = createRowSection({ id: "custom", title: "My Custom Cameras", subtitle: `${state.customCams.length} custom`, skeletonCount: 3 });
            container.appendChild(customRow.section);
            renderRowTrack(customRow.track, filterCams(state.customCams));
        }

        // 2. Top 10 Global Webcams
        const top10Row = createRowSection({ id: "top10", title: "Top 10 Live Webcams Worldwide", subtitle: "Featured live views", isTop10: true, skeletonCount: 6 });
        container.appendChild(top10Row.section);

        // 3. Direct Vidstack HLS Streams Row
        const hlsRow = createRowSection({ id: "hls", title: "Direct HLS Streams — Vidstack Player", subtitle: "Adaptive .m3u8 live feeds", skeletonCount: 7 });
        container.appendChild(hlsRow.section);

        // 4. Local Country Spotlight
        const userCode = state.userLocation.code;
        const localMeta = state.countriesMeta[userCode];
        const localName = localMeta?.country || state.userLocation.country || "Your Region";
        const { timeStr } = getLocalClockInfo(localMeta?.timeZone);
        const localRow = createRowSection({
            id: "local",
            title: `Live in ${countryCodeToFlag(userCode)} ${localName}`,
            subtitle: timeStr ? `Local time ${timeStr}` : "Regional cameras"
        });
        container.appendChild(localRow.section);

        // 5. Category Showcase Rows (lazy-loaded via Famelack category JSONs)
        const categoryRowDefs = [
            { id: "city", slug: "city", title: "Iconic Cities & Skylines" },
            { id: "beach", slug: "beach", title: "Beaches, Coasts & Surf Cams" },
            { id: "animals", slug: "animals", title: "Wildlife, Zoos & Safari Feeds" },
            { id: "harbor", slug: "harbor", title: "Harbors, Ports & Waterways" },
            { id: "airport", slug: "airport", title: "Airports, Aviation & Railcams" },
            { id: "nature", slug: "nature", title: "Mountains, Volcanoes & Nature" },
            { id: "space", slug: "space", title: "Space, ISS & Weather Stations" }
        ];

        const catRows = categoryRowDefs.map(def => {
            const row = createRowSection({ id: def.id, title: def.title, subtitle: "Loading cameras..." });
            container.appendChild(row.section);
            return { ...def, row };
        });

        // Populate Top 10 + HLS + Local immediately from loaded catalogs
        const usable = filterCams(state.allCams);
        const featuredPool = usable.filter(c => c.thumbnail || camHasType(c, "hls"));
        const top10Pick = [];
        const step = Math.max(1, Math.floor(featuredPool.length / 10));
        for (let i = 0; i < featuredPool.length && top10Pick.length < 10; i += step) {
            featuredPool[i].isFeatured = true;
            top10Pick.push(featuredPool[i]);
        }
        renderRowTrack(top10Row.track, top10Pick.length ? top10Pick : usable.slice(0, 10), true);

        const hlsList = filterCams(state.allCams.filter(c => camHasType(c, "hls")));
        hlsRow.countEl.textContent = hlsList.length ? `${hlsList.length} HLS feeds` : "Loading HLS GeoJSON...";
        renderRowTrack(hlsRow.track, hlsList);

        loadCamsForCountry(userCode).then(localList => {
            const filtered = filterCams(localList);
            if (!filtered.length) {
                localRow.section.classList.add("hidden");
                return;
            }
            localRow.section.classList.remove("hidden");
            localRow.countEl.textContent = `${filtered.length} cameras${timeStr ? ` • ${timeStr}` : ""}`;
            renderRowTrack(localRow.track, filtered);
        });

        // Lazy-load category rows smoothly
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const match = catRows.find(r => r.row.section === entry.target);
                if (!match) return;
                obs.unobserve(entry.target);
                loadFamelackCategory(match.slug).then(cams => {
                    const filtered = filterCams(cams);
                    match.row.countEl.textContent = `${filtered.length} cameras`;
                    renderRowTrack(match.row.track, filtered);
                });
            });
        }, { rootMargin: "320px" });

        catRows.forEach(r => observer.observe(r.row.section));
    }

    function refreshHlsRowWhenReady() {
        const hlsRowTrack = document.getElementById("row-track-hls");
        const hlsRowCount = document.getElementById("row-count-hls");
        if (hlsRowTrack) {
            const hlsList = filterCams(state.allCams.filter(c => camHasType(c, "hls")));
            if (hlsRowCount) hlsRowCount.textContent = `${hlsList.length} HLS feeds`;
            renderRowTrack(hlsRowTrack, hlsList);
        }
        pickHeroPool();
    }

    // --- SEARCH & FILTERING ---
    let searchDebounceTimer = null;
    async function runSearchOrFilter() {
        const query = state.searchQuery.trim().toLowerCase();
        const category = state.selectedCategory;
        const country = state.selectedCountry;
        const streamType = state.selectedStreamType;

        const isFiltered = query.length >= 2 || category !== "all" || Boolean(country) || streamType !== "all";
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

        const labelParts = [];
        if (query) labelParts.push(`"${state.searchQuery.trim()}"`);
        if (category !== "all") labelParts.push(category.toUpperCase());
        if (streamType === "hls") labelParts.push("VIDSTACK HLS");
        if (streamType === "youtube") labelParts.push("YOUTUBE LIVE");
        if (country) labelParts.push(`${countryCodeToFlag(country)} ${state.countriesMeta[country]?.country || country}`);

        dom.searchResultsTitle.textContent = `Results: ${labelParts.join(" • ")}`;
        dom.searchResultsSubtitle.textContent = "Filtering global webcam directory...";

        let pool = state.allCams;
        if (country) {
            pool = await loadCamsForCountry(country);
        }
        if (category !== "all") {
            const catPool = await loadFamelackCategory(category);
            if (country) {
                const catIds = new Set(catPool.map(c => c.id));
                pool = pool.filter(c => catIds.has(c.id) || c.categories.includes(category));
            } else {
                pool = catPool;
            }
        }

        const matched = filterCams(pool).filter(cam => {
            if (!query) return true;
            return (
                cam.name.toLowerCase().includes(query) ||
                cam.country.toLowerCase().includes(query) ||
                cam.countryCode.toLowerCase() === query ||
                cam.categories.some(cat => cat.toLowerCase().includes(query)) ||
                (query === "hls" && camHasType(cam, "hls")) ||
                (query === "youtube" && camHasType(cam, "youtube"))
            );
        });

        dom.searchResultsSubtitle.textContent = `${matched.length} live camera${matched.length === 1 ? "" : "s"} found`;
        renderGrid(dom.searchResultsGrid, matched);
    }

    // --- VIDSTACK HLS <-> YOUTUBE IFRAME PLAYBACK ENGINE ---
    function clearStreamTimer() {
        if (state.streamTimer) {
            clearTimeout(state.streamTimer);
            state.streamTimer = null;
        }
    }

    function stopVidstackPlayer() {
        try { dom.vidstackPlayer.pause(); } catch { /* ignore */ }
        try { dom.vidstackPlayer.src = ""; } catch { /* ignore */ }
        const video = dom.vidstackPlayer.querySelector("video");
        if (video) {
            try {
                video.pause();
                video.removeAttribute("src");
                video.load();
            } catch { /* ignore */ }
        }
        dom.vidstackPlayer.classList.add("hidden");
    }

    function stopYouTubePlayer() {
        dom.youtubePlayer.removeAttribute("src");
        dom.youtubePlayer.src = "about:blank";
        dom.youtubePlayer.classList.add("hidden");
    }

    function setStageStatus(status, customLabel = null) {
        state.playbackStatus = status;
        const map = {
            idle: { cls: "idle", text: "IDLE" },
            loading: { cls: "loading", text: customLabel || "CONNECTING" },
            playing: { cls: "live", text: customLabel || "LIVE" },
            paused: { cls: "idle", text: "PAUSED" },
            error: { cls: "error", text: customLabel || "OFFLINE" }
        };
        const cfg = map[status] || map.idle;

        [dom.stageStatusPill, dom.dockStatusPill].forEach(el => {
            if (!el) return;
            el.className = `nf-status-pill ${cfg.cls}`;
            el.textContent = cfg.text;
        });

        document.querySelectorAll(".nf-card[data-cam-id]").forEach(card => {
            card.classList.toggle("is-playing", state.stageVisible && card.dataset.camId === state.currentCam?.id);
        });
        document.querySelectorAll(".nf-list-item[data-cam-id]").forEach(item => {
            item.classList.toggle("is-playing", state.stageVisible && item.dataset.camId === state.currentCam?.id);
        });
    }

    function showOverlayLoading(title, desc) {
        dom.playerOverlay.classList.remove("hidden");
        dom.overlaySpinner.classList.remove("hidden");
        dom.overlayErrorIcon.classList.add("hidden");
        dom.overlayActions.classList.add("hidden");
        dom.overlayTitle.textContent = title;
        dom.overlayDesc.textContent = desc;
    }

    function showOverlayError(title, desc, externalUrl = "") {
        dom.playerOverlay.classList.remove("hidden");
        dom.overlaySpinner.classList.add("hidden");
        dom.overlayErrorIcon.classList.remove("hidden");
        dom.overlayActions.classList.remove("hidden");
        dom.overlayTitle.textContent = title;
        dom.overlayDesc.textContent = desc;
        if (externalUrl) {
            dom.overlayExternalLink.href = externalUrl;
            dom.overlayExternalLink.classList.remove("hidden");
        } else {
            dom.overlayExternalLink.classList.add("hidden");
        }
    }

    function hideOverlay() {
        dom.playerOverlay.classList.add("hidden");
    }

    function renderStreamVariantPills(cam, sources, activeIdx) {
        dom.streamVariants.innerHTML = "";
        if (!sources || sources.length <= 1) return;
        sources.forEach((src, idx) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = `wc-variant-pill${idx === activeIdx ? " active" : ""}`;
            btn.textContent = src.label;
            btn.addEventListener("click", () => {
                if (!state.currentCam) return;
                attemptSourceIndex(cam, sources, idx, ++state.playToken);
            });
            dom.streamVariants.appendChild(btn);
        });
    }

    function updateStageMetadata(cam, activeSource) {
        dom.npTitle.textContent = cam.name;
        dom.hudCamTitle.textContent = `${cam.name} • ${cam.countryCode || cam.country}`;
        dom.npSourceTag.textContent = cam.origin === "env" ? "Live Env HLS" : cam.origin === "custom" ? "Custom Cam" : "Famelack";

        const subParts = [
            `${countryFlagHtml(cam.countryCode)} <span>${escapeHtml(cam.country)}</span>`
        ];
        if (cam.categories.length) subParts.push(escapeHtml(cam.categories.slice(0, 3).join(", ")));
        if (cam.attribution) subParts.push(escapeHtml(cam.attribution));
        dom.npSub.innerHTML = subParts.join(" &bull; ");

        if (cam.thumbnail) {
            dom.npAvatar.innerHTML = `<img src="${escapeHtml(cam.thumbnail)}" alt="" onerror="this.parentElement.textContent='${escapeHtml(getInitials(cam.name))}'">`;
            dom.dockThumbImg.src = cam.thumbnail;
            dom.dockThumbImg.classList.remove("hidden");
            dom.dockThumbFallback.classList.add("hidden");
        } else {
            dom.npAvatar.textContent = getInitials(cam.name);
            dom.dockThumbImg.classList.add("hidden");
            dom.dockThumbFallback.textContent = getInitials(cam.name);
            dom.dockThumbFallback.classList.remove("hidden");
        }

        dom.dockCamName.textContent = cam.name;
        dom.dockCamMeta.textContent = `${cam.country} • ${activeSource?.type === "youtube" ? "YouTube Live" : "Vidstack HLS"}`;
        dom.stageFavBtn.classList.toggle("active", isFavorited(cam.id));

        // Up Next Queue
        const qList = state.currentQueue.filter(c => c.id !== cam.id).slice(0, 12);
        dom.upNextCount.textContent = `${qList.length} cams`;
        dom.stageUpNextList.innerHTML = "";
        if (!qList.length) {
            dom.stageUpNextList.innerHTML = `<div class="nf-empty-inline">Browse a category or country to fill queue.</div>`;
        } else {
            const frag = document.createDocumentFragment();
            qList.forEach(c => frag.appendChild(buildCompactListItem(c, state.currentQueue)));
            dom.stageUpNextList.appendChild(frag);
        }

        renderTelemetryUI(cam, cam.lat !== null ? { lat: cam.lat, lon: cam.lon } : null, null);
        fetchWeatherForCam(cam);
    }

    async function playWebcam(cam, queue = null, startSourceIndex = 0) {
        if (!cam) return;
        registerCam(cam);

        const token = ++state.playToken;
        state.currentCam = cam;
        state.stageVisible = true;
        if (Array.isArray(queue) && queue.length) {
            state.currentQueue = queue;
        } else if (!state.currentQueue.some(c => c.id === cam.id)) {
            state.currentQueue = [cam, ...state.currentQueue];
        }

        const sources = getPlayableSources(cam);
        if (!sources.length) {
            dom.cinemaStage.classList.remove("hidden");
            updateStageMetadata(cam, cam.sources[0]);
            setStageStatus("error", "HTTP ONLY");
            showOverlayError(
                "Stream Filtered by HTTPS Safe",
                `"${cam.name}" only has HTTP streams. Toggle off "HTTPS Safe" if testing locally, or try another camera.`,
                cam.sources[0]?.url || ""
            );
            return;
        }

        recordHistory(cam);
        dom.cinemaStage.classList.remove("hidden");
        if (state.activeView === "wall") {
            switchView("browse");
        }
        dom.cinemaStage.scrollIntoView({ behavior: "smooth", block: "start" });

        await attemptSourceIndex(cam, sources, startSourceIndex, token);
    }

    async function attemptSourceIndex(cam, sources, idx, token) {
        if (token !== state.playToken) return;
        clearStreamTimer();

        if (idx >= sources.length) {
            const primary = sources[0];
            setStageStatus("error", "UNAVAILABLE");
            showOverlayError(
                "Webcam Stream Offline or Restricted",
                location.protocol === "file:" && primary?.type === "youtube"
                    ? "YouTube embeds may block file:// origins (Error 153). Serve over http://localhost or open the source directly."
                    : `"${cam.name}" could not be loaded in-browser (stream offline or CORS/embed restricted).`,
                primary?.url || ""
            );
            return;
        }

        state.currentSourceIndex = idx;
        const source = sources[idx];
        updateStageMetadata(cam, source);
        renderStreamVariantPills(cam, sources, idx);

        if (source.type === "youtube") {
            // Switch from Vidstack HLS player -> YouTube Live Iframe (just like famelack.com)
            state.activeEngine = "youtube";
            stopVidstackPlayer();

            const videoId = source.videoId || extractYouTubeId(source.url);
            if (!videoId) {
                attemptSourceIndex(cam, sources, idx + 1, token);
                return;
            }

            dom.stageEngineChip.textContent = "YOUTUBE LIVE IFRAME";
            dom.stageEngineChip.classList.add("is-youtube");
            hideOverlay();
            setStageStatus("playing", "YOUTUBE LIVE");

            dom.youtubePlayer.classList.remove("hidden");
            dom.youtubePlayer.src = buildYouTubeEmbedUrl(videoId);
        } else {
            // Switch from YouTube Iframe -> Vidstack HLS Player
            state.activeEngine = "hls";
            stopYouTubePlayer();

            const url = source.url.startsWith("//") ? `https:${source.url}` : source.url;
            dom.stageEngineChip.textContent = "VIDSTACK HLS";
            dom.stageEngineChip.classList.remove("is-youtube");
            setStageStatus("loading", sources.length > 1 ? `SOURCE ${idx + 1}/${sources.length}` : "CONNECTING");
            showOverlayLoading(`Connecting to ${cam.name}`, "Initializing Vidstack HLS stream...");

            dom.vidstackPlayer.classList.remove("hidden");

            try {
                await Promise.race([
                    customElements.whenDefined("media-player"),
                    new Promise(res => setTimeout(res, 3500))
                ]);
            } catch { /* proceed */ }

            if (token !== state.playToken) return;

            dom.vidstackPlayer.title = cam.name;
            dom.vidstackPlayer.poster = cam.thumbnail || "";

            const isHls = url.toLowerCase().includes(".m3u8") || source.format === "hls";
            dom.vidstackPlayer.src = isHls
                ? { src: url, type: "application/x-mpegurl" }
                : url;

            // Watchdog timeout: rotate to next source if HLS stalls/CORS-fails
            state.streamTimer = setTimeout(() => {
                if (token !== state.playToken) return;
                if (state.playbackStatus === "loading") {
                    console.warn(`[Vidstack] Source timeout (${url}), rotating...`);
                    attemptSourceIndex(cam, sources, idx + 1, token);
                }
            }, 13000);
        }
    }

    function wireVidstackEvents() {
        const player = dom.vidstackPlayer;
        if (!player) return;

        // Configure Vidstack HLS.js provider options cleanly
        player.addEventListener("provider-change", e => {
            const provider = e.detail;
            if (!provider) return;
            try {
                if (provider.type === "hls") {
                    provider.config = {
                        enableWorker: true,
                        lowLatencyMode: true,
                        backBufferLength: 30,
                        manifestLoadingTimeOut: 10000
                    };
                }
            } catch { /* ignore */ }
        });

        ["can-play", "playing", "loaded-data", "time-update"].forEach(evt => {
            player.addEventListener(evt, () => {
                if (!state.currentCam || state.activeEngine !== "hls") return;
                clearStreamTimer();
                hideOverlay();
                setStageStatus("playing", "LIVE HLS");
            });
        });

        player.addEventListener("waiting", () => {
            if (!state.currentCam || state.activeEngine !== "hls") return;
            if (state.playbackStatus === "playing") {
                setStageStatus("loading", "BUFFERING");
            }
        });

        player.addEventListener("pause", () => {
            if (!state.currentCam || state.activeEngine !== "hls") return;
            if (state.playbackStatus === "playing") {
                setStageStatus("paused");
            }
        });

        player.addEventListener("error", () => {
            if (!state.currentCam || state.activeEngine !== "hls") return;
            clearStreamTimer();
            const sources = getPlayableSources(state.currentCam);
            const nextIdx = state.currentSourceIndex + 1;
            if (nextIdx < sources.length) {
                attemptSourceIndex(state.currentCam, sources, nextIdx, state.playToken);
            } else {
                setStageStatus("error", "OFFLINE / CORS");
                showOverlayError(
                    "Stream Unavailable in Browser",
                    `Vidstack could not play "${state.currentCam.name}" (stream offline or CORS restricted by operator).`,
                    sources[state.currentSourceIndex]?.url || ""
                );
            }
        });

        // Listen for YouTube iframe postMessage errors (100/101/150) for auto-failover
        window.addEventListener("message", e => {
            if (!state.currentCam || state.activeEngine !== "youtube") return;
            if (typeof e.data !== "string" || !e.origin.includes("youtube")) return;
            try {
                const payload = JSON.parse(e.data);
                if (payload?.event === "onError" && [2, 5, 100, 101, 150].includes(Number(payload.info))) {
                    const sources = getPlayableSources(state.currentCam);
                    const nextIdx = state.currentSourceIndex + 1;
                    if (nextIdx < sources.length) {
                        attemptSourceIndex(state.currentCam, sources, nextIdx, state.playToken);
                    } else {
                        setStageStatus("error", "EMBED RESTRICTED");
                        showOverlayError(
                            "YouTube Live Stream Unavailable",
                            "The stream owner disabled embedding or the live broadcast has ended.",
                            sources[state.currentSourceIndex]?.url || ""
                        );
                    }
                }
            } catch { /* ignore non-JSON messages */ }
        });
    }

    function closeCinemaStage() {
        state.playToken++;
        clearStreamTimer();
        stopAutoTour();
        stopVidstackPlayer();
        stopYouTubePlayer();
        state.stageVisible = false;
        state.activeEngine = null;
        dom.cinemaStage.classList.add("hidden");
        dom.miniDock.classList.add("hidden");
        document.body.classList.remove("has-dock");
        setStageStatus("idle");
    }

    function stepCam(delta) {
        const list = state.currentQueue.length ? filterCams(state.currentQueue) : filterCams(state.allCams);
        if (!list.length) return;
        const idx = state.currentCam ? list.findIndex(c => c.id === state.currentCam.id) : -1;
        const nextIdx = idx < 0 ? 0 : (idx + delta + list.length) % list.length;
        playWebcam(list[nextIdx], list);
    }

    function playRandomWebcam() {
        const usable = filterCams(state.allCams);
        if (!usable.length) {
            showToast("Still loading global webcams...");
            return;
        }
        const pick = usable[Math.floor(Math.random() * usable.length)];
        showToast(`Teleporting to ${pick.name} (${pick.country})...`);
        playWebcam(pick, usable.slice(0, 40));
    }

    // --- SNAPSHOT, AUTO-TOUR & STAGE UTILITIES ---
    function captureLiveSnapshot() {
        if (!state.currentCam) return;
        if (state.activeEngine !== "hls") {
            showToast("Snapshots work on Vidstack HLS streams (YouTube iframes restrict pixel capture).");
            return;
        }
        const video = dom.vidstackPlayer.querySelector("video");
        if (!video || !video.videoWidth) {
            showToast("Wait for the HLS video frame to finish loading first.");
            return;
        }
        try {
            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            const safe = state.currentCam.name.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
            link.download = `${safe}_${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
            showToast("Snapshot downloaded!");
        } catch {
            showToast("Stream CORS policy prevents saving canvas frames for this feed.");
        }
    }

    function toggleAutoTour() {
        state.autoTour = !state.autoTour;
        dom.autoTourBtn.classList.toggle("active", state.autoTour);
        if (state.autoTour) {
            dom.autoTourLabel.textContent = "Tour ON";
            showToast("Auto-Tour enabled: rotating live cams every 45s");
            clearInterval(state.autoTourTimer);
            state.autoTourTimer = setInterval(() => {
                if (state.stageVisible) stepCam(1);
            }, 45000);
        } else {
            stopAutoTour();
            showToast("Auto-Tour paused");
        }
    }

    function stopAutoTour() {
        state.autoTour = false;
        clearInterval(state.autoTourTimer);
        state.autoTourTimer = null;
        dom.autoTourBtn.classList.remove("active");
        dom.autoTourLabel.textContent = "Auto-Tour";
    }

    // --- 2x2 MULTI-CAM CONTROL ROOM WALL ---
    function pinCamToWall(cam, targetSlot = null) {
        if (!cam) return;
        registerCam(cam);
        let idx = targetSlot;
        if (idx === null) {
            idx = state.wallSlots.findIndex(s => !s);
            if (idx < 0) idx = 0;
        }
        state.wallSlots[idx] = cam;
        saveWallSlots();
        showToast(`Pinned "${cam.name}" to Wall Slot ${idx + 1}`);
        if (state.activeView === "wall") renderWallGrid();
    }

    function teardownWallMedia() {
        dom.wallGrid.querySelectorAll("media-player").forEach(mp => {
            try { mp.pause(); mp.src = ""; } catch { /* ignore */ }
        });
        dom.wallGrid.querySelectorAll("iframe").forEach(fr => {
            fr.src = "about:blank";
        });
    }

    function renderWallGrid() {
        teardownWallMedia();
        dom.wallGrid.innerHTML = "";

        state.wallSlots.forEach((cam, slotIdx) => {
            const tile = document.createElement("div");
            tile.className = "wc-wall-slot";

            if (!cam) {
                tile.innerHTML = `
                    <div class="wc-wall-empty">
                        <strong>Slot ${slotIdx + 1} Empty</strong>
                        <span>Assign any HLS (.m3u8) or YouTube Live webcam to monitor simultaneously.</span>
                        <button type="button" class="nf-btn nf-btn-play nf-btn-sm js-pick-slot">+ Add Camera</button>
                    </div>
                `;
                tile.querySelector(".js-pick-slot").addEventListener("click", () => openWallPicker(slotIdx));
                dom.wallGrid.appendChild(tile);
                return;
            }

            const sources = getPlayableSources(cam);
            const src = sources[0] || cam.sources[0];

            if (src?.type === "youtube") {
                const videoId = src.videoId || extractYouTubeId(src.url);
                const iframe = document.createElement("iframe");
                iframe.title = cam.name;
                iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
                iframe.referrerPolicy = "strict-origin-when-cross-origin";
                iframe.allowFullscreen = true;
                iframe.src = `${buildYouTubeEmbedUrl(videoId)}&mute=1`;
                tile.appendChild(iframe);
            } else if (src) {
                const mp = document.createElement("media-player");
                mp.setAttribute("stream-type", "live");
                mp.setAttribute("muted", "");
                mp.setAttribute("autoplay", "");
                mp.setAttribute("playsinline", "");
                mp.title = cam.name;
                mp.innerHTML = `<media-provider></media-provider><media-video-layout></media-video-layout>`;
                const isHls = src.url.toLowerCase().includes(".m3u8") || src.format === "hls";
                mp.src = isHls ? { src: src.url, type: "application/x-mpegurl" } : src.url;
                tile.appendChild(mp);
            }

            const bar = document.createElement("div");
            bar.className = "wc-wall-slot-bar";
            bar.innerHTML = `
                <div class="wc-wall-slot-title">
                    <span class="pulse-dot"></span>
                    ${countryFlagHtml(cam.countryCode)}
                    <span>${escapeHtml(cam.name)}</span>
                </div>
                <div class="wc-wall-slot-btns">
                    <button type="button" class="wc-wall-mini-btn js-focus-slot" title="Open in Main Cinema Stage">Focus</button>
                    <button type="button" class="wc-wall-mini-btn js-swap-slot" title="Swap Camera">Swap</button>
                    <button type="button" class="wc-wall-mini-btn js-clear-slot" title="Remove">&times;</button>
                </div>
            `;
            bar.querySelector(".js-focus-slot").addEventListener("click", () => playWebcam(cam, state.wallSlots.filter(Boolean)));
            bar.querySelector(".js-swap-slot").addEventListener("click", () => openWallPicker(slotIdx));
            bar.querySelector(".js-clear-slot").addEventListener("click", () => {
                state.wallSlots[slotIdx] = null;
                saveWallSlots();
                renderWallGrid();
            });
            tile.appendChild(bar);
            dom.wallGrid.appendChild(tile);
        });
    }

    function applyWallPreset(mode) {
        const usable = filterCams(state.allCams);
        let pool = usable;
        if (mode === "hls") {
            pool = usable.filter(c => camHasType(c, "hls"));
        } else if (mode === "beach") {
            pool = usable.filter(c => c.categories.includes("beach") || c.categories.includes("harbor"));
        } else {
            pool = usable.filter(c => c.thumbnail || camHasType(c, "hls"));
        }
        if (!pool.length) pool = usable;

        const chosen = [];
        const step = Math.max(1, Math.floor(pool.length / 4));
        for (let i = 0; i < pool.length && chosen.length < 4; i += step) {
            chosen.push(pool[i]);
        }
        for (let i = 0; i < 4; i++) {
            state.wallSlots[i] = chosen[i] || null;
        }
        saveWallSlots();
        renderWallGrid();
    }

    function openWallPicker(slotIdx) {
        state.activePickerSlot = slotIdx;
        dom.wallPickerSearch.value = "";
        renderWallPickerList("");
        dom.pickWallCamModal.classList.remove("hidden");
        dom.wallPickerSearch.focus();
    }

    function renderWallPickerList(filterText) {
        const q = filterText.trim().toLowerCase();
        const list = filterCams(state.allCams)
            .filter(c => !q || c.name.toLowerCase().includes(q) || c.country.toLowerCase().includes(q) ||
                (q === "hls" && camHasType(c, "hls")) || (q === "youtube" && camHasType(c, "youtube")))
            .slice(0, 50);

        dom.wallPickerList.innerHTML = "";
        if (!list.length) {
            dom.wallPickerList.innerHTML = `<div class="nf-empty-inline">No matching cameras found.</div>`;
            return;
        }
        const frag = document.createDocumentFragment();
        list.forEach(cam => {
            const item = buildCompactListItem(cam, list);
            // Override click to assign wall slot instead of playing main stage
            const clone = item.cloneNode(true);
            clone.addEventListener("click", () => {
                pinCamToWall(cam, state.activePickerSlot);
                dom.pickWallCamModal.classList.add("hidden");
            });
            frag.appendChild(clone);
        });
        dom.wallPickerList.appendChild(frag);
    }

    // --- 3D INTERACTIVE WORLD WEBCAM GLOBE (D3 ORTHOGRAPHIC) ---
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
                        coords: centroid
                    });
                });

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
                        coords
                    });
                });

                g.countryNodes = nodes;
            }
            g.loaded = true;
            bindGlobeInteractions();
            startGlobeRenderLoop();
            selectGlobeCountry(state.userLocation.code || "US", true);
        } catch (err) {
            console.warn("Globe load error:", err);
            dom.globeCamList.innerHTML = `<div class="nf-empty-inline">3D globe geometry unavailable. Use quick country pills above.</div>`;
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
        const upper = String(code || "US").toUpperCase();
        state.globe.selectedCode = upper;
        const meta = state.countriesMeta[upper];

        dom.globeCountryFlag.innerHTML = countryFlagHtml(upper);
        dom.globeCountryName.textContent = meta?.country || upper;
        dom.globeCountrySub.textContent = meta?.capital ? `${meta.capital} • Loading cams...` : "Loading cams...";
        dom.globeLocalTime.textContent = getLocalClockInfo(meta?.timeZone).timeStr || "--:--";

        if (fly) {
            const node = state.globe.countryNodes.find(n => n.code === upper);
            if (node) {
                state.globe.autoSpin = false;
                dom.globeAutoSpin.classList.remove("active");
                state.globe.rotation = [-node.coords[0], -node.coords[1], 0];
            }
        }

        renderGlobeQuickPills(dom.globeCountrySearch.value);
        dom.globeCamList.innerHTML = `<div class="nf-empty-inline">Fetching ${escapeHtml(meta?.country || upper)} live cameras...</div>`;

        const cams = filterCams(await loadCamsForCountry(upper));
        dom.globeCountrySub.textContent = `${meta?.capital ? `${meta.capital} • ` : ""}${cams.length} live cam${cams.length === 1 ? "" : "s"}`;

        dom.globeCamList.innerHTML = "";
        if (!cams.length) {
            dom.globeCamList.innerHTML = `<div class="nf-empty-inline">No playable webcams found for this country under current filters.</div>`;
            return;
        }
        const frag = document.createDocumentFragment();
        cams.slice(0, 60).forEach(cam => frag.appendChild(buildCompactListItem(cam, cams)));
        dom.globeCamList.appendChild(frag);
    }

    function getGlobeProjection(width, height) {
        const baseRadius = Math.min(width, height) * 0.4 * state.globe.scaleFactor;
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

            const hit = findNearestGlobeNode(px, py, rect.width, rect.height);
            g.hoveredNode = hit;
            if (hit) {
                canvas.style.cursor = "pointer";
                const time = getLocalClockInfo(hit.timeZone).timeStr;
                dom.globeTooltip.innerHTML = `
                    <strong>${countryFlagHtml(hit.code)} ${escapeHtml(hit.name)}</strong><br>
                    <span>${hit.channelCount || "Live"} webcams${time ? ` &bull; ${time}` : ""}</span>
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

    function startGlobeRenderLoop() {
        const canvas = dom.globeCanvas;
        const ctx = canvas.getContext("2d");
        const graticule = window.d3.geoGraticule10();
        let pulseTick = 0;

        function frame() {
            if (!dom.views.globe.classList.contains("hidden") && state.globe.loaded) {
                const stageEl = canvas.parentElement || canvas;
                const rect = stageEl.getBoundingClientRect();
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

                    const oceanGrad = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.1, cx, cy, r);
                    oceanGrad.addColorStop(0, "#1d2230");
                    oceanGrad.addColorStop(0.65, "#0d1018");
                    oceanGrad.addColorStop(1, "#05060a");

                    ctx.beginPath();
                    path({ type: "Sphere" });
                    ctx.fillStyle = oceanGrad;
                    ctx.fill();
                    ctx.strokeStyle = "rgba(229, 9, 20, 0.38)";
                    ctx.lineWidth = 1.5;
                    ctx.stroke();

                    ctx.beginPath();
                    path(graticule);
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.045)";
                    ctx.lineWidth = 0.7;
                    ctx.stroke();

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

                    const centerGeo = [-state.globe.rotation[0], -state.globe.rotation[1]];

                    // Subtle blue dots for exact GeoJSON HLS camera coordinates
                    ctx.fillStyle = "rgba(96, 165, 250, 0.55)";
                    for (const coords of state.globe.hlsPinCoords) {
                        if (window.d3.geoDistance(centerGeo, coords) > Math.PI / 2 - 0.05) continue;
                        const pt = proj(coords);
                        if (!pt) continue;
                        ctx.fillRect(pt[0] - 1, pt[1] - 1, 2.2, 2.2);
                    }

                    // Country webcam nodes
                    for (const node of state.globe.countryNodes) {
                        if (window.d3.geoDistance(centerGeo, node.coords) > Math.PI / 2 - 0.05) continue;
                        const pt = proj(node.coords);
                        if (!pt) continue;

                        const isSelected = node.code === state.globe.selectedCode;
                        const isHovered = state.globe.hoveredNode?.code === node.code;
                        const baseSize = node.channelCount > 60 ? 4.4 : node.channelCount > 10 ? 3.4 : 2.5;
                        const radius = isSelected ? 6 : isHovered ? 5.2 : baseSize;

                        if (isSelected || isHovered) {
                            const ringR = radius + 4 + Math.sin(pulseTick * 2) * 2.5;
                            ctx.beginPath();
                            ctx.arc(pt[0], pt[1], ringR, 0, Math.PI * 2);
                            ctx.strokeStyle = "rgba(229, 9, 20, 0.7)";
                            ctx.lineWidth = 1.6;
                            ctx.stroke();
                        }

                        ctx.beginPath();
                        ctx.arc(pt[0], pt[1], radius, 0, Math.PI * 2);
                        ctx.fillStyle = isSelected ? "#ffffff" : (node.channelCount > 0 ? "#e50914" : "#888");
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
            const localTime = getLocalClockInfo(item.timeZone).timeStr;
            const chText = item.channelCount ? `${item.channelCount} cams` : "Live feeds";
            btn.innerHTML = `
                <span class="nf-country-flag">${countryFlagHtml(item.code)}</span>
                <div class="nf-country-card-info">
                    <div class="nf-country-card-name">${escapeHtml(item.country)}</div>
                    <div class="nf-country-card-sub">${escapeHtml(item.capital || item.code)} &bull; ${chText}${localTime ? ` &bull; ${localTime}` : ""}</div>
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
        const prevView = state.activeView;
        state.activeView = viewName;

        Object.entries(dom.views).forEach(([key, el]) => {
            el.classList.toggle("hidden", key !== viewName);
        });
        dom.navLinks.forEach(btn => btn.classList.toggle("active", btn.dataset.view === viewName));
        dom.mobileTabs.forEach(btn => btn.classList.toggle("active", btn.dataset.view === viewName));

        if (prevView === "wall" && viewName !== "wall") {
            teardownWallMedia();
        }

        if (viewName === "globe") {
            initGlobeIfNeeded();
        } else if (viewName === "wall") {
            renderWallGrid();
        } else if (viewName === "countries") {
            renderCountriesDirectory(dom.directoryCountryFilter.value);
        } else if (viewName === "mylist") {
            refreshPersonalUI();
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // --- ADD CUSTOM WEBCAM MODAL ---
    function openAddCamModal() {
        dom.addCamModal.classList.remove("hidden");
        dom.customCamName.focus();
    }

    function closeAddCamModal() {
        dom.addCamModal.classList.add("hidden");
    }

    function handleAddCustomCam(e) {
        e.preventDefault();
        const name = dom.customCamName.value.trim();
        const url = dom.customCamUrl.value.trim();
        const cc = (dom.customCamCountry.value.trim() || "US").toUpperCase();
        const category = dom.customCamCategory.value || "city";
        if (!name || !url) return;

        const ytId = extractYouTubeId(url);
        const isYouTube = /youtube\.com|youtu\.be/i.test(url) || (/^[a-zA-Z0-9_-]{11}$/.test(url) && ytId);

        const cam = {
            id: `custom-${Date.now()}`,
            name,
            country: state.countriesMeta[cc]?.country || cc,
            countryCode: cc,
            capital: state.countriesMeta[cc]?.capital || "",
            timeZone: state.countriesMeta[cc]?.timeZone || "",
            categories: [category],
            languages: [],
            sources: isYouTube
                ? [{ type: "youtube", url: `https://www.youtube.com/watch?v=${ytId}`, videoId: ytId, label: "YouTube Live" }]
                : [{ type: "hls", format: url.toLowerCase().includes(".m3u8") ? "hls" : "video", url, label: "Custom HLS" }],
            thumbnail: isYouTube ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : "",
            lat: null,
            lon: null,
            origin: "custom",
            attribution: "Custom User Stream",
            isFeatured: true
        };

        registerCam(cam);
        state.customCams.unshift(cam);
        saveCustomCams();
        rebuildAllCams();
        refreshPersonalUI();
        buildBrowseRows();

        dom.addCamForm.reset();
        closeAddCamModal();
        showToast(`Added "${name}" — starting stream!`);
        playWebcam(cam, [cam, ...state.allCams.slice(0, 20)]);
    }

    // --- EVENT WIRING ---
    function bindEvents() {
        wireVidstackEvents();

        window.addEventListener("scroll", () => {
            dom.navbar.classList.toggle("scrolled", window.scrollY > 36);
        }, { passive: true });

        // Floating Mini Dock observer when stage scrolls out of view
        const stageObserver = new IntersectionObserver(entries => {
            const entry = entries[0];
            const showDock = state.stageVisible && !entry.isIntersecting;
            dom.miniDock.classList.toggle("hidden", !showDock);
            document.body.classList.toggle("has-dock", showDock);
        }, { threshold: 0.08 });
        stageObserver.observe(dom.cinemaStage);

        // Navigation
        dom.navLinks.forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.view)));
        dom.mobileTabs.forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.view)));
        if (dom.brandHomeBtn) dom.brandHomeBtn.addEventListener("click", e => {
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

        // Search
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
                searchDebounceTimer = setTimeout(runSearchOrFilter, 320);
            });
            dom.searchInput.addEventListener("blur", () => {
                if (dom.searchBox && !dom.searchInput.value.trim()) dom.searchBox.classList.remove("open");
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
            state.selectedCategory = "all";
            state.selectedCountry = "";
            state.selectedStreamType = "all";
            dom.countrySelect.value = "";
            dom.streamTypeFilter.value = "all";
            if (dom.searchClearBtn) dom.searchClearBtn.classList.add("hidden");
            dom.categoryChipBar.querySelectorAll(".nf-chip").forEach(c => c.classList.toggle("active", c.dataset.category === "all"));
            runSearchOrFilter();
        });

        // Category & Filter Controls
        dom.categoryChipBar.addEventListener("click", e => {
            const chip = e.target.closest(".nf-chip");
            if (!chip) return;
            state.selectedCategory = chip.dataset.category;
            dom.categoryChipBar.querySelectorAll(".nf-chip").forEach(c => c.classList.toggle("active", c === chip));
            runSearchOrFilter();
        });

        dom.streamTypeFilter.addEventListener("change", () => {
            state.selectedStreamType = dom.streamTypeFilter.value;
            buildBrowseRows();
            runSearchOrFilter();
        });

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

        // Hero Controls
        dom.heroPlayBtn.addEventListener("click", () => {
            const hero = state.heroPool[state.heroIndex] || SEED_WEBCAMS[0];
            if (hero) playWebcam(hero, state.heroPool);
        });
        dom.heroFavBtn.addEventListener("click", () => {
            const hero = state.heroPool[state.heroIndex];
            if (hero) toggleFavorite(hero);
        });
        dom.heroWallBtn.addEventListener("click", () => {
            const hero = state.heroPool[state.heroIndex];
            if (hero) pinCamToWall(hero);
        });
        dom.heroShuffleBtn.addEventListener("click", () => {
            if (!state.heroPool.length) return;
            state.heroIndex = (state.heroIndex + 1) % state.heroPool.length;
            renderHero();
        });

        // Cinema Stage Controls
        if (dom.randomCamBtn) dom.randomCamBtn.addEventListener("click", playRandomWebcam);
        window.playRandomWebcam = playRandomWebcam;
        window.switchWebcamsView = switchView;
        dom.closeStageBtn.addEventListener("click", closeCinemaStage);
        dom.dockCloseBtn.addEventListener("click", closeCinemaStage);
        dom.prevCamBtn.addEventListener("click", () => stepCam(-1));
        dom.nextCamBtn.addEventListener("click", () => stepCam(1));
        dom.dockPrevBtn.addEventListener("click", () => stepCam(-1));
        dom.dockNextBtn.addEventListener("click", () => stepCam(1));

        dom.dockScrollToStage.addEventListener("click", () => {
            if (state.activeView === "wall") switchView("browse");
            dom.cinemaStage.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        dom.dockFocusBtn.addEventListener("click", () => {
            if (state.activeView === "wall") switchView("browse");
            dom.cinemaStage.scrollIntoView({ behavior: "smooth", block: "start" });
        });

        dom.stageFavBtn.addEventListener("click", () => toggleFavorite(state.currentCam));
        dom.sendToWallBtn.addEventListener("click", () => pinCamToWall(state.currentCam));
        dom.snapshotBtn.addEventListener("click", captureLiveSnapshot);
        dom.autoTourBtn.addEventListener("click", toggleAutoTour);

        dom.toggleHudBtn.addEventListener("click", () => {
            state.hudVisible = !state.hudVisible;
            dom.playerHudOverlay.classList.toggle("hidden", !state.hudVisible);
            dom.toggleHudBtn.classList.toggle("active", state.hudVisible);
        });
        dom.toggleHudBtn.classList.add("active");

        dom.vfxBtn.addEventListener("click", () => {
            state.retroMode = !state.retroMode;
            dom.playerWrapper.classList.toggle("retro-mode", state.retroMode);
            dom.vfxBtn.classList.toggle("active", state.retroMode);
        });

        dom.theaterBtn.addEventListener("click", () => {
            state.theaterMode = !state.theaterMode;
            dom.stageGrid.classList.toggle("theater-mode", state.theaterMode);
            dom.theaterBtn.classList.toggle("active", state.theaterMode);
        });

        dom.fullscreenBtn.addEventListener("click", () => {
            if (!document.fullscreenElement) {
                dom.playerWrapper.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen().catch(() => {});
            }
        });

        dom.copyUrlBtn.addEventListener("click", async () => {
            if (!state.currentCam) return;
            const sources = getPlayableSources(state.currentCam);
            const url = sources[state.currentSourceIndex]?.url || "";
            if (!url) return;
            try {
                await navigator.clipboard.writeText(url);
                showToast("Stream URL copied to clipboard");
            } catch {
                showToast(url);
            }
        });

        dom.overlayRetryBtn.addEventListener("click", () => {
            if (!state.currentCam) return;
            const sources = getPlayableSources(state.currentCam);
            attemptSourceIndex(state.currentCam, sources, state.currentSourceIndex, ++state.playToken);
        });
        dom.overlayNextBtn.addEventListener("click", () => stepCam(1));

        dom.tempUnitToggle.addEventListener("click", () => {
            state.tempUnit = state.tempUnit === "C" ? "F" : "C";
            dom.tempUnitToggle.textContent = `°${state.tempUnit}`;
            savePrefs();
            if (state.currentCam) fetchWeatherForCam(state.currentCam);
        });

        // Globe Controls
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
            selectGlobeCountry(state.userLocation.code || "US", true);
        });
        dom.globeCountrySearch.addEventListener("input", () => {
            renderGlobeQuickPills(dom.globeCountrySearch.value);
        });

        // Multi-Cam Wall Presets
        dom.wallPresetScenic.addEventListener("click", () => applyWallPreset("scenic"));
        dom.wallPresetHls.addEventListener("click", () => applyWallPreset("hls"));
        dom.wallPresetBeach.addEventListener("click", () => applyWallPreset("beach"));
        dom.wallClearBtn.addEventListener("click", () => {
            state.wallSlots = [null, null, null, null];
            saveWallSlots();
            renderWallGrid();
        });

        // Directory & History
        dom.directoryCountryFilter.addEventListener("input", () => {
            renderCountriesDirectory(dom.directoryCountryFilter.value);
        });
        dom.clearHistoryBtn.addEventListener("click", () => {
            state.history = [];
            localStorage.removeItem(STORAGE_KEYS.HISTORY);
            refreshPersonalUI();
            showToast("Watch history cleared");
        });

        // Modals
        dom.openAddCamBtn.addEventListener("click", openAddCamModal);
        dom.myListAddCamBtn.addEventListener("click", openAddCamModal);
        dom.closeAddCamBtn.addEventListener("click", closeAddCamModal);
        dom.cancelAddCamBtn.addEventListener("click", closeAddCamModal);
        dom.addCamModal.addEventListener("click", e => {
            if (e.target === dom.addCamModal) closeAddCamModal();
        });
        dom.addCamForm.addEventListener("submit", handleAddCustomCam);

        dom.closePickWallBtn.addEventListener("click", () => dom.pickWallCamModal.classList.add("hidden"));
        dom.pickWallCamModal.addEventListener("click", e => {
            if (e.target === dom.pickWallCamModal) dom.pickWallCamModal.classList.add("hidden");
        });
        dom.wallPickerSearch.addEventListener("input", () => renderWallPickerList(dom.wallPickerSearch.value));

        // Keyboard Shortcuts
        document.addEventListener("keydown", e => {
            const tag = document.activeElement?.tagName;
            const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

            if (e.key === "Escape") {
                if (!dom.addCamModal.classList.contains("hidden")) {
                    closeAddCamModal();
                } else if (!dom.pickWallCamModal.classList.contains("hidden")) {
                    dom.pickWallCamModal.classList.add("hidden");
                } else if (isTyping) {
                    document.activeElement.blur();
                } else if (state.stageVisible) {
                    closeCinemaStage();
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
            } else if (e.key === " " && state.stageVisible && state.activeEngine === "hls") {
                e.preventDefault();
                try {
                    if (dom.vidstackPlayer.paused) dom.vidstackPlayer.play();
                    else dom.vidstackPlayer.pause();
                } catch { /* ignore */ }
            } else if (e.key === "ArrowRight" && state.stageVisible) {
                stepCam(1);
            } else if (e.key === "ArrowLeft" && state.stageVisible) {
                stepCam(-1);
            } else if (e.key.toLowerCase() === "f" && state.currentCam) {
                toggleFavorite(state.currentCam);
            } else if (e.key.toLowerCase() === "t" && state.stageVisible) {
                dom.theaterBtn.click();
            } else if (e.key.toLowerCase() === "g") {
                switchView(state.activeView === "globe" ? "browse" : "globe");
            } else if (e.key.toLowerCase() === "w") {
                switchView(state.activeView === "wall" ? "browse" : "wall");
            }
        });
    }

    // --- BOOTSTRAP ---
    async function boot() {
        document.getElementById("footerYear").textContent = String(new Date().getFullYear());
        SEED_WEBCAMS.forEach(registerCam);
        loadPersistedState();
        rebuildAllCams();
        bindEvents();

        // Fetch country metadata, user IP region, and full Famelack directory concurrently
        await Promise.allSettled([loadCountriesMetadata(), detectUserLocation()]);
        await loadAllFamelackCams();

        pickHeroPool();
        await buildBrowseRows();
        refreshPersonalUI();

        // Fetch public live HLS (.m3u8) environment streams in background so Vidstack has hundreds of feeds
        loadLiveEnvironmentHlsStreams().then(hlsList => {
            if (hlsList.length) {
                refreshHlsRowWhenReady();
            }
        });

        // Refresh clocks every 30s
        setInterval(() => {
            updateNavClock();
            if (state.currentCam) {
                const tz = state.currentCam.timeZone || state.countriesMeta[state.currentCam.countryCode]?.timeZone;
                const { timeStr, isDay } = getLocalClockInfo(tz);
                if (timeStr) {
                    dom.hudDayNight.textContent = isDay ? "☀️" : "🌙";
                    dom.hudLocalTime.textContent = `${timeStr} Local`;
                    dom.railLocalClock.textContent = `${timeStr}${tz ? ` (${tz.split("/").pop().replace(/_/g, " ")})` : ""}`;
                }
            }
        }, 30000);
    }

    document.addEventListener("DOMContentLoaded", boot);
})();
