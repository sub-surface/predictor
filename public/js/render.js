'use strict';
/* THE PREDICTOR — Canvas Spritemap Engine, Shoggoth FX, ANSI BIOS & FTL Route Renderer. */

const $ = id => document.getElementById(id);

const THEMES = ['oled', 'green', 'cyan', 'light'];
let currentThemeIdx = 0;
let lastLogText = '';

// Monitor Display Mode: 'board' | 'neural'
let monitorMode = 'board';

// Spritemap Texture Loader
const Spritemap = {
  img: null,
  loaded: false,
  colW: 307.2,
  rowH: 256.0,
  artH: 200.0, // Clean crop strictly above caption labels

  coords: {
    player:  { col: 0, row: 0 },
    drone:   { col: 1, row: 0 },
    stalker: { col: 2, row: 0 },
    avatar:  { col: 3, row: 0 },
    a9:      { col: 4, row: 0 },
    floor:   { col: 0, row: 1 },
    wall:    { col: 1, row: 1 },
    gate:    { col: 2, row: 1 },
    vault:   { col: 2, row: 1 },
    stairs:  { col: 3, row: 1 },
    chestT:  { col: 4, row: 1 },
    chestO:  { col: 4, row: 1 },
    ent:     { col: 0, row: 2 },
    cache:   { col: 1, row: 2 },
    target:  { col: 2, row: 2 },
    laser:   { col: 3, row: 2 },
    burst:   { col: 4, row: 2 }
  },

  init() {
    if (typeof Image === 'undefined') return;
    this.img = new Image();
    this.img.src = 'assets/spritemap.png';
    this.img.onload = () => { this.loaded = true; };
    this.img.onerror = () => {
      // Fallback try root spritemap
      this.img.src = 'spritemap.png';
      this.img.onload = () => { this.loaded = true; };
    };
  }
};

Spritemap.init();

/* =====================================================================
   SCREEN ROUTING & ANSI BIOS SEQUENCE (Avatar/Starweft style)
   ===================================================================== */
function showScreen(screenId) {
  document.querySelectorAll('.view-screen').forEach(s => s.classList.remove('active'));
  const target = $(`screen-${screenId}`);
  if (target) target.classList.add('active');
  if (screenId === 'game') {
    resizeBoardCanvas();
    drawAll();
  }
}

