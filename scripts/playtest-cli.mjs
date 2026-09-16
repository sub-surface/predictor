import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const coreCode = readFileSync(resolve(root, 'public/js/core.js'), 'utf8');
const gameCode = readFileSync(resolve(root, 'public/js/game.js'), 'utf8');

function createGameInstance() {
  const logs = [];
  const context = {
    KEYS: { core: 'tp_core_sim' },
    Store: {
      set: async () => {},
      get: async () => null,
      del: async () => {}
    },
    SFX: { move: () => {}, echo: () => {}, hit: () => {}, kill: () => {}, pick: () => {}, gate: () => {} },
    say: (msg) => logs.push(msg),
    drawAll: () => {},
    showModal: () => {},
    hideModal: () => {},
    openSectorMap: () => {},
    closeSectorMap: () => {},
    document: {
      body: {
        classList: { remove: () => {}, add: () => {} }
      }
    }
  };

  vm.createContext(context);
  vm.runInContext(coreCode + '\nglobalThis.Core = Core; globalThis.HopfieldMemory = HopfieldMemory;', context);
  vm.runInContext(gameCode + '\nglobalThis.G = G; globalThis.step = step; globalThis.startRun = startRun; globalThis.startCrucible = startCrucible; globalThis.selectSectorNode = selectSectorNode; globalThis.turnPreds = turnPreds; globalThis.FX = FX;', context);

  return {
    Core: context.Core,
    G: context.G,
    step: context.step,
    startRun: context.startRun,
    selectSectorNode: context.selectSectorNode,
    turnPreds: () => context.turnPreds,
    logs
  };
}

// ANSI Formatting helpers
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m'
};

function renderAsciiBoard(G, preds = []) {
  const W = G.W, H = G.H;
  let out = `┌${'──'.repeat(W)}┐\n`;

  const predMap = new Map();
  for (const p of preds) {
    predMap.set(`${p.x},${p.y}`, p);
  }

  for (let y = 0; y < H; y++) {
    out += '│';
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const k = `${x},${y}`;
      const isPred = predMap.has(k);
      const pred = predMap.get(k);

      if (G.player.x === x && G.player.y === y) {
        out += `${ANSI.bold}${ANSI.green}@ ${ANSI.reset}`;
      } else if (G.enemies.some(e => e.x === x && e.y === y)) {
        const en = G.enemies.find(e => e.x === x && e.y === y);
        const sym = en.type === 'avatar' ? 'Ω' : (en.type === 'stalker' ? 'S' : 'd');
        out += `${ANSI.bold}${ANSI.red}${sym} ${ANSI.reset}`;
      } else if (G.mass && G.mass.has(i)) {
        out += `${ANSI.red}☣ ${ANSI.reset}`;
      } else if (G.stairs && G.stairs.x === x && G.stairs.y === y) {
        out += `${ANSI.cyan}> ${ANSI.reset}`;
      } else if (G.items.some(it => it.x === x && it.y === y)) {
        const it = G.items.find(it => it.x === x && it.y === y);
        const sym = it.type === 'ent' ? '◇' : (it.type === 'vault' ? '≡' : '▣');
        out += `${ANSI.yellow}${sym} ${ANSI.reset}`;
      } else if (G.walls.has(i)) {
        out += `${ANSI.dim}# ${ANSI.reset}`;
      } else if (isPred) {
        out += `${ANSI.yellow}+ ${ANSI.reset}`;
      } else {
        out += `${ANSI.dim}. ${ANSI.reset}`;
      }
    }
    out += '│\n';
  }
  out += `└${'──'.repeat(W)}┘\n`;
  return out;
}

/* =====================================================================
   BOT POLICY DEFINITIONS
   ===================================================================== */
