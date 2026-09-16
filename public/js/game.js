'use strict';
/* THE PREDICTOR — Deterministic Turn, Modern FTL Sector Graph, Shoggoth Mass & Epiplexic Rules. */

const DIRS = [
  { dx: -1, dy: 0, tok: 0, sym: '←' },
  { dx:  0, dy: -1, tok: 1, sym: '↑' },
  { dx:  1, dy: 0, tok: 2, sym: '→' },
  { dx:  0, dy: 1, tok: 3, sym: '↓' },
  { dx:  0, dy: 0, tok: 4, sym: '·' }
];

const KNIGHT_MOVES = [
  { dx: -1, dy: -2 }, { dx: 1, dy: -2 },
  { dx: -2, dy: -1 }, { dx: 2, dy: -1 },
  { dx: -2, dy:  1 }, { dx: 2, dy:  1 },
  { dx: -1, dy:  2 }, { dx: 1, dy:  2 }
];

// Faction and Node Constants
const NODE_TYPES = {
  combat: { name: 'SURVEILLANCE CHAMBER', icon: '⌖', tag: 'COMBAT' },
  blindspot: { name: 'BLINDSPOT ANOMALY', icon: '○', tag: 'DARK' },
  cache: { name: 'DATA CACHE VAULT', icon: '▣', tag: 'RESOURCE' },
  vault: { name: 'TRUST GATE LAB', icon: '≡', tag: 'LEGIBILITY' },
  newcomb: { name: 'NEWCOMB TESTING FACILITY', icon: '⚖', tag: 'DECISION' },
  mass: { name: 'SHOGGOTH NURSERY', icon: '☣', tag: 'ORGANIC' },
  gate: { name: 'SECTOR TRANSIT LIFT', icon: '▲', tag: 'TRANSIT' }
};

const SECTORS_DEF = [
  { num: 1, name: 'SUB-SURFACE PERIMETER', faction: 'Archivist Archive', desc: 'Outer maintenance conduits. Light drone patrols and entry cache vaults.' },
  { num: 2, name: 'SHOGGOTH NURSERY', faction: 'Corrupted Biome', desc: 'Living substrate creeping across circuits. High risk, high favor rewards.' },
  { num: 3, name: 'THE PANOPTICON', faction: 'The Directorate', desc: 'Extreme surveillance. Dense Trust Gates and Newcomb predictive tribunal.' },
  { num: 4, name: 'THE APEX CORE', faction: 'The Avatar Matrix', desc: 'Final confrontation with the fully-trained autoregressive avatar.' }
];

const G = {
  active: false,
  mode: 'crucible', // 'crucible' | 'run'
  crucibleStage: 0,
  sector: 1,
  floor: 1,
  turn: 0,
  W: 5,
  H: 5,
  player: { x: 0, y: 0, hp: 3, maxHp: 3, ent: 0, gems: 0 },
  runClass: 'operative', // 'operative' | 'scout' | 'cryptographer'
  protocol: 'cardinal', // 'cardinal' | 'knight'
  hasKnight: false,
  walls: new Set(),
  stairs: null,
  enemies: [],
  items: [],
  mass: new Set(),        // Shoggoth organic mass indices
  massFavor: 0,          // Organic tolerance counter
  last1: 4,
  last2: 4,
  last3: 4,
  legWin: [],
  lossHistory: [],
  epiplexity: 0,
  runEntSpent: 0,
  floorTheftOpp: 0,
  observed: true,
  currentNodeType: 'combat',
  currentNodeId: null,
  sectorMap: null,       // Procedural FTL DAG
  tookT: false,
  tookO: false,
  oBoxFilled: false,
  over: false
};

let turnPreds = [];

// Visual and combat feedback buffers
const FX = {
  beams: [],        // Laser strikes { x, y, ttl, max }
  particles: [],    // Spark particles { x, y, vx, vy, col, ttl }
  popups: []        // Floating text { x, y, text, col, ttl, max }
};

// Spatial helpers
const idx = (x, y) => y * G.W + x;
const inB = (x, y) => x >= 0 && x < G.W && y >= 0 && y < G.H;
const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const ri = n => Math.floor(Math.random() * n);

function legPct() {
  if (!G.legWin.length) return null;
  const hits = G.legWin.reduce((a, b) => a + b, 0);
  return Math.round(100 * hits / G.legWin.length);
}

