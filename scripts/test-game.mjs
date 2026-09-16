import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");
const coreCode = readFileSync(resolve(root, "public/js/core.js"), "utf8");
const gameCode = readFileSync(resolve(root, "public/js/game.js"), "utf8");

const context = {
  KEYS: { core: "tp_core_v3" },
  Store: { set: async () => {}, get: async () => null, del: async () => {} },
  S: { sound: true },
  SFX: { move: () => {}, echo: () => {}, hit: () => {}, kill: () => {}, pick: () => {}, gate: () => {} },
  say: () => {},
  drawAll: () => {},
  showModal: () => {},
  hideModal: () => {},
  document: {
    body: {
      classList: {
        remove: () => {},
        add: () => {}
      }
    }
  }
};

vm.createContext(context);
vm.runInContext(coreCode + "\nglobalThis.Core = Core;", context);
vm.runInContext(gameCode + "\nglobalThis.G = G; globalThis.step = step; globalThis.startCrucible = startCrucible; globalThis.startRun = startRun; globalThis.initCrucibleStage = initCrucibleStage;", context);

const { G, step, startCrucible, startRun, initCrucibleStage } = context;

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

// Test 1: Start Crucible Stage 0
startCrucible();
assert(G.active === true, "Game must be active");
assert(G.mode === "crucible", "Mode must be crucible");
assert(G.crucibleStage === 0, "Stage must be 0");
assert(G.W === 5 && G.H === 5, "Crucible must be 5x5");
assert(G.player.x === 1 && G.player.y === 1, "Player start pos (1,1)");

// Step Right (tok=2) -> should land on (2,1)
step(2);
assert(G.player.x === 2 && G.player.y === 1, "Player moved right to (2,1)");

// Step Down (tok=3) -> should land on (2,2)
step(3);
assert(G.player.x === 2 && G.player.y === 2, "Player moved down to (2,2)");

// Step Right (tok=2) -> should land on (3,2)
step(2);
assert(G.player.x === 3 && G.player.y === 2, "Player moved right to (3,2)");

// Step Down (tok=3) -> lands on Stairs (3,3) -> advances to Stage 1!
step(3);
assert(G.crucibleStage === 1, "Crucible should advance to Stage 1 upon reaching stairs");
assert(G.enemies.length === 1, "Stage 1 must have 1 Drone");

// Test 2: Active Run
startRun('operative');
assert(G.mode === "run", "Mode must be run");
assert(G.floor === 1, "Start floor must be 1");
assert(G.W === 7 && G.H === 7, "Run board must be 7x7");
assert(G.player.hp === 3, "Player starts with 3 HP");
assert(G.stairs !== null, "Stairs must be generated");
assert(G.sectorMap !== null && G.sectorMap.layers.length === 4, "Sector map must have 4 layers");

// Test 3: Alternative Classes
startRun('scout');
assert(G.runClass === 'scout' && G.hasKnight === true && G.player.hp === 2, "Scout starts with Knight leap and 2 HP");

startRun('cryptographer');
assert(G.runClass === 'cryptographer' && G.player.ent === 3, "Cryptographer starts with 3 Entropy");

console.log("Game deterministic mechanics tests passed successfully!");

