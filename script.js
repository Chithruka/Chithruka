// --- TMDB CONFIGURATION ---
const TMDB_ENCODED = "OTI4NTBhNzllNTA5MTdiOGNjMTk2MjM0NTVhZTIyNDA=";
const TMDB_API_KEY = getTmdbKey();
const BASE_TMDB_URL = 'https://api.themoviedb.org/3';
const TMDB_IMG_BASE_URL = 'https://image.tmdb.org/t/p/w92';
const TMDB_POSTER_MD = 'https://image.tmdb.org/t/p/w342';
const TMDB_POSTER_LG = 'https://image.tmdb.org/t/p/w300';
const TMDB_POSTER_XL = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_WEB = 'https://image.tmdb.org/t/p/w1280';
const TMDB_STILL_SZ = 'https://image.tmdb.org/t/p/w300';

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
    { name: "Server 1", movie: "https://vidsrc.to/embed/movie/[ID]", tv: "https://vidsrc.to/embed/tv/[ID]/[S]/[E]" },
    { name: "Server 2", movie: "https://vidlink.pro/movie/[ID]", tv: "https://vidlink.pro/tv/[ID]/[S]/[E]" },
    { name: "Server 3", movie: "https://multiembed.mov/?video_id=[ID]&tmdb=1", tv: "https://multiembed.mov/?video_id=[ID]&tmdb=1&s=[S]&e=[E]" },
    { name: "Server 4", movie: "https://vidsrc.vip/embed/movie/[ID]", tv: "https://vidsrc.vip/embed/tv/[ID]/[S]/[E]" },
    { name: "Server 5", movie: "https://www.vidking.net/embed/movie/[ID]?color=e50914&nextEpisode=true&episodeSelector=true", tv: "https://www.vidking.net/embed/tv/[ID]/[S]/[E]?color=e50914&nextEpisode=true&episodeSelector=true" }
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
let aiModalOpen = false;
let userCountryCode = 'US';
let DUBBED_REGISTRY = {};

// --- Auth State ---
let sessionId = localStorage.getItem('tmdb_session_id');
let accountId = localStorage.getItem('tmdb_account_id');

const requestCache = new Map();

