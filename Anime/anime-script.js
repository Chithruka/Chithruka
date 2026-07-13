const ANILIST_API = 'https://graphql.anilist.co';
const QUOTE_API = 'https://yurippe.vercel.app/api/quotes?random=1';

const TRENDING_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    media(sort: TRENDING_DESC, type: ANIME) {
      id
      idMal 
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
      idMal
      title { english romaji }
      coverImage { large }
    }
  }
}`;

async function fetchAniList(query, variables) {
    try {
        const response = await fetch(ANILIST_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables })
        });
        
        const json = await response.json();
        
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

document.addEventListener('DOMContentLoaded', () => {
    loadTrending();
    fetchNewQuote();
    setupSearch();
});

async function loadTrending() {
    const data = await fetchAniList(TRENDING_QUERY, { page: 1, perPage: 20 });
    const container = document.getElementById('trending-container');
    
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

let currentAnimeId = null;
let currentMalId = null;
let currentEp = 1;
let audioMode = 'sub';
let currentServer = 'megaplay';

async function selectAnime(anime, targetEp = 1) {
    if (!anime.duration && !anime.status) {
        const fullData = await fetchAniList(`query($id:Int){Media(id:$id){id idMal title{english romaji} coverImage{extraLarge large} bannerImage description episodes genres averageScore seasonYear status duration}}`, { id: anime.id });
        anime = fullData.Media;
    }

    currentAnimeId = anime.id;
    currentMalId = anime.idMal;
    
    let parsedEp = parseInt(targetEp);
    currentEp = isNaN(parsedEp) ? 1 : parsedEp;
    
    const title = anime.title.english || anime.title.romaji;
    document.title = `${title} - Chithruka Anime`;

    document.getElementById('hero-section').style.display = 'none';
    document.getElementById('trending-section').style.display = 'none';
    
    const detailsSection = document.getElementById('details-section');
    const playerInterface = document.getElementById('player-interface');
    detailsSection.classList.remove('hidden');
    playerInterface.classList.remove('hidden');

    document.getElementById('detail-poster').src = anime.coverImage.extraLarge || 'https://placehold.co/300x450/222/999?text=No+Poster';
    document.getElementById('detail-heading').textContent = title;
    
    let cleanDesc = anime.description ? anime.description.replace(/<br><br>/g, '\n').replace(/<[^>]*>?/gm, '') : 'No overview available.';
    document.getElementById('detail-overview').textContent = cleanDesc;

    document.getElementById('detail-date').querySelector('span').textContent = anime.seasonYear || 'TBA';
    document.getElementById('detail-rating').querySelector('span').textContent = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : 'NR';
    document.getElementById('detail-runtime').querySelector('span').textContent = anime.duration ? `${anime.duration}m` : 'N/A';
    document.getElementById('detail-status').querySelector('span').textContent = anime.status ? anime.status.replace(/_/g, ' ') : 'UNKNOWN';
    document.getElementById('detail-episodes').querySelector('span').textContent = anime.episodes ? `${anime.episodes} Episodes` : 'Ongoing';

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

    const pageBg = document.getElementById('page-background');
    if (anime.bannerImage) {
        pageBg.style.backgroundImage = `url('${anime.bannerImage}')`;
    } else {
        pageBg.style.backgroundImage = 'none';
    }

    getDominantColor(anime.coverImage.extraLarge).then(rgb => {
        document.documentElement.style.setProperty('--ambient-color', rgb);
    });

    const epSelect = document.getElementById('episode-select');
    epSelect.innerHTML = '';
    const totalEps = anime.episodes || 24; 
    for(let i = 1; i <= totalEps; i++) {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `Episode ${i}`;
        epSelect.appendChild(opt);
    }
    
    epSelect.value = currentEp;

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

window.setServer = function(server) {
    currentServer = server;
    updatePlayer();
};

function updatePlayer() {
    const iframe = document.getElementById('player-iframe');
    
    if (currentServer === 'megaplay' || currentServer === 'anikoto') {
        iframe.src = `https://megaplay.buzz/stream/ani/${currentAnimeId}/${currentEp}/${audioMode}`;
    } else if (currentServer === 'vidrock') {
        iframe.src = `https://vidrock.ru/anime/${currentAnimeId}/${currentEp}/${audioMode}`;
    }
    
    document.getElementById('btn-sub').classList.toggle('active', audioMode === 'sub');
    document.getElementById('btn-dub').classList.toggle('active', audioMode === 'dub');
    
    document.getElementById('btn-server1').classList.toggle('active', currentServer === 'megaplay');
    document.getElementById('btn-server2').classList.toggle('active', currentServer === 'vidrock');
    document.getElementById('btn-server3').classList.toggle('active', currentServer === 'anikoto');
}

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

    input.addEventListener('input', debounce(handleSearch, 500));
}

