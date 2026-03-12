// 1. DOM ELEMENT SELECTIONS
const menuButtons = document.querySelectorAll(".menu-button");
const screenOverlay = document.querySelector(".main-layout .screen-overlay");
const themeButton = document.querySelector(".navbar .theme-button i");

const videoGrid = document.getElementById('video-grid');
const searchInput = document.getElementById('search');
const categoryBtns = document.querySelectorAll('.category-button');

const homeView = document.getElementById('home-view');
const playerView = document.getElementById('player-view');

const video = document.getElementById("video-player");
const videoContainer = document.querySelector(".video-container");
const timelineContainer = document.querySelector(".timeline-container");

const playPauseBtn = document.querySelector(".play-pause-btn");
const rewindButton = document.querySelector('.controls button.rewind');
const fastForwardButton = document.querySelector('.controls button.fast-forward');
const theaterBtn = document.querySelector(".theater-btn");
const fullScreenBtn = document.querySelector(".full-screen-btn");
const miniPlayerBtn = document.querySelector(".mini-player-btn");
const muteBtn = document.querySelector(".mute-btn");
const captionsBtn = document.querySelector(".captions-btn");
const speedBtn = document.querySelector(".speed-btn");
const currentTimeElem = document.querySelector(".current-time");
const totalTimeElem = document.querySelector(".total-time");
const volumeSlider = document.querySelector(".volume-slider");

// 2. HLS & STATE VARIABLES
let hls; 
const qualityBtn = document.querySelector(".quality-btn");
const qualityMenu = document.querySelector(".quality-menu");
let captionsEnabled = false;
let isScrubbing = false;
let wasPaused;

// --- Sidebar & Theme Logic ---
menuButtons.forEach(button => {
  button.addEventListener("click", () => {
    document.body.classList.toggle("sidebar-hidden");
  });
});

screenOverlay.addEventListener("click", () => {
  document.body.classList.toggle("sidebar-hidden");
});

if (localStorage.getItem("darkMode") === "enabled") {
  document.body.classList.add("dark-mode");
  themeButton.classList.replace("fa-moon", "fa-sun");
}

themeButton.addEventListener("click", () => {
  const isDarkMode = document.body.classList.toggle("dark-mode");
  localStorage.setItem("darkMode", isDarkMode ? "enabled" : "disabled");
  themeButton.classList.toggle("fa-sun", isDarkMode);
  themeButton.classList.toggle("fa-moon", !isDarkMode);
});

// --- Video Rendering & Filtering ---
function renderVideos(videoArray) {
  videoGrid.innerHTML = ''; 
  if (videoArray.length === 0) {
    videoGrid.innerHTML = '<h3 style="grid-column: 1 / -1; text-align: center;">No results found</h3>';
    return;
  }

  videoArray.forEach(vid => {
    const card = document.createElement('a');
    card.href = "#"; 
    card.className = 'video-card';
    card.innerHTML = `
      <div class="thumbnail-container">
        <img src="${vid.thumb}" alt="Thumbnail" class="thumbnail">
        <span class="duration">${vid.duration || '4:15'}</span>
      </div>
      <div class="video-info">
        <img src="${vid.channelLogo || 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20height%3D%22100%25%22%20version%3D%221.1%22%20viewBox%3D%220%200%2068%2048%22%20width%3D%22100%25%22%3E%3Cpath%20class%3D%22ytp-large-play-button-bg%22%20d%3D%22M66.52%2C7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79%2C.13%2C34%2C0%2C34%2C0S12.21%2C.13%2C6.9%2C1.55%20C3.97%2C2.33%2C2.27%2C4.81%2C1.48%2C7.74C0.06%2C13.05%2C0%2C24%2C0%2C24s0.06%2C10.95%2C1.48%2C16.26c0.78%2C2.93%2C2.49%2C5.41%2C5.42%2C6.19%20C12.21%2C47.87%2C34%2C48%2C34%2C48s21.79-0.13%2C27.1-1.55c2.93-0.78%2C4.64-3.26%2C5.42-6.19C67.94%2C34.95%2C68%2C24%2C68%2C24S67.94%2C13.05%2C66.52%2C7.74z%22%20fill%3D%22%23f03%22%3E%3C%2Fpath%3E%3Cpath%20d%3D%22M%2045%2C24%2027%2C14%2027%2C34%22%20fill%3D%22%23fff%22%3E%3C%2Fpath%3E%3C%2Fsvg%3E'}" alt="Channel Logo" class="icon">
        <div class="video-details">
          <h2 class="title" style="font-family: 'Google Sans', sans-serif; letter-spacing: 1px; font-size: 1.3rem;">${vid.title}</h2>
          <p class="channel-name">${vid.channel}</p>
          <p class="views">${vid.views}</p>
        </div>
      </div>
    `;
    card.addEventListener('click', (e) => {
      e.preventDefault();
      loadPlayerView(vid.id);
    });
    videoGrid.appendChild(card);
  });
}

