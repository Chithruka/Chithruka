// Puzzle Gods Web Edition — Main UI, Progression, Input & Game Loop Controller
(function () {
  const DATA = window.PG_DATA;
  const CONST = window.PG_CONSTANTS;
  const AUDIO = window.PGAudio;

  const STORAGE_KEY = 'puzzle_gods_web_v1';

  const REALMS = [
    {
      id: 'eLife',
      name: 'Realm of Life',
      godName: 'Life God',
      godImg: 'web_assets/sprites/char_life.png',
      tabImg: 'web_assets/sprites/god_btn_life.png',
      bg: 'assets/single_resolution/backgrounds/lg_game_bg_1.jpg',
      desc: 'Lush sanctuaries of Olympus where Little Zu begins his quest. Master Element Blasts & Lanterns!'
    },
    {
      id: 'eWater',
      name: 'Realm of Water',
      godName: 'Water God',
      godImg: 'web_assets/sprites/char_water.png',
      tabImg: 'web_assets/sprites/god_btn_water.png',
      bg: 'assets/single_resolution/backgrounds/lg_game_bg_2.jpg',
      desc: 'Tidal temples filled with Ice Crystals, Titan Tablets, and Poseidon’s Nova Trident.'
    },
    {
      id: 'eFire',
      name: 'Realm of Fire',
      godName: 'Fire God',
      godImg: 'web_assets/sprites/char_fire.png',
      tabImg: 'web_assets/sprites/god_btn_fire.png',
      bg: 'assets/single_resolution/backgrounds/lg_game_bg_3.jpg',
      desc: 'Volcanic vaults hiding Mud & Golden Keys, Magma Portals, and Flame Blast columns.'
    },
    {
      id: 'eWind',
      name: 'Realm of Wind',
      godName: 'Wind God',
      godImg: 'web_assets/sprites/char_wind.png',
      tabImg: 'web_assets/sprites/god_btn_windy.png',
      bg: 'assets/single_resolution/backgrounds/lg_game_bg_4.jpg',
      desc: 'Cloud-crowned spires featuring expanding Olympus Clouds & fast Timed Score trials!'
    },
    {
      id: 'ePassion',
      name: 'Realm of Passion',
      godName: 'Passion God',
      godImg: 'web_assets/sprites/char_passion.png',
      tabImg: 'web_assets/sprites/god_btn_passion.png',
      bg: 'assets/single_resolution/backgrounds/lg_game_bg_5.jpg',
      desc: 'Ruby citadels featuring Magic Arrows, Chained Elements, and dual objectives.'
    },
    {
      id: 'eEarth',
      name: 'Realm of Earth',
      godName: 'Earth God',
      godImg: 'web_assets/sprites/char_earth.png',
      tabImg: 'web_assets/sprites/god_btn_earth.png',
      bg: 'assets/single_resolution/backgrounds/lg_game_bg_6.jpg',
      desc: 'Mighty stone bastions uniting all mechanics before confronting Little Hades!'
    }
  ];

  const REALM_MAP = Object.fromEntries(REALMS.map(r => [r.id, r]));

  const BOOSTER_INFO = {
    hammer: { unlock: 9, label: 'Tap any tile or blocker to smash it!', blueSprite: 'web_assets/sprites/btn_boost_hammer_blue.png', greenSprite: 'web_assets/sprites/btn_boost_hammer_green.png' },
    trident: { unlock: 13, label: 'Tap any cell to sweep the entire row!', blueSprite: 'web_assets/sprites/btn_boost_trident_blue.png', greenSprite: 'web_assets/sprites/btn_boost_trident_green.png' },
    torch: { unlock: 17, label: 'Tap any cell to incinerate the full column!', blueSprite: 'web_assets/sprites/btn_boost_fire_blue.png', greenSprite: 'web_assets/sprites/btn_boost_fire_green.png' },
    arrow: { unlock: 24, label: 'Tap an element to zap every match on the board!', blueSprite: 'web_assets/sprites/btn_boost_arrow_blue.png', greenSprite: 'web_assets/sprites/btn_boost_arrow_green.png' }
  };

  function defaultSave() {
    return {
      unlockedLevel: 1,
      stars: {},
      scores: {},
      gold: 350,
      boosters: { hammer: 3, trident: 3, torch: 3, arrow: 3 },
      sfx: true,
      music: true,
      autoHints: true,
      sandbox: false
    };
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultSave();
      const parsed = JSON.parse(raw);
      const def = defaultSave();
      return {
        ...def,
        ...parsed,
        boosters: { ...def.boosters, ...(parsed.boosters || {}) },
        stars: parsed.stars || {},
        scores: parsed.scores || {}
      };
    } catch {
      return defaultSave();
    }
  }

  let save = loadSave();
  function persistSave() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    } catch { /* ignore quota issues */ }
  }

  // DOM helpers
  const $ = id => document.getElementById(id);

  // Screens & Modals
  const screenWelcome = $('screen-welcome');
  const screenMap = $('screen-map');
  const screenGame = $('screen-game');
  const modalPregame = $('modal-pregame');
  const modalVictory = $('modal-victory');
  const modalFailed = $('modal-failed');
  const modalHelp = $('modal-help');
  const modalSettings = $('modal-settings');
  const tutorialOverlay = $('tutorial-overlay');

  // Canvas & Renderer
  const canvas = $('board-canvas');
  const canvasFrame = $('board-canvas-frame');
  const renderer = new window.BoardRenderer(canvas);

  // App state
  let currentRealmId = 'eLife';
  let pendingLevelObj = null;
  let pendingPreBoosts = { halo: false, wrappedLine: false, ebomb: false };
  let engine = null;
  let tutStages = [];
  let tutIndex = 0;
  let tutSkipped = false;
  let dragStart = null;
  let boosterTargetDrag = null;
  let lastHudSig = '';
  let lastFrameTime = performance.now();

  // ==================== AUDIO UNLOCK & PREFS ====================
  window.addEventListener('pointerdown', () => AUDIO.unlock(), { passive: true });
  window.addEventListener('touchend', () => AUDIO.unlock(), { passive: true });
  window.addEventListener('click', () => AUDIO.unlock(), { passive: true });
  AUDIO.setSfx(save.sfx);
  AUDIO.setMusic(save.music);

  // ==================== SCREEN NAVIGATION ====================
  function showScreen(name) {
    screenWelcome.classList.toggle('hidden', name !== 'welcome');
    screenMap.classList.toggle('hidden', name !== 'map');
    screenGame.classList.toggle('hidden', name !== 'game');

    if (name === 'welcome') {
      AUDIO.playMusic('welcome', true);
      updateWelcomeUI();
    } else if (name === 'map') {
      AUDIO.playMusic('welcome', true);
      renderWorldMap();
    } else if (name === 'game') {
      resizeBoardCanvas();
      requestAnimationFrame(() => resizeBoardCanvas());
      setTimeout(() => resizeBoardCanvas(), 80);
    }
  }

  function isModalOpen() {
    return (
      !modalPregame.classList.contains('hidden') ||
      !modalVictory.classList.contains('hidden') ||
      !modalFailed.classList.contains('hidden') ||
      !modalHelp.classList.contains('hidden') ||
      !modalSettings.classList.contains('hidden')
    );
  }

  function resizeBoardCanvas() {
    if (!canvasFrame || screenGame.classList.contains('hidden')) return;
    const rect = canvasFrame.getBoundingClientRect();
    if (rect.width > 10 && rect.height > 10) {
      renderer.resize(rect.width, rect.height);
    }
  }

  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => resizeBoardCanvas());
    ro.observe(canvasFrame);
    const boardStage = canvasFrame?.parentElement;
    if (boardStage) ro.observe(boardStage);
  }
  window.addEventListener('resize', () => resizeBoardCanvas());
  window.addEventListener('orientationchange', () => setTimeout(resizeBoardCanvas, 120));
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => resizeBoardCanvas());
  }

  // ==================== LEVEL HELPERS ====================
  function getLevelByNum(num) {
    return DATA.levels.find(l => l.levelNumber === num) || DATA.levels[0];
  }

  function totalEarnedStars() {
    let sum = 0;
    for (const k of Object.keys(save.stars)) sum += save.stars[k] || 0;
    return sum;
  }

  function getLevelTag(lvl) {
    if (lvl.enableBoss) return 'BOSS';
    const t = lvl.objective?.type1;
    if (t === 'oPointsTimed') return 'Timed';
    if (t === 'oCrystal') return 'Crystals';
    if (t === 'oLanterns') return 'Lanterns';
    if (t === 'oKeys') return 'Keys';
    if (t === 'oCollectBottom') return 'Treasure';
    if ((lvl.jelly || []).length > 0) return 'Crystals';
    return 'Collect';
  }

  function formatLangText(str) {
    if (!str) return '';
    const lang = DATA.lang || {};
    return str.replace(/\$\{([^}]+)\}/g, (_, key) => (lang[key] !== undefined ? lang[key] : key));
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ==================== WELCOME & SANDBOX ====================
  function syncSandboxToggles() {
    const label = save.sandbox ? 'ON' : 'OFF';
    $('sandbox-welcome-label').textContent = label;
    $('sandbox-map-label').textContent = label;
    $('btn-sandbox-welcome').classList.toggle('active', save.sandbox);
    $('btn-sandbox-map').classList.toggle('active', save.sandbox);
    const setBtn = $('btn-set-sandbox');
    setBtn.textContent = label;
    setBtn.classList.toggle('active', save.sandbox);
  }

  function toggleSandbox() {
    AUDIO.play('ui_btn');
    save.sandbox = !save.sandbox;
    persistSave();
    syncSandboxToggles();
    if (!screenMap.classList.contains('hidden')) renderWorldMap();
    if (!screenGame.classList.contains('hidden') && engine) updateBoosterDock();
  }

  function updateWelcomeUI() {
    const targetLvl = Math.min(DATA.levels.length, save.unlockedLevel);
    $('welcome-next-lvl').textContent = String(targetLvl);
    syncSandboxToggles();
  }

  // ==================== WORLD MAP ====================
  function renderWorldMap() {
    syncSandboxToggles();
    $('map-stars-total').textContent = `${totalEarnedStars()} / ${DATA.levels.length * 3}`;
    $('map-gold-total').textContent = String(save.gold);

    const nextPlayable = Math.min(DATA.levels.length, save.unlockedLevel);
    $('map-next-lvl-num').textContent = String(nextPlayable);

    const tabsWrap = $('realm-tabs');
    tabsWrap.innerHTML = '';

    for (const r of REALMS) {
      const rLevels = DATA.levels.filter(l => l.world === r.id);
      let rStars = 0;
      for (const l of rLevels) rStars += save.stars[l.levelNumber] || 0;
      const firstNum = rLevels[0]?.levelNumber || 1;
      const lastNum = rLevels[rLevels.length - 1]?.levelNumber || 1;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'realm-tab' + (r.id === currentRealmId ? ' active' : '');
      btn.innerHTML = `
        <img src="${r.tabImg}" alt="${r.name}" />
        <div class="realm-tab-meta">
          <div class="realm-tab-name">${r.name}</div>
          <div class="realm-tab-sub">Lv ${firstNum}–${lastNum} • ★ ${rStars}/${rLevels.length * 3}</div>
        </div>
      `;
      btn.addEventListener('click', () => {
        AUDIO.play('ui_btn');
        currentRealmId = r.id;
        renderWorldMap();
      });
      tabsWrap.appendChild(btn);
    }

    const activeRealm = REALM_MAP[currentRealmId] || REALMS[0];
    screenMap.style.backgroundImage = `url('${activeRealm.bg}')`;
    $('map-realm-portrait').src = activeRealm.godImg;
    $('map-realm-title').textContent = activeRealm.name;
    $('map-realm-desc').textContent = activeRealm.desc;

    const realmLevels = DATA.levels.filter(l => l.world === activeRealm.id);
    let rEarned = 0;
    for (const l of realmLevels) rEarned += save.stars[l.levelNumber] || 0;
    $('map-realm-stars').textContent = `★ ${rEarned} / ${realmLevels.length * 3}`;

    const grid = $('map-nodes-grid');
    grid.innerHTML = '';
    for (const lvl of realmLevels) {
      const n = lvl.levelNumber;
      const earned = save.stars[n] || 0;
      const unlocked = save.sandbox || n <= save.unlockedLevel;
      const isCurrent = n === save.unlockedLevel;

      let nodeSprite = 'web_assets/sprites/node_locked.png';
      if (lvl.enableBoss && unlocked) nodeSprite = 'web_assets/sprites/node_boss.png';
      else if (earned > 0) nodeSprite = 'web_assets/sprites/node_complete.png';
      else if (unlocked && lvl.difficulty >= 4) nodeSprite = 'web_assets/sprites/node_hard.png';
      else if (unlocked) nodeSprite = 'web_assets/sprites/node_blue.png';

      const nodeBtn = document.createElement('button');
      nodeBtn.type = 'button';
      nodeBtn.className = 'stage-node' + (isCurrent ? ' current' : '');
      nodeBtn.disabled = !unlocked;
      nodeBtn.dataset.level = String(n);

      const starHtml = earned > 0
        ? `<img class="stage-node-stars" src="web_assets/sprites/map_stars_${Math.min(3, earned)}.png" alt="${earned} stars" />`
        : `<span class="stage-node-tag">${unlocked ? getLevelTag(lvl) : 'Locked'}</span>`;

      const bossBadge = lvl.enableBoss
        ? `<img class="stage-node-boss-badge" src="web_assets/sprites/green_skull.png" alt="Boss" />`
        : '';

      nodeBtn.innerHTML = `
        ${bossBadge}
        <div class="stage-node-circle">
          <img class="node-bg" src="${nodeSprite}" alt="" />
          <span class="stage-node-num">${n}</span>
        </div>
        ${starHtml}
      `;

      nodeBtn.addEventListener('click', () => {
        if (!unlocked) return;
        AUDIO.play('ui_stage');
        openPreGameModal(lvl);
      });
      grid.appendChild(nodeBtn);
    }

    requestAnimationFrame(() => {
      tabsWrap.querySelector('.realm-tab.active')?.scrollIntoView({ behavior: 'auto', inline: 'center', block: 'nearest' });
      grid.querySelector('.stage-node.current')?.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    });
  }

  // ==================== PRE-GAME MODAL ====================
  function buildLevelObjectiveBadges(lvl) {
    const tmpEngine = new window.PuzzleEngine(lvl, {}, {});
    return tmpEngine.goals.map(g => {
      const sprite = g.icon === 'star_big'
        ? 'web_assets/sprites/star_big.png'
        : (g.icon === 'hades_skull'
          ? 'web_assets/sprites/hades_skull.png'
          : `web_assets/sprites/${g.icon}.png`);
      return {
        sprite,
        label: g.label,
        target: g.target
      };
    });
  }

  function openPreGameModal(lvl) {
    pendingLevelObj = lvl;
    pendingPreBoosts = { halo: false, wrappedLine: false, ebomb: false };
    const realm = REALM_MAP[lvl.world] || REALMS[0];
    const isTimed = lvl.objective?.type1 === 'oPointsTimed';

    $('pregame-title').textContent = lvl.enableBoss
      ? `LEVEL ${lvl.levelNumber} — BOSS`
      : `LEVEL ${lvl.levelNumber}`;
    $('pregame-subtitle').textContent = `${realm.name} • ${
      isTimed ? `${lvl.objective.time || 60}s Timed` : `${lvl.objective.moves || 25} Moves`
    }`;

    const objWrap = $('pregame-objectives');
    objWrap.innerHTML = '';
    for (const o of buildLevelObjectiveBadges(lvl)) {
      const chip = document.createElement('div');
      chip.className = 'pregame-obj-chip';
      chip.innerHTML = `
        <img src="${o.sprite}" alt="" />
        <span>${o.label}: ${o.target}</span>
      `;
      objWrap.appendChild(chip);
    }

    $('pb-halo').querySelector('img.pb-icon').src = isTimed
      ? 'web_assets/sprites/pre_halo_time.png'
      : 'web_assets/sprites/pre_halo.png';
    $('pb-halo-label').textContent = isTimed ? '+25s Time' : '+5 Moves';

    document.querySelectorAll('.preboost-btn').forEach(btn => {
      btn.classList.remove('selected');
      btn.querySelector('.preboost-tick').classList.add('hidden');
    });

    modalPregame.classList.remove('hidden');
  }

  document.querySelectorAll('.preboost-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.pb;
      const next = !pendingPreBoosts[key];
      const countIfSelected = Object.values(pendingPreBoosts).filter(Boolean).length + (next ? 1 : -1);
      if (next && !save.sandbox && save.gold < countIfSelected * 50) {
        AUDIO.play('swap_rev');
        return;
      }
      AUDIO.play('ui_pop');
      pendingPreBoosts[key] = next;
      btn.classList.toggle('selected', next);
      btn.querySelector('.preboost-tick').classList.toggle('hidden', !next);
    });
  });

  // ==================== START & GAMEPLAY ENGINE ====================
  function startLevel(lvl, preBoosts) {
    modalPregame.classList.add('hidden');
    modalVictory.classList.add('hidden');
    modalFailed.classList.add('hidden');

    const boostCost = save.sandbox ? 0 : (Object.values(preBoosts || {}).filter(Boolean).length * 50);
    if (boostCost > 0 && save.gold >= boostCost) {
      save.gold -= boostCost;
      persistSave();
    }

    const realm = REALM_MAP[lvl.world] || REALMS[0];
    currentRealmId = realm.id;
    screenGame.style.backgroundImage = lvl.enableBoss
      ? `url('assets/single_resolution/backgrounds/lg_game_bg_7.jpg')`
      : `url('${realm.bg}')`;

    $('hud-level-title').textContent = `Level ${lvl.levelNumber}`;
    $('hud-level-realm').textContent = realm.name;
    $('game-gold-val').textContent = String(save.gold);

    const companionImg = $('companion-avatar');
    const companionBubble = $('companion-bubble');
    if (lvl.enableBoss) {
      companionImg.src = 'web_assets/sprites/char_hades.png';
      const weakNames = [];
      for (const it of (lvl.objective.items || [])) {
        if (it.filter === 'kElement' && CONST.COLOUR_KEY_TO_ID[it.colour]) {
          const nm = CONST.GEM_NAMES[CONST.COLOUR_KEY_TO_ID[it.colour]];
          if (nm) weakNames.push(nm.toUpperCase());
        }
      }
      companionBubble.textContent = weakNames.length
        ? `Little Hades: Weak against ${weakNames.join(' & ')} blasts!`
        : 'Defeat Little Hades with blasts & element matches!';
    } else {
      companionImg.src = lvl.levelNumber >= 5 ? realm.godImg : 'web_assets/sprites/char_zu.png';
      companionBubble.textContent = getCompanionTip(lvl);
    }

    engine = new window.PuzzleEngine(lvl, preBoosts || {}, {
      onScorePopup: (r, c, text, badge) => renderer.spawnPopup(r, c, text, badge),
      onBossHit: (r, c, dmg) => {
        renderer.spawnLightning(r, c, 0, 3.5, '#ffeb6b');
        renderer.spawnPopup(r, c, `-${dmg} HP`, 'HIT!');
      },
      onHudUpdate: () => updateGameHUD(true),
      onBurst: (r, c, hex) => renderer.spawnBurst(r, c, hex),
      onCollectFly: (r, c, color) => {
        let sprite = null;
        if (color >= 1 && color <= 6) sprite = 'gem_' + CONST.GEM_NAMES[color];
        else if (color >= 8 && color <= 10) sprite = 'treasure_' + (CONST.TREASURE_TYPE[color] || 'gold');
        if (sprite) {
          const tx = renderer.boardRect.x + 16;
          const ty = renderer.boardRect.y + renderer.boardRect.size * 0.22;
          renderer.spawnFlyer(r, c, sprite, tx, ty);
        }
      },
      onKeyFound: (r, c) => {
        const tx = renderer.boardRect.x + 16;
        const ty = renderer.boardRect.y + renderer.boardRect.size * 0.22;
        renderer.spawnFlyer(r, c, 'key_v', tx, ty);
      },
      onBeam: (dir, r, c, hex) => renderer.spawnBeam(dir, r, c, hex),
      onShockwave: (r, c, rad, hex) => renderer.spawnShockwave(r, c, rad, hex),
      onLightning: (r1, c1, r2, c2, hex) => renderer.spawnLightning(r1, c1, r2, c2, hex),
      onBoosterAnim: (type, r, c) => renderer.spawnBoosterAnim(type, r, c),
      onOutOfMoves: () => showFailedModal(),
      onReshuffle: () => renderer.spawnPopup(3.5, 3.5, 'Reshuffling Board!', 'NO MOVES'),
      onWin: (score, stars) => showVictoryModal(lvl, score, stars)
    });

    renderer.setEngine(engine);
    renderer.selected = null;
    dragStart = null;
    boosterTargetDrag = null;
    lastHudSig = '';

    // Initialize tutorial stages if defined for this level
    const tutEntry = (DATA.tutorials || []).find(t => t.levelNumber === lvl.levelNumber);
    tutStages = tutEntry && Array.isArray(tutEntry.stages) ? tutEntry.stages : [];
    tutIndex = 0;
    tutSkipped = false;

    AUDIO.playMusic(lvl.enableBoss ? 'boss' : 'game', true);
    showScreen('game');
    updateGameHUD(true);
    updateBoosterDock();
    syncTutorialUI();
  }

  function getCompanionTip(lvl) {
    if (lvl.enableBoss) return 'Destroy Little Hades by matching goal elements!';
    const t = lvl.objective?.type1;
    if (t === 'oCrystal') return 'Match gems on top of icy Crystals to break them!';
    if (t === 'oLanterns') return 'Match beside Olympian Lanterns 3 times to light them!';
    if (t === 'oKeys') return 'Match next to dark Mud patches to uncover Golden Keys!';
    if (t === 'oCollectBottom') return 'Guide treasures down to the glowing bottom drops!';
    if (t === 'oPointsTimed') return 'Keep matching fast for 2x / 3x / 5x score multipliers!';
    return 'Match 4 in a line, L-shape, T-shape or 5 in a row!';
  }

  // ==================== HUD & BOOSTER DOCK ====================
  function updateGameHUD(force) {
    if (!engine) return;

    // Timer / Moves
    const movesPanel = $('hud-moves-panel');
    const movesWrap = $('moves-mode-wrap');
    const timerWrap = $('timer-mode-wrap');

    if (engine.isTimed) {
      movesWrap.classList.add('hidden');
      timerWrap.classList.remove('hidden');
      const ceilTime = Math.max(0, Math.ceil(engine.timeLeft));
      $('hud-timer-val').textContent = String(ceilTime);
      const frac = Math.max(0, Math.min(1, engine.timeLeft / Math.max(1, engine.maxTime)));
      $('timer-arc').setAttribute('stroke-dashoffset', (226.2 * (1 - frac)).toFixed(1));
      $('timer-arc').setAttribute('stroke', ceilTime <= 10 ? '#ff6b6b' : '#ffd84d');
      $('hud-speed-mult').textContent = `${engine.speedMult}x SCORE`;
      movesPanel.classList.toggle('low', ceilTime <= 10 && !engine.ended);
    } else {
      movesWrap.classList.remove('hidden');
      timerWrap.classList.add('hidden');
      $('hud-moves-val').textContent = String(Math.max(0, engine.movesLeft));
      const isLow = engine.movesLeft <= 5 && !engine.ended;
      movesPanel.classList.toggle('low', isLow);
      $('moves-pill-img').src = isLow
        ? 'web_assets/sprites/hud_moves_red.png'
        : 'web_assets/sprites/hud_moves_pill.png';
    }

    // Score & Stars meter
    $('hud-score-val').textContent = engine.score.toLocaleString();
    const maxPts = Math.max(1, engine.pointsTargets[2] || engine.pointsTargets[0] * 3);
    const pct = Math.min(100, Math.round((engine.score / maxPts) * 100));
    $('star-meter-fill').style.width = pct + '%';

    const p1Pos = Math.max(10, Math.min(82, Math.round((engine.pointsTargets[0] / maxPts) * 100)));
    const p2Pos = Math.max(p1Pos + 8, Math.min(91, Math.round((engine.pointsTargets[1] / maxPts) * 100)));
    $('star-m1').style.left = p1Pos + '%';
    $('star-m2').style.left = p2Pos + '%';
    $('star-m3').style.left = '97%';

    $('star-m1').src = engine.stars >= 1 ? 'web_assets/sprites/star_big.png' : 'web_assets/sprites/star_empty.png';
    $('star-m2').src = engine.stars >= 2 ? 'web_assets/sprites/star_big.png' : 'web_assets/sprites/star_empty.png';
    $('star-m3').src = engine.stars >= 3 ? 'web_assets/sprites/star_big.png' : 'web_assets/sprites/star_empty.png';

    // Boss Bar
    const bossRow = $('boss-bar-row');
    if (engine.isBoss) {
      bossRow.classList.remove('hidden');
      const hpPct = Math.max(0, Math.min(100, (engine.bossHp / Math.max(1, engine.bossMaxHp)) * 100));
      $('boss-bar-fill').style.width = hpPct + '%';
      $('boss-bar-text').textContent = `${engine.bossHp} / ${engine.bossMaxHp}`;
    } else {
      bossRow.classList.add('hidden');
    }

    $('game-gold-val').textContent = String(save.gold);

    // Objective Goals List (rebuild only when values change)
    const sig = engine.goals.map(g => `${g.type}:${g.current}/${g.target}`).join('|');
    if (force || sig !== lastHudSig) {
      lastHudSig = sig;
      const goalsWrap = $('hud-goals-list');
      goalsWrap.innerHTML = '';
      for (const g of engine.goals) {
        const done = g.current >= g.target;
        const iconSrc = g.icon === 'star_big'
          ? 'web_assets/sprites/star_big.png'
          : (g.icon === 'hades_skull'
            ? 'web_assets/sprites/hades_skull.png'
            : `web_assets/sprites/${g.icon}.png`);
        const row = document.createElement('div');
        row.className = 'goal-row' + (done ? ' done' : '');
        row.innerHTML = `
          <div class="goal-row-left">
            <img src="${iconSrc}" alt="${g.label}" />
            <span class="goal-row-label">${g.label}</span>
          </div>
          <div class="goal-row-count">
            ${done
              ? `<img src="web_assets/sprites/icon_check.png" alt="Done" class="goal-check-img" />`
              : `<span>${g.current}/${g.target}</span>`}
          </div>
        `;
        goalsWrap.appendChild(row);
      }
    }
  }

  function updateBoosterDock() {
    if (!engine) return;
    const lvlNum = engine.level.levelNumber;
    const banner = $('booster-target-banner');

    if (engine.activeBooster && BOOSTER_INFO[engine.activeBooster]) {
      banner.classList.remove('hidden');
      $('booster-target-text').textContent = BOOSTER_INFO[engine.activeBooster].label;
    } else {
      banner.classList.add('hidden');
      boosterTargetDrag = null;
      renderer.hoverCell = null;
    }

    for (const [type, info] of Object.entries(BOOSTER_INFO)) {
      const btn = $(`boost-btn-${type}`);
      const img = $(`boost-img-${type}`);
      const cntEl = $(`boost-cnt-${type}`);
      const lockEl = $(`boost-lock-${type}`);
      const unlocked = save.sandbox || lvlNum >= info.unlock;

      btn.disabled = !unlocked;
      btn.classList.toggle('selected', engine.activeBooster === type);

      if (!unlocked) {
        img.src = 'web_assets/sprites/btn_boost_locked.png';
        cntEl.classList.add('hidden');
        lockEl.classList.remove('hidden');
      } else {
        const count = save.sandbox ? '∞' : save.boosters[type];
        img.src = engine.activeBooster === type ? info.blueSprite : info.greenSprite;
        cntEl.textContent = String(count);
        cntEl.classList.remove('hidden');
        lockEl.classList.add('hidden');
      }
    }
  }

  // Click on God Boosters
  document.querySelectorAll('.booster-slot').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!engine || engine.busy || engine.ended) return;
      const type = btn.dataset.booster;
      const info = BOOSTER_INFO[type];
      if (!save.sandbox && engine.level.levelNumber < info.unlock) return;

      // Toggle off if already selected
      if (engine.activeBooster === type) {
        AUDIO.play('ui_btn');
        engine.activeBooster = null;
        updateBoosterDock();
        return;
      }

      if (!save.sandbox && (save.boosters[type] || 0) <= 0) {
        if (save.gold >= 50) {
          save.gold -= 50;
          save.boosters[type] = 1;
          persistSave();
          updateGameHUD(true);
        } else {
          AUDIO.play('swap_rev');
          renderer.spawnPopup(3.5, 3.5, 'Need 50 Gold!', 'EMPTY');
          return;
        }
      }

      AUDIO.play('ui_boost');
      engine.activeBooster = type;
      renderer.selected = null;
      updateBoosterDock();

      // Advance tutorial stage if waiting for eGodBoosterSelected
      const curTut = currentTutorialStage();
      if (curTut && curTut.completionEvent === 'eGodBoosterSelected') {
        advanceTutorialStage();
      }
    });
  });

  $('btn-cancel-booster').addEventListener('click', () => {
    if (!engine) return;
    AUDIO.play('ui_btn');
    engine.activeBooster = null;
    updateBoosterDock();
  });

  // ==================== TUTORIAL CONTROLLER ====================
  function currentTutorialStage() {
    if (tutSkipped || !tutStages || tutIndex >= tutStages.length) return null;
    return tutStages[tutIndex];
  }

  function advanceTutorialStage() {
    tutIndex++;
    syncTutorialUI();
  }

  function syncTutorialUI() {
    const stage = currentTutorialStage();
    if (!stage) {
      tutorialOverlay.classList.add('hidden');
      renderer.tutorialStage = null;
      return;
    }

    const ev = stage.completionEvent || 'eTappedScreen';
    const isTap = ev === 'eTappedScreen' || ev === '' || ev === 'eMagicGemSpawnedEvent';
    renderer.tutorialStage = isTap ? null : stage;

    // Position tutorial card over the top bar or booster dock so all 8x8 board cells stay unobstructed
    tutorialOverlay.classList.remove('hidden', 'tap-blocking', 'pos-top', 'pos-bottom', 'pos-center');
    if (isTap) {
      tutorialOverlay.classList.add('tap-blocking', 'pos-center');
    } else if (ev === 'eGodBoosterSelected' || stage.dialogPositionTimeline === 'kMatchBooster') {
      tutorialOverlay.classList.add('pos-top');
    } else {
      let sumRow = 0, cnt = 0;
      const nodes = stage.enabledNodes || stage.highlightNodes;
      if (Array.isArray(nodes)) {
        for (let i = 0; i < 64; i++) {
          if (nodes[i] > 0) {
            sumRow += Math.floor(i / 8);
            cnt++;
          }
        }
      }
      const avgRow = cnt > 0 ? sumRow / cnt : 3.5;
      tutorialOverlay.classList.add(avgRow < 2.5 ? 'pos-bottom' : 'pos-top');
    }

    const txt = formatLangText(stage.dialogText || '');
    $('tutorial-text').innerHTML = escapeHtml(txt)
      .replace(/\n{2,}/g, '<span class="tut-gap"></span>')
      .replace(/\n/g, '<br/>');
    $('btn-tutorial-next').classList.toggle('hidden', !isTap);

    // If booster tutorial & booster count is 0, ensure player has at least 1
    if (ev === 'eGodBoosterSelected' && engine) {
      for (const [k, info] of Object.entries(BOOSTER_INFO)) {
        if (engine.level.levelNumber === info.unlock && (save.boosters[k] || 0) <= 0) {
          save.boosters[k] = 1;
          persistSave();
          updateBoosterDock();
        }
      }
    }
  }

  tutorialOverlay.addEventListener('click', e => {
    if (e.target.id === 'btn-tutorial-skip') return;
    const stage = currentTutorialStage();
    if (!stage) return;
    const ev = stage.completionEvent || 'eTappedScreen';
    if (ev === 'eTappedScreen' || ev === '' || ev === 'eMagicGemSpawnedEvent') {
      AUDIO.play('ui_pop');
      advanceTutorialStage();
    }
  });

  $('btn-tutorial-next').addEventListener('click', e => {
    e.stopPropagation();
    AUDIO.play('ui_pop');
    advanceTutorialStage();
  });

  $('btn-tutorial-skip').addEventListener('click', e => {
    e.stopPropagation();
    AUDIO.play('ui_btn');
    tutSkipped = true;
    syncTutorialUI();
  });

  function isTutorialSwapAllowed(r1, c1, r2, c2) {
    const stage = currentTutorialStage();
    if (!stage || stage.completionEvent !== 'eMatchMade') return true;
    const en = stage.enabledNodes;
    if (!Array.isArray(en) || en.length < 64 || stage.invertEnabledNodes) return true;

    let p2 = null, p3 = null;
    for (let i = 0; i < 64; i++) {
      if (en[i] === 2) p2 = { r: Math.floor(i / 8), c: i % 8 };
      if (en[i] === 3) p3 = { r: Math.floor(i / 8), c: i % 8 };
    }
    if (!p2 || !p3 || !engine.canSwap(p2.r, p2.c, p3.r, p3.c)) {
      return true; // Safety fallback so tutorial can never soft-lock
    }
    return (
      (r1 === p2.r && c1 === p2.c && r2 === p3.r && c2 === p3.c) ||
      (r1 === p3.r && c1 === p3.c && r2 === p2.r && c2 === p2.c)
    );
  }

  // ==================== BOARD POINTER INPUT (CLICK + SWIPE) ====================
  async function handlePlayerSwap(r1, c1, r2, c2) {
    if (!engine || engine.busy || engine.ended) return;
    if (!isTutorialSwapAllowed(r1, c1, r2, c2)) {
      AUDIO.play('swap_rev');
      return;
    }

    // Hide tutorial prompt temporarily while resolving cascade
    const curStage = currentTutorialStage();
    const ok = await engine.trySwap(r1, c1, r2, c2);
    if (ok && curStage && curStage.completionEvent === 'eMatchMade') {
      advanceTutorialStage();
    }
    updateGameHUD(true);
    updateBoosterDock();
  }

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('pointerdown', e => {
    AUDIO.unlock();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!e.isPrimary) return;
    if (!engine || engine.busy || engine.ended || isModalOpen()) return;
    const stage = currentTutorialStage();
    if (stage && (stage.completionEvent === 'eTappedScreen' || stage.completionEvent === 'eGodBoosterSelected')) {
      return;
    }

    const cell = renderer.clientToCell(e.clientX, e.clientY);
    if (!cell || !engine.board[cell.r][cell.c].active) {
      renderer.selected = null;
      renderer.dragFeedback = null;
      return;
    }

    if (engine.activeBooster) {
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      boosterTargetDrag = { pointerId: e.pointerId, booster: engine.activeBooster };
      renderer.hoverCell = cell;
      renderer.dragFeedback = null;
      engine.lastInputAt = performance.now();
      engine.hintPair = null;
      return;
    }

    if (dragStart && dragStart.pointerId !== e.pointerId) return;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    dragStart = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, r: cell.r, c: cell.c, swiped: false };
    renderer.dragFeedback = { r: cell.r, c: cell.c, dx: 0, dy: 0 };
    engine.lastInputAt = performance.now();
    engine.hintPair = null;
  });

  canvas.addEventListener('pointermove', e => {
    if (!engine) return;
    const cell = renderer.clientToCell(e.clientX, e.clientY);

    if (boosterTargetDrag) {
      if (e.pointerId !== boosterTargetDrag.pointerId) return;
      renderer.hoverCell = (cell && engine.board[cell.r][cell.c].active) ? cell : null;
      return;
    }

    if (e.pointerType !== 'touch') {
      renderer.hoverCell = cell;
    }

    if (!dragStart || e.pointerId !== dragStart.pointerId || dragStart.swiped || engine.busy || engine.ended || engine.activeBooster) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const cellPx = renderer.boardRect.cell || 44;
    const maxNudge = cellPx * 0.26;
    if (Math.abs(dx) >= Math.abs(dy)) {
      renderer.dragFeedback = {
        r: dragStart.r,
        c: dragStart.c,
        dx: Math.max(-maxNudge, Math.min(maxNudge, dx)),
        dy: 0
      };
    } else {
      renderer.dragFeedback = {
        r: dragStart.r,
        c: dragStart.c,
        dx: 0,
        dy: Math.max(-maxNudge, Math.min(maxNudge, dy))
      };
    }

    const thresh = Math.max(12, cellPx * 0.28);
    if (Math.hypot(dx, dy) >= thresh) {
      dragStart.swiped = true;
      let dr = 0, dc = 0;
      if (Math.abs(dx) >= Math.abs(dy)) dc = dx > 0 ? 1 : -1;
      else dr = dy > 0 ? 1 : -1;
      const r1 = dragStart.r, c1 = dragStart.c;
      const r2 = r1 + dr, c2 = c1 + dc;
      renderer.selected = null;
      renderer.dragFeedback = null;
      dragStart = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      if (engine.inBounds(r2, c2)) {
        handlePlayerSwap(r1, c1, r2, c2);
      }
    }
  });

  canvas.addEventListener('pointerup', e => {
    if (boosterTargetDrag) {
      if (e.pointerId !== boosterTargetDrag.pointerId) return;
      const bType = boosterTargetDrag.booster;
      boosterTargetDrag = null;
      renderer.hoverCell = null;
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      if (!engine || engine.busy || engine.ended) return;
      const cell = renderer.clientToCell(e.clientX, e.clientY);
      if (cell && engine.board[cell.r][cell.c].active && engine.activeBooster === bType) {
        engine.useBooster(bType, cell.r, cell.c).then(used => {
          if (used && !save.sandbox) {
            save.boosters[bType] = Math.max(0, (save.boosters[bType] || 1) - 1);
            persistSave();
          }
          updateGameHUD(true);
          updateBoosterDock();
        });
      }
      return;
    }

    if (!dragStart || e.pointerId !== dragStart.pointerId) return;
    const ds = dragStart;
    dragStart = null;
    renderer.dragFeedback = null;
    if (e.pointerType === 'touch') renderer.hoverCell = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (ds.swiped || !engine || engine.busy || engine.ended) return;

    const rawCell = renderer.clientToCell(e.clientX, e.clientY);
    const cell = (rawCell && engine.board[rawCell.r][rawCell.c].active)
      ? rawCell
      : (Math.hypot(e.clientX - ds.x, e.clientY - ds.y) < 18 ? { r: ds.r, c: ds.c } : null);
    if (!cell || !engine.board[cell.r][cell.c].active) {
      renderer.selected = null;
      return;
    }

    if (!renderer.selected) {
      renderer.selected = { r: cell.r, c: cell.c };
      AUDIO.play('ui_pop', 0.35);
    } else if (renderer.selected.r === cell.r && renderer.selected.c === cell.c) {
      renderer.selected = null;
    } else if (Math.abs(renderer.selected.r - cell.r) + Math.abs(renderer.selected.c - cell.c) === 1) {
      const a = renderer.selected;
      renderer.selected = null;
      handlePlayerSwap(a.r, a.c, cell.r, cell.c);
    } else {
      renderer.selected = { r: cell.r, c: cell.c };
      AUDIO.play('ui_pop', 0.35);
    }
  });

  canvas.addEventListener('pointercancel', e => {
    if (boosterTargetDrag && e.pointerId === boosterTargetDrag.pointerId) {
      boosterTargetDrag = null;
      renderer.hoverCell = null;
    }
    if (dragStart && e.pointerId === dragStart.pointerId) {
      dragStart = null;
      renderer.dragFeedback = null;
    }
  });
  canvas.addEventListener('pointerleave', e => {
    if (e.pointerType !== 'touch') renderer.hoverCell = null;
  });

  // ==================== VICTORY & OUT OF MOVES ====================
  function showVictoryModal(lvl, score, stars) {
    const n = lvl.levelNumber;
    const prevStars = save.stars[n] || 0;
    const reward = 40 + stars * 20;

    save.stars[n] = Math.max(prevStars, stars);
    save.scores[n] = Math.max(save.scores[n] || 0, score);
    if (n >= save.unlockedLevel && n < DATA.levels.length) {
      save.unlockedLevel = n + 1;
    }
    save.gold += reward;
    persistSave();

    $('victory-ribbon').textContent = lvl.enableBoss ? 'GOD FREED!' : `LEVEL ${n} COMPLETE!`;
    $('victory-stars-img').src = `web_assets/sprites/win_stars_${Math.max(1, Math.min(3, stars))}.png`;
    $('victory-score').textContent = `Score: ${score.toLocaleString()}`;
    $('victory-reward').textContent = `+${reward} Gold Earned!`;
    $('btn-victory-next').classList.toggle('hidden', n >= DATA.levels.length);

    modalVictory.classList.remove('hidden');
    AUDIO.playMusic('win', false);
    setTimeout(() => AUDIO.play('star1'), 180);
    if (stars >= 2) setTimeout(() => AUDIO.play('star2'), 380);
    if (stars >= 3) setTimeout(() => AUDIO.play('star3'), 580);
  }

  function showFailedModal() {
    if (!engine) return;
    const timed = engine.isTimed;
    $('failed-ribbon').textContent = timed ? "TIME'S UP!" : 'OUT OF MOVES!';
    $('failed-msg').textContent = engine.isBoss
      ? "You didn't defeat Little Hades yet! Grab extra power or retry."
      : 'So close! Grab extra time/moves or retry the puzzle.';
    const extraLabel = timed ? '+15 Seconds' : '+5 Moves';
    $('btn-failed-extra').textContent = save.sandbox
      ? `${extraLabel} (Free)`
      : `${extraLabel} (100 Gold)`;
    modalFailed.classList.remove('hidden');
    AUDIO.playMusic('lose', false);
  }

  $('btn-failed-extra').addEventListener('click', () => {
    if (!engine) return;
    if (!save.sandbox && save.gold < 100) {
      AUDIO.play('swap_rev');
      return;
    }
    if (!save.sandbox) {
      save.gold -= 100;
      persistSave();
    }
    AUDIO.play('ui_btn');
    modalFailed.classList.add('hidden');
    engine.addExtraMoves(engine.isTimed ? 15 : 5);
    AUDIO.playMusic(engine.level.enableBoss ? 'boss' : 'game', true);
    updateGameHUD(true);
  });

  $('btn-failed-retry').addEventListener('click', () => {
    if (!engine) return;
    AUDIO.play('ui_btn');
    startLevel(engine.level, pendingPreBoosts);
  });

  $('btn-failed-map').addEventListener('click', () => {
    AUDIO.play('ui_btn');
    modalFailed.classList.add('hidden');
    showScreen('map');
  });

  $('btn-victory-next').addEventListener('click', () => {
    if (!engine) return;
    AUDIO.play('ui_btn');
    const nextLvl = getLevelByNum(Math.min(DATA.levels.length, engine.level.levelNumber + 1));
    modalVictory.classList.add('hidden');
    currentRealmId = nextLvl.world;
    openPreGameModal(nextLvl);
  });

  $('btn-victory-replay').addEventListener('click', () => {
    if (!engine) return;
    AUDIO.play('ui_btn');
    startLevel(engine.level, pendingPreBoosts);
  });

  $('btn-victory-map').addEventListener('click', () => {
    AUDIO.play('ui_btn');
    modalVictory.classList.add('hidden');
    showScreen('map');
  });

  // ==================== BUTTON WIRING ====================
  $('btn-welcome-play').addEventListener('click', () => {
    AUDIO.play('ui_btn');
    const cur = getLevelByNum(Math.min(DATA.levels.length, save.unlockedLevel));
    currentRealmId = cur.world;
    showScreen('map');
  });

  $('btn-welcome-quickplay').addEventListener('click', () => {
    AUDIO.play('ui_stage');
    const cur = getLevelByNum(Math.min(DATA.levels.length, save.unlockedLevel));
    currentRealmId = cur.world;
    openPreGameModal(cur);
  });

  $('btn-sandbox-welcome').addEventListener('click', toggleSandbox);
  $('btn-sandbox-map').addEventListener('click', toggleSandbox);
  $('btn-set-sandbox').addEventListener('click', toggleSandbox);

  $('btn-map-home').addEventListener('click', () => {
    AUDIO.play('ui_btn');
    showScreen('welcome');
  });

  $('btn-map-play-current').addEventListener('click', () => {
    AUDIO.play('ui_stage');
    const cur = getLevelByNum(Math.min(DATA.levels.length, save.unlockedLevel));
    openPreGameModal(cur);
  });

  $('btn-pregame-close').addEventListener('click', () => {
    AUDIO.play('ui_btn');
    modalPregame.classList.add('hidden');
  });

  $('btn-pregame-play').addEventListener('click', () => {
    if (!pendingLevelObj) return;
    AUDIO.play('ui_stage');
    startLevel(pendingLevelObj, pendingPreBoosts);
  });

  $('btn-game-hint').addEventListener('click', () => {
    if (!engine || engine.busy || engine.ended) return;
    AUDIO.play('ui_pop');
    engine.hintPair = engine.findValidMove();
  });

  $('btn-game-restart').addEventListener('click', () => {
    if (!engine) return;
    AUDIO.play('ui_btn');
    startLevel(engine.level, pendingPreBoosts);
  });

  $('btn-game-map').addEventListener('click', () => {
    AUDIO.play('ui_btn');
    engine = null;
    renderer.setEngine(null);
    showScreen('map');
  });

  // Help Modal
  const openHelp = () => { AUDIO.play('ui_btn'); modalHelp.classList.remove('hidden'); };
  $('btn-help-welcome').addEventListener('click', openHelp);
  $('btn-help-map').addEventListener('click', openHelp);
  $('btn-game-help').addEventListener('click', openHelp);
  $('btn-help-close').addEventListener('click', () => { AUDIO.play('ui_btn'); modalHelp.classList.add('hidden'); });

  // Settings Modal
  function syncSettingsUI() {
    $('btn-set-sfx').textContent = save.sfx ? 'ON' : 'OFF';
    $('btn-set-sfx').classList.toggle('active', save.sfx);
    $('btn-set-music').textContent = save.music ? 'ON' : 'OFF';
    $('btn-set-music').classList.toggle('active', save.music);
    $('btn-set-hints').textContent = save.autoHints ? 'ON' : 'OFF';
    $('btn-set-hints').classList.toggle('active', save.autoHints);
    syncSandboxToggles();
  }

  const openSettings = () => {
    AUDIO.play('ui_btn');
    syncSettingsUI();
    modalSettings.classList.remove('hidden');
  };
  $('btn-settings-welcome').addEventListener('click', openSettings);
  $('btn-settings-map').addEventListener('click', openSettings);
  $('btn-game-settings').addEventListener('click', openSettings);
  $('btn-settings-close').addEventListener('click', () => { AUDIO.play('ui_btn'); modalSettings.classList.add('hidden'); });

  $('btn-set-sfx').addEventListener('click', () => {
    save.sfx = !save.sfx;
    AUDIO.setSfx(save.sfx);
    AUDIO.play('ui_btn');
    persistSave();
    syncSettingsUI();
  });

  $('btn-set-music').addEventListener('click', () => {
    save.music = !save.music;
    AUDIO.play('ui_btn');
    AUDIO.setMusic(save.music);
    persistSave();
    syncSettingsUI();
  });

  $('btn-set-hints').addEventListener('click', () => {
    save.autoHints = !save.autoHints;
    if (!save.autoHints && engine) engine.hintPair = null;
    AUDIO.play('ui_btn');
    persistSave();
    syncSettingsUI();
  });

  $('btn-set-reset').addEventListener('click', () => {
    AUDIO.play('ui_btn');
    save = defaultSave();
    persistSave();
    syncSettingsUI();
    modalSettings.classList.add('hidden');
    engine = null;
    renderer.setEngine(null);
    showScreen('welcome');
  });

  // Escape closes top modal / booster mode
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!modalSettings.classList.contains('hidden')) modalSettings.classList.add('hidden');
    else if (!modalHelp.classList.contains('hidden')) modalHelp.classList.add('hidden');
    else if (!modalPregame.classList.contains('hidden')) modalPregame.classList.add('hidden');
    else if (engine && engine.activeBooster) {
      engine.activeBooster = null;
      updateBoosterDock();
    }
  });

  // ==================== MAIN ANIMATION LOOP ====================
  function frameLoop(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000));
    lastFrameTime = now;

    if (engine && !screenGame.classList.contains('hidden')) {
      const curTut = currentTutorialStage();
      const tutBlocking = curTut && (curTut.completionEvent === 'eTappedScreen' || curTut.completionEvent === '');
      const paused = isModalOpen() || tutBlocking;

      // Timed countdown
      if (engine.isTimed && !engine.ended && !paused) {
        const prevSec = Math.ceil(engine.timeLeft);
        engine.timeLeft = Math.max(0, engine.timeLeft - dt);
        const curSec = Math.ceil(engine.timeLeft);
        if (curSec !== prevSec) {
          updateGameHUD(false);
          if (curSec <= 5 && curSec > 0) AUDIO.play('tick', 0.45);
        } else {
          const frac = Math.max(0, Math.min(1, engine.timeLeft / Math.max(1, engine.maxTime)));
          $('timer-arc').setAttribute('stroke-dashoffset', (226.2 * (1 - frac)).toFixed(1));
        }

        if (engine.timeLeft <= 0 && !engine.busy) {
          if (engine.score >= engine.pointsTargets[0]) {
            engine.handleWin();
          } else {
            engine.ended = true;
            AUDIO.play('lose');
            showFailedModal();
          }
        }
      }

      // Auto-hint after 5s idle
      if (save.autoHints && !engine.busy && !engine.ended && !paused && !engine.activeBooster && !curTut) {
        if (!engine.hintPair && now - engine.lastInputAt >= 5000) {
          engine.hintPair = engine.findValidMove();
        }
      }

      renderer.render(dt, now);
    }

    requestAnimationFrame(frameLoop);
  }

  // Boot UI
  syncSettingsUI();
  const initialScreen = window.location.hash === '#map' ? 'map' : 'welcome';
  showScreen(initialScreen);
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#map' && screenGame.classList.contains('hidden')) {
      showScreen('map');
    }
  });
  requestAnimationFrame(frameLoop);
})();
