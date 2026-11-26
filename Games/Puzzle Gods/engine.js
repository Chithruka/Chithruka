// Puzzle Gods — Core Match-3 Simulation & Rules Engine
(function () {
  const GEM_NAMES = {
    1: 'air',
    2: 'earth',
    3: 'fire',
    4: 'life',
    5: 'passion',
    6: 'water'
  };

  const COLOUR_KEY_TO_ID = {
    kGemAir: 1,
    kGemEarth: 2,
    kGemFire: 3,
    kGemLife: 4,
    kGemPassion: 5,
    kGemWater: 6,
    kGemCollectRing_Gold: 8,
    kGemCollectRing_Ruby: 9,
    kGemCollectRing_Diamond: 10
  };

  const TREASURE_TYPE = {
    8: 'gold',
    9: 'ruby',
    10: 'diamond'
  };

  // Powerup IDs matching level .dat files
  const PWR_NONE = 0;
  const PWR_BOMB = 1;       // Element Bomb (5-in-a-line)
  const PWR_HORIZ = 5;      // Horizontal Line Blast
  const PWR_VERT = 6;       // Vertical Line Blast
  const PWR_WRAPPED = 7;    // Encased / Wrapped Bomb (3x3 x2)
  const PWR_X = 13;         // X-Blast (diagonal cross)

  let nextPieceUid = 1;

  function makeGemPiece(color, powerup = PWR_NONE, opts = {}) {
    return {
      uid: nextPieceUid++,
      kind: opts.kind || 'gem', // 'gem' | 'treasure' | 'lantern' | 'tablet' | 'cloud' | 'hadesSkull'
      color: color || 0,
      powerup: powerup || PWR_NONE,
      hp: opts.hp || 0,         // tablet: 1..3, lantern: lit count 0..3 (3 = lit!)
      chained: !!opts.chained,
      timeBonus: opts.timeBonus || 0,
      wrappedPending: false,
      // Visual interpolation coordinates (in grid units)
      vx: opts.col ?? 0,
      vy: opts.row ?? 0,
      scale: opts.scale ?? 1,
      alpha: 1,
      flash: 0
    };
  }

  class PuzzleEngine {
    constructor(levelData, preBoosts, callbacks) {
      this.level = levelData;
      this.preBoosts = preBoosts || {};
      this.cb = callbacks || {};
      this.rows = levelData.rows || 8;
      this.cols = levelData.cols || 8;
      this.colours = (levelData.colours && levelData.colours.length) ? levelData.colours.slice() : [1, 2, 3, 4, 5, 6];

      this.score = 0;
      this.stars = 0;
      this.pointsTargets = [
        levelData.objective.pointsTarget1 || 3000,
        levelData.objective.pointsTarget2 || 9000,
        levelData.objective.pointsTarget3 || 15000
      ];

      this.isTimed = levelData.objective.type1 === 'oPointsTimed';
      this.movesLeft = levelData.objective.moves || 25;
      this.timeLeft = levelData.objective.time || 60;
      if (this.preBoosts.halo) {
        if (this.isTimed) this.timeLeft += 25;
        else this.movesLeft += 5;
      }
      this.maxTime = this.timeLeft;
      this.movesTaken = 0;

      // Boss state
      this.isBoss = !!levelData.enableBoss;
      this.bossMaxHp = this.isBoss ? (levelData.objective.boss_health || 65) : 0;
      this.bossHp = this.bossMaxHp;
      this.hadesConfig = levelData.hadesBlockers || null;
      this.hadesMoveCounter = 0;

      // Combo & speed multiplier (timed levels)
      this.comboCount = 0;
      this.speedMult = 1;
      this.lastMatchTime = 0;

      // Tutorial queue per column (if defined)
      this.tutQueues = [];
      if (Array.isArray(levelData.tutorial_queue)) {
        for (let c = 0; c < this.cols; c++) {
          const q = Array.isArray(levelData.tutorial_queue[c])
            ? levelData.tutorial_queue[c].filter(v => v > 0)
            : [];
          this.tutQueues.push(q);
        }
      }

      // Entity queue (treasures / +5s time gems)
      this.entityQueue = [];
      if (Array.isArray(levelData.entity_queue)) {
        for (const eq of levelData.entity_queue) {
          this.entityQueue.push({
            color: eq.entity_colour || 0,
            type: eq.entity_type || 0,
            atOnce: eq.num_spawn_at_once || 1,
            spawnBefore: eq.num_spawn_before || 0,
            timeBonus: eq.time_bonus || 0,
            spawned: false
          });
        }
      }
      this.clearsSinceLastSpawn = 0;

      // Build board[r][c] with r=0 TOP, r=rows-1 BOTTOM
      this.board = [];
      this.initBoard();
      this.initGoals();
      this.applyPreGameBoosters();

      this.busy = false;
      this.ended = false;
      this.activeBooster = null; // 'hammer' | 'trident' | 'torch' | 'arrow' | null
      this.hintPair = null;
      this.lastInputAt = performance.now();
      this.cloudHitThisTurn = false;
    }

    initBoard() {
      const { rows, cols, level } = this;
      const grid = level.grid || [];
      const gems = level.gems || [];
      const types = level.type || [];
      const powerups = level.powerups || [];
      const extra = level.extra || [];

      for (let r = 0; r < rows; r++) {
        this.board[r] = [];
        const y = rows - 1 - r; // Cocos2d bottom-up y
        for (let c = 0; c < cols; c++) {
          const idx = y * cols + c;
          const gv = grid[idx] ?? 0;
          const active = !(gv === 1 || gv === 2 || gv === 3);
          this.board[r][c] = {
            r, c,
            active,
            gridVal: gv,
            crystal: 0,
            mud: 0,
            hiddenKey: false,
            keyCollected: false,
            hasChest: false,
            portalOut: null,
            piece: null
          };
        }
      }

      // Crystals (jelly)
      if (Array.isArray(level.jelly)) {
        for (const j of level.jelly) {
          const r = rows - 1 - j.y;
          const c = j.x;
          if (this.inBounds(r, c) && this.board[r][c].active) {
            this.board[r][c].crystal = Math.max(1, j.extra || 1);
          }
        }
      }

      // Mud
      const mudCells = [];
      if (Array.isArray(level.mud)) {
        for (const m of level.mud) {
          const r = rows - 1 - m.y;
          const c = m.x;
          if (this.inBounds(r, c) && this.board[r][c].active) {
            this.board[r][c].mud = 1;
            mudCells.push(this.board[r][c]);
          }
        }
      }

      // Place hidden keys randomly under mud cells
      const numKeys = level.objective.numKeys || 0;
      if (numKeys > 0 && mudCells.length > 0) {
        const shuffled = mudCells.slice().sort(() => Math.random() - 0.5);
        for (let i = 0; i < Math.min(numKeys, shuffled.length); i++) {
          shuffled[i].hiddenKey = true;
        }
      }

      // Chests (treasure drop targets)
      if (Array.isArray(level.chests)) {
        for (const ch of level.chests) {
          const r = rows - 1 - ch.y;
          const c = ch.x;
          if (this.inBounds(r, c)) {
            this.board[r][c].hasChest = true;
          }
        }
      }

      // Portals
      if (Array.isArray(level.portals)) {
        for (const p of level.portals) {
          const sr = rows - 1 - p.start.y;
          const sc = p.start.x;
          const er = rows - 1 - p.end.y;
          const ec = p.end.x;
          if (this.inBounds(sr, sc) && this.inBounds(er, ec)) {
            this.board[sr][sc].portalOut = { r: er, c: ec };
          }
        }
      }

      // Place pieces (preset vs random)
      for (let r = 0; r < rows; r++) {
        const y = rows - 1 - r;
        for (let c = 0; c < cols; c++) {
          const cell = this.board[r][c];
          if (!cell.active) continue;
          const idx = y * cols + c;
          const g = gems[idx] || 0;
          const tp = types[idx] || 0;
          const pw = powerups[idx] || 0;
          const ex = extra[idx] || 0;

          if (tp === 7) {
            cell.piece = makeGemPiece(0, 0, { kind: 'lantern', hp: 0, row: r, col: c });
          } else if (tp === 1) {
            cell.piece = makeGemPiece(0, 0, { kind: 'tablet', hp: Math.max(1, ex || 1), row: r, col: c });
          } else if (tp === 9) {
            cell.piece = makeGemPiece(0, 0, { kind: 'cloud', hp: 1, row: r, col: c });
          } else if (tp === 13) {
            cell.piece = makeGemPiece(0, 0, { kind: 'hadesSkull', hp: 1, row: r, col: c });
          } else if (g >= 8 && g <= 10) {
            cell.piece = makeGemPiece(g, 0, { kind: 'treasure', row: r, col: c });
          } else if (tp === 2 || pw > 0) {
            const colr = (pw === PWR_BOMB) ? 0 : (g > 0 ? g : this.pickSafeColor(r, c));
            cell.piece = makeGemPiece(colr, pw, { kind: 'gem', row: r, col: c });
          } else if (g >= 1 && g <= 6) {
            cell.piece = makeGemPiece(g, 0, { kind: 'gem', chained: tp === 3, row: r, col: c });
          } else {
            const colr = this.pickSafeColor(r, c);
            cell.piece = makeGemPiece(colr, 0, { kind: 'gem', row: r, col: c });
          }
        }
      }

      // If no preset matches were specified and board happens to have no valid moves, ensure playable
      if (!this.hasAnyValidMove()) {
        this.reshuffleBoard(false);
      }
    }

    pickSafeColor(r, c) {
      const choices = this.colours.filter(colr => {
        if (c >= 2 && this.colorAt(r, c - 1) === colr && this.colorAt(r, c - 2) === colr) return false;
        if (r >= 2 && this.colorAt(r - 1, c) === colr && this.colorAt(r - 2, c) === colr) return false;
        return true;
      });
      const pool = choices.length ? choices : this.colours;
      return pool[Math.floor(Math.random() * pool.length)];
    }

    colorAt(r, c) {
      if (!this.inBounds(r, c)) return -1;
      const p = this.board[r][c].piece;
      if (!p || p.kind !== 'gem' || p.powerup === PWR_BOMB) return -1;
      return p.color;
    }

    initGoals() {
      const obj = this.level.objective;
      const type1 = obj.type1;
      this.goals = [];
      this.bossWeakColours = [];

      if (this.isBoss) {
        if (Array.isArray(obj.items)) {
          for (const it of obj.items) {
            if (it.filter === 'kElement' && COLOUR_KEY_TO_ID[it.colour]) {
              this.bossWeakColours.push(COLOUR_KEY_TO_ID[it.colour]);
            }
          }
        }
        this.goals.push({
          type: 'boss',
          label: 'Little Hades',
          icon: 'hades_skull',
          target: this.bossMaxHp,
          current: 0
        });
        return;
      }

      if (type1 === 'oCrystal') {
        const count = this.countCrystals();
        this.goals.push({ type: 'crystal', label: 'Crystals', icon: 'obj_crystal', target: count, current: 0 });
      } else if (type1 === 'oLanterns') {
        const count = this.countLanterns();
        this.goals.push({ type: 'lantern', label: 'Lanterns', icon: 'obj_lantern', target: count, current: 0 });
      } else if (type1 === 'oKeys') {
        const count = obj.numKeys || this.countMud();
        this.goals.push({ type: 'keys', label: 'Keys', icon: 'obj_key', target: count, current: 0 });
      } else if (type1 === 'oPointsTimed') {
        this.goals.push({ type: 'points', label: 'Target Score', icon: 'star_big', target: this.pointsTargets[0], current: 0 });
      } else if (type1 === 'oCollectBottom') {
        let onBoard = 0;
        for (let r = 0; r < this.rows; r++)
          for (let c = 0; c < this.cols; c++)
            if (this.board[r][c].piece?.kind === 'treasure') onBoard++;
        let queued = 0;
        for (const eq of this.entityQueue) {
          if (eq.color >= 8 && eq.color <= 10) queued += eq.atOnce;
        }
        const total = Math.max(1, onBoard + queued);
        this.goals.push({ type: 'treasure', label: 'Treasure', icon: 'obj_treasure', target: total, current: 0 });
      }

      // Also inspect objective.items for oCollect or secondary objectives with required > 0
      if (Array.isArray(obj.items)) {
        for (const it of obj.items) {
          if (!it || it.filter === 'kNone') continue;
          const req = it.required || 0;
          if (req <= 0) continue;

          if (it.filter === 'kElement' && COLOUR_KEY_TO_ID[it.colour]) {
            const cid = COLOUR_KEY_TO_ID[it.colour];
            if (cid >= 8 && cid <= 10) {
              if (!this.goals.find(g => g.type === 'treasure_color' && g.color === cid)) {
                const tLabel = TREASURE_TYPE[cid].charAt(0).toUpperCase() + TREASURE_TYPE[cid].slice(1);
                this.goals.push({
                  type: 'treasure_color',
                  color: cid,
                  label: tLabel,
                  icon: 'obj_' + TREASURE_TYPE[cid],
                  target: req,
                  current: 0
                });
              }
            } else {
              const gLabel = GEM_NAMES[cid].charAt(0).toUpperCase() + GEM_NAMES[cid].slice(1);
              this.goals.push({
                type: 'element',
                color: cid,
                label: gLabel,
                icon: 'obj_' + GEM_NAMES[cid],
                target: req,
                current: 0
              });
            }
          } else if (it.filter === 'kItemCrystal') {
            if (!this.goals.find(g => g.type === 'crystal')) {
              const cnt = req || this.countCrystals();
              this.goals.push({ type: 'crystal', label: 'Crystals', icon: 'obj_crystal', target: cnt, current: 0 });
            }
          } else if (it.filter === 'kItemLantern') {
            if (!this.goals.find(g => g.type === 'lantern')) {
              const cnt = req || this.countLanterns();
              this.goals.push({ type: 'lantern', label: 'Lanterns', icon: 'obj_lantern', target: cnt, current: 0 });
            }
          } else if (it.filter === 'kItemKeys') {
            if (!this.goals.find(g => g.type === 'keys')) {
              this.goals.push({ type: 'keys', label: 'Keys', icon: 'obj_key', target: req, current: 0 });
            }
          }
        }
      }

      if (this.goals.length === 0) {
        this.goals.push({ type: 'points', label: 'Score', icon: 'star_big', target: this.pointsTargets[0], current: 0 });
      }
    }

    applyPreGameBoosters() {
      const gemCells = [];
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const p = this.board[r][c].piece;
          if (p && p.kind === 'gem' && p.powerup === PWR_NONE && !p.chained) {
            gemCells.push(this.board[r][c]);
          }
        }
      }
      gemCells.sort(() => Math.random() - 0.5);
      if (this.preBoosts.ebomb && gemCells.length > 0) {
        const cell = gemCells.shift();
        cell.piece.powerup = PWR_BOMB;
        cell.piece.color = 0;
      }
      if (this.preBoosts.wrappedLine && gemCells.length >= 2) {
        const c1 = gemCells.shift();
        c1.piece.powerup = PWR_WRAPPED;
        const c2 = gemCells.shift();
        c2.piece.powerup = Math.random() < 0.5 ? PWR_HORIZ : PWR_VERT;
      }
    }

    countCrystals() {
      let n = 0;
      for (let r = 0; r < this.rows; r++)
        for (let c = 0; c < this.cols; c++)
          if (this.board[r][c].crystal > 0) n++;
      return n;
    }

    countLanterns() {
      let n = 0;
      for (let r = 0; r < this.rows; r++)
        for (let c = 0; c < this.cols; c++)
          if (this.board[r][c].piece?.kind === 'lantern') n++;
      return n;
    }

    countMud() {
      let n = 0;
      for (let r = 0; r < this.rows; r++)
        for (let c = 0; c < this.cols; c++)
          if (this.board[r][c].mud > 0) n++;
      return n;
    }

    inBounds(r, c) {
      return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
    }

    canSwap(r1, c1, r2, c2) {
      if (!this.inBounds(r1, c1) || !this.inBounds(r2, c2)) return false;
      if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return false;
      const a = this.board[r1][c1], b = this.board[r2][c2];
      if (!a.active || !b.active || !a.piece || !b.piece) return false;
      if (a.piece.chained || b.piece.chained) return false;
      const swappable = k => (k === 'gem' || k === 'treasure');
      return swappable(a.piece.kind) && swappable(b.piece.kind);
    }

    isGoalsComplete() {
      if (this.isBoss) return this.bossHp <= 0;
      for (const g of this.goals) {
        if (g.current < g.target) return false;
      }
      return true;
    }

    addScore(pts, r, c, label) {
      const gained = Math.round(pts * (this.isTimed ? this.speedMult : 1));
      this.score += gained;
      if (this.score >= this.pointsTargets[2]) this.stars = 3;
      else if (this.score >= this.pointsTargets[1]) this.stars = 2;
      else if (this.score >= this.pointsTargets[0]) this.stars = 1;
      for (const g of this.goals) {
        if (g.type === 'points') g.current = Math.min(g.target, this.score);
      }
      if (r !== undefined && this.cb.onScorePopup) {
        this.cb.onScorePopup(r, c, '+' + gained, label);
      }
    }

    damageBoss(amount, fromR, fromC) {
      if (!this.isBoss || this.bossHp <= 0) return;
      this.bossHp = Math.max(0, this.bossHp - amount);
      const bg = this.goals.find(g => g.type === 'boss');
      if (bg) bg.current = this.bossMaxHp - this.bossHp;
      this.cb.onBossHit && this.cb.onBossHit(fromR, fromC, amount);
    }

    // Attempt player swap
    async trySwap(r1, c1, r2, c2) {
      if (this.busy || this.ended) return false;
      if (!this.canSwap(r1, c1, r2, c2)) return false;

      this.busy = true;
      this.hintPair = null;
      this.lastInputAt = performance.now();
      this.cloudHitThisTurn = false;

      const a = this.board[r1][c1];
      const b = this.board[r2][c2];

      window.PGAudio.play('swap');
      await this.animateSwap(a, b);

      // Swap logical pieces
      const pa = a.piece;
      const pb = b.piece;
      a.piece = pb;
      b.piece = pa;
      if (a.piece) { a.piece.vx = c1; a.piece.vy = r1; }
      if (b.piece) { b.piece.vx = c2; b.piece.vy = r2; }

      // Check Element Bomb or Special+Special combo
      const isSpecialCombo =
        (pa.powerup === PWR_BOMB || pb.powerup === PWR_BOMB) ||
        (pa.powerup > 0 && pb.powerup > 0);

      if (isSpecialCombo) {
        this.consumeMove();
        await this.resolveSpecialSwap(a, b);
        await this.cascadeLoop();
        await this.postTurnUpdate();
        this.busy = false;
        return true;
      }

      const matches = this.findMatches();
      if (matches.groups.length === 0) {
        // Revert swap
        window.PGAudio.play('swap_rev');
        await this.animateSwap(a, b);
        a.piece = pa;
        b.piece = pb;
        if (a.piece) { a.piece.vx = c1; a.piece.vy = r1; }
        if (b.piece) { b.piece.vx = c2; b.piece.vy = r2; }
        this.busy = false;
        return false;
      }

      this.consumeMove();
      this.comboCount = 0;

      // Update timed speed multiplier
      const now = performance.now();
      if (this.isTimed) {
        if (now - this.lastMatchTime < 3000) {
          this.speedMult = Math.min(5, this.speedMult + 1);
        } else {
          this.speedMult = 1;
        }
        this.lastMatchTime = now;
      }

      await this.resolveMatches(matches, [{ r: r1, c: c1 }, { r: r2, c: c2 }]);
      await this.cascadeLoop();
      await this.postTurnUpdate();
      this.busy = false;
      return true;
    }

    consumeMove() {
      if (!this.isTimed) {
        this.movesLeft = Math.max(0, this.movesLeft - 1);
      }
      this.movesTaken++;
      this.cb.onHudUpdate && this.cb.onHudUpdate();
    }

    async animateSwap(cellA, cellB) {
      const pa = cellA.piece, pb = cellB.piece;
      const dur = 160;
      const t0 = performance.now();
      const ax0 = cellA.c, ay0 = cellA.r, bx0 = cellB.c, by0 = cellB.r;
      await new Promise(resolve => {
        const step = () => {
          const t = Math.min(1, (performance.now() - t0) / dur);
          const e = 1 - Math.pow(1 - t, 3);
          if (pa) { pa.vx = ax0 + (bx0 - ax0) * e; pa.vy = ay0 + (by0 - ay0) * e; }
          if (pb) { pb.vx = bx0 + (ax0 - bx0) * e; pb.vy = by0 + (ay0 - by0) * e; }
          if (t < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
    }

    findMatches() {
      const { rows, cols } = this;
      const hRuns = [];
      const vRuns = [];

      // Horizontal runs
      for (let r = 0; r < rows; r++) {
        let c = 0;
        while (c < cols) {
          const colr = this.colorAt(r, c);
          if (colr <= 0) { c++; continue; }
          let end = c + 1;
          while (end < cols && this.colorAt(r, end) === colr) end++;
          if (end - c >= 3) {
            const cells = [];
            for (let k = c; k < end; k++) cells.push({ r, c: k });
            hRuns.push({ dir: 'h', color: colr, cells });
          }
          c = end;
        }
      }

      // Vertical runs
      for (let c = 0; c < cols; c++) {
        let r = 0;
        while (r < rows) {
          const colr = this.colorAt(r, c);
          if (colr <= 0) { r++; continue; }
          let end = r + 1;
          while (end < rows && this.colorAt(end, c) === colr) end++;
          if (end - r >= 3) {
            const cells = [];
            for (let k = r; k < end; k++) cells.push({ r: k, c });
            vRuns.push({ dir: 'v', color: colr, cells });
          }
          r = end;
        }
      }

      // Merge intersecting same-color runs into connected match groups
      const allRuns = [...hRuns, ...vRuns];
      const used = new Array(allRuns.length).fill(false);
      const groups = [];

      for (let i = 0; i < allRuns.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        const groupRuns = [allRuns[i]];
        const cellMap = new Map();
        for (const pt of allRuns[i].cells) cellMap.set(pt.r + ',' + pt.c, pt);

        let changed = true;
        while (changed) {
          changed = false;
          for (let j = 0; j < allRuns.length; j++) {
            if (used[j] || allRuns[j].color !== allRuns[i].color) continue;
            if (allRuns[j].cells.some(pt => cellMap.has(pt.r + ',' + pt.c))) {
              used[j] = true;
              groupRuns.push(allRuns[j]);
              for (const pt of allRuns[j].cells) cellMap.set(pt.r + ',' + pt.c, pt);
              changed = true;
            }
          }
        }

        // Classify special creation: Bomb(5+), X-Blast(T/+), Wrapped(L), Line(4)
        let spawnPowerup = PWR_NONE;
        let spawnAt = null;
        const maxLen = Math.max(...groupRuns.map(r => r.cells.length));
        const hasH = groupRuns.some(r => r.dir === 'h');
        const hasV = groupRuns.some(r => r.dir === 'v');

        if (maxLen >= 5) {
          spawnPowerup = PWR_BOMB;
        } else if (hasH && hasV) {
          // Check intersection point to distinguish T/+ (X-Blast) vs L (Wrapped)
          const hRun = groupRuns.find(r => r.dir === 'h');
          const vRun = groupRuns.find(r => r.dir === 'v');
          let inter = null;
          for (const hp of hRun.cells) {
            if (vRun.cells.some(vp => vp.r === hp.r && vp.c === hp.c)) {
              inter = hp;
              break;
            }
          }
          if (inter) {
            spawnAt = inter;
            const hEnd = (inter.c === hRun.cells[0].c || inter.c === hRun.cells[hRun.cells.length - 1].c);
            const vEnd = (inter.r === vRun.cells[0].r || inter.r === vRun.cells[vRun.cells.length - 1].r);
            // Both endpoints = L-shape -> Wrapped; interior on at least one = T/+ -> X-Blast
            spawnPowerup = (hEnd && vEnd) ? PWR_WRAPPED : PWR_X;
          } else {
            spawnPowerup = PWR_WRAPPED;
          }
        } else if (maxLen === 4) {
          const run = groupRuns[0];
          // Perpendicular to match direction
          spawnPowerup = (run.dir === 'h') ? PWR_VERT : PWR_HORIZ;
        }

        groups.push({
          color: allRuns[i].color,
          cells: Array.from(cellMap.values()),
          spawnPowerup,
          spawnAt
        });
      }

      return { groups };
    }

    async resolveMatches(matches, preferredSpawnCells = []) {
      this.comboCount++;
      window.PGAudio.playMatch(this.comboCount);

      const clearedSet = new Set();
      const hitAdjacentSet = new Set();
      const blastsToTrigger = [];
      const spawns = [];

      for (const grp of matches.groups) {
        let spawnCell = null;
        if (grp.spawnPowerup !== PWR_NONE) {
          // Prefer moved cell, else intersection, else middle
          for (const pref of preferredSpawnCells) {
            if (grp.cells.some(pt => pt.r === pref.r && pt.c === pref.c)) {
              spawnCell = pref;
              break;
            }
          }
          if (!spawnCell) spawnCell = grp.spawnAt || grp.cells[Math.floor(grp.cells.length / 2)];
          spawns.push({ r: spawnCell.r, c: spawnCell.c, color: grp.color, powerup: grp.spawnPowerup });
        }

        const basePts = grp.cells.length * 60 + Math.max(0, this.comboCount - 1) * 40;
        const mid = grp.cells[Math.floor(grp.cells.length / 2)];
        const label = this.comboCount >= 4 ? 'HEAVENLY!' : (this.comboCount >= 2 ? `COMBO x${this.comboCount}` : null);
        this.addScore(basePts, mid.r, mid.c, label);

        for (const pt of grp.cells) {
          clearedSet.add(pt.r + ',' + pt.c);
          // Adjacent blockers take 1 hit per match wave
          const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
          for (const [dr, dc] of dirs) {
            const nr = pt.r + dr, nc = pt.c + dc;
            if (this.inBounds(nr, nc)) hitAdjacentSet.add(nr + ',' + nc);
          }
        }
      }

      // Collect cleared cells & trigger any existing powerups inside the match
      const spawnMap = new Map(spawns.map(s => [s.r + ',' + s.c, s]));
      for (const key of clearedSet) {
        const [r, c] = key.split(',').map(Number);
        const cell = this.board[r][c];
        const p = cell.piece;
        if (!p) continue;

        if (p.chained) {
          // Matching a chained gem breaks its chain instead of deleting the gem!
          p.chained = false;
          window.PGAudio.play('chain');
          this.cb.onBurst && this.cb.onBurst(r, c, '#d8c5ff');
          continue;
        }

        if (p.powerup !== PWR_NONE) {
          blastsToTrigger.push({ r, c, powerup: p.powerup, color: p.color });
        }

        // If this cell is where a new powerup spawns, replace instead of clearing
        if (spawnMap.has(key)) {
          const sp = spawnMap.get(key);
          this.collectGemEffects(r, c, p, false);
          cell.piece = makeGemPiece(sp.powerup === PWR_BOMB ? 0 : sp.color, sp.powerup, { row: r, col: c, scale: 1.25 });
          this.playPowerupFormSfx(sp.powerup);
          this.cb.onBurst && this.cb.onBurst(r, c, this.gemHex(sp.color));
        } else {
          this.destroyCellContent(r, c, false);
        }
      }

      // Apply adjacent hits to Lanterns, Tablets, Clouds, Hades Skulls
      for (const key of hitAdjacentSet) {
        if (clearedSet.has(key)) continue;
        const [r, c] = key.split(',').map(Number);
        this.hitBlocker(r, c);
      }

      // Trigger chained powerups
      if (blastsToTrigger.length > 0) {
        await this.sleep(110);
        for (const b of blastsToTrigger) {
          await this.detonatePowerup(b.r, b.c, b.powerup, b.color);
        }
      } else {
        await this.sleep(150);
      }
    }

    playPowerupFormSfx(pw) {
      if (pw === PWR_BOMB) window.PGAudio.play('bomb_form');
      else if (pw === PWR_WRAPPED) window.PGAudio.play('wrap_form');
      else if (pw === PWR_X) window.PGAudio.play('x_form');
      else window.PGAudio.play('line_form');
    }

    collectGemEffects(r, c, p, fromBlast) {
      if (p.kind === 'gem') {
        if (p.timeBonus > 0 && this.isTimed) {
          this.timeLeft += p.timeBonus;
          this.cb.onScorePopup && this.cb.onScorePopup(r, c, '+' + p.timeBonus + 's', 'BONUS TIME');
        }
        // Increment element collection goals
        for (const g of this.goals) {
          if (g.type === 'element' && g.color === p.color) {
            const was = g.current;
            g.current = Math.min(g.target, g.current + 1);
            if (was < g.target) this.cb.onCollectFly && this.cb.onCollectFly(r, c, p.color);
          }
        }
        // Damage Boss if color is weak or from special blast
        if (this.isBoss) {
          if (this.bossWeakColours.length === 0 || this.bossWeakColours.includes(p.color)) {
            this.damageBoss(1, r, c);
          }
        }
      }
      // Crystal & Mud under the cell get damaged!
      const cell = this.board[r][c];
      if (cell.crystal > 0) {
        cell.crystal--;
        window.PGAudio.play('crystal');
        this.cb.onBurst && this.cb.onBurst(r, c, '#b7f4ff');
        if (cell.crystal === 0) {
          for (const g of this.goals) {
            if (g.type === 'crystal') g.current = Math.min(g.target, g.current + 1);
          }
          if (this.isBoss) this.damageBoss(2, r, c);
        }
      }
      if (cell.mud > 0) {
        cell.mud = 0;
        window.PGAudio.play('mud');
        this.cb.onBurst && this.cb.onBurst(r, c, '#8a5a3c');
        if (cell.hiddenKey && !cell.keyCollected) {
          cell.keyCollected = true;
          window.PGAudio.play('key');
          this.cb.onKeyFound && this.cb.onKeyFound(r, c);
          for (const g of this.goals) {
            if (g.type === 'keys') g.current = Math.min(g.target, g.current + 1);
          }
        }
      }
      this.clearsSinceLastSpawn++;
    }

    destroyCellContent(r, c, fromBlast) {
      if (!this.inBounds(r, c)) return null;
      const cell = this.board[r][c];
      if (!cell.active) return null;

      const p = cell.piece;
      if (!p) {
        // Still damage empty crystal/mud if hit by blast
        if (fromBlast) {
          if (cell.crystal > 0) {
            cell.crystal--;
            window.PGAudio.play('crystal');
            if (cell.crystal === 0) {
              for (const g of this.goals) if (g.type === 'crystal') g.current = Math.min(g.target, g.current + 1);
            }
          }
          if (cell.mud > 0) {
            cell.mud = 0;
            window.PGAudio.play('mud');
            if (cell.hiddenKey && !cell.keyCollected) {
              cell.keyCollected = true;
              window.PGAudio.play('key');
              this.cb.onKeyFound && this.cb.onKeyFound(r, c);
              for (const g of this.goals) if (g.type === 'keys') g.current = Math.min(g.target, g.current + 1);
            }
          }
        }
        return null;
      }

      if (p.kind === 'treasure') return null; // Treasures are never destroyed — they drop to chests!

      if (p.kind === 'lantern' || p.kind === 'tablet' || p.kind === 'cloud' || p.kind === 'hadesSkull') {
        if (fromBlast) this.hitBlocker(r, c);
        return null;
      }

      if (p.chained && fromBlast) {
        p.chained = false;
        window.PGAudio.play('chain');
        this.cb.onBurst && this.cb.onBurst(r, c, '#d8c5ff');
        return null;
      }

      cell.piece = null;
      this.collectGemEffects(r, c, p, fromBlast);
      this.cb.onBurst && this.cb.onBurst(r, c, this.gemHex(p.color));
      return p;
    }

    hitBlocker(r, c) {
      const cell = this.board[r][c];
      const p = cell.piece;
      if (!p) return;

      if (p.kind === 'lantern') {
        if (p.hp < 3) {
          p.hp++;
          window.PGAudio.play(p.hp === 3 ? 'lantern_done' : 'lantern_hit');
          this.cb.onBurst && this.cb.onBurst(r, c, '#ffb830');
          if (p.hp === 3) {
            this.addScore(300, r, c, 'LIT!');
            for (const g of this.goals) {
              if (g.type === 'lantern') g.current = Math.min(g.target, g.current + 1);
            }
            if (this.isBoss) this.damageBoss(4, r, c);
          }
        }
      } else if (p.kind === 'tablet') {
        p.hp--;
        window.PGAudio.play('tablet');
        this.cb.onBurst && this.cb.onBurst(r, c, '#a7a2b8');
        if (p.hp <= 0) {
          cell.piece = null;
          this.addScore(150, r, c);
        }
      } else if (p.kind === 'cloud') {
        this.cloudHitThisTurn = true;
        cell.piece = null;
        window.PGAudio.play('cloud');
        this.cb.onBurst && this.cb.onBurst(r, c, '#ffffff');
        this.addScore(120, r, c);
      } else if (p.kind === 'hadesSkull') {
        cell.piece = null;
        window.PGAudio.play('tablet');
        this.cb.onBurst && this.cb.onBurst(r, c, '#72ff62');
        this.addScore(150, r, c);
      }
    }

    async detonatePowerup(r, c, powerup, color, visitedSet) {
      const visited = visitedSet || new Set();
      const key = r + ',' + c;
      if (visited.has(key)) return;
      visited.add(key);

      const targets = [];

      if (powerup === PWR_HORIZ) {
        window.PGAudio.play('line_det');
        this.cb.onBeam && this.cb.onBeam('h', r, c, this.gemHex(color));
        for (let cc = 0; cc < this.cols; cc++) targets.push({ r, c: cc });
      } else if (powerup === PWR_VERT) {
        window.PGAudio.play('line_det');
        this.cb.onBeam && this.cb.onBeam('v', r, c, this.gemHex(color));
        for (let rr = 0; rr < this.rows; rr++) targets.push({ r: rr, c });
      } else if (powerup === PWR_X) {
        window.PGAudio.play('x_det');
        this.cb.onBeam && this.cb.onBeam('x', r, c, this.gemHex(color));
        for (let d = -8; d <= 8; d++) {
          if (this.inBounds(r + d, c + d)) targets.push({ r: r + d, c: c + d });
          if (d !== 0 && this.inBounds(r + d, c - d)) targets.push({ r: r + d, c: c - d });
        }
      } else if (powerup === PWR_WRAPPED) {
        window.PGAudio.play('wrap_det');
        this.cb.onShockwave && this.cb.onShockwave(r, c, 1.5, this.gemHex(color));
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (this.inBounds(r + dr, c + dc)) targets.push({ r: r + dr, c: c + dc });
          }
        }
        // Schedule second 3x3 blast at same coordinates after gravity!
        this.pendingSecondWrapped = this.pendingSecondWrapped || [];
        this.pendingSecondWrapped.push({ r, c, color });
      } else if (powerup === PWR_BOMB) {
        window.PGAudio.play('bomb_det');
        const targetCol = color > 0 ? color : this.colours[Math.floor(Math.random() * this.colours.length)];
        for (let rr = 0; rr < this.rows; rr++) {
          for (let cc = 0; cc < this.cols; cc++) {
            if (this.colorAt(rr, cc) === targetCol) {
              targets.push({ r: rr, c: cc });
              this.cb.onLightning && this.cb.onLightning(r, c, rr, cc, this.gemHex(targetCol));
            }
          }
        }
      }

      await this.blastCells(targets, visited);
    }

    async blastCells(targets, visited) {
      const chain = [];
      let pts = 0;
      for (const pt of targets) {
        if (!this.inBounds(pt.r, pt.c)) continue;
        const cell = this.board[pt.r][pt.c];
        if (!cell.active) continue;
        const p = cell.piece;
        if (p && p.kind === 'gem' && p.powerup > 0 && !visited.has(pt.r + ',' + pt.c)) {
          chain.push({ r: pt.r, c: pt.c, powerup: p.powerup, color: p.color });
        }
        const removed = this.destroyCellContent(pt.r, pt.c, true);
        if (removed) pts += 80;
      }
      if (pts > 0 && targets[0]) this.addScore(pts, targets[0].r, targets[0].c);

      for (const ch of chain) {
        await this.sleep(60);
        await this.detonatePowerup(ch.r, ch.c, ch.powerup, ch.color, visited);
      }
    }

    async resolveSpecialSwap(cellA, cellB) {
      const pa = cellA.piece, pb = cellB.piece;
      const r = cellB.r, c = cellB.c;
      const visited = new Set([cellA.r + ',' + cellA.c, cellB.r + ',' + cellB.c]);

      // Element Bomb + Element Bomb = SUPERNOVA (clears whole board!)
      if (pa.powerup === PWR_BOMB && pb.powerup === PWR_BOMB) {
        window.PGAudio.play('supernova');
        this.cb.onShockwave && this.cb.onShockwave(r, c, 4.5, '#ffffff');
        this.collectGemEffects(cellA.r, cellA.c, pa, true);
        this.collectGemEffects(cellB.r, cellB.c, pb, true);
        cellA.piece = null;
        cellB.piece = null;
        const all = [];
        for (let rr = 0; rr < this.rows; rr++)
          for (let cc = 0; cc < this.cols; cc++)
            all.push({ r: rr, c: cc });
        this.addScore(2500, r, c, 'SUPERNOVA!');
        await this.blastCells(all, visited);
        return;
      }

      // Element Bomb + Normal or Special Gem
      if (pa.powerup === PWR_BOMB || pb.powerup === PWR_BOMB) {
        const bombCell = pa.powerup === PWR_BOMB ? cellA : cellB;
        const otherCell = pa.powerup === PWR_BOMB ? cellB : cellA;
        const otherPiece = otherCell.piece;
        const targetColor = otherPiece.color || this.colours[0];
        const transformPwr = otherPiece.powerup;

        this.collectGemEffects(bombCell.r, bombCell.c, bombCell.piece, true);
        if (transformPwr === 0) this.collectGemEffects(otherCell.r, otherCell.c, otherPiece, true);
        bombCell.piece = null;
        otherCell.piece = null;
        window.PGAudio.play('bomb_det');
        this.addScore(800, bombCell.r, bombCell.c, 'ELEMENT BOMB!');

        const matches = [];
        for (let rr = 0; rr < this.rows; rr++) {
          for (let cc = 0; cc < this.cols; cc++) {
            if (this.colorAt(rr, cc) === targetColor) {
              matches.push({ r: rr, c: cc });
              this.cb.onLightning && this.cb.onLightning(bombCell.r, bombCell.c, rr, cc, this.gemHex(targetColor));
            }
          }
        }
        await this.sleep(200);

        if (transformPwr > 0) {
          const created = [];
          for (const pt of matches) {
            const cell = this.board[pt.r][pt.c];
            if (cell.piece) {
              const pwr = (transformPwr === PWR_HORIZ || transformPwr === PWR_VERT)
                ? (Math.random() < 0.5 ? PWR_HORIZ : PWR_VERT)
                : transformPwr;
              cell.piece.powerup = pwr;
              created.push({ r: pt.r, c: pt.c, powerup: pwr, color: targetColor });
            }
          }
          await this.sleep(160);
          for (const cr of created) {
            await this.detonatePowerup(cr.r, cr.c, cr.powerup, cr.color, visited);
            await this.sleep(70);
          }
        } else {
          await this.blastCells(matches, visited);
        }
        return;
      }

      // Two Specials combined!
      window.PGAudio.play('double_det');
      this.collectGemEffects(cellA.r, cellA.c, pa, true);
      this.collectGemEffects(cellB.r, cellB.c, pb, true);
      cellA.piece = null;
      cellB.piece = null;
      const p1 = pa.powerup, p2 = pb.powerup;
      const isLine = p => (p === PWR_HORIZ || p === PWR_VERT);
      const targets = [];

      if (isLine(p1) && isLine(p2)) {
        // Cross Blast!
        this.cb.onBeam && this.cb.onBeam('h', r, c, '#ffd84d');
        this.cb.onBeam && this.cb.onBeam('v', r, c, '#ffd84d');
        for (let cc = 0; cc < this.cols; cc++) targets.push({ r, c: cc });
        for (let rr = 0; rr < this.rows; rr++) targets.push({ r: rr, c });
        this.addScore(600, r, c, 'CROSS BLAST!');
      } else if ((isLine(p1) && p2 === PWR_WRAPPED) || (isLine(p2) && p1 === PWR_WRAPPED)) {
        // Giant 3-row + 3-col Cross!
        for (let d = -1; d <= 1; d++) {
          if (this.inBounds(r + d, 0)) {
            this.cb.onBeam && this.cb.onBeam('h', r + d, c, '#ff9f43');
            for (let cc = 0; cc < this.cols; cc++) targets.push({ r: r + d, c: cc });
          }
          if (this.inBounds(0, c + d)) {
            this.cb.onBeam && this.cb.onBeam('v', r, c + d, '#ff9f43');
            for (let rr = 0; rr < this.rows; rr++) targets.push({ r: rr, c: c + d });
          }
        }
        this.addScore(1000, r, c, 'MEGA CROSS!');
      } else if (p1 === PWR_WRAPPED && p2 === PWR_WRAPPED) {
        // Giant 5x5 Blast!
        this.cb.onShockwave && this.cb.onShockwave(r, c, 2.7, '#ff6bff');
        for (let dr = -2; dr <= 2; dr++)
          for (let dc = -2; dc <= 2; dc++)
            if (this.inBounds(r + dr, c + dc)) targets.push({ r: r + dr, c: c + dc });
        this.addScore(1000, r, c, 'MEGA RING!');
      } else if (p1 === PWR_X || p2 === PWR_X) {
        // X + (Line | Wrapped | X) -> 8-way Star + Diagonals!
        this.cb.onBeam && this.cb.onBeam('x', r, c, '#ff4fd8');
        this.cb.onBeam && this.cb.onBeam('h', r, c, '#4ff0ff');
        this.cb.onBeam && this.cb.onBeam('v', r, c, '#4ff0ff');
        for (let d = -8; d <= 8; d++) {
          if (this.inBounds(r + d, c + d)) targets.push({ r: r + d, c: c + d });
          if (this.inBounds(r + d, c - d)) targets.push({ r: r + d, c: c - d });
          if (this.inBounds(r, c + d)) targets.push({ r, c: c + d });
          if (this.inBounds(r + d, c)) targets.push({ r: r + d, c });
        }
        if (p1 === PWR_WRAPPED || p2 === PWR_WRAPPED) {
          for (let dr = -1; dr <= 1; dr++)
            for (let dc = -1; dc <= 1; dc++)
              if (this.inBounds(r + dr, c + dc)) targets.push({ r: r + dr, c: c + dc });
        }
        this.addScore(1100, r, c, 'STAR BLAST!');
      }

      await this.blastCells(targets, visited);
    }

    async cascadeLoop() {
      let safety = 0;
      while (safety++ < 40) {
        await this.applyGravityAndRefill();
        await this.collectBottomTreasures();

        // Check if any pending Wrapped second-pulse explosions exist
        if (this.pendingSecondWrapped && this.pendingSecondWrapped.length > 0) {
          const list = this.pendingSecondWrapped.splice(0);
          for (const w of list) {
            window.PGAudio.play('wrap_det');
            this.cb.onShockwave && this.cb.onShockwave(w.r, w.c, 1.5, this.gemHex(w.color));
            const area = [];
            for (let dr = -1; dr <= 1; dr++)
              for (let dc = -1; dc <= 1; dc++)
                if (this.inBounds(w.r + dr, w.c + dc)) area.push({ r: w.r + dr, c: w.c + dc });
            await this.blastCells(area, new Set());
          }
          continue;
        }

        const matches = this.findMatches();
        if (matches.groups.length === 0) break;
        await this.resolveMatches(matches, []);
      }
    }

    async applyGravityAndRefill() {
      const { rows, cols } = this;
      let moved = true;
      let anyMoved = false;

      // Iteratively pull gems down straight, through portals, diagonally around static holes, and refill from top
      let iter = 0;
      while (moved && iter++ < 25) {
        moved = false;

        // 1. Portals: if start cell has a movable piece and end cell is empty, teleport it
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const cell = this.board[r][c];
            if (cell.portalOut && cell.piece && (cell.piece.kind === 'gem' || cell.piece.kind === 'treasure') && !cell.piece.chained) {
              const dst = this.board[cell.portalOut.r][cell.portalOut.c];
              if (dst.active && !dst.piece) {
                dst.piece = cell.piece;
                cell.piece = null;
                dst.piece.vx = dst.c;
                dst.piece.vy = dst.r - 1;
                moved = true;
                anyMoved = true;
              }
            }
          }
        }

        // 2. Straight vertical fall (bottom to top), jumping across fall-through holes (gridVal === 2 or 3)
        for (let c = 0; c < cols; c++) {
          for (let r = rows - 1; r >= 0; r--) {
            const cell = this.board[r][c];
            if (!cell.active || cell.piece) continue;

            // Search upwards for a movable piece
            let srcR = -1;
            for (let up = r - 1; up >= 0; up--) {
              const upCell = this.board[up][c];
              if (!upCell.active) {
                // Can pass through gridVal 2 or 3, blocked by gridVal 1
                if (upCell.gridVal === 1) break;
                continue;
              }
              if (upCell.piece) {
                const k = upCell.piece.kind;
                if ((k === 'gem' || k === 'treasure') && !upCell.piece.chained) {
                  srcR = up;
                }
                break; // Blocked by blocker/chained gem or found movable
              }
            }

            if (srcR >= 0) {
              cell.piece = this.board[srcR][c].piece;
              this.board[srcR][c].piece = null;
              moved = true;
              anyMoved = true;
            }
          }
        }

        // 3. Diagonal slide if blocked directly above by wall or stationary blocker
        for (let r = rows - 1; r >= 1; r--) {
          for (let c = 0; c < cols; c++) {
            const cell = this.board[r][c];
            if (!cell.active || cell.piece) continue;

            // Only slide diagonally if directly above is blocked or another empty cell waiting on diagonal
            const diagCols = Math.random() < 0.5 ? [c - 1, c + 1] : [c + 1, c - 1];
            for (const dc of diagCols) {
              if (!this.inBounds(r - 1, dc)) continue;
              const src = this.board[r - 1][dc];
              if (src.active && src.piece && (src.piece.kind === 'gem' || src.piece.kind === 'treasure') && !src.piece.chained) {
                cell.piece = src.piece;
                src.piece = null;
                moved = true;
                anyMoved = true;
                break;
              }
            }
          }
        }

        // 4. Spawn new gems at top playable cells of each column (where nothing active & unblocked sits above)
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            const cell = this.board[r][c];
            if (!cell.active || cell.piece) continue;

            // Check if this cell is an open spawner (nothing active or blocked above it in column, OR right below a grid=1 roof with no playable diagonal feeder)
            let hasActiveAbove = false;
            let hitWallAbove = false;
            for (let up = r - 1; up >= 0; up--) {
              const u = this.board[up][c];
              if (!u.active) {
                if (u.gridVal === 1) hitWallAbove = true;
              } else {
                hasActiveAbove = true;
                break;
              }
            }

            if (!hasActiveAbove && !hitWallAbove) {
              cell.piece = this.spawnPieceForColumn(c, r);
              moved = true;
              anyMoved = true;
            }
          }
        }
      }

      // Final safety pass: if any playable cell under a grid=1 shelf still has no piece (no diagonal source), spawn directly
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = this.board[r][c];
          if (cell.active && !cell.piece) {
            cell.piece = this.spawnPieceForColumn(c, r);
            anyMoved = true;
          }
        }
      }

      if (anyMoved) {
        // Animate all pieces to their new (c, r)
        const dur = 210;
        const t0 = performance.now();
        const starts = [];
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const p = this.board[r][c].piece;
            if (p && (Math.abs(p.vx - c) > 0.01 || Math.abs(p.vy - r) > 0.01)) {
              starts.push({ p, sx: p.vx, sy: p.vy, ex: c, ey: r });
            }
          }
        }
        if (starts.length > 0) {
          await new Promise(resolve => {
            const step = () => {
              const t = Math.min(1, (performance.now() - t0) / dur);
              const e = 1 - Math.pow(1 - t, 2.2);
              for (const s of starts) {
                s.p.vx = s.sx + (s.ex - s.sx) * e;
                s.p.vy = s.sy + (s.ey - s.sy) * e;
              }
              if (t < 1) requestAnimationFrame(step);
              else resolve();
            };
            requestAnimationFrame(step);
          });
        }
      }
    }

    spawnPieceForColumn(c, targetR) {
      // Check entity_queue (treasures / +5s clocks)
      for (const eq of this.entityQueue) {
        if (!eq.spawned && this.clearsSinceLastSpawn >= eq.spawnBefore) {
          // Don't spawn too many at once
          eq.spawned = true;
          if (eq.color >= 8 && eq.color <= 10) {
            return makeGemPiece(eq.color, 0, { kind: 'treasure', row: -1, col: c });
          } else if (eq.timeBonus > 0) {
            const colr = (eq.color >= 1 && eq.color <= 6) ? eq.color : this.colours[Math.floor(Math.random() * this.colours.length)];
            return makeGemPiece(colr, 0, { kind: 'gem', timeBonus: eq.timeBonus, row: -1, col: c });
          }
        }
      }

      // Check tutorial queue
      if (this.tutQueues[c] && this.tutQueues[c].length > 0) {
        const tc = this.tutQueues[c].shift();
        return makeGemPiece(tc, 0, { kind: 'gem', row: -1, col: c });
      }

      const colr = this.colours[Math.floor(Math.random() * this.colours.length)];
      return makeGemPiece(colr, 0, { kind: 'gem', row: -1, col: c });
    }

    async collectBottomTreasures() {
      let collectedAny = false;
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const cell = this.board[r][c];
          if (!cell.piece || cell.piece.kind !== 'treasure') continue;

          // Collect if on a chest cell OR bottom-most playable cell in column when chests exist or oCollectBottom
          let isDrop = cell.hasChest;
          if (!isDrop && this.level.objective.type1 === 'oCollectBottom') {
            let lowestActive = -1;
            for (let rr = this.rows - 1; rr >= 0; rr--) {
              if (this.board[rr][c].active) { lowestActive = rr; break; }
            }
            if (r === lowestActive && (!this.level.chests || this.level.chests.length === 0)) {
              isDrop = true;
            }
          }

          if (isDrop) {
            const colr = cell.piece.color;
            cell.piece = null;
            collectedAny = true;
            window.PGAudio.play('treasure');
            this.addScore(1000, r, c, 'TREASURE!');
            this.cb.onBurst && this.cb.onBurst(r, c, '#ffd84d');
            for (const g of this.goals) {
              if (g.type === 'treasure' || (g.type === 'treasure_color' && g.color === colr)) {
                g.current = Math.min(g.target, g.current + 1);
              }
            }
          }
        }
      }
      if (collectedAny) {
        await this.sleep(160);
        await this.applyGravityAndRefill();
      }
    }

    async postTurnUpdate() {
      // Cloud expansion if any cloud exists and none was hit this turn
      if (!this.cloudHitThisTurn) {
        const candidates = [];
        for (let r = 0; r < this.rows; r++) {
          for (let c = 0; c < this.cols; c++) {
            if (this.board[r][c].piece?.kind === 'cloud') {
              for (const [dr, dc] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                const nr = r + dr, nc = c + dc;
                if (this.inBounds(nr, nc) && this.board[nr][nc].active && this.board[nr][nc].piece?.kind === 'gem') {
                  candidates.push({ r: nr, c: nc });
                }
              }
            }
          }
        }
        if (candidates.length > 0) {
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          this.board[pick.r][pick.c].piece = makeGemPiece(0, 0, { kind: 'cloud', hp: 1, row: pick.r, col: pick.c });
          window.PGAudio.play('cloud');
        }
      }

      // Hades Boss Blocker spawn
      if (this.isBoss && this.bossHp > 0 && this.hadesConfig) {
        this.hadesMoveCounter++;
        const interval = this.hadesConfig.spawnInterval || 5;
        if (this.hadesMoveCounter >= interval) {
          this.hadesMoveCounter = 0;
          const positions = (this.hadesConfig.spawnBlockerPosition || []).slice().sort(() => Math.random() - 0.5);
          const amt = this.hadesConfig.spawnAmmount || 2;
          const enabled = this.hadesConfig.enabledBlockers || [{ type: 'kTypeHadesSkull' }];
          let spawned = 0;
          for (const pos of positions) {
            if (spawned >= amt) break;
            const r = this.rows - 1 - pos.y;
            const c = pos.x;
            if (!this.inBounds(r, c) || !this.board[r][c].active) continue;
            const p = this.board[r][c].piece;
            if (!p || p.kind !== 'gem' || p.powerup > 0) continue;

            const chosen = enabled[Math.floor(Math.random() * enabled.length)];
            if (chosen.type === 'kTypeChains') {
              p.chained = true;
            } else if (chosen.type === 'kTypeTablet') {
              this.board[r][c].piece = makeGemPiece(0, 0, { kind: 'tablet', hp: chosen.extra || 1, row: r, col: c });
            } else {
              this.board[r][c].piece = makeGemPiece(0, 0, { kind: 'hadesSkull', hp: 1, row: r, col: c });
            }
            window.PGAudio.play('hades_block');
            this.cb.onBurst && this.cb.onBurst(r, c, '#72ff62');
            spawned++;
          }
        }
      }

      this.cb.onHudUpdate && this.cb.onHudUpdate();

      // Check win / lose
      if (this.isGoalsComplete()) {
        await this.handleWin();
        return;
      }

      if (!this.isTimed && this.movesLeft <= 0) {
        this.ended = true;
        window.PGAudio.play('lose');
        this.cb.onOutOfMoves && this.cb.onOutOfMoves();
        return;
      }

      // Check deadlock
      if (!this.hasAnyValidMove()) {
        this.cb.onReshuffle && this.cb.onReshuffle();
        window.PGAudio.play('reshuffle');
        await this.sleep(450);
        this.reshuffleBoard(true);
      }
    }

    async handleWin() {
      if (this.ended) return;
      this.ended = true;

      // Last Hurrah bonus! Convert remaining moves into line blasts!
      if (!this.isTimed && this.movesLeft > 0) {
        const bonusMoves = Math.min(this.movesLeft, 8);
        const candidates = [];
        for (let r = 0; r < this.rows; r++)
          for (let c = 0; c < this.cols; c++)
            if (this.board[r][c].piece?.kind === 'gem' && this.board[r][c].piece.powerup === 0)
              candidates.push(this.board[r][c]);
        candidates.sort(() => Math.random() - 0.5);

        const toDetonate = [];
        for (let i = 0; i < Math.min(bonusMoves, candidates.length); i++) {
          const cell = candidates[i];
          cell.piece.powerup = Math.random() < 0.5 ? PWR_HORIZ : PWR_VERT;
          toDetonate.push(cell);
        }
        this.movesLeft = 0;
        this.cb.onHudUpdate && this.cb.onHudUpdate();
        await this.sleep(300);

        for (const cell of toDetonate) {
          if (cell.piece) {
            window.PGAudio.play('hurrah');
            await this.detonatePowerup(cell.r, cell.c, cell.piece.powerup, cell.piece.color);
            this.addScore(400, cell.r, cell.c, 'HURRAH!');
            await this.sleep(100);
          }
        }
        await this.applyGravityAndRefill();
      } else if (this.isTimed && this.timeLeft > 0) {
        this.addScore(Math.round(this.timeLeft * 120));
      }

      // Guarantee at least 1 star on objective completion
      if (this.stars < 1) this.stars = 1;
      window.PGAudio.play('win');
      this.cb.onWin && this.cb.onWin(this.score, this.stars);
    }

    // Use in-game God Booster at (r, c)
    async useBooster(boosterType, r, c) {
      if (this.busy || this.ended || !this.inBounds(r, c)) return false;
      const cell = this.board[r][c];
      if (!cell.active) return false;

      this.busy = true;
      this.activeBooster = null;
      this.hintPair = null;

      if (boosterType === 'hammer') {
        window.PGAudio.play('hammer');
        this.cb.onBoosterAnim && this.cb.onBoosterAnim('hammer', r, c);
        await this.sleep(220);
        const p = cell.piece;
        if (p && p.powerup > 0) {
          await this.detonatePowerup(r, c, p.powerup, p.color);
        } else if (p && (p.kind === 'lantern' || p.kind === 'tablet' || p.kind === 'cloud' || p.kind === 'hadesSkull')) {
          this.hitBlocker(r, c);
        } else {
          await this.blastCells([{ r, c }], new Set());
        }
      } else if (boosterType === 'trident') {
        window.PGAudio.play('trident');
        this.cb.onBoosterAnim && this.cb.onBoosterAnim('trident', r, c);
        await this.sleep(180);
        const rowTargets = [];
        for (let cc = 0; cc < this.cols; cc++) rowTargets.push({ r, c: cc });
        await this.blastCells(rowTargets, new Set());
      } else if (boosterType === 'torch') {
        window.PGAudio.play('flame');
        this.cb.onBoosterAnim && this.cb.onBoosterAnim('torch', r, c);
        await this.sleep(180);
        const colTargets = [];
        for (let rr = 0; rr < this.rows; rr++) colTargets.push({ r: rr, c });
        await this.blastCells(colTargets, new Set());
      } else if (boosterType === 'arrow') {
        const targetColor = (cell.piece && cell.piece.color >= 1 && cell.piece.color <= 6)
          ? cell.piece.color
          : this.colours[0];
        window.PGAudio.play('arrow');
        const targets = [];
        for (let rr = 0; rr < this.rows; rr++) {
          for (let cc = 0; cc < this.cols; cc++) {
            if (this.colorAt(rr, cc) === targetColor) {
              targets.push({ r: rr, c: cc });
              this.cb.onLightning && this.cb.onLightning(r, c, rr, cc, '#ff64b4');
            }
          }
        }
        await this.sleep(220);
        await this.blastCells(targets, new Set());
      }

      await this.cascadeLoop();
      await this.postTurnUpdate();
      this.busy = false;
      return true;
    }

    findValidMove() {
      const { rows, cols } = this;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const neighbors = [[r, c + 1], [r + 1, c]];
          for (const [nr, nc] of neighbors) {
            if (!this.canSwap(r, c, nr, nc)) continue;
            const a = this.board[r][c], b = this.board[nr][nc];
            if (a.piece.powerup === PWR_BOMB || b.piece.powerup === PWR_BOMB) {
              return [{ r, c }, { r: nr, c: nc }];
            }
            if (a.piece.powerup > 0 && b.piece.powerup > 0) {
              return [{ r, c }, { r: nr, c: nc }];
            }
            // Test swap
            const tmp = a.piece; a.piece = b.piece; b.piece = tmp;
            const hasM = this.hasLocalMatch(r, c) || this.hasLocalMatch(nr, nc);
            b.piece = a.piece; a.piece = tmp;
            if (hasM) return [{ r, c }, { r: nr, c: nc }];
          }
        }
      }
      return null;
    }

    hasAnyValidMove() {
      return this.findValidMove() !== null;
    }

    hasLocalMatch(r, c) {
      const colr = this.colorAt(r, c);
      if (colr <= 0) return false;
      let h = 1;
      for (let cc = c - 1; cc >= 0 && this.colorAt(r, cc) === colr; cc--) h++;
      for (let cc = c + 1; cc < this.cols && this.colorAt(r, cc) === colr; cc++) h++;
      if (h >= 3) return true;
      let v = 1;
      for (let rr = r - 1; rr >= 0 && this.colorAt(rr, c) === colr; rr--) v++;
      for (let rr = r + 1; rr < this.rows && this.colorAt(rr, c) === colr; rr++) v++;
      return v >= 3;
    }

    reshuffleBoard(keepPowerups) {
      const gems = [];
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const p = this.board[r][c].piece;
          if (p && p.kind === 'gem' && !p.chained && (keepPowerups || p.powerup === 0)) {
            gems.push({ r, c, p });
          }
        }
      }
      for (let attempt = 0; attempt < 25; attempt++) {
        const pool = gems.map(g => g.p).sort(() => Math.random() - 0.5);
        for (let i = 0; i < gems.length; i++) {
          const cell = this.board[gems[i].r][gems[i].c];
          cell.piece = pool[i];
          cell.piece.vx = gems[i].c;
          cell.piece.vy = gems[i].r;
        }
        if (this.findMatches().groups.length === 0 && this.hasAnyValidMove()) return;
      }
      // Guarantee at least one matchable move by forcing a valid pair if needed
      if (!this.hasAnyValidMove() && gems.length >= 4) {
        const c0 = gems[0];
        if (this.inBounds(c0.r, c0.c + 2)) {
          const colr = this.colours[0];
          if (this.board[c0.r][c0.c].piece?.kind === 'gem') this.board[c0.r][c0.c].piece.color = colr;
          if (this.board[c0.r][c0.c + 1].piece?.kind === 'gem') this.board[c0.r][c0.c + 1].piece.color = colr;
          if (this.inBounds(c0.r + 1, c0.c + 2) && this.board[c0.r + 1][c0.c + 2].piece?.kind === 'gem') {
            this.board[c0.r + 1][c0.c + 2].piece.color = colr;
          }
        }
      }
    }

    addExtraMoves(n) {
      this.ended = false;
      if (this.isTimed) this.timeLeft += n;
      else this.movesLeft += n;
      this.cb.onHudUpdate && this.cb.onHudUpdate();
    }

    gemHex(color) {
      return {
        1: '#cf6eff',
        2: '#ffd23f',
        3: '#ff7a29',
        4: '#4ee658',
        5: '#ff528e',
        6: '#32c5ff'
      }[color] || '#ffffff';
    }

    sleep(ms) {
      return new Promise(res => setTimeout(res, ms));
    }
  }

  window.PuzzleEngine = PuzzleEngine;
  window.PG_CONSTANTS = { GEM_NAMES, COLOUR_KEY_TO_ID, TREASURE_TYPE, PWR_NONE, PWR_BOMB, PWR_HORIZ, PWR_VERT, PWR_WRAPPED, PWR_X };
})();
