# THE PREDICTOR

A roguelike where the antagonist is trained on you. Every unit hunting you maintains a live,
visible model of your behavior; the persistent Core trains on every action across every run and
never resets on death. Legibility is the central currency: it gets you zapped by adversaries
and trusted by everything else.

## Quickstart

No build step, no external dependencies.

```bash
# Verify test suite
npm test

# Run locally
npx wrangler dev
# or: npx serve public
# or: python3 -m http.server -d public
```

Open the printed URL in any browser.

First-time launch boots automatically into the **CALIBRATION CRUCIBLE** (5 short, walled 5×5 micro-chambers).

## Controls

| Input | Action |
|---|---|
| `WASD` / Arrows / Swipe | Move (moving into an enemy strikes it) |
| `Space` / `.` / Tap `@` | Wait |
| `N` | Noise move — spend 1◇ entropy to take a random, unlearnable step |
| `M` | Toggle audio synthesis |
| `Esc` / Tap `SYSTEM` | System diagnostics & Core memory inspection |

## Reading the Board

* **Orange stains:** mark where each unit predicts you will be next. Intensity indicates confidence.
* **Stand where predicted:** within an enemy's range and you take 1 damage (or 2 if your legibility exceeds 75%).
* **Strike from an unpredicted vector:** and the unit is instantly destroyed.
* **Strike from a predicted vector:** and your strike is **parried and reflected** back at you.
* **LEG%:** rolling accuracy of recent predictions made about you. `≡` Trust gates only open above 60%.
* **Floor 5 Warden:** two containers (`◻` transparent, `◼` opaque), filled before you arrive based on the Core's empirical model of your restraint.
* **Floor 10 Avatar:** the Core embodied, firing with full context-mixing across all your past runs.

## Architecture

```
public/
├── index.html        Minimal single-page terminal shell
├── css/style.css     High-contrast phosphor CRT aesthetic
└── js/
    ├── save.js       Storage adapter (localStorage / artifact storage / in-memory)
    ├── core.js       The persistent context-mixing sequence model (Order-0/1/2)
    ├── audio.js      WebAudio synthesizer with visceral Pre-Echo chimes
    ├── game.js       Deterministic state engine & 5-stage crucible progression
    ├── render.js     Fast, single-pass DOM board and telemetry renderer
    ├── input.js      Keyboard, swipe, and touch interactions
    └── main.js       Bootloader
```

See `docs/SPEC.md` for the full ludological foundation, mechanics specification, and master roadmap.