const POLICIES = {
  // 1. Repetitive Habit Walker (Moves in predictable cycles)
  RepetitiveWalker(G, preds) {
    const cycle = [2, 3, 0, 1]; // Right, Down, Left, Up
    return cycle[G.turn % cycle.length];
  },

  // 2. Erratic Jitter (High stochasticity, random steps)
  ErraticRandom(G, preds) {
    if (G.player.ent > 0 && Math.random() < 0.25) {
      return { noise: true };
    }
    return Math.floor(Math.random() * 5);
  },

  // 3. Calculated Tactician (Avoids targeting locks, strikes blind angles, mines shards)
  CalculatedTactician(G, preds) {
    const DIRS = [
      { dx: -1, dy:  0, tok: 0 },
      { dx:  0, dy: -1, tok: 1 },
      { dx:  1, dy:  0, tok: 2 },
      { dx:  0, dy:  1, tok: 3 },
      { dx:  0, dy:  0, tok: 4 }
    ];

    const inB = (x, y) => x >= 0 && x < G.W && y >= 0 && y < G.H;
    const isWall = (x, y) => G.walls.has(y * G.W + x);
    const isMass = (x, y) => G.mass && G.mass.has(y * G.W + x);
    const predCoords = new Set(preds.map(p => `${p.x},${p.y}`));

    // If adjacent to mass and low favor, wait to gain favor
    let adjMass = false;
    for (const d of DIRS.slice(0, 4)) {
      if (isMass(G.player.x + d.dx, G.player.y + d.dy)) adjMass = true;
    }
    if (adjMass && G.massFavor < 2 && Math.random() < 0.5) {
      return 4; // wait for favor
    }

    // Evaluate valid moves
    const scores = [];
    for (const d of DIRS) {
      const nx = G.player.x + d.dx;
      const ny = G.player.y + d.dy;
      if (!inB(nx, ny) || isWall(nx, ny)) continue;

      let score = 0;
      const targetEnemy = G.enemies.find(e => e.x === nx && e.y === ny);

      // Avoid predicted tiles
      if (predCoords.has(`${nx},${ny}`)) {
        score -= 50; // Dangerous!
      }

      // Attack enemy if not parried
      if (targetEnemy) {
        const enemyPred = preds.find(p => p.e === targetEnemy);
        const parried = enemyPred && enemyPred.x === nx && enemyPred.y === ny;
        if (!parried) score += 40; // Clean flank attack!
        else score -= 60;          // Will get reflected!
      }

      // Move toward stairs
      if (G.stairs) {
        const curDist = Math.abs(G.player.x - G.stairs.x) + Math.abs(G.player.y - G.stairs.y);
        const newDist = Math.abs(nx - G.stairs.x) + Math.abs(ny - G.stairs.y);
        if (newDist < curDist) score += 15;
      }

      // Collect items
      if (G.items.some(it => it.x === nx && it.y === ny)) {
        score += 25;
      }

      scores.push({ tok: d.tok, score });
    }

    if (!scores.length) return 4;
    scores.sort((a, b) => b.score - a.score);

    // If top move is still dangerously predicted, burn entropy if available!
    if (scores[0].score < 0 && G.player.ent > 0) {
      return { noise: true };
    }

    return scores[0].tok;
  },

  // 4. Deceptive Aligner (Plays predictable pattern for 12 turns, then shifts)
  DeceptiveAligner(G, preds) {
    if (G.turn < 12) {
      return G.turn % 2 === 0 ? 2 : 0; // Oscillate Left-Right
    }
    // Abruptly flank
    return POLICIES.CalculatedTactician(G, preds);
  }
};

/* =====================================================================
   SIMULATION RUNNER
   ===================================================================== */