function runBiosSequence(onComplete) {
  // Check session storage
  try {
    if (sessionStorage.getItem('tp_bios_seen') === '1') {
      if (onComplete) onComplete();
      return;
    }
  } catch (e) {}

  showScreen('bios');
  const logContainer = $('bios-log');
  if (!logContainer) { if (onComplete) onComplete(); return; }
  logContainer.replaceChildren();

  const script = [
    { t: '┌──────────────────────────────────────────────────────────────┐', cls: 'boot-tertiary', d: 15 },
    { t: '│  SUB-SURFACE SYSTEM ARCHIVAL BIOS v4.02 (C) 1989-2026        │', cls: 'boot-tertiary', d: 15 },
    { t: '│  AUTOREGRESSIVE PREDICTION MATRIX & HUMAN OPERATOR EVALUATOR  │', cls: 'boot-tertiary', d: 15 },
    { t: '└──────────────────────────────────────────────────────────────┘', cls: 'boot-tertiary', d: 80 },
    { t: '', cls: 'boot-dim', d: 20 },
    { t: 'Main Processor   : WaveCore Synaptic DSP @ 1 tick / action', cls: 'boot-accent', d: 25 },
    { t: 'Co-Processor     : Continuous Modern Hopfield Associative Memory', cls: 'boot-accent', d: 25 },
    { t: 'Feature Layer    : NNUE 64-Dim Attractor Basin with Online SGD', cls: 'boot-accent', d: 25 },
    { t: 'Loss Metric      : Finzi Epiplexic Integrator (S_T = H_T - H_inf)', cls: 'boot-accent', d: 60 },
    { t: '', cls: 'boot-dim', d: 20 },
    { t: 'Memory Test: 640 KB Conventional Attractor Basin', cls: 'boot-dim', d: 30, memtest: true },
    { t: '', cls: 'boot-dim', d: 25 },
    { t: 'POST Telemetry Diagnostic ....................................', cls: 'boot-dim', d: 40 },
    { t: '  [CORE  ] PAQ context mixing (Order 0, 1, 2) ......... [OK]', cls: 'boot-ok', d: 20 },
    { t: '  [ATTRACT] 24-unit continuous attractor basin ........ [OK]', cls: 'boot-ok', d: 20 },
    { t: '  [HOPFLD] Episodic trajectory associative store ...... [OK]', cls: 'boot-ok', d: 20 },
    { t: '  [SHOGG ] Mesa-optimization tissue watchdog .......... [ARMED]', cls: 'boot-warn', d: 35 },
    { t: '  [DISCIP] Monoculture legibility evaluator ........... [ONLINE]', cls: 'boot-ok', d: 20 },
    { t: '', cls: 'boot-dim', d: 20 },
    { t: 'Memory Allocation Map:', cls: 'boot-secondary', d: 15 },
    { t: '  0x0000  ████████████████  [KERNEL_SGD]', cls: 'boot-tertiary', d: 12 },
    { t: '  0x4000  ▓▓▓▓▓▓▓▓░░░░░░░░  [ATTRACTOR_BASIN]', cls: 'boot-tertiary', d: 12 },
    { t: '  0x8000  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  [EPIPLEXIC_LOSS]', cls: 'boot-tertiary', d: 12 },
    { t: '  0xC000  ░░░░░░░░░░░░░░░░  [FREE_MEMORY]', cls: 'boot-tertiary', d: 30 },
    { t: '', cls: 'boot-dim', d: 20 },
    { t: 'A-9: [^_^] "Operator neural presence detected. Attractor basin synchronized."', cls: 'boot-accent', d: 60 },
    { t: 'A-9: [o_o] "The Core has loaded your historical prior. Ready for active cycle."', cls: 'boot-accent', d: 80 },
    { t: '', cls: 'boot-dim', d: 20 },
    { t: 'SYSTEM READY. PRESS [SPACE] OR CLICK TO INITIALIZE PLATFORM _', cls: 'boot-ok', d: 0 }
  ];

  let stepIdx = 0;
  let timer = null;

  function endBios() {
    if (timer) clearTimeout(timer);
    try { sessionStorage.setItem('tp_bios_seen', '1'); } catch (e) {}
    window.removeEventListener('keydown', onKey);
    if (onComplete) onComplete();
  }

  function nextStep() {
    if (stepIdx >= script.length) return;
    const item = script[stepIdx++];
    const line = document.createElement('div');
    line.className = `bios-line ${item.cls || ''}`;
    line.textContent = item.t;
    logContainer.appendChild(line);
    logContainer.scrollTop = logContainer.scrollHeight;

    if (item.memtest) {
      // Little animated tick
      let count = 0;
      const memInterval = setInterval(() => {
        count += 128;
        line.textContent = `Memory Test: ${count} KB / 640 KB OK`;
        if (count >= 640) {
          clearInterval(memInterval);
          line.textContent = 'Memory Test: 640 KB ATTRACTOR BASIN OK';
          timer = setTimeout(nextStep, 50);
        }
      }, 25);
    } else {
      timer = setTimeout(nextStep, item.d || 30);
    }
  }

  const onKey = e => {
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
      endBios();
    }
  };
  window.addEventListener('keydown', onKey);

  const skipBtn = $('btn-skip-bios');
  if (skipBtn) skipBtn.onclick = endBios;

  nextStep();
}

/* =====================================================================
   THEMES & DISPLAY SETTINGS
   ===================================================================== */
function cycleTheme() {
  currentThemeIdx = (currentThemeIdx + 1) % THEMES.length;
  setTheme(THEMES[currentThemeIdx]);
}

function setTheme(theme) {
  if (!THEMES.includes(theme)) return;
  document.documentElement.setAttribute('data-theme', theme);
  const btn = $('theme-btn');
  if (btn) btn.textContent = `THEME: ${theme.toUpperCase()}`;
  if (typeof S !== 'undefined') {
    S.theme = theme;
    if (typeof saveSettings === 'function') saveSettings();
  }
  drawLossCurve();
}

/* =====================================================================
   TACTICAL CANVAS ENGINE (Spritemap, Lasers, Shoggoth Mass & FX)
   ===================================================================== */
let boardCanvas = null;
let boardCtx = null;
let animFrameId = null;

function getBoardCanvas() {
  if (!boardCanvas) {
    boardCanvas = $('board-canvas');
    if (boardCanvas) boardCtx = boardCanvas.getContext('2d');
  }
  return boardCanvas;
}

function resizeBoardCanvas() {
  const canvas = getBoardCanvas();
  const stage = $('stage');
  if (!canvas || !stage) return;

  const rect = stage.getBoundingClientRect();
  const side = Math.max(280, Math.min(rect.width, rect.height || 420));
  canvas.width = side;
  canvas.height = side;
}

