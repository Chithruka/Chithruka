const TMDB_API_KEY = '92850a79e50917b8cc19623455ae2240';
const BASE_TMDB_URL = 'https://api.themoviedb.org/3';
const TMDB_IMG_BASE_URL = 'https://image.tmdb.org/t/p/w92';
const TMDB_POSTER_MD = 'https://image.tmdb.org/t/p/w342';
const TMDB_POSTER_LG = 'https://image.tmdb.org/t/p/w300';
const TMDB_POSTER_XL = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_WEB = 'https://image.tmdb.org/t/p/w1280';
const TMDB_STILL_SZ = 'https://image.tmdb.org/t/p/w300';
// --- GROQ AI CONFIGURATION ---
const GROQ_API_KEY = "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"; // Add your key here
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// --- State Variables ---
let mediaType = 'movie';
let TMDB_ID = null;
let IMDB_ID = null;
let currentFetchUrl = "";
let currentTitle = "";
let currentSeason = 1;
let currentEpisode = 1;
let currentMovieData = null;
let episodeData = [];
let seasonEpisodes = [];
let accordionOpen = false;
let searchTimeout;
let currentServerIndex = 0;
let trendingPage = 1;
let isTrendingLoading = false;
let loadedIds = new Set();
let loadedGenreType = null;
let heroInterval;
let deferredPrompt;
let activeFilterLabel = "";
let aiModalOpen = false;
let userCountryCode = 'US'; // Default fallback
// --- Auth State ---
let sessionId = localStorage.getItem('tmdb_session_id');
let accountId = localStorage.getItem('tmdb_account_id');

const requestCache = new Map();

async function fetchCached(url) {
    if (requestCache.has(url)) return requestCache.get(url);
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();
        requestCache.set(url, data);
        return data;
    } catch (e) {
        throw e;
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

    try {
        const response = await fetch(GROQ_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    {
                        role: "system",
                        content: `You are an expert Movie Recommendation Engine. 
                        
                        Strict Rules:
                        1. Return ONLY a valid JSON object. Do not add intro text.
                        2. Structure: { "message": "Short comment", "results": ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"] }
                        3. If you can't find movies, return results as empty array.
                        
                        User Query: ${query}`
                    },
                    {
                        role: "user",
                        content: query
                    }
                ],
                temperature: 0.3 // Lower temperature for more consistent JSON
            })
        });

        const data = await response.json();

        // 1. Check for API Errors (e.g., Invalid Key)
        if (!response.ok) {
            console.error("Groq API Error:", data);
            throw new Error(data.error?.message || "API request failed");
        }

        const content = data.choices[0].message.content;
        console.log("Raw AI Response:", content); // Debugging line

        // 2. Robust JSON Parsing (Removes Markdown ```json ... ``` wrapper if present)
        let aiData = {};
        try {
            // Remove markdown code blocks if AI added them
            const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
            
            // Find the first '{' and last '}' to isolate JSON
            const firstBracket = cleanContent.indexOf('{');
            const lastBracket = cleanContent.lastIndexOf('}');
            
            if (firstBracket !== -1 && lastBracket !== -1) {
                const jsonString = cleanContent.substring(firstBracket, lastBracket + 1);
                aiData = JSON.parse(jsonString);
            } else {
                aiData = JSON.parse(cleanContent);
            }
        } catch (e) {
            console.error("JSON Parse Error. Raw content:", content);
            aiData = { 
                message: "I found something, but the format was a bit off.", 
                results: [query] 
            };
        }

        // Close AI Modal
        toggleAIModal();

        // Pass both the list and the message to the display function
        displayAIResults(aiData.results || [], aiData.message);

    } catch (error) {
        console.error("AI Logic Failed:", error);
        // Show the specific error in the alert so you know what's wrong
        showMessage(`AI Error: ${error.message}`, true);
        
        // Reset UI
        loader.classList.add('hidden');
        inputCont.classList.remove('hidden');
    }
}

// In script.js