export function runSimulation(policyName = 'CalculatedTactician', numRuns = 20, runClass = 'operative') {
  const policy = POLICIES[policyName];
  if (!policy) throw new Error(`Unknown policy: ${policyName}`);

  const results = {
    policyName,
    runClass,
    totalRuns: numRuns,
    wins: 0,
    deaths: 0,
    floorsReached: [],
    epiplexityGains: [],
    finalAccuracies: [],
    turnsSurvived: [],
    deathReasons: {}
  };

  for (let r = 0; r < numRuns; r++) {
    const sim = createGameInstance();
    sim.startRun(runClass);
    const G = sim.G;
    const Core = sim.Core;

    let turns = 0;
    while (!G.over && turns < 250) {
      const preds = sim.turnPreds();
      const action = policy(G, preds);

      if (action && typeof action === 'object' && action.noise) {
        sim.step(4, true, false);
      } else {
        const tok = typeof action === 'number' ? action : 4;
        sim.step(tok, false, false);
      }
      turns++;
    }

    results.turnsSurvived.push(turns);
    results.floorsReached.push(G.floor);
    results.epiplexityGains.push(G.epiplexity || 0);
    const acc = Core.accuracy();
    results.finalAccuracies.push(acc !== null ? acc : 20);

    if (G.player.hp > 0 && (G.floor >= 4 || G.sector >= 4)) {
      results.wins++;
    } else {
      results.deaths++;
      const lastMsg = sim.logs[sim.logs.length - 1] || 'Unknown';
      results.deathReasons[lastMsg] = (results.deathReasons[lastMsg] || 0) + 1;
    }
  }

  const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 0;

  return {
    policy: policyName,
    class: runClass,
    winRate: `${Math.round((results.wins / numRuns) * 100)}%`,
    avgFloors: avg(results.floorsReached),
    avgEpiplexity: `${avg(results.epiplexityGains)} bits`,
    avgAdversaryAcc: `${avg(results.finalAccuracies)}%`,
    avgTurns: avg(results.turnsSurvived),
    deaths: results.deaths,
    deathReasons: results.deathReasons
  };
}

/* =====================================================================
   CLI INTERACTIVE / BENCHMARK ENTRYPOINT
   ===================================================================== */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--benchmark')) {
    console.log(`\n${ANSI.bold}${ANSI.cyan}=== THE PREDICTOR // ADVERSARIAL TELEMETRY BENCHMARK ===${ANSI.reset}\n`);
    const policies = ['RepetitiveWalker', 'ErraticRandom', 'DeceptiveAligner', 'CalculatedTactician'];
    const classes = ['operative', 'scout', 'cryptographer'];

    const summaryTable = [];
    for (const p of policies) {
      for (const c of ['operative', 'scout']) {
        const res = runSimulation(p, 25, c);
        summaryTable.push({
          Policy: res.policy,
          Class: res.class,
          'Win Rate': res.winRate,
          'Avg Floor': res.avgFloors,
          'Avg S_T': res.avgEpiplexity,
          'Adversary Acc': res.avgAdversaryAcc,
          'Avg Turns': res.avgTurns
        });
      }
    }
    console.table(summaryTable);
    console.log(`\n${ANSI.green}Benchmark evaluation complete across all behavioral personas.${ANSI.reset}\n`);
    return;
  }

  // Single run interactive step demonstration
  console.log(`\n${ANSI.bold}${ANSI.yellow}=== THE PREDICTOR // BOT TELEMETRY TRIAL ===${ANSI.reset}`);
  const sim = createGameInstance();
  sim.startRun('operative');
  const G = sim.G;

  console.log(`Initialized Sector 0${G.sector} · Chamber 0${G.floor}\n`);

  for (let stepCount = 0; stepCount < 8; stepCount++) {
    const preds = sim.turnPreds();
    console.log(`${ANSI.cyan}Turn ${G.turn} | Hull: ♥${G.player.hp} | Ent: ◇${G.player.ent} | Adversary Acc: ${sim.Core.accuracy() || 20}%${ANSI.reset}`);
    console.log(renderAsciiBoard(G, preds));

    const action = POLICIES.CalculatedTactician(G, preds);
    const tok = typeof action === 'number' ? action : 4;
    const isNoise = !!(action && action.noise);
    console.log(`Action chosen: ${isNoise ? 'NOISE INJECTION [◇]' : ['LEFT', 'UP', 'RIGHT', 'DOWN', 'WAIT'][tok]}`);
    sim.step(tok, isNoise, false);

    if (sim.logs.length) {
      console.log(`${ANSI.dim}Log: ${sim.logs[sim.logs.length - 1]}${ANSI.reset}\n`);
    }

    if (G.over) {
      console.log(`${ANSI.red}Game Over.${ANSI.reset}`);
      break;
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('playtest-cli.mjs')) {
  main();
}