function drawSprite(key, px, py, ts) {
  if (!boardCtx) return;
  const coord = Spritemap.coords[key];
  if (Spritemap.loaded && Spritemap.img && coord) {
    const sx = coord.col * Spritemap.colW;
    const sy = coord.row * Spritemap.rowH;
    boardCtx.drawImage(
      Spritemap.img,
      sx, sy, Spritemap.colW, Spritemap.artH,
      px, py, ts, ts
    );
  } else {
    // High-contrast ASCII Glyph Fallback
    const glyphMap = {
      player: '@', drone: 'd', stalker: 'S', avatar: 'Ω', a9: 'A',
      floor: '.', wall: '#', gate: '≡', vault: '≡', stairs: '>',
      chestT: '◻', chestO: '◼', ent: '◇', cache: '▣', target: '+', laser: '|', burst: '*'
    };
    const colMap = {
      player: '#50fa7b', drone: '#ff5555', stalker: '#f97316', avatar: '#ff79c6',
      floor: '#22222c', wall: '#6272a4', gate: '#ff79c6', vault: '#f1fa8c', stairs: '#8be9fd',
      chestT: '#8be9fd', chestO: '#f59e0b', ent: '#10b981', cache: '#f59e0b', target: '#f97316'
    };
    boardCtx.fillStyle = colMap[key] || '#f8f8f2';
    boardCtx.font = `bold ${Math.floor(ts * 0.55)}px monospace`;
    boardCtx.textAlign = 'center';
    boardCtx.textBaseline = 'middle';
    boardCtx.fillText(glyphMap[key] || '?', px + ts / 2, py + ts / 2);
  }
}