window.fetchFullAnimeDetails = async function(id, targetEp = 1) {
   const data = await fetchAniList(`query($id:Int){Media(id:$id){id idMal title{english romaji} coverImage{extraLarge large} bannerImage description episodes genres averageScore seasonYear status duration}}`, { id });
    selectAnime(data.Media, targetEp);
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
        
        const quoteData = Array.isArray(data) ? data[0] : data;
        
        document.getElementById('q-text').textContent = `"${quoteData.quote}"`;
        document.getElementById('q-char').textContent = quoteData.character;
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

let quoteTimer;

window.fetchNewQuote = async function() {
    const card = document.getElementById('quote-card');
    const textEl = document.getElementById('q-text');
    const charEl = document.getElementById('q-char');
    const animeEl = document.getElementById('q-anime');

    if (card) {
        card.style.opacity = '0';
        card.style.transform = 'translateY(10px)';
    }

    try {
        const res = await fetch(QUOTE_API);
        const data = await res.json();
        const quoteData = Array.isArray(data) ? data[0] : data;

        setTimeout(() => {
            textEl.textContent = `"${quoteData.quote}"`;
            charEl.textContent = quoteData.character;
            animeEl.textContent = quoteData.anime || quoteData.show || "Unknown";

            if (card) {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }
        }, 300);
        
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

    resetQuoteTimer();
}

function startQuoteTimer() {
    if (quoteTimer) clearInterval(quoteTimer);
    quoteTimer = setInterval(() => {
        fetchNewQuote();
    }, 7000);
}

function resetQuoteTimer() {
    clearInterval(quoteTimer);
    startQuoteTimer();
}


window.openTraceMoeModal = () => {
    document.getElementById('tracemoe-modal').classList.remove('hidden');
    setupTraceMoeDragAndDrop();
};

window.closeTraceMoeModal = () => {
    document.getElementById('tracemoe-modal').classList.add('hidden');
    document.getElementById('tracemoe-results').innerHTML = '';
    document.getElementById('tracemoe-url').value = '';
    clearTraceMoeSelection();
};

window.clearTraceMoeSelection = (e) => {
    if(e) { e.preventDefault(); e.stopPropagation(); }
    
    document.getElementById('tracemoe-file').value = '';
    document.getElementById('tracemoe-preview-state').classList.add('hidden');
    document.getElementById('tracemoe-default-state').classList.remove('hidden');
    document.getElementById('tracemoe-preview-img').src = '';
    document.getElementById('tracemoe-filename').textContent = '';
    document.getElementById('tracemoe-dropzone').classList.remove('border-[#e50914]', 'bg-white/5');
};

window.clearFileInput = () => {
    const urlInput = document.getElementById('tracemoe-url').value.trim();
    if (urlInput.length > 0) {
        clearTraceMoeSelection();
    }
};

window.handleTraceMoeFileSelect = (input) => {
    const previewState = document.getElementById('tracemoe-preview-state');
    const defaultState = document.getElementById('tracemoe-default-state');
    const previewImg = document.getElementById('tracemoe-preview-img');
    const fileName = document.getElementById('tracemoe-filename');
    const urlInput = document.getElementById('tracemoe-url');

    if (input.files && input.files[0]) {
        const file = input.files[0];
        urlInput.value = '';
        
        previewImg.src = URL.createObjectURL(file);
        fileName.textContent = file.name;
        
        defaultState.classList.add('hidden');
        previewState.classList.remove('hidden');
    }
};

function setupTraceMoeDragAndDrop() {
    const dropzone = document.getElementById('tracemoe-dropzone');
    const fileInput = document.getElementById('tracemoe-file');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.add('border-[#e50914]', 'bg-white/5');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.remove('border-[#e50914]', 'bg-white/5');
        }, false);
    });

    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files && files.length > 0) {
            fileInput.files = files; 
            handleTraceMoeFileSelect(fileInput); 
        }
    }, false);
}