async function displayAIResults(titles, aiMessage) {
    // 1. Reset the UI (Hide Hero, Details, etc.)
    searchInput.value = `AI Search`;
    searchResults.innerHTML = '';
    heroSection.style.display = 'none';
    document.getElementById('top10-section').style.display = 'none';
    detailsSection.classList.add('hidden');
    playerInterface.classList.add('hidden');
    collectionSection.classList.add('hidden');
    document.getElementById('continue-watching-section').classList.add('hidden');
    
    // 2. Set the Header with the AI's Message
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
    const searchPromises = titles.map(async (rawTitle) => {
        let cleanTitle = rawTitle;
        let targetYear = null;
        
        const yearMatch = rawTitle.match(/\((\d{4})\)/);
        if (yearMatch) {
            targetYear = yearMatch[1];
            cleanTitle = rawTitle.replace(/\(\d{4}\)/, '').trim();
        }

        try {
            const url = `${BASE_TMDB_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}&include_adult=true`;
            const data = await fetchCached(url);
            
            if (!data.results || data.results.length === 0) return null;

            let bestMatch = null;
            if (targetYear) {
                bestMatch = data.results.find(item => {
                    const date = item.release_date || item.first_air_date;
                    return date && date.substring(0, 4) === targetYear;
                });
            }
            if (!bestMatch) {
                bestMatch = data.results.find(item => {
                    const title = item.title || item.name;
                    return title && title.toLowerCase() === cleanTitle.toLowerCase();
                });
            }
            if (!bestMatch) {
                bestMatch = data.results.find(i => i.media_type === 'movie' || i.media_type === 'tv') || data.results[0];
            }

            if (bestMatch && (bestMatch.media_type === 'movie' || bestMatch.media_type === 'tv')) {
                return bestMatch;
            }
            return null;

        } catch (e) {
            console.error(`Search failed for ${cleanTitle}`, e);
            return null;
        }
    });

    try {
        const resultsArray = await Promise.all(searchPromises);
        const validResults = resultsArray.filter(i => i !== null);
        const uniqueResults = Array.from(new Map(validResults.map(item => [item.id, item])).values());

        trendingContainer.innerHTML = '';
        
        if (uniqueResults.length > 0) {
            // Scenario A: Database Matches Found
            renderCards(uniqueResults, trendingContainer, true);
        } else {
            // Scenario B: No Matches (The "AI List" Fallback)
            // We create manual cards for every title the AI suggested
            titles.forEach(title => {
                const card = document.createElement('div');
                card.className = 'scroll-card';
                
                // Clean the title for the search query (remove year)
                const cleanQuery = title.replace(/\(\d{4}\)/, '').trim();

                card.innerHTML = `
                    <div class="poster-wrapper" style="background: #1a1a1a; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px; border: 1px solid #333;">
                        <i class="fas fa-search text-3xl text-gray-500 mb-3"></i>
                        <span class="text-xs text-gray-400 text-center">Search for</span>
                        <span class="text-xs font-bold text-white text-center line-clamp-2 mt-1">${title}</span>
                    </div>
                    <div class="card-body">
                        <div class="card-title">${title}</div>
                        <div class="card-meta">
                            <span class="text-xs text-orange-400">AI Suggestion</span>
                        </div>
                    </div>
                `;
                
                // On click, perform a manual search for this title
                card.onclick = () => {
                    const searchInput = document.getElementById('search-input');
                    searchInput.value = cleanQuery;
                    searchInput.focus();
                    performMultiSearch(cleanQuery);
                };
                
                trendingContainer.appendChild(card);
            });
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

const SERVER_URLS = [
    { name: "Server 1", movie: "https://vidsrc.to/embed/movie/[ID]", tv: "https://vidsrc.to/embed/tv/[ID]/[S]/[E]" },
    { name: "Server 2", movie: "https://vidlink.pro/movie/[ID]", tv: "https://vidlink.pro/tv/[ID]/[S]/[E]" },
    { name: "Server 3", movie: "https://multiembed.mov/?video_id=[ID]&tmdb=1", tv: "https://multiembed.mov/?video_id=[ID]&tmdb=1&s=[S]&e=[E]" },
    { name: "Server 4", movie: "https://autoembed.co/movie/tmdb/[ID]", tv: "https://autoembed.co/tv/tmdb/[ID]-[S]-[E]" },
   { name: "Server 5", movie: "https://vidsrc.vip/embed/movie/[ID]", tv: "https://vidsrc.vip/embed/tv/[ID]/[S]/[E]" },
    { 
        name: "Server 6", 
        movie: "https://www.vidking.net/embed/movie/[ID]?color=e50914&nextEpisode=true&episodeSelector=true", 
        tv: "https://www.vidking.net/embed/tv/[ID]/[S]/[E]?color=e50914&nextEpisode=true&episodeSelector=true" 
    }
];

const DOWNLOAD_URLS = {
    source1: { movie: "https://dl.vidsrc.vip/movie/[ID]", tv: "https://dl.vidsrc.vip/tv/[ID]/[S]/[E]" },
    source2: { movie: "https://godriveplayer.com/download.php?type=movie&tmdb=[ID]", tv: "https://godriveplayer.com/download.php?type=series&tmdb=[ID]&season=[S]&episode=[E]" }
};

const playerInterface = document.getElementById('player-interface');
const playerIframe = document.getElementById('player-iframe');
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
                    trendingContainer.innerHTML = '';
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
        if (trackIds) {
            if (loadedIds.has(item.id) || item.media_type === 'person') return;
            loadedIds.add(item.id);
        } else if (item.media_type === 'person') return;

        const title = item.title || item.name;
        const poster = item.poster_path ? `${TMDB_POSTER_MD}${item.poster_path}` : 'missing_image_force_error';

        const rating = item.vote_average ? item.vote_average.toFixed(1) : 'NR';
        const year = (item.release_date || item.first_air_date || 'N/A').substring(0, 4);
        const type = item.media_type; // 'movie' or 'tv'

        // Badge HTML
        const badgeHtml = type === 'tv' 
            ? `<div class="media-badge tv">TV</div>` 
            : `<div class="media-badge movie">MOVIE</div>`;

        const card = document.createElement('div');
        card.className = 'scroll-card';

        card.innerHTML = `
                <div class="poster-wrapper">
                    ${badgeHtml} <img src="${poster}" 
                         class="poster-img skeleton" 
                         loading="lazy" 
                         alt="${title}" 
                         onload="this.classList.remove('skeleton')"
                         onerror="this.style.display='none'">
                         
                    <div class="play-overlay">
                        <div class="play-icon-circle"><i class="fas fa-play"></i></div>
                    </div>
                </div>
                <div class="card-body">
                    <div class="card-title" title="${title}">${title}</div>
                    <div class="card-meta">
                        <span>${year}</span>
                        <span class="rating-badge"><i class="fas fa-star mr-1"></i>${rating}</span>
                    </div>
                </div>
            `;

        card.onclick = () => selectContent(item.id, title, type);
        container.appendChild(card);
    });

    // --- NEW: Update scroll buttons after content renders ---
    updateScrollButtons(container);
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
        const data = await fetchCached(`${BASE_TMDB_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=true`);
        displayResults(data.results);
    } catch (e) {
        searchResults.innerHTML = '<li class="p-4 text-center text-red-400">Error fetching results.</li>';
    }
}