function renderBoardCanvas(t = 0) {
  const canvas = getBoardCanvas();
  if (!canvas || !boardCtx || !G || !G.W) return;
  const ctx = boardCtx;
  const W = canvas.width;
  const H = canvas.height;
  const ts = W / G.W;

  ctx.clearRect(0, 0, W, H);

  // 1. Draw Floor Tiles (Dark Carbon with subtle grid & circuit accents)
  for (let y = 0; y < G.H; y++) {
    for (let x = 0; x < G.W; x++) {
      const i = idx(x, y);
      const px = x * ts, py = y * ts;

      if (G.walls.has(i)) {
        // Pylon Block Wall
        ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
        ctx.fillRect(px + ts * 0.15, py + ts * 0.28, ts * 0.85, ts * 0.72);
        ctx.fillStyle = '#202018';
        ctx.fillRect(px + 2, py + 6, ts - 4, ts - 8);
        ctx.fillStyle = '#2d2a22';
        ctx.fillRect(px + 2, py + 2, ts - 4, ts - 6);
        ctx.fillStyle = 'rgba(231, 223, 207, 0.12)';
        ctx.fillRect(px + 4, py + 3, ts - 8, 2);
      } else {
        // Floor tile
        ctx.fillStyle = '#10100d';
        ctx.fillRect(px, py, ts, ts);
        ctx.strokeStyle = 'rgba(231, 223, 207, 0.035)';
        ctx.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);
        if (((x * 17 + y * 31) & 15) === 0) {
          ctx.fillStyle = 'rgba(101, 214, 217, 0.04)';
          ctx.fillRect(px + ts * 0.18, py + ts * 0.18, ts * 0.18, ts * 0.18);
        }
      }
    }
  }

  // 2. Draw Shoggoth Living Mass Substrate
  if (G.mass && G.mass.size > 0) {
    const fav = (G.massFavor || 0) > 0;
    for (const mIdx of G.mass) {
      const mx = mIdx % G.W, my = Math.floor(mIdx / G.W);
      const px = mx * ts, py = my * ts;
      const a = 0.62 + 0.18 * Math.sin(t / 180 + mx + my);
      ctx.fillStyle = fav
        ? `rgba(115, 201, 155, ${0.32 + 0.16 * Math.sin(t / 150 + mx)})`
        : `rgba(223, 89, 79, ${a})`;
      ctx.fillRect(px + 1, py + 1, ts - 2, ts - 2);

      if ((mx + my + G.turn) % 3 === 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.fillRect(px + ts * 0.2, py + ts * 0.2, ts * 0.6, ts * 0.18);
      }
    }
  }

  // 3. Draw Exit Lift
  if (G.stairs) {
    const px = G.stairs.x * ts, py = G.stairs.y * ts;
    const ready = G.player.gems >= 3 || G.mode === 'crucible';
    ctx.strokeStyle = ready ? 'rgba(115, 201, 155, 0.9)' : 'rgba(214, 179, 93, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + ts * 0.12, py + ts * 0.12, ts * 0.76, ts * 0.76);
    ctx.fillStyle = ready ? 'rgba(115, 201, 155, 0.18)' : 'rgba(214, 179, 93, 0.12)';
    ctx.fillRect(px + ts * 0.2, py + ts * 0.2, ts * 0.6, ts * 0.6);
    ctx.fillStyle = ready ? '#73c99b' : '#d6b35d';
    ctx.font = `bold ${Math.floor(ts * 0.55)}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('>', px + ts / 2, py + ts / 2);
  }

  // 4. Draw Items
  for (const it of G.items) {
    const px = it.x * ts, py = it.y * ts;
    let ch = '▣', col = '#d6b35d';
    if (it.type === 'ent') { ch = '✦'; col = '#73c99b'; }
    else if (it.type === 'vault') { ch = '≡'; col = '#ad79d5'; }
    else if (it.type === 'chestT') { ch = '◻'; col = '#65d6d9'; }
    else if (it.type === 'chestO') { ch = '◼'; col = '#d6b35d'; }

    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = col;
    ctx.fillStyle = col;
    ctx.font = `${Math.floor(ts * 0.62)}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, px + ts / 2, py + ts / 2 + Math.sin(t / 250 + it.x) * 2);
    ctx.restore();
  }

  // 5. Draw Prediction Targeting Locks & Vertical Sky Lasers
  let strongest = null;
  for (const pred of turnPreds) {
    if (!strongest || pred.conf > strongest.conf) strongest = pred;
    const px = pred.x * ts, py = pred.y * ts;
    const pulse = 0.82 + 0.18 * Math.sin(t / 240 + pred.x * 1.7 + pred.y);
    const alpha = Math.min(0.85, 0.08 + pred.conf * 0.6) * pulse;

    // Faint red threat cloud
    ctx.fillStyle = `rgba(223, 89, 79, ${alpha * 0.4})`;
    ctx.fillRect(px + 3, py + 3, ts - 6, ts - 6);

    // Warrant dashed box
    ctx.strokeStyle = `rgba(214, 179, 93, ${0.35 + 0.55 * pred.conf})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(px + 3, py + 3, ts - 6, ts - 6);
    ctx.setLineDash([]);

    // Vertical targeting laser from sky
    if (pred.conf >= 0.4) {
      ctx.strokeStyle = `rgba(223, 89, 79, ${0.25 + 0.45 * pred.conf})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(px + ts / 2, 0);
      ctx.lineTo(px + ts / 2, py + ts / 2);
      ctx.stroke();
    }

    // Stalker Projected Trajectory Laser (t+1 -> t+2)
    if (pred.t2) {
      const p2x = pred.t2.x * ts + ts / 2;
      const p2y = pred.t2.y * ts + ts / 2;
      ctx.strokeStyle = `rgba(223, 89, 79, ${alpha * 0.85})`;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(px + ts / 2, py + ts / 2);
      ctx.lineTo(p2x, p2y);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(214, 179, 93, 0.9)';
      ctx.strokeRect(pred.t2.x * ts + 6, pred.t2.y * ts + 6, ts - 12, ts - 12);
    }
  }

  // Strongest Prediction Reticle Box
  if (strongest && strongest.conf >= 0.5) {
    const px = strongest.x * ts, py = strongest.y * ts;
    ctx.strokeStyle = '#d6b35d';
    ctx.lineWidth = 2.2;
    ctx.strokeRect(px + 1.5, py + 1.5, ts - 3, ts - 3);
  }

  // 6. Draw Enemies (Glow Glyphs)
  for (const e of G.enemies) {
    const px = e.x * ts, py = e.y * ts;
    let ch = '⌖', col = '#65d6d9';
    if (e.type === 'drone') { ch = '⌖'; col = '#65d6d9'; }
    else if (e.type === 'stalker') { ch = '⌁'; col = '#d6b35d'; }
    else if (e.type === 'avatar') { ch = 'Ω'; col = '#ad79d5'; }

    ctx.save();
    ctx.shadowBlur = e.type === 'avatar' ? 16 : 8;
    ctx.shadowColor = col;
    ctx.fillStyle = col;
    ctx.font = `${Math.floor(ts * (e.type === 'avatar' ? 0.76 : 0.68))}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, px + ts / 2, py + ts / 2);
    ctx.restore();

    if (e.hp > 1) {
      ctx.fillStyle = 'rgba(231, 223, 207, 0.8)';
      ctx.font = `bold ${Math.max(9, Math.floor(ts * 0.22))}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('•'.repeat(e.hp), px + ts / 2, py + ts * 0.88);
    }
  }

  // 7. Draw Player Operative (The Glowing Diamond Avatar from Shoggoth Artifact)
  const fav = (G.massFavor || 0) > 0;
  const pCol = fav ? '#73c99b' : '#65d6d9';
  const px = G.player.x * ts, py = G.player.y * ts;

  ctx.save();
  ctx.shadowBlur = 14;
  ctx.shadowColor = pCol;
  ctx.fillStyle = pCol;
  ctx.strokeStyle = '#e7dfcf';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(px + ts / 2, py + ts * 0.12);
  ctx.lineTo(px + ts * 0.85, py + ts / 2);
  ctx.lineTo(px + ts / 2, py + ts * 0.88);
  ctx.lineTo(px + ts * 0.15, py + ts / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 7. Draw Blazing Laser Strikes (from FX.beams)
  if (typeof FX !== 'undefined') {
    for (let b = FX.beams.length - 1; b >= 0; b--) {
      const beam = FX.beams[b];
      beam.ttl--;
      const alpha = beam.ttl / beam.max;
      const bx = beam.x * ts, by = beam.y * ts;

      // Vertical blazing beam
      ctx.fillStyle = `rgba(255, 230, 180, ${alpha * 0.9})`;
      ctx.fillRect(bx + ts * 0.38, 0, ts * 0.24, by + ts);

      // Core flash
      ctx.fillStyle = `rgba(239, 68, 68, ${alpha * 0.7})`;
      ctx.fillRect(bx + 2, by + 2, ts - 4, ts - 4);

      // Expanding circular shockwave ripple
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx + ts / 2, by + ts / 2, ts * (1.3 - alpha), 0, Math.PI * 2);
      ctx.stroke();

      if (beam.ttl <= 0) FX.beams.splice(b, 1);
    }

    // 8. Draw Spark Particles (from FX.particles)
    for (let p = FX.particles.length - 1; p >= 0; p--) {
      const part = FX.particles[p];
      part.x += part.vx;
      part.y += part.vy;
      part.ttl--;
      const alpha = Math.max(0, part.ttl / 30);
      ctx.fillStyle = part.col || '#10b981';
      ctx.globalAlpha = alpha;
      ctx.fillRect(part.x * ts, part.y * ts, 3, 3);
      ctx.globalAlpha = 1.0;
      if (part.ttl <= 0) FX.particles.splice(p, 1);
    }

    // 9. Draw Floating Combat Text (from FX.popups)
    for (let pop = FX.popups.length - 1; pop >= 0; pop--) {
      const popup = FX.popups[pop];
      popup.ttl--;
      const alpha = Math.max(0, popup.ttl / popup.max);
      const dy = (1.0 - popup.ttl / popup.max) * 24;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = popup.col || '#f59e0b';
      ctx.globalAlpha = alpha;
      ctx.fillText(popup.text, popup.x * ts + ts / 2, popup.y * ts + 8 - dy);
      ctx.globalAlpha = 1.0;
      if (popup.ttl <= 0) FX.popups.splice(pop, 1);
    }
  }
}

