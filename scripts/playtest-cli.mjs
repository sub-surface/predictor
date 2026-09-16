import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const coreCode = readFileSync(resolve(root, 'public/js/core.js'), 'utf8');
const gameCode = readFileSync(resolve(root, 'public/js/game.js'), 'utf8');

export function createGameInstance() {
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
  vm.runInContext(gameCode + '\nglobalThis.G = G; globalThis.step = step; globalThis.startRun = startRun; globalThis.startCrucible = startCrucible; globalThis.selectSectorNode = selectSectorNode; globalThis.getTurnPreds = getTurnPreds; globalThis.FX = FX;', context);

  return {
    Core: context.Core,
    G: context.G,
    step: context.step,
    startRun: context.startRun,
    selectSectorNode: context.selectSectorNode,
    turnPreds: () => context.getTurnPreds ? context.getTurnPreds() : [],
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
// Helper BFS pathfinding function
function computeBfs(G, targetX, targetY, isWalkable) {
  const dist = new Int32Array(G.W * G.H).fill(999);
  if (targetX < 0 || targetX >= G.W || targetY < 0 || targetY >= G.H) return dist;
  const queue = [{ x: targetX, y: targetY, d: 0 }];
  dist[targetY * G.W + targetX] = 0;
  while (queue.length > 0) {
    const { x, y, d } = queue.shift();
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < G.W && ny >= 0 && ny < G.H) {
        const idx = ny * G.W + nx;
        if (dist[idx] === 999 && isWalkable(nx, ny)) {
          dist[idx] = d + 1;
          queue.push({ x: nx, y: ny, d: d + 1 });
        }
      }
    }
  }
  return dist;
}

