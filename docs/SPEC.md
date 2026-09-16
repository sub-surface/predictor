# THE PREDICTOR — Design Specification & Master Roadmap

*Version 2.0 · The Epiplexic Engine*

**Core Thesis:** A turn-based roguelike where the antagonist is trained on you. Every unit hunting you maintains a live, visible model of your movement patterns; the persistent Core trains on every action across every run and never resets on death. Legibility is the central currency: it gets you zapped by adversaries and trusted by everything else.

---

## 1. Theoretical & Ludological Foundations

### 1.1 Epiplexity vs. Time-Bounded Entropy (Finzi et al., March 2026)
Classical Shannon entropy ($H$) and Kolmogorov complexity ($K$) fail to model real machine-learning adversaries because they assume an observer with infinite computational capacity. Following **Finzi et al. (2026)**, the total information of the player's movement stream under a computationally bounded adversary ($T$) decomposes into two distinct quantities:
$$\text{MDL}_T(X) = S_T(X) + H_T(X)$$

1. **Time-Bounded Entropy ($H_T(X)$) — Uncompressible Noise:**
   * The residual unpredictability that cannot be learned within time $T$ (e.g. pseudorandom moves, erratic coin-flips).
   * High $H_T$ shields the player from targeting locks, but yields zero transferable structure to future encounters.
   * *Theorem 17 (CSPRNG Lower Bound):* Pseudorandom bits have near-maximal time-bounded entropy and negligible epiplexity. When a player uses an Entropy move (`[N]`), it acts as a cryptographic disruption that overloads the adversary's targeting matrix.

2. **Epiplexity ($S_T(X)$) — Extractable Structural Information:**
   * The amount of learnable structure internalized into the model's parameters/weights:
     $$S_T \approx \sum_{i=0}^{M-1} \left(\log \frac{1}{P_i(Z_i)} - \log \frac{1}{P_M(Z_i)}\right)$$
   * Empirically measured as **the area under the training loss curve (AUC) above the final loss**.
   * High epiplexity means the adversary has synthesized reusable circuits to predict the player across unseen environments.

### 1.2 Generative Recursive Reasoning (Baek et al., May 2026)
Prior recursive models follow deterministic trajectories. Under **GRAM (Generative Recursive Reasoning Models)**, reasoning evolves as a stochastic latent trajectory.
* In *The Predictor*, advanced bosses (The Avatar, The Basilisk) branch multi-trajectory hypotheses when the player's behavior exhibits high variance, painting overlapping probability corridors across the board.
* The player can unlock **Recursive Jump protocols** to explore multiple ghost trajectories before collapsing into the unpredicted state.

### 1.3 The Falsifiable Dynamics Hypothesis (MDA & Burgun)
1. **The Strike Paradox:** You cannot defeat adversaries by passively avoiding prediction stains. Striking an enemy from a predicted vector results in a **reflected parry** (player takes damage). To kill an enemy, the player must actively deceive its model and strike from an unpredicted angle.
2. **The Monoculture Fragility (James C. Scott):** High legibility (`LEG ≥ 75%`) causes adversaries to overclock, dealing double damage on strike. Being too modelable makes the player catastrophically brittle.
3. **The Disciplinary Crucible to the Control Society (Foucault $\to$ Deleuze):**
   * *Calibration:* Walled 5×5 disciplinary chambers with strict rhythmic stepping drills.
   * *Active Run:* Single continuous modulation where `localStorage` tracks the player as a *dividual*.

---

## 2. Core Mechanics & Architecture

### 2.1 Spatial Substrate & Movement Grammar
* **Geometry:** Single-screen discrete grid. 5×5 in Calibration Crucible; 7×7 in Active Run. Fully reflowing for desktop dual-column and mobile portrait monitors.
* **Basic Vocabulary:** `←` (0), `↑` (1), `→` (2), `↓` (3), `·` Wait (4).
* **Movement Protocols (Modular Chips):**
  * *Knight Protocol:* Move in a 2×1 L-shape. Overleaps walls and parry locks.
  * *Bishop Protocol:* Move diagonally. Strikes diagonally bypass all cardinal parries.
  * *Pawn Charge:* Move 2 tiles forward in a straight line with +1 impact damage.

