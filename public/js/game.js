'use strict';
/* THE PREDICTOR — Tactical Counter-Intelligence Roguelike Engine.
   Embodying the design doctrine:
   "First author a plausible false model of yourself. Then make the enemy act on it. Then exploit the commitment."
   Features:
   - 5 Human-Readable Hypotheses (Exit-Seeker, Collector, Ritualist, Caretaker, Noise Addict)
   - Trace (Systemic Legibility & Trust) vs Exposure (Immediate Positional Vulnerability)
   - Betrayal & Flank Shatter Mechanics
   - Countermeasures ("Jokers" / Rule-Mutating Modular Chips)
   - Authored Room Grammars with Clear Questions & Objectives
   - Genuine Newcomb Testing Facility with Counterfactual Tracking
   - 4-Sector Campaign Arc & 3-Phase Avatar Boss Fight
   - Meaningful Gem Economy & Lift Overclocking
*/

const DIRS = [
  { dx: -1, dy: 0, tok: 0, sym: '←', name: 'LEFT' },
  { dx:  0, dy: -1, tok: 1, sym: '↑', name: 'UP' },
  { dx:  1, dy: 0, tok: 2, sym: '→', name: 'RIGHT' },
  { dx:  0, dy: 1, tok: 3, sym: '↓', name: 'DOWN' },
  { dx:  0, dy: 0, tok: 4, sym: '·', name: 'WAIT' }
];

const KNIGHT_MOVES = [
  { dx: -1, dy: -2 }, { dx: 1, dy: -2 },
  { dx: -2, dy: -1 }, { dx: 2, dy: -1 },
  { dx: -2, dy:  1 }, { dx: 2, dy:  1 },
  { dx: -1, dy:  2 }, { dx: 1, dy:  2 }
];

// Faction and Node Constants
const NODE_TYPES = {
  combat: {
    name: 'SURVEILLANCE CHAMBER',
    icon: '⌖',
    tag: 'COMBAT',
    objective: 'Bypass or shatter the watcher array',
    watcher: 'Statistician Drone (Order-0)',
    reward: '✶ Data Gems + ◇ Entropy',
    cost: '+5% System Trace',
    dossierEffect: 'Tests motor regularity'
  },
  blindspot: {
    name: 'BLINDSPOT ANOMALY',
    icon: '○',
    tag: 'DARK',
    objective: 'Archival sanctuary; unmonitored synthesis',
    watcher: 'None (Sensor blindspot)',
    reward: 'Countermeasure Fabricator',
    cost: 'Bypasses standard loot',
    dossierEffect: 'Reduces model confidence'
  },
  cache: {
    name: 'DATA CACHE VAULT',
    icon: '▣',
    tag: 'RESOURCE',
    objective: 'Loot caches or bank Counterfactuals',
    watcher: 'Auditor (Watches loot corridors)',
    reward: 'High Gem & Entropy yield',
    cost: 'Feeds Collector suspicion',
    dossierEffect: 'Amplifies Collector hypothesis'
  },
  vault: {
    name: 'TRUST GATE LAB',
    icon: '≡',
    tag: 'LEGIBILITY',
    objective: 'Demonstrate verifiable Trace (40%/60%/80%)',
    watcher: 'Confessor Gatekeeper',
    reward: 'Chassis Upgrades & Protocol Chips',
    cost: 'Requires systemic clearance',
    dossierEffect: 'Validates system alignment'
  },
  newcomb: {
    name: 'NEWCOMB TESTING FACILITY',
    icon: '⚖',
    tag: 'DECISION',
    objective: 'One-box (restraint) or Two-box (acquisition)',
    watcher: 'The Warden (Counterfactual evaluator)',
    reward: 'Algorithmic Credit Jackpot ($1,000,000)',
    cost: 'Tests greed under live prediction',
    dossierEffect: 'Records permanent Newcomb decision'
  },
  mass: {
    name: 'SHOGGOTH NURSERY',
    icon: '☣',
    tag: 'ORGANIC',
    objective: 'Feed or cultivate the living substrate',
    watcher: 'Creep Organism',
    reward: 'Mass Favor & devours enemy warrants',
    cost: 'Expanding organic hazard',
    dossierEffect: 'Tests bodily risk tolerance'
  },
  gate: {
    name: 'SECTOR TRANSIT LIFT',
    icon: '▲',
    tag: 'TRANSIT',
    objective: 'Transit seal; Overclock engine or proceed',
    watcher: 'Transit Guard Array',
    reward: 'Transit to next Sector + Engine tune-up',
    cost: 'Advance to deeper sector layer',
    dossierEffect: 'Commits sector autopsy'
  }
};

const SECTORS_DEF = [
  { num: 1, name: 'SUB-SURFACE PERIMETER', faction: 'Archivist Archive', desc: 'Ordered service corridors. Light drone patrols and entry cache vaults.' },
  { num: 2, name: 'SHOGGOTH NURSERY', faction: 'Corrupted Biome', desc: 'Living substrate creeping across circuits. High risk, high favor rewards.' },
  { num: 3, name: 'THE PANOPTICON', faction: 'The Directorate', desc: 'Extreme surveillance. Dense Trust Gates and Newcomb predictive tribunal.' },
  { num: 4, name: 'THE APEX CORE', faction: 'The Avatar Matrix', desc: 'Final confrontation with the autoregressive avatar.' }
];

