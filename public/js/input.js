'use strict';
/* THE PREDICTOR — Input, Navigation & Keyboard Controller. */

let selectedRunClass = 'operative';

function doAction(tok) {
  if (typeof SFX !== 'undefined' && SFX.move) SFX.move(tok);
  step(tok, false, false);
}

function doKnightLeap(km) {
  if (typeof SFX !== 'undefined' && SFX.move) SFX.move(4);
  step(4, false, true, km);
}

function doNoise() {
  step(4, true, false);
}

function openPreRunModal() {
  const overlay = $('pre-run-overlay');
  if (overlay) overlay.classList.add('active');
}

function closePreRunModal() {
  const overlay = $('pre-run-overlay');
  if (overlay) overlay.classList.remove('active');
}

function showSystemModal() {
  const acc = Core.accuracy();
  const lp = legPct();
  const telemetry = `
    <b>PERSISTENT CORE METRICS:</b><br>
    LIFETIME ACTIONS OBSERVED: <b>${Core.n}</b><br>
    RUNS WITNESSED: <b>${Core.runs}</b><br>
    LIFETIME ACCURACY: <b>${acc !== null ? acc + '%' : 'CALIBRATING'}</b> (${Core.lifeH}/${Core.lifeP})<br>
    ACCUMULATED EPIPLEXITY (S_T): <b>${(G.epiplexity || 0).toFixed(2)} bits</b><br>
    ENTROPY SPENT: <b>${Core.ent}◇</b><br>
    CURRENT SESSION LEGIBILITY: <b>${lp !== null ? lp + '%' : '—'}</b>
  `;

  showModal(
    'SYSTEM DIAGNOSTIC',
    '',
    telemetry,
    'RESUME',
    null,
    'WIPE CORE MEMORY',
    async () => {
      await wipeCore();
      say('A-9: [~_~] "Core memory wiped. Tabula rasa restored."');
      drawAll();
    }
  );
}