function startAnimationLoop() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  function tick(t) {
    if (monitorMode === 'board') {
      renderBoardCanvas(t);
    }
    animFrameId = requestAnimationFrame(tick);
  }
  animFrameId = requestAnimationFrame(tick);
}

startAnimationLoop();

/* =====================================================================
   MONITOR MODE SWITCHING: BOARD VS NEURAL DIAGNOSTIC
   ===================================================================== */
function setMonitorMode(mode) {
  monitorMode = mode;
  const boardEl = $('stage');
  const neuralEl = $('neural-view-container');
  const btn = $('btn-toggle-monitor');

  if (mode === 'neural') {
    if (boardEl) boardEl.style.display = 'none';
    if (neuralEl) neuralEl.style.display = 'flex';
    if (btn) btn.textContent = 'VIEW: BOARD [V]';
    renderNeuralNet();
    drawLossCurve();
  } else {
    if (boardEl) boardEl.style.display = 'flex';
    if (neuralEl) neuralEl.style.display = 'none';
    if (btn) btn.textContent = 'VIEW: NEURAL [V]';
    resizeBoardCanvas();
  }
}

function toggleMonitorMode() {
  setMonitorMode(monitorMode === 'board' ? 'neural' : 'board');
}

/* =====================================================================
   REAL-TIME NEURAL NETWORK TOPOLOGY (SVG)
   ===================================================================== */
