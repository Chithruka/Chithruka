const ANILIST_API = 'https://graphql.anilist.co';
const QUOTE_API = 'https://yurippe.vercel.app/api/quotes?random=1';

// 1. ANILIST QUERIES
const TRENDING_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(sort: TRENDING_DESC, type: ANIME) {
      id
      title { english romaji }
      coverImage { extraLarge large }
      bannerImage
      averageScore
      description
      genres
      episodes
    }
  }
}`;

const SEARCH_QUERY = `
query ($search: String) {
  Page(perPage: 10) {
    media(search: $search, type: ANIME) {
      id
      title { english romaji }
      coverImage { large }
    }
  }
}`;

// 2. CORE FETCHERS
async function fetchAniList(query, variables) {
    try {
        const response = await fetch(ANILIST_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables })
        });
        
        const json = await response.json();
        
        // Catch AniList specific API errors (like rate limits)
        if (json.errors) {
            console.error("AniList API Error:", json.errors[0].message);
            return null; 
        }
        
        return json.data;
    } catch (error) {
        console.error("Network Error:", error);
        return null;
    }
}

// 3. INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    loadTrending();
    fetchNewQuote();
    setupSearch();
});

async function loadTrending() {
    const data = await fetchAniList(TRENDING_QUERY, { page: 1, perPage: 20 });
    const container = document.getElementById('trending-container');
    
    // Send the top 5 to the Hero Slider
    if (data.Page.media.length > 0) {
        initHero(data.Page.media.slice(0, 5));
    }

    data.Page.media.forEach(anime => {
        const title = anime.title.english || anime.title.romaji;
        const rating = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'NR';
        const fallbackImage = 'https://placehold.co/150x225/222/999?text=No+Image';

        const card = document.createElement('div');
        card.className = 'scroll-card';
        
        card.innerHTML = `
            <div class="poster-wrapper">
                <div class="media-badge tv">ANIME</div>
                <img src="${anime.coverImage.large || fallbackImage}" class="poster-img skeleton" loading="lazy" alt="${title}" onload="this.classList.remove('skeleton')">
                <div class="play-overlay">
                    <div class="play-icon-circle"><i class="fas fa-play"></i></div>
                </div>
            </div>
            <div class="card-body">
                <div class="card-title" title="${title}">${title}</div>
                <div class="card-meta">
                    <span>${anime.episodes ? anime.episodes + ' Eps' : 'Ongoing'}</span>
                    <span class="rating-badge"><i class="fas fa-star mr-1"></i>${rating}</span>
                </div>
            </div>
        `;
        
        card.onclick = () => selectAnime(anime);
        container.appendChild(card);
    });
}

// --- HELPER: Background Colors ---
function getDominantColor(imageUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 1; canvas.height = 1;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 1, 1);
            let [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
            resolve(`${Math.floor(r * 0.3)}, ${Math.floor(g * 0.3)}, ${Math.floor(b * 0.3)}`);
        };
        img.onerror = () => resolve('20, 20, 20');
    });
}

// 4. PLAYER & DETAILS LOGIC
let currentAnimeId = null;
let currentEp = 1;
let audioMode = 'sub';

async function selectAnime(anime) {
    // If it lacks detailed stats (like from a basic search), fetch the full profile
    if (!anime.duration && !anime.status) {
        const fullData = await fetchAniList(`query($id:Int){Media(id:$id){id title{english romaji} coverImage{extraLarge large} bannerImage description episodes genres averageScore seasonYear status duration}}`, { id: anime.id });
        anime = fullData.Media;
    }

    currentAnimeId = anime.id;
    currentEp = 1;
    
    const title = anime.title.english || anime.title.romaji;
    document.title = `${title} - Chithruka Anime`;

    // Hide Homepage Elements
    document.getElementById('hero-section').style.display = 'none';
    document.getElementById('trending-section').style.display = 'none';
    
    // Show Details and Player
    const detailsSection = document.getElementById('details-section');
    const playerInterface = document.getElementById('player-interface');
    detailsSection.classList.remove('hidden');
    playerInterface.classList.remove('hidden');

    // Populate Visuals & Text
    document.getElementById('detail-poster').src = anime.coverImage.extraLarge || 'https://placehold.co/300x450/222/999?text=No+Poster';
    document.getElementById('detail-heading').textContent = title;
    
    let cleanDesc = anime.description ? anime.description.replace(/<br><br>/g, '\n').replace(/<[^>]*>?/gm, '') : 'No overview available.';
    document.getElementById('detail-overview').textContent = cleanDesc;

    // Populate Metadata
    document.getElementById('detail-date').querySelector('span').textContent = anime.seasonYear || 'TBA';
    document.getElementById('detail-rating').querySelector('span').textContent = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'NR';
    document.getElementById('detail-runtime').querySelector('span').textContent = anime.duration ? `${anime.duration}m` : 'N/A';
    document.getElementById('detail-status').querySelector('span').textContent = anime.status ? anime.status.replace(/_/g, ' ') : 'UNKNOWN';
    document.getElementById('detail-episodes').querySelector('span').textContent = anime.episodes ? `${anime.episodes} Episodes` : 'Ongoing';

    // Populate Genres
    const genreContainer = document.getElementById('detail-genres');
    genreContainer.innerHTML = '';
    if (anime.genres) {
        anime.genres.forEach(g => {
            const tag = document.createElement('span');
            tag.className = 'px-3 py-1 bg-white/10 text-gray-200 text-xs rounded-full border border-white/10';
            tag.textContent = g;
            genreContainer.appendChild(tag);
        });
    }

    // Dynamic Backgrounds
    const pageBg = document.getElementById('page-background');
    if (anime.bannerImage) {
        pageBg.style.backgroundImage = `url('${anime.bannerImage}')`;
    } else {
        pageBg.style.backgroundImage = 'none';
    }

    getDominantColor(anime.coverImage.extraLarge).then(rgb => {
        document.documentElement.style.setProperty('--ambient-color', rgb);
    });

    // Populate Episode Selector
    const epSelect = document.getElementById('episode-select');
    epSelect.innerHTML = '';
    const totalEps = anime.episodes || 24; 
    for(let i = 1; i <= totalEps; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `Episode ${i}`;
        epSelect.appendChild(opt);
    }

    updatePlayer();
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
}

window.setAudioMode = function(mode) {
    audioMode = mode;
    updatePlayer();
};

window.changeEpisode = function(ep) {
    currentEp = ep;
    updatePlayer();
};

function updatePlayer() {
    const iframe = document.getElementById('player-iframe');
    iframe.src = `https://vidsrc.cc/v2/embed/anime/ani${currentAnimeId}/${currentEp}/${audioMode}?autoPlay=false`;
    
    document.getElementById('btn-sub').classList.toggle('active', audioMode === 'sub');
    document.getElementById('btn-dub').classList.toggle('active', audioMode === 'dub');
}

