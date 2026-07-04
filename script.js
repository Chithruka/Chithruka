// --- TMDB CONFIGURATION ---
const TMDB_ENCODED = "OTI4NTBhNzllNTA5MTdiOGNjMTk2MjM0NTVhZTIyNDA=";
const TMDB_API_KEY = getTmdbKey();
const BASE_TMDB_URL = 'https://api.themoviedb.org/3';
const TMDB_IMG_BASE_URL = 'https://image.tmdb.org/t/p/w92';
const TMDB_POSTER_MD = 'https://image.tmdb.org/t/p/w342';
const TMDB_POSTER_LG = 'https://image.tmdb.org/t/p/w300';
const TMDB_POSTER_XL = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_WEB = 'https://image.tmdb.org/t/p/w780';
const TMDB_STILL_SZ = 'https://image.tmdb.org/t/p/w185';

// --- GEMINI AI CONFIGURATION ---
const ENCODED_KEY = "QUl6YVN5QTVGRmxtOVo5VFM5Vk9pYXNBVkxRVDdrNEdzeWNNMG8w"; 
function getGeminiKey() {
    return atob(ENCODED_KEY);
}
function getTmdbKey() {
    return atob(TMDB_ENCODED);
}
const GEMINI_API_KEY = getGeminiKey();
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// --- State Variables ---
// --- Updated Global Variables ---
let LOCAL_VIDEOS = { movies: {}, tv: {} }; 
async function loadLocalVideos() {
    try {
        const response = await fetch('Server/videos.json'); // Folder name included
        if (!response.ok) throw new Error("File not found");
        LOCAL_VIDEOS = await response.json();
    } catch (error) {
        console.error("Local videos failed to load:", error);
    }
}
let currentServerIndex = 0;

// The base servers (excluding your local server)
const BASE_SERVER_URLS = [
{ name: "Server 1", movie: "https://www.rivestream.ru/embed?type=movie&id=[ID]", tv: "https://www.rivestream.ru/embed?type=tv&id=[ID]&season=[S]&episode=[E]" },
    { name: "Server 2", movie: "https://player.videasy.net/movie/[ID]", tv: "https://player.videasy.net/tv/[ID]/[S]/[E]?nextEpisode=true&episodeSelector=true" },
    { name: "Server 3", movie: "https://vidlink.pro/movie/[ID]?primaryColor=E50914&secondaryColor=221F1F&iconColor=eefdec&icons=default&player=default&title=true&poster=true&autoplay=false&sub_label=English&fallback_url=https://streamimdb.ru/embed/movie/[ID]", tv: "https://vidlink.pro/tv/[ID]/[S]/[E]?primaryColor=E50914&secondaryColor=221F1F&iconColor=eefdec&icons=default&player=default&title=true&poster=true&autoplay=false&nextbutton=true&fallback_url=https://streamimdb.ru/embed/tv/[ID]" },
   { name: "Server 4", movie: "https://www.vidsrc.wtf/4/movie/[ID]?color=e01621", tv: "https://www.vidsrc.wtf/4/tv/[ID]/[S]/[E]?color=e01621" },
   { name: "Server 5", movie: "https://1embed.cc/embed/movie/[ID]", tv: "https://1embed.cc/embed/tv/[ID]/[S]/[E]" }
];

let mediaType = 'movie';
let TMDB_ID = null;
let activeMediaType = null;
let currentFetchUrl = "";
let currentTitle = "";
let currentSeason = 1;
let currentEpisode = 1;
let currentMovieData = null;
let currentSearchQuery = "";
let episodeData = [];
let seasonEpisodes = [];
let accordionOpen = false;
let searchTimeout;
let trendingPage = 1;
let isTrendingLoading = false;
let loadedIds = new Set();
let loadedGenreType = null;
let heroInterval;
let deferredPrompt;
let activeFilterLabel = "";
// --- SLIDER FILTER STATE ---
let currentTrendingFilter = 'all';
let top10Page = 1;
let top10Pool = [];
let top10Filter = 'all';
let isTop10Loading = false;
let aiModalOpen = false;
let userCountryCode = 'US';
let DUBBED_REGISTRY = {};

// --- Auth State ---
let sessionId = localStorage.getItem('tmdb_session_id');
let accountId = localStorage.getItem('tmdb_account_id');

// In-memory cache (instant, no serialization cost)
const memCache = new Map();

async function fetchCached(url) {
    // 1. Create a clean cache key (remove keys to avoid duplicates in key name)
    const cacheKey = "tmdb_" + url.replace(TMDB_API_KEY, "").replace(GEMINI_API_KEY, "");
    
    // 2. Cache Duration: 1 Hour (in milliseconds)
    const CACHE_DURATION = 1000 * 60 * 60; 

    // --- FIX #7: Check in-memory first (instant, no serialization) ---
    if (memCache.has(cacheKey)) return memCache.get(cacheKey);

    // 3. Try Local Storage
    try {
        const cachedRecord = localStorage.getItem(cacheKey);
        if (cachedRecord) {
            const { timestamp, data } = JSON.parse(cachedRecord);
            // Check if expired
            if (Date.now() - timestamp < CACHE_DURATION) {
                memCache.set(cacheKey, data); // Warm up memory cache
                return data;
            }
        }
    } catch (e) {
        console.warn("Cache read error", e);
    }

    // 4. Fetch Network
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();

        // 5. Store in memory immediately
        memCache.set(cacheKey, data);

        // 6. Save to Local Storage
        try {
            // Only cache if valid data
            if (data) {
                localStorage.setItem(cacheKey, JSON.stringify({
                    timestamp: Date.now(),
                    data: data
                }));
            }
        } catch (e) {
            // Storage likely full
            console.warn("Storage full, clearing old TMDB cache...");
            // Clear only keys starting with "tmdb_"
            Object.keys(localStorage).forEach(key => {
                if(key.startsWith("tmdb_")) localStorage.removeItem(key);
            });
        }

        return data;
    } catch (e) {
        throw e;
    }
}

async function loadDubbedRegistry() {
    try {
        const response = await fetch('registry.json?v=' + Date.now());
        if (!response.ok) {
            throw new Error(`Failed to load registry: ${response.statusText}`);
        }
        DUBBED_REGISTRY = await response.json();
        console.log("Dubbed Registry loaded successfully from JSON.");
    } catch (error) {
        console.error("Error loading dubbed registry:", error);
        // Fallback to empty object so the app doesn't crash
        DUBBED_REGISTRY = {};
    }
}

// --- FIX #5: Lazy-load flags so we only fetch when actually needed ---
let dubbedRegistryLoaded = false;
let localVideosLoaded = false;

async function ensureDubbedRegistry() {
    if (dubbedRegistryLoaded) return;
    await loadDubbedRegistry();
    dubbedRegistryLoaded = true;
}

async function ensureLocalVideos() {
    if (localVideosLoaded) return;
    await loadLocalVideos();
    localVideosLoaded = true;
}
function formatRuntime(minutes) {
    if (!minutes) return "";
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
}

function formatDate(dateString) {
    if (!dateString) return "TBA";
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// --- FIX #6: Cache dominant color results by image URL ---
const colorCache = new Map();

function getDominantColor(imageUrl) {
    if (colorCache.has(imageUrl)) return Promise.resolve(colorCache.get(imageUrl));
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 1, 1);
            let [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;

            // Force Darken the Color
            r = Math.floor(r * 0.3);
            g = Math.floor(g * 0.3);
            b = Math.floor(b * 0.3);

            const result = `${r}, ${g}, ${b}`;
            colorCache.set(imageUrl, result);
            resolve(result);
        };
        img.onerror = () => resolve('20, 20, 20');
    });
}

function updateSeasonStatusUI(airDate) {
    const badge = document.getElementById('season-status-badge');
    if (!airDate) {
        badge.classList.add('hidden');
        return;
    }

    const today = new Date();
    const release = new Date(airDate);
    today.setHours(0, 0, 0, 0);
    release.setHours(0, 0, 0, 0);

    badge.classList.remove('hidden', 'text-green-400', 'text-yellow-400', 'text-gray-400');

    if (release > today) {
        badge.innerHTML = '<i class="far fa-calendar-alt mr-1"></i> Upcoming';
        badge.classList.add('text-yellow-400');
    } else {
        badge.innerHTML = '<i class="fas fa-check-circle mr-1"></i> Released';
        badge.classList.add('text-green-400');
    }
}

function renderSkeletons(container, count = 10) {
    container.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
        const div = document.createElement('div');
        div.className = 'scroll-card';
        div.innerHTML = `
                <div class="poster-wrapper skeleton skeleton-poster"></div>
                <div class="card-body">
                    <div class="skeleton skeleton-text" style="width: 80%"></div>
                    <div class="skeleton skeleton-text" style="width: 40%"></div>
                </div>
            `;
        fragment.appendChild(div);
    }
    container.appendChild(fragment);
}

// --- NEW: Gender Icon Helper ---
function getPersonFace(path, gender, cssClass, iconSize = 'text-2xl') {
    if (path) {
        return `<img src="${TMDB_IMG_BASE_URL}${path}" class="${cssClass} object-cover" loading="lazy" alt="Person">`;
    }
    
    // Default Icon (User / Unknown)
    let icon = '<i class="fas fa-user"></i>'; 
    let color = 'text-gray-500';

    if (gender === 1) { // Female
        icon = '<i class="fa-solid fa-venus"></i>';
        color = 'text-pink-500';
    } else if (gender === 2) { // Male
        icon = '<i class="fa-solid fa-mars"></i>';
        color = 'text-blue-500';
    } else if (gender === 3) { // Non-binary
        icon = '<i class="fa-solid fa-non-binary"></i>';
        color = 'text-purple-400';
    }

    // Return a div that mimics the image container but centers the icon
    return `<div class="${cssClass} flex items-center justify-center bg-gray-800 border border-gray-700 ${color} ${iconSize}">
                ${icon}
            </div>`;
}

// --- NEW: AI FUNCTIONS ---

function toggleAIModal() {
    const modal = document.getElementById('ai-modal');
    const input = document.getElementById('ai-search-input');
    const loader = document.getElementById('ai-loader');
    const inputCont = document.getElementById('ai-input-container');
    
    aiModalOpen = !aiModalOpen;
    window.toggleMobileNav(aiModalOpen);
    
    if (aiModalOpen) {
        modal.classList.remove('hidden');
        input.value = '';
        input.focus();
        loader.classList.add('hidden');
        inputCont.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

async function handleAISearch() {
    const input = document.getElementById('ai-search-input');
    const query = input.value.trim();
    if (!query) return;

    const loader = document.getElementById('ai-loader');
    const inputCont = document.getElementById('ai-input-container');

    // Show Loader, Hide Input
    inputCont.classList.add('hidden');
    loader.classList.remove('hidden');

    // --- UPDATED PROMPT: Asks for Type ---
    const systemInstruction = `You are an expert Media Recommendation Engine. 
    Strict Rules:
    1. Return ONLY a valid JSON object. Do not add intro text or markdown formatting.
    2. Structure: { 
         "message": "Short comment", 
         "results": [
            { "name": "Title or Name", "type": "movie" }, 
            { "name": "Name", "type": "person" },
            { "name": "Company/Network", "type": "company" }
         ] 
       }
    3. Allowed types: 'movie' (for movies/tv), 'person' (actors/directors), 'company' (networks/studios).
    4. If the user asks for a specific person (e.g. "Tom Cruise", "Director of Tenet"), return type: "person".
    5. If the user asks for a network/studio (e.g. "HBO", "A24", "Marvel"), return type: "company".
    6. Do not mention that you are an AI.`;

    const fullPrompt = `${systemInstruction}\n\nUser Query: ${query}`;

    try {
        const response = await fetch(GEMINI_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: fullPrompt }]
                }]
            })
        });

        const data = await response.json();

        if (!response.ok || data.error) {
            console.error("Gemini API Error:", data);
            throw new Error(data.error?.message || "API request failed");
        }

        const rawText = data.candidates[0].content.parts[0].text;
        
        // Clean JSON
        let cleanContent = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        let aiData = {};
        try {
            const firstBracket = cleanContent.indexOf('{');
            const lastBracket = cleanContent.lastIndexOf('}');
            if (firstBracket !== -1 && lastBracket !== -1) {
                aiData = JSON.parse(cleanContent.substring(firstBracket, lastBracket + 1));
            } else {
                aiData = JSON.parse(cleanContent);
            }
        } catch (e) {
            console.error("JSON Parse Error", e);
            aiData = { 
                message: "Here are some results based on your search.", 
                results: [{ name: query, type: "movie" }] // Fallback
            };
        }

        toggleAIModal();
        displayAIResults(aiData.results || [], aiData.message);

    } catch (error) {
        console.error("AI Logic Failed:", error);
        showMessage(`AI Error: ${error.message}`, true);
        loader.classList.add('hidden');
        inputCont.classList.remove('hidden');
    }
}

async function displayAIResults(resultsList, aiMessage) {
    // 1. Reset UI
    searchInput.value = `AI Search`;
    searchResults.innerHTML = '';
    heroSection.style.display = 'none';
    document.getElementById('top10-section').style.display = 'none';
    detailsSection.classList.add('hidden');
    playerInterface.classList.add('hidden');
    collectionSection.classList.add('hidden');
    document.getElementById('continue-watching-section').classList.add('hidden');
    
    // 2. Set Header
    const header = document.getElementById('trending-header');
    header.innerHTML = `
        <div class="flex flex-col animate-fade-in">
            <div class="flex items-center text-xl md:text-2xl font-bold text-white mb-2">
            AI Recommendations
            </div>
            <span class="text-sm md:text-base font-normal text-gray-300 italic border-l-4 border-red-600 pl-4">
                "${aiMessage}"
            </span>
        </div>
    `;

    // 3. Prepare Container
    trendingContainer.innerHTML = '';
    renderSkeletons(trendingContainer, 10);
    loadedIds.clear();
    trendingPage = 1;
    currentFetchUrl = "STOP"; 

    // 4. Smart Fetch Loop
    const searchPromises = resultsList.map(async (item) => {
        const cleanName = item.name;
        
        try {
            let url = "";
            
            // ROUTE TO CORRECT ENDPOINT BASED ON TYPE
            if (item.type === 'company') {
                url = `${BASE_TMDB_URL}/search/company?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanName)}`;
            } else {
                // 'movie', 'tv', 'person' are all handled by multi search
                url = `${BASE_TMDB_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanName)}&include_adult=true`;
            }

            const data = await fetchCached(url);
            if (!data.results || data.results.length === 0) return null;

            // Find best match
            const bestMatch = data.results[0];

            if (bestMatch) {
                // Ensure media_type is set correctly for the renderer
                if (item.type === 'company') bestMatch.media_type = 'company';
                return bestMatch;
            }
            return null;

        } catch (e) {
            console.error(`Search failed for ${cleanName}`, e);
            return null;
        }
    });

    try {
        const resultsArray = await Promise.all(searchPromises);
        const validResults = resultsArray.filter(i => i !== null);
        
        // Remove duplicates
        const uniqueResults = Array.from(new Map(validResults.map(item => [item.id, item])).values());

        trendingContainer.innerHTML = '';
        
        if (uniqueResults.length > 0) {
            renderCards(uniqueResults, trendingContainer, true);
        } else {
            trendingContainer.innerHTML = '<div class="text-gray-400 p-4">No matches found.</div>';
        }

        updateScrollButtons(trendingContainer);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                header.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });

    } catch (e) {
        console.error("AI Result Display Error", e);
        trendingContainer.innerHTML = '<div class="text-red-500 p-4">Error loading AI results.</div>';
    }
}

// --- AUTHENTICATION FUNCTIONS ---
async function authenticateTMDB() {
    const btn = document.getElementById('tmdb-login-btn');
    if (btn) btn.style.pointerEvents = 'none'; // Prevent double-clicks
    
    try {
        const res = await fetch(`${BASE_TMDB_URL}/authentication/token/new?api_key=${TMDB_API_KEY}`, { cache: "no-store" });
        const data = await res.json();
        if (data.success) {
            const redirectUrl = window.location.origin + window.location.pathname;
            window.location.href = `https://www.themoviedb.org/authenticate/${data.request_token}?redirect_to=${encodeURIComponent(redirectUrl)}`;
        }
    } catch (e) {
        showMessage("Auth failed", true);
        if (btn) btn.style.pointerEvents = 'auto'; // Re-enable on failure
    }
}

async function createSession(requestToken) {
    if (sessionId) return;

    try {
        const res = await fetch(`${BASE_TMDB_URL}/authentication/session/new?api_key=${TMDB_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ request_token: requestToken })
        });
        const data = await res.json();
        if (data.success) {
            sessionId = data.session_id;
            localStorage.setItem('tmdb_session_id', sessionId);
            await fetchAccountDetails();
            showMessage("Login Successful!");
            
            setTimeout(() => {
                 window.location.href = window.location.pathname; 
            }, 1000);
        } else {
            window.history.replaceState({}, document.title, window.location.pathname);
            showMessage("Login session expired. Please try again.", true);
        }
    } catch (e) {
        showMessage("Session creation failed", true);
    }
}

async function fetchAccountDetails() {
    if (!sessionId) return;
    try {
        const data = await fetchCached(`${BASE_TMDB_URL}/account?api_key=${TMDB_API_KEY}&session_id=${sessionId}`);
        accountId = data.id;
        localStorage.setItem('tmdb_account_id', accountId);
        updateAuthUI(data);
    } catch (e) {
        console.error("Account fetch error", e);
    }
}

function updateAuthUI(user) {
    const loginBtn = document.getElementById('tmdb-login-btn');
    const avatar = document.getElementById('user-avatar');
    const interactBar = document.getElementById('interaction-bar');

    if (user) {
        loginBtn.classList.add('hidden');
        avatar.classList.remove('hidden');
        if(interactBar) interactBar.classList.remove('hidden');

        if (user.avatar && user.avatar.tmdb && user.avatar.tmdb.avatar_path) {
            avatar.src = `${TMDB_IMG_BASE_URL}${user.avatar.tmdb.avatar_path}`;
        } else {
            avatar.src = `https://ui-avatars.com/api/?name=${user.username || 'User'}&background=random`;
        }
    } else {
        loginBtn.classList.remove('hidden');
        avatar.classList.add('hidden');
        if(interactBar) interactBar.classList.add('hidden');
    }
}

function toggleUserMenu() {
    document.getElementById('user-menu').classList.toggle('show');
}

function logoutTMDB() {
    localStorage.removeItem('tmdb_session_id');
    localStorage.removeItem('tmdb_account_id');
    sessionId = null;
    accountId = null;
    location.reload();
}

// --- USER ACTIONS ---
async function checkAccountStates(id, type) {
    if (!sessionId) return;
    try {
        const res = await fetch(`${BASE_TMDB_URL}/${type}/${id}/account_states?api_key=${TMDB_API_KEY}&session_id=${sessionId}`);
        const data = await res.json();

        const favBtn = document.getElementById('btn-favorite');
        const watchBtn = document.getElementById('btn-watchlist');
        const rateVal = document.getElementById('rating-val');
        const rateInput = document.getElementById('rating-input');

        if (favBtn) {
            const favIcon = favBtn.querySelector('i');
            if (data.favorite) {
                favBtn.classList.add('active');
                favIcon.className = 'fa-solid fa-heart';
            } else {
                favBtn.classList.remove('active');
                favIcon.className = 'fa-regular fa-heart';
            }
        }

        if (watchBtn) {
            const watchIcon = watchBtn.querySelector('i');
            if (data.watchlist) {
                watchBtn.classList.add('active');
                watchIcon.className = 'fa-solid fa-bookmark';
            } else {
                watchBtn.classList.remove('active');
                watchIcon.className = 'fa-regular fa-bookmark';
            }
        }

        if (data.rated) {
            rateInput.value = data.rated.value;
            rateVal.innerText = data.rated.value;
        } else {
            rateInput.value = 5;
            rateVal.innerText = 5;
        }
    } catch (e) {
        console.error("State check error", e);
    }
}

async function toggleFavorite() {
    if (!sessionId) return showMessage("Please login first", true);
    const btn = document.getElementById('btn-favorite');
    const icon = btn.querySelector('i');
    const isFav = btn.classList.contains('active');

    btn.classList.toggle('active');
    icon.className = isFav ? 'fa-regular fa-heart' : 'fa-solid fa-heart';

    try {
        await fetch(`${BASE_TMDB_URL}/account/${accountId}/favorite?api_key=${TMDB_API_KEY}&session_id=${sessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ media_type: mediaType, media_id: TMDB_ID, favorite: !isFav })
        });
        showMessage(isFav ? "Removed from Favorites" : "Added to Favorites");
    } catch (e) {
        btn.classList.toggle('active');
        icon.className = isFav ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
        showMessage("Action failed", true);
    }
}

async function toggleWatchlist() {
    if (!sessionId) return showMessage("Please login first", true);
    const btn = document.getElementById('btn-watchlist');
    const icon = btn.querySelector('i');
    const isWatch = btn.classList.contains('active');

    btn.classList.toggle('active');
    icon.className = isWatch ? 'fa-regular fa-bookmark' : 'fa-solid fa-bookmark';

    try {
        await fetch(`${BASE_TMDB_URL}/account/${accountId}/watchlist?api_key=${TMDB_API_KEY}&session_id=${sessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ media_type: mediaType, media_id: TMDB_ID, watchlist: !isWatch })
        });
        showMessage(isWatch ? "Removed from Watchlist" : "Added to Watchlist");
    } catch (e) {
        btn.classList.toggle('active');
        icon.className = isWatch ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';
        showMessage("Action failed", true);
    }
}

function toggleRatingSlider() {
    if (!sessionId) return showMessage("Please login first", true);
    document.getElementById('rating-slider').classList.toggle('show');
}