function displayResults(results) {
    searchResults.innerHTML = '';
    if (!results || !results.length) { searchResults.innerHTML = '<li class="p-4 text-center text-gray-400">No results found.</li>'; return; }

    results.forEach(item => {
        if (item.media_type === 'person') {
            const name = item.name;
            // Use gender icon helper
            const imgHtml = getPersonFace(item.profile_path, item.gender, "result-poster rounded-full", "text-lg");
            
            const li = document.createElement('li');
            li.className = 'search-result-item';
            li.innerHTML = `${imgHtml}<div class="text-left"><div class="font-bold text-white text-sm">${name}</div><div class="text-xs text-gray-400">Actor</div></div>`;
            li.onclick = () => loadActorCredits(item.id, name, item.profile_path, item.gender);
            searchResults.appendChild(li);
        } else {
            const title = item.title || item.name;
            const date = item.release_date || item.first_air_date;
            const year = date ? new Date(date).getFullYear() : 'N/A';
            const poster = item.poster_path ? `${TMDB_IMG_BASE_URL}${item.poster_path}` : 'https://placehold.co/40x60/333/999?text=N/A';

            const li = document.createElement('li');
            li.className = 'search-result-item';
            li.innerHTML = `<img src="${poster}" class="result-poster" loading="lazy"><div class="text-left"><div class="font-bold text-white text-sm">${title}</div><div class="text-xs text-gray-400">${item.media_type.toUpperCase()} • ${year} • ${item.vote_average ? item.vote_average.toFixed(1) : 'NR'}</div></div>`;
            li.onclick = () => {
                selectContent(item.id, title, item.media_type);
            };
            searchResults.appendChild(li);
        }
    });
}

// --- Accepts gender to display correct icon in header ---
async function loadActorCredits(personId, personName, profilePath, gender) {
    searchResults.innerHTML = '';
    searchInput.value = '';
    trendingContainer.innerHTML = '';
    loadedIds.clear();
    trendingPage = 1;

    // IMPORTANT: Stop the trending auto-loader
    currentFetchUrl = "STOP";
    
    renderSkeletons(trendingContainer, 10);

    heroSection.style.display = 'none';
    document.getElementById('top10-section').style.display = 'none';
    detailsSection.classList.add('hidden');
    playerInterface.classList.add('hidden');
    collectionSection.classList.add('hidden');
    document.getElementById('continue-watching-section').classList.add('hidden');

    // Use gender icon helper for the header image
    const imgHtml = getPersonFace(profilePath, gender, "w-8 h-8 rounded-full mr-3 border border-gray-600 inline-flex", "text-sm");

    document.getElementById('trending-header').innerHTML = `<div class="flex items-center">${imgHtml} <span class="ml-2">Featuring ${personName}</span></div>`;

    try {
        const data = await fetchCached(`${BASE_TMDB_URL}/person/${personId}/movie_credits?api_key=${TMDB_API_KEY}`);
        const sorted = data.cast.sort((a, b) => b.popularity - a.popularity);
        const results = sorted.map(i => ({ ...i, media_type: 'movie' }));

        trendingContainer.innerHTML = ''; 

        if (results.length === 0) {
            trendingContainer.innerHTML = '<div class="text-gray-400 p-4">No movies found.</div>';
        } else {
            renderCards(results, trendingContainer, true);
            trendingContainer.scrollLeft = 0;
        }
        document.getElementById('trending-header').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { 
        trendingContainer.innerHTML = '<div class="text-red-500 p-4">Failed to load content.</div>';
        showMessage("Could not load filmography", true); 
    }
}

window.openFilterModal = () => {
    filterModal.classList.remove('hidden');
    loadGenres();
    loadCountries();
};
window.closeFilterModal = () => filterModal.classList.add('hidden');
filterModal.addEventListener('click', e => { if (e.target === filterModal) closeFilterModal(); });

async function loadGenres() {
    const type = document.getElementById('filter-type').value;
    if (loadedGenreType === type) return;
    const select = document.getElementById('filter-genre');
    select.innerHTML = '<option value="">Any Genre</option>';
    try {
        const data = await fetchCached(`${BASE_TMDB_URL}/genre/${type}/list?api_key=${TMDB_API_KEY}`);
        data.genres.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id;
            opt.textContent = g.name;
            select.appendChild(opt);
        });
        loadedGenreType = type;
    } catch (e) { console.error("Genre fetch error", e); }
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