function renderNeuralNet() {
  const svg = $('neural-net');
  if (!svg) return;
  svg.replaceChildren();

  const inputLabels = ['←', '↑', '→', '↓', '·'];
  const inputs = 5, hiddens = 6, outputs = 5;
  const inX = 25, hidX = 140, outX = 255;

  const inY = i => 15 + i * 22;
  const hidY = i => 10 + i * 20;
  const outY = i => 15 + i * 22;

  const bestPred = turnPreds[0] || null;
  const dist = bestPred ? bestPred.dist : [0.2, 0.2, 0.2, 0.2, 0.2];

  // Draw Synapses
  for (let i = 0; i < inputs; i++) {
    for (let h = 0; h < hiddens; h++) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', inX);
      line.setAttribute('y1', inY(i));
      line.setAttribute('x2', hidX);
      line.setAttribute('y2', hidY(h));
      const active = (G.last1 === i);
      line.setAttribute('stroke', active ? 'var(--primary)' : 'var(--line-focus)');
      line.setAttribute('stroke-width', active ? '1.6' : '0.6');
      line.setAttribute('stroke-opacity', active ? '0.9' : '0.22');
      svg.appendChild(line);
    }
  }

  for (let h = 0; h < hiddens; h++) {
    for (let o = 0; o < outputs; o++) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', hidX);
      line.setAttribute('y1', hidY(h));
      line.setAttribute('x2', outX);
      line.setAttribute('y2', outY(o));
      const p = dist[o] || 0.2;
      line.setAttribute('stroke', p > 0.35 ? 'var(--primary)' : 'var(--line)');
      line.setAttribute('stroke-width', p > 0.35 ? '1.8' : '0.6');
      line.setAttribute('stroke-opacity', `${Math.max(0.15, p)}`);
      svg.appendChild(line);
    }
  }

  // Draw Nodes
  for (let i = 0; i < inputs; i++) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', inX);
    circle.setAttribute('cy', inY(i));
    circle.setAttribute('r', '5');
    const isCurrent = (G.last1 === i);
    circle.setAttribute('fill', isCurrent ? 'var(--accent)' : 'var(--panel-card)');
    circle.setAttribute('stroke', isCurrent ? 'var(--accent)' : 'var(--line-focus)');
    circle.setAttribute('stroke-width', '1.5');
    svg.appendChild(circle);

    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', inX - 10);
    txt.setAttribute('y', inY(i) + 3);
    txt.setAttribute('font-size', '8');
    txt.setAttribute('fill', 'var(--text-dim)');
    txt.setAttribute('text-anchor', 'end');
    txt.textContent = inputLabels[i];
    svg.appendChild(txt);
  }

  for (let h = 0; h < hiddens; h++) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', hidX);
    circle.setAttribute('cy', hidY(h));
    circle.setAttribute('r', '4');
    circle.setAttribute('fill', 'var(--panel-card)');
    circle.setAttribute('stroke', 'var(--line-focus)');
    circle.setAttribute('stroke-width', '1.2');
    svg.appendChild(circle);
  }

  for (let o = 0; o < outputs; o++) {
    const p = dist[o] || 0.2;
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', outX);
    circle.setAttribute('cy', outY(o));
    circle.setAttribute('r', `${Math.max(3, p * 10)}`);
    circle.setAttribute('fill', p > 0.4 ? 'var(--primary)' : 'var(--panel-card)');
    circle.setAttribute('stroke', 'var(--primary)');
    circle.setAttribute('stroke-width', '1.5');
    svg.appendChild(circle);

    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', outX + 12);
    txt.setAttribute('y', outY(o) + 3);
    txt.setAttribute('font-size', '8');
    txt.setAttribute('fill', p > 0.4 ? 'var(--primary)' : 'var(--text-dim)');
    txt.textContent = `${inputLabels[o]} ${Math.round(p * 100)}%`;
    svg.appendChild(txt);
  }
}

/* =====================================================================
   REAL-TIME EPIPLEXITY LOSS CURVE (CANVAS)
   ===================================================================== */
function drawLossCurve() {
  const canvas = $('loss-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const history = G.lossHistory || [];
  if (!history.length) {
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-dimmer').trim() || '#4d4d5a';
    ctx.font = '10px monospace';
    ctx.fillText('AWAITING TELEMETRY STREAM...', 36, h / 2 + 3);
    return;
  }

  const primaryCol = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#f59e0b';
  const maxLoss = 2.32; // log2(5) bits
  const pts = history.slice(-25);

  const stepX = w / Math.max(1, pts.length - 1);
  const getY = val => h - Math.max(4, Math.min(h - 4, (val / maxLoss) * (h - 10) + 4));

  // Baseline H_max = 2.32
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(0, getY(maxLoss));
  ctx.lineTo(w, getY(maxLoss));
  ctx.stroke();
  ctx.setLineDash([]);

  // Shaded Epiplexity Area S_T (AUC)
  ctx.beginPath();
  ctx.moveTo(0, getY(pts[0]));
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(i * stepX, getY(pts[i]));
  }
  ctx.lineTo((pts.length - 1) * stepX, getY(maxLoss));
  ctx.lineTo(0, getY(maxLoss));
  ctx.closePath();
  ctx.fillStyle = 'rgba(16, 185, 129, 0.22)';
  ctx.fill();

  // Loss curve line
  ctx.strokeStyle = primaryCol;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, getY(pts[0]));
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(i * stepX, getY(pts[i]));
  }
  ctx.stroke();

  // Telemetry updates
  const latestLoss = pts[pts.length - 1] || 2.32;
  const entEl = $('current-entropy');
  if (entEl) entEl.textContent = `${latestLoss.toFixed(2)} b`;
  const epEl = $('current-epiplexity');
  if (epEl) epEl.textContent = `${(G.epiplexity || 0).toFixed(2)} b`;
  const epMeter = $('epiplexity-meter');
  if (epMeter) epMeter.textContent = `S_T: ${(G.epiplexity || 0).toFixed(1)} bits`;
}

/* =====================================================================
   MAIN DRAW & HUD REFRESH
   ===================================================================== */