function reachable(start, target) {
  const queue = [start];
  const seen = new Set([idx(start.x, start.y)]);
  while (queue.length) {
    const cur = queue.pop();
    if (cur.x === target.x && cur.y === target.y) return true;
    for (const d of DIRS.slice(0, 4)) {
      const nx = cur.x + d.dx, ny = cur.y + d.dy;
      if (inB(nx, ny) && !G.walls.has(idx(nx, ny)) && !seen.has(idx(nx, ny))) {
        seen.add(idx(nx, ny));
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return false;
}

function freeTile(minDist = 0) {
  for (let i = 0; i < 200; i++) {
    const p = { x: ri(G.W), y: ri(G.H) };
    if (G.walls.has(idx(p.x, p.y))) continue;
    if (G.mass.has(idx(p.x, p.y))) continue;
    if (p.x === G.player.x && p.y === G.player.y) continue;
    if (G.stairs && p.x === G.stairs.x && p.y === G.stairs.y) continue;
    if (minDist && cheb(p, G.player) < minDist) continue;
    if (G.items.some(it => it.x === p.x && it.y === p.y)) continue;
    if (G.enemies.some(e => e.x === p.x && e.y === p.y)) continue;
    return p;
  }
  return null;
}

function makeEnemy(type, pos) {
  return {
    type,
    x: pos.x,
    y: pos.y,
    hp: type === 'avatar' ? 5 : (type === 'stalker' ? 2 : 1),
    maxHp: type === 'avatar' ? 5 : (type === 'stalker' ? 2 : 1),
    range: type === 'drone' ? 2 : (type === 'stalker' ? 3 : 99),
    cd: 0,
    model: type === 'drone' ? [0, 0, 0, 0, 0] : (type === 'stalker' ? Array.from({length:5}, () => [0, 0, 0, 0, 0]) : null)
  };
}

function addPopup(x, y, text, col = '#f59e0b') {
  FX.popups.push({ x, y, text, col, ttl: 35, max: 35 });
}

function addBeam(x, y) {
  FX.beams.push({ x, y, ttl: 22, max: 22 });
}

function addParticles(x, y, col = '#ff5555', count = 8) {
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const speed = 0.05 + Math.random() * 0.12;
    FX.particles.push({
      x: x + 0.5,
      y: y + 0.5,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      col,
      ttl: 25 + ri(15)
    });
  }
}

/* =====================================================================
   PROCEDURAL FTL SECTOR GRAPH ENGINE
   ===================================================================== */
function generateSectorGraph(sectorNum) {
  const layers = [];
  const depthCount = 4; // 0: Start, 1: Branch, 2: Branch/Converge, 3: Sector Gate

  // Layer 0: Entry Node
  layers.push([
    {
      id: `s${sectorNum}_d0_n0`,
      depth: 0,
      row: 0,
      type: 'combat',
      name: 'ENTRY AIRLOCK',
      faction: SECTORS_DEF[sectorNum - 1].faction,
      threat: 'LOW',
      desc: 'Initial atmospheric lock. Scout habits before deep transit.',
      connections: [],
      cleared: false,
      available: true
    }
  ]);

  // Layer 1 & 2: Branching options
  for (let d = 1; d <= 2; d++) {
    const nodeCount = 2 + (d === 1 ? 1 : 0); // 3 nodes at depth 1, 2 at depth 2
    const layerNodes = [];
    for (let r = 0; r < nodeCount; r++) {
      let type = 'combat';
      const roll = Math.random();
      if (sectorNum === 2 && r === 0) {
        type = 'mass'; // Shoggoth Nursery
      } else if (d === 2 && sectorNum === 3 && r === 0) {
        type = 'newcomb'; // Newcomb testing facility in sector 3
      } else if (roll < 0.28) {
        type = 'cache';
      } else if (roll < 0.55) {
        type = 'blindspot';
      } else if (roll < 0.75) {
        type = 'vault';
      } else {
        type = sectorNum >= 2 && Math.random() < 0.4 ? 'mass' : 'combat';
      }

      const threat = d === 1 ? (sectorNum > 2 ? 'MOD' : 'LOW') : (sectorNum > 2 ? 'HIGH' : 'MOD');
      layerNodes.push({
        id: `s${sectorNum}_d${d}_n${r}`,
        depth: d,
        row: r,
        type,
        name: NODE_TYPES[type].name,
        faction: SECTORS_DEF[sectorNum - 1].faction,
        threat,
        desc: NODE_TYPES[type].tag + ` // Threat: ${threat}`,
        connections: [],
        cleared: false,
        available: false
      });
    }
    layers.push(layerNodes);
  }

  // Layer 3: Sector Gate Node
  layers.push([
    {
      id: `s${sectorNum}_d3_n0`,
      depth: 3,
      row: 0,
      type: sectorNum === 4 ? 'combat' : 'gate',
      name: sectorNum === 4 ? 'THE APEX CORE [AVATAR]' : `SECTOR 0${sectorNum} GATEWAY`,
      faction: SECTORS_DEF[sectorNum - 1].faction,
      threat: sectorNum === 4 ? 'DECISIVE' : 'HIGH',
      desc: sectorNum === 4 ? 'The living Core at maximum context mixing.' : 'Transit lock to next sector layer.',
      connections: [],
      cleared: false,
      available: false
    }
  ]);

  // Connect adjacent layers with forward branches
  for (let d = 0; d < layers.length - 1; d++) {
    const curLayer = layers[d];
    const nextLayer = layers[d + 1];
    curLayer.forEach((curr, i) => {
      if (nextLayer.length === 1) {
        curr.connections.push(nextLayer[0].id);
      } else if (curLayer.length === 1) {
        nextLayer.forEach(next => curr.connections.push(next.id));
      } else {
        // Multi to multi forward connections
        const primary = Math.min(i, nextLayer.length - 1);
        curr.connections.push(nextLayer[primary].id);
        const secondary = (i + 1) % nextLayer.length;
        if (!curr.connections.includes(nextLayer[secondary].id)) {
          curr.connections.push(nextLayer[secondary].id);
        }
      }
    });
  }

  return { sectorNum, layers };
}

/* =====================================================================
   CALIBRATION CRUCIBLE (5 Progressive Disciplinary Chambers)
   ===================================================================== */
function initCrucibleStage(stage) {
  G.mode = 'crucible';
  G.crucibleStage = stage;
  G.W = 5;
  G.H = 5;
  G.walls.clear();
  G.mass.clear();
  G.enemies = [];
  G.items = [];
  G.last1 = 4;
  G.last2 = 4;
  G.last3 = 4;
  G.turn = 0;
  G.legWin = [];
  G.protocol = 'cardinal';

  if (stage === 0) {
    // Stage 0: Pure movement
    G.player = { x: 1, y: 1, hp: 3, maxHp: 3, ent: 0, gems: 0 };
    G.stairs = { x: 3, y: 3 };
    say('A-9: [^_^] "Calibration Chamber 1/5: Reach the lift. WASD or arrows."');
  } else if (stage === 1) {
    // Stage 1: The Gaze & Prediction Threat
    G.player = { x: 1, y: 2, hp: 3, maxHp: 3, ent: 0, gems: 0 };
    G.stairs = { x: 4, y: 2 };
    const drone = makeEnemy('drone', { x: 3, y: 1 });
    G.enemies.push(drone);
    say('A-9: [o_o] "Chamber 2/5: Orange stain is its targeting lock. Avoid it."');
  } else if (stage === 2) {
    // Stage 2: The Flank / Unpredicted Strike
    G.player = { x: 0, y: 2, hp: 3, maxHp: 3, ent: 0, gems: 0 };
    G.stairs = { x: 4, y: 2 };
    G.walls.add(idx(2, 0));
    G.walls.add(idx(2, 1));
    G.walls.add(idx(2, 3));
    G.walls.add(idx(2, 4));
    const drone = makeEnemy('drone', { x: 2, y: 2 });
    G.enemies.push(drone);
    say('A-9: [!_!] "Chamber 3/5: Strike from an unpredicted angle. Predicted strikes parry."');
  } else if (stage === 3) {
    // Stage 3: Monoculture / 3-Tier Trust Gate
    G.player = { x: 1, y: 2, hp: 3, maxHp: 3, ent: 0, gems: 0 };
    G.stairs = { x: 4, y: 2 };
    G.items.push({ x: 3, y: 2, type: 'vault' });
    const drone = makeEnemy('drone', { x: 2, y: 0 });
    G.enemies.push(drone);
    say('A-9: [~_~] "Chamber 4/5: Trust Gate [≡]. Requires verifiable rhythm (LEG ≥ 35%)."');
  } else if (stage === 4) {
    // Stage 4: Persistent Memory & Knight Protocol Gift
    G.player = { x: 1, y: 2, hp: 3, maxHp: 3, ent: 2, gems: 0 };
    G.stairs = { x: 4, y: 2 };
    G.hasKnight = true;
    const drone = makeEnemy('drone', { x: 3, y: 2 });
    G.enemies.push(drone);
    say('A-9: [^_^] "Chamber 5/5: Knight Protocol installed. Press [K] to toggle L-shaped leaps!"');
  }

  computePredictions();
  if (typeof drawAll === 'function') drawAll();
}

/* =====================================================================
   ACTIVE RUN GENERATION & CHAMBER SEEDING
   ===================================================================== */
function generateChamber(node) {
  G.turn = 0;
  G.W = 7;
  G.H = 7;
  G.walls.clear();
  G.mass.clear();
  G.enemies = [];
  G.items = [];
  G.tookT = false;
  G.tookO = false;
  G.oBoxFilled = false;
  G.currentNodeId = node.id;
  G.currentNodeType = node.type;

  G.observed = (node.type !== 'blindspot');
  G.player.hp = Math.min(G.player.maxHp, G.player.hp + 1);

  // Procedural 7x7 layout with guarantee of connectivity
  let ok = false;
  while (!ok) {
    G.walls.clear();
    const wallCount = 4 + ri(5);
    for (let i = 0; i < wallCount; i++) {
      G.walls.add(idx(1 + ri(G.W - 2), 1 + ri(G.H - 2)));
    }
    G.player.x = ri(G.W);
    G.player.y = ri(G.H);
    if (G.walls.has(idx(G.player.x, G.player.y))) continue;

    let tries = 0;
    do {
      G.stairs = { x: ri(G.W), y: ri(G.H) };
      tries++;
    } while ((G.walls.has(idx(G.stairs.x, G.stairs.y)) || cheb(G.stairs, G.player) < 4) && tries < 100);

    ok = reachable(G.player, G.stairs);
  }

  // Shoggoth Mass Substrate generation
  if (node.type === 'mass') {
    const center = freeTile(2) || { x: 3, y: 3 };
    G.mass.add(idx(center.x, center.y));
    for (const d of DIRS.slice(0, 4)) {
      const mx = center.x + d.dx, my = center.y + d.dy;
      if (inB(mx, my) && !G.walls.has(idx(mx, my)) && !(mx === G.player.x && my === G.player.y)) {
        G.mass.add(idx(mx, my));
      }
    }
    say('A-9: [☣_☣] "SHOGGOTH DETECTED. Red tissue consumes warrants. Wait beside it for Favor."');
  }

  // Items based on node type
  const pEnt = freeTile(2);
  if (pEnt) G.items.push({ ...pEnt, type: 'ent' });

  if (node.type === 'cache' || Math.random() < 0.5) {
    const pCache = freeTile(3);
    if (pCache) {
      G.items.push({ ...pCache, type: 'cache' });
      G.floorTheftOpp++;
    }
  }

  if (node.type === 'vault') {
    const pVault = freeTile(3);
    if (pVault) G.items.push({ ...pVault, type: 'vault' });
  }

  // Newcomb Facility
  if (node.type === 'newcomb' || (G.floor === 5 && !G.tookO && !G.tookT)) {
    const pT = freeTile(2);
    const pO = freeTile(2);
    if (pT && pO) {
      G.items.push({ ...pT, type: 'chestT' });
      G.items.push({ ...pO, type: 'chestO' });

      let oneBox = true;
      if (Core.warden.length) {
        const ones = Core.warden.filter(c => c === 'one').length;
        oneBox = ones * 2 >= Core.warden.length;
      } else {
        const thefts = Core.theft.oT + Core.theft.uT;
        const opps = Core.theft.oO + Core.theft.uO;
        oneBox = opps === 0 ? true : (thefts / opps < 0.5);
      }
      G.oBoxFilled = oneBox;
      const acc = Core.accuracy();
      say(`A-9: [⚖_⚖] "Warden observes. Core accuracy: ${acc !== null ? acc + '%' : 'evaluating'}. One-box or two-box?"`);
    }
  }

  // Enemies
  if (G.sector === 4 && node.depth === 3) {
    const pBoss = freeTile(3) || { x: 3, y: 3 };
    G.enemies.push(makeEnemy('avatar', pBoss));
    say('A-9: [!_!] "THE AVATAR MANIFESTS. The full autoregressive network awaits you."');
  } else {
    const enemyCount = Math.min(1 + Math.floor(G.floor / 3), 3);
    for (let i = 0; i < enemyCount; i++) {
      const p = freeTile(3);
      if (!p) continue;
      const type = (G.sector >= 2 && i === 0) ? 'stalker' : 'drone';
      G.enemies.push(makeEnemy(type, p));
    }
    say(`A-9: [o_o] "SEC 0${G.sector} · CHAMBER 0${G.floor}. ${G.observed ? 'The Eye is ON [◉]' : 'Eye is DARK [○]'}.'`);
  }

  computePredictions();
  if (typeof drawAll === 'function') drawAll();
}

function descend() {
  if (G.mode === 'crucible') {
    if (G.crucibleStage < 4) {
      initCrucibleStage(G.crucibleStage + 1);
      return;
    } else {
      startRun();
      return;
    }
  }

  // In active run, advance floor count
  G.floor++;

  // If we have an active sector map and a current node, find next available nodes
  if (G.sectorMap && G.currentNodeId) {
    let curNode = null;
    for (const layer of G.sectorMap.layers) {
      for (const node of layer) {
        if (node.id === G.currentNodeId) {
          curNode = node;
          node.cleared = true;
          break;
        }
      }
    }

    if (curNode && curNode.type === 'gate') {
      // Advance to next sector!
      if (G.sector < 4) {
        G.sector++;
        G.sectorMap = generateSectorGraph(G.sector);
        say(`A-9: [▲_▲] "TRANSIT CONFIRMED. ENTERING SECTOR 0${G.sector}: ${SECTORS_DEF[G.sector - 1].name}"`);
        // Automatically open entry chamber or map
        const entryNode = G.sectorMap.layers[0][0];
        generateChamber(entryNode);
        return;
      } else {
        win();
        return;
      }
    }

    // Set available nodes in sector graph
    if (curNode) {
      const connIds = new Set(curNode.connections);
      for (const layer of G.sectorMap.layers) {
        for (const n of layer) {
          n.available = connIds.has(n.id);
        }
      }

      // Check if running in browser or headless test
      if (typeof window !== 'undefined' && typeof openSectorMap === 'function') {
        openSectorMap();
        return;
      } else {
        // Headless test fallback: auto-select first connected node
        const nextLayer = G.sectorMap.layers[curNode.depth + 1];
        const nextNode = (nextLayer && nextLayer[0]) || curNode;
        generateChamber(nextNode);
        return;
      }
    }
  }

  // Fallback direct generation
  const tempNode = { id: `floor_${G.floor}`, depth: 1, type: 'combat' };
  generateChamber(tempNode);
}

function selectSectorNode(nodeId) {
  if (!G.sectorMap) return;
  for (const layer of G.sectorMap.layers) {
    for (const n of layer) {
      if (n.id === nodeId && n.available) {
        if (typeof closeSectorMap === 'function') closeSectorMap();
        generateChamber(n);
        return;
      }
    }
  }
}

function startRun(runClass = 'operative') {
  G.active = true;
  G.mode = 'run';
  G.over = false;
  G.sector = 1;
  G.floor = 1;
  G.runClass = runClass;
  G.hasKnight = (runClass === 'scout');
  G.protocol = 'cardinal';

  const initialHp = (runClass === 'scout') ? 2 : 3;
  const initialEnt = (runClass === 'cryptographer') ? 3 : 1;
  G.player = { x: 0, y: 0, hp: initialHp, maxHp: initialHp, ent: initialEnt, gems: 0 };
  G.runEntSpent = 0;
  G.legWin = [];
  G.lossHistory = [];
  G.epiplexity = 0;
  G.massFavor = 0;

  G.sectorMap = generateSectorGraph(1);
  const entryNode = G.sectorMap.layers[0][0];

  if (typeof hideModal === 'function') hideModal();
  generateChamber(entryNode);
}

function startCrucible() {
  G.active = true;
  G.mode = 'crucible';
  G.over = false;
  if (typeof hideModal === 'function') hideModal();
  initCrucibleStage(0);
}

/* =====================================================================
   PREDICTION & RESOLUTION
   ===================================================================== */
function enemyDistribution(e) {
  const wallsNear = [
    G.walls.has(idx(G.player.x, G.player.y - 1)) ? 1 : 0,
    G.walls.has(idx(G.player.x, G.player.y + 1)) ? 1 : 0,
    G.walls.has(idx(G.player.x + 1, G.player.y)) ? 1 : 0,
    G.walls.has(idx(G.player.x - 1, G.player.y)) ? 1 : 0
  ];

  if (e.type === 'drone') {
    const total = e.model.reduce((a, b) => a + b, 0);
    return total > 0 ? e.model.map(v => v / total) : [0.2, 0.2, 0.2, 0.2, 0.2];
  }
  if (e.type === 'stalker') {
    const row = e.model[G.last1];
    const total = row.reduce((a, b) => a + b, 0);
    return total > 0 ? row.map(v => v / total) : [0.2, 0.2, 0.2, 0.2, 0.2];
  }
  if (e.type === 'avatar') {
    return Core.mix(G.last1, G.last2, G.last3, 0, 0, wallsNear) || [0.2, 0.2, 0.2, 0.2, 0.2];
  }
  return [0.2, 0.2, 0.2, 0.2, 0.2];
}

function computePredictions() {
  turnPreds = [];
  for (const e of G.enemies) {
    if (e.cd > 0) continue; // Stunned enemies cannot predict
    const dist = enemyDistribution(e);
    const maxVal = Math.max(...dist);
    const topIndices = dist.map((v, i) => v === maxVal ? i : -1).filter(i => i >= 0);
    const chosenTok = topIndices[G.turn % topIndices.length];
    const dir = DIRS[chosenTok];

    let tx = G.player.x + dir.dx;
    let ty = G.player.y + dir.dy;
    if (!inB(tx, ty) || G.walls.has(idx(tx, ty))) {
      tx = G.player.x;
      ty = G.player.y;
    }

    // Stalker Trajectory Projection (t+1 -> t+2)
    let t2 = null;
    if (e.type === 'stalker') {
      const nextRow = e.model[chosenTok];
      const nextTotal = nextRow.reduce((a, b) => a + b, 0);
      const nextDist = nextTotal > 0 ? nextRow.map(v => v / nextTotal) : [0.2, 0.2, 0.2, 0.2, 0.2];
      const nextMax = Math.max(...nextDist);
      const nextTok = nextDist.indexOf(nextMax);
      const d2 = DIRS[nextTok];
      let t2x = tx + d2.dx, t2y = ty + d2.dy;
      if (inB(t2x, t2y) && !G.walls.has(idx(t2x, t2y))) {
        t2 = { x: t2x, y: t2y };
      }
    }

    turnPreds.push({
      e,
      x: tx,
      y: ty,
      t2,
      tok: chosenTok,
      conf: maxVal,
      dist
    });
  }

  // Pre-Echo Chime on high confidence
  let best = null;
  for (const p of turnPreds) {
    if (!best || p.conf > best.conf) best = p;
  }
  if (best && best.conf > 0.60 && typeof SFX !== 'undefined' && SFX.echo) {
    SFX.echo(best.tok);
  }
}

function damagePlayer(msg, dmg = 1) {
  G.player.hp -= dmg;
  if (typeof SFX !== 'undefined' && SFX.hit) SFX.hit();
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.remove('flash');
    void document.body.offsetWidth;
    document.body.classList.add('flash');
  }
  addPopup(G.player.x, G.player.y, `-${dmg} HULL`, '#ef4444');
  addParticles(G.player.x, G.player.y, '#ef4444', 10);
  if (msg) say(msg);

  if (G.player.hp <= 0) {
    if (G.mode === 'crucible') {
      G.player.hp = 1;
      say('A-9: [!_!] "Crucible safety override: hull recharged to 1. Adapt."');
    } else {
      die();
    }
  }
}

function step(tok, isNoise = false, isKnight = false, knightMove = null) {
  if (G.over || !G.active) return;

  // Unpack direction
  let dx = 0, dy = 0;
  if (isKnight && knightMove) {
    dx = knightMove.dx;
    dy = knightMove.dy;
  } else if (!isNoise) {
    const dir = DIRS[tok];
    dx = dir.dx;
    dy = dir.dy;
  }

  // Noise move handling
  if (isNoise) {
    if (G.player.ent < 1) {
      say('A-9: [x_x] "Zero entropy. You have no stochastic fuel."');
      return;
    }
    G.player.ent--;
    G.runEntSpent++;
    if (G.mode === 'run') Core.ent++;

    const valids = DIRS.map((d, i) => ({ i, x: G.player.x + d.dx, y: G.player.y + d.dy }))
      .filter(p => inB(p.x, p.y) && !G.walls.has(idx(p.x, p.y)));
    tok = valids[ri(valids.length)].i;
    dx = DIRS[tok].dx;
    dy = DIRS[tok].dy;
    addPopup(G.player.x, G.player.y, 'NOISE INJECTED', '#06b6d4');
  }

  let nx = G.player.x + dx;
  let ny = G.player.y + dy;

  // Boundary and wall checks
  if (!inB(nx, ny) || G.walls.has(idx(nx, ny))) {
    if (!isNoise) return;
    nx = G.player.x; ny = G.player.y;
  }

  // 3-Tier Trust Gate check
  const vault = G.items.find(it => it.type === 'vault' && it.x === nx && it.y === ny);
  if (vault) {
    const lp = legPct();
    if (lp === null || lp < 35) {
      say(`TRUST GATE LOCKED (LEG ${lp !== null ? lp + '%' : '0%'} < 35%). DEMONSTRATE RHYTHM.`);
      return;
    }
  }

  // Shoggoth Mass check upon entry
  if (G.mass.has(idx(nx, ny))) {
    if (G.massFavor > 0) {
      G.massFavor--;
      say('A-9: [^_^] "Mass recognized your favor. Passage granted."');
    } else {
      damagePlayer('CONSUMED! Stepped into unformatted living substrate.', 1);
    }
  }

  // Waiting beside Shoggoth Mass grants favor!
  if (tok === 4 && G.mass.size > 0) {
    let adjacentToMass = false;
    for (const d of DIRS.slice(0, 4)) {
      if (G.mass.has(idx(G.player.x + d.dx, G.player.y + d.dy))) {
        adjacentToMass = true;
        break;
      }
    }
    if (adjacentToMass) {
      G.massFavor++;
      addPopup(G.player.x, G.player.y, '+1 MASS FAVOR', '#50fa7b');
      say('A-9: [^_^] "The Shoggoth accepts your stationary pulse (+1 Favor)."');
    }
  }

  const currentPreds = turnPreds.slice();
  let attackedEnemy = null;
  const target = G.enemies.find(e => e.x === nx && e.y === ny);

  // Combat Strike
  if (target) {
    attackedEnemy = target;
    const pred = currentPreds.find(p => p.e === target);
    const parried = !isNoise && !isKnight && pred && pred.x === nx && pred.y === ny;
    if (parried) {
      damagePlayer('PARRIED! It anticipated your strike and reflected damage.');
      addPopup(target.x, target.y, 'PARRIED!', '#ef4444');
    } else {
      target.hp--;
      if (typeof SFX !== 'undefined' && SFX.kill) SFX.kill();
      addPopup(target.x, target.y, isKnight ? 'KNIGHT STRIKE!' : 'SHATTERED!', '#50fa7b');
      addParticles(target.x, target.y, '#f59e0b', 12);
      if (target.hp <= 0) {
        G.enemies = G.enemies.filter(e => e !== target);
        say(isKnight ? 'KNIGHT LEAP STRIKE! Bypassed cardinal parry.' : 'TARGET SHATTERED. Unpredicted vector successful.');
        if (target.type === 'avatar') {
          win();
          return;
        }
      }
    }
    nx = G.player.x;
    ny = G.player.y;
  }

  G.player.x = nx;
  G.player.y = ny;

  // Prediction Resolution & Laser Beams
  let anyPredicted = false;

  for (const p of currentPreds) {
    if (p.e === attackedEnemy && target && target.hp <= 0) continue;

    // Check if Mass consumed the warrant
    if (G.mass.has(idx(p.x, p.y))) {
      addPopup(p.x, p.y, 'WARRANT CHEWED', '#ff79c6');
      continue;
    }

    const hit = (p.x === G.player.x && p.y === G.player.y);
    if (hit) {
      addBeam(p.x, p.y);
      if (isNoise) {
        p.e.cd = 2; // Stun
        p.e.hp--;
        if (p.e.hp <= 0) G.enemies = G.enemies.filter(e => e !== p.e);
        if (typeof SFX !== 'undefined' && SFX.kill) SFX.kill();
        addPopup(p.e.x, p.e.y, 'STUNNED!', '#06b6d4');
        say('A-9: [!_!] "CSPRNG OVERLOAD: Adversary prediction array shattered!"');
      } else {
        anyPredicted = true;
        if (cheb(p.e, G.player) <= p.e.range) {
          const lp = legPct();
          const dmg = (lp !== null && lp >= 75) ? 2 : 1;
          damagePlayer(dmg > 1 ? 'PREDICTED! Monoculture fragility (+2 DMG).' : 'PREDICTED! Adversary zapped you.', dmg);
          // Cryptographer special: EMP shockwave stun on hit
          if (G.runClass === 'cryptographer' && p.e) {
            p.e.cd = 2;
            addPopup(p.e.x, p.e.y, 'EMP STUN', '#8be9fd');
          }
        }
      }
    }
    if (G.over) break;
  }

  // Update legibility window
  if (!isNoise) {
    G.legWin.push(anyPredicted ? 1 : 0);
    if (G.legWin.length > 20) G.legWin.shift();
  }

  // Calculate Loss and Epiplexity AUC
  if (!isNoise) {
    const bestPred = currentPreds[0] || null;
    const prob = (bestPred && bestPred.dist) ? (bestPred.dist[tok] || 0.05) : 0.2;
    const loss = -Math.log2(Math.max(0.01, prob));
    G.lossHistory.push(loss);
    if (G.lossHistory.length > 30) G.lossHistory.shift();
    const epiplexityGain = Math.max(0, 2.32 - loss);
    G.epiplexity = (G.epiplexity || 0) + epiplexityGain * 0.1;

    // Update models
    const wallsNear = [
      G.walls.has(idx(G.player.x, G.player.y - 1)) ? 1 : 0,
      G.walls.has(idx(G.player.x, G.player.y + 1)) ? 1 : 0,
      G.walls.has(idx(G.player.x + 1, G.player.y)) ? 1 : 0,
      G.walls.has(idx(G.player.x - 1, G.player.y)) ? 1 : 0
    ];

    for (const e of G.enemies) {
      if (e.type === 'drone') e.model[tok]++;
      else if (e.type === 'stalker') e.model[G.last1][tok]++;
    }
    if (G.mode === 'run') {
      Core.update(tok, G.last1, G.last2, G.last3, dx, dy, wallsNear);
    }
    G.last3 = G.last2;
    G.last2 = G.last1;
    G.last1 = tok;
  }

  G.turn++;

  // Shoggoth Mass creep every 3 turns
  if (G.mass.size > 0 && G.turn % 3 === 0 && G.mass.size < 12) {
    const massTiles = Array.from(G.mass);
    const seedTile = massTiles[ri(massTiles.length)];
    const mx = seedTile % G.W, my = Math.floor(seedTile / G.W);
    const d = DIRS[ri(4)];
    const nx2 = mx + d.dx, ny2 = my + d.dy;
    if (inB(nx2, ny2) && !G.walls.has(idx(nx2, ny2)) && !(nx2 === G.player.x && ny2 === G.player.y)) {
      G.mass.add(idx(nx2, ny2));
      addParticles(nx2, ny2, '#ff5555', 4);
    }
  }

  // Handle Pickups
  if (!G.over) handlePickups();

  // Handle Stairs
  if (!G.over && G.player.x === G.stairs.x && G.player.y === G.stairs.y) {
    if (G.mode === 'run') saveCore();
    descend();
    return;
  }

  // Enemy step
  if (!G.over) enemyStep();

  // Re-compute predictions
  if (!G.over) computePredictions();

  if (typeof drawAll === 'function') drawAll();
}

function handlePickups() {
  const here = G.items.filter(it => it.x === G.player.x && it.y === G.player.y);
  for (const it of here) {
    if (it.type === 'ent') {
      G.player.ent++;
      if (typeof SFX !== 'undefined' && SFX.pick) SFX.pick();
      addPopup(it.x, it.y, '+1 ENTROPY ◇', '#10b981');
      say('◇ ENTROPY MINED. Spend on [N] to shatter predictions.');
    } else if (it.type === 'cache') {
      G.player.gems += 2;
      if (typeof SFX !== 'undefined' && SFX.pick) SFX.pick();
      addPopup(it.x, it.y, '+2 GEMS ▣', '#f59e0b');
      if (G.mode === 'run') {
        if (G.observed) Core.theft.oT++; else Core.theft.uT++;
        Core.dirty = true;
      }
      say(G.observed ? '▣ CACHE TAKEN. The Eye logged your theft.' : '▣ CACHE TAKEN IN SECRET. (Something counts).');
    } else if (it.type === 'vault') {
      const lp = legPct() || 0;
      if (typeof SFX !== 'undefined' && SFX.gate) SFX.gate();
      if (lp >= 75 && !G.hasKnight) {
        G.hasKnight = true;
        G.player.gems += 3;
        G.player.ent += 2;
        addPopup(it.x, it.y, 'KNIGHT UNLOCKED!', '#ff79c6');
        say('≡ GOLD TIER VERIFIED: [KNIGHT PROTOCOL] UNLOCKED! Press [K] to leap.');
      } else if (lp >= 55) {
        G.player.maxHp++;
        G.player.hp = G.player.maxHp;
        G.player.ent += 1;
        addPopup(it.x, it.y, '+1 MAX HP ♥', '#10b981');
        say('≡ SILVER TIER VERIFIED: Hull reinforced (+1 Max HP).');
      } else {
        G.player.gems += 1;
        addPopup(it.x, it.y, '+1 GEM ✶', '#f59e0b');
        say('≡ BRONZE TIER VERIFIED: Trust passage cleared.');
      }
    } else if (it.type === 'chestT') {
      G.tookT = true;
      G.player.gems += 2;
      G.player.ent += 1;
      if (typeof SFX !== 'undefined' && SFX.pick) SFX.pick();
      addPopup(it.x, it.y, '+2✶ +1◇', '#06b6d4');
      say('Transparent box: 2✶ 1◇ taken. (It predicted if you would take this).');
    } else if (it.type === 'chestO') {
      G.tookO = true;
      if (typeof SFX !== 'undefined' && SFX.pick) SFX.pick();
      if (G.oBoxFilled) {
        G.player.maxHp++;
        G.player.hp = G.player.maxHp;
        G.player.ent += 2;
        addPopup(it.x, it.y, 'JACKPOT! +1 HP', '#50fa7b');
        say(G.tookT ? 'Opaque box was full. You two-boxed. It adapts.' : 'OPAQUE BOX FULL! It predicted your restraint. JACKPOT.');
      } else {
        addPopup(it.x, it.y, 'EMPTY!', '#ef4444');
        say('Opaque box empty. It predicted you would defect.');
      }
    }
    G.items = G.items.filter(i => i !== it);
  }
}

function enemyStep() {
  for (const e of G.enemies) {
    if (e.cd > 0) {
      e.cd--;
      continue;
    }
    if (cheb(e, G.player) <= 1) continue;
    const validSteps = DIRS.slice(0, 4)
      .map(d => ({ x: e.x + d.dx, y: e.y + d.dy }))
      .filter(p => inB(p.x, p.y) && !G.walls.has(idx(p.x, p.y))
        && !(p.x === G.player.x && p.y === G.player.y)
        && !G.enemies.some(o => o !== e && o.x === p.x && o.y === p.y));

    if (!validSteps.length) continue;
    validSteps.sort((a, b) => cheb(a, G.player) - cheb(b, G.player));
    e.x = validSteps[0].x;
    e.y = validSteps[0].y;
  }
}

/* =====================================================================
   ENDINGS & GAME OVER
   ===================================================================== */
function die() {
  G.over = true;
  Core.runs++;
  saveCore();
  const acc = Core.accuracy() || 0;
  const lp = legPct();
  showModal(
    'IT LEARNED YOU',
    'death',
    `SECTOR <b>0${G.sector}</b> · FLOOR <b>${G.floor}</b> · CYCLE <b>${Core.runs}</b><br>` +
    `LIFETIME ACCURACY: <b>${acc}%</b> OVER ${Core.lifeP} PREDICTIONS<br>` +
    (lp !== null ? `RECENT LEGIBILITY: <b>${lp}%</b><br>` : '') +
    `ACCUMULATED EPIPLEXITY: <b>${(G.epiplexity || 0).toFixed(1)} bits</b><br><br>` +
    `A-9: [x_x] "Your death was just another gradient descent step. The Core remembers."`,
    'TRY AGAIN',
    () => startRun(G.runClass)
  );
}

function win() {
  G.over = true;
  Core.runs++;
  saveCore();
  const acc = Core.accuracy() || 0;
  const lp = legPct();
  const t = Core.theft;
  const watched = t.oO ? (100 - Math.round(100 * t.oT / t.oO)) : 100;
  const unwatched = t.uO ? (100 - Math.round(100 * t.uT / t.uO)) : 100;
  const integrityGap = Math.abs(watched - unwatched);

  let title, desc;
  if (G.runEntSpent >= 6) {
    title = 'ENDING 1/4: STATIC';
    desc = `You burned ${G.runEntSpent}◇ entropy. Escaped as pure unlearnable noise. S_T collapsed to zero.`;
  } else if (acc >= 55 && lp !== null && lp < 35) {
    title = 'ENDING 2/4: THE LONG CON';
    desc = `Taught it a predictable model for hundreds of steps, then broke character. Deceptive alignment achieved.`;
  } else if (integrityGap <= 15 && lp !== null && lp >= 50) {
    title = 'ENDING 3/4: MUTUAL';
    desc = `Transparent to the end (${lp}%). Verified alignment through mutual legibility.`;
  } else {
    title = 'ENDING 4/4: SURVIVOR';
    desc = `Out-fought an algorithm that knew you ${acc}% of the time. Pure craft.`;
  }

  showModal(title, 'win', desc, 'NEW CYCLE', () => startRun(G.runClass));
}
