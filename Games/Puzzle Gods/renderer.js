// Puzzle Gods — Canvas Board Renderer & Visual FX
(function () {
  const SPRITE_FILES = [
    'gem_air','gem_air_h','gem_air_v','gem_air_w','gem_air_x',
    'gem_earth','gem_earth_h','gem_earth_v','gem_earth_w','gem_earth_x',
    'gem_fire','gem_fire_h','gem_fire_v','gem_fire_w','gem_fire_x',
    'gem_life','gem_life_h','gem_life_v','gem_life_w','gem_life_x',
    'gem_passion','gem_passion_h','gem_passion_v','gem_passion_w','gem_passion_x',
    'gem_water','gem_water_h','gem_water_v','gem_water_w','gem_water_x',
    'bomb_air','bomb_earth','bomb_fire','bomb_life','bomb_passion','bomb_water','bomb_grey','bomb_ring',
    'crystal_1','crystal_2','crystal_3',
    'mud_1','mud_rocky','mud_key','mud_key_top','key_v',
    'treasure_gold','treasure_ruby','treasure_diamond',
    'tablet_1','tablet_2','tablet_3','tablet_s1','tablet_s2','tablet_s3',
    'torch_back','torch_top','torch_off','torch_on','torch_pip',
    'blocker_cloud','chains_1','chains_2','chains_cage',
    'hades_skull',
    'portal_bottom_blue','portal_top_blue',
    'tile','tile_right','tile_cornerin_br','tile_cornerout_bl_bottom','tile_cornerout_bl_side',
    'fx_beam_glow','fx_exp_1','fx_exp_3','fx_exp_5','fx_exp_7',
    'fx_wrap_2','fx_wrap_5','fx_wrap_8','fx_zap_3','fx_zap_6','fx_zap_9',
    'btn_boost_hammer_blue','btn_boost_trident_blue','btn_boost_arrow_blue'
  ];

  class BoardRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.imgs = {};
      this.loaded = false;
      this.engine = null;
      this.selected = null; // { r, c }
      this.hoverCell = null;
      this.tutorialStage = null;

      this.particles = [];
      this.beams = [];
      this.shockwaves = [];
      this.lightnings = [];
      this.popups = [];
      this.flyers = [];
      this.boosterAnims = [];
      this.boardRect = { x: 0, y: 0, size: 400, cell: 50 };

      this.preloadSprites();
    }

    preloadSprites() {
      let remaining = SPRITE_FILES.length;
      for (const name of SPRITE_FILES) {
        const img = new Image();
        img.onload = img.onerror = () => {
          remaining--;
          if (remaining <= 0) this.loaded = true;
        };
        img.src = 'web_assets/sprites/' + name + '.png';
        this.imgs[name] = img;
      }
    }

    setEngine(engine) {
      this.engine = engine;
      this.selected = null;
      this.particles = [];
      this.beams = [];
      this.shockwaves = [];
      this.lightnings = [];
      this.popups = [];
      this.flyers = [];
      this.boosterAnims = [];
      this.tutorialStage = null;
    }

    resize(cssW, cssH) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.max(1, Math.round(cssW * dpr));
      this.canvas.height = Math.max(1, Math.round(cssH * dpr));
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.cssW = cssW;
      this.cssH = cssH;
      const pad = 12;
      const size = Math.min(cssW - pad * 2, cssH - pad * 2);
      const cell = size / 8;
      this.boardRect = {
        x: (cssW - size) / 2,
        y: (cssH - size) / 2,
        size,
        cell
      };
    }

    clientToCell(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const c = Math.floor((x - this.boardRect.x) / this.boardRect.cell);
      const r = Math.floor((y - this.boardRect.y) / this.boardRect.cell);
      if (r < 0 || r >= 8 || c < 0 || c >= 8) return null;
      return { r, c };
    }

    cellCenter(r, c) {
      const { x, y, cell } = this.boardRect;
      return { x: x + (c + 0.5) * cell, y: y + (r + 0.5) * cell };
    }

    // FX emitters
    spawnBurst(r, c, colorHex) {
      const p = this.cellCenter(r, c);
      for (let i = 0; i < 12; i++) {
        const ang = (Math.PI * 2 * i) / 12 + Math.random() * 0.4;
        const spd = 60 + Math.random() * 140;
        this.particles.push({
          x: p.x, y: p.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 35,
          r: 3 + Math.random() * 4,
          color: colorHex || '#fff',
          life: 0,
          maxLife: 0.42 + Math.random() * 0.22
        });
      }
    }

    spawnBeam(dir, r, c, colorHex) {
      this.beams.push({ dir, r, c, color: colorHex || '#ffd84d', life: 0, maxLife: 0.32 });
    }

    spawnShockwave(r, c, radiusCells, colorHex) {
      this.shockwaves.push({ r, c, maxR: radiusCells, color: colorHex || '#fff', life: 0, maxLife: 0.38 });
    }

    spawnLightning(r1, c1, r2, c2, colorHex) {
      const pts = [];
      const a = this.cellCenter(r1, c1);
      const b = this.cellCenter(r2, c2);
      const segs = 6;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const jx = (i === 0 || i === segs) ? 0 : (Math.random() - 0.5) * 18;
        const jy = (i === 0 || i === segs) ? 0 : (Math.random() - 0.5) * 18;
        pts.push({ x: a.x + (b.x - a.x) * t + jx, y: a.y + (b.y - a.y) * t + jy });
      }
      this.lightnings.push({ pts, color: colorHex || '#7ef6ff', life: 0, maxLife: 0.34 });
    }

    spawnPopup(r, c, text, badge) {
      const p = this.cellCenter(r, c);
      this.popups.push({ x: p.x, y: p.y, text, badge, life: 0, maxLife: 0.85 });
    }

    spawnFlyer(r, c, spriteKey, targetX, targetY) {
      const p = this.cellCenter(r, c);
      this.flyers.push({ sx: p.x, sy: p.y, tx: targetX, ty: targetY, spriteKey, life: 0, maxLife: 0.55 });
    }

    spawnBoosterAnim(type, r, c) {
      this.boosterAnims.push({ type, r, c, life: 0, maxLife: 0.42 });
    }

    drawSprite(name, x, y, w, h, alpha = 1) {
      const img = this.imgs[name];
      if (!img || !img.complete || img.naturalWidth === 0) return false;
      if (alpha < 1) {
        this.ctx.save();
        this.ctx.globalAlpha *= alpha;
        this.ctx.drawImage(img, x, y, w, h);
        this.ctx.restore();
      } else {
        this.ctx.drawImage(img, x, y, w, h);
      }
      return true;
    }

    render(dt, now) {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.cssW || 0, this.cssH || 0);
      if (!this.engine) return;

      const { board, rows, cols } = this.engine;
      const { x: bx, y: by, cell } = this.boardRect;

      // 1. Draw rounded stone grid background tiles
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!board[r][c].active) continue;
          const tx = bx + c * cell;
          const ty = by + r * cell;
          // Outer dark slate border behind active cluster
          ctx.save();
          ctx.fillStyle = 'rgba(34, 29, 58, 0.72)';
          this.roundRect(ctx, tx - 3, ty - 3, cell + 6, cell + 6, 10);
          ctx.fill();
          ctx.restore();
        }
      }

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cellData = board[r][c];
          if (!cellData.active) continue;
          const tx = bx + c * cell;
          const ty = by + r * cell;

          if (!this.drawSprite('tile', tx + 0.5, ty + 0.5, cell - 1, cell - 1, 0.94)) {
            ctx.fillStyle = '#4a4563';
            this.roundRect(ctx, tx + 1, ty + 1, cell - 2, cell - 2, 7);
            ctx.fill();
          }

          if ((r + c) % 2 === 1) {
            ctx.fillStyle = 'rgba(255,255,255,0.045)';
            ctx.fillRect(tx + 2, ty + 2, cell - 4, cell - 4);
          }

          // Crystal layers (1, 2, 3)
          if (cellData.crystal > 0) {
            const cName = 'crystal_' + Math.min(3, cellData.crystal);
            ctx.save();
            // Subtle icy blue tint underneath crystal sprite so it pops clearly on dark slate
            ctx.fillStyle = cellData.crystal === 3 ? 'rgba(90, 215, 255, 0.36)' : (cellData.crystal === 2 ? 'rgba(130, 230, 255, 0.28)' : 'rgba(170, 240, 255, 0.2)');
            this.roundRect(ctx, tx + 2, ty + 2, cell - 4, cell - 4, 6);
            ctx.fill();
            this.drawSprite(cName, tx, ty, cell, cell, 0.92);
            ctx.restore();
          }

          // Portals
          if (cellData.portalOut) {
            this.drawSprite('portal_top_blue', tx + cell * 0.05, ty + cell * 0.65, cell * 0.9, cell * 0.45, 0.92);
          }
          // Portal destinations
          for (let rr = 0; rr < rows; rr++) {
            for (let cc = 0; cc < cols; cc++) {
              const po = board[rr][cc].portalOut;
              if (po && po.r === r && po.c === c) {
                this.drawSprite('portal_bottom_blue', tx + cell * 0.05, ty - cell * 0.08, cell * 0.9, cell * 0.42, 0.92);
              }
            }
          }

          // Treasure chest drop indicator at bottom
          if (cellData.hasChest) {
            ctx.save();
            const arrowBob = Math.sin(now * 0.006 + c) * 2.5;
            const gx = tx + cell * 0.5;
            const gy = ty + cell * 0.86 + arrowBob;
            ctx.fillStyle = '#ffd84d';
            ctx.strokeStyle = '#5a2e00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(gx - cell * 0.18, gy - cell * 0.14);
            ctx.lineTo(gx + cell * 0.18, gy - cell * 0.14);
            ctx.lineTo(gx, gy + cell * 0.08);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // Golden base trim
            ctx.fillStyle = 'rgba(255, 200, 45, 0.45)';
            this.roundRect(ctx, tx + cell * 0.12, ty + cell * 0.88, cell * 0.76, cell * 0.1, 4);
            ctx.fill();
            ctx.restore();
          }
        }
      }

      // 2. Hint glow behind gems
      if (this.engine.hintPair && !this.engine.busy && !this.tutorialStage) {
        const pulse = 0.55 + 0.45 * Math.sin(now * 0.008);
        for (const pt of this.engine.hintPair) {
          const tx = bx + pt.c * cell;
          const ty = by + pt.r * cell;
          ctx.save();
          ctx.strokeStyle = `rgba(255, 232, 85, ${pulse})`;
          ctx.lineWidth = 3.5;
          this.roundRect(ctx, tx + 3, ty + 3, cell - 6, cell - 6, 8);
          ctx.stroke();
          ctx.restore();
        }
      }

      // 3. Draw Pieces
      const gemNames = window.PG_CONSTANTS.GEM_NAMES;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cellData = board[r][c];
          if (!cellData.active || !cellData.piece) continue;
          const p = cellData.piece;
          const cx = bx + (p.vx + 0.5) * cell;
          const cy = by + (p.vy + 0.5) * cell;

          // Smooth scale recovery after special formation
          if (p.scale > 1.001) p.scale += (1 - p.scale) * Math.min(1, dt * 10);
          else p.scale = 1;

          let drawScale = p.scale;
          if (this.selected && this.selected.r === r && this.selected.c === c) {
            drawScale *= 1.12 + 0.04 * Math.sin(now * 0.01);
          }

          const s = cell * 0.86 * drawScale;
          const dx = cx - s / 2;
          const dy = cy - s / 2;

          if (p.kind === 'gem') {
            if (p.powerup === window.PG_CONSTANTS.PWR_BOMB) {
              // Element Bomb! Animated rainbow energy sphere
              const colors = ['life', 'water', 'fire', 'passion', 'air', 'earth'];
              const ci = Math.floor(now / 260) % colors.length;
              ctx.save();
              ctx.translate(cx, cy);
              ctx.rotate(now * 0.0022);
              this.drawSprite('bomb_' + colors[ci], -s * 0.5, -s * 0.5, s, s);
              ctx.rotate(-now * 0.0044);
              this.drawSprite('bomb_ring', -s * 0.54, -s * 0.54, s * 1.08, s * 1.08, 0.85);
              ctx.restore();
            } else {
              const gname = gemNames[p.color] || 'life';
              let suffix = '';
              if (p.powerup === window.PG_CONSTANTS.PWR_HORIZ) suffix = '_h';
              else if (p.powerup === window.PG_CONSTANTS.PWR_VERT) suffix = '_v';
              else if (p.powerup === window.PG_CONSTANTS.PWR_WRAPPED) suffix = '_w';
              else if (p.powerup === window.PG_CONSTANTS.PWR_X) suffix = '_x';

              if (p.powerup > 0) {
                ctx.save();
                ctx.globalAlpha = 0.38 + 0.22 * Math.sin(now * 0.007);
                ctx.fillStyle = this.engine.gemHex(p.color);
                ctx.beginPath();
                ctx.arc(cx, cy, s * 0.52, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
              }

              this.drawSprite('gem_' + gname + suffix, dx, dy, s, s);

              // +5s time bonus badge
              if (p.timeBonus > 0) {
                ctx.save();
                ctx.fillStyle = '#ff2e63';
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(cx + s * 0.28, cy - s * 0.28, cell * 0.18, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${Math.round(cell * 0.19)}px GROBOLD, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('+' + p.timeBonus, cx + s * 0.28, cy - s * 0.27);
                ctx.restore();
              }
            }

            if (p.chained) {
              this.drawSprite('chains_1', bx + c * cell, by + r * cell, cell, cell, 0.96);
            }
          } else if (p.kind === 'treasure') {
            const tname = window.PG_CONSTANTS.TREASURE_TYPE[p.color] || 'gold';
            const bob = Math.sin(now * 0.005 + c) * 2;
            this.drawSprite('treasure_' + tname, dx, dy + bob, s, s);
          } else if (p.kind === 'lantern') {
            const tx = bx + c * cell;
            const ty = by + r * cell;
            this.drawSprite('torch_back', tx + 2, ty + 2, cell - 4, cell - 4, 0.9);
            this.drawSprite(p.hp >= 1 ? 'torch_on' : 'torch_off', tx + cell * 0.1, ty + cell * 0.05, cell * 0.8, cell * 0.72);
            if (p.hp >= 1) {
              // Animated flame inside brazier proportional to lit level (1..3)
              const fScale = 0.45 + p.hp * 0.25 + 0.07 * Math.sin(now * 0.02 + c);
              ctx.save();
              const grad = ctx.createRadialGradient(cx, cy - cell * 0.12, 2, cx, cy - cell * 0.12, cell * 0.38 * fScale);
              grad.addColorStop(0, 'rgba(255, 255, 190, 0.98)');
              grad.addColorStop(0.45, 'rgba(255, 165, 25, 0.92)');
              grad.addColorStop(1, 'rgba(255, 60, 0, 0)');
              ctx.fillStyle = grad;
              ctx.beginPath();
              ctx.arc(cx, cy - cell * 0.12, cell * 0.42 * fScale, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
            this.drawSprite('torch_top', tx + cell * 0.04, ty + cell * 0.18, cell * 0.92, cell * 0.78);
            // 3 progress pips
            for (let k = 0; k < 3; k++) {
              ctx.save();
              ctx.beginPath();
              ctx.arc(cx + (k - 1) * (cell * 0.2), ty + cell * 0.86, cell * 0.065, 0, Math.PI * 2);
              ctx.fillStyle = k < p.hp ? '#ffd84d' : 'rgba(25, 15, 10, 0.65)';
              ctx.fill();
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 1.2;
              ctx.stroke();
              ctx.restore();
            }
          } else if (p.kind === 'tablet') {
            const tImg = 'tablet_' + Math.max(1, Math.min(3, p.hp));
            this.drawSprite(tImg, bx + c * cell + 2, by + r * cell + 2, cell - 4, cell - 4);
          } else if (p.kind === 'cloud') {
            const puff = 1 + 0.03 * Math.sin(now * 0.004 + r + c);
            this.drawSprite('blocker_cloud', cx - (cell * puff) / 2, cy - (cell * puff) / 2, cell * puff, cell * puff);
          } else if (p.kind === 'hadesSkull') {
            const tx = bx + c * cell;
            const ty = by + r * cell;
            ctx.save();
            const grad = ctx.createRadialGradient(cx, cy, cell * 0.08, cx, cy, cell * 0.44);
            grad.addColorStop(0, 'rgba(92, 232, 85, 0.75)');
            grad.addColorStop(0.55, 'rgba(65, 22, 95, 0.88)');
            grad.addColorStop(1, 'rgba(25, 10, 40, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, cell * 0.44, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            this.drawSprite('hades_skull', tx + cell * 0.14, ty + cell * 0.14, cell * 0.72, cell * 0.72);
          }
        }
      }

      // 4. Mud overlays (cover cells until cleared)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!board[r][c].active || board[r][c].mud <= 0) continue;
          const tx = bx + c * cell;
          const ty = by + r * cell;
          this.drawSprite('mud_1', tx + 1, ty + 1, cell - 2, cell - 2, 0.96);
        }
      }

      // 5. Selection ring & active booster hover target
      if (this.selected) {
        const tx = bx + this.selected.c * cell;
        const ty = by + this.selected.r * cell;
        ctx.save();
        ctx.strokeStyle = '#ffe55c';
        ctx.lineWidth = 4;
        this.roundRect(ctx, tx + 2, ty + 2, cell - 4, cell - 4, 8);
        ctx.stroke();
        ctx.restore();
      }

      if (this.engine.activeBooster && this.hoverCell && board[this.hoverCell.r][this.hoverCell.c].active) {
        const hr = this.hoverCell.r, hc = this.hoverCell.c;
        const bt = this.engine.activeBooster;
        ctx.save();
        ctx.fillStyle = 'rgba(255, 225, 80, 0.25)';
        ctx.strokeStyle = '#ffe55c';
        ctx.lineWidth = 2.5;
        if (bt === 'trident') {
          ctx.fillRect(bx, by + hr * cell, cell * 8, cell);
          ctx.strokeRect(bx, by + hr * cell, cell * 8, cell);
        } else if (bt === 'torch') {
          ctx.fillRect(bx + hc * cell, by, cell, cell * 8);
          ctx.strokeRect(bx + hc * cell, by, cell, cell * 8);
        } else if (bt === 'arrow') {
          const colr = this.engine.colorAt(hr, hc);
          if (colr > 0) {
            for (let rr = 0; rr < 8; rr++)
              for (let cc = 0; cc < 8; cc++)
                if (this.engine.colorAt(rr, cc) === colr) {
                  ctx.fillRect(bx + cc * cell + 2, by + rr * cell + 2, cell - 4, cell - 4);
                  ctx.strokeRect(bx + cc * cell + 2, by + rr * cell + 2, cell - 4, cell - 4);
                }
          }
        } else {
          ctx.fillRect(bx + hc * cell + 2, by + hr * cell + 2, cell - 4, cell - 4);
          ctx.strokeRect(bx + hc * cell + 2, by + hr * cell + 2, cell - 4, cell - 4);
        }
        ctx.restore();
      }

      // 6. Tutorial spotlight mask & swipe pointer
      if (this.tutorialStage && this.tutorialStage.highlightNodes && !this.engine.busy) {
        const hl = this.tutorialStage.highlightNodes;
        const en = this.tutorialStage.enabledNodes;
        ctx.save();
        ctx.fillStyle = 'rgba(8, 6, 26, 0.58)';
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (!board[r][c].active) continue;
            if (!hl[r * cols + c]) {
              ctx.fillRect(bx + c * cell, by + r * cell, cell, cell);
            }
          }
        }
        if (en) {
          let p2 = null, p3 = null;
          for (let i = 0; i < 64; i++) {
            const rr = Math.floor(i / 8), cc = i % 8;
            if (en[i] === 2) p2 = { r: rr, c: cc };
            if (en[i] === 3) p3 = { r: rr, c: cc };
          }
          if (p2 && p3) {
            const a = this.cellCenter(p3.r, p3.c);
            const b = this.cellCenter(p2.r, p2.c);
            const t = (now % 1100) / 1100;
            const e = t < 0.7 ? (t / 0.7) : 1;
            const px = a.x + (b.x - a.x) * e;
            const py = a.y + (b.y - a.y) * e;

            // Arrow line
            ctx.strokeStyle = '#ffd84d';
            ctx.lineWidth = 4;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Glowing finger orb
            ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
            ctx.strokeStyle = '#ff9800';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(px, py, cell * 0.22, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        }
        ctx.restore();
      }

      // 7. Visual FX updates & draws
      this.renderEffects(ctx, dt, cell);
    }

    renderEffects(ctx, dt, cell) {
      const { x: bx, y: by } = this.boardRect;

      // Beams
      for (let i = this.beams.length - 1; i >= 0; i--) {
        const b = this.beams[i];
        b.life += dt;
        if (b.life >= b.maxLife) { this.beams.splice(i, 1); continue; }
        const a = 1 - b.life / b.maxLife;
        const p = this.cellCenter(b.r, b.c);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = b.color;
        ctx.lineWidth = cell * 0.42 * a;
        ctx.globalAlpha = a * 0.85;
        ctx.lineCap = 'round';
        if (b.dir === 'h') {
          ctx.beginPath(); ctx.moveTo(bx, p.y); ctx.lineTo(bx + cell * 8, p.y); ctx.stroke();
        } else if (b.dir === 'v') {
          ctx.beginPath(); ctx.moveTo(p.x, by); ctx.lineTo(p.x, by + cell * 8); ctx.stroke();
        } else if (b.dir === 'x') {
          ctx.beginPath();
          ctx.moveTo(p.x - cell * 8, p.y - cell * 8); ctx.lineTo(p.x + cell * 8, p.y + cell * 8);
          ctx.moveTo(p.x - cell * 8, p.y + cell * 8); ctx.lineTo(p.x + cell * 8, p.y - cell * 8);
          ctx.stroke();
        }
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = cell * 0.16 * a;
        ctx.stroke();
        ctx.restore();
      }

      // Shockwaves
      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        const s = this.shockwaves[i];
        s.life += dt;
        if (s.life >= s.maxLife) { this.shockwaves.splice(i, 1); continue; }
        const t = s.life / s.maxLife;
        const p = this.cellCenter(s.r, s.c);
        const rad = cell * s.maxR * (0.3 + 0.9 * t);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = (1 - t) * 0.85;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 8 * (1 - t);
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.stroke();
        const frame = t < 0.33 ? 'fx_wrap_2' : (t < 0.66 ? 'fx_wrap_5' : 'fx_wrap_8');
        this.drawSprite(frame, p.x - rad, p.y - rad, rad * 2, rad * 2, 1 - t);
        ctx.restore();
      }

      // Lightnings
      for (let i = this.lightnings.length - 1; i >= 0; i--) {
        const l = this.lightnings[i];
        l.life += dt;
        if (l.life >= l.maxLife) { this.lightnings.splice(i, 1); continue; }
        const a = 1 - l.life / l.maxLife;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = l.color;
        ctx.lineWidth = 5 * a;
        ctx.globalAlpha = a;
        ctx.beginPath();
        l.pts.forEach((pt, idx) => idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
        ctx.stroke();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2 * a;
        ctx.stroke();
        ctx.restore();
      }

      // Booster animations
      for (let i = this.boosterAnims.length - 1; i >= 0; i--) {
        const ba = this.boosterAnims[i];
        ba.life += dt;
        if (ba.life >= ba.maxLife) { this.boosterAnims.splice(i, 1); continue; }
        const t = ba.life / ba.maxLife;
        const p = this.cellCenter(ba.r, ba.c);
        ctx.save();
        ctx.translate(p.x, p.y);
        if (ba.type === 'hammer') {
          ctx.rotate(-0.9 + Math.sin(t * Math.PI) * 1.1);
          this.drawSprite('btn_boost_hammer_blue', -cell * 0.52, -cell * 0.8, cell * 1.04, cell * 1.04, 1 - t * 0.35);
        } else if (ba.type === 'trident') {
          const sx = bx + (ba.c - 2 + t * 10) * cell;
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          this.drawSprite('btn_boost_trident_blue', sx - cell * 0.55, p.y - cell * 0.5, cell * 1.1, cell * 1.0, 1 - t * 0.25);
        } else if (ba.type === 'arrow') {
          const sc = 0.8 + t * 0.5;
          this.drawSprite('btn_boost_arrow_blue', -cell * 0.5 * sc, -cell * 0.5 * sc, cell * sc, cell * sc, 1 - t * 0.4);
        } else if (ba.type === 'torch') {
          ctx.fillStyle = `rgba(255, 130, 20, ${(1 - t) * 0.6})`;
          ctx.fillRect(-cell * 0.45, by - p.y, cell * 0.9, cell * 8);
        }
        ctx.restore();
      }

      // Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.life += dt;
        if (pt.life >= pt.maxLife) { this.particles.splice(i, 1); continue; }
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vy += 260 * dt;
        const a = 1 - pt.life / pt.maxLife;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r * a + 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Flying keys / collectibles
      for (let i = this.flyers.length - 1; i >= 0; i--) {
        const f = this.flyers[i];
        f.life += dt;
        if (f.life >= f.maxLife) { this.flyers.splice(i, 1); continue; }
        const t = f.life / f.maxLife;
        const e = 1 - Math.pow(1 - t, 2);
        const fx = f.sx + (f.tx - f.sx) * e;
        const fy = f.sy + (f.ty - f.sy) * e - Math.sin(t * Math.PI) * 35;
        this.drawSprite(f.spriteKey, fx - cell * 0.38, fy - cell * 0.38, cell * 0.76, cell * 0.76);
      }

      // Score popups
      for (let i = this.popups.length - 1; i >= 0; i--) {
        const pop = this.popups[i];
        pop.life += dt;
        if (pop.life >= pop.maxLife) { this.popups.splice(i, 1); continue; }
        const t = pop.life / pop.maxLife;
        const py = pop.y - t * 38;
        ctx.save();
        ctx.globalAlpha = t < 0.7 ? 1 : (1 - (t - 0.7) / 0.3);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (pop.badge) {
          ctx.font = `bold ${Math.round(cell * 0.36)}px GROBOLD, sans-serif`;
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#3b1053';
          ctx.strokeText(pop.badge, pop.x, py - cell * 0.32);
          ctx.fillStyle = '#ffe55c';
          ctx.fillText(pop.badge, pop.x, py - cell * 0.32);
        }
        ctx.font = `bold ${Math.round(cell * 0.3)}px GROBOLD, sans-serif`;
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#1b1132';
        ctx.strokeText(pop.text, pop.x, py);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(pop.text, pop.x, py);
        ctx.restore();
      }
    }

    roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
  }

  window.BoardRenderer = BoardRenderer;
})();
