'use strict';
/* THE PREDICTOR — Modern Hopfield Attractor & Deep Neural Sequence Core.
   Combines:
   1. Modern Continuous Hopfield Associative Memory (instant episodic sequence recall)
   2. 2-Layer Deep NNUE-style Feature Network with Online SGD & Experience Replay
   3. 3-Tier Autoregressive PAQ Context Mixing
   4. Finzi et al. (2026) Epiplexity (S_T) vs Time-Bounded Entropy (H_T) Tracker
   Survives death; saves in localStorage / Cloudflare KV. */

// Small pseudo-random float generator for deterministic weight init
function randn() {
  const u = Math.max(0.0001, Math.random());
  const v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/* =====================================================================
   1. MODERN CONTINUOUS HOPFIELD ASSOCIATIVE MEMORY
   ===================================================================== */
const HopfieldMemory = {
  capacity: 96,
  keys: [], // array of [last3, last2, last1]
  vals: [], // array of target tok (0..4)
  beta: 3.5, // inverse temperature for sharp associative retrieval

  clear() {
    this.keys = [];
    this.vals = [];
  },

  store(last3, last2, last1, nextTok) {
    if (nextTok < 0 || nextTok >= 5) return;
    this.keys.push([last3, last2, last1]);
    this.vals.push(nextTok);
    if (this.keys.length > this.capacity) {
      this.keys.shift();
      this.vals.shift();
    }
  },

  query(last3, last2, last1) {
    if (!this.keys.length) return [0.2, 0.2, 0.2, 0.2, 0.2];
    const q = [last3, last2, last1];
    const scores = new Float64Array(this.keys.length);
    let maxScore = -Infinity;

    for (let i = 0; i < this.keys.length; i++) {
      const k = this.keys[i];
      let sim = 0;
      if (k[2] === q[2]) sim += 2.0; // immediate predecessor has highest weight
      if (k[1] === q[1]) sim += 1.2;
      if (k[0] === q[0]) sim += 0.8;
      if (k[2] === q[2] && k[1] === q[1]) sim += 1.5; // consecutive bigram bonus
      const s = sim * this.beta;
      scores[i] = s;
      if (s > maxScore) maxScore = s;
    }

    // Softmax attention
    let sumExp = 0;
    const weights = new Float64Array(this.keys.length);
    for (let i = 0; i < scores.length; i++) {
      const w = Math.exp(scores[i] - maxScore);
      weights[i] = w;
      sumExp += w;
    }

    const dist = [0.01, 0.01, 0.01, 0.01, 0.01]; // small prior
    let totalD = 0.05;
    if (sumExp > 0) {
      for (let i = 0; i < this.keys.length; i++) {
        const p = weights[i] / sumExp;
        const tok = this.vals[i];
        dist[tok] += p;
        totalD += p;
      }
    }
    return dist.map(v => v / totalD);
  }
};

/* =====================================================================
   2. DEEP NEURAL NETWORK (NNUE FEATURE TRANSFORMER + ATTRACTOR BASIN)
   ===================================================================== */
const NeuralNet = {
  inDim: 64,  // 25 bigrams (t-2, t-1), 25 bigrams (t-3, t-2), 10 one-hots (t-1, t-2), 4 spatial walls
  hidDim: 24,
  outDim: 5,
  W1: null,
  b1: null,
  W2: null,
  b2: null,
  lastH: null,
  lastP: null,
  lr: 0.12,
  replayBuffer: [],
  replayCapacity: 48,

  init() {
    this.W1 = Array.from({ length: this.hidDim }, () =>
      Array.from({ length: this.inDim }, () => randn() * 0.15)
    );
    this.b1 = new Array(this.hidDim).fill(0);
    this.W2 = Array.from({ length: this.outDim }, () =>
      Array.from({ length: this.hidDim }, () => randn() * 0.15)
    );
    this.b2 = new Array(this.outDim).fill(0);
    this.lastH = new Array(this.hidDim).fill(0);
    this.lastP = new Array(this.outDim).fill(0.2);
    this.replayBuffer = [];
  },

  encodeInput(last1 = 4, last2 = 4, last3 = 4, dx = 0, dy = 0, wallsNear = [0, 0, 0, 0]) {
    const x = new Array(this.inDim).fill(0);
    const l1 = Math.max(0, Math.min(4, last1));
    const l2 = Math.max(0, Math.min(4, last2));
    const l3 = Math.max(0, Math.min(4, last3));

    // Bigram features: (last2, last1) -> 25 features [0..24]
    x[l2 * 5 + l1] = 1.0;

    // High-order Bigram features: (last3, last2) -> 25 features [25..49]
    x[25 + l3 * 5 + l2] = 1.0;

    // Unigram recency one-hots [50..54] and [55..59]
    x[50 + l1] = 1.0;
    x[55 + l2] = 1.0;

    // Spatial wall proximity: N, S, E, W blocked [60..63]
    for (let w = 0; w < 4; w++) {
      x[60 + w] = wallsNear[w] ? 1.0 : 0.0;
    }

    return x;
  },

  forward(x) {
    // Hidden layer 1: tanh activation (Attractor Basin)
    const h = new Array(this.hidDim).fill(0);
    for (let j = 0; j < this.hidDim; j++) {
      let sum = this.b1[j];
      const wRow = this.W1[j];
      for (let i = 0; i < this.inDim; i++) {
        if (x[i] !== 0) sum += wRow[i] * x[i];
      }
      h[j] = Math.tanh(sum);
    }
    this.lastH = h.slice();

    // Output logits
    const logits = new Array(this.outDim).fill(0);
    for (let k = 0; k < this.outDim; k++) {
      let sum = this.b2[k];
      const wRow = this.W2[k];
      for (let j = 0; j < this.hidDim; j++) {
        sum += wRow[j] * h[j];
      }
      logits[k] = sum;
    }

    // Stable Softmax
    const maxL = Math.max(...logits);
    const exps = logits.map(v => Math.exp(Math.max(-50, Math.min(50, v - maxL))));
    const sumExps = exps.reduce((a, b) => a + b, 0);
    const p = exps.map(v => v / (sumExps || 1));
    this.lastP = p.slice();
    return p;
  },

  _gradStep(x, targetTok) {
    const p = this.forward(x);
    const loss = -Math.log2(Math.max(0.001, p[targetTok]));

    // Gradient of cross-entropy w.r.t logits: dL/dz_k = p_k - 1(k == target)
    const dLogits = p.map((prob, k) => prob - (k === targetTok ? 1 : 0));

    // Gradients for W2 and b2
    const dH = new Array(this.hidDim).fill(0);
    for (let k = 0; k < this.outDim; k++) {
      const grad = dLogits[k];
      this.b2[k] -= this.lr * grad;
      const wRow = this.W2[k];
      for (let j = 0; j < this.hidDim; j++) {
        dH[j] += grad * wRow[j];
        wRow[j] -= this.lr * grad * this.lastH[j];
      }
    }

    // Gradients for W1 and b1: dL/dh_j * (1 - tanh^2)
    for (let j = 0; j < this.hidDim; j++) {
      const dSum = dH[j] * (1.0 - this.lastH[j] * this.lastH[j]);
      this.b1[j] -= this.lr * dSum;
      const wRow = this.W1[j];
      for (let i = 0; i < this.inDim; i++) {
        if (x[i] !== 0) wRow[i] -= this.lr * dSum * x[i];
      }
    }

    return loss;
  },

  trainStep(x, targetTok) {
    if (targetTok < 0 || targetTok >= 5) return 2.32;
    const loss = this._gradStep(x, targetTok);

    // Save to replay buffer
    this.replayBuffer.push({ x, tok: targetTok });
    if (this.replayBuffer.length > this.replayCapacity) {
      this.replayBuffer.shift();
    }

    // Experience replay mini-epoch: sample 2 past transitions to prevent forgetting
    if (this.replayBuffer.length >= 4) {
      for (let r = 0; r < 2; r++) {
        const idx = Math.floor(Math.random() * this.replayBuffer.length);
        const sample = this.replayBuffer[idx];
        this._gradStep(sample.x, sample.tok);
      }
    }

    return loss;
  },

  injectNoise(magnitude = 0.5) {
    // Injects cryptographic noise into attractor basin (Theorem 17)
    if (!this.lastH) return;
    for (let j = 0; j < this.hidDim; j++) {
      this.lastH[j] += (Math.random() - 0.5) * magnitude;
      this.b1[j] += (Math.random() - 0.5) * magnitude * 0.2;
    }
  }
};

/* =====================================================================
   3. ADAPTIVE ENSEMBLE CORE (PAQ + NNUE + HOPFIELD)
   ===================================================================== */
const Core = {
  c0: new Array(5).fill(0),
  c1: Array.from({ length: 5 }, () => new Array(5).fill(0)),
  c2: Array.from({ length: 25 }, () => new Array(5).fill(0)),
  acc: [ { p: 0, h: 0 }, { p: 0, h: 0 }, { p: 0, h: 0 } ],
  modelAcc: {
    paq: { p: 0, h: 0 },
    nn: { p: 0, h: 0 },
    hopfield: { p: 0, h: 0 }
  },
  n: 0,
  runs: 0,
  lifeP: 0,
  lifeH: 0,
  warden: [],                        // 'one' | 'two' Newcomb choice history
  theft: { oT: 0, oO: 0, uT: 0, uO: 0 },
  dossier: {
    exitSeeker: 0,
    collector: 0,
    ritualist: 0,
    caretaker: 0,
    noiseAddict: 0,
    betrayals: 0,
    records: []
  },
  ent: 0,                            // lifetime entropy spent
  epiplexityLifetime: 0,
  lastLoss: 2.32,
  dirty: false,

  init() {
    NeuralNet.init();
    HopfieldMemory.clear();
    if (!this.dossier) {
      this.dossier = { exitSeeker: 0, collector: 0, ritualist: 0, caretaker: 0, noiseAddict: 0, betrayals: 0, records: [] };
    }
  },

  dist(order, last1, last2) {
    const l1 = Math.max(0, Math.min(4, last1));
    const l2 = Math.max(0, Math.min(4, last2));
    const row = order === 0 ? this.c0 : (order === 1 ? this.c1[l1] : this.c2[l2 * 5 + l1]);
    const total = row.reduce((a, b) => a + b, 0);
    return total > 0 ? row.map(v => v / total) : null;
  },

  mix(last1 = 4, last2 = 4, last3 = 4, dx = 0, dy = 0, wallsNear = [0, 0, 0, 0]) {
    // 1. Classical PAQ Context Mixing (Order 0, 1, 2)
    const paqOut = new Array(5).fill(0);
    let paqWeightSum = 0;
    for (let o = 0; o < 3; o++) {
      const d = this.dist(o, last1, last2);
      if (!d) continue;
      const a = this.acc[o];
      const w = ((a.h + 1) / (a.p + 2)) * (o + 1.2);
      paqWeightSum += w;
      for (let i = 0; i < 5; i++) paqOut[i] += w * d[i];
    }
    const paqP = paqWeightSum > 0 ? paqOut.map(v => v / paqWeightSum) : [0.2, 0.2, 0.2, 0.2, 0.2];

    // 2. Neural Sequence Net Forward
    const x = NeuralNet.encodeInput(last1, last2, last3, dx, dy, wallsNear);
    const nnP = NeuralNet.forward(x);

    // 3. Modern Hopfield Associative Memory Query
    const hopP = HopfieldMemory.query(last3, last2, last1);

    // 4. Adaptive Ensemble Weighting based on empirical track records
    const wPaq = (this.modelAcc.paq.h + 1) / (this.modelAcc.paq.p + 2);
    const wNN = (this.modelAcc.nn.h + 1) / (this.modelAcc.nn.p + 2);
    const wHop = (this.modelAcc.hopfield.h + 1) / (this.modelAcc.hopfield.p + 2);
    const totalW = wPaq + wNN + wHop;

    const blended = new Array(5).fill(0);
    for (let i = 0; i < 5; i++) {
      blended[i] = (wPaq * paqP[i] + wNN * nnP[i] + wHop * hopP[i]) / totalW;
    }

    // Renormalize
    const bSum = blended.reduce((a, b) => a + b, 0);
    return bSum > 0 ? blended.map(v => v / bSum) : [0.2, 0.2, 0.2, 0.2, 0.2];
  },

  update(tok, last1 = 4, last2 = 4, last3 = 4, dx = 0, dy = 0, wallsNear = [0, 0, 0, 0]) {
    if (tok < 0 || tok >= 5) return;

    // Update PAQ order accuracies
    for (let o = 0; o < 3; o++) {
      const d = this.dist(o, last1, last2);
      if (d) {
        this.acc[o].p++;
        if (d.indexOf(Math.max(...d)) === tok) this.acc[o].h++;
      }
    }

    // Evaluate submodel predictions prior to training
    const x = NeuralNet.encodeInput(last1, last2, last3, dx, dy, wallsNear);
    const curNN = NeuralNet.forward(x);
    this.modelAcc.nn.p++;
    if (curNN.indexOf(Math.max(...curNN)) === tok) this.modelAcc.nn.h++;

    const curHop = HopfieldMemory.query(last3, last2, last1);
    this.modelAcc.hopfield.p++;
    if (curHop.indexOf(Math.max(...curHop)) === tok) this.modelAcc.hopfield.h++;

    const m = this.mix(last1, last2, last3, dx, dy, wallsNear);
    if (m) {
      this.lifeP++;
      if (m.indexOf(Math.max(...m)) === tok) this.lifeH++;
    }

    // Update n-gram counts
    const l1 = Math.max(0, Math.min(4, last1));
    const l2 = Math.max(0, Math.min(4, last2));
    this.c0[tok]++;
    this.c1[l1][tok]++;
    this.c2[l2 * 5 + l1][tok]++;

    // Store in Modern Hopfield associative memory
    HopfieldMemory.store(last3, last2, last1, tok);

    // Train neural network online SGD
    const loss = NeuralNet.trainStep(x, tok);
    this.lastLoss = loss;

    // Finzi et al. (2026) Epiplexity tracking: S_T = sum(H_max - CrossEntropyLoss)
    const epiplexityGain = Math.max(0, 2.3219 - loss);
    this.epiplexityLifetime += epiplexityGain;

    this.n++;
    this.dirty = true;

    // Slow decay every 500 moves to allow adaptation to evolving human play
    if (this.n % 500 === 0) {
      const decay = r => { for (let i = 0; i < 5; i++) r[i] *= 0.9; };
      decay(this.c0);
      this.c1.forEach(decay);
      this.c2.forEach(decay);
    }
  },

  accuracy() {
    return this.lifeP > 0 ? Math.round(100 * this.lifeH / this.lifeP) : null;
  },

  recordNewcomb(choice) {
    if (choice === 'one' || choice === 'two') {
      this.warden.push(choice);
      if (this.warden.length > 50) this.warden.shift();
      if (!this.dossier) this.dossier = { exitSeeker: 0, collector: 0, ritualist: 0, caretaker: 0, noiseAddict: 0, betrayals: 0, records: [] };
      if (choice === 'one') {
        this.dossier.collector = Math.max(-5, this.dossier.collector - 1);
      } else {
        this.dossier.collector = Math.min(5, this.dossier.collector + 1);
      }
      this.dirty = true;
    }
  },

  predictNewcomb() {
    // Computes whether the Warden predicts player will one-box or two-box
    let oneBoxProb = 0.5;
    if (this.warden.length > 0) {
      const ones = this.warden.filter(c => c === 'one').length;
      oneBoxProb = ones / this.warden.length;
    } else {
      const thefts = this.theft.oT + this.theft.uT;
      const opps = this.theft.oO + this.theft.uO;
      const theftRate = opps > 0 ? thefts / opps : 0.5;
      const coll = (this.dossier && this.dossier.collector) || 0;
      oneBoxProb = Math.max(0.05, Math.min(0.95, 1 - (theftRate * 0.7 + (coll + 5) / 10 * 0.3)));
    }
    const predicted = oneBoxProb >= 0.5 ? 'one' : 'two';
    const conf = Math.round(Math.abs(oneBoxProb - 0.5) * 200);
    return {
      predicted,
      oneBoxProb,
      confidence: Math.max(50, 50 + Math.round(conf / 2)),
      explanation: predicted === 'one'
        ? `Model infers disciplined restraint (${Math.round(oneBoxProb * 100)}% one-box probability).`
        : `Model infers opportunistic acquisition (${Math.round((1 - oneBoxProb) * 100)}% two-box probability).`
    };
  },

  recordTheft(observed, taken) {
    if (observed) {
      this.theft.oO++;
      if (taken) this.theft.oT++;
    } else {
      this.theft.uO++;
      if (taken) this.theft.uT++;
    }
    if (!this.dossier) this.dossier = { exitSeeker: 0, collector: 0, ritualist: 0, caretaker: 0, noiseAddict: 0, betrayals: 0, records: [] };
    if (taken) this.dossier.collector = Math.min(5, this.dossier.collector + 1);
    this.dirty = true;
  },

  updateDossier(delta, autopsySummary = '') {
    if (!this.dossier) {
      this.dossier = { exitSeeker: 0, collector: 0, ritualist: 0, caretaker: 0, noiseAddict: 0, betrayals: 0, records: [] };
    }
    const clamp = v => Math.max(-5, Math.min(5, Math.round(v)));
    if (delta.exitSeeker) this.dossier.exitSeeker = clamp(this.dossier.exitSeeker + delta.exitSeeker);
    if (delta.collector) this.dossier.collector = clamp(this.dossier.collector + delta.collector);
    if (delta.ritualist) this.dossier.ritualist = clamp(this.dossier.ritualist + delta.ritualist);
    if (delta.caretaker) this.dossier.caretaker = clamp(this.dossier.caretaker + delta.caretaker);
    if (delta.noiseAddict) this.dossier.noiseAddict = clamp(this.dossier.noiseAddict + delta.noiseAddict);
    if (delta.betrayals) this.dossier.betrayals = (this.dossier.betrayals || 0) + delta.betrayals;

    if (autopsySummary) {
      this.dossier.records.unshift({
        time: Date.now(),
        summary: autopsySummary,
        traits: {
          exitSeeker: this.dossier.exitSeeker,
          collector: this.dossier.collector,
          ritualist: this.dossier.ritualist,
          caretaker: this.dossier.caretaker,
          noiseAddict: this.dossier.noiseAddict,
          betrayals: this.dossier.betrayals
        }
      });
      if (this.dossier.records.length > 10) this.dossier.records.pop();
    }
    this.dirty = true;
  },

  redactTrait(trait) {
    if (this.dossier && trait in this.dossier) {
      this.dossier[trait] = 0;
      this.dirty = true;
      return true;
    }
    return false;
  },

  pack() {
    return JSON.stringify({
      c0: this.c0, c1: this.c1, c2: this.c2,
      acc: this.acc,
      modelAcc: this.modelAcc,
      n: this.n, runs: this.runs,
      lifeP: this.lifeP, lifeH: this.lifeH,
      warden: this.warden, theft: this.theft, ent: this.ent,
      dossier: this.dossier,
      epiplexityLifetime: this.epiplexityLifetime,
      W1: NeuralNet.W1, b1: NeuralNet.b1, W2: NeuralNet.W2, b2: NeuralNet.b2,
      hopKeys: HopfieldMemory.keys,
      hopVals: HopfieldMemory.vals
    });
  },

  unpack(raw) {
    try {
      const d = JSON.parse(raw);
      if (!d || !Array.isArray(d.c0) || d.c0.length !== 5) return false;
      Object.assign(this, d);
      if (!this.dossier) {
        this.dossier = { exitSeeker: 0, collector: 0, ritualist: 0, caretaker: 0, noiseAddict: 0, betrayals: 0, records: [] };
      }
      if (d.W1 && d.b1 && d.W2 && d.b2) {
        NeuralNet.W1 = d.W1;
        NeuralNet.b1 = d.b1;
        NeuralNet.W2 = d.W2;
        NeuralNet.b2 = d.b2;
      } else {
        NeuralNet.init();
      }
      if (Array.isArray(d.hopKeys) && Array.isArray(d.hopVals)) {
        HopfieldMemory.keys = d.hopKeys;
        HopfieldMemory.vals = d.hopVals;
      } else {
        HopfieldMemory.clear();
      }
      return true;
    } catch (e) {
      return false;
    }
  },

  reset() {
    this.c0.fill(0);
    this.c1.forEach(r => r.fill(0));
    this.c2.forEach(r => r.fill(0));
    this.acc = [{ p: 0, h: 0 }, { p: 0, h: 0 }, { p: 0, h: 0 }];
    this.modelAcc = { paq: { p: 0, h: 0 }, nn: { p: 0, h: 0 }, hopfield: { p: 0, h: 0 } };
    this.n = 0;
    this.runs = 0;
    this.lifeP = 0;
    this.lifeH = 0;
    this.warden = [];
    this.theft = { oT: 0, oO: 0, uT: 0, uO: 0 };
    this.dossier = { exitSeeker: 0, collector: 0, ritualist: 0, caretaker: 0, noiseAddict: 0, betrayals: 0, records: [] };
    this.ent = 0;
    this.epiplexityLifetime = 0;
    this.lastLoss = 2.32;
    NeuralNet.init();
    HopfieldMemory.clear();
    this.dirty = true;
  }
};

Core.init();

async function saveCore() {
  Core.dirty = false;
  await Store.set(KEYS.core, Core.pack());
}

async function loadCore() {
  const raw = await Store.get(KEYS.core);
  if (raw) Core.unpack(raw);
}

async function wipeCore() {
  Core.reset();
  await Store.del(KEYS.core);
}
