import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");
const coreSource = readFileSync(resolve(root, "public/js/core.js"), "utf8");

// Mock environment
const context = {
  KEYS: { core: "tp_core_v3" },
  Store: {
    set: async () => {},
    get: async () => null,
    del: async () => {}
  }
};

vm.createContext(context);
vm.runInContext(coreSource + "\nglobalThis.Core = Core;", context);

const { Core } = context;

function assert(condition, msg) {
  if (!condition) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

// 1. Initial State
assert(Core.n === 0, "Core should initialize with 0 updates");
assert(Core.accuracy() === null, "Core accuracy should be null initially");

// 2. Training updates
// Feed repetitive sequence: Left (0) -> Up (1) -> Left (0) -> Up (1)
let last1 = 4, last2 = 4;
for (let i = 0; i < 20; i++) {
  const tok = i % 2 === 0 ? 0 : 1;
  Core.update(tok, last1, last2);
  last2 = last1;
  last1 = tok;
}

assert(Core.n === 20, "Core should record 20 updates");
assert(Core.c0[0] === 10 && Core.c0[1] === 10, "Order-0 counts should be 10 for Left and Up");
assert(Core.lifeP > 0, "Core should record predictions");

// 3. Mixing model
const dist = Core.mix(0, 1);
assert(dist !== null, "Mix should return a distribution");
assert(Array.isArray(dist) && dist.length === 5, "Mix should have 5 action probabilities");
const sum = dist.reduce((a, b) => a + b, 0);
assert(Math.abs(sum - 1.0) < 0.001, "Probabilities must sum to 1.0");

// 4. Persistence Roundtrip
const packed = Core.pack();
assert(typeof packed === "string", "Packed representation must be string");
Core.reset();
assert(Core.n === 0, "Reset should clear counts");
const unpacked = Core.unpack(packed);
assert(unpacked === true, "Unpack must succeed");
assert(Core.n === 20, "Unpack must restore count");

// 5. Hopfield Associative Memory Recognition
// Sequence: Left (0) -> Up (1) -> Left (0) -> Up (1)
const hopDist = Core.mix(1, 0, 1);
assert(hopDist[0] > hopDist[2] && hopDist[0] > hopDist[3], "Hopfield + PAQ must strongly predict Left (0) after sequence [1, 0, 1]");

console.log("Core model tests passed successfully!");