async function fetchCached(url) {
    // 1. Create a clean cache key (remove keys to avoid duplicates in key name)
    const cacheKey = "tmdb_" + url.replace(TMDB_API_KEY, "").replace(GEMINI_API_KEY, "");
    
    // 2. Cache Duration: 1 Hour (in milliseconds)
    const CACHE_DURATION = 1000 * 60 * 60; 

    // 3. Try Local Storage
    try {
        const cachedRecord = localStorage.getItem(cacheKey);
        if (cachedRecord) {
            const { timestamp, data } = JSON.parse(cachedRecord);
            // Check if expired
            if (Date.now() - timestamp < CACHE_DURATION) {
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

        // 5. Save to Local Storage
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
        const response = await fetch('registry.json');
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

// --- HELPER FUNCTIONS ---
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

function getDominantColor(imageUrl) {
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

            // --- NEW: Force Darken the Color ---
            // We multiply by 0.3 to keep only 30% of the brightness.
            // This ensures even bright white becomes dark grey.
            r = Math.floor(r * 0.3);
            g = Math.floor(g * 0.3);
            b = Math.floor(b * 0.3);

            resolve(`${r}, ${g}, ${b}`);
        };
        img.onerror = () => resolve('20, 20, 20'); // Default to dark grey, not black
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
    // 1. Reset the UI
    searchInput.value = `AI Search`;
    searchResults.innerHTML = '';
    heroSection.style.display = 'none';
    document.getElementById('top10-section').style.display = 'none';
    detailsSection.classList.add('hidden');
    playerInterface.classList.add('hidden');
    collectionSection.classList.add('hidden');
    document.getElementById('continue-watching-section').classList.add('hidden');
    
    // 2. Set the Header
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

    // 4. Smart Search Loop
    const searchPromises = resultsList.map(async (item) => {
        // Handle case where item might be just a string (legacy support)
        const cleanName = item.name || item; 
        const type = item.type || 'movie';

        try {
            let url = "";
            
            // ROUTE TO CORRECT ENDPOINT
            if (type === 'company') {
                url = `${BASE_TMDB_URL}/search/company?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanName)}`;
            } else {
                // Multi search handles 'movie', 'tv', and 'person'
                url = `${BASE_TMDB_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanName)}&include_adult=true`;
            }

            const data = await fetchCached(url);
            
            if (!data.results || data.results.length === 0) return null;

            // Take the best match
            const bestMatch = data.results[0];

            if (bestMatch) {
                // Force media_type for companies since API doesn't always return it in 'search/company'
                if (type === 'company') bestMatch.media_type = 'company';
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
        const uniqueResults = Array.from(new Map(validResults.map(item => [item.id, item])).values());

        trendingContainer.innerHTML = '';
        
        if (uniqueResults.length > 0) {
            renderCards(uniqueResults, trendingContainer, true);
        } else {
            trendingContainer.innerHTML = '<div class="text-gray-400 p-4">No results found.</div>';
        }

        updateScrollButtons(trendingContainer);
        setTimeout(() => {
            header.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

    } catch (e) {
        console.error("AI Result Display Error", e);
        trendingContainer.innerHTML = '<div class="text-red-500 p-4">Error loading AI results.</div>';
    }
}

// In script.js

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
        setTimeout(() => {
            header.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

    } catch (e) {
        console.error("AI Result Display Error", e);
        trendingContainer.innerHTML = '<div class="text-red-500 p-4">Error loading AI results.</div>';
    }
}

// --- AUTHENTICATION FUNCTIONS ---
async function authenticateTMDB() {
    try {
        const res = await fetch(`${BASE_TMDB_URL}/authentication/token/new?api_key=${TMDB_API_KEY}`, { cache: "no-store" });
        const data = await res.json();
        if (data.success) {
            const redirectUrl = window.location.origin + window.location.pathname;
            window.location.href = `https://www.themoviedb.org/authenticate/${data.request_token}?redirect_to=${encodeURIComponent(redirectUrl)}`;
        }
    } catch (e) {
        showMessage("Auth failed", true);
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

    setTimeout(() => {
        header.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

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
    currentFetchUrl = "";
    trendingPage = 1;
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    trendingContainer.innerHTML = '';
    loadTrending();
    loadLatestTrailers();
}
function getActiveServers() {
    // Create a shallow copy of the base URLs
    const servers = [...BASE_SERVER_URLS];
    let hasLocalServer = false;

    // Check if the current content exists in the local JSON
    if (mediaType === 'movie') {
        hasLocalServer = !!(LOCAL_VIDEOS.movies && LOCAL_VIDEOS.movies[TMDB_ID]);
    } else if (mediaType === 'tv') {
        // Safe navigation through Season and Episode
        hasLocalServer = !!LOCAL_VIDEOS.tv?.[TMDB_ID]?.[currentSeason]?.[currentEpisode];
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
    source1: { movie: "https://dl.vidsrc.vip/movie/[ID]", tv: "https://dl.vidsrc.vip/tv/[ID]/[S]/[E]" },
    source2: { movie: "https://godriveplayer.com/download.php?type=movie&tmdb=[ID]", tv: "https://godriveplayer.com/download.php?type=series&tmdb=[ID]&season=[S]&episode=[E]" }
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

function showMessage(text, isError = false) {
    messageBox.textContent = text;
    messageBox.className = `fixed bottom-5 right-5 p-4 rounded-lg shadow-lg z-50 text-white font-semibold max-w-sm text-center ${isError ? 'bg-red-700' : 'bg-blue-600'}`;
    messageBox.classList.remove('hidden');
    setTimeout(() => messageBox.classList.add('hidden'), 3000);
}

window.scrollContainer = function(id, amount) {
    document.getElementById(id).scrollBy({ left: amount, behavior: 'smooth' });
}

trendingContainer.addEventListener('scroll', () => {
    if (trendingContainer.scrollLeft + trendingContainer.clientWidth >= trendingContainer.scrollWidth - 200) {
        loadTrending();
    }
});

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
            data = await fetchCached(`${activeUrl}&page=${trendingPage}`);
            const type = activeUrl.includes('/tv?') ? 'tv' : 'movie';
            data.results = data.results.map(i => ({ ...i, media_type: type }));
        } else {
            data = await fetchCached(`${BASE_TMDB_URL}/trending/all/day?api_key=${TMDB_API_KEY}&page=${trendingPage}`);
            if (trendingPage === 1) {
                const urlParams = new URLSearchParams(window.location.search);
                if (!urlParams.has('id')) {
                    // Don't clear container here, we handle it below
                    initHero(data.results.slice(0, 5));
                    renderTop10(data.results.slice(0, 10));
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

    const validItems = items.filter(i => i.media_type !== 'person');

    for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i];
        const title = item.title || item.name;
        const backdrop = item.backdrop_path ? `${TMDB_BACKDROP_WEB}${item.backdrop_path}` : null;
        if (!backdrop) continue;

        let logoUrl = null;
        try {
            const imgData = await fetchCached(`${BASE_TMDB_URL}/${item.media_type}/${item.id}/images?api_key=${TMDB_API_KEY}`);
            const logo = imgData.logos.find(l => l.iso_639_1 === 'en') || imgData.logos[0];
            if (logo) logoUrl = `${TMDB_POSTER_XL}${logo.file_path}`;
        } catch (e) { }

        const slide = document.createElement('div');
        slide.className = `hero-slide ${i === 0 ? 'active' : ''}`;
        slide.style.backgroundImage = `url('${backdrop}')`;

        const titleHtml = logoUrl
            ? `<img src="${logoUrl}" class="hero-logo" alt="${title}" loading="lazy">`
            : `<h1 class="text-3xl md:text-5xl font-bold mb-4 text-white drop-shadow-lg">${title}</h1>`;

        slide.innerHTML = `
                <div class="hero-overlay">
                    <div class="hero-content fade-in">
                        ${titleHtml}
                        <p class="hero-text text-white text-gray-200">${item.overview}</p>
                        <button onclick="selectContent(${item.id}, '${title.replace(/'/g, "\\'")}', '${item.media_type}')" class="action-btn btn-play text-base md:text-lg px-6 md:px-8 py-2 md:py-3">
                            <i class="fas fa-play mr-2"></i> Watch Now
                        </button>
                    </div>
                </div>
            `;
        slidesContainer.appendChild(slide);

        const ind = document.createElement('div');
        ind.className = `indicator ${i === 0 ? 'active' : ''}`;
        ind.onclick = () => showHeroSlide(i);
        indicatorsContainer.appendChild(ind);
    }

    if (heroInterval) clearInterval(heroInterval);
    heroInterval = setInterval(() => {
        let activeIndex = Array.from(document.querySelectorAll('.hero-slide')).findIndex(s => s.classList.contains('active'));
        let nextIndex = (activeIndex + 1) % validItems.length;
        showHeroSlide(nextIndex);
    }, 6000);
}

function showHeroSlide(index) {
    const slides = document.querySelectorAll('.hero-slide');
    const indicators = document.querySelectorAll('.indicator');
    slides.forEach(s => s.classList.remove('active'));
    indicators.forEach(i => i.classList.remove('active'));
    if (slides[index]) slides[index].classList.add('active');
    if (indicators[index]) indicators[index].classList.add('active');
}

function renderTop10(items) {
    top10Container.innerHTML = '';
    items.forEach((item, index) => {
        if (item.media_type === 'person') return;
        const title = item.title || item.name;
        const poster = item.poster_path ? `${TMDB_POSTER_MD}${item.poster_path}` : null;
        if (!poster) return;

        const card = document.createElement('div');
        card.className = 'top-10-card';
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
                        <span class="rating-badge"><i class="fas fa-star mr-1"></i>${rating}</span>
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
            fetchCached(`${BASE_TMDB_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=true`),
            fetchCached(`${BASE_TMDB_URL}/search/collection?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`),
            fetchCached(`${BASE_TMDB_URL}/search/company?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`),
            fetchCached(`${BASE_TMDB_URL}/search/keyword?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`)
        ]);

        // Process and Tag Results manually since specific endpoints don't add media_type
        const multiData = (multiRes.results || []).slice(0, 6); // Top 6 standard results
        
        const collections = (collectionRes.results || []).slice(0, 2).map(i => ({ ...i, media_type: 'collection' }));
        const companies = (companyRes.results || []).slice(0, 2).map(i => ({ ...i, media_type: 'company' }));
        const keywords = (keywordRes.results || []).slice(0, 2).map(i => ({ ...i, media_type: 'keyword' }));

        // Merge them: Priority -> Collections/Companies/Keywords at top if relevant, then Movies/TV
        const combinedResults = [...collections, ...companies, ...keywords, ...multiData];

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
    document.getElementById('trending-header').scrollIntoView({ behavior: 'smooth', block: 'start' });

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
    loadGenres();
    loadCountries();
    loadLanguages();
};
window.closeFilterModal = () => filterModal.classList.add('hidden');
filterModal.addEventListener('click', e => { if (e.target === filterModal) closeFilterModal(); });

async function loadGenres() {
    const type = document.getElementById('filter-type').value;
    
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

    // Allow passing specific types like 'company', 'keyword', or 'network'
    let overrides = { logoPath: logo };
    overrides[type] = value;
    
    applyFilter(overrides);
}

window.clearFilters = function() {
    // --- FIX: Reset text search state ---
    currentSearchQuery = ""; 
    
    // Reset Inputs
    document.getElementById('filter-genre').value = "";
    document.getElementById('filter-country').value = "";
    document.getElementById('filter-language').value = ""; 
    document.getElementById('filter-year').value = "";
    document.getElementById('filter-rating').value = "";
    
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

    trendingContainer.innerHTML = '';
    loadedIds.clear();
    trendingPage = 1;
    
    currentFetchUrl = ""; 
    
    loadTrending();
}

async function applyFilter(overrides = {}) {
    // 1. Get current settings from UI
    let type = document.getElementById('filter-type').value || 'movie';

    // 2. Extract values (Prioritize overrides -> then DOM elements)
    let genre = overrides.genre ? String(overrides.genre) : document.getElementById('filter-genre').value;
    const country = overrides.country || document.getElementById('filter-country').value;
    const language = overrides.language || document.getElementById('filter-language').value; 
    const year = overrides.year || document.getElementById('filter-year').value;
    const rating = overrides.rating || document.getElementById('filter-rating').value;
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
        if(document.getElementById('filter-type')) document.getElementById('filter-type').value = 'tv';
    }

    // Handle Genre Mapping (Action/Adventure splits)
    const GENRE_MAPPING = {
        '10759': '28|12', '10765': '878|14', '10768': '10752', '10762': '10751',
        '28': '10759', '12': '10759', '878': '10765', '14': '10765', '10752': '10768',
    };
    if (genre && GENRE_MAPPING[genre]) {
        if (type === 'movie' && ['10759', '10765', '10768', '10762'].includes(genre)) genre = GENRE_MAPPING[genre];
        else if (type === 'tv' && ['28', '12', '878', '14', '10752'].includes(genre)) genre = GENRE_MAPPING[genre];
    }

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

    // ==========================================
    // HEADER TEXT GENERATION (FIXED)
    // ==========================================
    let headerStr = "";

    if (textSearch) {
        headerStr = `Results for "${textSearch}"`;
        if (year) headerStr += ` (${year})`;
    } 
    else if (overrides.company || overrides.network) {
        headerStr = activeFilterLabel ? `Titles from ${activeFilterLabel}` : "Production Search";
    } 
    else if (overrides.keyword) {
        headerStr = `Keyword: ${activeFilterLabel}`;
    } 
    else {
        // 1. Base Title (Genre + Type)
        let genreText = "All";
        if (genre) {
            // Use the label if we just clicked a tag, otherwise fetch from dropdown
            if (overrides.genre && activeFilterLabel) {
                genreText = activeFilterLabel;
            } else {
                const option = document.querySelector(`#filter-genre option[value="${genre}"]`);
                if (option) genreText = option.text;
            }
        }
        headerStr = `${genreText} ${type === 'movie' ? "Movies" : "TV Shows"}`;

        // 2. Country
        if (country) {
            let countryName = country;
            if (overrides.country && activeFilterLabel) {
                countryName = activeFilterLabel;
            } else {
                const option = document.querySelector(`#filter-country option[value="${country}"]`);
                if (option) countryName = option.text;
            }
            headerStr += ` from ${countryName}`;
        }

        // 3. Language
        if (language) {
            const option = document.querySelector(`#filter-language option[value="${language}"]`);
            const langName = option ? option.text : language.toUpperCase();
            headerStr += ` in ${langName}`;
        }

        // 4. Year
        if (year) {
            headerStr += ` released in ${year}`;
        }

        // 5. Rating
        if (rating) {
            headerStr += ` Rated ${rating}+`;
        }
    }
    
    document.getElementById('trending-header').innerHTML = headerStr;

    // ==========================================
    // BUILD URL
    // ==========================================
    let urlBase = "";

    if (textSearch) {
        urlBase = `${BASE_TMDB_URL}/search/${type}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(textSearch)}&include_adult=${includeAdult}`;
        if (year) {
            if (type === 'movie') urlBase += `&primary_release_year=${year}`;
            else if (type === 'tv') urlBase += `&first_air_date_year=${year}`;
        }
        if (language) urlBase += `&language=${language}`;
    } else {
        urlBase = `${BASE_TMDB_URL}/discover/${type}?api_key=${TMDB_API_KEY}&include_adult=${includeAdult}&include_video=false`;
        
        let finalSort = document.getElementById('filter-sort') ? document.getElementById('filter-sort').value : 'popularity.desc';
        if (type === 'tv' && finalSort.includes('primary_release_date')) {
            finalSort = finalSort.replace('primary_release_date', 'first_air_date');
        }
        urlBase += `&sort_by=${finalSort}`;
        
        if (finalSort.startsWith('vote_average')) urlBase += '&vote_count.gte=200';

        if (year) {
            if (type === 'movie') urlBase += `&primary_release_year=${year}`;
            else if (type === 'tv') urlBase += `&first_air_date_year=${year}`;
        }
        if (genre) urlBase += `&with_genres=${genre}`;
        if (rating) urlBase += `&vote_average.gte=${rating}`;
        if (country) urlBase += `&with_origin_country=${country}`;
        if (company) urlBase += `&with_companies=${company}`;
        if (network) urlBase += `&with_networks=${network}`;
        if (language) urlBase += `&with_original_language=${language}`;
        if (keyword) urlBase += `&with_keywords=${keyword}`;
    }

    currentFetchUrl = urlBase;

    // ==========================================
    // FETCH & RENDER
    // ==========================================
    trendingContainer.innerHTML = '';
    renderSkeletons(trendingContainer, 10);
    loadedIds.clear();
    trendingPage = 1;

    try {
        const data = await fetchCached(`${currentFetchUrl}&page=1`);
        let results = (data.results || []).map(i => ({ ...i, media_type: type }));

        if (year) {
            results = results.filter(item => {
                const date = item.release_date || item.first_air_date;
                return date && date.substring(0, 4) === year.toString();
            });
        }

        trendingContainer.innerHTML = '';

        if (results.length === 0) {
            trendingContainer.innerHTML = '<div class="text-gray-400 p-4">No results found matching your criteria.</div>';
            currentFetchUrl = "STOP";
        } else {
            renderCards(results, trendingContainer, true);
            trendingPage = 2; 
        }
        document.getElementById('trending-header').scrollIntoView({ behavior: 'smooth' });
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

    loadRecommendations(mediaType, id);
    loadSoundtrack(currentTitle); 

    setTimeout(() => { detailsSection.scrollIntoView({ behavior: 'smooth' }); }, 100);
}

window.scrollTo({ top: 0, behavior: 'smooth' });

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
        updatePlayer();
    } catch (e) { 
        showMessage("Failed to load show details.", true); 
        console.error(e); 
    }
}

async function loadCollection(collectionId, collectionName) {
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
    } catch (e) { console.error("Collection Load Error", e); }
}

window.changeSeason = async function(seasonVal) {
    currentSeason = parseInt(seasonVal);
    currentEpisode = 1;

    const selectedSeasonData = episodeData.find(s => s.season === currentSeason);
    if (selectedSeasonData) {
        updateSeasonStatusUI(selectedSeasonData.air_date);
    }

    episodeAccordionContent.innerHTML = '<div class="text-center p-4 text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i>Loading Season...</div>';
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
            <div class="episode-rich-item ${isActive ? 'active' : ''}" onclick="selectEpisode(${ep.season_number}, ${ep.episode_number}, this)">
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

    // Poster Image
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
    // 9. VIDEOS SECTION
    // ============================================================
    const videoContainer = document.getElementById('videos-container');
    const videoList = document.getElementById('videos-list');

    if (videoContainer && videoList) {
        videoList.innerHTML = '';
        
        const videos = (data.videos && data.videos.results) 
            ? data.videos.results.filter(v => v.site === "YouTube" || v.site === "Vimeo") 
            : [];

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
    let url = tpl.replace(/\[ID\]/g, TMDB_ID);
    if (mediaType === 'movie' && url.includes('[IMDB_ID]')) {
        if (!IMDB_ID) return "about:blank";
        url = url.replace(/\[IMDB_ID\]/g, IMDB_ID);
    }
    if (mediaType === 'tv') {
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
                    document.getElementById('season-select').value = item.season;
                    changeSeason(item.season).then(() => {
                        selectEpisode(item.season, item.episode, null);
                    });
                }, 1000);
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
    if (nextE > episodeData[sIndex].episodes) {
        if (episodeData[sIndex + 1]) {
            nextS = episodeData[sIndex + 1].season;
            nextE = 1;
            document.getElementById('season-select').value = nextS;
            changeSeason(nextS).then(() => {
                selectEpisode(nextS, nextE, null);
            });
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

    // --- NEW: Update Release Status for this specific Episode ---
    if (typeof seasonEpisodes !== 'undefined' && seasonEpisodes.length > 0) {
        const epData = seasonEpisodes.find(ep => ep.episode_number === e);
        if (epData) {
            updateSeasonStatusUI(epData.air_date);
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

window.openDownloadModal = function() {
    // 1. Ensure a movie/show is actually selected using the correct global variables
    if (!TMDB_ID || !mediaType) {
        showMessage("No content selected to download.", true);
        return;
    }

    const modal = document.getElementById('download-modal');
    const dlLink1 = document.getElementById('dl-link-1');
    const dubbedBtn = document.getElementById('dl-link-dubbed');
    const subtitle = document.getElementById('download-modal-subtitle');

    // 2. Setup Source 1 (VidSrc / Default Download)
    if (dlLink1) {
        dlLink1.href = buildUrl(DOWNLOAD_URLS.source1);
    }

    // 3. Logic to check the Dubbed Registry
    if (dubbedBtn) {
        // Check if the current TMDB_ID exists in our dubbed registry
        if (typeof DUBBED_REGISTRY !== 'undefined' && DUBBED_REGISTRY[TMDB_ID]) {
            // Set link to your download.html with the correct parameters
            dubbedBtn.href = `download.html?id=${TMDB_ID}&type=${mediaType}`;
            dubbedBtn.classList.remove('hidden');
        } else {
            // Hide the dubbed button if we don't have it in the registry
            dubbedBtn.classList.add('hidden');
        }
    }

    // 4. Update the subtitle text to show Season/Episode or Movie
    if (subtitle) {
        subtitle.textContent = mediaType === 'tv' ? `S${currentSeason}:E${currentEpisode}` : "Full Movie";
    }

    // 5. Show the Modal and prevent background scrolling
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; 
    }
};

window.closeDownloadModal = function() {
    const modal = document.getElementById('download-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = ''; // Restore background scrolling
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
}

function closeAIInsight() {
    document.getElementById('ai-insight-modal').classList.add('hidden');
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

document.addEventListener('DOMContentLoaded', () => {
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
        sessionId = null; 
        createSession(token);
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
    // Only load this if we are on the homepage (not deep linking)
    if (!urlParams.has('id')) {
        loadProgress();
    }

    // --- 5. Routing Logic ---
    if (urlParams.has('id') && urlParams.has('type')) {
        // Deep Link: Go directly to content (Hide Hero/Trailers)
        heroSection.style.display = 'none';
        
        const trailerSection = document.getElementById('trailers-section');
        if(trailerSection) trailerSection.style.display = 'none'; 
        
        const deepId = Number(urlParams.get('id'));
        selectContent(deepId, "Loading Content...", urlParams.get('type'));
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
                
                <div class="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-gray-300 font-bold uppercase tracking-wider border border-white/10">
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
            
            <div class="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] text-gray-300 font-bold uppercase tracking-wider border border-white/10 shadow-sm z-10 pointer-events-none">
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

// --- UPDATED: FULL LOCALIZATION (Fixed Title Bug) ---
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
    // FIX: Use 'currentTitle' global fallback so we don't capture an empty string if the text is hidden.
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
            
            if(originalData.poster) {
                getDominantColor(originalData.poster).then(rgb => {
                    document.documentElement.style.setProperty('--ambient-color', rgb);
                });
            }
            return;
        }

        // --- B. APPLY TRANSLATION ---
        
        // 1. Text Swap
        const translation = availableTranslations.find(t => t.iso_639_1 === selectedLang);
        if (translation) {
            // Use translated title, or fallback to the ROBUST original title
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
        castList.style.opacity = '0.5';
        crewList.style.opacity = '0.5';
        posterImg.style.opacity = '0.7'; 

        try {
            const [creditsData, imageData] = await Promise.all([
                fetchCached(`${BASE_TMDB_URL}/${mediaType}/${TMDB_ID}/credits?api_key=${TMDB_API_KEY}&language=${selectedLang}`),
                fetchCached(`${BASE_TMDB_URL}/${mediaType}/${TMDB_ID}/images?api_key=${TMDB_API_KEY}&include_image_language=${selectedLang},null,en`)
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
                titleEl.style.display = 'block'; // Ensure title is visible if logo missing
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

        } catch (e) {
            console.error("Translation fetch failed", e);
        } finally {
            castList.style.opacity = '1';
            crewList.style.opacity = '1';
            posterImg.style.opacity = '1';
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

document.addEventListener('DOMContentLoaded', () => {
    loadDubbedRegistry();
    loadLocalVideos();
    // You can also call your existing home loading logic here
    // loadHome(); 
});

function buildUrl(server) {
    let template = (mediaType === 'movie') ? server.movie : server.tv;
    if (!template) return "about:blank";

    return template
        .replace('[ID]', TMDB_ID)
        .replace('[S]', currentSeason)
        .replace('[E]', currentEpisode);
}