async function submitRating() {
    const val = document.getElementById('rating-input').value;
    try {
        await fetch(`${BASE_TMDB_URL}/${mediaType}/${TMDB_ID}/rating?api_key=${TMDB_API_KEY}&session_id=${sessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: val })
        });
        showMessage(`Rated ${val}/10`);
        document.getElementById('rating-slider').classList.remove('show');
    } catch (e) {
        showMessage("Rating failed", true);
    }
}

async function loadMyLibrary(type) {
    if (!sessionId) return;

    currentFetchUrl = "STOP";
    trendingPage = 1;

    const dropdown = document.getElementById('user-menu');
    if (dropdown) dropdown.classList.remove('show');

    heroSection.style.display = 'none';
    document.getElementById('top10-section').style.display = 'none';
    detailsSection.classList.add('hidden');
    playerInterface.classList.add('hidden');
    collectionSection.classList.add('hidden');
    document.getElementById('continue-watching-section').classList.add('hidden');

    const header = document.getElementById('trending-header');

    // --- ICONS REMOVED HERE ---
    if (type === 'favorite') header.innerHTML = 'My Favorites';
    else header.innerHTML = 'My Watchlist';

    trendingContainer.innerHTML = '';
    renderSkeletons(trendingContainer, 10);

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            header.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    try {
        const [resMovies, resTV] = await Promise.all([
            fetch(`${BASE_TMDB_URL}/account/${accountId}/${type}/movies?api_key=${TMDB_API_KEY}&session_id=${sessionId}&sort_by=created_at.desc`),
            fetch(`${BASE_TMDB_URL}/account/${accountId}/${type}/tv?api_key=${TMDB_API_KEY}&session_id=${sessionId}&sort_by=created_at.desc`)
        ]);

        const dataMovies = await resMovies.json();
        const dataTV = await resTV.json();

        const movies = (dataMovies.results || []).map(i => ({ ...i, media_type: 'movie' }));
        const tv = (dataTV.results || []).map(i => ({ ...i, media_type: 'tv' }));

        const combined = [...movies, ...tv];

        trendingContainer.innerHTML = '';

        if (combined.length === 0) {
            trendingContainer.innerHTML = '<div class="text-gray-400 p-4">Your list is empty.</div>';
        } else {
            renderCards(combined, trendingContainer, false);
        }

    } catch (e) {
        console.error(e);
        trendingContainer.innerHTML = '<div class="text-red-500 p-4">Failed to load library.</div>';
    }
}

function loadHome() {
    destroyHeroTrailer();
    currentFetchUrl = "";
    trendingPage = 1;
    currentTrendingFilter = 'all';
    top10Page = 1;
    top10Pool = [];
    top10Filter = 'all';
    searchInput.value = '';
    searchResults.innerHTML = '';
    
    // Show Home Sections
    heroSection.style.display = 'block';
    document.getElementById('top10-section').style.display = 'block';
    
    const trailerSection = document.getElementById('trailers-section');
    if (trailerSection) trailerSection.style.display = 'block';

    // Hide Detail/Player/Collection Sections
    detailsSection.classList.add('hidden');
    playerInterface.classList.add('hidden');
    collectionSection.classList.add('hidden');
    
    // Hide Soundtrack Section
    const sSection = document.getElementById('soundtrack-section');
    if (sSection) sSection.classList.add('hidden');
    
    // Logic for Continue Watching
    const history = JSON.parse(localStorage.getItem('watch_history') || '[]');
    if (history.length > 0) {
        document.getElementById('continue-watching-section').classList.remove('hidden');
    } else {
        document.getElementById('continue-watching-section').classList.add('hidden');
    }

    document.getElementById('trending-header').innerHTML = '<i class="fas fa-fire text-red-500 mr-3"></i> Trending Now';
    document.querySelectorAll('.slider-filter-btn').forEach(b => {
        b.classList.toggle('active', b.textContent.trim() === 'All');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    trendingContainer.innerHTML = '';
    loadTrending();
    loadLatestTrailers();
}
function getActiveServers() {
    // Create a shallow copy of the base URLs
    const servers = [...BASE_SERVER_URLS];
    let hasLocalServer = false;

    // Only check LOCAL_VIDEOS if it's been loaded
    if (localVideosLoaded) {
        if (mediaType === 'movie') {
            hasLocalServer = !!(LOCAL_VIDEOS.movies && LOCAL_VIDEOS.movies[TMDB_ID]);
        } else if (mediaType === 'tv') {
            hasLocalServer = !!LOCAL_VIDEOS.tv?.[TMDB_ID]?.[currentSeason]?.[currentEpisode];
        }
    }

    if (hasLocalServer) {
        // Inject your custom server at the beginning of the array
        servers.unshift({
            name: "My Server", // Placeholder; renamed in the map below
            movie: "Server/my-server.html?id=[ID]&type=movie",
            tv: "Server/my-server.html?id=[ID]&type=tv&s=[S]&e=[E]"
        });
    }

    // Standardize all names sequentially (Server 1, Server 2, etc.)
    return servers.map((server, index) => ({
        ...server, 
        name: `Server ${index + 1}` 
    }));
}


const DOWNLOAD_URLS = {
    source1: { movie: "https://vidvault.ru/movie/[ID]", tv: "https://vidvault.ru/tv/[ID]/[S]/[E]" },
    source2: { movie: "https://www.rivestream.app/download?type=movie&id=[ID]", tv: "https://www.rivestream.app/download?type=tv&id=[ID]&season=[S]&episode=[E]" },
    source3: { movie: "https://1embed.cc/download/movie/[ID]", tv: "https://1embed.cc/download/tv/[ID]/[S]/[E]" }
};

const playerInterface = document.getElementById('player-interface');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const messageBox = document.getElementById('message-box');
const tvControls = document.getElementById('tv-controls');
const episodeAccordionContent = document.getElementById('episode-accordion-content');
const currentEpisodeInfo = document.getElementById('current-episode-info');
const detailsSection = document.getElementById('details-section');
const downloadModal = document.getElementById('download-modal');
const trailerModal = document.getElementById('trailer-modal');
const trailerIframe = document.getElementById('trailer-iframe');
const trendingContainer = document.getElementById('trending-container');
const top10Container = document.getElementById('top10-container');
const recommendationsSection = document.getElementById('recommendations-section');
const recommendationsContainer = document.getElementById('recommendations-container');
const filterModal = document.getElementById('filter-modal');
const heroSection = document.getElementById('hero-section');
const pageBackground = document.getElementById('page-background');
const collectionSection = document.getElementById('collection-section');
const collectionContainer = document.getElementById('collection-container');

let messageTimeout;
function showMessage(text, isError = false) {
    const box = document.getElementById('message-box');
    const inner = document.getElementById('message-box-inner');
    const icon = document.getElementById('message-icon');
    const msg = document.getElementById('message-text');

    // Content
    msg.textContent = text;

    // Theme: error = red accent, success = green accent
    if (isError) {
        icon.innerHTML = '<i class="fas fa-xmark"></i>';
        icon.style.cssText = 'background: rgba(229,9,20,0.2); color: #e50914;';
        inner.style.borderColor = 'rgba(229,9,20,0.35)';
    } else {
        icon.innerHTML = '<i class="fas fa-check"></i>';
        icon.style.cssText = 'background: rgba(70,211,105,0.2); color: #46d369;';
        inner.style.borderColor = 'rgba(70,211,105,0.3)';
    }

    // Position: above mobile nav on mobile, near bottom-right on desktop
    const isMobile = window.innerWidth < 768;
    box.style.bottom = isMobile ? 'calc(70px + 12px)' : '20px';

    // Show with animation
    box.classList.remove('hidden');
    box.style.opacity = '0';
    box.style.transform = 'translateY(8px)';
    box.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    requestAnimationFrame(() => {
        box.style.opacity = '1';
        box.style.transform = 'translateY(0)';
    });

    // Auto-hide after 3s
    clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => {
        box.style.opacity = '0';
        box.style.transform = 'translateY(8px)';
        setTimeout(() => box.classList.add('hidden'), 250);
    }, 3000);
}

window.scrollContainer = function(id, amount) {
    document.getElementById(id).scrollBy({ left: amount, behavior: 'smooth' });
}

// ==========================================
// SLIDER MEDIA-TYPE FILTER (Movie / TV / All)
// ==========================================
window.setSliderFilter = function(containerId, type, btn) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Update active state on sibling buttons
    const wrapper = btn.closest('.slider-filter');
    if (wrapper) {
        wrapper.querySelectorAll('.slider-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    if (containerId === 'top10-container') {
        // Top 10 needs re-numbering and may need to fetch extra pages
        // to always show a full top 10 of the selected type.
        renderTop10ForFilter(type);
        return;
    }

    // Generic show/hide filter (e.g. Trending Now)
    currentTrendingFilter = type;
    container.querySelectorAll(':scope > .scroll-card, :scope > .top-10-card').forEach(card => {
        const cardType = card.dataset.mediaType;
        if (type === 'all' || cardType === type) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });

    if (typeof updateScrollButtons === 'function') {
        updateScrollButtons(container);
    }
}

trendingContainer.addEventListener('scroll', () => {
    updateScrollButtons(trendingContainer);
});

// ==========================================
// INFINITE SCROLL — IntersectionObserver
// ==========================================
// A sentinel div is placed at the end of the card list.
// When it enters the scroll container's viewport, the next page is fetched.
// This replaces the old pixel-math scroll event that ran on every scroll tick.

let trendingObserver = null;

function attachTrendingObserver() {
    // Disconnect any previous observer to avoid double-firing
    if (trendingObserver) {
        trendingObserver.disconnect();
        trendingObserver = null;
    }

    // Remove any leftover sentinel from the previous batch
    const old = document.getElementById('trending-sentinel');
    if (old) old.remove();

    // Create a tiny invisible sentinel at the end of the card row
    const sentinel = document.createElement('div');
    sentinel.id = 'trending-sentinel';
    sentinel.style.cssText = 'width:4px;height:100%;flex-shrink:0;pointer-events:none;';
    trendingContainer.appendChild(sentinel);

    trendingObserver = new IntersectionObserver(
        (entries) => {
            if (entries[0].isIntersecting) {
                loadTrending();
            }
        },
        {
            root: trendingContainer,     // watch inside the horizontal scroll box
            rootMargin: '0px 300px 0px 0px', // trigger 300px before the right edge
            threshold: 0
        }
    );

    trendingObserver.observe(sentinel);
}

async function loadTrending() {
    if (isTrendingLoading) return;
    const activeUrl = currentFetchUrl;
    if (activeUrl === "STOP") return;

    isTrendingLoading = true;

    // Only show skeletons if this is the FIRST page load
    if (trendingPage === 1) {
        renderSkeletons(trendingContainer, 10);
    }

    try {
        let data;
        if (activeUrl) {
            const merged = await fetchFilterPage(activeUrl, trendingPage);
            data = { results: merged };
        } else {
            data = await fetchCached(`${BASE_TMDB_URL}/trending/all/day?api_key=${TMDB_API_KEY}&page=${trendingPage}`);
            if (trendingPage === 1) {
                const urlParams = new URLSearchParams(window.location.search);
                if (!urlParams.has('id')) {
                    // Don't clear container here, we handle it below
                    initHero(data.results.slice(0, 5));
                    // Reset top10 pool and seed it with this first page
                    top10Pool = data.results.filter(i => i.media_type !== 'person' && i.poster_path);
                    top10Page = trendingPage;
                    renderTop10ForFilter(top10Filter);
                }
            }
        }

        if (currentFetchUrl !== activeUrl) {
            isTrendingLoading = false;
            return;
        }

        if (data.results && data.results.length > 0) {
            // --- FIX START: Remove Skeletons before showing real data ---
            if (trendingPage === 1) {
                trendingContainer.innerHTML = ''; 
            }
            // --- FIX END ---

            trendingPage++;
            renderCards(data.results, trendingContainer, true);

            // Apply the currently active "Trending Now" media-type filter
            // to the newly appended cards as well.
            if (currentTrendingFilter !== 'all') {
                trendingContainer.querySelectorAll(':scope > .scroll-card').forEach(card => {
                    if (card.dataset.mediaType !== currentTrendingFilter) {
                        card.style.display = 'none';
                    }
                });
            }

            // Re-attach the sentinel after every batch so the observer always
            // watches the new end of the list (works for home feed AND filter results)
            attachTrendingObserver();
        } else if (trendingPage === 1) {
            trendingContainer.innerHTML = '<p class="text-gray-400 p-4">No results found.</p>';
        }

    } catch (error) {
        console.error("Trending Error:", error);
        if (trendingPage === 1) trendingContainer.innerHTML = '<p class="text-gray-400 p-4">Failed to load content. Try again later.</p>';
    } finally {
        isTrendingLoading = false;
    }
}

async function initHero(items) {
    const slidesContainer = document.getElementById('hero-slides');
    const indicatorsContainer = document.getElementById('hero-indicators');
    slidesContainer.innerHTML = '';
    indicatorsContainer.innerHTML = '';
    heroSection.style.display = 'block';
    heroSection.classList.remove('skeleton');

    const validItems = items.filter(i => i.media_type !== 'person' && i.backdrop_path);

    // --- FIX #1: Fetch all logos IN PARALLEL instead of one by one ---
    const logoResults = await Promise.allSettled(
        validItems.map(item =>
            fetchCached(`${BASE_TMDB_URL}/${item.media_type}/${item.id}/images?api_key=${TMDB_API_KEY}`)
        )
    );

    // --- FIX #4: Preload the first slide's backdrop image immediately ---
    if (validItems[0]?.backdrop_path) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = `${TMDB_BACKDROP_WEB}${validItems[0].backdrop_path}`;
        document.head.appendChild(link);
    }

    // --- Build real slides ---
    const slideNodes = [];
    validItems.forEach((item, i) => {
        const title = item.title || item.name;
        const backdrop = `${TMDB_BACKDROP_WEB}${item.backdrop_path}`;

        let logoUrl = null;
        if (logoResults[i].status === 'fulfilled') {
            const imgData = logoResults[i].value;
            const logo = imgData.logos?.find(l => l.iso_639_1 === 'en') || imgData.logos?.[0];
            if (logo) logoUrl = `${TMDB_POSTER_XL}${logo.file_path}`;
        }

        const slide = document.createElement('div');
        slide.className = 'hero-slide';
        slide.style.backgroundImage = `url('${backdrop}')`;

        const titleHtml = logoUrl
            ? `<img src="${logoUrl}" class="hero-logo" alt="${title}" loading="lazy">`
            : `<h1 class="text-3xl md:text-5xl font-bold mb-4 text-white drop-shadow-lg">${title}</h1>`;

        slide.innerHTML = `
                <div class="hero-overlay">
                    <div class="hero-content fade-in">
                        ${titleHtml}
                        <p class="hero-text text-white text-gray-200">${item.overview}</p>
                        <button onclick="selectContent(${item.id}, '${title.replace(/'/g, "\\'")}', '${item.media_type}')" class="action-btn btn-play text-base md:text-lg px-6 md:px-8 py-2 md:py-3" tabindex="-1">
                            <i class="fas fa-play mr-2"></i> Watch Now
                        </button>
                    </div>
                </div>
            `;
        slideNodes.push(slide);

        const ind = document.createElement('div');
        ind.className = 'indicator';
        ind.onclick = () => showHeroSlide(i);
        indicatorsContainer.appendChild(ind);
    });

    const slideCount = slideNodes.length;
    if (slideCount === 0) return;

    // --- Infinite-loop clone technique ---
    // Structure: [clone-of-last] [slide-0] [slide-1] … [slide-N-1] [clone-of-first]
    // We start the container at translateX(-100%) so slide-0 is in view.
    const cloneFirst = slideNodes[0].cloneNode(true);
    const cloneLast  = slideNodes[slideCount - 1].cloneNode(true);
    [cloneFirst, cloneLast].forEach(c => c.querySelectorAll('button,a').forEach(el => el.tabIndex = -1));

    slidesContainer.appendChild(cloneLast);   // position 0  (clone of last)
    slideNodes.forEach(s => slidesContainer.appendChild(s)); // positions 1…N
    slidesContainer.appendChild(cloneFirst);  // position N+1 (clone of first)

    // currentHeroIndex tracks the REAL slide index (0-based)
    let currentHeroIndex = 0;
    _heroRealCount = slideCount;

    // Position to real slide 0 instantly (no animation)
    slidesContainer.style.transition = 'none';
    slidesContainer.style.transform = `translateX(-${1 * 100}%)`;
    // Mark initial state
    slideNodes[0].classList.add('active');
    slideNodes[0].querySelectorAll('button,a').forEach(el => el.tabIndex = 0);
    document.querySelectorAll('.indicator').forEach((ind, i) => ind.classList.toggle('active', i === 0));

    if (heroInterval) clearInterval(heroInterval);
    heroInterval = setInterval(() => {
        currentHeroIndex = (currentHeroIndex + 1) % slideCount;
        showHeroSlide(currentHeroIndex);
    }, 6000);

    setupHeroDrag(slideCount);
}

function heroSlideStep(direction) {
    const slideCount = _heroRealCount;
    if (!slideCount) return;
    const slidesContainer = document.getElementById('hero-slides');
    if (!slidesContainer) return;

    // Find current real index from active slide
    const allSlides = slidesContainer.querySelectorAll('.hero-slide');
    let activeReal = 0;
    allSlides.forEach((s, i) => { if (s.classList.contains('active')) activeReal = i - 1; });

    // Compute next index; allow -1 and slideCount so the clone transition fires
    let nextIndex = activeReal + direction;
    // Clamp to clone range: -1 wraps via clone-of-last, slideCount wraps via clone-of-first
    if (nextIndex < -1) nextIndex = slideCount - 1;
    if (nextIndex > slideCount) nextIndex = 0;

    // For the interval, the real index after wrap
    const realNext = ((nextIndex % slideCount) + slideCount) % slideCount;

    showHeroSlide(nextIndex);

    if (heroInterval) clearInterval(heroInterval);
    let idx = realNext;
    heroInterval = setInterval(() => {
        idx = (idx + 1) % slideCount;
        showHeroSlide(idx);
    }, 6000);
}

function setupHeroDrag(slideCount) {
    if (slideCount < 2) return;
    if (heroSection.dataset.dragBound) return;
    heroSection.dataset.dragBound = 'true';

    let startX = 0;
    let startY = 0;
    let isDragging = false;
    let dragged = false;
    const threshold = 50;

    const onStart = (x, y) => {
        startX = x;
        startY = y;
        isDragging = true;
        dragged = false;
    };

    const getSlidesContainer = () => document.getElementById('hero-slides');
    // Returns the REAL slide index (0-based), not DOM index
    const getCurrentRealIndex = () => {
        const container = getSlidesContainer();
        if (!container) return 0;
        const slides = container.querySelectorAll('.hero-slide');
        const domIdx = Array.from(slides).findIndex(s => s.classList.contains('active'));
        // DOM layout: [clone-last, slide-0 … slide-N-1, clone-first]
        // real index = domIdx - 1
        return Math.max(0, domIdx - 1);
    };

    const onMove = (x, y, e) => {
        if (!isDragging) return;
        const dx = x - startX;
        const dy = y - startY;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
            dragged = true;
            if (e.cancelable) e.preventDefault();
            // Live drag: offset based on DOM position (realIndex + 1)
            const container = getSlidesContainer();
            if (container) {
                const domIndex = getCurrentRealIndex() + 1;
                const baseOffset = domIndex * 100;
                const dragOffset = (dx / heroSection.offsetWidth) * 100;
                container.style.transition = 'none';
                container.style.transform = `translateX(${-baseOffset + dragOffset}%)`;
            }
        }
    };

    const onEnd = (x) => {
        if (!isDragging) return;
        const dx = x - startX;
        const container = getSlidesContainer();
        if (container) container.style.transition = ''; // restore CSS transition
        if (Math.abs(dx) > threshold) {
            heroSlideStep(dx < 0 ? 1 : -1);
        } else {
            // Snap back to current real slide
            showHeroSlide(getCurrentRealIndex());
        }
        isDragging = false;
    };

    heroSection.addEventListener('mousedown', (e) => onStart(e.clientX, e.clientY));
    heroSection.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY, e));
    heroSection.addEventListener('mouseup', (e) => onEnd(e.clientX));
    heroSection.addEventListener('mouseleave', () => { isDragging = false; });

    heroSection.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        onStart(t.clientX, t.clientY);
    }, { passive: true });

    heroSection.addEventListener('touchmove', (e) => {
        const t = e.touches[0];
        onMove(t.clientX, t.clientY, e);
    }, { passive: false });

    heroSection.addEventListener('touchend', (e) => {
        const t = e.changedTouches[0];
        onEnd(t.clientX);
    });

    heroSection.addEventListener('click', (e) => {
        if (dragged) {
            e.preventDefault();
            e.stopPropagation();
            dragged = false;
        }
    }, true);

    heroSection.style.cursor = 'grab';
    heroSection.addEventListener('mousedown', () => heroSection.style.cursor = 'grabbing');
    heroSection.addEventListener('mouseup', () => heroSection.style.cursor = 'grab');
}

// Tracks the real slide count for the infinite-loop helper
let _heroRealCount = 0;

function showHeroSlide(realIndex) {
    const slidesContainer = document.getElementById('hero-slides');
    if (!slidesContainer) return;
    const slideCount = _heroRealCount;
    if (slideCount === 0) return;

    // In the DOM: [clone-last] [slide-0…slide-N-1] [clone-first]
    // So real slide i lives at DOM position (i + 1)
    const domIndex = realIndex + 1;

    // Animate to the target (or clone) position
    slidesContainer.style.transition = 'transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    slidesContainer.style.transform = `translateX(-${domIndex * 100}%)`;

    // Update active class on real slides (DOM positions 1…N)
    const allSlides = slidesContainer.querySelectorAll('.hero-slide');
    allSlides.forEach((s, i) => {
        const isReal = i >= 1 && i <= slideCount;
        const isActive = isReal && (i - 1) === realIndex;
        s.classList.toggle('active', isActive);
        s.querySelectorAll('button, a').forEach(el => { el.tabIndex = isActive ? 0 : -1; });
    });

    // Update indicators
    document.querySelectorAll('.indicator').forEach((ind, i) => ind.classList.toggle('active', i === realIndex));

    // --- Seamless wrap: if we're at a clone, silently jump to the real counterpart ---
    slidesContainer.addEventListener('transitionend', function onEnd() {
        slidesContainer.removeEventListener('transitionend', onEnd);

        let correctedIndex = realIndex;
        // We went to clone-of-first (DOM position slideCount+1) → jump to real first (DOM position 1)
        if (realIndex === slideCount) {
            correctedIndex = 0;
        }
        // We went to clone-of-last (DOM position 0) → jump to real last (DOM position slideCount)
        else if (realIndex === -1) {
            correctedIndex = slideCount - 1;
        }

        if (correctedIndex !== realIndex) {
            slidesContainer.style.transition = 'none';
            slidesContainer.style.transform = `translateX(-${(correctedIndex + 1) * 100}%)`;
        }
    }, { once: true });
}

async function renderTop10ForFilter(type) {
    top10Filter = type;

    if (isTop10Loading) return;
    isTop10Loading = true;

    try {
        let filtered = top10Pool.filter(i => type === 'all' || i.media_type === type);

        // Keep fetching more "trending/all" pages until we have 10 matching
        // items (or we run out of pages, max 5 extra pages as a safety cap).
        let safety = 0;
        while (filtered.length < 10 && top10Page < 1 + 5 + safety) {
            // Stop if we've already tried a reasonable number of extra pages
            if (safety >= 5) break;

            top10Page++;
            safety++;

            let data;
            try {
                data = await fetchCached(`${BASE_TMDB_URL}/trending/all/day?api_key=${TMDB_API_KEY}&page=${top10Page}`);
            } catch (e) {
                break;
            }

            if (!data.results || data.results.length === 0) break;

            const newItems = data.results.filter(i => i.media_type !== 'person' && i.poster_path);
            top10Pool.push(...newItems);

            filtered = top10Pool.filter(i => type === 'all' || i.media_type === type);
        }

        renderTop10List(filtered.slice(0, 10));
    } finally {
        isTop10Loading = false;
    }
}

function renderTop10List(items) {
    top10Container.innerHTML = '';
    items.forEach((item, index) => {
        const title = item.title || item.name;
        const poster = item.poster_path ? `${TMDB_POSTER_MD}${item.poster_path}` : null;
        if (!poster) return;

        const card = document.createElement('div');
        card.className = 'top-10-card';
        card.dataset.mediaType = item.media_type;
        card.innerHTML = `
                <div class="rank-number">${index + 1}</div>
                <img src="${poster}" class="top-poster" loading="lazy" alt="${title}">
            `;
        card.onclick = () => selectContent(item.id, title, item.media_type);
        top10Container.appendChild(card);
    });

    // --- NEW: Update scroll buttons ---
    updateScrollButtons(top10Container);
}

function renderCards(items, container, trackIds) {
    items.forEach(item => {
        // Track IDs to prevent duplicates (only for Movies/TV/Person)
        if (trackIds && item.media_type !== 'company') {
            if (loadedIds.has(item.id)) return;
            loadedIds.add(item.id);
        } else if (item.media_type === 'person' && !trackIds) {
             return;
        }

        const title = item.title || item.name;
        let poster = "";
        let isPerson = false;
        let isCompany = false;

        // --- DETERMINE IMAGE & TYPE ---
        if (item.media_type === 'person') {
            isPerson = true;
            poster = item.profile_path ? `${TMDB_POSTER_MD}${item.profile_path}` : null;
        } else if (item.media_type === 'company') {
            isCompany = true;
            poster = item.logo_path ? `${TMDB_IMG_BASE_URL}${item.logo_path}` : null;
        } else {
            poster = item.poster_path ? `${TMDB_POSTER_MD}${item.poster_path}` : null;
        }

        // Fallback Image URL
        const fallbackImage = 'https://placehold.co/150x225/222/999?text=No+Image';
        if (!poster) poster = fallbackImage;

        const rating = item.vote_average ? item.vote_average.toFixed(1) : 'NR';
        const year = (item.release_date || item.first_air_date || 'N/A').substring(0, 4);

        // --- BADGE LOGIC ---
        let badgeHtml = "";
        if (item.media_type === 'tv') badgeHtml = `<div class="media-badge tv">TV</div>`;
        else if (item.media_type === 'movie') badgeHtml = `<div class="media-badge movie">MOVIE</div>`;
        
        // --- NEW CONTENT LOGIC (Added) ---
        // Checks if release date is within the last 30 days
        const releaseDate = new Date(item.release_date || item.first_air_date);
        const now = new Date();
        const diffTime = Math.abs(now - releaseDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // If released in the last 30 days and not in the future
        if (diffDays <= 30 && releaseDate <= now) {
            badgeHtml += `<div class="media-badge new">NEW</div>`;
        }
        // ---------------------------------

        const card = document.createElement('div');
        card.className = 'scroll-card';
        card.dataset.mediaType = item.media_type;

        if (isPerson) {
             card.innerHTML = `
                <div class="poster-wrapper" style="border-radius: 50%; aspect-ratio: 1/1; width: 140px; margin: 0 auto; border: 2px solid #333; overflow: hidden;">
                    <img src="${poster}" class="poster-img skeleton" loading="lazy" alt="${title}" 
                         onload="this.classList.remove('skeleton')"
                         onerror="this.onerror=null; this.src='${fallbackImage}'"
                         style="border-radius: 50%;">
                </div>
                <div class="card-body" style="text-align: center;">
                    <div class="card-title">${title}</div>
                    <div class="card-meta" style="justify-content: center;">
                        <span class="text-xs text-gray-400">Person</span>
                    </div>
                </div>
            `;
            card.onclick = () => loadActorCredits(item.id, title, item.profile_path, item.gender);

        } else if (isCompany) {
             if (poster === fallbackImage) return;

             card.innerHTML = `
                <div class="poster-wrapper" style="background: #fff; padding: 20px; display:flex; align-items:center; justify-content:center;">
                    <img src="${poster}" class="poster-img" loading="lazy" alt="${title}" 
                         style="object-fit: contain; filter: none; width:auto; height:auto; max-width:80%; max-height:80%;">
                </div>
                <div class="card-body">
                    <div class="card-title">${title}</div>
                    <div class="card-meta">
                        <span class="text-xs text-gray-400">Production</span>
                    </div>
                </div>
            `;
            card.onclick = () => quickFilter('company', item.id, title, item.logo_path);

        } else {
            const charHtml = item.character 
                ? `<div class="text-[11px] text-gray-400 mb-1 truncate" title="as ${item.character}">as <span class="text-gray-200">${item.character}</span></div>` 
                : '';

            card.innerHTML = `
                <div class="poster-wrapper">
                    ${badgeHtml} 
                    <img src="${poster}" class="poster-img skeleton" loading="lazy" alt="${title}" 
                         onload="this.classList.remove('skeleton')"
                         onerror="this.onerror=null; this.src='${fallbackImage}'">
                    <div class="play-overlay">
                        <div class="play-icon-circle"><i class="fas fa-play"></i></div>
                    </div>
                </div>
                <div class="card-body">
                    <div class="card-title" title="${title}">${title}</div>
                    ${charHtml}
                    <div class="card-meta">
                        <span>${year}</span>
                        <span class="text-yellow-500 font-bold"><i class="fas fa-star mr-1"></i>${rating}</span>
                    </div>
                </div>
            `;
            card.onclick = () => selectContent(item.id, title, item.media_type);
        }

        container.appendChild(card);
    });

    if (typeof updateScrollButtons === 'function') {
        updateScrollButtons(container);
    }
}

async function loadRecommendations(type, id) {
    recommendationsContainer.innerHTML = '';
    recommendationsSection.classList.add('hidden');
    try {
        const data = await fetchCached(`${BASE_TMDB_URL}/${type}/${id}/recommendations?api_key=${TMDB_API_KEY}`);
        if (data.results && data.results.length > 0) {
            recommendationsSection.classList.remove('hidden');
            const results = data.results.map(item => ({ ...item, media_type: type }));
            renderCards(results, recommendationsContainer, false);
        }
    } catch (e) { console.error("Recs Error", e); }
}

searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const query = searchInput.value.trim();
    if (query.length < 2) { searchResults.innerHTML = ''; return; }
    searchTimeout = setTimeout(() => performMultiSearch(query), 500);
});

async function performMultiSearch(query) {
    searchResults.innerHTML = '';
    
    // Show skeletons while loading
    for (let i = 0; i < 3; i++) {
        searchResults.innerHTML += `
            <li class="search-result-item">
                <div class="result-poster skeleton" style="width:40px; height:60px"></div>
                <div style="flex:1">
                    <div class="skeleton skeleton-text" style="height:10px; margin-bottom:4px"></div>
                    <div class="skeleton skeleton-text" style="width:50%; height:10px"></div>
                </div>
            </li>`;
    }

    try {
        // Run all search requests in parallel for speed
        const [multiRes, collectionRes, companyRes, keywordRes] = await Promise.all([
            fetchCached(`${BASE_TMDB_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=true&page=1`),
            fetchCached(`${BASE_TMDB_URL}/search/collection?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`),
            fetchCached(`${BASE_TMDB_URL}/search/company?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`),
            fetchCached(`${BASE_TMDB_URL}/search/keyword?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`)
        ]);

        // Split multi results by type
        const allMulti = multiRes.results || [];
        const moviesAndTV = allMulti.filter(i => i.media_type === 'movie' || i.media_type === 'tv').slice(0, 12);
        const people = allMulti.filter(i => i.media_type === 'person').slice(0, 2);

        // Supplementary results — capped tightly so they don't crowd out content
        const collections = (collectionRes.results || []).slice(0, 1).map(i => ({ ...i, media_type: 'collection' }));
        const companies = (companyRes.results || []).slice(0, 1).map(i => ({ ...i, media_type: 'company' }));
        const keywords = (keywordRes.results || []).slice(0, 1).map(i => ({ ...i, media_type: 'keyword' }));

        // Priority: Movies & TV first, then people, then supplementary filters at the bottom
        const combinedResults = [...moviesAndTV, ...people, ...collections, ...companies, ...keywords];

        displayResults(combinedResults);

    } catch (e) {
        console.error("Search Error", e);
        searchResults.innerHTML = '<li class="p-4 text-center text-red-400">Error fetching results.</li>';
    }
}

function displayResults(results) {
    searchResults.innerHTML = '';
    if (!results || !results.length) { 
        searchResults.innerHTML = '<li class="p-4 text-center text-gray-400">No results found.</li>'; 
        return; 
    }

    results.forEach(item => {
        const li = document.createElement('li');
        li.className = 'search-result-item';

        // --- 1. HANDLE COLLECTIONS ---
        if (item.media_type === 'collection') {
            const poster = item.poster_path ? `${TMDB_POSTER_MD}${item.poster_path}` : 'https://placehold.co/40x60/222/999?text=Coll';
            li.innerHTML = `
                <img src="${poster}" class="result-poster" loading="lazy">
                <div class="text-left">
                    <div class="font-bold text-white text-sm">${item.name}</div>
                    <div class="text-xs text-blue-400 uppercase font-bold tracking-wider">Collection</div>
                </div>`;
            li.onclick = () => {
                // Close search and load collection
                searchResults.innerHTML = '';
                searchInput.value = '';
                // Hide other sections
                heroSection.style.display = 'none';
                document.getElementById('top10-section').style.display = 'none';
                detailsSection.classList.add('hidden');
                playerInterface.classList.add('hidden');
                loadCollection(item.id, item.name);
            };
        }

        // --- 2. HANDLE COMPANIES (Networks/Studios) ---
        else if (item.media_type === 'company') {
            const logo = item.logo_path ? `${TMDB_IMG_BASE_URL}${item.logo_path}` : null;
            const imgHtml = logo 
                ? `<img src="${logo}" class="result-poster" style="object-fit:contain; background:white; padding:2px;" loading="lazy">`
                : `<div class="result-poster flex items-center justify-center bg-gray-700 text-gray-400"><i class="fas fa-building"></i></div>`;
            
            li.innerHTML = `
                ${imgHtml}
                <div class="text-left">
                    <div class="font-bold text-white text-sm">${item.name}</div>
                    <div class="text-xs text-purple-400 uppercase font-bold tracking-wider">Company</div>
                </div>`;
            li.onclick = () => {
                quickFilter('company', item.id, item.name);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
        }

        // --- 3. HANDLE KEYWORDS ---
        else if (item.media_type === 'keyword') {
            li.innerHTML = `
                <div class="result-poster flex items-center justify-center bg-gray-800 text-gray-400 border border-gray-700">
                    <i class="fas fa-hashtag"></i>
                </div>
                <div class="text-left">
                    <div class="font-bold text-white text-sm">${item.name}</div>
                    <div class="text-xs text-gray-500 uppercase font-bold tracking-wider">Keyword</div>
                </div>`;
            li.onclick = () => {
                quickFilter('keyword', item.id, item.name);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
        }

        // --- 4. HANDLE PEOPLE ---
        else if (item.media_type === 'person') {
            const name = item.name;
            const imgHtml = getPersonFace(item.profile_path, item.gender, "result-poster rounded-full", "text-lg");
            li.innerHTML = `${imgHtml}<div class="text-left"><div class="font-bold text-white text-sm">${name}</div><div class="text-xs text-gray-400">Person</div></div>`;
            li.onclick = () => loadActorCredits(item.id, name, item.profile_path, item.gender);
        } 

        // --- 5. HANDLE MOVIES & TV ---
        else {
            const title = item.title || item.name;
            const date = item.release_date || item.first_air_date;
            const year = date ? new Date(date).getFullYear() : 'N/A';
            const poster = item.poster_path ? `${TMDB_IMG_BASE_URL}${item.poster_path}` : 'https://placehold.co/40x60/333/999?text=N/A';
            const typeLabel = item.media_type === 'tv' ? 'TV SHOW' : 'MOVIE';
            
            li.innerHTML = `
                <img src="${poster}" class="result-poster" loading="lazy">
                <div class="text-left">
                    <div class="font-bold text-white text-sm">${title}</div>
                    <div class="text-xs text-gray-400">${typeLabel} • ${year} • ${item.vote_average ? item.vote_average.toFixed(1) : 'NR'}</div>
                </div>`;
            li.onclick = () => selectContent(item.id, title, item.media_type);
        }

        searchResults.appendChild(li);
    });
}

// --- Accepts gender to display correct icon in header ---
async function loadActorCredits(personId, personName, profilePath, gender) {
    // --- URL & Title ---
    document.title = `${personName} - Chithruka`;
    window.history.pushState(
        { id: personId, type: 'person', name: personName, profilePath, gender },
        '',
        `?id=${personId}&type=person&name=${encodeURIComponent(personName)}`
    );

    // 1. Reset UI
    searchResults.innerHTML = '';
    searchInput.value = '';
    trendingContainer.innerHTML = '';
    loadedIds.clear();
    trendingPage = 1;
    currentFetchUrl = "STOP"; 
    
    heroSection.style.display = 'none';
    document.getElementById('top10-section').style.display = 'none';
    detailsSection.classList.add('hidden');
    playerInterface.classList.add('hidden');
    collectionSection.classList.add('hidden');
    document.getElementById('continue-watching-section').classList.add('hidden');
    
    const personContainer = document.getElementById('person-details-container');
    if (personContainer) {
        personContainer.classList.add('hidden');
        personContainer.innerHTML = '';
    }

    renderSkeletons(trendingContainer, 10);

    const imgHtml = getPersonFace(profilePath, gender, "w-8 h-8 rounded-full mr-3 border border-gray-600 inline-flex", "text-sm");
    document.getElementById('trending-header').innerHTML = `<div class="flex items-center">${imgHtml} <span class="ml-2">Featuring ${personName}</span></div>`;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            document.getElementById('trending-header').scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    try {
        const [personData, combinedCredits] = await Promise.all([
            fetchCached(`${BASE_TMDB_URL}/person/${personId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids,images`),
            fetchCached(`${BASE_TMDB_URL}/person/${personId}/combined_credits?api_key=${TMDB_API_KEY}`)
        ]);

        // --- NEW LOGIC: Merge Cast & Crew ---
        
        const uniqueItems = new Map();
        
        // 1. Process CAST first (Priority)
        // We prefer showing the Acting credit because it has the Character Name.
        if (combinedCredits.cast) {
            combinedCredits.cast.forEach(item => {
                if (item.poster_path) {
                    // Start date is needed for sorting later (release_date for movies, first_air_date for tv)
                    item.date = new Date(item.release_date || item.first_air_date || '1900-01-01');
                    uniqueItems.set(item.id, item);
                }
            });
        }

        // 2. Process CREW second
        // Only add if we don't already have this movie from the Cast list.
        if (combinedCredits.crew) {
            combinedCredits.crew.forEach(item => {
                if (item.poster_path && !uniqueItems.has(item.id)) {
                    // IMPORTANT: The card renderer uses 'item.character' to show text below the title.
                    // Since crew don't have character names, we inject their Job (e.g., "Director") there.
                    item.character = item.job; 
                    
                    item.date = new Date(item.release_date || item.first_air_date || '1900-01-01');
                    uniqueItems.set(item.id, item);
                }
            });
        }

        // 3. Convert Map to Array
        const results = Array.from(uniqueItems.values());

        // 4. Sort by Popularity (Standard)
        results.sort((a, b) => b.popularity - a.popularity);

        // Display
        trendingContainer.innerHTML = ''; 
        if (results.length === 0) {
            trendingContainer.innerHTML = '<div class="text-gray-400 p-4">No credits found.</div>';
        } else {
            renderCards(results, trendingContainer, true);
            trendingContainer.scrollLeft = 0;
        }
        
        // Profile Stats
        // UPDATED: Use results.length to match the slider exactly (excludes items without posters)
        const totalCount = results.length;

        renderPersonProfile(personData, totalCount);

    } catch (e) { 
        console.error("Actor Load Error", e);
        trendingContainer.innerHTML = '<div class="text-red-500 p-4">Failed to load person details.</div>';
    }
}

function renderPersonProfile(data, totalCredits) {
    const container = document.getElementById('person-details-container');
    if (!container || !data) return;

    // --- DATA PREPARATION ---

    // 1. Biography
    const bio = data.biography; // Can be empty or null
    
    // 2. Personal Stats
    const knownFor = data.known_for_department;
    const birthday = data.birthday ? new Date(data.birthday).toLocaleDateString(undefined, { dateStyle: 'long' }) : null;
    const place = data.place_of_birth;
    const deathday = data.deathday ? new Date(data.deathday).toLocaleDateString(undefined, { dateStyle: 'long' }) : null;
    
    // Gender Logic (1=Female, 2=Male, 3=Non-binary)
    let genderStr = null;
    if (data.gender === 1) genderStr = "Female";
    else if (data.gender === 2) genderStr = "Male";
    else if (data.gender === 3) genderStr = "Non-binary";

    // "Also Known As" Logic
    // Limit to 3 to keep it clean, show only if array exists and has items
    let aliasesHtml = '';
    if (data.also_known_as && data.also_known_as.length > 0) {
        const aliases = data.also_known_as.slice(0, 3).join('<br>');
        aliasesHtml = aliases;
    }

    // Age Calculation
    let ageStr = "";
    if (data.birthday && !data.deathday) {
        const birthDate = new Date(data.birthday);
        const ageDifMs = Date.now() - birthDate.getTime();
        const ageDate = new Date(ageDifMs);
        ageStr = ` (${Math.abs(ageDate.getUTCFullYear() - 1970)} years old)`;
    } else if (data.deathday && data.birthday) {
        // Calculate age at death
        const birthDate = new Date(data.birthday);
        const deathDate = new Date(data.deathday);
        let age = deathDate.getFullYear() - birthDate.getFullYear();
        const m = deathDate.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && deathDate.getDate() < birthDate.getDate())) {
            age--;
        }
        ageStr = ` (Died at ${age})`;
    }

    // Social Links
    let socialsHtml = '';
    const ids = data.external_ids;
    if (ids) {
        if (ids.imdb_id) socialsHtml += `<a href="https://www.imdb.com/name/${ids.imdb_id}" target="_blank" class="text-yellow-500 hover:text-white transition" title="IMDb"><i class="fab fa-imdb text-2xl"></i></a>`;
        if (ids.wikidata_id) socialsHtml += `<a href="https://www.wikidata.org/wiki/Special:GoToLinkedPage/enwiki/${ids.wikidata_id}" target="_blank" class="text-gray-300 hover:text-white transition" title="Wikipedia"><i class="fab fa-wikipedia-w text-2xl"></i></a>`;
        if (ids.facebook_id) socialsHtml += `<a href="https://facebook.com/${ids.facebook_id}" target="_blank" class="text-blue-600 hover:text-white transition" title="Facebook"><i class="fab fa-facebook text-2xl"></i></a>`;
        if (ids.instagram_id) socialsHtml += `<a href="https://instagram.com/${ids.instagram_id}" target="_blank" class="text-pink-500 hover:text-white transition" title="Instagram"><i class="fab fa-instagram text-2xl"></i></a>`;
        if (ids.twitter_id) socialsHtml += `<a href="https://twitter.com/${ids.twitter_id}" target="_blank" class="text-blue-400 hover:text-white transition" title="X (Twitter)"><i class="fab fa-x-twitter text-2xl"></i></a>`;
        if (ids.tiktok_id) socialsHtml += `<a href="https://www.tiktok.com/@${ids.tiktok_id}" target="_blank" class="text-pink-400 hover:text-white transition" title="TikTok"><i class="fab fa-tiktok text-2xl"></i></a>`;
        if (ids.youtube_id) socialsHtml += `<a href="https://www.youtube.com/${ids.youtube_id}" target="_blank" class="text-red-600 hover:text-white transition" title="YouTube"><i class="fab fa-youtube text-2xl"></i></a>`;
    }

    // --- CHECK IF EMPTY ---
    // If essential fields are ALL missing, do not show the container.
    const hasData = bio || birthday || place || (totalCredits > 0) || socialsHtml || deathday || aliasesHtml;
    
    if (!hasData) {
        container.classList.add('hidden');
        return;
    }

    // --- BUILD HTML SECTIONS ---
    
    // Helper to generate a stat block safely (hides if value is null/empty)
    const createStat = (label, value, subValue = "") => {
        if (!value) return "";
        return `
            <div class="mb-4">
                <div class="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1">${label}</div>
                <div class="text-white text-sm leading-snug">${value}${subValue}</div>
            </div>
        `;
    };

    const statsHtml = `
        ${createStat("Known For", knownFor)}
        ${createStat("Known Credits", totalCredits ? totalCredits.toString() : null)}
        ${createStat("Gender", genderStr)}
        ${createStat("Born", birthday, ageStr)}
        ${createStat("Place of Birth", place)}
        ${createStat("Day of Death", deathday)}
        ${createStat("Also Known As", aliasesHtml)}
    `;

    // --- RENDER ---
    // Note: The Bio section is conditionally hidden using a template literal class check
    container.innerHTML = `
        <div class="flex flex-col md:flex-row gap-8">
            <div class="md:w-1/3 flex-shrink-0">
                <h3 class="text-2xl font-bold text-white mb-4 border-l-4 border-red-600 pl-3">Personal Info</h3>
                
                <div class="bg-white/5 rounded-xl p-4 border border-white/10">
                    ${statsHtml}
                    
                    ${socialsHtml ? `
                    <div class="mt-6 pt-4 border-t border-white/10">
                        <div class="text-gray-400 text-xs uppercase font-bold tracking-wider mb-3">Social Media</div>
                        <div class="flex gap-4 flex-wrap">${socialsHtml}</div>
                    </div>` : ''}
                </div>
            </div>

            <div class="md:w-2/3 ${!bio ? 'hidden' : ''}">
                <h3 class="text-2xl font-bold text-white mb-4 border-l-4 border-red-600 pl-3">Biography</h3>
                <div class="text-gray-300 leading-relaxed text-sm md:text-base whitespace-pre-line relative">
                    <p id="person-bio-text" class="line-clamp-[10] transition-all duration-300">${bio || ''}</p>
                    ${bio && bio.length > 800 ? `
                        <button onclick="document.getElementById('person-bio-text').classList.toggle('line-clamp-[10]'); this.textContent = this.textContent === 'Read More' ? 'Show Less' : 'Read More'" 
                        class="text-red-500 text-sm font-bold mt-2 hover:underline focus:outline-none">Read More</button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    container.classList.remove('hidden');
}

window.openFilterModal = () => {
    filterModal.classList.remove('hidden');
    window.toggleMobileNav(true); // Hide nav
    loadGenres();
    loadCountries();
    loadLanguages();
};

window.closeFilterModal = () => {
    filterModal.classList.add('hidden');
    window.toggleMobileNav(false); // Show nav
};

async function loadGenres() {
    const rawType = document.getElementById('filter-type').value;
    const type = rawType === 'all' ? 'movie' : rawType; // TMDB has no /genre/all/list endpoint
    
    // Check if we already loaded this specific type to avoid unnecessary calls
    if (loadedGenreType === type) return;

    try {
        const data = await fetchCached(`${BASE_TMDB_URL}/genre/${type}/list?api_key=${TMDB_API_KEY}`);
        
        const select = document.getElementById('filter-genre');
        // Clear existing options ONLY now that we have new data ready
        select.innerHTML = '<option value="">Any Genre</option>'; 

        data.genres.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.name;
            select.appendChild(opt);
        });
        
        loadedGenreType = type; // Mark this type as loaded
    } catch (e) { 
        console.error("Genre fetch error", e); 
    }
}

async function loadCountries() {
    const select = document.getElementById('filter-country');
    if (select.children.length > 1) return;

    try {
        const data = await fetchCached(`https://api.themoviedb.org/3/configuration/countries?api_key=${TMDB_API_KEY}`);
        data.sort((a, b) => a.english_name.localeCompare(b.english_name));

        data.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.iso_3166_1;
            opt.textContent = c.english_name;
            select.appendChild(opt);
        });
    } catch (e) { console.error("Countries fetch error", e); }
}

async function loadLanguages() {
    const select = document.getElementById('filter-language');
    if (select.children.length > 1) return; // Stop if already loaded

    try {
        const data = await fetchCached(`${BASE_TMDB_URL}/configuration/languages?api_key=${TMDB_API_KEY}`);
        
        // Sort by English Name
        data.sort((a, b) => a.english_name.localeCompare(b.english_name));

        data.forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.iso_639_1;
            opt.textContent = l.english_name;
            select.appendChild(opt);
        });
    } catch (e) { console.error("Language fetch error", e); }
}