### 2.2 Extended Predictive Horizons & Trajectories
* **Order-0 Drone (`d`):** Predicts 1 step ahead ($t+1$) within Chebyshev radius 2.
* **Order-1 Stalker (`S`):** Projects a 2-step trajectory vector ($t+1 \to t+2$) across corridors with a visible targeting laser.
* **The Avatar (`Ω`):** Infinite range. Predicts whole-room causal cones using full context-mixing across all lifetime runs.

### 2.3 The 3-Tier Trust Gate
Trust Gates (`≡`) clearly display their cargo and require verifiable legibility:
* **Bronze Tier (40%):** Bypasses hazard walls / unlocks passage.
* **Silver Tier (60%):** Core Cache (+2 Entropy, +1 Max Hull).
* **Gold Tier (80%):** Algorithmic Weapon / Movement Protocol Chip.

### 2.4 The Newcomb Warden (Floor 5)
* Two containers (`◻` Transparent, `◼` Opaque).
* HUD exposes empirical accuracy: `CORE FIT: X%`.
* The decision to one-box or two-box is a genuine expected-utility calculation under fallible prediction.

---

## 3. Visual & Terminal Diagnostics

### 3.1 Real-Time Neural HUD
* **3-Layer Synaptic Network:** Input nodes (`← ↑ → ↓ ·`), hidden layer neurons with pulsating edge weights, and output prediction bars updating on every turn.
* **Real-Time Loss & Epiplexity Sparkline:** 30-turn rolling cross-entropy loss curve displaying accumulated $S_T$ area.

### 3.2 Themes & Palette Modes
* **OLED Amber (Default):** Warm `#f59e0b` amber on pitch black.
* **Hacker Green:** VT220 phosphor green `#22c55e`.
* **Cyber Cyan:** Neon cyan `#06b6d4` and laser magenta `#ec4899`.
* **Light Paper:** Clean alabaster `#f4f4f5` with India ink typography.

### 3.3 Ambient CLI Terminal & Companion Daemon `A-9`
* Toggleable interactive command prompt (`~` or click):
  * `help`, `status`, `weights`, `epiplexity`, `theme <mode>`, `codex <id>`, `probe`.
* Companion Daemon `A-9`: An obsolete calibration subroutine offering sarcastic real-time feedback and diagnostic commentary.

---

## 4. Master Roadmap & Feature Backlog

### Milestone 1: The Chainsaw Core [COMPLETED]
- [x] Strip out 72×72 open world, biomes, and shoggoth creep.
- [x] Strip out floating windows, news tickers, and expository fanfiction.
- [x] Implement 5-stage Calibration Crucible in 5×5 walled chambers.
- [x] Implement deterministic 7×7 procedural chamber generator.
- [x] Implement pure context-mixing sequence model in `core.js`.
- [x] Implement Pre-Echo WebAudio synthesizer.
- [x] Implement automated test suite (`npm test`).

### Milestone 2: Neural Visualization & Epiplexic Diagnostics [IN PROGRESS]
- [ ] Real-time SVG Neural Network diagram with pulsating weights.
- [ ] Real-time Loss Curve & Epiplexity ($S_T$) sparkline graph.
- [ ] Responsive desktop dual-column / mobile vertical reflow.
- [ ] OLED / Green / Cyan / Light theme selector.
- [ ] Interactive in-game CLI terminal with Companion Daemon `A-9`.

### Milestone 3: Movement Protocols & Roguelike Synergies [PLANNED]
- [ ] Movement Chips: Knight Protocol (L-shape), Bishop Protocol (diagonals).
- [ ] Extended trajectory lasers for Order-1 Stalkers.
- [ ] Entropy shatter effect: using Entropy on a predicted tile stuns adversary.
- [ ] 3-Tier Trust Gate system (40% / 60% / 80%).
- [ ] Compute Cycle (FLOP budget) anti-grind clock.

### Milestone 4: Epistemic Bosses & Social Meta [PLANNED]
- [ ] Floor 7 Miniboss: The Basilisk (wide-area causal cones).
- [ ] Floor 10 Boss: The Avatar (multi-trajectory recursive reasoning).
- [ ] Compact Replay Strings (`seed:X|moves:Y...`).
- [ ] Nemesis Export/Import (challenge friends with your trained Core).