searchInput.addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  const filteredVideos = videos.filter(v => 
    v.title.toLowerCase().includes(term) || 
    v.channel.toLowerCase().includes(term)
  );
  renderVideos(filteredVideos);
});

categoryBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelector('.category-button.active').classList.remove('active');
    btn.classList.add('active');
    const category = btn.innerText;
    category === 'All' ? renderVideos(videos) : renderVideos(videos.filter(v => v.category === category));
  });
});

renderVideos(videos); 

// --- SPA View Toggling & HLS Player Loading ---
document.querySelector('.nav-logo').addEventListener('click', (e) => {
  e.preventDefault();
  goHome();
});

function goHome() {
  playerView.style.display = 'none';
  homeView.style.display = 'block';
  document.body.classList.remove('player-active');
  if (!document.pictureInPictureElement) video.pause(); 
}

function loadPlayerView(videoId) {
  if (document.pictureInPictureElement) document.exitPictureInPicture();
  const currentVideo = videos.find(v => v.id === videoId);
  if (!currentVideo) return;

  homeView.style.display = 'none';
  playerView.style.display = 'block';
  document.body.classList.add('player-active'); 

  document.getElementById('video-title-display').innerText = currentVideo.title;
  document.getElementById('video-desc-display').innerText = currentVideo.description;
  document.getElementById('channel-name-display').innerHTML = `${currentVideo.channel} <i class="fa-solid fa-circle-check" style="font-size: 14px; color: #888;"></i>`;
  document.getElementById('channel-logo-display').src = currentVideo.channelLogo;

  video.poster = currentVideo.thumb;
  const src = currentVideo.sources;

  if (hls) { hls.destroy(); } 
  qualityMenu.style.display = 'none'; 
  qualityMenu.innerHTML = '';

  if (src.endsWith('.m3u8')) {
    if (Hls.isSupported()) {
      hls = new Hls({ renderTextTracksNatively: true });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play();
        setupQualityMenu();
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.play();
    }
  } else {
    video.src = src;
    video.play();
  }
}

// --- Quality & Captions ---
qualityBtn.addEventListener("click", () => {
  qualityMenu.style.display = qualityMenu.style.display === "none" ? "flex" : "none";
});

function setupQualityMenu() {
  if (!hls) return;
  qualityMenu.innerHTML = "";
  const autoBtn = document.createElement("button");
  autoBtn.innerText = "Auto";
  autoBtn.classList.add("active-quality");
  autoBtn.onclick = () => setQuality(-1, autoBtn);
  qualityMenu.appendChild(autoBtn);

  hls.levels.forEach((level, index) => {
    const btn = document.createElement("button");
    btn.innerText = `${level.height}p`;
    btn.onclick = () => setQuality(index, btn);
    qualityMenu.appendChild(btn);
  });
}

function setQuality(levelIndex, clickedBtn) {
  hls.currentLevel = levelIndex;
  document.querySelectorAll(".quality-menu button").forEach(btn => btn.classList.remove("active-quality"));
  clickedBtn.classList.add("active-quality");
  qualityMenu.style.display = "none";
}

captionsBtn.addEventListener("click", () => {
  captionsEnabled = !captionsEnabled;
  videoContainer.classList.toggle("captions", captionsEnabled);
  if (hls && hls.subtitleTracks.length > 0) {
    hls.subtitleTrack = captionsEnabled ? 0 : -1;
  } else {
    for (let i = 0; i < video.textTracks.length; i++) {
      video.textTracks[i].mode = captionsEnabled ? 'showing' : 'hidden';
    }
  }
});

// --- Player Controls ---
function togglePlay() { video.paused ? video.play() : video.pause(); }
function toggleMute() { video.muted = !video.muted; }
function skip(duration) { video.currentTime += duration; }

// FIXED: Speed Controller Logic
speedBtn.addEventListener("click", () => {
  let newRate = video.playbackRate + 0.25;
  if (newRate > 2) newRate = 0.25;
  video.playbackRate = newRate;
  speedBtn.textContent = `${newRate}x`;
});