window.quickFilter = function(type, value, label = "", logo = "") {
    // --- FIX: Reset text search so it doesn't override this filter ---
    currentSearchQuery = ""; 
    
    activeFilterLabel = label;
    document.getElementById('filter-genre').value = "";
    document.getElementById('filter-country').value = "";
    document.getElementById('filter-year').value = "";
    document.getElementById('filter-rating').value = "";

    // --- URL & Title for shareable filter types ---
    const shareableTypes = ['company', 'keyword', 'network', 'genre', 'country'];
    if (shareableTypes.includes(type) && value) {
        const displayName = label || value;
        document.title = `${displayName} - Chithruka`;
        window.history.pushState(
            { filter: type, id: value, name: displayName, logo },
            '',
            `?filter=${encodeURIComponent(type)}&id=${encodeURIComponent(value)}&name=${encodeURIComponent(displayName)}${logo ? '&logo=' + encodeURIComponent(logo) : ''}`
        );
    }

    // Allow passing specific types like 'company', 'keyword', or 'network'
    let overrides = { logoPath: logo };
    overrides[type] = value;
    
    applyFilter(overrides);
}

window.clearFilters = function() {
    // --- FIX: Reset text search state ---
    currentSearchQuery = ""; 
    currentFilterState = null;
    
    // Reset Inputs
    document.getElementById('filter-genre').value = "";
    document.getElementById('filter-country').value = "";
    document.getElementById('filter-language').value = ""; 
    document.getElementById('filter-year').value = "";
    document.getElementById('filter-rating').value = "";
    if(document.getElementById('filter-type')) document.getElementById('filter-type').value = "movie";
    
    if(document.getElementById('filter-sort')) {
        document.getElementById('filter-sort').value = "popularity.desc";
    }

    const adultToggle = document.getElementById('filter-adult');
    if (adultToggle) adultToggle.checked = false;
    localStorage.setItem('include_adult', 'false');

    document.documentElement.style.setProperty('--ambient-color', '0, 0, 0');
    closeFilterModal();

    searchInput.value = '';
    searchResults.innerHTML = '';
    heroSection.style.display = 'block';
    document.getElementById('top10-section').style.display = 'block';

    const history = JSON.parse(localStorage.getItem('watch_history') || '[]');
    if (history.length > 0) {
        document.getElementById('continue-watching-section').classList.remove('hidden');
    }

    const header = document.getElementById('trending-header');
    header.innerHTML = '<i class="fas fa-fire text-red-500 mr-3"></i> Trending Now';

    // The All/Movies/TV Shows slider is only meaningful for the default mixed
    // trending feed (it actually contains both types there) - bring it back.
    const sliderWrap = document.getElementById('trending-slider-filter');
    if (sliderWrap) sliderWrap.style.display = '';

    trendingContainer.innerHTML = '';
    loadedIds.clear();
    trendingPage = 1;
    
    currentFetchUrl = ""; 
    
    loadTrending();
}


// ==========================================
// LIVE FILTER HEADER ENGINE
// Powers the editable "All Movies Rated 4.5+" style
// sentence header so every token (type, genre, country,
// language, year, rating) can be changed in place and
// instantly re-queries TMDB instead of just hiding/showing
// already-loaded cards.
// ==========================================

// The single source of truth for whatever filter is currently driving
// the trending-container. null === default "Trending Now" feed.
let currentFilterState = null;

// Caches so we don't refetch the same master lists over and over.
let inlineGenreCache = {};      // { movie: [...], tv: [...] }
let inlineCountryCache = null;  // [...]
let inlineLanguageCache = null; // [...]

async function ensureInlineGenreList(type) {
    if (inlineGenreCache[type]) return inlineGenreCache[type];
    try {
        const data = await fetchCached(`${BASE_TMDB_URL}/genre/${type}/list?api_key=${TMDB_API_KEY}`);
        inlineGenreCache[type] = data.genres || [];
    } catch (e) {
        inlineGenreCache[type] = [];
    }
    return inlineGenreCache[type];
}

async function ensureInlineCountryList() {
    if (inlineCountryCache) return inlineCountryCache;
    try {
        const data = await fetchCached(`https://api.themoviedb.org/3/configuration/countries?api_key=${TMDB_API_KEY}`);
        data.sort((a, b) => a.english_name.localeCompare(b.english_name));
        inlineCountryCache = data;
    } catch (e) {
        inlineCountryCache = [];
    }
    return inlineCountryCache;
}

async function ensureInlineLanguageList() {
    if (inlineLanguageCache) return inlineLanguageCache;
    try {
        const data = await fetchCached(`${BASE_TMDB_URL}/configuration/languages?api_key=${TMDB_API_KEY}`);
        data.sort((a, b) => a.english_name.localeCompare(b.english_name));
        inlineLanguageCache = data;
    } catch (e) {
        inlineLanguageCache = [];
    }
    return inlineLanguageCache;
}