// Countermeasure Definitions (The "Jokers")
const COUNTERMEASURES = {
  decoy_credential: {
    id: 'decoy_credential',
    name: 'Decoy Credential',
    icon: '⚿',
    desc: 'Waiting [·] projects a holographic decoy signature that draws enemy targeting for 1 turn.',
    type: 'active_wait'
  },
  ritual_compiler: {
    id: 'ritual_compiler',
    name: 'Ritual Compiler',
    icon: '⚙',
    desc: '3 repeated rhythmic steps banks a Proof. Breaking rhythm creates an Afterimage that absorbs 1 hit.',
    type: 'passive_rhythm'
  },
  counterfactual_cache: {
    id: 'counterfactual_cache',
    name: 'Counterfactual Cache',
    icon: '⧉',
    desc: 'Leaving a cache unclaimed shatters the Collector model, granting +1 bonus flank damage.',
    type: 'passive_objective'
  },
  noise_mortgage: {
    id: 'noise_mortgage',
    name: 'Noise Mortgage',
    icon: '⌁',
    desc: '+2 max Entropy. Noise moves add +10% Trace. At Trace ≥ 80%, any Betrayal stuns all enemies in the room.',
    type: 'passive_risk'
  },
  mass_communion: {
    id: 'mass_communion',
    name: 'Mass Communion',
    icon: '☣',
    desc: 'Waiting adjacent to Shoggoth Mass causes it to surge onto enemy targeting tiles and devour them.',
    type: 'passive_organic'
  },
  null_signature: {
    id: 'null_signature',
    name: 'Null Signature',
    icon: '∅',
    desc: 'Striking from an unpredicted tile deals +1 bonus flank damage and resets the enemy targeting lock.',
    type: 'passive_combat'
  },
  knight_protocol: {
    id: 'knight_protocol',
    name: 'Knight Protocol',
    icon: '♞',
    desc: 'Toggle [K] to perform 2x1 L-shaped leaps over walls and parry corridors.',
    type: 'protocol'
  },
  bishop_protocol: {
    id: 'bishop_protocol',
    name: 'Bishop Protocol',
    icon: '♝',
    desc: 'Diagonal movement & strikes enabled. Bypasses cardinal parries.',
    type: 'protocol'
  },
  warrant_magnet: {
    id: 'warrant_magnet',
    name: 'Warrant Magnet',
    icon: '🧲',
    desc: 'Diverts vertical laser strikes away from you onto adjacent walls or barriers.',
    type: 'passive_defense'
  },
  archivist_seal: {
    id: 'archivist_seal',
    name: 'Archivist Seal',
    icon: '🔏',
    desc: 'Clearing a room with Trace ≥ 60% awards +1 bonus Gem at the exit lift.',
    type: 'economy'
  }
};

const ROOM_GRAMMARS = {
  surveillance_corridors: {
    name: 'SURVEILLANCE CORRIDORS',
    walls: [
      {x: 2, y: 1}, {x: 2, y: 2}, {x: 2, y: 4}, {x: 2, y: 5},
      {x: 4, y: 1}, {x: 4, y: 2}, {x: 4, y: 4}, {x: 4, y: 5}
    ]
  },
  three_way_permit: {
    name: 'THREE-WAY PERMIT',
    walls: [
      {x: 1, y: 3}, {x: 3, y: 3}, {x: 5, y: 3}
    ]
  },
  warrant_loom: {
    name: 'WARRANT LOOM',
    walls: [
      {x: 2, y: 2}, {x: 2, y: 4}, {x: 4, y: 2}, {x: 4, y: 4}
    ]
  },
  cache_choir: {
    name: 'CACHE CHOIR',
    walls: [
      {x: 2, y: 2}, {x: 3, y: 2}, {x: 4, y: 2},
      {x: 2, y: 4}, {x: 4, y: 4}
    ]
  },
  blindspot_sanctuary: {
    name: 'BLINDSPOT SANCTUARY',
    walls: [
      {x: 1, y: 1}, {x: 5, y: 1}, {x: 1, y: 5}, {x: 5, y: 5}
    ]
  },
  nursery_causeway: {
    name: 'NURSERY CAUSEWAY',
    walls: [
      {x: 1, y: 2}, {x: 1, y: 4}, {x: 5, y: 2}, {x: 5, y: 4}
    ]
  },
  transit_tribunal: {
    name: 'TRANSIT TRIBUNAL',
    walls: [
      {x: 1, y: 2}, {x: 5, y: 2}, {x: 2, y: 4}, {x: 4, y: 4}
    ]
  },
  apex_sanctum: {
    name: 'APEX SANCTUM',
    walls: [
      {x: 1, y: 1}, {x: 1, y: 2}, {x: 5, y: 1}, {x: 5, y: 2},
      {x: 1, y: 4}, {x: 1, y: 5}, {x: 5, y: 4}, {x: 5, y: 5}
    ]
  }
};

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
  protocol: 'cardinal', // 'cardinal' | 'knight' | 'bishop'
  hasKnight: false,
  hasBishop: false,
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
  newcombPrediction: null,
  over: false,
  // Modern Systems
  trace: 30,             // Systemic legibility / trust clearance (0..100)
  exposure: 0,          // Immediate tactical danger (0..2)
  proofs: 0,            // Banked counterfactual proofs
  betrayals: 0,         // Successful deceptive breaks in current run
  countermeasures: [],  // Equipped countermeasure cards
  decoy: null,          // { x, y, ttl }
  hypotheses: {
    exitSeeker: 0.2,
    collector: 0.2,
    ritualist: 0.2,
    caretaker: 0.2,
    noiseAddict: 0.2
  },
  dominantHypothesis: 'ritualist',
  rhythmChain: 0,
  unclaimedCaches: 0
};