window.quickFilter = function(type, value, label = "", logo = "") {
    activeFilterLabel = label;
    document.getElementById('filter-genre').value = "";
    document.getElementById('filter-country').value = "";
    document.getElementById('filter-year').value = "";
    document.getElementById('filter-rating').value = "";

    applyFilter({ [type]: value, logoPath: logo });
}

window.clearFilters = function() {
    document.getElementById('filter-genre').value = "";
    document.getElementById('filter-country').value = "";
    document.getElementById('filter-year').value = "";
    document.getElementById('filter-rating').value = "";

    document.documentElement.style.setProperty('--ambient-color', '0, 0, 0');

    closeFilterModal();

    searchInput.value = '';
    searchResults.innerHTML = '';
    heroSection.style.display = 'block';
    document.getElementById('top10-section').style.display = 'block';

    const history = JSON.parse(localStorage.getItem('watch_history') || '[]');
    if (history.length > 0) document.getElementById('continue-watching-section').classList.remove('hidden');

    const header = document.getElementById('trending-header');
    header.innerHTML = '<i class="fas fa-fire text-orange-500 mr-3"></i> Trending Now';

    trendingContainer.innerHTML = '';
    loadedIds.clear();
    trendingPage = 1;
    loadTrending();
}

async function applyFilter(overrides = {}) {
    const type = document.getElementById('filter-type').value;

    const genre = overrides.genre || document.getElementById('filter-genre').value;
    const country = overrides.country || document.getElementById('filter-country').value;
    const year = overrides.year || document.getElementById('filter-year').value;
    const rating = overrides.rating || document.getElementById('filter-rating').value;
    const company = overrides.company;

    closeFilterModal();
    searchResults.innerHTML = '';
    searchInput.value = '';
    heroSection.style.display = 'none';
    document.getElementById('top10-section').style.display = 'none';
    document.getElementById('continue-watching-section').classList.add('hidden');

    let genreName = "";
    if (genre) {
        if (overrides.genre && activeFilterLabel) genreName = activeFilterLabel;
        else {
            const genreSelect = document.getElementById('filter-genre');
            genreName = genreSelect.options?.[genreSelect.selectedIndex]?.text;
        }
    }
    if (genreName === "Any Genre") genreName = "";

    let countryName = "";
    if (country) {
        if (overrides.country && activeFilterLabel) countryName = activeFilterLabel;
        else {
            const countrySelect = document.getElementById('filter-country');
            countryName = countrySelect.options?.[countrySelect.selectedIndex]?.text;
        }
    }
    if (countryName === "Any Country") countryName = "";

    let mainStr = "";
    if (company && activeFilterLabel) {
        mainStr = `Produced by ${activeFilterLabel}`;
    } else {
        const mediaStr = (type === 'movie' ? "Movies" : "TV Shows");
        mainStr = genreName ? `${genreName} ${mediaStr}` : `All ${mediaStr}`;

        if (countryName) mainStr += ` from ${countryName}`;
        if (year) mainStr += ` released in ${year}`;
        if (rating) mainStr += ` rated ${rating}+`;
    }

    document.getElementById('trending-header').innerHTML = mainStr;

    let urlBase = `${BASE_TMDB_URL}/discover/${type}?api_key=${TMDB_API_KEY}&sort_by=popularity.desc&include_adult=true&include_video=false`;

    if (year) {
        if (type === 'movie') urlBase += `&primary_release_year=${year}`;
        else urlBase += `&first_air_date_year=${year}`;
    }

    if (genre) urlBase += `&with_genres=${genre}`;
    if (rating) urlBase += `&vote_average.gte=${rating}`;
    if (country) urlBase += `&with_origin_country=${country}`;
    if (company) urlBase += `&with_companies=${company}`;

    currentFetchUrl = urlBase;

    trendingContainer.innerHTML = '';
    renderSkeletons(trendingContainer, 10);
    loadedIds.clear();
    trendingPage = 1;

    try {
        const data = await fetchCached(`${currentFetchUrl}&page=1`);

        let results = data.results.map(i => ({ ...i, media_type: type }));

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
        console.error(e);
        showMessage("Filter failed", true);
    }

    activeFilterLabel = "";
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
    playerIframe.src = "about:blank";
    
    // --- RESET SOUNDTRACK ---
    const sSection = document.getElementById('soundtrack-section');
    const sContainer = document.getElementById('soundtrack-embed-container');
    if (sSection) sSection.classList.add('hidden');
    if (sContainer) sContainer.innerHTML = ''; // Clear iframe immediately

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
    loadSoundtrack(title); // <--- CALL NEW FUNCTION HERE

    setTimeout(() => { detailsSection.scrollIntoView({ behavior: 'smooth' }); }, 100);
}
window.scrollTo({ top: 0, behavior: 'smooth' });