// Genre id mapping between the movie & tv genre namespaces for the
// handful of genres that don't share an id (kept identical to the
// mapping already used elsewhere so behaviour stays consistent).
const HEADER_GENRE_MAPPING = {
    '10759': '28|12', '10765': '878|14', '10768': '10752', '10762': '10751',
    '28': '10759', '12': '10759', '878': '10765', '14': '10765', '10752': '10768',
};

// Builds a /discover/{type} URL for ONE concrete media type ('movie' or 'tv'),
// applying all the same param translations the old single-type code used to
// do inline. Used for both single-type filtering and for the two parallel
// requests that make up "All" (movies + tv shows combined).
function buildDiscoverUrlForType(concreteType, params) {
    let genre = params.genre;
    if (genre && HEADER_GENRE_MAPPING[genre]) {
        if (concreteType === 'movie' && ['10759', '10765', '10768', '10762'].includes(genre)) genre = HEADER_GENRE_MAPPING[genre];
        else if (concreteType === 'tv' && ['28', '12', '878', '14', '10752'].includes(genre)) genre = HEADER_GENRE_MAPPING[genre];
    }

    let url = `${BASE_TMDB_URL}/discover/${concreteType}?api_key=${TMDB_API_KEY}&include_adult=${params.includeAdult}&include_video=false`;

    let finalSort = params.sort || 'popularity.desc';
    if (concreteType === 'tv' && finalSort.includes('primary_release_date')) finalSort = finalSort.replace('primary_release_date', 'first_air_date');
    if (concreteType === 'movie' && finalSort.includes('first_air_date')) finalSort = finalSort.replace('first_air_date', 'primary_release_date');
    // discover/tv has no revenue sort option - fall back gracefully.
    if (concreteType === 'tv' && finalSort.startsWith('revenue')) finalSort = 'popularity.desc';
    url += `&sort_by=${finalSort}`;

    if (finalSort.startsWith('vote_average')) url += '&vote_count.gte=200';

    if (params.year) {
        if (concreteType === 'movie') url += `&primary_release_year=${params.year}`;
        else url += `&first_air_date_year=${params.year}`;
    }
    if (genre) url += `&with_genres=${genre}`;
    if (params.rating) url += `&vote_average.gte=${params.rating}`;
    if (params.country) url += `&with_origin_country=${params.country}`;
    if (params.company) url += `&with_companies=${params.company}`;
    if (params.network && concreteType === 'tv') url += `&with_networks=${params.network}`;
    if (params.language) url += `&with_original_language=${params.language}`;
    if (params.keyword) url += `&with_keywords=${params.keyword}`;

    return url;
}

// Client-side comparator used to merge & sort the combined movie+tv
// result set when type === 'all' (TMDB has no single "discover everything"
// endpoint, so we ask both endpoints and stitch the results together).
function mergeSortResults(items, sortKey) {
    const [field, dir] = (sortKey || 'popularity.desc').split('.');
    const mult = dir === 'asc' ? 1 : -1;
    const getVal = (item) => {
        switch (field) {
            case 'vote_average': return item.vote_average || 0;
            case 'revenue': return item.revenue || 0;
            case 'primary_release_date': {
                const d = item.release_date || item.first_air_date;
                return d ? new Date(d).getTime() : 0;
            }
            default: return item.popularity || 0;
        }
    };
    return [...items].sort((a, b) => (getVal(a) - getVal(b)) * mult);
}

// Unified page fetcher. Accepts the SAME string urls the rest of the app
// already uses (search/company/keyword endpoints) AND the new
// {url, mediaType} spec / array-of-specs shape used for discover + "All".
// This is what both applyFilter()'s first page and loadTrending()'s
// infinite-scroll pages call, so pagination "just works" for every mode.
async function fetchFilterPage(urlSpecOrSpecs, page) {
    let specs;
    if (typeof urlSpecOrSpecs === 'string') {
        specs = [{ url: urlSpecOrSpecs, mediaType: /\/(tv)[/?]/.test(urlSpecOrSpecs) ? 'tv' : 'movie' }];
    } else if (Array.isArray(urlSpecOrSpecs)) {
        specs = urlSpecOrSpecs;
    } else {
        specs = [urlSpecOrSpecs];
    }

    const responses = await Promise.all(specs.map(spec =>
        fetchCached(`${spec.url}&page=${page}`).catch(() => ({ results: [] }))
    ));

    let merged = [];
    responses.forEach((data, idx) => {
        const items = (data.results || []).map(i => ({ ...i, media_type: i.media_type || specs[idx].mediaType }));
        merged = merged.concat(items);
    });

    if (specs.length > 1) {
        merged = mergeSortResults(merged, currentFilterState ? currentFilterState.sort : 'popularity.desc');
    }

    // Apply the year filter consistently on every page (previously this
    // only ran on page 1, so infinite-scroll pages could leak in titles
    // from the wrong year).
    if (currentFilterState && currentFilterState.year) {
        merged = merged.filter(item => {
            const date = item.release_date || item.first_air_date;
            return date && date.substring(0, 4) === String(currentFilterState.year);
        });
    }

    return merged;
}

// Turns the live filter state back into the "overrides" shape applyFilter()
// already understands, so every inline control can just call applyFilter()
// again - one single code path for every way a filter can be triggered
// (clicking a tag, the Discover modal, or editing the live sentence).
function stateToOverrides(state) {
    return {
        type: state.type,
        genre: state.genre,
        genreLabel: state.genreLabel,
        country: state.country,
        countryLabel: state.countryLabel,
        language: state.language,
        year: state.year,
        rating: state.rating,
        company: state.company,
        network: state.network,
        keyword: state.keyword
    };
}

function buildHeaderSelect(value, options, onChange) {
    const sel = document.createElement('select');
    sel.className = 'header-inline-select';
    options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.text;
        if (String(opt.value) === String(value || '')) o.selected = true;
        sel.appendChild(o);
    });
    sel.addEventListener('change', (e) => onChange(e.target.value));
    return sel;
}

function buildHeaderNumberInput(value, placeholder, step, onChange) {
    const input = document.createElement('input');
    input.type = 'number';
    if (step) input.step = step;
    input.className = 'header-inline-input';
    input.value = value || '';
    input.placeholder = placeholder || '';
    input.addEventListener('change', (e) => onChange(e.target.value));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });
    return input;
}

// Renders the live, editable "All Movies Rated 4.5+" style sentence in
// place of the old static header text + the now-useless All/Movies/TV
// slider (that slider only ever hid/showed cards that were ALREADY all
// the same type, since discover results only ever came back as one type).
async function renderInteractiveHeader(state) {
    const sliderWrap = document.getElementById('trending-slider-filter');
    if (sliderWrap) sliderWrap.style.display = 'none';

    const header = document.getElementById('trending-header');
    header.innerHTML = '';
    const frag = document.createDocumentFragment();

    // GENRE token - always shown ("All" when no genre is active)
    const genreListType = state.type === 'tv' ? 'tv' : 'movie';
    const genres = await ensureInlineGenreList(genreListType);
    const genreOptions = [{ value: '', text: 'All' }, ...genres.map(g => ({ value: String(g.id), text: g.name }))];
    frag.appendChild(buildHeaderSelect(state.genre || '', genreOptions, (val) => {
        const opt = genreOptions.find(o => o.value === val);
        applyFilter({ ...stateToOverrides(state), genre: val, genreLabel: opt ? opt.text : '' });
    }));

    frag.appendChild(document.createTextNode(' '));

    // TYPE token - always shown. THIS is the dropdown that replaces the
    // broken Movies/TV Shows/All slider buttons.
    frag.appendChild(buildHeaderSelect(state.type, [
        { value: 'movie', text: 'Movies' },
        { value: 'tv', text: 'TV Shows' },
        { value: 'all', text: 'All' }
    ], (val) => {
        applyFilter({ ...stateToOverrides(state), type: val });
    }));

    // COUNTRY token - only shown if a country filter is active
    if (state.country) {
        frag.appendChild(document.createTextNode(' from '));
        const countries = await ensureInlineCountryList();
        const countryOptions = countries.map(c => ({ value: c.iso_3166_1, text: c.english_name }));
        frag.appendChild(buildHeaderSelect(state.country, countryOptions, (val) => {
            const opt = countryOptions.find(o => o.value === val);
            applyFilter({ ...stateToOverrides(state), country: val, countryLabel: opt ? opt.text : '' });
        }));
    }

    // LANGUAGE token - only shown if a language filter is active
    if (state.language) {
        frag.appendChild(document.createTextNode(' in '));
        const languages = await ensureInlineLanguageList();
        const langOptions = languages.map(l => ({ value: l.iso_639_1, text: l.english_name }));
        frag.appendChild(buildHeaderSelect(state.language, langOptions, (val) => {
            applyFilter({ ...stateToOverrides(state), language: val });
        }));
    }

    // YEAR token - only shown if a year filter is active, but editable on the go
    if (state.year) {
        frag.appendChild(document.createTextNode(' released in '));
        frag.appendChild(buildHeaderNumberInput(state.year, 'Year', null, (val) => {
            applyFilter({ ...stateToOverrides(state), year: val });
        }));
    }

    // RATING token - only shown if a rating filter is active, but editable on the go
    if (state.rating) {
        frag.appendChild(document.createTextNode(' Rated '));
        frag.appendChild(buildHeaderNumberInput(state.rating, 'Rating', '0.1', (val) => {
            applyFilter({ ...stateToOverrides(state), rating: val });
        }));
        frag.appendChild(document.createTextNode('+'));
    }

    header.appendChild(frag);
}

async function applyFilter(overrides = {}) {
    // 1. Get current settings from UI (overrides win, including explicit "" to clear a field)
    let type = typeof overrides.type !== 'undefined' ? overrides.type : (document.getElementById('filter-type').value || 'movie');

    // 2. Extract values (Prioritize overrides -> then DOM elements)
    // NOTE: using `typeof !== 'undefined'` instead of `||`/ternary-on-truthiness so that an
    // inline header control explicitly clearing a field (e.g. picking "All" genre, which is
    // value "") actually clears it instead of silently falling back to the modal's old value.
    let genre = typeof overrides.genre !== 'undefined' ? String(overrides.genre) : document.getElementById('filter-genre').value;
    const country = typeof overrides.country !== 'undefined' ? overrides.country : document.getElementById('filter-country').value;
    const language = typeof overrides.language !== 'undefined' ? overrides.language : document.getElementById('filter-language').value;
    const year = typeof overrides.year !== 'undefined' ? overrides.year : document.getElementById('filter-year').value;
    const rating = typeof overrides.rating !== 'undefined' ? overrides.rating : document.getElementById('filter-rating').value;
    const company = overrides.company;
    const network = overrides.network;
    const keyword = overrides.keyword;

    // --- HYBRID LOGIC START ---
    if (typeof overrides.query !== 'undefined') {
        currentSearchQuery = overrides.query;
    }
    const textSearch = currentSearchQuery; 
    // -------------------------

    // Auto-switch to TV if filtering by Network
    if (network) {
        type = 'tv';
    }

    // Keep the (hidden) Discover modal's Type select in sync so reopening
    // it reflects whatever the live header is currently showing.
    if (document.getElementById('filter-type')) document.getElementById('filter-type').value = type;

    // Get Adult Setting
    const adultToggle = document.getElementById('filter-adult');
    const includeAdult = adultToggle ? adultToggle.checked : false;
    localStorage.setItem('include_adult', includeAdult);

    // --- UI CLEANUP ---
    closeFilterModal();
    searchResults.innerHTML = '';
    
    if (!textSearch) searchInput.value = ''; 
    
    heroSection.style.display = 'none';
    document.getElementById('top10-section').style.display = 'none';
    document.getElementById('continue-watching-section').classList.add('hidden');

    // The old All/Movies/TV Shows slider only ever hid/showed cards that were
    // ALREADY all one type (since every filtered fetch only ever pulled one
    // type), making it useless here. Hide it whenever we're showing filtered
    // results; clearFilters() brings it back for the default mixed feed.
    const sliderWrap = document.getElementById('trending-slider-filter');
    if (sliderWrap) sliderWrap.style.display = 'none';

    let finalSort = document.getElementById('filter-sort') ? document.getElementById('filter-sort').value : 'popularity.desc';

    // ==========================================
    // HEADER GENERATION
    // ==========================================
    if (textSearch) {
        let headerStr = `Results for "${textSearch}"`;
        if (year) headerStr += ` (${year})`;
        document.getElementById('trending-header').innerHTML = headerStr;
        currentFilterState = null;
    } 
    else if (overrides.company || overrides.network) {
        document.getElementById('trending-header').innerHTML = activeFilterLabel ? `Titles from ${activeFilterLabel}` : "Production Search";
        currentFilterState = null;
    } 
    else if (overrides.keyword) {
        document.getElementById('trending-header').innerHTML = `Keyword: ${activeFilterLabel}`;
        currentFilterState = null;
    } 
    else {
        // This is the "Discover" style filter (genre/type/country/language/year/rating).
        // Build the canonical state object once and render it as a live, editable sentence -
        // e.g. "All Movies Rated 4.5+" where every token is its own control.
        const genreLabel = (overrides.genre && typeof overrides.genreLabel !== 'undefined')
            ? overrides.genreLabel
            : (overrides.genre && activeFilterLabel) ? activeFilterLabel : null;
        const countryLabel = (overrides.country && typeof overrides.countryLabel !== 'undefined')
            ? overrides.countryLabel
            : (overrides.country && activeFilterLabel) ? activeFilterLabel : null;

        currentFilterState = {
            type, genre, genreLabel, country, countryLabel, language, year, rating,
            sort: finalSort, company, network, keyword
        };

        await renderInteractiveHeader(currentFilterState);
    }

    // ==========================================
    // BUILD URL(S)
    // ==========================================
    let urlSpec; // string for search/company/keyword, or array of {url, mediaType} for discover/"All"

    if (textSearch) {
        // /search/multi covers "All" naturally; movie/tv stay on their dedicated endpoints.
        const searchType = type === 'all' ? 'multi' : type;
        urlSpec = `${BASE_TMDB_URL}/search/${searchType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(textSearch)}&include_adult=${includeAdult}`;
        if (year) {
            if (type === 'movie') urlSpec += `&primary_release_year=${year}`;
            else if (type === 'tv') urlSpec += `&first_air_date_year=${year}`;
        }
        if (language) urlSpec += `&language=${language}`;
    } else if (overrides.company || overrides.network || overrides.keyword) {
        // Production/network/keyword browsing stays single-type (defaults to movie if "All" was left selected).
        const concreteType = type === 'all' ? 'movie' : type;
        urlSpec = buildDiscoverUrlForType(concreteType, { genre, country, language, year, rating, sort: finalSort, company, network, keyword, includeAdult });
    } else {
        // Main Discover branch - this is the one that supports "All" by querying
        // /discover/movie and /discover/tv in parallel and merging the results.
        const concreteTypes = type === 'all' ? ['movie', 'tv'] : [type];
        urlSpec = concreteTypes.map(ct => ({
            url: buildDiscoverUrlForType(ct, { genre, country, language, year, rating, sort: finalSort, company, network, keyword, includeAdult }),
            mediaType: ct
        }));
    }

    currentFetchUrl = urlSpec;

    // ==========================================
    // FETCH & RENDER
    // ==========================================
    trendingContainer.innerHTML = '';
    renderSkeletons(trendingContainer, 10);
    loadedIds.clear();
    trendingPage = 1;

    try {
        const results = await fetchFilterPage(currentFetchUrl, 1);

        trendingContainer.innerHTML = '';

        if (results.length === 0) {
            trendingContainer.innerHTML = '<div class="text-gray-400 p-4">No results found matching your criteria.</div>';
            currentFetchUrl = "STOP";
        } else {
            renderCards(results, trendingContainer, true);
            trendingPage = 2;
            // Re-attach the sentinel so the IntersectionObserver picks up
            // subsequent pages exactly like the home trending feed does.
            attachTrendingObserver();
        }
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.getElementById('trending-header').scrollIntoView({ behavior: 'smooth' });
            });
        });
    } catch (e) {
        console.error("Filter Error:", e);
        trendingContainer.innerHTML = '<div class="text-red-500 p-4">Error loading results.</div>';
    }
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('install-app-btn');
    if (btn) btn.style.display = 'block';
});

window.installPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
        document.getElementById('install-app-btn').style.display = 'none';
    }
    deferredPrompt = null;
}

window.openTrailerModal = async function() {
    if (!TMDB_ID) return;
    trailerModal.classList.remove('hidden');
    trailerIframe.src = '';
    const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
    try {
        const data = await fetchCached(`${BASE_TMDB_URL}/${endpoint}/${TMDB_ID}/videos?api_key=${TMDB_API_KEY}`);
        const trailer = data.results.find(v => v.site === 'YouTube' && v.type === 'Trailer') || data.results.find(v => v.site === 'YouTube');
        if (trailer) {
            trailerIframe.src = `https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&origin=${window.location.origin}&enablejsapi=1&rel=0`;
        } else {
            trailerIframe.src = '';
            showMessage("No trailer available.", true);
            setTimeout(closeTrailerModal, 2000);
        }
    } catch (e) { showMessage("Error loading trailer.", true); }
}
window.closeTrailerModal = () => {
    trailerModal.classList.add('hidden');
    trailerIframe.src = '';
};

window.selectContent = async function(id, title, type) {
    TMDB_ID = id;
    mediaType = type;
    
    currentTitle = title;
    document.title = `${title} - Chithruka`;

    const newUrl = `?id=${id}&type=${type}`;
    window.history.pushState({ id, type, title }, '', newUrl);

    // --- RESET UI ---
    searchResults.innerHTML = '';
    searchInput.value = '';
    heroSection.style.display = 'none';
    document.getElementById('top10-section').style.display = 'none';
    
    const trailerSection = document.getElementById('trailers-section');
    if(trailerSection) trailerSection.style.display = 'none';

    document.getElementById('continue-watching-section').classList.add('hidden');

       playerInterface.classList.add('hidden');
    detailsSection.classList.add('hidden');
    collectionSection.classList.add('hidden');
    
    const playerIframe = document.getElementById('player-iframe');
    if (playerIframe) {
        playerIframe.src = "about:blank";
    }
    // --- FIX: Explicitly Clear Title, Logo AND Tagline ---
    const logoImg = document.getElementById('detail-logo');
    const textHeading = document.getElementById('detail-heading');
    const taglineEl = document.getElementById('detail-tagline');
    
    if (logoImg) {
        logoImg.src = ''; 
        logoImg.style.display = 'none';
    }
    if (textHeading) {
        textHeading.textContent = ''; 
        textHeading.style.display = 'none';
    }
    if (taglineEl) {
        taglineEl.textContent = ''; // Clear tagline text
        taglineEl.classList.add('hidden'); // Hide it
    }

    // --- RESET SOUNDTRACK ---
    const sSection = document.getElementById('soundtrack-section');
    const sContainer = document.getElementById('soundtrack-embed-container');
    if (sSection) sSection.classList.add('hidden');
    if (sContainer) sContainer.innerHTML = '';

    // --- RESET HERO TRAILER ---
    destroyHeroTrailer();
    const heroBackdrop = document.getElementById('detail-backdrop');
    if (heroBackdrop) { heroBackdrop.style.opacity = '0'; heroBackdrop.classList.remove('kenburns'); }
    const heroPosterPin = document.querySelector('.detail-hero-poster-pin');
    if (heroPosterPin) heroPosterPin.classList.remove('visible');

    const posterImg = document.getElementById('detail-poster');
    posterImg.src = '';
    posterImg.style.display = 'block';
    posterImg.classList.add('skeleton');

    posterImg.onload = null;
    posterImg.onerror = null;

    checkAccountStates(id, type);

    // --- LOAD CONTENT ---
    if (mediaType === 'tv') await fetchShowDetails(id, title);
    else await fetchMovieDetails(id, title);

    // Defer reviews, recommendations & soundtrack until the user scrolls near them.
    setupDeferredSections(id, currentTitle);

    // Scroll after fetch+render is complete and browser has laid out the section.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            detailsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

// ==========================================
// DEFERRED SECTION LOADING
// ==========================================
// Reviews, Recommendations and Soundtrack are fetched only when the user
// scrolls near them — saving multiple API calls on every content open.

let deferredSectionObserver = null;

function setupDeferredSections(id, title) {
    // Disconnect previous observer so we never double-fire
    if (deferredSectionObserver) {
        deferredSectionObserver.disconnect();
        deferredSectionObserver = null;
    }

    // Reset reviews list immediately (clear stale content from the previous title)
    loadReviews(id, mediaType, true /* reset */);

    const recsSection    = document.getElementById('recommendations-section');
    const soundSection   = document.getElementById('soundtrack-section');
    const reviewsSection = document.getElementById('reviews-section');

    const pending = new Set(['recs', 'sound', 'reviews']);

    deferredSectionObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const key = entry.target.dataset.deferred;
                if (!pending.has(key)) return;
                pending.delete(key);

                if      (key === 'recs')    loadRecommendations(mediaType, id);
                else if (key === 'sound')   loadSoundtrack(title);
                else if (key === 'reviews') loadReviews(id, mediaType);

                deferredSectionObserver.unobserve(entry.target);
            });
        },
        { rootMargin: '400px 0px' }
    );

    if (recsSection)    { recsSection.dataset.deferred    = 'recs';    deferredSectionObserver.observe(recsSection); }
    if (soundSection)   { soundSection.dataset.deferred   = 'sound';   deferredSectionObserver.observe(soundSection); }
    if (reviewsSection) { reviewsSection.dataset.deferred = 'reviews'; deferredSectionObserver.observe(reviewsSection); }
}

async function fetchMovieDetails(id, title) {
    tvControls.classList.add('hidden');
    try {
        // Updated URL includes: similar, translations
        const detailData = await fetchCached(`${BASE_TMDB_URL}/movie/${id}?api_key=${TMDB_API_KEY}&append_to_response=images,external_ids,credits,release_dates,alternative_titles,keywords,videos,similar,translations`);
        
        if (detailData.external_ids) IMDB_ID = detailData.external_ids.imdb_id;

        if (detailData.title) {
            currentTitle = detailData.title;
            document.title = `${currentTitle} - Chithruka`;
        }
        
        renderDetails(detailData, currentTitle);
        
        renderGallery(detailData);

        if (detailData.belongs_to_collection) {
            loadCollection(detailData.belongs_to_collection.id, detailData.belongs_to_collection.name);
        }

        playerInterface.classList.remove('hidden');
        await ensureLocalVideos();
        updatePlayer();
    } catch (e) { 
        showMessage("Failed to load details.", true); 
        console.error(e); 
    }
}

async function fetchShowDetails(id, title) {
    try {
        // Updated URL includes: aggregate_credits (vital for full TV cast), similar, translations
        const data = await fetchCached(`${BASE_TMDB_URL}/tv/${id}?api_key=${TMDB_API_KEY}&append_to_response=images,credits,aggregate_credits,content_ratings,alternative_titles,external_ids,keywords,videos,similar,translations`);
        
        if (data.external_ids) IMDB_ID = data.external_ids.imdb_id;

        if (data.name) {
            currentTitle = data.name;
            document.title = `${currentTitle} - Chithruka`;
        }
        
        renderDetails(data, currentTitle);
        
        renderGallery(data);

        episodeData = data.seasons.filter(s => s.season_number > 0 && s.episode_count > 0)
            .map(s => ({
                season: s.season_number,
                episodes: s.episode_count,
                title: s.name,
                air_date: s.air_date
            }));

        if (!episodeData.length) { showMessage("No episodes available.", true); return; }

        const seasonSelect = document.getElementById('season-select');
        seasonSelect.innerHTML = '';

        if (episodeData.length > 0) {
            updateSeasonStatusUI(episodeData[0].air_date);
        }

        episodeData.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.season;
            const dateStr = s.air_date ? ` (${s.air_date.substring(0, 4)})` : '';
            opt.textContent = `${s.title} (${s.episodes} Episodes)${dateStr}`;
            seasonSelect.appendChild(opt);
        });

        currentSeason = episodeData[0].season;
        currentEpisode = 1;
        tvControls.classList.remove('hidden');
        playerInterface.classList.remove('hidden');

        await fetchSeasonDetails(id, currentSeason);
        await ensureLocalVideos();
        updatePlayer();
    } catch (e) { 
        showMessage("Failed to load show details.", true); 
        console.error(e); 
    }
}

async function loadCollection(collectionId, collectionName) {
    // --- URL & Title ---
    document.title = `${collectionName} - Chithruka`;
    window.history.pushState(
        { id: collectionId, type: 'collection', name: collectionName },
        '',
        `?id=${collectionId}&type=collection&name=${encodeURIComponent(collectionName)}`
    );

    try {
        const data = await fetchCached(`${BASE_TMDB_URL}/collection/${collectionId}?api_key=${TMDB_API_KEY}`);
        const parts = data.parts.map(p => ({ ...p, media_type: 'movie' }));

        parts.sort((a, b) => new Date(a.release_date) - new Date(b.release_date));

        if (parts.length > 0) {
            collectionContainer.innerHTML = '';
            document.getElementById('collection-header').innerHTML = `${data.name}`;
            collectionSection.classList.remove('hidden');
            renderCards(parts, collectionContainer, false);
        }
    } catch (e) { 
        console.error("Collection Load Error", e); 
    }
}