// 5. SEARCH LOGIC
function setupSearch() {
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');

    const handleSearch = async (e) => {
        const query = e.target.value;
        if (query.length < 3) {
            results.classList.add('hidden');
            return;
        }

        try {
            const data = await fetchAniList(SEARCH_QUERY, { search: query });
            
            // Safely exit if rate-limited or no data is returned
            if (!data || !data.Page) return; 

            results.innerHTML = '';
            results.classList.remove('hidden');

            data.Page.media.forEach(anime => {
                const li = document.createElement('li');
                li.className = 'p-3 flex items-center gap-3 hover:bg-white/10 cursor-pointer text-white border-b border-white/5 last:border-0';
                li.innerHTML = `
                    <img src="${anime.coverImage.large}" class="w-10 h-14 object-cover rounded shadow-md">
                    <div class="flex flex-col overflow-hidden">
                        <span class="text-sm font-bold truncate">${anime.title.english || anime.title.romaji}</span>
                        <span class="text-xs text-gray-400 mt-1 uppercase tracking-wider">Anime</span>
                    </div>
                `;
                li.onclick = () => {
                    results.classList.add('hidden');
                    input.value = '';
                    selectAnime(anime);
                };
                results.appendChild(li);
            });
        } catch (error) {
            console.error("Search failed, likely rate limited:", error);
        }
    };

    // The script now waits 500ms after the last keystroke before fetching
    input.addEventListener('input', debounce(handleSearch, 500));
}

// 6. HERO & UI HELPERS (Moved outside setupSearch)
window.fetchFullAnimeDetails = async function(id) {
    const data = await fetchAniList(`query($id:Int){Media(id:$id){id title{english romaji} coverImage{extraLarge large} bannerImage description episodes genres averageScore seasonYear status duration}}`, { id });
    selectAnime(data.Media);
}