function drawAll() {
  // Update HUD elements defensively
  const isCrucible = G.mode === 'crucible';
  const statusTag = $('status-tag');
  if (statusTag) {
    statusTag.textContent = isCrucible
      ? `CRUCIBLE [${G.crucibleStage + 1}/5]`
      : `SEC 0${G.sector} · ${G.currentNodeType.toUpperCase()}`;
  }

  const floorEl = $('hud-floor');
  if (floorEl) {
    floorEl.textContent = isCrucible
      ? `0${G.crucibleStage + 1}`
      : (G.floor < 10 ? `0${G.floor}` : G.floor);
  }

  const hullEl = $('hud-hull');
  if (hullEl) {
    const hp = Math.max(0, G.player.hp);
    const maxHp = G.player.maxHp;
    hullEl.textContent = '♥'.repeat(hp) + '♡'.repeat(Math.max(0, maxHp - hp));
  }

  const lp = legPct();
  const legEl = $('hud-leg');
  if (legEl) legEl.textContent = lp !== null ? `${lp}%` : '—';

  const fit = Core.accuracy();
  const fitEl = $('hud-fit');
  if (fitEl) fitEl.textContent = fit !== null ? `${fit}%` : '—';

  const entHud = $('hud-ent');
  if (entHud) entHud.textContent = `◇${G.player.ent}`;

  const protoEl = $('hud-protocol');
  if (protoEl) protoEl.textContent = (G.protocol || 'CARDINAL').toUpperCase();

  renderNeuralNet();
  drawLossCurve();
}

function say(msg) {
  if (!msg || msg === lastLogText) return;
  const logNew = $('log-new');
  const logOld = $('log-old');
  if (logNew && logOld) {
    logOld.textContent = logNew.textContent;
    logNew.textContent = msg;
  }
  lastLogText = msg;
  cliPrint(msg, 'daemon');
}

/* =====================================================================
   INTEGRATED WORKSTATION TERMINAL (A-9)
   ===================================================================== */
function openCli() {
  const win = $('cli-modal');
  if (win) win.classList.add('open');
  const inp = $('cli-input');
  if (inp) inp.focus();
}

function closeCli() {
  const win = $('cli-modal');
  if (win) win.classList.remove('open');
}

function toggleCli() {
  const win = $('cli-modal');
  if (win) {
    if (win.classList.contains('open')) closeCli();
    else openCli();
  }
}

function cliPrint(text, type = 'normal') {
  const out = $('cli-output');
  if (!out) return;
  const line = document.createElement('div');
  line.className = `cli-line ${type}`;
  line.textContent = text;
  out.appendChild(line);
  out.scrollTop = out.scrollHeight;
}

function execCli(cmd) {
  const clean = cmd.trim().toLowerCase();
  cliPrint(`> ${cmd}`, 'user');

  const parts = clean.split(/\s+/);
  const action = parts[0];

  if (action === 'help') {
    cliPrint('OPERATOR DIRECTORY:', 'system');
    cliPrint('  nn / model / loss  : Toggle Neural Diagnostic Suite', 'accent');
    cliPrint('  map / sectors      : Open FTL Sector Route Map', 'accent');
    cliPrint('  weights            : Dump Markov counts & logits', 'accent');
    cliPrint('  hopfield           : View associative memory size', 'accent');
    cliPrint('  epiplexity         : View S_T vs H_T bits breakdown', 'accent');
    cliPrint('  theme <name>       : Switch phosphor palette (oled, green, cyan, light)', 'accent');
    cliPrint('  protocol           : Toggle Cardinal / Knight protocol', 'accent');
    cliPrint('  clear              : Clear console output', 'accent');
  } else if (action === 'nn' || action === 'model' || action === 'loss') {
    toggleMonitorMode();
    cliPrint(`Monitor mode set to ${monitorMode.toUpperCase()}.`, 'system');
  } else if (action === 'theme') {
    if (parts[1]) {
      setTheme(parts[1]);
      cliPrint(`Phosphor palette set to ${parts[1].toUpperCase()}.`, 'system');
    } else {
      cycleTheme();
    }
  } else if (action === 'weights') {
    cliPrint('TRANSITION LOGITS (ORDER-0):', 'system');
    cliPrint(`  ←:${Core.c0[0]}  ↑:${Core.c0[1]}  →:${Core.c0[2]}  ↓:${Core.c0[3]}  ·:${Core.c0[4]}`, 'daemon');
  } else if (action === 'hopfield') {
    cliPrint(`ASSOCIATIVE MEMORY: ${HopfieldMemory.keys.length} / ${HopfieldMemory.capacity} episodic trajectory patterns`, 'system');
  } else if (action === 'epiplexity') {
    cliPrint(`EPIPLEXITY (S_T): ${(G.epiplexity || 0).toFixed(3)} bits (Structural memory extracted)`, 'system');
    cliPrint(`TIME-BOUNDED ENTROPY (H_T): ${((G.lossHistory && G.lossHistory.slice(-1)[0]) || 2.32).toFixed(3)} bits`, 'system');
  } else if (action === 'protocol' || action === 'knight') {
    if (G.hasKnight) {
      G.protocol = G.protocol === 'knight' ? 'cardinal' : 'knight';
      say(`MOVEMENT PROTOCOL: ${G.protocol.toUpperCase()}.`);
      drawAll();
    } else {
      cliPrint('ERROR: KNIGHT PROTOCOL NOT INSTALLED. REACH TRUST GATE (GOLD TIER).', 'error');
    }
  } else if (action === 'sectors' || action === 'map') {
    openSectorMap();
  } else if (action === 'clear') {
    const out = $('cli-output');
    if (out) out.replaceChildren();
  } else {
    cliPrint(`UNKNOWN COMMAND: '${action}'. TYPE 'help' FOR DIRECTORY.`, 'error');
  }
}