window.changeSeason = async function(seasonVal, episodeVal = 1) {
    currentSeason = parseInt(seasonVal);
    currentEpisode = parseInt(episodeVal); // Now respects the passed episode

    const selectedSeasonData = episodeData.find(s => s.season === currentSeason);
    if (selectedSeasonData) {
        updateSeasonStatusUI(selectedSeasonData.air_date);
    }

    episodeAccordionContent.innerHTML = '<div class="text-center p-4 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>Loading Season...</div>';
    
    // Auto-open accordion so user can see the episodes loading
    if (!accordionOpen) toggleAccordion();

    await fetchSeasonDetails(TMDB_ID, currentSeason);
    updatePlayer();
}


async function fetchSeasonDetails(tvId, seasonNum) {
    try {
        const data = await fetchCached(`${BASE_TMDB_URL}/tv/${tvId}/season/${seasonNum}?api_key=${TMDB_API_KEY}`);
        seasonEpisodes = data.episodes;
        renderEpisodesRich();
    } catch (e) { console.error("Season fetch failed", e); }
}

function renderEpisodesRich() {
    // 1. Determine the Total Number of Seasons (to check for Series Finale)
    // We look at the global 'episodeData' array which contains all season info
    const lastAvailableSeason = episodeData.length > 0 
        ? Math.max(...episodeData.map(s => s.season)) 
        : 0;

    // 2. Generate the Card HTML
    let episodesHtml = '';
    
    seasonEpisodes.forEach((ep, index) => {
        const still = ep.still_path ? `${TMDB_STILL_SZ}${ep.still_path}` : 'https://placehold.co/120x68/333/999?text=No+Img';
        const isActive = (ep.episode_number === currentEpisode);

        const rating = ep.vote_average ? Math.round(ep.vote_average * 10) + "%" : "NR";
        const date = formatDate(ep.air_date);
        const runtime = formatRuntime(ep.runtime);

        // --- NEW: Episode Type Logic ---
        let typeBadge = '';
        const isLastEpisode = index === seasonEpisodes.length - 1; // Is this the last one in the list?

        // Logic Check
        if (currentSeason === lastAvailableSeason && isLastEpisode) {
            // Last episode of the last season = Series Finale
            typeBadge = `<span class="ml-2 px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded border border-yellow-500/50 text-yellow-500 bg-yellow-500/10">Series Finale</span>`;
        } else if (isLastEpisode) {
            // Last episode of any other season = Season Finale
            typeBadge = `<span class="ml-2 px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded border border-blue-400/50 text-blue-400 bg-blue-400/10">Season Finale</span>`;
        } else if (ep.episode_number === 1) {
            // First episode = Premiere
            typeBadge = `<span class="ml-2 px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded border border-green-400/50 text-green-400 bg-green-400/10">Premiere</span>`;
        }
        // -------------------------------

        const metaString = `
            <span class="text-yellow-500"><i class="fas fa-star text-[10px]"></i> ${rating}</span>
            <span class="text-gray-600">|</span>
            <span>${date}</span>
            ${runtime ? `<span class="text-gray-600">|</span> <span class="text-gray-300"><i class="far fa-clock text-[10px] mr-1"></i>${runtime}</span>` : ''}
        `;

        episodesHtml += `
<div class="episode-rich-item ${isActive ? 'active' : ''}" data-episode="${ep.episode_number}" onclick="selectEpisode(${ep.season_number}, ${ep.episode_number}, this)">
                <img src="${still}" class="ep-still" loading="lazy">
                <div class="ep-info">
                    <div class="flex items-center mb-1">
                        <div class="ep-title">${ep.episode_number}. ${ep.name}</div>
                        ${typeBadge} </div>
                    <div class="ep-meta">${metaString}</div>
                    <div class="ep-overview">${ep.overview || 'No overview available.'}</div>
                </div>
            </div>`;
    });

    // 3. Inject Wrapper + Buttons + List into the Accordion Content
    episodeAccordionContent.innerHTML = `
        <div class="relative group px-2">
            <button class="scroll-btn left-0 -ml-2 z-10 hidden" id="ep-btn-left" onclick="scrollContainer('episodes-scroll-list', -300)">
                <i class="fas fa-chevron-left"></i>
            </button>
            
            <div id="episodes-scroll-list">
                ${episodesHtml}
            </div>

            <button class="scroll-btn right-0 -mr-2 z-10" id="ep-btn-right" onclick="scrollContainer('episodes-scroll-list', 300)">
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>
    `;

    // 4. Attach Scroll Listener
    const scrollContainerEl = document.getElementById('episodes-scroll-list');
    if (scrollContainerEl) {
        updateScrollButtons(scrollContainerEl);
        scrollContainerEl.addEventListener('scroll', () => updateScrollButtons(scrollContainerEl));
    }

    // 5. Update Height if already open
    if (accordionOpen) {
        episodeAccordionContent.style.maxHeight = episodeAccordionContent.scrollHeight + "px";
        
        // Auto-scroll to active episode
        setTimeout(() => {
            const activeEp = scrollContainerEl.querySelector('.active');
            if (activeEp) {
                activeEp.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }, 300);
    }

    // 6. Sync status badge with the currently selected episode immediately
    const currentEpData = seasonEpisodes.find(ep => ep.episode_number === currentEpisode);
    if (currentEpData) {
        updateSeasonStatusUI(currentEpData.air_date);
    }
}

// ============================================================
// ============================================================
// ============================================================
// CINEMATIC HERO — Netflix-style Background Trailer
// ============================================================

let ytApiLoaded = false;
let heroPlayer = null;
let heroTrailerTimeout = null;

// Dynamically load the YouTube Iframe API script (once)
function loadYouTubeAPI() {
    if (ytApiLoaded) return Promise.resolve();
    return new Promise((resolve) => {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        window.onYouTubeIframeAPIReady = () => {
            ytApiLoaded = true;
            resolve();
        };
    });
}

// ── PUBLIC: launch the hero ───────────────────────────────────
async function launchHeroTrailer(backdropPath, youtubeKey) {
    destroyHeroTrailer();

    const heroWrapper  = document.getElementById('detail-hero');
    const backdropEl   = document.getElementById('detail-backdrop');
    const trailerLayer = document.getElementById('detail-hero-trailer');
    const muteBtn      = document.getElementById('hero-mute-btn');
    const posterPin    = document.querySelector('.detail-hero-poster-pin');

    if (!backdropPath) {
        if (heroWrapper) heroWrapper.classList.add('no-backdrop');
        if (posterPin) setTimeout(() => posterPin.classList.add('visible'), 200);
        return;
    }

    // 1. Show the Ken Burns backdrop immediately
    backdropEl.style.backgroundImage = `url('https://image.tmdb.org/t/p/original${backdropPath}')`;
    backdropEl.style.opacity = '1';
    backdropEl.classList.add('kenburns');
    if (posterPin) setTimeout(() => posterPin.classList.add('visible'), 300);

    // 2. If we have a trailer, delay 2s (Netflix style) then load the video
    if (youtubeKey) {
        heroTrailerTimeout = setTimeout(async () => {
            await loadYouTubeAPI();

            // Inject a fresh div for the API to target
            trailerLayer.innerHTML = '<div id="yt-player-container"></div>';

            heroPlayer = new YT.Player('yt-player-container', {
                videoId: youtubeKey,
                playerVars: {
                    autoplay: 1,
                    controls: 0,
                    disablekb: 1,
                    fs: 0,
                    modestbranding: 1,
                    rel: 0,
                    showinfo: 0,
                    mute: 1,        // Must start muted to guarantee autoplay
                    loop: 1,
                    playlist: youtubeKey, // Required for loop to work
                    origin: window.location.origin, // Authorizes live domain for postMessage API control
                    playsinline: 1  // Prevents Safari/iOS blocking autoplay or forcing fullscreen
                },
                events: {
                    onReady: (event) => {
                        event.target.playVideo();
                    },
                    onStateChange: (event) => {
                        // Once playing, crossfade video in and backdrop out
                        if (event.data === YT.PlayerState.PLAYING) {
                            trailerLayer.classList.add('visible');
                            backdropEl.style.opacity = '0';

                            // Show play/pause toggle
                            let isHeroPaused = false;
                            muteBtn.classList.remove('hidden');
                            muteBtn.innerHTML = '<i class="fas fa-pause"></i>';

                            muteBtn.onclick = () => {
                                if (isHeroPaused) {
                                    heroPlayer.playVideo();
                                    muteBtn.innerHTML = '<i class="fas fa-pause"></i>';
                                } else {
                                    heroPlayer.pauseVideo();
                                    muteBtn.innerHTML = '<i class="fas fa-play" style="margin-left:2px"></i>';
                                }
                                isHeroPaused = !isHeroPaused;
                            };
                        }
                    }
                }
            });
        }, 2000); // 2-second Netflix-style delay before trailer starts
    }
}

// ── Cleanup ──────────────────────────────────────────────────
function destroyHeroTrailer() {
    clearTimeout(heroTrailerTimeout);

    const heroWrapper  = document.getElementById('detail-hero');
    const backdropEl   = document.getElementById('detail-backdrop');
    const trailerLayer = document.getElementById('detail-hero-trailer');
    const posterPin    = document.querySelector('.detail-hero-poster-pin');
    const muteBtn      = document.getElementById('hero-mute-btn');

    if (heroWrapper) heroWrapper.classList.remove('no-backdrop');
    if (posterPin) posterPin.classList.remove('visible');

    if (backdropEl) {
        backdropEl.style.backgroundImage = '';
        backdropEl.style.opacity = '0';
        backdropEl.classList.remove('kenburns');
    }

    if (trailerLayer) {
        trailerLayer.classList.remove('visible');
        trailerLayer.innerHTML = '';
    }
    if (heroPlayer) {
        try { heroPlayer.destroy(); } catch(e) {}
        heroPlayer = null;
    }

    if (muteBtn) {
        muteBtn.classList.add('hidden');
        muteBtn.onclick = null;
    }
}
// ============================================================

function renderDetails(data, title) {
    // ============================================================
    // 1. DATA PREPARATION & AI CONTEXT
    // ============================================================
    const dateVal = data.release_date || data.first_air_date;
    const year = dateVal ? new Date(dateVal).getFullYear() : "N/A";
    
    // Determine Age Rating (US Standard)
    let ageRating = "Not Rated";
    if (mediaType === 'movie' && data.release_dates?.results) {
        const us = data.release_dates.results.find(r => r.iso_3166_1 === 'US');
        if (us?.release_dates) {
            const cert = us.release_dates.find(d => d.certification);
            if (cert?.certification) ageRating = cert.certification;
        }
    } else if (mediaType === 'tv' && data.content_ratings?.results) {
        const us = data.content_ratings.results.find(r => r.iso_3166_1 === 'US');
        if (us?.rating) ageRating = us.rating;
    }

    // Build Context Object for AI
    const aiContext = {
        title: data.title || data.name,
        original_title: data.original_title || data.original_name,
        type: mediaType,
        year: year,
        release_date: dateVal,
        age_rating: ageRating,
        status: data.status,
        tagline: data.tagline,
        overview: data.overview,
        genres: (data.genres || []).map(g => g.name),
        rating: data.vote_average,
        vote_count: data.vote_count,
        popularity: data.popularity,
        budget: data.budget ? `$${data.budget.toLocaleString()}` : "N/A",
        revenue: data.revenue ? `$${data.revenue.toLocaleString()}` : "N/A",
        runtime: data.runtime || (data.episode_run_time ? data.episode_run_time[0] : "N/A"),
        languages: (data.spoken_languages || []).map(l => l.english_name),
        production_companies: (data.production_companies || []).map(c => c.name),
        origin_countries: (data.production_countries || []).map(c => c.name),
        cast: (data.credits?.cast || []).slice(0, 10).map(c => `${c.name} (${c.character})`),
        director: (data.credits?.crew || []).filter(c => c.job === 'Director').map(c => c.name),
        creators: (data.created_by || []).map(c => c.name)
    };
    
    currentMovieData = aiContext;
    currentTitle = aiContext.title;

    // ============================================================
    // 2. VISUAL SETUP (Background & Colors)
    // ============================================================
    if (data.backdrop_path) pageBackground.style.backgroundImage = `url('${TMDB_BACKDROP_WEB}${data.backdrop_path}')`;
    else pageBackground.style.backgroundImage = 'none';

    const posterUrl = data.poster_path ? `${TMDB_POSTER_MD}${data.poster_path}` : null;
    if (posterUrl) {
        getDominantColor(posterUrl).then(rgb => {
            document.documentElement.style.setProperty('--ambient-color', rgb);
        });
    } else {
        document.documentElement.style.setProperty('--ambient-color', '0, 0, 0');
    }

    detailsSection.classList.remove('hidden');

    // ============================================================
    // 3. HEADER INFO (Logo, Title, Tagline, Socials)
    // ============================================================
    const logoImg = document.getElementById('detail-logo');
    const textHeading = document.getElementById('detail-heading');

    // Logic: Prefer graphical logo, fallback to text title
    let logoPath = null;
    if (data.images && data.images.logos && data.images.logos.length > 0) {
        const englishLogo = data.images.logos.find(l => l.iso_639_1 === 'en');
        const bestLogo = englishLogo || data.images.logos[0];
        if (bestLogo) logoPath = bestLogo.file_path;
    }
    if (logoPath) {
        logoImg.src = `${TMDB_POSTER_XL}${logoPath}`;
        logoImg.style.display = 'block';
        textHeading.style.display = 'none';
    } else {
        logoImg.style.display = 'none';
        textHeading.style.display = 'block';
        textHeading.textContent = title;
    }

    // Tagline
    const taglineEl = document.getElementById('detail-tagline');
    if (data.tagline) {
        taglineEl.textContent = `"${data.tagline}"`;
        taglineEl.classList.remove('hidden');
    } else {
        taglineEl.classList.add('hidden');
    }

    // Social Media Links
    const existingSocials = document.getElementById('detail-socials');
    if (existingSocials) existingSocials.remove();

    const socialContainer = document.createElement('div');
    socialContainer.id = 'detail-socials';
    socialContainer.className = "flex items-center gap-4 mt-3 mb-5"; 
    
    let socialHtml = '';
    // Official Homepage
    if (data.homepage) {
        socialHtml += `<a href="${data.homepage}" target="_blank" title="Official Website" class="social-link-btn"><i class="fas fa-link"></i></a>`;
    }
    // Social Networks
    if (data.external_ids) {
        const ids = data.external_ids;
        if (ids.imdb_id) socialHtml += `<a href="https://www.imdb.com/title/${ids.imdb_id}" target="_blank" title="IMDb" class="social-link-btn imdb"><i class="fab fa-imdb text-2xl"></i></a>`;
        if (ids.wikidata_id) socialHtml += `<a href="https://www.wikidata.org/wiki/Special:GoToLinkedPage/enwiki/${ids.wikidata_id}" target="_blank" title="Wikipedia" class="social-link-btn wikipedia"><i class="fab fa-wikipedia-w"></i></a>`;
        if (ids.facebook_id) socialHtml += `<a href="https://facebook.com/${ids.facebook_id}" target="_blank" title="Facebook" class="social-link-btn facebook"><i class="fab fa-facebook"></i></a>`;
        if (ids.instagram_id) socialHtml += `<a href="https://instagram.com/${ids.instagram_id}" target="_blank" title="Instagram" class="social-link-btn instagram"><i class="fab fa-instagram"></i></a>`;
        if (ids.twitter_id) socialHtml += `<a href="https://twitter.com/${ids.twitter_id}" target="_blank" title="X (Twitter)" class="social-link-btn twitter"><i class="fab fa-x-twitter"></i></a>`;
    }

    if (socialHtml) {
        socialContainer.innerHTML = socialHtml;
        taglineEl.parentNode.insertBefore(socialContainer, taglineEl.nextSibling);
    }

    // ============================================================
    // 4. METADATA (Status, Country, Rating, Runtime)
    // ============================================================
    
    // Status
    const statusEl = document.getElementById('detail-status');
    if (data.status) {
        statusEl.querySelector('span').textContent = data.status;
        statusEl.classList.remove('hidden');
    } else {
        statusEl.classList.add('hidden');
    }

    // TV Series Specific Stats (Seasons/Episodes)
    const existingCount = document.getElementById('detail-tv-stats');
    if (existingCount) existingCount.remove();

    if (data.number_of_seasons) {
        const countSpan = document.createElement('span');
        countSpan.id = 'detail-tv-stats';
        countSpan.className = "flex items-center text-gray-300 font-semibold";
        countSpan.innerHTML = `<i class="fas fa-layer-group mr-2 text-gray-400"></i> ${data.number_of_seasons} Seasons • ${data.number_of_episodes} Episodes`;
        statusEl.parentElement.insertBefore(countSpan, statusEl);
    }

    // Production Country
    const countryEl = document.getElementById('detail-country');
    if (data.production_countries && data.production_countries.length > 0) {
        const code = data.production_countries[0].iso_3166_1;
        let fullName = code;
        try {
            const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
            fullName = regionNames.of(code);
        } catch (e) { }

        const span = countryEl.querySelector('span');
        span.textContent = code;
        countryEl.title = fullName;
        countryEl.onclick = () => quickFilter('country', code, fullName);
        countryEl.classList.remove('hidden');
    } else {
        countryEl.classList.add('hidden');
    }

    // Year & Rating
    const dateEl = document.getElementById('detail-date');
    const dateSpan = dateEl.querySelector('span');
    dateSpan.textContent = year;
    if (year !== "N/A") dateEl.onclick = () => quickFilter('year', year, year);

    const ratingEl = document.getElementById('detail-rating');
    const ratingSpan = ratingEl.querySelector('span');
    const ratingVal = data.vote_average ? data.vote_average.toFixed(1) : "N/A";
    ratingSpan.textContent = ratingVal;
    if (ratingVal !== "N/A") ratingEl.onclick = () => quickFilter('rating', data.vote_average);

    // Runtime
    let runtime = data.runtime || (data.episode_run_time ? data.episode_run_time[0] : 0);
    document.getElementById('detail-runtime').querySelector('span').textContent = runtime ? `${Math.floor(runtime / 60)}h ${runtime % 60}m` : "N/A";

    // --- NEW: Adult Content Badge Logic ---
    const adultEl = document.getElementById('detail-adult');
    if (adultEl) {
        if (data.adult === true) {
            adultEl.classList.remove('hidden');
            adultEl.classList.add('flex'); // Add flex so the icon and text align properly
        } else {
            adultEl.classList.add('hidden');
            adultEl.classList.remove('flex');
        }
    }

    // Age Rating Badge
    const ageEl = document.getElementById('detail-age');
    if (ageRating !== "Not Rated") {
        ageEl.querySelector('span').textContent = ageRating;
        ageEl.classList.remove('hidden');
    } else {
        ageEl.classList.add('hidden');
    }

    // Overview Text
    document.getElementById('detail-overview').textContent = data.overview || "No description available.";

    // Poster Image (in hero pin overlay)
    const posterImg = document.getElementById('detail-poster');
    if (data.poster_path) {
        posterImg.src = `${TMDB_POSTER_LG}${data.poster_path}`;
        posterImg.style.display = 'block';
        posterImg.onload = () => { posterImg.classList.remove('skeleton'); };
        posterImg.onerror = () => { posterImg.style.display = 'none'; posterImg.classList.remove('skeleton'); };
    } else {
        posterImg.style.display = 'none';
        posterImg.classList.remove('skeleton');
    }

    // ============================================================
    // 5. TAGS & KEYWORDS
    // ============================================================
    
    // Genres
    const genreContainer = document.getElementById('detail-genres');
    genreContainer.innerHTML = '';
    (data.genres || []).forEach(g => {
        const tag = document.createElement('span');
        tag.className = 'px-3 py-1 bg-white/10 text-gray-200 text-xs rounded-full border border-white/10 cursor-pointer hover:bg-white/20 transition';
        tag.textContent = g.name;
        tag.onclick = () => quickFilter('genre', g.id, g.name);
        genreContainer.appendChild(tag);
    });

    // Keywords / Story Tags
    const existingTags = document.getElementById('detail-keywords');
    if (existingTags) existingTags.remove();

    const keywords = data.keywords ? (data.keywords.keywords || data.keywords.results || []) : [];

    if (keywords.length > 0) {
        const keywordContainer = document.createElement('div');
        keywordContainer.id = 'detail-keywords';
        keywordContainer.className = "flex flex-wrap gap-2 mb-6 mt-2";
        
        keywords.slice(0, 15).forEach(k => {
            const span = document.createElement('span');
            span.className = "keyword-tag";
            span.innerHTML = `<i class="fas fa-hashtag text-[10px] text-gray-500 mr-1"></i>${k.name}`;
            // --- FIX APPLIED HERE: Use quickFilter instead of search ---
            span.onclick = () => {
                quickFilter('keyword', k.id, k.name);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
            keywordContainer.appendChild(span);
        });
        genreContainer.parentNode.insertBefore(keywordContainer, genreContainer.nextSibling);
    }

    const interactBar = document.getElementById('interaction-bar');
    if (!document.getElementById('btn-ai-intel')) {
        const aiBtn = document.createElement('div');
        aiBtn.id = 'btn-ai-intel';
        aiBtn.className = 'interact-btn cursor-pointer hover:bg-white/10 transition-all duration-200';
        aiBtn.title = "Ask AI Intel";
        aiBtn.innerHTML = '<i class="fa-solid fa-user-astronaut"></i>';
        aiBtn.onclick = openAIInsight;
        interactBar.prepend(aiBtn); 
    }

    // ============================================================
    // 6. CAST SECTION
    // ============================================================
    const castContainer = document.getElementById('cast-container');
    const castList = document.getElementById('cast-list');
    castList.innerHTML = '';
    
    let displayCast = [];

    if (data.aggregate_credits && data.aggregate_credits.cast && data.aggregate_credits.cast.length > 0) {
        displayCast = data.aggregate_credits.cast.map(c => ({
            ...c,
            character: c.roles ? c.roles.map(r => r.character).join(' / ') : (c.character || "")
        }));
    } else if (data.credits && data.credits.cast) {
        displayCast = data.credits.cast;
    }
    
    if (displayCast.length > 50) displayCast = displayCast.slice(0, 50);

    if (displayCast.length > 0) {
        castContainer.classList.remove('hidden');
        displayCast.forEach(c => {
            const picHtml = getPersonFace(c.profile_path, c.gender, "cast-img");
            const castDiv = document.createElement('div');
            castDiv.className = 'cast-card';
            
            const charName = (c.character && c.character.length > 30) ? c.character.substring(0, 30) + "..." : (c.character || "");

            castDiv.innerHTML = `
                    ${picHtml}
                    <div class="cast-name">${c.name}</div>
                    <div class="cast-char" title="${c.character || ''}">${charName}</div>
                `;
            castDiv.onclick = () => loadActorCredits(c.id, c.name, c.profile_path, c.gender);
            castList.appendChild(castDiv);
        });
        
        updateScrollButtons(castList);
        castList.addEventListener('scroll', () => updateScrollButtons(castList));

    } else {
        castContainer.classList.add('hidden');
    }
    
    // ============================================================
    // 7. CREW SECTION
    // ============================================================
    const crewContainer = document.getElementById('crew-container');
    const crewList = document.getElementById('crew-list');
    crewList.innerHTML = '';

    if (data.credits && data.credits.crew) {
        const uniqueCrew = [];
        const crewMap = new Map();
        data.credits.crew.forEach(c => {
            if (!crewMap.has(c.id)) {
                crewMap.set(c.id, true);
                uniqueCrew.push(c);
            }
        });

        if (uniqueCrew.length > 0) {
            crewContainer.classList.remove('hidden');
            uniqueCrew.forEach(c => {
                 const picHtml = getPersonFace(c.profile_path, c.gender, "cast-img");
                 const crewDiv = document.createElement('div');
                 crewDiv.className = 'cast-card';
                 crewDiv.innerHTML = `
                    ${picHtml}
                    <div class="cast-name">${c.name}</div>
                    <div class="crew-job">${c.job}</div>
                 `;
                 crewDiv.onclick = () => loadActorCredits(c.id, c.name, c.profile_path, c.gender);
                 crewList.appendChild(crewDiv);
            });
            
            updateScrollButtons(crewList);
            crewList.addEventListener('scroll', () => updateScrollButtons(crewList));

        } else {
            crewContainer.classList.add('hidden');
        }
    } else {
        crewContainer.classList.add('hidden');
    }

    // ============================================================
    // 8. GALLERY SECTION
    // ============================================================
    const galleryContainer = document.getElementById('gallery-container');
    const galleryList = document.getElementById('gallery-list');
    
    if (galleryContainer && galleryList) {
        galleryList.innerHTML = '';
        const images = (data.images && data.images.backdrops && data.images.backdrops.length > 0) 
            ? data.images.backdrops 
            : (data.images.posters || []);

        if (images.length > 0) {
            galleryContainer.classList.remove('hidden');
            
            images.slice(0, 15).forEach(img => {
                const imgUrl = `${TMDB_POSTER_MD}${img.file_path}`;
                const fullUrl = `${TMDB_BACKDROP_WEB}${img.file_path}`;
                
                const div = document.createElement('div');
                div.className = "gallery-item group relative flex-shrink-0 cursor-pointer w-48 md:w-64";
                
                div.innerHTML = `
                    <img src="${imgUrl}" loading="lazy" alt="Gallery Image">
                    <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <i class="fas fa-expand-alt text-white text-xl"></i>
                    </div>
                `;
                
                div.onclick = () => openLightbox(fullUrl, "Image");
                galleryList.appendChild(div);
            });
            updateScrollButtons(galleryList);
            galleryList.addEventListener('scroll', () => updateScrollButtons(galleryList));
        } else {
            galleryContainer.classList.add('hidden');
        }
    }

    // ============================================================
    // 9. VIDEOS SECTION + HERO TRAILER LAUNCH
    // ============================================================
    const videoContainer = document.getElementById('videos-container');
    const videoList = document.getElementById('videos-list');

    if (videoContainer && videoList) {
        videoList.innerHTML = '';
        
        const videos = (data.videos && data.videos.results) 
            ? data.videos.results.filter(v => v.site === "YouTube" || v.site === "Vimeo") 
            : [];

        // ── Launch the cinematic hero trailer ──
        const trailerVideo = videos.find(v => v.site === 'YouTube' && v.type === 'Trailer')
                          || videos.find(v => v.site === 'YouTube' && v.type === 'Teaser')
                          || videos.find(v => v.site === 'YouTube');
        launchHeroTrailer(data.backdrop_path || null, trailerVideo ? trailerVideo.key : null);
        // ────────────────────────────────────────

        if (videos.length > 0) {
            videoContainer.classList.remove('hidden');

            videos.sort((a, b) => {
                const typeOrder = { "Trailer": 1, "Teaser": 2, "Featurette": 3, "Clip": 4 };
                return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
            });

            videos.forEach(video => {
                const div = document.createElement('div');
                div.className = "video-card flex-shrink-0 group";
                
                let thumbSrc = "";
                if (video.site === "YouTube") {
                    thumbSrc = `https://img.youtube.com/vi/${video.key}/hqdefault.jpg`;
                } else {
                    thumbSrc = "https://placehold.co/480x360/1f1f1f/ffffff?text=Vimeo+Video";
                }

                div.innerHTML = `
                    <div class="video-thumbnail">
                        <img src="${thumbSrc}" loading="lazy" alt="${video.name}">
                        <div class="absolute inset-0 flex items-center justify-center">
                            <i class="fas fa-play-circle text-4xl text-white opacity-90 group-hover:scale-110 transition-transform drop-shadow-lg"></i>
                        </div>
                    </div>
                    <div class="video-info">
                        <div class="video-type">${video.type}</div>
                        <div class="video-title">${video.name}</div>
                    </div>
                `;

                div.onclick = () => {
                    const modal = document.getElementById('trailer-modal');
                    const iframe = document.getElementById('trailer-iframe');
                    modal.classList.remove('hidden');
                    
                    if (video.site === "YouTube") {
                        iframe.src = `https://www.youtube-nocookie.com/embed/${video.key}?autoplay=1&rel=0`;
                    } else if (video.site === "Vimeo") {
                        iframe.src = `https://player.vimeo.com/video/${video.key}?autoplay=1`;
                    }
                };

                videoList.appendChild(div);
            });
            updateScrollButtons(videoList);
            videoList.addEventListener('scroll', () => updateScrollButtons(videoList));
        } else {
            videoContainer.classList.add('hidden');
        }
    }

    renderDetailedInfo(data);
    renderLogos(data);
    if (data.similar) renderSimilar(data.similar);
    if (data.translations) handleTranslations(data);
}

function renderDetailedInfo(data) {
    // --- NETWORKS & PRODUCTION ---
    const prodList = document.getElementById('production-list');
    const prodHeader = prodList.parentElement.querySelector('h5'); 
    prodList.innerHTML = '';

    let entities = [];

    // 1. Add Networks
    if (data.networks && data.networks.length > 0) {
        entities = [...entities, ...data.networks.map(n => ({ ...n, type: 'network' }))];
    }
    
    // 2. Add Production Companies
    if (data.production_companies && data.production_companies.length > 0) {
        entities = [...entities, ...data.production_companies.map(c => ({ ...c, type: 'company' }))];
    }
    
    if (entities.length > 0) {
        prodList.parentElement.classList.remove('hidden');

        if (data.networks && data.networks.length > 0) {
             prodHeader.innerHTML = '<i class="fas fa-broadcast-tower mr-2"></i> Networks & Studios';
        } else {
             prodHeader.innerHTML = '<i class="fas fa-building mr-2"></i> Production';
        }

        entities.forEach(p => {
            const div = document.createElement('div');
            div.className = "mb-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-all group";

            let iconHtml = '';
            if (p.logo_path) {
                iconHtml = `<img src="${TMDB_IMG_BASE_URL}${p.logo_path}" class="w-8 h-8 object-contain bg-white rounded-md p-0.5" alt="${p.name}" loading="lazy">`;
            } else {
                const iconClass = p.type === 'network' ? 'fa-broadcast-tower' : 'fa-industry';
                iconHtml = `<div class="w-8 h-8 flex items-center justify-center bg-gray-800 rounded-md"><i class="fas ${iconClass} text-gray-400 text-xs"></i></div>`;
            }

            const networkBadge = p.type === 'network' 
                ? '<span class="text-blue-400 font-bold text-[10px] ml-2 border border-blue-400/30 px-1 rounded">NETWORK</span>' 
                : '';

            div.innerHTML = `
                        ${iconHtml}
                        <div class="flex flex-col">
                            <span class="text-sm font-semibold text-gray-200 group-hover:text-red-500 transition-colors">
                                ${p.name}
                            </span>
                            <div class="flex items-center">
                                <span class="text-xs text-gray-500">${p.origin_country || ''}</span>
                                ${networkBadge}
                            </div>
                        </div>
                    `;

            div.onclick = () => quickFilter(p.type, p.id, p.name, p.logo_path);
            prodList.appendChild(div);
        });
    } else {
        prodList.parentElement.classList.add('hidden');
    }

    // --- RELEASE DATES ---
    const relList = document.getElementById('release-dates-list');
    relList.innerHTML = '';
    let hasReleaseDates = false;

    if (data.release_dates && data.release_dates.results) {
        data.release_dates.results.forEach(r => {
            let countryName = r.iso_3166_1;
            try { countryName = new Intl.DisplayNames(['en'], { type: 'region' }).of(r.iso_3166_1); } catch (e) { }

            r.release_dates.forEach(d => {
                if (d.type === 3 || d.type === 4) {
                    hasReleaseDates = true;
                    const dateStr = new Date(d.release_date).toLocaleDateString();
                    const div = document.createElement('div');
                    div.className = "release-item";
                    div.innerHTML = `<span class="release-country">${countryName}</span> <span class="release-date">${dateStr}</span>`;
                    relList.appendChild(div);
                }
            });
        });
    }
    
    if (hasReleaseDates) {
        relList.parentElement.classList.remove('hidden');
    } else {
        relList.parentElement.classList.add('hidden');
    }

    // --- ALTERNATIVE TITLES ---
    const altList = document.getElementById('alt-titles-list');
    altList.innerHTML = '';
    const rawTitles = data.alternative_titles?.titles || data.alternative_titles?.results || [];

    if (rawTitles.length > 0) {
        altList.parentElement.classList.remove('hidden');
        
        rawTitles.forEach(t => {
            const div = document.createElement('div');
            div.className = "mb-1 border-b border-white/5 pb-1 last:border-0";
            div.innerHTML = `<span class="text-white font-bold text-xs uppercase w-8 inline-block">${t.iso_3166_1}:</span> <span class="text-gray-300">${t.title}</span>`;
            altList.appendChild(div);
        });
    } else {
        altList.parentElement.classList.add('hidden');
    }

    // --- TECH SPECS (UPDATED WITH ORIGINAL TITLE) ---
    const techList = document.getElementById('tech-specs-list');
    techList.innerHTML = '';
    
    // 1. Determine titles
    const originalTitle = data.original_title || data.original_name;
    const displayTitle = data.title || data.name;
    
    // 2. Logic: Only show if it differs from the main title
    const showOriginal = (originalTitle && originalTitle !== displayTitle) ? originalTitle : null;

    const specs = [
        { label: "Original Title", val: showOriginal }, // <--- New Item
        { label: "Original Language", val: data.original_language ? data.original_language.toUpperCase() : null },
        { label: "Budget", val: data.budget ? `$${data.budget.toLocaleString()}` : null },
        { label: "Revenue", val: data.revenue ? `$${data.revenue.toLocaleString()}` : null },
        { label: "Status", val: data.status },
        { label: "Runtime", val: data.runtime ? `${data.runtime} min` : null }
    ];

    let hasSpecs = false;
    specs.forEach(s => {
        if (s.val) {
            hasSpecs = true;
            const div = document.createElement('div');
            div.className = "mb-1 flex justify-between";
            // Highlight "Original Title" slightly differently
            const valueClass = (s.label === "Original Title") ? "text-white font-semibold italic text-right" : "text-gray-300 text-right";
            
            div.innerHTML = `<span class="text-gray-400">${s.label}</span> <span class="${valueClass}">${s.val}</span>`;
            techList.appendChild(div);
        }
    });

    if (hasSpecs) {
        techList.parentElement.classList.remove('hidden');
    } else {
        techList.parentElement.classList.add('hidden');
    }
}

function buildUrl(template) {
    if (!TMDB_ID) return "#";
    let tpl = (mediaType === 'movie') ? template.movie : template.tv;
    
    // Using the /g regex flag ensures EVERY instance of [ID] gets replaced, 
    // including the one in your fallback URL.
    let url = tpl.replace(/\[ID\]/g, TMDB_ID);
    
    if (mediaType === 'movie' && url.includes('[IMDB_ID]')) {
        if (!IMDB_ID) return "about:blank";
        url = url.replace(/\[IMDB_ID\]/g, IMDB_ID);
    }
    
    if (mediaType === 'tv') {
        // Also good practice to make [S] and [E] global just in case!
        url = url.replace(/\[S\]/g, currentSeason).replace(/\[E\]/g, currentEpisode);
    }
    
    return url;
}

function renderServerButtons() {
    const btnContainer = document.getElementById('server-buttons');
    if (!btnContainer) return;

    btnContainer.innerHTML = '';
    
    // Use dynamic servers instead of SERVER_URLS
    const activeServers = getActiveServers();

    activeServers.forEach((server, index) => {
        const btn = document.createElement('button');
        btn.className = `server-btn ${index === currentServerIndex ? 'active' : ''}`;
        btn.textContent = server.name;
        btn.onclick = () => switchServer(index, btn);
        btnContainer.appendChild(btn);
    });
}

function updatePlayer() {
    if (!TMDB_ID) return;

    // FIX: Find the element inside the function
    const playerIframe = document.getElementById('player-iframe');
    if (!playerIframe) return; 

    const activeServers = getActiveServers();
    
    if (currentServerIndex >= activeServers.length) {
        currentServerIndex = 0;
    }

    renderServerButtons();

    const url = buildUrl(activeServers[currentServerIndex]);
    
    if (url === "about:blank") {
        playerIframe.src = "about:blank";
    } else {
        playerIframe.src = url;
        const msg = document.getElementById('server-loading-msg');
        if (msg) msg.classList.add('hidden');
    }

    // Update TV Info and Scroll List
    const nextBtn = document.getElementById('next-ep-btn');
    const currentEpisodeInfo = document.getElementById('current-episode-info');

                    if (mediaType === 'tv') {
            if (currentEpisodeInfo) currentEpisodeInfo.textContent = `S${currentSeason}:E${currentEpisode} - ${activeServers[currentServerIndex].name}`;
            
            // --- DYNAMIC & CLEVER NEXT BUTTON ---
            const sIndex = episodeData.findIndex(s => s.season === currentSeason);
            
            if (sIndex !== -1 && nextBtn) {
                const isLastSeason = (sIndex === episodeData.length - 1);
                const isLastEpisodeInSeason = (currentEpisode >= episodeData[sIndex].episodes);
                
                if (isLastSeason && isLastEpisodeInSeason) {
                    // It's the series finale - hide the button
                    nextBtn.classList.add('hidden'); 
                } else {
                    nextBtn.classList.remove('hidden');
                    
                    // Update button text dynamically
                    const btnLabel = nextBtn.querySelector('span') || nextBtn; // Finds span if you have an icon
                    if (isLastEpisodeInSeason) {
                        const nextSeasonNum = episodeData[sIndex + 1].season;
                        btnLabel.innerHTML = `<i class="fas fa-chevron-right mr-2"></i> Start Season ${nextSeasonNum}`;
                    } else {
                        btnLabel.innerHTML = `<i class="fas fa-step-forward mr-2"></i> Next Episode`;
                    }
                }
            }
        } else {
            if (nextBtn) nextBtn.classList.add('hidden');
        }

    saveProgress();
}

function switchServer(index, btn) {
    const playerIframe = document.getElementById('player-iframe'); // FIX: Find locally
    if (!playerIframe) return;

    currentServerIndex = index;
    
    document.querySelectorAll('.server-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const activeServers = getActiveServers();
    const url = buildUrl(activeServers[index]);
    
    playerIframe.src = url;
    
    const currentEpisodeInfo = document.getElementById('current-episode-info');
    if (mediaType === 'tv' && currentEpisodeInfo) {
        currentEpisodeInfo.textContent = `S${currentSeason}:E${currentEpisode} - ${activeServers[index].name}`;
    }
}

window.handleServerError = function() {
    const activeServers = getActiveServers();
    const nextIndex = (currentServerIndex + 1) % activeServers.length;

    const msg = document.getElementById('server-loading-msg');
    msg.innerHTML = `
            <div class="text-2xl mb-4 text-red-500"><i class="fas fa-tools"></i></div>
            <h3 class="text-xl font-bold mb-2">Switching Server...</h3>
            <p class="text-gray-400 text-sm">Trying Source ${nextIndex + 1} of ${activeServers.length}</p>
        `;
    msg.classList.remove('hidden');

    setTimeout(() => {
        const nextBtn = document.querySelectorAll('.server-btn')[nextIndex];
        if (nextBtn) {
            switchServer(nextIndex, nextBtn);
        }
        msg.classList.add('hidden');
    }, 1000);
}

function saveProgress() {
    if (!TMDB_ID) return;

    const idToCheck = Number(TMDB_ID);

    let history = JSON.parse(localStorage.getItem('watch_history') || '[]');

    history = history.filter(h => Number(h.tmdbId) !== idToCheck);

    history.unshift({
        mediaType,
        tmdbId: idToCheck,
        title: currentTitle,
        season: currentSeason,
        episode: currentEpisode,
        poster: document.getElementById('detail-poster').src,
        timestamp: Date.now()
    });

    if (history.length > 20) history.pop();

    localStorage.setItem('watch_history', JSON.stringify(history));
}

function updateContinueWatchingUI() {
    const container = document.getElementById('continue-watching-container');
    const section = document.getElementById('continue-watching-section');

    let history = [];
    try {
        const raw = localStorage.getItem('watch_history');
        history = raw ? JSON.parse(raw) : [];
        history = history.filter(item => item && item.tmdbId && item.poster);
    } catch (e) {
        console.error("History corrupted, resetting:", e);
        localStorage.removeItem('watch_history');
        history = [];
    }

    if (history.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    container.innerHTML = '';

    history.forEach(item => {
        const card = document.createElement('div');
        card.className = 'scroll-card';

        const epInfo = item.mediaType === 'tv' ? `S${item.season}:E${item.episode}` : 'Movie';
        const badgeHtml = item.mediaType === 'tv' 
            ? `<div class="media-badge tv">TV</div>` 
            : `<div class="media-badge movie">MOVIE</div>`;

        card.innerHTML = `
                <div class="poster-wrapper">
                    ${badgeHtml} <div class="remove-btn" onclick="removeFromHistory(${item.tmdbId}, event)" title="Remove from History">
                        <i class="fas fa-times text-xs"></i>
                    </div>
                    
                    <img src="${item.poster}" 
                         class="poster-img skeleton" 
                         loading="lazy"
                         alt="${item.title}"
                         onload="this.classList.remove('skeleton')"
                         onerror="this.style.display='none'">
                         
                    <div class="play-overlay">
                        <div class="play-icon-circle"><i class="fas fa-play"></i></div>
                    </div>
                </div>
                <div class="card-body">
                    <div class="card-title">${item.title}</div>
                    <div class="card-meta">
                        <span class="text-xs text-accent font-bold">${epInfo}</span>
                        <span class="text-xs text-gray-500">Resume</span>
                    </div>
                </div>
            `;

        card.onclick = async () => {
            await selectContent(item.tmdbId, item.title, item.mediaType);
            if (item.mediaType === 'tv') {
                setTimeout(() => {
                    const seasonSelect = document.getElementById('season-select');
                    if (seasonSelect) seasonSelect.value = item.season;
                    
                    // Trigger changeSeason with both the target season AND episode
                    changeSeason(item.season, item.episode);
                }, 800); // Slight delay ensures DOM is ready
            }
        };

        container.appendChild(card);
    });

    // --- NEW: Update buttons ---
    updateScrollButtons(container);
}

window.removeFromHistory = function(id, event) {
    if (event) event.stopPropagation();
    let history = JSON.parse(localStorage.getItem('watch_history') || '[]');
    history = history.filter(h => Number(h.tmdbId) !== Number(id));
    localStorage.setItem('watch_history', JSON.stringify(history));
    updateContinueWatchingUI();
}

function loadProgress() {
    updateContinueWatchingUI();
}

window.nextEpisode = function() {
    if (mediaType !== 'tv') return;
    const sIndex = episodeData.findIndex(s => s.season === currentSeason);
    if (sIndex === -1) return;
    let nextS = currentSeason, nextE = currentEpisode + 1;
    
    // Check if we reached the end of the current season
    if (nextE > episodeData[sIndex].episodes) {
        if (episodeData[sIndex + 1]) {
            nextS = episodeData[sIndex + 1].season;
            nextE = 1;
            document.getElementById('season-select').value = nextS;
            
            // Pass both Season and Episode to load properly
            changeSeason(nextS, nextE);
            showMessage(`Starting Season ${nextS}...`);
            return;
        } else {
            showMessage("No more episodes.", true);
            return;
        }
    }
    selectEpisode(nextS, nextE, null);
}


window.selectEpisode = function(s, e, el) {
    currentSeason = s; 
    currentEpisode = e;

    if (typeof seasonEpisodes !== 'undefined' && seasonEpisodes.length > 0) {
        const epData = seasonEpisodes.find(ep => ep.episode_number === e);
        if (epData) {
            updateSeasonStatusUI(epData.air_date);
        }
        
        // --- DOM MANIPULATION INSTEAD OF FULL RE-RENDER ---
        const scrollList = document.getElementById('episodes-scroll-list');
        
        if (scrollList) {
            // 1. Remove the 'active' class from all episodes
            const allItems = scrollList.querySelectorAll('.episode-rich-item');
            allItems.forEach(item => item.classList.remove('active'));

            // 2. Find the newly selected episode element 
            // (Use the passed 'el' if clicked, or fallback to the data attribute for the Next button)
            const activeEl = el || scrollList.querySelector(`.episode-rich-item[data-episode="${e}"]`);

            // 3. Add the active class and smoothly scroll it into the center
            if (activeEl) {
                activeEl.classList.add('active');
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }

    updatePlayer();
}

window.toggleAccordion = function() {
    if (mediaType !== 'tv') return;

    const icon = document.getElementById('accordion-icon');
    accordionOpen = !accordionOpen;

    if (accordionOpen) {
        // 1. Calculate height + buffer (30px) to ensure scrollbar doesn't cut off content
        episodeAccordionContent.style.maxHeight = (episodeAccordionContent.scrollHeight + 30) + "px";
        
        // 2. Auto-scroll to the active episode card
        setTimeout(() => {
            const activeEp = episodeAccordionContent.querySelector('.episode-rich-item.active');
            if (activeEp) {
                activeEp.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'nearest', 
                    inline: 'center' // Centers the card horizontally
                });
            }
        }, 300); // Wait for the open animation to finish
    } else {
        episodeAccordionContent.style.maxHeight = "0";
    }

    // Toggle the arrow icon
    icon.className = `fas fa-chevron-${accordionOpen ? 'up' : 'down'} transition-transform duration-300`;
}
// ==========================================
// DOWNLOAD MODAL LOGIC
// ==========================================

window.openDownloadModal = async function() {
    if (!TMDB_ID || !mediaType) {
        showMessage("No content selected to download.", true);
        return;
    }

    // FIX #5: Load registry only when the download modal is actually opened
    await ensureDubbedRegistry();

    const modal = document.getElementById('download-modal');
    const dlLink1 = document.getElementById('dl-link-1');
    const dlLink2 = document.getElementById('dl-link-2');
    const dlLink3 = document.getElementById('dl-link-3');
    const dubbedBtn = document.getElementById('dl-link-dubbed');
    const subtitle = document.getElementById('download-modal-subtitle');

    if (dlLink1) {
        dlLink1.href = buildUrl(DOWNLOAD_URLS.source1);
    }

    if (dlLink2) {
        dlLink2.href = buildUrl(DOWNLOAD_URLS.source2);
    }

    if (dlLink3) {
        dlLink3.href = buildUrl(DOWNLOAD_URLS.source3);
    }

    if (dubbedBtn) {
        if (typeof DUBBED_REGISTRY !== 'undefined' && DUBBED_REGISTRY[TMDB_ID]) {
            dubbedBtn.href = `download.html?id=${TMDB_ID}&type=${mediaType}`;
            dubbedBtn.classList.remove('hidden');
        } else {
            dubbedBtn.classList.add('hidden');
        }
    }

    if (subtitle) {
        subtitle.textContent = mediaType === 'tv' ? `S${currentSeason}:E${currentEpisode}` : "Full Movie";
    }

    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; 
        window.toggleMobileNav(true); // Hide nav
    }
};

window.closeDownloadModal = function() {
    const modal = document.getElementById('download-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = ''; 
        window.toggleMobileNav(false); // Show nav
    }
};

// Close the modal if the user clicks the dark background outside the modal box
const downloadModalEl = document.getElementById('download-modal');
if (downloadModalEl) {
    downloadModalEl.addEventListener('click', e => { 
        if (e.target === downloadModalEl) closeDownloadModal(); 
    });
}

function clearHistory() {
    if (!confirm("Are you sure you want to clear your watch history?")) return;
    localStorage.removeItem('watch_history');
    updateContinueWatchingUI();
    showMessage("History Cleared");
}

async function shareMovie() {
    const movieTitle = document.title;
    const movieUrl = window.location.href;

    if (navigator.share) {
        try {
            await navigator.share({
                title: movieTitle,
                text: `Watch ${movieTitle} on Chithruka:`,
                url: movieUrl
            });
        } catch (err) {
            console.log('Share cancelled:', err);
        }
    }
    else {
        navigator.clipboard.writeText(movieUrl).then(() => {
            showToast();
        }).catch(err => {
            console.error('Copy failed:', err);
        });
    }
}

function showToast() {
    const toast = document.getElementById("toast");
    toast.className = "toast show";
    setTimeout(function() {
        toast.className = toast.className.replace("show", "");
    }, 3000);
}

// --- NEW: Scroll Button Visibility Logic ---
function updateScrollButtons(container) {
    if (!container) return;
    
    // In your HTML structure, buttons are the previous and next siblings
    const leftBtn = container.previousElementSibling;
    const rightBtn = container.nextElementSibling;
    
    // Tolerance buffer (e.g., 5px) to handle browser sub-pixel rendering
    const tolerance = 5;

    // 1. Check Left Button (Hide if at start)
    if (leftBtn && leftBtn.classList.contains('scroll-btn')) {
        if (container.scrollLeft <= tolerance) {
            leftBtn.classList.add('hidden');
        } else {
            leftBtn.classList.remove('hidden');
        }
    }

    // 2. Check Right Button (Hide if at end or if content fits)
    if (rightBtn && rightBtn.classList.contains('scroll-btn')) {
        // If content is smaller than screen, hide right button immediately
        if (container.scrollWidth <= container.clientWidth) {
            rightBtn.classList.add('hidden');
        } 
        // Otherwise, check if we reached the end
        else if (container.scrollLeft + container.clientWidth >= container.scrollWidth - tolerance) {
            rightBtn.classList.add('hidden');
        } else {
            rightBtn.classList.remove('hidden');
        }
    }
}
/* --- VOICE SEARCH FUNCTIONALITY --- */

function startVoiceInput() {
    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        alert("Your browser does not support Voice Search. Try Chrome or Edge.");
        return;
    }

    const recognition = new SpeechRecognition();
    const micBtn = document.getElementById('ai-mic-btn');
    const input = document.getElementById('ai-search-input');

    recognition.lang = 'en-US'; // Set language
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // UI Updates on Start
    recognition.onstart = () => {
        micBtn.classList.add('listening');
        input.placeholder = "Listening... Speak now";
    };

    // UI Updates on End
    recognition.onend = () => {
        micBtn.classList.remove('listening');
        input.placeholder = "Type or ask AI...";
    };

    // Handle Result
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        input.value = transcript;
        
        // Auto-submit after a short delay so user sees what was typed
        setTimeout(() => {
            handleAISearch();
        }, 800);
    };

    // Handle Errors
    recognition.onerror = (event) => {
        console.error("Voice Error:", event.error);
        micBtn.classList.remove('listening');
        input.placeholder = "Error. Please type.";
    };

    recognition.start();
}
async function loadLatestTrailers() {
    const container = document.getElementById('trailers-container');
    const section = document.getElementById('trailers-section');
    
    // Safety check
    if (!container || !section) return;

    // Show skeletons
    container.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        container.innerHTML += `
            <div class="trailer-card">
                <div class="w-full h-full bg-gray-800 animate-pulse"></div>
            </div>`;
    }

    try {
        const data = await fetchCached(`${BASE_TMDB_URL}/movie/upcoming?api_key=${TMDB_API_KEY}&language=en-US&page=1`);
        container.innerHTML = ''; // Clear skeletons

        const items = data.results.filter(i => i.backdrop_path);

        if (items.length === 0) {
            section.style.display = 'none';
            return;
        }

        items.forEach(item => {
            const imgUrl = `${TMDB_STILL_SZ}${item.backdrop_path}`;
            const card = document.createElement('div');
            card.className = 'trailer-card';
            card.innerHTML = `
                <img src="${imgUrl}" class="trailer-img" loading="lazy" alt="${item.title}">
                <div class="trailer-play-icon"><i class="fas fa-play"></i></div>
                <div class="trailer-content">
                    <div class="trailer-title">${item.title}</div>
                    <div class="trailer-sub">Official Trailer</div>
                </div>
            `;
            card.onclick = () => playTrailerDirectly(item.id, 'movie');
            container.appendChild(card);
        });
        
        section.style.display = 'block';

        // --- NEW: Update buttons ---
        updateScrollButtons(container);

    } catch (e) {
        console.error("Trailers Error:", e);
        container.innerHTML = '<div class="p-4 text-gray-500 text-sm">Trailers unavailable</div>';
    }
}
async function playTrailerDirectly(id, type) {
    const modal = document.getElementById('trailer-modal');
    const iframe = document.getElementById('trailer-iframe');

    if (!modal || !iframe) return;

    modal.classList.remove('hidden');
    iframe.src = ''; // Clear previous video

    try {
        const data = await fetchCached(`${BASE_TMDB_URL}/${type}/${id}/videos?api_key=${TMDB_API_KEY}`);
        
        // precise logic: Look for "Trailer" type first, fallback to any YouTube video
        const trailer = data.results.find(v => v.site === 'YouTube' && v.type === 'Trailer') ||
                        data.results.find(v => v.site === 'YouTube');

        if (trailer) {
            // Autoplay enabled, no related videos (rel=0)
            iframe.src = `https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&rel=0`;
        } else {
            showMessage("Trailer not found", true);
            // Close modal automatically if no trailer found
            setTimeout(() => modal.classList.add('hidden'), 1500);
        }
    } catch (e) {
        console.error("Trailer fetch failed", e);
        showMessage("Error loading trailer", true);
        modal.classList.add('hidden');
    }
}

