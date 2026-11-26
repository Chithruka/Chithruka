// Puzzle Gods Web Audio Manager — uses authentic game MP3s from assets/audio/
(function () {
  const SFX_PATHS = {
    swap: 'assets/audio/sound_effects/Game/fx_swap.mp3',
    swap_rev: 'assets/audio/sound_effects/Game/fx_swap_rev.mp3',
    match1: 'assets/audio/sound_effects/Game/fx_match_standard_1.mp3',
    match2: 'assets/audio/sound_effects/Game/fx_match_standard_2.mp3',
    match3: 'assets/audio/sound_effects/Game/fx_match_standard_3.mp3',
    match4: 'assets/audio/sound_effects/Game/fx_match_standard_4.mp3',
    match5: 'assets/audio/sound_effects/Game/fx_match_standard_5.mp3',
    match6: 'assets/audio/sound_effects/Game/fx_match_standard_6.mp3',
    line_form: 'assets/audio/sound_effects/Game/fx_line_formation.mp3',
    line_det: 'assets/audio/sound_effects/Game/fx_line_detonation.mp3',
    wrap_form: 'assets/audio/sound_effects/Game/fx_encased_formation.mp3',
    wrap_det: 'assets/audio/sound_effects/Game/fx_encased_detonation.mp3',
    x_form: 'assets/audio/sound_effects/Game/fx_x_formation.mp3',
    x_det: 'assets/audio/sound_effects/Game/fx_x_detonation.mp3',
    bomb_form: 'assets/audio/sound_effects/Game/fx_nuclear_formation.mp3',
    bomb_det: 'assets/audio/sound_effects/Game/fx_elementbomb_detonation_outro.mp3',
    double_det: 'assets/audio/sound_effects/Game/fx_double_detonation.mp3',
    supernova: 'assets/audio/sound_effects/Game/fx_supernova_detonation.mp3',
    crystal: 'assets/audio/sound_effects/Game/fx_crystal.mp3',
    mud: 'assets/audio/sound_effects/Game/fx_mud.mp3',
    key: 'assets/audio/sound_effects/Game/fx_key_collect.mp3',
    lantern_hit: 'assets/audio/sound_effects/Game/fx_lantern_ignite.mp3',
    lantern_done: 'assets/audio/sound_effects/Game/fx_lantern_ignite.mp3',
    treasure: 'assets/audio/sound_effects/Game/fx_treasure_collect.mp3',
    tablet: 'assets/audio/sound_effects/Game/fx_tablet.mp3',
    chain: 'assets/audio/sound_effects/Game/fx_chain.mp3',
    cloud: 'assets/audio/sound_effects/Game/fx_cloud_birth.mp3',
    hitboss: 'assets/audio/sound_effects/Game/fx_hitboss.mp3',
    hades_block: 'assets/audio/sound_effects/Game/fx_hades_blocker_intro.mp3',
    hammer: 'assets/audio/sound_effects/Game/fx_booster_hammer.mp3',
    trident: 'assets/audio/sound_effects/Game/fx_booster_trident.mp3',
    flame: 'assets/audio/sound_effects/Game/fx_booster_torch.mp3',
    arrow: 'assets/audio/sound_effects/Game/fx_booster_love_arrow.mp3',
    reshuffle: 'assets/audio/sound_effects/Game/fx_board_reshuffle.mp3',
    collect: 'assets/audio/sound_effects/Game/fx_collect.mp3',
    win: 'assets/audio/sound_effects/Game/fx_win.mp3',
    lose: 'assets/audio/sound_effects/Game/fx_lose.mp3',
    star1: 'assets/audio/sound_effects/Game/fx_end_star_1.mp3',
    star2: 'assets/audio/sound_effects/Game/fx_end_star_2.mp3',
    star3: 'assets/audio/sound_effects/Game/fx_end_star_3.mp3',
    hurrah: 'assets/audio/sound_effects/Game/fx_lasthurrah_meteor.mp3',
    ui_btn: 'assets/audio/sound_effects/UI/ui_menubutton.mp3',
    ui_stage: 'assets/audio/sound_effects/UI/ui_tapstage.mp3',
    ui_boost: 'assets/audio/sound_effects/UI/ui_tap_booster_character_haww.mp3',
    ui_pop: 'assets/audio/sound_effects/Game/tr_ui_pop.mp3',
    tick: 'assets/audio/sound_effects/Game/fx_tick.mp3'
  };

  const MUSIC_PATHS = {
    welcome: 'assets/audio/music/WelcomeMapBG.mp3',
    game: 'assets/audio/music/InGameBG.mp3',
    boss: 'assets/audio/music/music_ingame_boss.mp3',
    win: 'assets/audio/music/jgl_end_win.mp3',
    lose: 'assets/audio/music/jgl_end_lose.mp3'
  };

  class AudioEngine {
    constructor() {
      this.sfxEnabled = true;
      this.musicEnabled = true;
      this.unlocked = false;
      this.currentTrackKey = null;
      this.bgm = null;
      this.pool = {};
    }

    unlock() {
      if (this.unlocked) return;
      this.unlocked = true;
      if (this.musicEnabled && this.currentTrackKey && (!this.bgm || this.bgm.paused)) {
        this.playMusic(this.currentTrackKey, true);
      }
    }

    setSfx(on) {
      this.sfxEnabled = !!on;
    }

    setMusic(on) {
      this.musicEnabled = !!on;
      if (!this.musicEnabled) {
        if (this.bgm) this.bgm.pause();
      } else if (this.currentTrackKey) {
        this.playMusic(this.currentTrackKey, true);
      }
    }

    play(key, vol = 0.65) {
      if (!this.sfxEnabled) return;
      const src = SFX_PATHS[key];
      if (!src) return;
      try {
        // Use lightweight pool of up to 3 Audio elements per key to support overlapping cascades
        let list = this.pool[key];
        if (!list) {
          list = [];
          this.pool[key] = list;
        }
        let audio = list.find(a => a.ended || a.paused);
        if (!audio && list.length < 3) {
          audio = new Audio(src);
          list.push(audio);
        }
        if (!audio) audio = list[0];
        audio.volume = vol;
        audio.currentTime = 0;
        const p = audio.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (e) {}
    }

    playMatch(comboStep) {
      const idx = Math.max(1, Math.min(6, comboStep | 0));
      this.play('match' + idx, 0.7);
    }

    playMusic(key, loop = true) {
      this.currentTrackKey = key;
      if (!this.musicEnabled) return;
      const src = MUSIC_PATHS[key];
      if (!src) return;
      try {
        if (this.bgm) {
          if (this.bgm._key === key && !this.bgm.paused && this.bgm.loop === loop) return;
          this.bgm.pause();
        }
        const a = new Audio(src);
        a._key = key;
        a.loop = loop;
        a.volume = 0.35;
        this.bgm = a;
        const p = a.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (e) {}
    }

    playJingle(key) {
      if (!this.sfxEnabled && !this.musicEnabled) return;
      const src = MUSIC_PATHS[key];
      if (!src) return;
      try {
        if (this.bgm) this.bgm.pause();
        const a = new Audio(src);
        a.loop = false;
        a.volume = 0.45;
        const p = a.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (e) {}
    }
  }

  window.PGAudio = new AudioEngine();
})();