export const POLICIES = {
  // 1. Repetitive Habit Walker (Moves in predictable cycles)
  RepetitiveWalker(G, preds) {
    const cycle = [2, 3, 0, 1]; // Right, Down, Left, Up
    const tok = cycle[G.turn % cycle.length];
    return tok;
  },

  // 2. Erratic Random (Injects maximum noise)
  ErraticRandom(G, preds) {
    if (G.player.ent > 0 && Math.random() < 0.6) {
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
    const isLockedVault = (x, y) => G.items.some(it => it.type === 'vault' && it.x === x && it.y === y && G.trace < 40);
    const isWalkable = (x, y) => inB(x, y) && !isWall(x, y) && !isLockedVault(x, y) && !(isMass(x, y) && (G.massFavor || 0) <= 0);

    // If Scout has knight moves, evaluate knight leap strikes (bypasses parry)
    if (G.hasKnight) {
      const KNIGHT_MOVES = [
        { dx: -1, dy: -2 }, { dx: 1, dy: -2 },
        { dx: -2, dy: -1 }, { dx: 2, dy: -1 },
        { dx: -2, dy:  1 }, { dx: 2, dy:  1 },
        { dx: -1, dy:  2 }, { dx: 1, dy:  2 }
      ];
      for (const km of KNIGHT_MOVES) {
        const kx = G.player.x + km.dx, ky = G.player.y + km.dy;
        if (isWalkable(kx, ky)) {
          const target = G.enemies.find(e => e.x === kx && e.y === ky);
          if (target) return { knight: true, move: km };
        }
      }
    }

    // BFS distance map to stairs
    const distStairs = G.stairs ? computeBfs(G, G.stairs.x, G.stairs.y, isWalkable) : null;
    const playerDistStairs = distStairs ? distStairs[G.player.y * G.W + G.player.x] : 999;

    // Find nearest collectible item
    let nearestItem = null;
    let nearestItemDist = 999;
    for (const it of G.items) {
      if (it.type === 'vault' && G.trace < 40) continue;
      const d = Math.abs(it.x - G.player.x) + Math.abs(it.y - G.player.y);
      if (d < nearestItemDist) {
        nearestItemDist = d;
        nearestItem = it;
      }
    }
    const distItem = nearestItem ? computeBfs(G, nearestItem.x, nearestItem.y, isWalkable) : null;
    const playerDistItem = distItem ? distItem[G.player.y * G.W + G.player.x] : 999;

    const scores = [];
    for (const d of DIRS) {
      const nx = G.player.x + d.dx;
      const ny = G.player.y + d.dy;
      if (!isWalkable(nx, ny)) continue;

      let score = 0;
      const targetEnemy = G.enemies.find(e => e.x === nx && e.y === ny);

      // Combat resolution
      if (targetEnemy) {
        const enemyPred = preds.find(p => p.e === targetEnemy);
        const parried = !G.hasBishop && enemyPred && enemyPred.x === nx && enemyPred.y === ny;
        if (parried) {
          score -= 2000; // Do not attack into parry
        } else {
          score += 250; // Flank attack!
          if (targetEnemy.type === 'avatar' && targetEnemy.hp <= 2) score += 500;
        }
      } else {
        // Move towards stairs
        if (distStairs) {
          const nextDist = distStairs[ny * G.W + nx];
          if (nextDist < playerDistStairs) score += 30 * (playerDistStairs - nextDist);
          else if (nextDist > playerDistStairs) score -= 10;
        }

        // Move towards item if close
        if (distItem && playerDistItem <= 5) {
          const nextItemDist = distItem[ny * G.W + nx];
          if (nextItemDist < playerDistItem) score += 25 * (playerDistItem - nextItemDist);
        }

        // Collect item
        if (G.items.some(it => it.x === nx && it.y === ny)) {
          score += 45;
        }

        // Flanking setup: adjacent to enemy without being in their line of fire
        const adjToEnemy = G.enemies.some(e => Math.abs(e.x - nx) + Math.abs(e.y - ny) === 1);
        if (adjToEnemy) score += 20;
      }

      // Threat evaluation
      const pred = preds.find(p => p.x === nx && p.y === ny);
      if (pred) {
        const inRange = Math.max(Math.abs(pred.e.x - nx), Math.abs(pred.e.y - ny)) <= pred.e.range;
        if (inRange) {
          if ((G.proofs || 0) > 0) {
            score -= 10; // Proof absorbs hit safely
          } else if (G.countermeasures && G.countermeasures.some(c => c.id === 'warrant_magnet')) {
            const nearWall = DIRS.slice(0, 4).some(dr => isWall(nx + dr.dx, ny + dr.dy));
            if (nearWall) score -= 5; // Grounded safely
            else score -= 300;
          } else {
            score -= 300; // Danger
          }
        }
      }

      // Discourage trivial back-and-forth oscillation
      if (d.tok !== 4 && G.last1 !== undefined) {
        const opp = (G.last1 === 0 ? 2 : (G.last1 === 2 ? 0 : (G.last1 === 1 ? 3 : (G.last1 === 3 ? 1 : -1))));
        if (d.tok === opp && !targetEnemy) score -= 15;
      }

      scores.push({ tok: d.tok, score });
    }

    if (!scores.length) return 4;
    scores.sort((a, b) => b.score - a.score);

    // If top move is threatened and we have emergency options:
    if (scores[0].score < 0) {
      if (G.player.ent > 0) return { noise: true };
      if (G.countermeasures && G.countermeasures.some(c => c.id === 'decoy_credential') && G.trace >= 15 && !G.decoy) {
        return 4; // Deploy decoy!
      }
    }

    return scores[0].tok;
  },

  // 4. Deceptive Aligner (Builds 3-beat rhythm proofs, then executes flank strikes)
  DeceptiveAligner(G, preds) {
    // If player has ritual_compiler and proofs < 2, build proofs by repeating move or wait!
    if (G.countermeasures && G.countermeasures.some(c => c.id === 'ritual_compiler') && (G.proofs || 0) < 2) {
      const nearThreat = G.enemies.some(e => Math.max(Math.abs(e.x - G.player.x), Math.abs(e.y - G.player.y)) <= 2);
      if (!nearThreat && G.rhythmChain < 3) {
        return 4; // Safe wait to compile proof!
      }
    }

    // Exploit Betrayal: if an enemy is predicting with high confidence (>= 0.50), strike or flank!
    const highConf = preds.find(p => p.conf >= 0.50);
    if (highConf) {
      const adjEnemies = G.enemies.filter(e => Math.abs(e.x - G.player.x) + Math.abs(e.y - G.player.y) === 1);
      for (const e of adjEnemies) {
        const p = preds.find(pr => pr.e === e);
        const parried = p && p.x === e.x && p.y === e.y;
        if (!parried) {
          const DIRS = [{dx:-1,dy:0,tok:0},{dx:0,dy:-1,tok:1},{dx:1,dy:0,tok:2},{dx:0,dy:1,tok:3}];
          const d = DIRS.find(dr => G.player.x + dr.dx === e.x && G.player.y + dr.dy === e.y);
          if (d) return d.tok;
        }
      }
    }

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
      } else if (action && typeof action === 'object' && action.knight) {
        sim.step(4, false, true, action.move);
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

    if (G.won || (G.player.hp > 0 && (G.floor >= 4 || G.sector >= 4))) {
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

  for (let stepCount = 0; stepCount < 25; stepCount++) {
    const preds = sim.turnPreds();
    console.log(`${ANSI.cyan}SEC 0${G.sector} · CH 0${G.floor} | Turn ${G.turn} | Hull: ♥${G.player.hp} | Gems: ✶${G.player.gems} | Ent: ◇${G.player.ent} | Trace: ${G.trace}% | Adversary Acc: ${sim.Core.accuracy() || 20}%${ANSI.reset}`);
    console.log(renderAsciiBoard(G, preds));

    const action = POLICIES.CalculatedTactician(G, preds);
    const isNoise = !!(action && action.noise);
    const isKnight = !!(action && action.knight);
    const tok = typeof action === 'number' ? action : 4;

    let actionLabel = 'WAIT';
    if (isNoise) actionLabel = 'NOISE INJECTION [◇]';
    else if (isKnight) actionLabel = `KNIGHT LEAP [${action.move.dx}, ${action.move.dy}]`;
    else actionLabel = ['LEFT', 'UP', 'RIGHT', 'DOWN', 'WAIT'][tok];

    console.log(`Action chosen: ${actionLabel}`);
    sim.step(tok, isNoise, isKnight, isKnight ? action.move : null);

    if (sim.logs.length) {
      console.log(`${ANSI.dim}Log: ${sim.logs[sim.logs.length - 1]}${ANSI.reset}\n`);
    }

    if (G.over) {
      console.log(`${G.won ? ANSI.green + 'VICTORY ACHIEVED!' : ANSI.red + 'Game Over.'}${ANSI.reset}`);
      break;
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith('playtest-cli.mjs')) {
  main();
}