async function loadSoundtrack(title) {
    const section = document.getElementById('soundtrack-section');
    const container = document.getElementById('soundtrack-embed-container');
    const link = document.getElementById('soundtrack-link');
    
    if (!section || !container) return;

    // 1. Clean Title for Search
    let cleanTitle = title.split(':')[0].split('(')[0].trim();
    if (cleanTitle.toLowerCase().startsWith('the ')) {
        cleanTitle = cleanTitle.substring(4);
    }

    // 2. JSONP Helper (Fixes the "Failed to Fetch" CORS error)
    const fetchiTunesJSONP = (query) => {
        return new Promise((resolve, reject) => {
            const callbackName = `itunes_cb_${Math.floor(Math.random() * 1000000)}`;
            const script = document.createElement('script');
            
            window[callbackName] = (data) => {
                delete window[callbackName];
                document.body.removeChild(script);
                resolve(data);
            };

            script.onerror = () => {
                delete window[callbackName];
                document.body.removeChild(script);
                reject(new Error("iTunes API connection failed"));
            };

            // We add &callback=... to the URL to trigger JSONP mode
            const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=album&limit=15&callback=${callbackName}`;
            script.src = url;
            document.body.appendChild(script);
        });
    };

    try {
        // 3. Request Soundtrack Data
        const data = await fetchiTunesJSONP(`${cleanTitle} Soundtrack`);

        if (data.results && data.results.length > 0) {
            // 4. Get Movie Year from Global State
            let movieYear = null;
            if (currentMovieData) {
                const dateStr = currentMovieData.release_date || currentMovieData.first_air_date;
                if (dateStr) movieYear = new Date(dateStr).getFullYear();
            }

            let bestMatch = null;
            let minYearDiff = Infinity;

            // 5. Filter for best Soundtrack match
            for (const album of data.results) {
                const albumTitle = album.collectionName.toLowerCase();
                const releaseYear = new Date(album.releaseDate).getFullYear();
                
                const isSoundtrack = albumTitle.includes('soundtrack') || 
                                   albumTitle.includes('motion picture') || 
                                   albumTitle.includes('score') ||
                                   albumTitle.includes(cleanTitle.toLowerCase());
                
                if (!isSoundtrack) continue;

                if (movieYear) {
                    const diff = Math.abs(releaseYear - movieYear);
                    if (diff <= 1 && diff < minYearDiff) {
                        minYearDiff = diff;
                        bestMatch = album;
                    }
                } else if (!bestMatch) {
                    bestMatch = album;
                }
            }

            // Fallback to first result if no perfect match found
            if (!bestMatch) bestMatch = data.results[0];

            if (bestMatch) {
                const albumId = bestMatch.collectionId;
                
                // 6. Render Square Player
                container.innerHTML = `
                    <iframe allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write" 
                            frameborder="0" 
                            height="450" 
                            style="width:100%; aspect-ratio: 1 / 1; max-width: 450px; overflow:hidden; border-radius:12px; background:transparent; display: block; margin: 0 auto;" 
                            sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation" 
                            src="https://embed.music.apple.com/us/album/${albumId}">
                    </iframe>
                `;

                if (link) link.href = bestMatch.collectionViewUrl;
                section.classList.remove('hidden');
                return;
            }
        }
        
        // Hide if nothing found
        section.classList.add('hidden');

    } catch (e) {
        console.error("Soundtrack Error:", e);
        section.classList.add('hidden');
    }
}

function openAIInsight() {
    if (!currentMovieData) return;
    
    const modal = document.getElementById('ai-insight-modal');
    const titleDisplay = document.getElementById('ai-insight-title');
    
    const displayTitle = currentMovieData.year && currentMovieData.year !== "N/A" 
        ? `${currentMovieData.title} (${currentMovieData.year})` 
        : currentMovieData.title;

    titleDisplay.textContent = `Asking about: ${displayTitle}`;
    
    // Reset View
    document.getElementById('ai-options').classList.remove('hidden');
    document.getElementById('ai-insight-loader').classList.add('hidden');
    document.getElementById('ai-insight-result').classList.add('hidden');
    
    modal.classList.remove('hidden');
    window.toggleMobileNav(true); // Hide nav
}

function closeAIInsight() {
    document.getElementById('ai-insight-modal').classList.add('hidden');
    window.toggleMobileNav(false); // Show nav
}

async function fetchAIInsight(mode) {
    const loader = document.getElementById('ai-insight-loader');
    const options = document.getElementById('ai-options');
    const resultBox = document.getElementById('ai-insight-result');
    const resultText = resultBox.querySelector('p');

    // Reset UI
    options.classList.add('hidden');
    loader.classList.remove('hidden');
    resultBox.classList.add('hidden');

    // Prepare Data
    const jsonContext = JSON.stringify(currentMovieData, null, 2);
    let promptInstruction = "";

    switch (mode) {
        case 'hype':
            promptInstruction = `Analyze this movie JSON and write a short, high-energy paragraph (max 60 words) telling the user why they absolutely MUST watch this. Focus on the plot hooks and actors. JSON: ${jsonContext}`;
            break;
        case 'trivia':
            promptInstruction = `Generate 3 interesting, obscure trivia facts based on this movie JSON. Format them as a simple bulleted list. JSON: ${jsonContext}`;
            break;
        case 'parents':
            promptInstruction = `Act as a strict Parent's Guide. Explain the Age Rating and content warnings (violence, language, etc) based on this JSON. Keep it concise. JSON: ${jsonContext}`;
            break;
    }

    try {
        const response = await fetch(GEMINI_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: promptInstruction }]
                }]
            })
        });

        const data = await response.json();

        if (!response.ok || data.error) {
            console.error("Gemini Error:", data);
            throw new Error(data.error?.message || "API Error");
        }

        const content = data.candidates[0].content.parts[0].text;

        loader.classList.add('hidden');
        resultBox.classList.remove('hidden');
        
        // Format newlines for HTML
        resultText.innerHTML = content.replace(/\n/g, '<br>');

    } catch (error) {
        console.error("AI Insight Failed:", error);
        
        loader.classList.add('hidden');
        resultBox.classList.remove('hidden');
        
        resultText.innerHTML = `
            <strong class="text-red-500"><i class="fas fa-exclamation-circle"></i> AI Error</strong><br>
            <span class="text-gray-400 text-sm">${error.message}</span>
        `;
    }
}