async function fetchMovieDetails(id, title) {
    tvControls.classList.add('hidden');
    try {
        const detailData = await fetchCached(`${BASE_TMDB_URL}/movie/${id}?api_key=${TMDB_API_KEY}&append_to_response=images,external_ids,credits,release_dates,alternative_titles`);
        if (detailData.external_ids) IMDB_ID = detailData.external_ids.imdb_id;

        if (detailData.title) {
            currentTitle = detailData.title;
            document.title = `${currentTitle} - Chithruka`;
        }
        renderDetails(detailData, currentTitle);

        if (detailData.belongs_to_collection) {
            loadCollection(detailData.belongs_to_collection.id, detailData.belongs_to_collection.name);
        }

        playerInterface.classList.remove('hidden');
        updatePlayer();
    } catch (e) { showMessage("Failed to load details.", true); console.error(e); }
}

async function fetchShowDetails(id, title) {
    try {
        const data = await fetchCached(`${BASE_TMDB_URL}/tv/${id}?api_key=${TMDB_API_KEY}&append_to_response=images,credits,content_ratings,alternative_titles,external_ids`);
        if (data.external_ids) IMDB_ID = data.external_ids.imdb_id;

        if (data.name) {
            currentTitle = data.name;
            document.title = `${currentTitle} - Chithruka`;
        }
        renderDetails(data, currentTitle);

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
    } catch (e) { showMessage("Failed to load show details.", true); console.error(e); }
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
    let html = '';
    seasonEpisodes.forEach(ep => {
        const still = ep.still_path ? `${TMDB_STILL_SZ}${ep.still_path}` : 'https://placehold.co/120x68/333/999?text=No+Img';
        const isActive = (ep.episode_number === currentEpisode);

        const rating = ep.vote_average ? Math.round(ep.vote_average * 10) + "%" : "NR";
        const date = formatDate(ep.air_date);
        const runtime = formatRuntime(ep.runtime);

        const metaString = `
                <span class="text-yellow-500 mr-1"><i class="fas fa-star"></i></span> ${rating}
                <span class="mx-2 text-gray-600">|</span>
                <span class="text-gray-400 mr-1"><i class="far fa-calendar-alt"></i></span> ${date}
                <span class="mx-2 text-gray-600">|</span>
                <span class="text-gray-400 mr-1"><i class="far fa-clock"></i></span> ${runtime}
            `;

        html += `
            <div class="episode-rich-item ${isActive ? 'active' : ''}" onclick="selectEpisode(${ep.season_number}, ${ep.episode_number}, this)">
                <img src="${still}" class="ep-still" loading="lazy">
                <div class="ep-info">
                    <div class="ep-title">${ep.episode_number}. ${ep.name}</div>
                    <div class="ep-meta">${metaString}</div>
                    <div class="ep-overview">${ep.overview || 'No overview available.'}</div>
                </div>
            </div>`;
    });
    episodeAccordionContent.innerHTML = html;
    if (accordionOpen) episodeAccordionContent.style.maxHeight = episodeAccordionContent.scrollHeight + "px";
}