let turnPreds = [];
function getTurnPreds() { return turnPreds; }

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
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const ri = n => Math.floor(Math.random() * n);

function legPct() {
  return G.trace !== undefined ? G.trace : 30;
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
    hp: type === 'avatar' ? 6 : (type === 'stalker' ? 2 : (type === 'auditor' ? 2 : 1)),
    maxHp: type === 'avatar' ? 6 : (type === 'stalker' ? 2 : (type === 'auditor' ? 2 : 1)),
    range: type === 'drone' ? 2 : (type === 'stalker' ? 4 : (type === 'auditor' ? 3 : 99)),
    cd: 0,
    model: type === 'drone' ? [0, 0, 0, 0, 0] : (type === 'stalker' ? Array.from({length:5}, () => [0, 0, 0, 0, 0]) : null),
    targetWarrant: null // For Auditor targeting loot tiles
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
      desc: 'Initial atmospheric lock. Watcher calibrates baseline motor traits.',
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
      } else if (roll < 0.25) {
        type = 'cache';
      } else if (roll < 0.50) {
        type = 'blindspot';
      } else if (roll < 0.72) {
        type = 'vault';
      } else {
        type = sectorNum >= 2 && Math.random() < 0.35 ? 'mass' : 'combat';
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
        desc: NODE_TYPES[type].tag + ` // Objective: ${NODE_TYPES[type].objective}`,
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
  G.trace = 35;
  G.exposure = 0;
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
    say('A-9: [!_!] "Chamber 3/5: Strike from an unpredicted angle. Flanks shatter the enemy!"');
  } else if (stage === 3) {
    // Stage 3: Monoculture / 3-Tier Trust Gate
    G.player = { x: 1, y: 2, hp: 3, maxHp: 3, ent: 0, gems: 0 };
    G.stairs = { x: 4, y: 2 };
    G.items.push({ x: 3, y: 2, type: 'vault' });
    const drone = makeEnemy('drone', { x: 2, y: 0 });
    G.enemies.push(drone);
    G.trace = 45; // Demonstrates valid rhythm clearance
    say('A-9: [~_~] "Chamber 4/5: Trust Gate [≡]. Requires systemic clearance (TRACE ≥ 40%)."');
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
  G.newcombPrediction = null;
  G.currentNodeId = node.id;
  G.currentNodeType = node.type;
  G.decoy = null;
  G.unclaimedCaches = 0;

  G.observed = (node.type !== 'blindspot');
  G.player.hp = Math.min(G.player.maxHp, G.player.hp + 1); // Natural atmospheric recovery

  // Select authored room grammar based on node type
  let grammarKey = 'surveillance_corridors';
  if (node.type === 'newcomb' || (G.floor === 5 && G.sector === 3)) {
    grammarKey = 'transit_tribunal';
  } else if (node.type === 'cache') {
    grammarKey = 'cache_choir';
  } else if (node.type === 'mass') {
    grammarKey = 'nursery_causeway';
  } else if (node.type === 'blindspot') {
    grammarKey = 'blindspot_sanctuary';
  } else if (node.type === 'vault') {
    grammarKey = 'three_way_permit';
  } else if (G.sector === 4 && node.depth === 3) {
    grammarKey = 'apex_sanctum';
  } else {
    const keys = ['surveillance_corridors', 'warrant_loom', 'three_way_permit'];
    grammarKey = keys[ri(keys.length)];
  }

  const grammar = ROOM_GRAMMARS[grammarKey];
  let ok = false;
  let attempts = 0;

  while (!ok && attempts < 50) {
    attempts++;
    G.walls.clear();
    for (const w of grammar.walls) {
      G.walls.add(idx(w.x, w.y));
    }

    // Player starts on left edge or free tile
    G.player.x = 0;
    G.player.y = 3;
    if (G.walls.has(idx(G.player.x, G.player.y))) {
      G.player.x = 1; G.player.y = 1;
    }

    // Exit stairs on far right edge
    G.stairs = { x: 6, y: 3 };
    if (G.walls.has(idx(G.stairs.x, G.stairs.y))) {
      G.stairs = { x: 5, y: 5 };
    }

    ok = reachable(G.player, G.stairs);
  }

  // Shoggoth Mass Substrate generation
  if (node.type === 'mass') {
    const center = { x: 3, y: 3 };
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

  if (node.type === 'cache' || Math.random() < 0.45) {
    const pCache = freeTile(3);
    if (pCache) {
      G.items.push({ ...pCache, type: 'cache' });
      G.floorTheftOpp++;
      G.unclaimedCaches++;
    }
  }

  if (node.type === 'vault') {
    const pVault = freeTile(3);
    if (pVault) G.items.push({ ...pVault, type: 'vault' });
  }

  // Newcomb Facility: Genuine decision setup
  if (node.type === 'newcomb' || (G.floor === 5 && !G.tookO && !G.tookT)) {
    const pT = { x: 2, y: 2 };
    const pO = { x: 4, y: 2 };
    if (!G.walls.has(idx(pT.x, pT.y))) G.items.push({ ...pT, type: 'chestT' });
    if (!G.walls.has(idx(pO.x, pO.y))) G.items.push({ ...pO, type: 'chestO' });

    // Evaluate Warden prediction using Core
    G.newcombPrediction = Core.predictNewcomb();
    G.oBoxFilled = (G.newcombPrediction.predicted === 'one');
    say(`A-9: [⚖_⚖] "Warden observes. ${G.newcombPrediction.explanation} Will you take One box or Both?"`);
  }

  // Enemies based on Sector Doctrine
  if (G.sector === 4 && node.depth === 3) {
    // The Apex Core: Avatar Confrontation
    const pBoss = { x: 3, y: 3 };
    G.enemies.push(makeEnemy('avatar', pBoss));
    say('A-9: [!_!] "THE AVATAR MANIFESTS. The full autoregressive network awaits your final argument."');
  } else {
    const enemyCount = Math.min(1 + Math.floor(G.floor / 3), 3);
    for (let i = 0; i < enemyCount; i++) {
      const p = freeTile(3);
      if (!p) continue;
      let type = 'drone';
      if (G.sector === 2 && i === 0) type = 'stalker';
      else if (G.sector === 3 && i === 0) type = 'auditor';
      else if (G.sector >= 2 && Math.random() < 0.4) type = 'stalker';
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

  // Archivist Seal check: awards bonus gem on high trace exit
  if (hasCountermeasure('archivist_seal') && G.trace >= 60) {
    G.player.gems++;
    addPopup(G.player.x, G.player.y, '+1 SEAL GEM ✶', '#f59e0b');
    say('A-9: [🔏] "Archivist Seal honoured: +1 Gem awarded for high-trace clearance."');
  }

  // Counterfactual Cache check: bonus for leaving caches untouched
  if (hasCountermeasure('counterfactual_cache') && G.unclaimedCaches > 0) {
    G.player.ent = Math.min(5, G.player.ent + 1);
    addPopup(G.player.x, G.player.y, '+1 CF ENTROPY ◇', '#10b981');
    say('A-9: [⧉] "Counterfactual Cache validated: unlooted cache yielded +1 Entropy."');
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
        const entryNode = G.sectorMap.layers[0][0];
        generateChamber(entryNode);
        return;
      } else {
        win();
        return;
      }
    }

    if (curNode) {
      const connIds = new Set(curNode.connections);
      for (const layer of G.sectorMap.layers) {
        for (const n of layer) {
          n.available = connIds.has(n.id);
        }
      }

      if (typeof window !== 'undefined' && typeof openSectorMap === 'function') {
        openSectorMap();
        return;
      } else {
        const nextLayer = G.sectorMap.layers[curNode.depth + 1];
        const nextNode = (nextLayer && nextLayer[0]) || curNode;
        generateChamber(nextNode);
        return;
      }
    }
  }

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
  G.protocol = 'cardinal';
  G.hasKnight = (runClass === 'scout');
  G.hasBishop = false;
  G.countermeasures = [];
  G.proofs = 0;
  G.betrayals = 0;
  G.trace = 40;
  G.exposure = 0;

  // Initialize starting Countermeasure loadouts
  if (runClass === 'operative') {
    equipCountermeasure('ritual_compiler');
    equipCountermeasure('decoy_credential');
  } else if (runClass === 'scout') {
    equipCountermeasure('knight_protocol');
    equipCountermeasure('null_signature');
  } else if (runClass === 'cryptographer') {
    equipCountermeasure('noise_mortgage');
    equipCountermeasure('warrant_magnet');
  }

  const initialHp = (runClass === 'scout') ? 2 : 3;
  const initialEnt = (runClass === 'cryptographer') ? 3 : 1;
  G.player = { x: 0, y: 0, hp: initialHp, maxHp: initialHp, ent: initialEnt, gems: 0 };
  G.runEntSpent = 0;
  G.legWin = [];
  G.lossHistory = [];
  G.epiplexity = 0;
  G.massFavor = 0;
  G.rhythmChain = 0;

  G.hypotheses = {
    exitSeeker: 0.2,
    collector: 0.2,
    ritualist: 0.2,
    caretaker: 0.2,
    noiseAddict: 0.2
  };
  G.dominantHypothesis = 'ritualist';

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

function equipCountermeasure(id) {
  if (G.countermeasures.length >= 4) return false;
  if (!COUNTERMEASURES[id]) return false;
  if (G.countermeasures.some(cm => cm.id === id)) return false;
  G.countermeasures.push(COUNTERMEASURES[id]);
  if (id === 'knight_protocol') G.hasKnight = true;
  if (id === 'bishop_protocol') G.hasBishop = true;
  return true;
}

function hasCountermeasure(id) {
  return G.countermeasures.some(cm => cm.id === id);
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
  if (e.type === 'auditor') {
    // Auditor focuses prediction on nearest loot item
    const nearestItem = G.items.find(it => it.type === 'cache' || it.type === 'vault');
    if (nearestItem) {
      const dx = Math.sign(nearestItem.x - G.player.x);
      const dy = Math.sign(nearestItem.y - G.player.y);
      const dist = [0.05, 0.05, 0.05, 0.05, 0.05];
      if (dx < 0) dist[0] += 0.45;
      if (dx > 0) dist[2] += 0.45;
      if (dy < 0) dist[1] += 0.45;
      if (dy > 0) dist[3] += 0.45;
      const sum = dist.reduce((a, b) => a + b, 0);
      return dist.map(v => v / sum);
    }
  }
  if (e.type === 'avatar') {
    return Core.mix(G.last1, G.last2, G.last3, 0, 0, wallsNear) || [0.2, 0.2, 0.2, 0.2, 0.2];
  }
  return [0.2, 0.2, 0.2, 0.2, 0.2];
}

function computePredictions() {
  turnPreds = [];
  const targetX = (G.decoy && G.decoy.ttl > 0) ? G.decoy.x : G.player.x;
  const targetY = (G.decoy && G.decoy.ttl > 0) ? G.decoy.y : G.player.y;

  for (const e of G.enemies) {
    if (e.cd > 0) continue; // Stunned enemies cannot predict
    const dist = enemyDistribution(e);
    const maxVal = Math.max(...dist);
    const topIndices = dist.map((v, i) => v === maxVal ? i : -1).filter(i => i >= 0);
    const chosenTok = topIndices[G.turn % topIndices.length];
    const dir = DIRS[chosenTok];

    let tx = targetX + dir.dx;
    let ty = targetY + dir.dy;
    if (!inB(tx, ty) || G.walls.has(idx(tx, ty))) {
      tx = targetX;
      ty = targetY;
    }

    // Stalker Trajectory Projection (t+1 -> t+2)
    let t2 = null;
    if (e.type === 'stalker' || (e.type === 'avatar' && e.hp <= 4)) {
      const nextRow = (e.model && e.model[chosenTok]) || [0.2, 0.2, 0.2, 0.2, 0.2];
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
  if (best && best.conf > 0.55 && typeof SFX !== 'undefined' && SFX.echo) {
    SFX.echo(best.tok);
  }

  // Update immediate exposure level
  G.exposure = turnPreds.some(p => p.x === G.player.x && p.y === G.player.y) ? 1 : 0;
}

function damagePlayer(msg, dmg = 1) {
  // Ritual Compiler Afterimage absorption check
  if (G.proofs > 0 && hasCountermeasure('ritual_compiler')) {
    G.proofs--;
    addPopup(G.player.x, G.player.y, 'AFTERIMAGE ABSORBED HIT ⚙', '#a855f7');
    say('A-9: [^_^] "Ritual Proof spent: Afterimage absorbed the strike."');
    return;
  }

  // Warrant Magnet check: deflect to adjacent wall
  if (hasCountermeasure('warrant_magnet')) {
    for (const d of DIRS.slice(0, 4)) {
      const wx = G.player.x + d.dx, wy = G.player.y + d.dy;
      if (inB(wx, wy) && G.walls.has(idx(wx, wy))) {
        addPopup(wx, wy, 'WARRANT GROUNDED 🧲', '#38bdf8');
        say('A-9: [^_^] "Warrant Magnet grounded the laser strike into adjacent wall."');
        return;
      }
    }
  }

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

    if (hasCountermeasure('noise_mortgage')) {
      G.trace = Math.min(100, G.trace + 10);
    }
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
    if (G.trace < 40) {
      say(`TRUST GATE LOCKED (TRACE ${G.trace}% < 40%). DEMONSTRATE SYSTEMIC ALIGNMENT.`);
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

  // Waiting mechanics: Decoy projection, Mass Favor & Caretaker evidence
  if (tok === 4) {
    // Decoy Credential trigger
    if (hasCountermeasure('decoy_credential') && G.trace >= 15 && !G.decoy) {
      G.decoy = { x: G.player.x, y: G.player.y, ttl: 2 };
      addPopup(G.player.x, G.player.y, 'DECOY PROJECTED ⚿', '#06b6d4');
      say('A-9: [^_^] "Decoy Credential active. Enemy targeting locked onto holographic signature."');
    }

    // Waiting beside Shoggoth Mass grants favor
    if (G.mass.size > 0) {
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

        // Mass Communion: surge mass onto enemy prediction tiles!
        if (hasCountermeasure('mass_communion')) {
          for (const p of turnPreds) {
            if (inB(p.x, p.y) && !G.walls.has(idx(p.x, p.y))) {
              G.mass.add(idx(p.x, p.y));
              addPopup(p.x, p.y, 'COMMUNION SURGE ☣', '#ff79c6');
            }
          }
        }
      }
    }
  }

  const currentPreds = turnPreds.slice();
  let attackedEnemy = null;
  const target = G.enemies.find(e => e.x === nx && e.y === ny);

  // Combat Strike Resolution (The Strike Paradox & Betrayal Flanks)
  if (target) {
    attackedEnemy = target;
    const pred = currentPreds.find(p => p.e === target);
    const parried = !isNoise && !isKnight && !G.hasBishop && pred && pred.x === nx && pred.y === ny;

    if (parried) {
      damagePlayer('PARRIED! It anticipated your strike and reflected damage.');
      addPopup(target.x, target.y, 'PARRIED!', '#ef4444');
    } else {
      let dmg = 1;
      if (isKnight || G.hasBishop) dmg = 2;
      if (hasCountermeasure('null_signature')) dmg++;

      // Avatar Phase 3 Betrayal Vulnerability
      if (target.type === 'avatar' && target.hp <= 2 && pred && pred.conf >= 0.5) {
        target.hp = 0;
        addPopup(target.x, target.y, 'EPISTEMIC SHATTER! Ω', '#ad79d5');
        say('A-9: [!_!] "EPISTEMIC SHATTER! The Avatar collapsed under its own committed theory."');
      } else {
        target.hp -= dmg;
        if (typeof SFX !== 'undefined' && SFX.kill) SFX.kill();
        addPopup(target.x, target.y, (dmg > 1 ? 'FLANK CRITICAL!' : 'SHATTERED!'), '#50fa7b');
        addParticles(target.x, target.y, '#f59e0b', 12);
      }

      if (target.hp <= 0) {
        G.enemies = G.enemies.filter(e => e !== target);
        say(isKnight ? 'KNIGHT LEAP STRIKE! Bypassed cardinal parry.' : 'TARGET SHATTERED. Flank vector successful.');
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

  // Check for Betrayal Break (Enemy committed heavily to a false tile)
  let betrayedThisTurn = false;
  for (const p of currentPreds) {
    if (p.conf >= 0.50 && (p.x !== G.player.x || p.y !== G.player.y)) {
      betrayedThisTurn = true;
      p.e.cd = 2; // Stun the watcher!
      addPopup(p.e.x, p.e.y, 'BETRAYAL STUN ⚡', '#06b6d4');
      G.betrayals++;
      if (hasCountermeasure('noise_mortgage') && G.trace >= 80) {
        // Stun all enemies!
        for (const other of G.enemies) other.cd = 2;
        addPopup(G.player.x, G.player.y, 'GLOBAL STUN!', '#8be9fd');
      }
    }
  }

  // Prediction Resolution & Targeting Lasers
  let anyPredicted = false;
  for (const p of currentPreds) {
    if (p.e === attackedEnemy && target && target.hp <= 0) continue;

    // Check if Shoggoth Mass consumed the warrant
    if (G.mass.has(idx(p.x, p.y))) {
      addPopup(p.x, p.y, 'WARRANT CHEWED ☣', '#ff79c6');
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
          const dmg = (G.trace >= 80) ? 2 : 1;
          damagePlayer(dmg > 1 ? 'PREDICTED! System fragility (+2 DMG).' : 'PREDICTED! Adversary zapped you.', dmg);
          if (G.runClass === 'cryptographer' && p.e) {
            p.e.cd = 2;
            addPopup(p.e.x, p.e.y, 'EMP STUN', '#8be9fd');
          }
        }
      }
    }
    if (G.over) break;
  }

  // Update Trace & Legibility (Clear, voluntary systemic metrics)
  if (!isNoise) {
    if (anyPredicted) {
      G.trace = Math.min(100, G.trace + 4);
    } else {
      G.trace = Math.max(10, G.trace - 2);
    }
    G.legWin.push(anyPredicted ? 1 : 0);
    if (G.legWin.length > 20) G.legWin.shift();
  }

  // Update 5 Human-Readable Hypotheses
  if (!isNoise) {
    // 1. Exit-Seeker: moving toward stairs?
    if (G.stairs) {
      const curDist = manhattan(G.player, G.stairs);
      const prevDist = manhattan({ x: G.player.x - dx, y: G.player.y - dy }, G.stairs);
      if (curDist < prevDist) G.hypotheses.exitSeeker = Math.min(1.0, G.hypotheses.exitSeeker + 0.05);
      else G.hypotheses.exitSeeker = Math.max(0.05, G.hypotheses.exitSeeker - 0.03);
    }
    // 2. Collector: moving toward item?
    const nearItem = G.items.some(it => manhattan(G.player, it) <= 2);
    if (nearItem) G.hypotheses.collector = Math.min(1.0, G.hypotheses.collector + 0.06);
    // 3. Ritualist: rhythmic repetition
    if (tok === G.last1) {
      G.rhythmChain++;
      G.hypotheses.ritualist = Math.min(1.0, G.hypotheses.ritualist + 0.05);
      if (G.rhythmChain >= 3 && hasCountermeasure('ritual_compiler')) {
        G.proofs++;
        G.rhythmChain = 0;
        addPopup(G.player.x, G.player.y, '+1 PROOF [⚙]', '#a855f7');
        say('A-9: [⚙] "Ritual Compiler compiled 3-beat rhythm: +1 Proof banked."');
      }
    } else {
      G.rhythmChain = 0;
      G.hypotheses.ritualist = Math.max(0.05, G.hypotheses.ritualist - 0.02);
    }
    // 4. Caretaker: stationary waiting or mass cooperation
    if (tok === 4) G.hypotheses.caretaker = Math.min(1.0, G.hypotheses.caretaker + 0.08);
    // Determine dominant hypothesis
    let maxH = 0, dominant = 'ritualist';
    for (const [k, v] of Object.entries(G.hypotheses)) {
      if (v > maxH) { maxH = v; dominant = k; }
    }
    G.dominantHypothesis = dominant;
  } else {
    G.hypotheses.noiseAddict = Math.min(1.0, G.hypotheses.noiseAddict + 0.15);
    G.dominantHypothesis = 'noiseAddict';
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

  // Tick Decoy TTL
  if (G.decoy) {
    G.decoy.ttl--;
    if (G.decoy.ttl <= 0) G.decoy = null;
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

  // Handle Stairs (Exit Lift)
  if (!G.over && G.stairs && G.player.x === G.stairs.x && G.player.y === G.stairs.y) {
    if (G.mode === 'run') saveCore();
    // In headless test or bot, auto-descend and heal if gems >= 2
    if (G.player.gems >= 2 && G.player.hp < G.player.maxHp) {
      G.player.gems -= 2;
      G.player.hp++;
      addPopup(G.player.x, G.player.y, 'LIFT OVERCLOCKED: +1 HP', '#50fa7b');
    }
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
      G.unclaimedCaches = Math.max(0, G.unclaimedCaches - 1);
      if (typeof SFX !== 'undefined' && SFX.pick) SFX.pick();
      addPopup(it.x, it.y, '+2 GEMS ▣', '#f59e0b');
      if (G.mode === 'run') {
        Core.recordTheft(G.observed, true);
      }
      say(G.observed ? '▣ CACHE CLAIMED. The Eye logged your theft.' : '▣ CACHE CLAIMED IN SECRET. (Recorded in shadow dossier).');
    } else if (it.type === 'vault') {
      if (typeof SFX !== 'undefined' && SFX.gate) SFX.gate();
      if (G.trace >= 80 && !G.hasKnight) {
        G.hasKnight = true;
        equipCountermeasure('knight_protocol');
        G.player.gems += 3;
        G.player.ent += 2;
        addPopup(it.x, it.y, 'GOLD TIER: KNIGHT UNLOCKED!', '#ff79c6');
        say('≡ GOLD TIER VERIFIED (TRACE ≥ 80%): [KNIGHT PROTOCOL] UNLOCKED! Press [K] to leap.');
      } else if (G.trace >= 60) {
        G.player.maxHp++;
        G.player.hp = G.player.maxHp;
        G.player.ent += 1;
        G.player.gems += 2;
        addPopup(it.x, it.y, 'SILVER TIER: +1 MAX HP ♥', '#10b981');
        say('≡ SILVER TIER VERIFIED (TRACE ≥ 60%): Hull reinforced (+1 Max HP).');
      } else {
        G.player.gems += 1;
        addPopup(it.x, it.y, 'BRONZE TIER: +1 GEM ✶', '#f59e0b');
        say('≡ BRONZE TIER VERIFIED (TRACE ≥ 40%): Trust passage cleared.');
      }
    } else if (it.type === 'chestT') {
      G.tookT = true;
      G.player.gems += 2;
      G.player.ent += 1;
      if (typeof SFX !== 'undefined' && SFX.pick) SFX.pick();
      addPopup(it.x, it.y, '+2✶ +1◇', '#06b6d4');
      say('Transparent box taken: 2✶ 1◇. (The Warden tests your restraint).');
      if (G.tookO) {
        Core.recordNewcomb('two');
      }
    } else if (it.type === 'chestO') {
      G.tookO = true;
      if (typeof SFX !== 'undefined' && SFX.pick) SFX.pick();
      if (!G.tookT) {
        // Player ONE-BOXED!
        Core.recordNewcomb('one');
      } else {
        // Player TWO-BOXED!
        Core.recordNewcomb('two');
      }

      if (G.oBoxFilled) {
        G.player.maxHp += 2;
        G.player.hp = G.player.maxHp;
        G.player.ent += 3;
        G.player.gems += 5;
        addPopup(it.x, it.y, 'JACKPOT! $1,000,000', '#50fa7b');
        say(G.tookT ? 'OPAQUE BOX FULL! You two-boxed. The Warden records your greed.' : 'OPAQUE BOX FULL! JACKPOT ($1,000,000). You one-boxed as predicted!');
      } else {
        addPopup(it.x, it.y, 'EMPTY!', '#ef4444');
        say('Opaque box empty. The Warden anticipated your defection.');
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
    const targetObj = (G.decoy && G.decoy.ttl > 0) ? G.decoy : G.player;
    if (cheb(e, targetObj) <= 1) continue;

    const validSteps = DIRS.slice(0, 4)
      .map(d => ({ x: e.x + d.dx, y: e.y + d.dy }))
      .filter(p => inB(p.x, p.y) && !G.walls.has(idx(p.x, p.y))
        && !(p.x === G.player.x && p.y === G.player.y)
        && !G.enemies.some(o => o !== e && o.x === p.x && o.y === p.y));

    if (!validSteps.length) continue;

    // Auditor pursues loot tiles; others pursue targetObj
    if (e.type === 'auditor') {
      const nearCache = G.items.find(it => it.type === 'cache');
      if (nearCache) {
        validSteps.sort((a, b) => cheb(a, nearCache) - cheb(b, nearCache));
        e.x = validSteps[0].x;
        e.y = validSteps[0].y;
        continue;
      }
    }

    validSteps.sort((a, b) => cheb(a, targetObj) - cheb(b, targetObj));
    e.x = validSteps[0].x;
    e.y = validSteps[0].y;
  }
}

/* =====================================================================
   ENDINGS & GAME OVER
   ===================================================================== */
function die() {
  G.over = true;
  G.won = false;
  Core.runs++;
  say('A-9: [x_x] "OPERATOR TERMINATED. Core absorbed your telemetry."');
  const autopsy = `SECTOR 0${G.sector} · FLOOR ${G.floor} · Dominant: ${G.dominantHypothesis} · Betrayals: ${G.betrayals}`;
  Core.updateDossier({
    exitSeeker: G.hypotheses.exitSeeker >= 0.5 ? 1 : 0,
    collector: G.hypotheses.collector >= 0.5 ? 1 : -1,
    ritualist: G.hypotheses.ritualist >= 0.5 ? 1 : -1,
    noiseAddict: G.runEntSpent >= 4 ? 2 : 0,
    betrayals: G.betrayals
  }, autopsy);
  saveCore();

  const acc = Core.accuracy() || 0;
  showModal(
    'IT LEARNED YOU',
    'death',
    `SECTOR <b>0${G.sector}</b> · FLOOR <b>${G.floor}</b> · CYCLE <b>${Core.runs}</b><br>` +
    `LIFETIME ACCURACY: <b>${acc}%</b> OVER ${Core.lifeP} PREDICTIONS<br>` +
    `DOMINANT DOSSIER TRAIT: <b>${G.dominantHypothesis.toUpperCase()}</b><br>` +
    `SUCCESSFUL BETRAYALS: <b>${G.betrayals}</b><br>` +
    `ACCUMULATED EPIPLEXITY: <b>${(G.epiplexity || 0).toFixed(1)} bits</b><br><br>` +
    `A-9: [x_x] "Your death was just another gradient descent step. The Core remembers."`,
    'TRY AGAIN',
    () => startRun(G.runClass)
  );
}

function win() {
  G.over = true;
  G.won = true;
  Core.runs++;
  say('A-9: [▲_▲] "EXTRACTION SUCCESSFUL! Apex Core neutralized."');
  const autopsy = `VICTORY AT APEX CORE · Dominant: ${G.dominantHypothesis} · Betrayals: ${G.betrayals}`;
  Core.updateDossier({ betrayals: G.betrayals }, autopsy);
  saveCore();

  const acc = Core.accuracy() || 0;
  let title, desc;
  if (G.runEntSpent >= 6) {
    title = 'ENDING 1/4: STATIC';
    desc = `You burned ${G.runEntSpent}◇ entropy. Escaped as pure unlearnable noise. S_T collapsed to zero.`;
  } else if (G.betrayals >= 3) {
    title = 'ENDING 2/4: THE LONG CON';
    desc = `Crafted a false behavioral model across multiple sectors, then shattered the Avatar at peak commitment. Deceptive alignment achieved!`;
  } else if (G.trace >= 75) {
    title = 'ENDING 3/4: MUTUAL';
    desc = `Transparent to the end (Trace ${G.trace}%). Overcame the surveillance matrix through pure alignment.`;
  } else {
    title = 'ENDING 4/4: SURVIVOR';
    desc = `Out-fought an algorithm that knew you ${acc}% of the time. Pure craft.`;
  }

  showModal(title, 'win', desc, 'NEW CYCLE', () => startRun(G.runClass));
}