const quotesData = [
  {
    "quote": "I'm gonna make him an offer he can't refuse.",
    "character": "Michael Corleone",
    "movie": "The Godfather",
    "year": "1972",
    "tmdb_id": 238,
    "type": "movie"
  },
  {
    "quote": "Why so serious?",
    "character": "The Joker",
    "movie": "The Dark Knight",
    "year": "2008",
    "tmdb_id": 155,
    "type": "movie"
  },
  {
    "quote": "Here's looking at you, kid.",
    "character": "Rick Blaine",
    "movie": "Casablanca",
    "year": "1942",
    "tmdb_id": 289,
    "type": "movie"
  },
  {
    "quote": "සර්, ඕක Answer කරන්න ම ඕන Call එකක්",
    "character": "ජෙහාන්",
    "movie": "කූඹියෝ",
    "year": "2017",
    "tmdb_id": 77068,
    "type": "tv"
  },
  {
    "quote": "May the Force be with you.",
    "character": "Han Solo",
    "movie": "Star Wars",
    "year": "1977",
    "tmdb_id": 11,
    "type": "movie"
  },
  {
    "quote": "You talking to me?",
    "character": "Travis Bickle",
    "movie": "Taxi Driver",
    "year": "1976",
    "tmdb_id": 103,
    "type": "movie"
  },
  {
    "quote": "I see dead people.",
    "character": "Cole Sear",
    "movie": "The Sixth Sense",
    "year": "1999",
    "tmdb_id": 745,
    "type": "movie"
  },
  {
    "quote": "I am the one who knocks!",
    "character": "Walter White",
    "movie": "Breaking Bad",
    "year": "2008",
    "tmdb_id": 1396,
    "type": "tv"
  },
  {
    "quote": "Winter is coming.",
    "character": "Ned Stark",
    "movie": "Game of Thrones",
    "year": "2011",
    "tmdb_id": 1399,
    "type": "tv"
  },
  {
    "quote": "Houston, we have a problem.",
    "character": "Jim Lovell",
    "movie": "Apollo 13",
    "year": "1995",
    "tmdb_id": 568,
    "type": "movie"
  },
  {
    "quote": "Keep your friends close, but your enemies closer.",
    "character": "Michael Corleone",
    "movie": "The Godfather Part II",
    "year": "1974",
    "tmdb_id": 240,
    "type": "movie"
  },
  {
    "quote": "Say 'hello' to my little friend!",
    "character": "Tony Montana",
    "movie": "Scarface",
    "year": "1983",
    "tmdb_id": 111,
    "type": "movie"
  },
  {
    "quote": "Do, or do not. There is no try.",
    "character": "Yoda",
    "movie": "The Empire Strikes Back",
    "year": "1980",
    "tmdb_id": 1891,
    "type": "movie"
  },
  {
    "quote": "It's alive! It's alive!",
    "character": "Henry Frankenstein",
    "movie": "Frankenstein",
    "year": "1931",
    "tmdb_id": 3035,
    "type": "movie"
  },
  {
    "quote": "Elementary, my dear Watson.",
    "character": "Sherlock Holmes",
    "movie": "The Adventures of Sherlock Holmes",
    "year": "1939",
    "tmdb_id": 10526,
    "type": "movie"
  },
  {
    "quote": "You're gonna need a bigger boat.",
    "character": "Martin Brody",
    "movie": "Jaws",
    "year": "1975",
    "tmdb_id": 578,
    "type": "movie"
  }
];

let currentQuoteIdx = 0;
let quoteTimer;

function initQuotes() {
    const section = document.getElementById('quote-section');
    if (!section) return; 

    // Randomize order on load
    quotesData.sort(() => Math.random() - 0.5);

    if (quotesData.length > 0) {
        displayQuote(0);
        startQuoteTimer();
    }
}

function displayQuote(index) {
    if (quotesData.length === 0) return;
    
    // Ensure index wraps around correctly
    currentQuoteIdx = (index + quotesData.length) % quotesData.length;
    const q = quotesData[currentQuoteIdx];

    const card = document.getElementById('quote-card');
    const textEl = document.getElementById('q-text');
    const charEl = document.getElementById('q-char');
    const movieEl = document.getElementById('q-movie');
    const actorBtn = document.getElementById('q-actor');

    // 1. Fade Out
    card.style.opacity = '0';
    card.style.transform = 'translateY(10px)';

    setTimeout(() => {
        // 2. Change Content
        textEl.textContent = `"${q.quote}"`;
        charEl.textContent = q.character;
        movieEl.textContent = `${q.movie} (${q.year})`;
        // actorBtn.textContent = "Watch Now"; 

        // 3. Fade In
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    }, 300);
}

function nextQuote() {
    displayQuote(currentQuoteIdx + 1);
    resetQuoteTimer();
}

function prevQuote() {
    displayQuote(currentQuoteIdx - 1);
    resetQuoteTimer();
}

function openQuoteMovie() {
    const q = quotesData[currentQuoteIdx];
    if (q && q.tmdb_id) {
        selectContent(q.tmdb_id, q.movie, q.type || 'movie');
    }
}

function startQuoteTimer() {
    if (quoteTimer) clearInterval(quoteTimer);
    quoteTimer = setInterval(() => {
        displayQuote(currentQuoteIdx + 1);
    }, 7000); // 7 seconds
}

function resetQuoteTimer() {
    clearInterval(quoteTimer);
    startQuoteTimer();
}
/* ==========================================
   KEYBOARD NAVIGATION (Arrow Keys to Scroll)
   ========================================== */

// Track which list the mouse is currently over
let activeScrollWrapper = null;

document.addEventListener('DOMContentLoaded', async () => {
    
    const urlParams = new URLSearchParams(window.location.search);

    // --- 1. Restore Adult Toggle State ---
    // (Restores the user's preference for adult content from local storage)
    const savedAdultState = localStorage.getItem('include_adult') === 'true';
    const adultToggle = document.getElementById('filter-adult');
    if (adultToggle) {
        adultToggle.checked = savedAdultState;
    }

    // --- 2. Check for TMDB Login Return (Redirect from Auth) ---
    if (urlParams.has('request_token') && urlParams.get('approved') === 'true') {
        const token = urlParams.get('request_token');
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Prevent double-execution from desktop browser pre-fetching
        if (localStorage.getItem('last_used_token') !== token) {
            localStorage.setItem('last_used_token', token);
            sessionId = null; 
            createSession(token);
        }
    }
    else {
        // --- 3. Standard Page Load (Check Local Storage) ---
        const storedSession = localStorage.getItem('tmdb_session_id');
        const storedAccount = localStorage.getItem('tmdb_account_id');
        
        if (storedSession && storedAccount) {
            sessionId = storedSession;
            accountId = storedAccount;
            updateAuthUI({ username: "User", avatar: { tmdb: { avatar_path: null } } }); 
            fetchAccountDetails(); 
        }
    }

    // --- 4. Load "Continue Watching" History ---
    // Only load this if we are on the homepage (not deep linking or filter linking)
    if (!urlParams.has('id') && !urlParams.has('filter')) {
        loadProgress();
    }

    // --- 5. Routing Logic ---
    const deepType = urlParams.get('type');
    const deepFilter = urlParams.get('filter');

    if (urlParams.has('id') && deepType === 'person') {
        // Deep Link: Person / Actor page
        heroSection.style.display = 'none';
        const trailerSection = document.getElementById('trailers-section');
        if (trailerSection) trailerSection.style.display = 'none';
        const deepId = Number(urlParams.get('id'));
        const deepName = urlParams.get('name') || 'Person';
        document.title = `${deepName} - Chithruka`;
        // profilePath and gender aren't in the URL — pass nulls; renderPersonProfile fills them from the API
        await loadActorCredits(deepId, deepName, null, null);

    } else if (urlParams.has('id') && deepType === 'collection') {
        // Deep Link: Collection page
        heroSection.style.display = 'none';
        const trailerSection = document.getElementById('trailers-section');
        if (trailerSection) trailerSection.style.display = 'none';
        const deepId = Number(urlParams.get('id'));
        const deepName = urlParams.get('name') || 'Collection';
        document.title = `${deepName} - Chithruka`;
        detailsSection.classList.add('hidden');
        playerInterface.classList.add('hidden');
        await loadCollection(deepId, deepName);

    } else if (deepFilter && urlParams.has('id')) {
        // Deep Link: Company / Keyword / Network / Genre / Country filter
        heroSection.style.display = 'none';
        const trailerSection = document.getElementById('trailers-section');
        if (trailerSection) trailerSection.style.display = 'none';
        const deepId = urlParams.get('id');
        const deepName = urlParams.get('name') || deepId;
        const deepLogo = urlParams.get('logo') || '';
        document.title = `${deepName} - Chithruka`;
        quickFilter(deepFilter, isNaN(Number(deepId)) ? deepId : Number(deepId), deepName, deepLogo);

    } else if (urlParams.has('id') && urlParams.has('type')) {
        // Deep Link: Movie / TV — original behaviour
        heroSection.style.display = 'none';
        const trailerSection = document.getElementById('trailers-section');
        if (trailerSection) trailerSection.style.display = 'none';
        const deepId = Number(urlParams.get('id'));
        await ensureLocalVideos();
        selectContent(deepId, "Loading Content...", deepType);

    } else {
        // Homepage: Load Trailers
        loadLatestTrailers();
    }

    // --- 6. Load Global Content ---
    loadTrending();
    loadGenres();

    // --- 7. Initialize Quotes ---
    initQuotes();

    // --- 8. Attach Scroll Listeners ---
    const scrollContainers = document.querySelectorAll('.overflow-x-auto');
    scrollContainers.forEach(container => {
        updateScrollButtons(container);
        container.addEventListener('scroll', () => {
            updateScrollButtons(container);
        });
    });

    // --- 9. Robust Footer & Location Logic (Mobile Fix) ---
    const yearSpan = document.getElementById('footer-year');
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();

    const countryEl = document.getElementById('user-country');

    // Helper function to update the UI
    const updateLocationUI = (name, code) => {
        if (countryEl && name && code) {
            countryEl.innerHTML = `<i class="fa-solid fa-earth-asia text-blue-500 animate-pulse"></i> ${name}`;
            countryEl.classList.add('cursor-pointer', 'hover:border-red-500', 'hover:text-white', 'group');
            countryEl.title = `Browse content from ${name}`;
            countryEl.onclick = () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                quickFilter('country', code, name);
            };
        }
    };

    // Primary API (ipapi.co)
    fetch('https://ipapi.co/json/')
        .then(res => {
            if (!res.ok) throw new Error('Blocked/Error');
            return res.json();
        })
        .then(data => {
            if (data.country_name && data.country_code) {
                updateLocationUI(data.country_name, data.country_code);
            } else {
                throw new Error('Invalid Data');
            }
        })
        .catch(() => {
            console.warn("Primary location API failed, trying fallback...");
            
            // Fallback API (geojs.io) - Better for mobile/ad-blockers
            fetch('https://get.geojs.io/v1/ip/country/full.json')
                .then(res => {
                    if (!res.ok) throw new Error('Fallback Blocked');
                    return res.json();
                })
                .then(data => {
                    // GeoJS uses 'name' and 'alpha2' (code)
                    if (data.name && data.alpha2) {
                        updateLocationUI(data.name, data.alpha2);
                    } else {
                        if (countryEl) countryEl.style.display = 'none';
                    }
                })
                .catch(() => {
                    // Final fail: Hide element cleanly
                    if (countryEl) countryEl.style.display = 'none';
                });
        });
});


// --- Browser Back / Forward Navigation ---
window.addEventListener('popstate', async (event) => {
    const state = event.state;

    // No state = back to homepage
    if (!state) {
        document.title = 'Chithruka';
        heroSection.style.display = 'block';
        document.getElementById('top10-section').style.display = 'block';
        detailsSection.classList.add('hidden');
        playerInterface.classList.add('hidden');
        collectionSection.classList.add('hidden');
        const personContainer = document.getElementById('person-details-container');
        if (personContainer) { personContainer.classList.add('hidden'); personContainer.innerHTML = ''; }
        trendingContainer.innerHTML = '';
        loadedIds.clear();
        trendingPage = 1;
        currentFetchUrl = '';
        loadTrending();
        return;
    }

    if (state.type === 'person') {
        await loadActorCredits(state.id, state.name, state.profilePath, state.gender);
    } else if (state.type === 'collection') {
        detailsSection.classList.add('hidden');
        playerInterface.classList.add('hidden');
        heroSection.style.display = 'none';
        await loadCollection(state.id, state.name);
    } else if (state.filter) {
        heroSection.style.display = 'none';
        quickFilter(state.filter, state.id, state.name, state.logo || '');
    } else if (state.type === 'movie' || state.type === 'tv') {
        heroSection.style.display = 'none';
        await selectContent(state.id, state.title || 'Loading...', state.type);
    }
});

function renderLogos(data) {
    const container = document.getElementById('logos-container');
    const list = document.getElementById('logos-list');

    // Safety check
    if (!container || !list) return;

    list.innerHTML = '';
    
    // Get logos from API data
    const logos = data.images?.logos || [];

    if (logos.length === 0) {
        container.classList.add('hidden');
        return;
    }

    // --- LOGIC: Filter 1 Logo Per Language ---
    const uniqueLogos = [];
    const seenLangs = new Set();
    const langNames = new Intl.DisplayNames(['en'], { type: 'language' });

    // TMDB sorts logos by rating by default. We iterate and pick 
    // the first (highest rated) logo for every new language we encounter.
    logos.forEach(logo => {
        // If ISO code is null/empty, we treat it as 'xx' (No Language/Universal)
        const iso = logo.iso_639_1 || 'xx'; 
        
        if (!seenLangs.has(iso)) {
            seenLangs.add(iso);
            uniqueLogos.push(logo);
        }
    });

    // --- RENDER ---
    if (uniqueLogos.length > 0) {
        container.classList.remove('hidden');

        uniqueLogos.forEach(logo => {
            const imgUrl = `${TMDB_POSTER_MD}${logo.file_path}`;
            const fullUrl = `${TMDB_POSTER_XL}${logo.file_path}`;
            
            // Convert code (e.g., 'en') to name (e.g., 'English')
            let langLabel = "Universal";
            if (logo.iso_639_1) {
                try {
                    langLabel = langNames.of(logo.iso_639_1);
                } catch (e) {
                    langLabel = logo.iso_639_1.toUpperCase();
                }
            }

            const div = document.createElement('div');
            // Styling: Dark background card, aspect-video to fit wide logos
            div.className = "flex-shrink-0 cursor-pointer w-56 aspect-video bg-white/5 border border-white/10 rounded-xl relative group flex items-center justify-center p-4 hover:border-white/30 transition-all";

            div.innerHTML = `
                <img src="${imgUrl}" loading="lazy" class="max-w-full max-h-full object-contain drop-shadow-lg" alt="${langLabel} Logo">
                
                <div class="absolute top-2 right-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-gray-300 font-bold uppercase tracking-wider border border-white/10">
                    ${langLabel}
                </div>

                <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                    <i class="fas fa-expand-alt text-white text-xl"></i>
                </div>
            `;

            // Open full size on click
            div.onclick = () => openLightbox(fullUrl, langLabel);
            list.appendChild(div);
        });

        // Attach scroll button logic
        updateScrollButtons(list);
        list.addEventListener('scroll', () => updateScrollButtons(list));
    } else {
        container.classList.add('hidden');
    }
}

// --- LIGHTBOX FUNCTIONS ---