function renderDetails(data, title) {
    // 1. AI Context Construction
    const dateVal = data.release_date || data.first_air_date;
    const year = dateVal ? new Date(dateVal).getFullYear() : "N/A";
    
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

    // 2. UI Rendering
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
    const logoImg = document.getElementById('detail-logo');
    const textHeading = document.getElementById('detail-heading');

    const taglineEl = document.getElementById('detail-tagline');
    if (data.tagline) {
        taglineEl.textContent = `"${data.tagline}"`;
        taglineEl.classList.remove('hidden');
    } else {
        taglineEl.classList.add('hidden');
    }

    const statusEl = document.getElementById('detail-status');
    if (data.status) {
        statusEl.querySelector('span').textContent = data.status;
        statusEl.classList.remove('hidden');
    } else {
        statusEl.classList.add('hidden');
    }

    const existingCount = document.getElementById('detail-tv-stats');
    if (existingCount) existingCount.remove();

    if (data.number_of_seasons) {
        const countSpan = document.createElement('span');
        countSpan.id = 'detail-tv-stats';
        countSpan.className = "flex items-center text-gray-300 font-semibold";
        countSpan.innerHTML = `<i class="fas fa-layer-group mr-2 text-gray-400"></i> ${data.number_of_seasons} Seasons • ${data.number_of_episodes} Episodes`;
        statusEl.parentElement.insertBefore(countSpan, statusEl);
    }

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

    const dateEl = document.getElementById('detail-date');
    const dateSpan = dateEl.querySelector('span');
    dateSpan.textContent = year;

    if (year !== "N/A") {
        dateEl.onclick = () => quickFilter('year', year, year);
    }

    const ratingEl = document.getElementById('detail-rating');
    const ratingSpan = ratingEl.querySelector('span');
    const ratingVal = data.vote_average ? data.vote_average.toFixed(1) : "N/A";
    ratingSpan.textContent = ratingVal;
    if (ratingVal !== "N/A") {
        ratingEl.onclick = () => quickFilter('rating', data.vote_average);
    }

    let runtime = data.runtime || (data.episode_run_time ? data.episode_run_time[0] : 0);
    document.getElementById('detail-runtime').querySelector('span').textContent = runtime ? `${Math.floor(runtime / 60)}h ${runtime % 60}m` : "N/A";

    const ageEl = document.getElementById('detail-age');
    if (ageRating !== "Not Rated") {
        ageEl.querySelector('span').textContent = ageRating;
        ageEl.classList.remove('hidden');
    } else {
        ageEl.classList.add('hidden');
    }

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

    document.getElementById('detail-overview').textContent = data.overview || "No description available.";

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

    const genreContainer = document.getElementById('detail-genres');
    genreContainer.innerHTML = '';
    (data.genres || []).forEach(g => {
        const tag = document.createElement('span');
        tag.className = 'px-3 py-1 bg-white/10 text-gray-200 text-xs rounded-full border border-white/10 cursor-pointer hover:bg-white/20 transition';
        tag.textContent = g.name;
        tag.onclick = () => quickFilter('genre', g.id, g.name);
        genreContainer.appendChild(tag);
    });

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

    // --- CAST SECTION ---
    const castContainer = document.getElementById('cast-container');
    const castList = document.getElementById('cast-list');
    castList.innerHTML = '';
    
    if (data.credits && data.credits.cast && data.credits.cast.length > 0) {
        castContainer.classList.remove('hidden');
        data.credits.cast.forEach(c => {
            const picHtml = getPersonFace(c.profile_path, c.gender, "cast-img");
            const castDiv = document.createElement('div');
            castDiv.className = 'cast-card';
            castDiv.innerHTML = `
                    ${picHtml}
                    <div class="cast-name">${c.name}</div>
                    <div class="cast-char">${c.character}</div>
                `;
            castDiv.onclick = () => loadActorCredits(c.id, c.name, c.profile_path, c.gender);
            castList.appendChild(castDiv);
        });
        // --- NEW: Update Cast Buttons ---
        updateScrollButtons(castList);
    } else {
        castContainer.classList.add('hidden');
    }

    // --- CREW SECTION ---
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
            // --- NEW: Update Crew Buttons ---
            updateScrollButtons(crewList);
        } else {
            crewContainer.classList.add('hidden');
        }
    } else {
        crewContainer.classList.add('hidden');
    }

    renderDetailedInfo(data);
}