/* =====================================================================
   INTERACTIVE FTL SECTOR NAVIGATION MAP
   ===================================================================== */
let selectedMapNodeId = null;

function openSectorMap() {
  const overlay = $('sector-overlay');
  const container = $('sector-nodes-container');
  const titleEl = $('sector-modal-title');
  const descEl = $('sector-modal-desc');
  if (!overlay || !container || !G.sectorMap) return;

  const currentSectorInfo = SECTORS_DEF[G.sector - 1];
  if (titleEl) titleEl.textContent = `SECTOR 0${G.sector} // ${currentSectorInfo.name}`;
  if (descEl) descEl.textContent = `${currentSectorInfo.faction} — ${currentSectorInfo.desc}`;

  container.replaceChildren();

  // Render layers in a horizontal DAG flex layout
  const mapGrid = document.createElement('div');
  mapGrid.className = 'sector-map-grid';

  G.sectorMap.layers.forEach((layer, depth) => {
    const col = document.createElement('div');
    col.className = 'sector-col';

    const colHeader = document.createElement('div');
    colHeader.className = 'sector-col-header';
    colHeader.textContent = depth === 0 ? 'START' : (depth === 3 ? 'GATE' : `DEPTH 0${depth}`);
    col.appendChild(colHeader);

    layer.forEach(node => {
      const isCurrent = node.id === G.currentNodeId;
      const card = document.createElement('div');
      card.className = `sector-node-card ${node.type} ${node.cleared ? 'cleared' : ''} ${node.available ? 'available' : ''} ${isCurrent ? 'current' : ''}`;
      if (selectedMapNodeId === node.id) card.classList.add('selected');

      card.innerHTML = `
        <div class="node-icon">${NODE_TYPES[node.type].icon}</div>
        <div class="node-name">${node.name}</div>
        <div class="node-threat">${node.threat}</div>
      `;

      card.onclick = () => {
        if (!node.available && !isCurrent) return;
        selectedMapNodeId = node.id;
        document.querySelectorAll('.sector-node-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        const detailEl = $('sector-detail-brief');
        if (detailEl) {
          detailEl.innerHTML = `<b>${node.name}</b> [${node.threat} THREAT]<br>${node.desc}`;
        }
      };

      col.appendChild(card);
    });

    mapGrid.appendChild(col);
  });

  container.appendChild(mapGrid);

  const confirmBtn = $('btn-transit');
  if (confirmBtn) {
    confirmBtn.onclick = () => {
      if (selectedMapNodeId) {
        selectSectorNode(selectedMapNodeId);
      }
    };
  }

  overlay.classList.add('active');
}

function closeSectorMap() {
  const overlay = $('sector-overlay');
  if (overlay) overlay.classList.remove('active');
}

/* =====================================================================
   GENERIC MODAL DIALOGS
   ===================================================================== */
function showModal(title, type, bodyHtml, btnText, onAction, secondaryBtnText = null, onSecondary = null) {
  const overlay = $('modal-overlay');
  const h2 = $('modal-title');
  const p = $('modal-body');
  const btn = $('btn-primary');
  const secBtn = $('btn-secondary');

  h2.textContent = title;
  h2.className = type || '';
  p.innerHTML = bodyHtml;
  btn.textContent = btnText || 'PROCEED';

  btn.onclick = () => {
    hideModal();
    if (onAction) onAction();
  };

  if (secondaryBtnText) {
    secBtn.style.display = 'inline-block';
    secBtn.textContent = secondaryBtnText;
    secBtn.onclick = () => {
      hideModal();
      if (onSecondary) onSecondary();
    };
  } else {
    secBtn.style.display = 'none';
  }

  overlay.classList.add('active');
}

function hideModal() {
  const overlay = $('modal-overlay');
  if (overlay) overlay.classList.remove('active');
}

window.addEventListener('resize', () => {
  resizeBoardCanvas();
  drawLossCurve();
});