function openLightbox(url, language) {
    const lightbox = document.getElementById('image-lightbox');
    const wrapper = document.getElementById('lightbox-wrapper');
    const img = document.getElementById('lightbox-img');
    const link = document.getElementById('lightbox-external-link');
    const langLabel = document.getElementById('lightbox-lang');

    // 1. Set the content
    img.src = url;
    link.href = url; // The link icon now points to the original image
    langLabel.textContent = language; // Display the language

    // 2. Show the lightbox (Animation logic)
    lightbox.classList.remove('hidden');
    window.toggleMobileNav(true); // Hide nav
    
    // Small timeout ensures the transition classes work
    setTimeout(() => {
        lightbox.classList.remove('opacity-0');
        wrapper.classList.remove('scale-95');
        wrapper.classList.add('scale-100');
    }, 10);
    
    // 3. Disable background scrolling
    document.body.style.overflow = 'hidden'; 
}

function closeLightbox() {
    const lightbox = document.getElementById('image-lightbox');
    const wrapper = document.getElementById('lightbox-wrapper');

    // 1. Start hide animation
    lightbox.classList.add('opacity-0');
    wrapper.classList.remove('scale-100');
    wrapper.classList.add('scale-95');

    // 2. Hide element after animation finishes (300ms)
    setTimeout(() => {
        lightbox.classList.add('hidden');
        document.getElementById('lightbox-img').src = ''; 
        document.body.style.overflow = ''; // Re-enable scrolling
        window.toggleMobileNav(false); // Show nav
    }, 300); 
}

// Close lightbox when clicking the dark background (outside the image)
document.getElementById('image-lightbox').addEventListener('click', (e) => {
    if (e.target.id === 'image-lightbox') closeLightbox();
});

function renderGallery(data) {
    const container = document.getElementById('gallery-container');
    const list = document.getElementById('gallery-list');

    // Safety check
    if (!container || !list) return;

    list.innerHTML = '';
    
    // 1. Get Backdrops and Posters
    const backdrops = data.images?.backdrops || [];
    const posters = data.images?.posters || [];
    
    // Combine them. We usually prefer backdrops first as they look better in horizontal scrolls.
    const allImages = [...backdrops, ...posters];

    // 2. Hide section if empty
    if (allImages.length === 0) {
        container.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');

    // 3. Render Images (Limit to 20 to prevent performance lag)
    allImages.slice(0, 20).forEach(img => {
        // Construct URLs
        const imgUrl = `${TMDB_POSTER_MD}${img.file_path}`; // Thumbnail size
        const fullUrl = `${TMDB_BACKDROP_WEB}${img.file_path}`; // Full size for lightbox
        
        // Determine type based on aspect ratio (Posters are vertical < 1, Backdrops horizontal > 1)
        const isPoster = img.aspect_ratio < 1;
        const typeLabel = isPoster ? "Poster" : "Backdrop";

        // Create the card container
        const div = document.createElement('div');
        
        // Dynamic classes based on image type
        // Posters get a narrower width (w-40) and portrait aspect ratio
        // Backdrops get a wider width (w-64) and video aspect ratio
        const widthClass = isPoster ? "w-40 aspect-[2/3]" : "w-64 aspect-video"; 
        
        div.className = `flex-shrink-0 cursor-pointer ${widthClass} bg-white/5 border border-white/10 rounded-xl relative group overflow-hidden flex items-center justify-center`;
        
        div.innerHTML = `
            <img src="${imgUrl}" loading="lazy" class="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-500 group-hover:scale-110" alt="${typeLabel}">
            
            <div class="absolute top-2 right-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-gray-300 font-bold uppercase tracking-wider border border-white/10 shadow-sm z-10 pointer-events-none">
                ${typeLabel}
            </div>

            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                <i class="fas fa-expand-alt text-white text-2xl drop-shadow-md transform scale-0 group-hover:scale-100 transition-transform duration-300"></i>
            </div>
        `;

        // ON CLICK: Open Lightbox using the existing function
        div.onclick = () => openLightbox(fullUrl, typeLabel);
        
        list.appendChild(div);
    });

    // 4. Update Scroll Buttons if they exist
    if (typeof updateScrollButtons === 'function') {
        updateScrollButtons(list);
        list.addEventListener('scroll', () => updateScrollButtons(list));
    }
}

// ==========================================
// USER REVIEWS
// ==========================================

let reviewsPage = 1;
let reviewsTotalPages = 1;
let reviewsLoading = false;

async function loadReviews(id, type, reset = false) {
    const section  = document.getElementById('reviews-section');
    const list     = document.getElementById('reviews-list');
    const moreBtn  = document.getElementById('reviews-load-more');
    if (!section || !list) return;

    if (reset) {
        reviewsPage = 1;
        reviewsTotalPages = 1;
        list.innerHTML = '';
        section.classList.add('hidden');
        if (moreBtn) moreBtn.classList.add('hidden');
    }

    if (reviewsLoading || reviewsPage > reviewsTotalPages) return;
    reviewsLoading = true;

    try {
        const data = await fetchCached(
            `${BASE_TMDB_URL}/${type}/${id}/reviews?api_key=${TMDB_API_KEY}&page=${reviewsPage}`
        );

        if (!data.results || data.results.length === 0) {
            if (reviewsPage === 1) section.classList.add('hidden');
            return;
        }

        reviewsTotalPages = data.total_pages || 1;
        section.classList.remove('hidden');

        data.results.forEach(review => {
            const card = createReviewCard(review);
            list.appendChild(card);
        });

        reviewsPage++;

        // Show "Load More" only if there are further pages
        if (moreBtn) {
            if (reviewsPage <= reviewsTotalPages) {
                moreBtn.classList.remove('hidden');
                // Store the current id/type so the button can call loadReviews again
                moreBtn.dataset.id   = id;
                moreBtn.dataset.type = type;
            } else {
                moreBtn.classList.add('hidden');
            }
        }
    } catch (e) {
        console.error('Reviews fetch failed', e);
    } finally {
        reviewsLoading = false;
    }
}

window.loadMoreReviews = function() {
    const btn = document.getElementById('reviews-load-more');
    if (!btn) return;
    loadReviews(btn.dataset.id, btn.dataset.type);
};

function createReviewCard(review) {
    const card = document.createElement('div');
    card.className = 'review-card';

    // Avatar initial(s)
    const initials = (review.author_details?.username || review.author || '?')
        .trim().substring(0, 2).toUpperCase();

    // Star rating
    const ratingVal = review.author_details?.rating;
    let starsHtml = '';
    if (ratingVal) {
        const stars = Math.round(ratingVal / 2); // TMDB rates /10, show /5
        starsHtml = `
            <div class="review-stars">
                ${'<i class="fas fa-star"></i>'.repeat(stars)}${'<i class="far fa-star"></i>'.repeat(5 - stars)}
                <span class="ml-1 text-gray-400">${ratingVal}/10</span>
            </div>`;
    }

    // Date
    const dateStr = review.created_at
        ? new Date(review.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : '';

    // Sanitise content (strip markdown, keep plain text readable)
    const rawContent = (review.content || '').replace(/!\[.*?\]\(.*?\)/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    const isLong = rawContent.length > 400;

    const uid = 'rev-' + review.id;

    card.innerHTML = `
        <div class="review-header">
            <div class="review-avatar">${initials}</div>
            <div>
                <div class="review-author">${review.author || 'Anonymous'}</div>
                <div class="review-date">${dateStr}</div>
            </div>
            ${starsHtml}
        </div>
        <div class="review-body clamped" id="${uid}">${rawContent}</div>
        ${isLong ? `<button class="review-toggle" onclick="toggleReview('${uid}', this)">Read More</button>` : ''}
    `;
    return card;
}

window.toggleReview = function(id, btn) {
    const body = document.getElementById(id);
    if (!body) return;
    const collapsed = body.classList.toggle('clamped');
    btn.textContent = collapsed ? 'Read More' : 'Show Less';
};

// --- NEW FEATURE: SIMILAR TITLES ---
function renderSimilar(data) {
    const container = document.getElementById('similar-container');
    const section = document.getElementById('similar-section');
    
    // Safety Check: Hide section if no data
    if (!data || !data.results || data.results.length === 0) {
        if(section) section.classList.add('hidden');
        return;
    }

    // Clear previous content
    if(container) container.innerHTML = '';
    if(section) section.classList.remove('hidden');

    // Reuse existing card renderer
    // We explicitly set media_type because 'similar' endpoints return specific types
    const results = data.results.map(item => ({ ...item, media_type: mediaType }));
    
    if(container) renderCards(results, container, false);
}

// --- UPDATED: FULL LOCALIZATION (Videos, Gallery, Keywords, Genres synced) ---
function handleTranslations(data) {
    if (!data.translations || !data.translations.translations) return;

    // 1. Elements to Update
    const overviewEl = document.getElementById('detail-overview');
    const titleEl = document.getElementById('detail-heading');
    const taglineEl = document.getElementById('detail-tagline');
    const posterImg = document.getElementById('detail-poster');
    const bgContainer = document.getElementById('page-background');
    const logoImg = document.getElementById('detail-logo');

    // Remove existing selector
    const existingSelector = document.getElementById('lang-selector-container');
    if (existingSelector) existingSelector.remove();

    // 2. Filter Valid Translations
    const availableTranslations = data.translations.translations.filter(t =>
        (t.data.overview && t.data.overview.trim() !== "") ||
        (t.data.title && t.data.title.trim() !== "")
    );

    if (availableTranslations.length === 0) return;

    // 3. Store Original Data (English/Default)
    const originalVideos = (data.videos && data.videos.results) ? data.videos.results : [];
    const originalGallery = (data.images && data.images.backdrops && data.images.backdrops.length > 0)
        ? data.images.backdrops
        : (data.images ? data.images.posters || [] : []);
    const originalKeywords = data.keywords ? (data.keywords.keywords || data.keywords.results || []) : [];
    const originalGenres = data.genres || [];

    const originalData = {
        title: currentTitle || titleEl.innerText,
        overview: overviewEl.innerText,
        tagline: taglineEl.innerText,
        poster: posterImg.src,
        backdrop: bgContainer.style.backgroundImage,
        logoSrc: logoImg.src,
        logoDisplay: logoImg.style.display,
        titleDisplay: titleEl.style.display
    };

    // --- Helper: Render Videos ---
    function renderVideos(videos) {
        const videoContainer = document.getElementById('videos-container');
        const videoList = document.getElementById('videos-list');
        if (!videoContainer || !videoList) return;

        const filtered = videos.filter(v => v.site === "YouTube" || v.site === "Vimeo");
        if (filtered.length === 0) {
            videoContainer.classList.add('hidden');
            return;
        }

        videoContainer.classList.remove('hidden');
        videoList.innerHTML = '';

        filtered.sort((a, b) => {
            const typeOrder = { "Trailer": 1, "Teaser": 2, "Featurette": 3, "Clip": 4 };
            return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
        });

        filtered.forEach(video => {
            const div = document.createElement('div');
            div.className = "video-card flex-shrink-0 group";
            const thumbSrc = video.site === "YouTube"
                ? `https://img.youtube.com/vi/${video.key}/hqdefault.jpg`
                : "https://placehold.co/480x360/1f1f1f/ffffff?text=Vimeo+Video";

            div.innerHTML = `
                <div class="video-thumbnail">
                    <img src="${thumbSrc}" loading="lazy" alt="${video.name}">
                    <div class="absolute inset-0 flex items-center justify-center">
                        <i class="fas fa-play-circle text-4xl text-white opacity-90 group-hover:scale-110 transition-transform drop-shadow-lg"></i>
                    </div>
                </div>
                <div class="video-info">
                    <div class="video-type">${video.type}</div>
                    <div class="video-title">${video.name}</div>
                </div>
            `;
            div.onclick = () => {
                const modal = document.getElementById('trailer-modal');
                const iframe = document.getElementById('trailer-iframe');
                modal.classList.remove('hidden');
                iframe.src = video.site === "YouTube"
                    ? `https://www.youtube-nocookie.com/embed/${video.key}?autoplay=1&rel=0`
                    : `https://player.vimeo.com/video/${video.key}?autoplay=1`;
            };
            videoList.appendChild(div);
        });
        updateScrollButtons(videoList);
    }

    // --- Helper: Render Gallery ---
    function renderGallery(images) {
        const galleryContainer = document.getElementById('gallery-container');
        const galleryList = document.getElementById('gallery-list');
        if (!galleryContainer || !galleryList) return;

        if (!images || images.length === 0) {
            galleryContainer.classList.add('hidden');
            return;
        }

        galleryContainer.classList.remove('hidden');
        galleryList.innerHTML = '';

        images.slice(0, 15).forEach(img => {
            const imgUrl = `${TMDB_POSTER_MD}${img.file_path}`;
            const fullUrl = `${TMDB_BACKDROP_WEB}${img.file_path}`;
            const div = document.createElement('div');
            div.className = "gallery-item group relative flex-shrink-0 cursor-pointer w-48 md:w-64";
            div.innerHTML = `
                <img src="${imgUrl}" loading="lazy" alt="Gallery Image">
                <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <i class="fas fa-expand-alt text-white text-xl"></i>
                </div>
            `;
            div.onclick = () => openLightbox(fullUrl, "Image");
            galleryList.appendChild(div);
        });
        updateScrollButtons(galleryList);
    }

    // --- Helper: Render Genres ---
    function renderGenres(genres) {
        const genreContainer = document.getElementById('detail-genres');
        if (!genreContainer) return;
        genreContainer.innerHTML = '';
        genres.forEach(g => {
            const tag = document.createElement('span');
            tag.className = 'px-3 py-1 bg-white/10 text-gray-200 text-xs rounded-full border border-white/10 cursor-pointer hover:bg-white/20 transition';
            tag.textContent = g.name;
            tag.onclick = () => quickFilter('genre', g.id, g.name);
            genreContainer.appendChild(tag);
        });
    }

    // --- Helper: Render Keywords ---
    function renderKeywords(keywords) {
        const existingTags = document.getElementById('detail-keywords');
        if (existingTags) existingTags.remove();

        const genreContainer = document.getElementById('detail-genres');
        if (!genreContainer || keywords.length === 0) return;

        const keywordContainer = document.createElement('div');
        keywordContainer.id = 'detail-keywords';
        keywordContainer.className = "flex flex-wrap gap-2 mb-6 mt-2";

        keywords.slice(0, 15).forEach(k => {
            const span = document.createElement('span');
            span.className = "keyword-tag";
            span.innerHTML = `<i class="fas fa-hashtag text-[10px] text-gray-500 mr-1"></i>${k.name}`;
            span.onclick = () => {
                quickFilter('keyword', k.id, k.name);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
            keywordContainer.appendChild(span);
        });
        genreContainer.parentNode.insertBefore(keywordContainer, genreContainer.nextSibling);
    }

    // 4. Create UI
    const container = document.createElement('div');
    container.id = 'lang-selector-container';
    container.className = "mb-4 animate-fade-in flex items-center gap-3";

    const iconLabel = document.createElement('div');
    iconLabel.innerHTML = `<i class="fas fa-language text-xl text-gray-400"></i>`;

    const select = document.createElement('select');
    select.className = "glass-select p-2 rounded-lg text-sm cursor-pointer outline-none focus:border-red-500 transition-colors";
    select.style.minWidth = "160px";

    const defaultOption = document.createElement('option');
    defaultOption.value = 'en-US';
    defaultOption.text = 'English (Original)';
    select.appendChild(defaultOption);

    // 5. Sort & Populate (Sinhala First)
    const langNames = new Intl.DisplayNames(['en'], { type: 'language' });

    availableTranslations.sort((a, b) => {
        if (a.iso_639_1 === 'si') return -1;
        if (b.iso_639_1 === 'si') return 1;
        return a.english_name.localeCompare(b.english_name);
    });

    availableTranslations.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.iso_639_1;
        let displayName = t.english_name;
        try { displayName = langNames.of(t.iso_639_1); } catch (e) {}
        opt.textContent = displayName;
        select.appendChild(opt);
    });

    // 6. Handle Change
    select.onchange = async () => {
        const selectedLang = select.value;

        // --- A. REVERT TO ORIGINAL ---
        if (selectedLang === 'en-US') {
            titleEl.innerText = originalData.title;
            overviewEl.innerText = originalData.overview;
            taglineEl.innerText = originalData.tagline;
            taglineEl.classList.remove('hidden');

            posterImg.src = originalData.poster;
            bgContainer.style.backgroundImage = originalData.backdrop;

            logoImg.src = originalData.logoSrc;
            logoImg.style.display = originalData.logoDisplay;
            titleEl.style.display = originalData.titleDisplay;

            if (originalData.poster) {
                getDominantColor(originalData.poster).then(rgb => {
                    document.documentElement.style.setProperty('--ambient-color', rgb);
                });
            }

            // Revert all synced sections to original
            renderVideos(originalVideos);
            renderGallery(originalGallery);
            renderGenres(originalGenres);
            renderKeywords(originalKeywords);
            return;
        }

        // --- B. APPLY TRANSLATION ---

        // 1. Text Swap
        const translation = availableTranslations.find(t => t.iso_639_1 === selectedLang);
        if (translation) {
            titleEl.innerText = translation.data.title || originalData.title;
            overviewEl.innerText = translation.data.overview || originalData.overview;
            if (translation.data.tagline) {
                taglineEl.innerText = translation.data.tagline;
                taglineEl.classList.remove('hidden');
            } else {
                taglineEl.classList.add('hidden');
            }
        }

        if (!TMDB_ID || !mediaType) return;

        // Visual loading feedback
        const castList = document.getElementById('cast-list');
        const crewList = document.getElementById('crew-list');
        const videoList = document.getElementById('videos-list');
        const galleryList = document.getElementById('gallery-list');
        castList.style.opacity = '0.5';
        crewList.style.opacity = '0.5';
        posterImg.style.opacity = '0.7';
        if (videoList) videoList.style.opacity = '0.5';
        if (galleryList) galleryList.style.opacity = '0.5';

        try {
            const [creditsData, imageData, videoData, keywordData, genreData] = await Promise.all([
                fetchCached(`${BASE_TMDB_URL}/${mediaType}/${TMDB_ID}/credits?api_key=${TMDB_API_KEY}&language=${selectedLang}`),
                fetchCached(`${BASE_TMDB_URL}/${mediaType}/${TMDB_ID}/images?api_key=${TMDB_API_KEY}&include_image_language=${selectedLang},null,en`),
                fetchCached(`${BASE_TMDB_URL}/${mediaType}/${TMDB_ID}/videos?api_key=${TMDB_API_KEY}&language=${selectedLang}`),
                fetchCached(`${BASE_TMDB_URL}/${mediaType}/${TMDB_ID}/keywords?api_key=${TMDB_API_KEY}`),
                fetchCached(`${BASE_TMDB_URL}/genre/${mediaType}/list?api_key=${TMDB_API_KEY}&language=${selectedLang}`)
            ]);

            // --- 2. IMAGE SWAP ---
            const newPoster = imageData.posters.find(p => p.iso_639_1 === selectedLang) || imageData.posters[0];
            if (newPoster) {
                const newPosterUrl = `${TMDB_POSTER_LG}${newPoster.file_path}`;
                posterImg.src = newPosterUrl;
                getDominantColor(newPosterUrl).then(rgb => {
                    document.documentElement.style.setProperty('--ambient-color', rgb);
                });
            }

            const newBackdrop = imageData.backdrops.find(b => b.iso_639_1 === selectedLang) || imageData.backdrops[0];
            if (newBackdrop) {
                bgContainer.style.backgroundImage = `url('${TMDB_BACKDROP_WEB}${newBackdrop.file_path}')`;
            }

            // Logo Logic
            const newLogo = imageData.logos.find(l => l.iso_639_1 === selectedLang);
            if (newLogo) {
                logoImg.src = `${TMDB_POSTER_XL}${newLogo.file_path}`;
                logoImg.style.display = 'block';
                titleEl.style.display = 'none';
            } else {
                logoImg.style.display = 'none';
                titleEl.style.display = 'block';
            }

            // --- 3. CREDITS SWAP ---
            castList.innerHTML = '';
            if (creditsData.cast && creditsData.cast.length > 0) {
                creditsData.cast.forEach(c => {
                    const picHtml = getPersonFace(c.profile_path, c.gender, "cast-img");
                    const div = document.createElement('div');
                    div.className = 'cast-card';
                    div.innerHTML = `
                        ${picHtml}
                        <div class="cast-name">${c.name}</div>
                        <div class="cast-char">${c.character}</div>
                    `;
                    div.onclick = () => loadActorCredits(c.id, c.name, c.profile_path, c.gender);
                    castList.appendChild(div);
                });
            } else {
                castList.innerHTML = '<div class="text-gray-500 text-sm p-2">No cast info in this language.</div>';
            }

            crewList.innerHTML = '';
            if (creditsData.crew && creditsData.crew.length > 0) {
                const uniqueCrew = [];
                const map = new Map();
                creditsData.crew.forEach(c => {
                    if (!map.has(c.id)) { map.set(c.id, true); uniqueCrew.push(c); }
                });
                uniqueCrew.slice(0, 20).forEach(c => {
                    const picHtml = getPersonFace(c.profile_path, c.gender, "cast-img");
                    const div = document.createElement('div');
                    div.className = 'cast-card';
                    div.innerHTML = `
                        ${picHtml}
                        <div class="cast-name">${c.name}</div>
                        <div class="crew-job">${c.job}</div>
                    `;
                    div.onclick = () => loadActorCredits(c.id, c.name, c.profile_path, c.gender);
                    crewList.appendChild(div);
                });
            }

            // --- 4. VIDEOS SWAP ---
            // Only show videos for the selected language; hide section if none exist
            const newVideos = (videoData && videoData.results) ? videoData.results : [];
            renderVideos(newVideos);

            // --- 5. GALLERY SWAP ---
            const newBackdrops = imageData.backdrops && imageData.backdrops.length > 0
                ? imageData.backdrops
                : (imageData.posters || []);
            renderGallery(newBackdrops);

            // --- 6. GENRES SWAP ---
            // Map the original genre IDs against the localized genre name list
            const localizedGenreMap = new Map((genreData.genres || []).map(g => [g.id, g.name]));
            const localizedGenres = originalGenres.map(g => ({
                id: g.id,
                name: localizedGenreMap.get(g.id) || g.name
            }));
            renderGenres(localizedGenres);

            // --- 7. KEYWORDS SWAP ---
            // Keywords are language-independent from TMDB (names don't change), but
            // we re-render to keep DOM clean after genre swap re-inserts after genres
            const newKeywords = keywordData
                ? (keywordData.keywords || keywordData.results || [])
                : originalKeywords;
            renderKeywords(newKeywords);

        } catch (e) {
            console.error("Translation fetch failed", e);
        } finally {
            castList.style.opacity = '1';
            crewList.style.opacity = '1';
            posterImg.style.opacity = '1';
            if (videoList) videoList.style.opacity = '1';
            if (galleryList) galleryList.style.opacity = '1';
        }
    };

    container.appendChild(iconLabel);
    container.appendChild(select);

    if (overviewEl.parentNode) {
        overviewEl.parentNode.insertBefore(container, overviewEl);
    }
}

function handleSearchSubmit(query) {
    // 1. Set the global query state
    currentSearchQuery = query;
    
    // 2. Reset filters that are incompatible with Text Search
    // (TMDB Search API does not support Genre or specific Sorting)
    document.getElementById('filter-genre').value = "";
    if(document.getElementById('filter-sort')) {
        document.getElementById('filter-sort').value = "popularity.desc"; 
    }
    
    // 3. Apply the filter (which will now detect the text query)
    applyFilter();
    
    // 4. Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- MOBILE NAVBAR & DRAWER LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    const mobileItems = document.querySelectorAll('.mobile-item');
    const currentPath = window.location.pathname;

    // Auto-detect active page and highlight the correct icon
    mobileItems.forEach(item => {
        const linkObj = item.querySelector('a');
        if (linkObj) {
            const link = linkObj.getAttribute('href');
            // Check if current URL path matches the href
            if (link !== '#' && currentPath.includes(link.replace('./', ''))) {
                item.classList.add('active');
            }
        }
    });
});

// Close drawer when clicking anywhere outside of it
document.addEventListener('click', function(e) {
    const drawer = document.getElementById('mobile-more-drawer');
    const moreBtn = document.getElementById('more-menu-btn');
    
    if (drawer && drawer.classList.contains('open')) {
        // If the click is NOT inside the drawer and NOT on the toggle button
        if (!drawer.contains(e.target) && !moreBtn.contains(e.target)) {
            drawer.classList.remove('open');
            // FIX: Also remove the active state from the button
            moreBtn.classList.remove('active'); 
        }
    }
});

// Function to toggle the drawer
window.toggleMoreMenu = function() {
    const drawer = document.getElementById('mobile-more-drawer');
    const moreBtn = document.getElementById('more-menu-btn');
    
    drawer.classList.toggle('open');
    moreBtn.classList.toggle('active');
};

window.toggleMobileNav = function(hide) {
    const nav = document.querySelector('.mobile-nav');
    if (nav) {
        if (hide) nav.classList.add('nav-hidden-down');
        else nav.classList.remove('nav-hidden-down');
    }
};