window.scrollContainer = function(id, amount) {
    document.getElementById(id).scrollBy({ left: amount, behavior: 'smooth' });
}

let heroInterval;
function initHero(items) {
    const slidesContainer = document.getElementById('hero-slides');
    const indicatorsContainer = document.getElementById('hero-indicators');
    slidesContainer.innerHTML = '';
    indicatorsContainer.innerHTML = '';
    
    document.getElementById('hero-section').style.display = 'block';

    items.forEach((item, i) => {
        const title = item.title.english || item.title.romaji;
        const backdrop = item.bannerImage || item.coverImage.extraLarge;
        const slide = document.createElement('div');
        slide.className = `hero-slide ${i === 0 ? 'active' : ''}`;
        slide.style.backgroundImage = `url('${backdrop}')`;
        
        let cleanDesc = item.description ? item.description.replace(/<[^>]*>?/gm, '') : 'No description available.';

        slide.innerHTML = `
            <div class="hero-overlay">
                <div class="hero-content fade-in">
                    <h1 class="text-3xl md:text-5xl font-bold mb-4 text-white drop-shadow-lg">${title}</h1>
                    <p class="hero-text text-white text-gray-200">${cleanDesc}</p>
                    <button onclick='fetchFullAnimeDetails(${item.id})' class="action-btn btn-play text-base md:text-lg px-6 md:px-8 py-2 md:py-3">
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
    });

    if (heroInterval) clearInterval(heroInterval);
    heroInterval = setInterval(() => {
        let slides = document.querySelectorAll('.hero-slide');
        if (slides.length === 0) return;
        let activeIndex = Array.from(slides).findIndex(s => s.classList.contains('active'));
        let nextIndex = (activeIndex + 1) % slides.length;
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

async function loadRandomQuote() {
    try {
        const res = await fetch(QUOTE_API);
        const data = await res.json();
        
        // Yurippe returns an array when the 'random' parameter is used
        const quoteData = Array.isArray(data) ? data[0] : data;
        
        document.getElementById('q-text').textContent = `"${quoteData.quote}"`;
        document.getElementById('q-char').textContent = quoteData.character;
        // Fallback to 'show' since Yurippe uses it to designate the series
        document.getElementById('q-anime').textContent = quoteData.anime || quoteData.show || "Unknown";
        
    } catch (e) {
        console.error("Quote API failed:", e);
        document.getElementById('q-text').textContent = "Believe it!";
        document.getElementById('q-char').textContent = "Naruto Uzumaki";
        document.getElementById('q-anime').textContent = "NARUTO";
    }
}

function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

// --- QUOTE SLIDER LOGIC ---
let quoteTimer;

window.fetchNewQuote = async function() {
    const card = document.getElementById('quote-card');
    const textEl = document.getElementById('q-text');
    const charEl = document.getElementById('q-char');
    const animeEl = document.getElementById('q-anime');

    // 1. Fade Out Animation
    if (card) {
        card.style.opacity = '0';
        card.style.transform = 'translateY(10px)';
    }

    try {
        const res = await fetch(QUOTE_API);
        const data = await res.json();
        const quoteData = Array.isArray(data) ? data[0] : data;

        setTimeout(() => {
            // 2. Change Content Behind the Scenes
            textEl.textContent = `"${quoteData.quote}"`;
            charEl.textContent = quoteData.character;
            animeEl.textContent = quoteData.anime || quoteData.show || "Unknown";

            // 3. Fade In Animation
            if (card) {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }
        }, 300); // Wait for fade-out to complete
        
    } catch (e) {
        console.error("Quote API failed:", e);
        setTimeout(() => {
            textEl.textContent = '"Believe it!"';
            charEl.textContent = "Naruto Uzumaki";
            animeEl.textContent = "NARUTO";
            
            if (card) {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }
        }, 300);
    }

    // Reset the timer if the user manually clicks an arrow
    resetQuoteTimer();
}

function startQuoteTimer() {
    if (quoteTimer) clearInterval(quoteTimer);
    quoteTimer = setInterval(() => {
        fetchNewQuote();
    }, 7000); // Auto-slide every 7 seconds
}

function resetQuoteTimer() {
    clearInterval(quoteTimer);
    startQuoteTimer();
}