function renderDetailedInfo(data) {
    // --- PRODUCTION COMPANIES ---
    const prodList = document.getElementById('production-list');
    prodList.innerHTML = '';
    
    if (data.production_companies && data.production_companies.length > 0) {
        prodList.parentElement.classList.remove('hidden'); // Show Parent info-block
        data.production_companies.forEach(p => {
            const div = document.createElement('div');
            div.className = "mb-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-all group";

            let iconHtml = '';
            if (p.logo_path) {
                iconHtml = `<img src="${TMDB_IMG_BASE_URL}${p.logo_path}" class="w-8 h-8 object-contain bg-white rounded-md p-0.5" alt="${p.name}" loading="lazy">`;
            } else {
                iconHtml = `<div class="w-8 h-8 flex items-center justify-center bg-gray-800 rounded-md"><i class="fas fa-industry text-gray-400 text-xs"></i></div>`;
            }

            div.innerHTML = `
                        ${iconHtml}
                        <div class="flex flex-col">
                            <span class="text-sm font-semibold text-gray-200 group-hover:text-red-500 transition-colors">${p.name}</span>
                            <span class="text-xs text-gray-500">${p.origin_country}</span>
                        </div>
                    `;

            div.onclick = () => quickFilter('company', p.id, p.name, p.logo_path);
            prodList.appendChild(div);
        });
    } else {
        prodList.parentElement.classList.add('hidden'); // Hide Parent info-block
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
    
    // Toggle Visibility based on content
    if (hasReleaseDates) {
        relList.parentElement.classList.remove('hidden');
    } else {
        relList.parentElement.classList.add('hidden');
    }

    // --- ALTERNATIVE TITLES ---
    const altList = document.getElementById('alt-titles-list');
    altList.innerHTML = '';
    
    if (data.alternative_titles && (data.alternative_titles.titles || data.alternative_titles.results) && (data.alternative_titles.titles || data.alternative_titles.results).length > 0) {
        altList.parentElement.classList.remove('hidden');
        const titles = data.alternative_titles.titles || data.alternative_titles.results;
        titles.slice(0, 10).forEach(t => {
            const div = document.createElement('div');
            div.className = "mb-1";
            div.innerHTML = `<span class="text-white">${t.iso_3166_1}:</span> ${t.title}`;
            altList.appendChild(div);
        });
    } else {
        altList.parentElement.classList.add('hidden');
    }

    // --- TECH SPECS ---
    const techList = document.getElementById('tech-specs-list');
    techList.innerHTML = '';
    const specs = [
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
            div.innerHTML = `<span class="text-gray-400">${s.label}</span> <span>${s.val}</span>`;
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

    SERVER_URLS.forEach((server, index) => {
        const btn = document.createElement('button');
        btn.className = `server-btn ${index === currentServerIndex ? 'active' : ''}`;
        btn.textContent = server.name;
        btn.onclick = () => switchServer(index, btn);
        btnContainer.appendChild(btn);
    });
}

function updatePlayer() {
    if (!TMDB_ID) return;

    const btnContainer = document.getElementById('server-buttons');
    if (btnContainer && btnContainer.children.length === 0) {
        renderServerButtons();
    }

    const url = buildUrl(SERVER_URLS[currentServerIndex]);
    if (url === "about:blank") {
        playerIframe.src = "about:blank";
        showMessage("Server unavailable (Missing IMDb ID). Try another.", true);
    } else {
        playerIframe.src = url;
        document.getElementById('server-loading-msg').classList.add('hidden');
    }

    const nextBtn = document.getElementById('next-ep-btn');

    if (mediaType === 'tv') {
        currentEpisodeInfo.textContent = `S${currentSeason}:E${currentEpisode} - Server ${currentServerIndex + 1}`;

        const seasonData = episodeData.find(s => s.season === currentSeason);

        if (seasonData) {
            if (currentEpisode < seasonData.episodes) {
                nextBtn.innerHTML = '<i class="fa-solid fa-forward-step fa-fade mr-2"></i> Next Episode';
                nextBtn.onclick = nextEpisode;
                nextBtn.classList.remove('hidden');
            }
            else if (episodeData.find(s => s.season === currentSeason + 1)) {
                nextBtn.innerHTML = '<i class="fas fa-forward mr-2"></i> Start Season ' + (currentSeason + 1);
                nextBtn.onclick = () => {
                    const nextSeason = currentSeason + 1;
                    document.getElementById('season-select').value = nextSeason;
                    changeSeason(nextSeason).then(() => selectEpisode(nextSeason, 1, null));
                };
                nextBtn.classList.remove('hidden');
            }
            else {
                nextBtn.classList.add('hidden');
            }
        }
    } else {
        currentEpisodeInfo.textContent = "Movie";
        nextBtn.classList.add('hidden');
    }

    document.querySelectorAll('.episode-rich-item').forEach(item => item.classList.remove('active'));
    const activeItem = Array.from(document.querySelectorAll('.episode-rich-item')).find(
        el => el.getAttribute('onclick')?.includes(`(${currentSeason}, ${currentEpisode},`)
    );
    if (activeItem) {
        activeItem.classList.add('active');
    }

    saveProgress();
}

window.handleServerError = function() {
    const nextIndex = (currentServerIndex + 1) % SERVER_URLS.length;

    const msg = document.getElementById('server-loading-msg');
    msg.innerHTML = `
            <div class="text-2xl mb-4 text-red-500"><i class="fas fa-tools"></i></div>
            <h3 class="text-xl font-bold mb-2">Switching Server...</h3>
            <p class="text-gray-400 text-sm">Trying Source ${nextIndex + 1} of ${SERVER_URLS.length}</p>
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

window.switchServer = function(index, btn) {
    currentServerIndex = index;
    document.querySelectorAll('.server-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updatePlayer();
}

window.selectEpisode = function(s, e, el) {
    currentSeason = s; currentEpisode = e;
    updatePlayer();
}

window.toggleAccordion = function() {
    if (mediaType !== 'tv') return;
    const icon = document.getElementById('accordion-icon');
    accordionOpen = !accordionOpen;
    episodeAccordionContent.style.maxHeight = accordionOpen ? "500px" : "0";
    if (accordionOpen) episodeAccordionContent.style.maxHeight = episodeAccordionContent.scrollHeight + "px";
    icon.className = `fas fa-chevron-${accordionOpen ? 'up' : 'down'} transition-transform duration-300`;
}

window.openDownloadModal = function() {
    if (!TMDB_ID) return;
    document.getElementById('dl-link-1').href = buildUrl(DOWNLOAD_URLS.source1);
    document.getElementById('dl-link-2').href = buildUrl(DOWNLOAD_URLS.source2);
    document.getElementById('download-modal-subtitle').textContent = mediaType === 'tv' ? `S${currentSeason}:E${currentEpisode}` : "Full Movie";
    downloadModal.classList.remove('hidden');
}
window.closeDownloadModal = () => downloadModal.classList.add('hidden');
downloadModal.addEventListener('click', e => { if (e.target === downloadModal) closeDownloadModal(); });

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

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);

    // --- 1. Check for TMDB Login Return (Redirect from Auth) ---
    if (urlParams.has('request_token') && urlParams.get('approved') === 'true') {
        const token = urlParams.get('request_token');
        window.history.replaceState({}, document.title, window.location.pathname);
        sessionId = null; 
        createSession(token);
    } 
    else {
        // --- 2. Standard Page Load ---
        const storedSession = localStorage.getItem('tmdb_session_id');
        const storedAccount = localStorage.getItem('tmdb_account_id');
        
        if (storedSession && storedAccount) {
            sessionId = storedSession;
            accountId = storedAccount;
            updateAuthUI({ username: "User", avatar: { tmdb: { avatar_path: null } } }); 
            fetchAccountDetails(); 
        }
    }

    // Load "Continue Watching" history if on homepage
    if (!urlParams.has('id')) {
        loadProgress();
    }

    // --- 3. Routing Logic ---
    if (urlParams.has('id') && urlParams.has('type')) {
        // Deep Link: Go directly to content
        heroSection.style.display = 'none';
        
        const trailerSection = document.getElementById('trailers-section');
        if(trailerSection) trailerSection.style.display = 'none'; 
        
        const deepId = Number(urlParams.get('id'));
        selectContent(deepId, "Loading Content...", urlParams.get('type'));
    } else {
        // Homepage: Load Trailers
        loadLatestTrailers();
    }

    // --- 4. Load Global Content ---
    loadTrending();
    loadGenres();

    // --- 5. Initialize Quotes (THIS FIXES THE MOBILE ISSUE) ---
    initQuotes();

    // --- 6. Attach Scroll Listeners ---
    const scrollContainers = document.querySelectorAll('.overflow-x-auto');
    scrollContainers.forEach(container => {
        updateScrollButtons(container);
        container.addEventListener('scroll', () => {
            updateScrollButtons(container);
        });
    });

    // --- 7. Footer & Location Logic ---
    const yearSpan = document.getElementById('footer-year');
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();

    fetch('https://ipapi.co/json/')
        .then(res => res.json())
        .then(data => {
            const countryEl = document.getElementById('user-country');
            if (data.country_name && data.country_code) {
                countryEl.innerHTML = `<i class="fa-solid fa-earth-asia text-blue-500 animate-pulse"></i> ${data.country_name}`;
                countryEl.classList.add('cursor-pointer', 'hover:border-red-500', 'hover:text-white', 'group');
                countryEl.title = `Browse content from ${data.country_name}`;
                countryEl.onclick = () => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    quickFilter('country', data.country_code, data.country_name);
                };
            } else {
                if (countryEl) countryEl.style.display = 'none';
            }
        })
        .catch(() => {
            const countryEl = document.getElementById('user-country');
            if (countryEl) countryEl.innerText = "Location Unavailable";
        });
});

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

    // 1. Clean Title: Remove "The", years, and subtitles to broaden search
    let cleanTitle = title.split(':')[0].split('(')[0].trim();
    if (cleanTitle.toLowerCase().startsWith('the ')) {
        cleanTitle = cleanTitle.substring(4);
    }

    try {
        // 2. Search iTunes API (No Key Required)
        // We search for "Title Soundtrack" in the album category
        const query = encodeURIComponent(`${cleanTitle} Soundtrack`);
        
        // Use 'music' media type and 'album' entity to find full soundtracks
        const res = await fetch(`https://itunes.apple.com/search?term=${query}&media=music&entity=album&limit=1`);
        const data = await res.json();

        if (data.results && data.results.length > 0) {
            const album = data.results[0];
            const albumId = album.collectionId;
            
            // 3. Create Apple Music Embed URL (Dark Mode)
            // height=450 allows showing the tracklist
            container.innerHTML = `
                <iframe allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write" 
                        frameborder="0" 
                        height="450" 
                        style="width:100%; max-width:100%; overflow:hidden; border-radius:10px; background:transparent;" 
                        sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation" 
                        src="https://embed.music.apple.com/us/album/${albumId}?theme=dark">
                </iframe>`;

            if (link) {
                link.href = album.collectionViewUrl;
                link.innerHTML = `<i class="fab fa-apple mr-1"></i> Listen on Apple Music`;
            }

            section.classList.remove('hidden');
        } else {
            // No soundtrack found
            section.classList.add('hidden');
        }
    } catch (e) {
        console.error("Soundtrack Error:", e);
        section.classList.add('hidden');
    }
}

// ==========================================
// AI INTEL FUNCTIONS (Smart JSON Version)
// ==========================================

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
    resultBox.classList.add('hidden'); // Hide result box initially

    // Prepare Data
    const jsonContext = JSON.stringify(currentMovieData, null, 2);
    let prompt = "";

    switch (mode) {
        case 'hype':
            prompt = `Analyze this movie JSON and write a hype paragraph (min 60 words). JSON: ${jsonContext}`;
            break;
        case 'trivia':
            prompt = `Generate 3 interesting trivia facts from this movie JSON. JSON: ${jsonContext}`;
            break;
        case 'parents':
            prompt = `Explain the Age Rating based on this JSON. JSON: ${jsonContext}`;
            break;
    }

    try {
        const response = await fetch(GROQ_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    { role: "system", content: "You are a movie expert." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 400
            })
        });

        const data = await response.json();

        // --- NEW ERROR HANDLING ---
        if (!response.ok) {
            console.error("Groq API Error Details:", data);
            // Throw the specific error message from the API
            throw new Error(data.error?.message || `API Error: ${response.status}`);
        }

        const content = data.choices[0].message.content;

        loader.classList.add('hidden');
        resultBox.classList.remove('hidden');
        resultText.innerHTML = content.replace(/\n/g, '<br>');

    } catch (error) {
        console.error("AI Insight Failed:", error);
        
        loader.classList.add('hidden');
        resultBox.classList.remove('hidden');
        
        // --- DISPLAY THE REAL ERROR ON SCREEN ---
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