window.searchTraceMoe = async () => {
    const fileInput = document.getElementById('tracemoe-file');
    const urlInput = document.getElementById('tracemoe-url').value.trim();
    const file = fileInput.files[0];
    
    const loading = document.getElementById('tracemoe-loading');
    const resultsContainer = document.getElementById('tracemoe-results');

    if (!file && !urlInput) {
        alert("Please paste an image URL or upload a file first!");
        return;
    }

    loading.classList.remove('hidden');
    resultsContainer.innerHTML = '';

    let fetchUrl = "https://api.trace.moe/search?anilistInfo";
    let fetchOptions = { method: "POST" };

    if (urlInput) {
        fetchUrl += `&url=${encodeURIComponent(urlInput)}`;
        fetchOptions = { method: "GET" };
    } else {
        const formData = new FormData();
        formData.append("image", file);
        fetchOptions.body = formData;
    }

    try {
        const res = await fetch(fetchUrl, fetchOptions);
        const data = await res.json();
        
        loading.classList.add('hidden');

        if (data.error) {
            resultsContainer.innerHTML = `<div class="text-red-500 text-sm text-center font-bold">Error: ${data.error}</div>`;
            return;
        }

        if (data.result && data.result.length > 0) {
            const uniqueResults = [];
            const seenIds = new Set();
            for (const r of data.result) {
                if (!seenIds.has(r.anilist.id)) {
                    seenIds.add(r.anilist.id);
                    uniqueResults.push(r);
                }
            }

            uniqueResults.slice(0, 3).forEach(match => {
                const title = match.anilist.title.english || match.anilist.title.romaji || "Unknown Anime";
                const similarity = (match.similarity * 100).toFixed(1);
                const ep = match.episode || "?";
                const isAdult = match.anilist.isAdult ? '<span class="text-[10px] bg-red-600 px-1 rounded ml-2">18+</span>' : '';

                const div = document.createElement('div');
                div.className = "flex gap-3 bg-white/5 p-3 rounded-xl border border-white/10 hover:bg-white/10 hover:border-white/30 cursor-pointer transition shadow-lg group";
                
                div.innerHTML = `
                    <div class="relative flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden bg-black/50">
                        <img src="${match.image}" class="w-full h-full object-cover group-hover:scale-110 transition-transform" alt="Match Scene">
                        <div class="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                    </div>
                    <div class="flex flex-col justify-center flex-1 min-w-0">
                        <span class="text-sm font-bold text-white truncate flex items-center">${title} ${isAdult}</span>
                        <div class="text-xs text-gray-400 mt-1 flex items-center justify-between">
                            <span><i class="fas fa-tv mr-1 text-blue-400"></i> Ep: ${ep}</span>
                            <span class="${similarity > 85 ? 'text-green-400' : 'text-yellow-400'} font-bold">${similarity}% Match</span>
                        </div>
                    </div>
                `;
                
                div.onclick = () => {
                    closeTraceMoeModal();
                    fetchFullAnimeDetails(match.anilist.id, match.episode);
                };
                
                resultsContainer.appendChild(div);
            });
        } else {
            resultsContainer.innerHTML = `<div class="text-gray-400 text-sm text-center">No matches found. Try another image.</div>`;
        }

    } catch (error) {
        console.error("Trace.moe error:", error);
        loading.classList.add('hidden');
        resultsContainer.innerHTML = `<div class="text-red-500 text-sm text-center font-bold">Failed to connect to the search engine. Ensure URL is valid or image is clear.</div>`;
    }
};


document.addEventListener('click', function(e) {
    const drawer = document.getElementById('mobile-more-drawer');
    const moreBtn = document.getElementById('more-menu-btn');
    
    if (drawer && drawer.classList.contains('open')) {
        if (!drawer.contains(e.target) && !moreBtn.contains(e.target)) {
            drawer.classList.remove('open');
            moreBtn.classList.remove('active'); 
        }
    }
});

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

const originalOpenTraceMoe = window.openTraceMoeModal;
window.openTraceMoeModal = () => {
    originalOpenTraceMoe();
    window.toggleMobileNav(true);
};

const originalCloseTraceMoe = window.closeTraceMoeModal;
window.closeTraceMoeModal = () => {
    originalCloseTraceMoe();
    window.toggleMobileNav(false);
};