function formatDuration(time) {
  const seconds = Math.floor(time % 60);
  const minutes = Math.floor(time / 60) % 60;
  const hours = Math.floor(time / 3600);
  const leadingZero = new Intl.NumberFormat(undefined, { minimumIntegerDigits: 2 });
  return hours === 0 ? `${minutes}:${leadingZero.format(seconds)}` : `${hours}:${leadingZero.format(minutes)}:${leadingZero.format(seconds)}`;
}

playPauseBtn.addEventListener("click", togglePlay);
video.addEventListener("click", togglePlay);
video.addEventListener("play", () => videoContainer.classList.remove("paused"));
video.addEventListener("pause", () => videoContainer.classList.add("paused"));
rewindButton.addEventListener('click', () => skip(-10));
fastForwardButton.addEventListener('click', () => skip(10));

muteBtn.addEventListener("click", toggleMute);
volumeSlider.addEventListener("input", e => {
  video.volume = e.target.value;
  video.muted = e.target.value === "0";
});

video.addEventListener("volumechange", () => {
  volumeSlider.value = video.volume;
  let volumeLevel = (video.muted || video.volume === 0) ? "muted" : (video.volume >= 0.5 ? "high" : "low");
  videoContainer.dataset.volumeLevel = volumeLevel;
});

video.addEventListener("loadeddata", () => totalTimeElem.textContent = formatDuration(video.duration));
video.addEventListener("timeupdate", () => {
  currentTimeElem.textContent = formatDuration(video.currentTime);
  const percent = video.currentTime / video.duration;
  timelineContainer.style.setProperty("--progress-position", percent);
});

// --- Timeline Scrubbing ---
function handleTimelineUpdate(e) {
  const rect = timelineContainer.getBoundingClientRect();
  const percent = Math.min(Math.max(0, e.x - rect.x), rect.width) / rect.width;
  timelineContainer.style.setProperty("--preview-position", percent);
  if (isScrubbing) {
    e.preventDefault();
    timelineContainer.style.setProperty("--progress-position", percent);
  }
}

timelineContainer.addEventListener("mousedown", e => {
  isScrubbing = true;
  wasPaused = video.paused;
  video.pause();
  videoContainer.classList.add("scrubbing");
  handleTimelineUpdate(e);
});

document.addEventListener("mouseup", e => {
  if (isScrubbing) {
    isScrubbing = false;
    videoContainer.classList.remove("scrubbing");
    const rect = timelineContainer.getBoundingClientRect();
    const percent = Math.min(Math.max(0, e.x - rect.x), rect.width) / rect.width;
    video.currentTime = percent * video.duration;
    if (!wasPaused) video.play();
  }
});

document.addEventListener("mousemove", e => { if (isScrubbing) handleTimelineUpdate(e); });
timelineContainer.addEventListener("mousemove", handleTimelineUpdate);

// --- View Modes & Picture-in-Picture ---
theaterBtn.addEventListener("click", () => videoContainer.classList.toggle("theater"));
fullScreenBtn.addEventListener("click", () => {
  document.fullscreenElement ? document.exitFullscreen() : videoContainer.requestFullscreen();
});
miniPlayerBtn.addEventListener("click", () => video.requestPictureInPicture());

// FIXED: Picture-in-Picture state listeners
video.addEventListener("enterpictureinpicture", () => { 
  videoContainer.classList.add("mini-player"); 
  goHome(); // Return to home view so user can browse while watching
});

video.addEventListener("leavepictureinpicture", () => { 
  videoContainer.classList.remove("mini-player"); 
  // Return to the player view when they restore the video
  homeView.style.display = 'none';
  playerView.style.display = 'block';
  document.body.classList.add('player-active');
});

// --- Keyboard Shortcuts ---
document.addEventListener("keydown", e => {
  if(playerView.style.display === 'none' || document.activeElement.tagName === "INPUT") return;
  const key = e.key.toLowerCase();
  if (key === " " || key === "k") togglePlay();
  if (key === "m") toggleMute();
  if (key === "f") videoContainer.requestFullscreen();
});

// Accordion
document.querySelectorAll(".accordion-content").forEach((item) => {
  item.querySelector("header").addEventListener("click", () => {
    const isOpen = item.classList.toggle("open");
    const desc = item.querySelector(".description-text");
    desc.style.height = isOpen ? `${desc.scrollHeight}px` : "0px";
    const icon = item.querySelector("i");
    icon.classList.toggle("fa-angle-up", isOpen);
    icon.classList.toggle("fa-angle-down", !isOpen);
  });
});