function bindInput() {
  // Monitor mode toggle (Board vs Neural)
  const toggleMonBtn = $('btn-toggle-monitor');
  if (toggleMonBtn) toggleMonBtn.addEventListener('click', () => toggleMonitorMode());

  // Theme button
  const themeBtn = $('theme-btn');
  if (themeBtn) themeBtn.addEventListener('click', () => cycleTheme());

  // Sector Map toggles
  const mapBtn = $('map-toggle-btn');
  if (mapBtn) mapBtn.addEventListener('click', () => openSectorMap());

  const sectorClose = $('sector-close');
  if (sectorClose) sectorClose.addEventListener('click', () => closeSectorMap());

  // Pre-Run setup modal
  const preRunClose = $('pre-run-close');
  if (preRunClose) preRunClose.addEventListener('click', () => closePreRunModal());

  const classCards = document.querySelectorAll('.class-card');
  classCards.forEach(card => {
    card.addEventListener('click', () => {
      classCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedRunClass = card.dataset.class || 'operative';
    });
  });

  const btnStartRun = $('btn-start-configured-run');
  if (btnStartRun) {
    btnStartRun.addEventListener('click', () => {
      closePreRunModal();
      showScreen('game');
      startRun(selectedRunClass);
    });
  }

  // Menu screen buttons
  const menuRun = $('menu-run');
  if (menuRun) menuRun.addEventListener('click', () => openPreRunModal());

  const menuCrucible = $('menu-crucible');
  if (menuCrucible) menuCrucible.addEventListener('click', () => { showScreen('game'); startCrucible(); });

  const menuSectors = $('menu-sectors');
  if (menuSectors) menuSectors.addEventListener('click', () => openSectorMap());

  const menuCore = $('menu-core');
  if (menuCore) menuCore.addEventListener('click', () => showSystemModal());

  const menuOptions = $('menu-options');
  if (menuOptions) menuOptions.addEventListener('click', () => cycleTheme());

  const menuCli = $('menu-cli');
  if (menuCli) menuCli.addEventListener('click', () => openCli());

  // In-game menu button
  const sysBtn = $('btn-menu');
  if (sysBtn) sysBtn.addEventListener('click', () => showScreen('menu'));

  // CLI window controls
  const cliCloseBtn = $('cli-close-btn');
  if (cliCloseBtn) cliCloseBtn.addEventListener('click', () => closeCli());

  const cliMinBtn = $('cli-min-btn');
  if (cliMinBtn) cliMinBtn.addEventListener('click', () => closeCli());

  const cliInput = $('cli-input');
  if (cliInput) {
    cliInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const val = cliInput.value;
        if (val.trim()) {
          execCli(val);
          cliInput.value = '';
        }
      } else if (e.key === 'Escape') {
        closeCli();
      }
      e.stopPropagation();
    });
  }

  // Window keyboard listener
  window.addEventListener('keydown', e => {
    if (document.activeElement === cliInput) return;

    // Toggle CLI with ` or ~
    if (e.key === '`' || e.key === '~') {
      e.preventDefault();
      toggleCli();
      return;
    }

    // Modal dismissals
    const overlay = $('modal-overlay');
    if (overlay && overlay.classList.contains('active')) {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        hideModal();
      }
      return;
    }

    const preRunOverlay = $('pre-run-overlay');
    if (preRunOverlay && preRunOverlay.classList.contains('active')) {
      if (e.key === 'Escape') closePreRunModal();
      else if (e.key === 'Enter') {
        closePreRunModal();
        showScreen('game');
        startRun(selectedRunClass);
      }
      return;
    }

    const sectorOverlay = $('sector-overlay');
    if (sectorOverlay && sectorOverlay.classList.contains('active')) {
      if (e.key === 'Escape') closeSectorMap();
      return;
    }

    // Menu screen shortcuts [1-6]
    const menuScreen = $('screen-menu');
    if (menuScreen && menuScreen.classList.contains('active')) {
      if (e.key === '1') { openPreRunModal(); return; }
      if (e.key === '2') { showScreen('game'); startCrucible(); return; }
      if (e.key === '3') { openSectorMap(); return; }
      if (e.key === '4') { showSystemModal(); return; }
      if (e.key === '5') { cycleTheme(); return; }
      if (e.key === '6') { openCli(); return; }
      if (e.key === 'Escape' && G.active) { showScreen('game'); return; }
      return;
    }

    // In-game ESC returns to Menu
    if (e.key === 'Escape') {
      showScreen('menu');
      return;
    }

    if (G.over) {
      if (e.key === 'r' || e.key === 'R' || e.key === ' ') {
        startRun(selectedRunClass);
      }
      return;
    }

    // Toggle Monitor View (Board vs Neural) with V or Tab
    if (e.key === 'v' || e.key === 'V' || e.key === 'Tab') {
      e.preventDefault();
      toggleMonitorMode();
      return;
    }

    // Toggle Sector Route Map with M
    if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      openSectorMap();
      return;
    }

    // Toggle Knight Protocol with K
    if (e.key === 'k' || e.key === 'K') {
      if (G.hasKnight) {
        G.protocol = G.protocol === 'knight' ? 'cardinal' : 'knight';
        say(`A-9: [^_^] "Movement protocol switched to ${G.protocol.toUpperCase()}."`);
        drawAll();
      } else {
        say('A-9: [x_x] "Knight protocol not installed. Verify Trust Gate to acquire."');
      }
      return;
    }

    const keyMap = {
      ArrowLeft: 0, a: 0, A: 0,
      ArrowUp: 1, w: 1, W: 1,
      ArrowRight: 2, d: 2, D: 2,
      ArrowDown: 3, s: 3, S: 3,
      ' ': 4, '.': 4
    };

    if (e.key in keyMap) {
      e.preventDefault();
      const tok = keyMap[e.key];
      if (G.protocol === 'knight' && tok < 4) {
        const knightMap = [
          { dx: -2, dy: -1 },
          { dx:  1, dy: -2 },
          { dx:  2, dy:  1 },
          { dx: -1, dy:  2 }
        ];
        doKnightLeap(knightMap[tok]);
      } else {
        doAction(tok);
      }
    } else if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      doNoise();
    } else if (e.key === 't' || e.key === 'T') {
      cycleTheme();
    }
  });

  // Canvas Touch and Pointer Interactions
  let touchStart = null;
  const canvas = $('board-canvas');
  if (!canvas) return;

  canvas.addEventListener('pointerdown', e => {
    touchStart = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('pointerup', e => {
    if (!touchStart) return;
    const dx = e.clientX - touchStart.x;
    const dy = e.clientY - touchStart.y;
    touchStart = null;

    const isTap = Math.abs(dx) < 14 && Math.abs(dy) < 14;
    if (isTap) {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const ts = rect.width / G.W;
      const cx = Math.floor(clickX / ts);
      const cy = Math.floor(clickY / ts);

      if (cx === G.player.x && cy === G.player.y) {
        doAction(4);
        return;
      }

      const adx = cx - G.player.x;
      const ady = cy - G.player.y;

      if (G.hasKnight && ((Math.abs(adx) === 1 && Math.abs(ady) === 2) || (Math.abs(adx) === 2 && Math.abs(ady) === 1))) {
        doKnightLeap({ dx: adx, dy: ady });
        return;
      }

      if (Math.abs(adx) + Math.abs(ady) === 1) {
        if (adx === -1) doAction(0);
        else if (ady === -1) doAction(1);
        else if (adx === 1) doAction(2);
        else if (ady === 1) doAction(3);
      }
      return;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      doAction(dx > 0 ? 2 : 0);
    } else {
      doAction(dy > 0 ? 3 : 1);
    }
  });
}
