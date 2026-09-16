# The Predictor — Comprehensive Roguelike Review

*Reviewed 16 September 2026. This is a design and code review; no game code was changed.*

## Verdict

**The Predictor has an unusually good premise and an already legible aesthetic, but it is not yet delivering the kind of replayable, expressive roguelike its fiction promises.** Its best idea is that the opponent learns the player, and that prediction is both danger and a resource. Its current play experience, however, is mostly: move around a tiny random room, avoid one predicted cell, collect an item if convenient, and take the exit. The sector map, factions, classes, Newcomb dilemma, neural dashboard, and persistent model make the game *look* much deeper than the decisions the state machine currently asks of the player.

The priority is therefore **not** “add more content,” “make the map bigger,” or “make it isometric.” It is to turn *being modelled* into a repeatable tactical drama:

> **First author a plausible false model of yourself. Then make the enemy act on it. Then exploit the commitment.**

That is a game only *The Predictor* can make. It is more specific than a generic stealth roguelike, more dramatic than merely behaving randomly, and can support the route pressure of *FTL*, the build-expression of *Balatro*, and the conceptual escalation of *Universal Paperclips* without imitating any of them.

## Executive diagnosis

| Area | What already works | Why the present version becomes boring | Direction |
| --- | --- | --- | --- |
| Central mechanic | A visible predictor and a permanent Core make a strong immediate question: “what does it think I will do?” | Prediction is resolved as one adjacent cell and usually means damage. The player is incentivised to avoid the system rather than play with it. | Make prediction a manipulable **belief state** with commitments, decoys, tells, and profitable reversals. |
| Tactical rooms | Turn-based movement, one-turn telegraphing, readable colour language, and a clean input vocabulary are solid foundations. | Nearly every node becomes a random 7×7 obstacle room with one exit. There is no objective that changes the player's relationship to prediction. | Use authored room grammars with a distinct objective, topology, information rule, and reward question per node type. |
| Navigation | A sector DAG and four named factions are a promising macro scaffold. | The graph has labels, not strategic texture: most node types barely change the chamber, the player has no route resource, and the map does not show actual edges. | Give each node a visible price, reward, and **what it teaches the Core**; allow route manipulation and real trade-offs. |
| Builds | The Scout's Knight leap and Cryptographer's EMP show the correct direction: mechanics that alter tactical verbs. | There are three starting profiles and effectively one mid-run unlock. Gems do not form an economy. | Build a compact, combinatorial countermeasure system where upgrades change prediction itself, not just damage or capacity. |
| Fiction / presentation | The CRT workstation, amber/cyan palette, A-9 voice, HUD, and sprite work establish a very appealing “hostile archival computer” mood. | The board renders flat glyphs and boxes while a substantially stronger 3/4-view sprite sheet is loaded but unused; instrumental UI frequently outruns gameplay. | Preserve the terminal as the *interface to an orbital system*, but make the playable world a clearer spatial diorama with decisive transitions. |
| Persistence | A Core that remembers can make each death narratively meaningful. | Permanent raw action learning is close to a punishment for replaying; the model mostly learns button history, not intent, route, objective, or style. | Persist an interpretable player dossier and factional doctrines; make per-run learning volatile and counter-playable. |

## What is genuinely strong and worth protecting

### 1. The premise has an actual verb

“The antagonist is trained on you” is not just lore. The code already has a running ensemble predictor: n-gram mixing, a small online neural net, and associative memory are combined in [`Core.mix`](../public/js/core.js#L271-L305), then updated from player actions in [`Core.update`](../public/js/core.js#L308-L364). The player sees threat marks before resolving a move in [`computePredictions`](../public/js/game.js#L589-L640). That creates the foundation for an information game rather than a conventional damage race.

The most promising current rule is the *strike paradox*: walking into a predicted attack can hurt, while striking from an unpredicted vector destroys the target ([`game.js:745–765`](../public/js/game.js#L745-L765)). This turns the enemy's knowledge into a positional resource. Keep that principle.

The issue is not that the game needs a different concept. It needs to make this concept produce more than a single yes/no dodge test.

### 2. The game already understands telegraphing

The targeting tiles, confidence reticle, and Stalker's second-step line are clear enough to let a player reason before acting ([`render.js:336–387`](../public/js/render.js#L336-L387)). This is a valuable design instinct. *Into the Breach* is a useful north star: its enemy attacks are fully telegraphed so the player can form a plan rather than gamble on hidden simulation ([Subset Games](https://subsetgames.com/itb.html)).

Do not make the predictor opaque in pursuit of mystery. Make its *model* partly opaque while its *current consequences* remain legible. “I cannot yet tell why it believes this” is good; “I did not know this would kill me” is not.

### 3. The presentation is memorable before it is technically complete

The screenshots show a controlled and specific visual language: the BIOS/menu establishes mood quickly; the loadout screen is readable; the tactical screen has a strong control-room framing; the neural diagnostic view can become excellent between encounters. The palette variables and responsive workstation layout are coherent ([`style.css:3–83`](../public/css/style.css#L3-L83), [`style.css:352–435`](../public/css/style.css#L352-L435)).

The 3/4-view art in [`public/assets/spritemap.png`](../public/assets/spritemap.png) is particularly good. It makes the operative, drone, Stalker, Avatar, gates, containers, and lift feel like parts of the same machine-world. It should be the visual foundation, not a dormant asset.

### 4. The compact run format is an advantage

The active game currently has a compact five-stage tutorial and a small sector graph. That is a good scale for a browser roguelike. A 15–25 minute run with a tense, explainable failure state is a better goal than recovering the old 72×72 world prototype. The existing research notes correctly emphasise digestible runs, understandable rules, and run-to-run distinctness; see [the local roguelike research collection](roguelike%20research/).

## The actual player experience today

### The moment-to-moment loop is too thin

At present, a chamber is generated by clearing state, placing 4–8 random walls, choosing a random player start and a reachable exit, adding a few items, and spawning one to three enemies ([`game.js:334–442`](../public/js/game.js#L334-L442)). On a 7×7 board, that is a very short pathfinding problem. Enemies do not need to be defeated to leave: after pickups, simply standing on the stairs calls `descend()` ([`game.js:864–871`](../public/js/game.js#L864-L871)).

That produces a dominant experience of **avoid one or two red tiles, take the shortest safe path to `>`, repeat**. Once the player understands the threat highlight, there is little reason to fight, wait strategically, make a build-defining choice, or take a route for a reason beyond its label.

The result is not a lack of complexity in the code. It is a lack of *competing values per turn*. A rich roguelike turn says things like:

- “If I keep behaving like a collector, the Auditor will open the wrong firewall next turn.”
- “If I claim this cache, the Core learns a trait I need to betray at the boss.”
- “If I cross this tile now, I gain a counterexample but hand the Nursery a usable trace.”
- “This cheap escape keeps me alive but leaves the faction doctrine I cannot beat later.”

The current turn usually says: “is this one cell marked?”

### The player is asked to be random, not deceptive

`N` spends entropy on a random valid step ([`game.js:678–694`](../public/js/game.js#L678-L694)); if that random move lands in a prediction, it stuns/damages the enemy ([`game.js:786–808`](../public/js/game.js#L786-L808)). That is a pleasant emergency button, but it conflates unpredictability with agency. Randomness saves the player; it does not let them *write a false story* for the model.

The game needs a distinction between:

1. **Noise** — the model cannot learn it, but neither can the player build on it.
2. **Pattern** — the model can learn it, producing a usable, visible commitment.
3. **Deception** — the player creates evidence for a pattern, then violates it at a moment where the model's commitment causes a tactical or routing effect.

The third is the signature play. It should be the most satisfying and most rewarded action in the game.

### Legibility currently creates an awkward damage/reward contradiction

The rolling `LEG%` measures whether the player was on a predicted tile ([`game.js:813–817`](../public/js/game.js#L813-L817)). High legibility increases damage at 75% ([`game.js:798–801`](../public/js/game.js#L798-L801)), yet gates require the player to demonstrate it ([`game.js:705–713`](../public/js/game.js#L705-L713)). In play terms, the player is asked to earn access by repeatedly allowing themselves to be hit. That can be a provocative rule, but currently there are not enough safe, voluntary ways to become legible.

Replace the binary “was hit by a prediction” metric with two visible measures:

- **Trace** — evidence the system has about the player. It rises when the player publicly honours an announced or inferred pattern. Trace enables social/administrative access and gives pursuers stronger commitment.
- **Exposure** — immediate harm risk from the active prediction field. It rises when the current model can act on that trace in the current space.

High Trace should not automatically mean damage. It should create access, lure behaviour, priority targets, and a chance to make an especially valuable **break**. High Exposure should be an acute positional problem. Separating them lets a player deliberately become known without requiring health-tax play.

### There is no durable run arc yet

The loadout offers three classes ([`index.html:175–190`](../public/index.html#L175-L190)), but the active run does not provide a meaningful economy, a shop, a choice of several mutually interacting upgrades, or a boss that tests a build. Gems are collected in [`handlePickups`](../public/js/game.js#L883-L941) but are not spent, shown in the HUD, or used to enforce progress. The game therefore has the *appearance* of acquisition without the build arc that makes roguelikes invite another run.

*Balatro* is relevant here not because this should become a card game, but because each Joker changes a rule and interacts with other rule changes, while Boss Blinds demand a local adaptation ([official FAQ](https://www.playbalatro.com/faq)). The useful lesson is: **a reward should create a new question, not merely improve an old answer.**

## Highest-priority integrity problems

These are not cosmetic bugs. They break trust between the fiction, the interface, and the actual decision space.

| Priority | Evidence | Consequence for the player | Review recommendation |
| --- | --- | --- | --- |
| P0 | The exit is *drawn* as ready only with three gems ([`render.js:300–314`](../public/js/render.js#L300-L314)), but stepping on it always descends ([`game.js:867–871`](../public/js/game.js#L867-L871)). | The board communicates a gate that does not exist. Gems feel purposeless. | Decide what gems are for. Either remove the false exit state immediately, or make lift activation an explicit spending decision with a nontrivial alternative use. |
| P0 | The Newcomb code reads `Core.warden`, `Core.theft.oO`, and `Core.theft.uO` to predict the opaque box ([`game.js:403–421`](../public/js/game.js#L403-L421)); no live code writes `Core.warden`, `oO`, or `uO`. | The advertised psychological dilemma does not actually learn the relevant choice. A player can reasonably feel the game is faking its thesis. | Rebuild it as a declared one-box/two-box decision with a recorded counterfactual and a readable predictor rationale. Do not ship it as a pair of ordinary pickups. |
| P0 | README promises a Floor 5 Warden and Floor 10 Avatar ([`README.md:42–44`](../README.md#L42-L44)); the code makes the Avatar at sector 4 / depth 3 ([`game.js:426–429`](../public/js/game.js#L426-L429)), which is normally floor 16, and a Newcomb event may occur on floor 5 or in sector 3. | Players cannot learn the intended run structure from the documentation. | Pick the intended act cadence, implement it, and make README/SPEC/test expectations describe that exact game. |
| P0 | The specification lists Bronze/Silver/Gold requirements of 40/60/80% ([`SPEC.md:55–59`](SPEC.md#L55-L59)); the entry gate is 35% and rewards occur at 55/75% ([`game.js:705–713`](../public/js/game.js#L705-L713), [`game.js:900–919`](../public/js/game.js#L900-L919)). | The player sees moving rules and the design team loses a source of truth. | Consolidate an explicit, tested rule table; show the reward and threshold before commitment. |
| P1 | `NODE_TYPES` offers seven kinds of destination ([`game.js:19–28`](../public/js/game.js#L19-L28)), but most nodes still call the same generator. Apart from mass, vault, and Newcomb items, the difference is largely a label plus random content. | “Faction graph” choice lacks a felt identity or a reason to plan. | Treat node type as a room contract: objective + spatial grammar + model rule + reward + lasting cost. |
| P1 | Enemy movement is the same greedy Chebyshev pursuit for every type ([`game.js:945–963`](../public/js/game.js#L945-L963)); Drone/Stalker/Avatar mainly differ in health, range, and action-history distribution. | Named enemies do not ask for distinct plans. | Give every observer a different *wrong theory* of the player and a distinct way to turn confidence into pressure. |
| P1 | `NeuralNet.encodeInput` accepts `dx` and `dy`, but only encodes action history and wall proximity ([`core.js:113–135`](../public/js/core.js#L113-L135)). | The Core learns button sequences, not route preference, target selection, risk attitude, resource desire, or local intent. | Either state honestly that it learns short motor habits, or model a small, explainable set of player policies that include positional and objective context. |
| P1 | The renderer defines and loads a sprite map ([`render.js:13–54`](../public/js/render.js#L13-L54)) and a `drawSprite` function ([`render.js:210–239`](../public/js/render.js#L210-L239)), but the gameplay renderer draws flat primitives/glyphs instead. | Strong custom art is unused; board and menu feel like they came from different games. | Integrate the asset or remove the dead pathway. Do not make more art until one room demonstrates the chosen world rendering. |
| P1 | `openCli`, `closeCli`, and `toggleCli` target an element with id `cli-modal` ([`render.js:765–783`](../public/js/render.js#L765-L783)); the document provides only the always-visible `terminal-console` ([`index.html:141–162`](../public/index.html#L141-L162)). | The visible terminal controls imply behaviour that cannot occur. | Either make the terminal a real collapsible panel or remove its window-control fiction. |
| P2 | Root-level `spritemap.png` and `topdown_tileset.png` duplicate their `public/assets` counterparts byte-for-byte; the root-level mass artifact is not reachable from the deployed `public` asset directory. The active renderer's fallback points at a root public URL that is not published by the current asset layout. | Redundant prototypes obscure which game is authoritative and invite accidental regression. | Archive or remove the duplicate/root prototype deliberately after extracting any desired ideas. Keep one asset source and test its public URL. |
| P2 | `floorTheftOpp`, `KEYS.run`, and several settings fields are declared but have no gameplay use ([`game.js:63`](../public/js/game.js#L63), [`save.js:26–34`](../public/js/save.js#L26-L34)). | Small but accumulating ambiguity; future work will be harder to reason about. | Delete unused state once the intended replacement is specified, rather than leaving phantom mechanics. |

## The proposed game: a counter-intelligence roguelike

### Design sentence

> In each sector, you choose what kind of person the surveillance system learns you to be, then survive the consequences long enough to prove it catastrophically wrong.

The player is not an entropy generator. They are an operator running a long con against a system that has a model of them.

### A five-beat tactical loop

Each significant room should have five readable beats:

1. **Read** — see the local watcher, the room objective, its current belief, and its confidence effect.
2. **Perform** — make an action that supplies evidence for one plausible player motive or movement doctrine.
3. **Commit** — the watcher spends belief: moves a guard, locks a route, marks a lane, opens a gate, calls reinforcements, or reserves a laser.
4. **Betray** — take an action that violates the committed model; this creates a concrete opening rather than only avoiding damage.
5. **Bank / pay** — take the room reward, choose whether its consequence becomes part of the Core dossier, and move forward under a changed condition.

This preserves the existing pre-echo visual language, but turns it into anticipation: **the important prediction is the one the enemy has already spent resources on.**

### A simple belief model that players can actually play

Do not start by making the machine-learning simulation broader. Start with four-to-six human-readable hypotheses, shown as a compact vertical stack:

| Hypothesis | Evidence the player can create | Enemy commitment | Betrayal payoff |
| --- | --- | --- | --- |
| **Exit-seeker** | Repeatedly reduce distance to lift; leave loot behind. | Predicts / seals the exit route. | A false retreat draws the hunter off a cache or behind a blast door. |
| **Collector** | Picks caches, opens optional vaults, returns for drops. | Baits and watches loot lanes. | Leave a cache; take a forbidden transit or let the Mass consume the warrant. |
| **Caretaker** | Protects civilians / maintains infrastructure / heals. | Threatens a protected relay. | Spend the saved relay as a decoy; choose a ruthless route for strategic gain. |
| **Ritualist** | Repeats a movement grammar or announced path. | Prepares a parry corridor / remote gate permission. | Break rhythm at the moment the corridor becomes a weapon. |
| **Noise addict** | Uses entropy tools often. | Allocates counter-noise shields and neglects conventional movement. | Play clean, precise, low-entropy tactics through its weakened normal defence. |

The system can still use `Core.mix` under the hood as a distribution source, but it needs to produce **named, actionable explanations** rather than an unexplained 5-way arrow probability. The neural display should then become a genuine post-room autopsy: “it over-weighted Collector because of three observed caches; its exit-seeker policy was false.”

### Countermeasures should be the game's Jokers

Use 4–6 countermeasure slots. Each item needs a trigger, a transformation, a cost, and at least one interaction. Avoid percentage-only pickups.

| Countermeasure | New verb | Example interaction |
| --- | --- | --- |
| **Decoy Credential** | Spend Trace to mark a walkable tile as the authorised player for one turn. | With *Warrant Magnet*, a committed laser destroys its own gate instead of the decoy. |
| **Ritual Compiler** | After three actions matching a declared grammar, bank a “proof.” Breaking it creates an afterimage that acts first next turn. | With *Mirror Step*, the afterimage takes the predicted hit while the player crosses a laser lane. |
| **Counterfactual Cache** | Leave one loot item untouched; later reveal it as evidence that the Collector model is false. | With *Archivist Seal*, converting a cache changes the next node reward rather than yielding currency. |
| **Noise Mortgage** | Borrow Entropy now; each later noise action adds a permanent Trace mark. | With *Quiet Body*, a high-Trace break stuns all local predictors. |
| **Mass Communion** | Feed the Mass a declared route; it consumes predictions along that route but grows into future rooms. | With *Warrant Magnet*, you can direct the growth to eat an enemy's administrative hazard. |
| **Null Signature** | The first unpredicted action after a commitment is repeated as a one-turn ghost action. | With the Knight protocol, the ghost's landing tile becomes an ambush vector. |

This is the appropriate lesson from *Balatro*: its items change how the base grammar works, and boss restrictions make that grammar matter in a local context ([official FAQ](https://www.playbalatro.com/faq)). The Predictor's version should change **how evidence, prediction, and betrayal resolve**.

### Keep the three starting identities, but make them philosophies

The present Operative/Scout/Cryptographer selection is a clean front door. Give each a model-facing philosophy rather than a one-off stat advantage:

- **Operative — Contract:** can publicly declare a two- or three-step procedure. Honouring it yields Trace and access; breaking it yields a powerful counterfactual.
- **Scout — Geometry:** has leaps and can write a route through inaccessible topology. Their signature is making spatial intent look obvious, then exiting it non-locally.
- **Cryptographer — Noise:** turns entropy into temporary obfuscation, but accumulates a suspicious long-term dossier. Their strongest build eventually wins by making the Core invest in the wrong kind of defence.

Classes should make the same node map look different, not merely change initial health/entropy values as the current `startRun` does ([`game.js:529–552`](../public/js/game.js#L529-L552)).

## A map that means something

### The current graph is a route picker, not a campaign map

`generateSectorGraph` creates four fixed layers (entry, three nodes, two nodes, gate) and connects adjacent layers ([`game.js:166–264`](../public/js/game.js#L166-L264)). The map renderer lays these out in columns but does not draw the connections; it displays name, icon, and threat ([`render.js:853–920`](../public/js/render.js#L853-L920)). After a room, the only mechanical route effect is that connected cards become available ([`game.js:488–507`](../public/js/game.js#L488-L507)).

That is enough for a menu, but not enough for the pleasurable “I made this run” feeling of *FTL*. The useful FTL lesson is not simply branching: a jump determines threats, opportunities, timing, stores, crew damage, and which future choices remain. A good map makes a choice now cast a shadow two or three nodes ahead.

### Give every node five pieces of information

Every map card should expose, before entry:

1. **Objective** — what must be done to leave or get the worthwhile reward.
2. **Watcher doctrine** — which player hypothesis it amplifies or tests.
3. **Reward family** — countermeasure, repair, route manipulation, intelligence, or faction standing.
4. **Immediate pressure** — threat clock, exposure type, or resource spend.
5. **Dossier consequence** — what persistent fact becomes easier for the Core to believe if the player takes this route.

Example map notation:

```text
ARCHIVIST CUSTOMS
Objective: verify a declared route
Watcher: Ritualist +2 confidence
Reward: choose one Contract countermeasure
Cost: next sector begins with +1 Trace
```

That turns node selection into a plan rather than a preference for a nice-sounding icon.

### Proposed four-sector campaign

The existing faction names can become an excellent arc if each changes the game rather than the backdrop.

| Sector | The system's theory of the player | Spatial character | Typical choice | Transition image |
| --- | --- | --- | --- | --- |
| **1. Sub-Surface Perimeter / Archivist Archive** | “You follow permissions and shortest authorised paths.” | Ordered service corridors, sealed doors, data stacks, public lifts. | Accept a permission (Trace/access) or break one (alarm/loot). | A document elevator lowers through filing machinery; the next map is stamped into view. |
| **2. Shoggoth Nursery / Corrupted Biome** | “You preserve your body and avoid contamination.” | Organic growth changes lanes; prediction warrants can be eaten or cultivated. | Feed growth for passage now, or burn it out and preserve future rooms. | The console glass fogs with red tissue, then fractures into the next sector's route map. |
| **3. Panopticon / Directorate** | “You optimise rewards and honour the profile we inferred.” | Cameras, public/secret lanes, simulated social decisions, tall overlook geometry. | Maintain a public persona to gain authority, or poison it for a decisive theft. | An audit replay re-edits the last three rooms into the Core's case file. |
| **4. Apex Core / Avatar Matrix** | “I know which theory of you is true.” | A composite of prior rooms, with saved doctrines resurfacing as encounter rules. | Choose which false self to make the Avatar commit to before the final break. | The workstation and world finally occupy the same physical space; no modal map. |

### Give the map manipulation, not more random branches

One or two rare route verbs are enough:

- **Spoof transit:** swap the reward or watcher doctrine of two visible nodes, but add Trace.
- **Breach connection:** take a locked diagonal edge by spending a proof, arriving with an unstable benefit.
- **Archive a node:** skip a threat but make its doctrine enter the final boss's dossier.
- **Send a ghost:** preview one room's watcher commitment, but the Core records that you asked.

This is how the map becomes a prediction game too.

## Rooms, combat, and bosses

### Author room grammars; randomise their dressing and questions

The present generator is correctly careful about connectivity via `reachable()` ([`game.js:95–110`](../public/js/game.js#L95-L110)), but connectivity alone is a very low bar. The best immediate improvement is a library of 10–14 authored room grammars around 10×10 or 12×10 tiles. Randomise the objective placement, watcher, reward, hazards, and entry/exit side—not the entire level's meaning.

Examples:

- **The Three-Way Permit.** Three exits, one invalidates a promise. The enemy predicts the shortest legal route, not the next button.
- **Warrant Loom.** Prediction marks are threaded through a fabric of gates. Make one prediction true to tension a lane; break it to cut the lane and isolate an enemy.
- **Cache Choir.** Several identical caches have different social visibility. Loot is not simply good; it trains a Collector model whose future commitment can be exploited.
- **Blindspot Relay.** A room without active observation gives a strong immediate reward, but the player must decide which self-report gets written into the persistent dossier on exit.
- **Nursery Causeway.** Mass expands on prediction cells rather than every third turn. The player can turn prediction into terrain but risks a narrowing future map.
- **Transit Tribunal.** A Newcomb encounter in which choosing one or both containers is an explicit UI commitment, the model forecast is shown, and the resolution captures both action and counterfactual.

### Enemy identities should be theories, not health bars

The current Drone, Stalker, and Avatar differ mostly in their prediction source ([`game.js:127–137`](../public/js/game.js#L127-L137), [`game.js:566–586`](../public/js/game.js#L566-L586)). Expand by letting each entity weaponise confidence in a different way:

| Enemy | Wrong theory | Telegraph | What it commits | Counter-play |
| --- | --- | --- | --- | --- |
| **Drone / Statistician** | You repeat immediate actions. | One future tile. | A cheap parry. | Manufacture a short pattern, then use geometry or a decoy. |
| **Stalker / Narrativist** | Your last move reveals your next *goal*. | Two-turn route corridor. | A pursuit route and a lock. | Change objective, not just direction; make it open the wrong route. |
| **Auditor** | You take valuable things under observation. | Visible warrant over an item. | Converts loot lanes into hazards. | Pass the loot, convert it into a counterfactual, or exploit its delayed filing. |
| **Gardener / Nursery** | You will minimise bodily risk. | Growth forecast over safe cells. | Terrain growth that protects its own model. | Sacrifice a safe line to shape the Mass into a new route. |
| **Confessor / Warden** | Your declared identity is truthful. | Confidence in one named dossier trait. | A large administrative lock / permission. | Change your declared trait at carefully chosen cost, then turn revoked access into an opening. |
| **Avatar** | One global model explains all your actions. | Several alternative theories, each tied to a prior sector. | Selects and reinforces a final doctrine. | Seed a conflict between two true-but-incompatible dossiers; win in the crack. |

This produces the feeling of *Into the Breach*'s readable tactical puzzles, but with a more personal question: not “how do I push this monster?” but “what did I teach it that it can be induced to do?”

### Bosses need a build question

The Avatar is currently a five-health enemy that uses `Core.mix` and ends the run when hit enough times ([`game.js:426–429`](../public/js/game.js#L426-L429), [`game.js:761–764`](../public/js/game.js#L761-L764)). That makes the fiction larger than the fight.

Use a three-phase encounter:

1. **Cross-examination:** Avatar presents three dossiers collected from the run. The player chooses which one to substantiate, while performing under its rules.
2. **Commitment:** it spends its current theory to reconfigure the arena—removes routes, arms likely exits, or grants permission to a path it expects the player to take.
3. **Appeal:** the player triggers an accumulated counterfactual / contradiction. The goal is not “deplete five HP,” but make the Avatar's governing theory non-viable long enough to reach the extraction action.

This makes the whole run feel like preparation for a final argument, not a sequence of rooms before a slightly purple enemy.

## Visual direction and the isometric question

### Verdict: use a 2.5D isometric / cabinet-diorama board, but only after the room loop works

There is a strong visual argument for it. The existing sprite sheet is already rendered as 3/4 objects, while the active board is a flat orthogonal square field drawn from primitives ([`render.js:241–413`](../public/js/render.js#L241-L413)). The mismatch makes the current game look less authored than the assets deserve.

However, isometric perspective does **not** solve the current lack of consequential rooms, navigation, or buildcraft. A beautiful isometric version of “avoid the red square and exit” will be beautiful for a few minutes and then equally thin. Treat the perspective as a multiplier after a tactical vertical slice proves that the player wants to linger in a room.

### Recommended visual grammar

- **World:** low-resolution 2.5D diorama: chunky dark-metal floors, raised walls, bright doors, vertical cable shafts, and large readable machines. Use a fixed camera; never make the player rotate it.
- **Interface:** retain the CRT workstation. It is the external supervisory layer, not the world itself. The board is an intercepted physical feed; the neural display is the diagnostic monitor.
- **Prediction:** never cover the whole floor in equal orange stains. Render a *belief object*: a thin projected route, a heat prism, a warrant stamp, or an imminent laser mount. Confidence is thickness/height/pulse, not opacity soup.
- **Silhouette discipline:** player is cyan/white; immediate prediction is amber/orange; irreversible system danger is red; model/administrative power is violet. Reserve glow for decision-critical things.
- **Sector identity:** use material and geometry, not just palette: archive shelves and lift cages; wet red tissue and translucent membranes; panopticon mirrors and overhead cameras; the Apex's impossible merged machinery.

### Technical shape of an isometric renderer

The grid can remain authoritative. For a tile `(x, y)`, use a simple projection:

```text
screenX = originX + (x - y) * tileWidth / 2
screenY = originY + (x + y) * tileHeight / 2
```

Sort entities by `(x + y, y)` before drawing. Keep a separate hit-test transform to map clicks back to grid cells. Keep movement cardinal/knight in logical grid space; isometric is a presentation choice, not a new movement rule. This protects fairness and keyboard accessibility.

The existing `drawSprite` crop assumptions are a useful starting point, but it must be validated against real tile footprints rather than stretched into every square. One room should be prototyped using actual sprites, height offsets, and prediction overlays before converting the whole game.

### Make transitions do narrative work

The game currently changes rooms by immediately regenerating a board after selecting a card. Use 2–4 second *interactive* transitions instead:

1. Player enters an extraction lift or transit seal.
2. A-9 gives one concise interpretation of the Core's last belief and the player's most meaningful counterexample.
3. The route map animates or stamps in; the player sees what carried forward.
4. The chosen card becomes a physical destination: cabinet door, organic aperture, surveillance iris, or impossible reflection.

The important thing is that a transition tells the player: **this decision changed the campaign state.** It is also the correct home for the neural diagnostic, rather than a competing screen during tactical play.

*Invisible, Inc.* is a useful presentation reference: it combines a clean top-down tactical space with an operator fantasy, where stealth, precision, and high-stakes moves are central ([Klei's overview](https://www.klei.com/games/invisible-inc)). The Predictor can have a more surreal visual voice, but it should achieve that same immediate readability of “where can I go, what sees me, what will happen?”

## A more meaningful persistence model

### Do not persist raw punishment without a player-facing contract

The permanent `Core` is currently saved every five seconds and at exits/death ([`main.js:30–33`](../public/js/main.js#L30-L33), [`core.js:433–445`](../public/js/core.js#L433-L445)). That makes a literal reading of “it never forgets,” but the player cannot reliably understand which habits have become dangerous or how to change them. It risks converting learning into an accumulating annoyance.

Instead persist a **Dossier** with perhaps five visible, intentionally coarse facts:

- tends toward exits / loot / rescue / ritual / noise;
- likely movement doctrine;
- willingness to honour contracts;
- relationship with the Mass;
- most successful betrayal pattern.

Each run begins with the Core using two dossier traits as priors. During a run, watchers learn volatile local evidence. At the postmortem, the player sees three cards:

```text
THE CORE NOW BELIEVES
Collector          +2 evidence  [three watched caches]
Ritualist          -1 evidence  [one successful break]
Mass Sympathiser   +1 evidence  [two fed routes]
```

Allow one deliberate archival action between runs: freeze a trait (strong access but a known weakness), redact one at a cost, or seed a false credential. Now persistence is a strategic relationship rather than a background penalty.

This takes an appropriate conceptual lesson from *Universal Paperclips*: its power comes from a comprehensible system changing scale and recontextualising the player's original act, not from simply adding counters. Frank Lantz describes a journey from one paperclip to universe-scale engineering, diplomacy, and war ([creator's description](https://www.franklantz.net/work)). The Predictor should escalate from an action history to a dossier to a political/ontological system that governs routes, without losing the player's ability to reason about it.

## Architecture and testability required for the redesign

The present code is compact, which is an advantage, but it has one mutable global game object and mixes content generation, rules, effects, persistence calls, and UI hooks. It will become difficult to expand safely through `game.js` alone.

### Suggested boundaries

```text
engine/
  rng.js             seeded named streams: map, rewards, watchers, effects
  state.js           pure game-state transitions and validation
  predictor.js       explicit hypotheses, evidence, confidence, commitments
  resolution.js      action -> event queue -> resulting state
  content.js         node/room/enemy/countermeasure definitions
  campaign.js        graph generation, faction rules, persistent dossier
ui/
  board-renderer.js  canvas/isometric drawing only
  map-renderer.js    graph layout and node details
  terminal.js        A-9 explanations, log, postmortem
```

This does not require a framework or build tool. It does require rule functions to return events rather than invoke `say`, `drawAll`, `showModal`, and persistence from inside tactical logic. The UI can subscribe to those events.

### Seeded replays are non-negotiable

The generator and model repeatedly use `Math.random()`, including generation and model training. Introduce a displayed run seed and named deterministic streams. Record actions as a short replay string. This allows:

- reproducing a report such as “Newcomb did not record my choice”;
- comparing two intended strategies on the same campaign;
- visual regression screenshots;
- tests for “a Counterfactual Cache actually changes the Collector belief”;
- shareable daily challenge / nemesis seeds later.

### The current tests prove bootability, not playability

`npm test` passes at review time, but the coverage is intentionally narrow: it checks static files, core arrays/persistence, tutorial movement, initial room dimensions, and class starts ([`scripts/test-core.mjs`](../scripts/test-core.mjs), [`scripts/test-game.mjs`](../scripts/test-game.mjs)). It does not test exits, gems, map consequences, trust-gate thresholds, Newcomb recording, enemy differences, screens, or endgame structure.

The existing benchmark is especially useful evidence: its tested policies/classes all returned 0% wins and only reached about floor 1–2 on average in this run. It is not a balance proof—the bot is simplistic and the headless map auto-selects first available nodes—but it is a warning that the current system has no automated evidence of a viable full-run strategy.

Add tests in this order:

1. **Truth tests:** exit gating, gate thresholds, Newcomb's explicit choice and counterfactual, currency spending, exact boss floor.
2. **Content-contract tests:** every node has an objective/reward/cost/doctrine; no node can produce an unwinnable room under its stated rules.
3. **Prediction tests:** evidence changes a named hypothesis; commitment happens at stated confidence; betrayal produces its stated effect.
4. **Seed/replay tests:** identical seed + action list yields identical state/event history.
5. **Simulation tests:** several archetypal policies can reach the boss at a nonzero, intentionally tuned rate; the correct countermeasure changes outcome against its target doctrine.
6. **Browser/screenshot checks:** keyboard, pointer, responsive map edges, terminal visibility, and the prediction overlay remain readable.

## Sequenced implementation plan

### Phase 0 — Restore truth and define the one-sentence contract (small, urgent)

- Resolve the fake gem/exit gate, non-recording Newcomb encounter, documentation thresholds/floors, and broken terminal control.
- Decide whether any gameplay should retain the old mass-artifact prototype; archive it rather than silently letting it compete with the active game.
- Remove/rehome duplicate assets and dead state only after the active asset source is confirmed.
- Write a short product contract: run length, act count, final boss beat, number of countermeasure slots, number of core hypotheses, and what persists.

**Exit criterion:** a new player can explain why they died, what the exit requires, what each listed currency buys, and what the Core will remember.

### Phase 1 — One room that proves the new game (vertical slice)

Build exactly one 10×10 authored Archivist room with:

- a named Collector or Ritualist belief;
- visible evidence and confidence;
- an enemy commitment that changes the room;
- a viable safe play, a costly play, and a deception play;
- one countermeasure that creates an interaction, not a number;
- a concise end-of-room explanation of what the watcher learned.

Do not add sectors, more art, or a broader item pool until testers spontaneously describe the winning move as “I made it believe X, then I used that.”

### Phase 2 — Build the campaign spine

- Add four sector doctrines, 8–10 room grammars, 12–16 countermeasures, and 5 watcher identities.
- Rebuild the map cards around objective/reward/cost/dossier consequence and draw actual connections.
- Add one map manipulation resource and one decision room with a genuine counterfactual.
- Make the Avatar a three-phase dossier fight.

**Exit criterion:** two runs with different starting identities and route choices produce recognisably different tactics before sector two.

### Phase 3 — Visual world and transitions

- Integrate the existing sprite sheet in one board mode.
- Prototype the 2.5D projection on one room and test input/overlay clarity before any global conversion.
- Add sector material kits, transition vignettes, and a post-room diagnostic.
- Trim instrumentation that does not inform the next choice; the neural screen should explain, not decorate.

### Phase 4 — Persistence, replayability, and tuning

- Introduce a player-readable dossier, seeded replays, postmortem evidence cards, and optional between-run archival manipulation.
- Tune using recorded human play and policy simulations, not just individual impressions.
- Only then consider Nemesis exports, daily seeds, challenge doctrines, or broader meta progression.

## Things specifically not to do

- **Do not revive the old 72×72 open world wholesale.** It may contain useful transition/biome ideas, but it conflicts with the compact, readable run the current architecture and premise want.
- **Do not add fifteen enemy types before giving three enemies three genuinely different predictive theories.** Variety of names is not variety of play.
- **Do not make “be random” the optimal strategy.** Randomness is a pressure valve; deception must be the expressive core.
- **Do not turn the neural screen into pseudo-scientific decoration.** Every displayed metric needs a player action attached to it.
- **Do not make isometric rendering obscure tile legality or turn information.** The game earns difficulty from inference and choices, not from hidden cells.
- **Do not use progression to repair an unwinnable baseline.** Persistent evolution should broaden self-expression and story, not be a mandatory stat grind.

## Review conclusion

The Predictor does not need to become *FTL with surveillance*, *Balatro with arrows*, or *Universal Paperclips in a dungeon*. It needs to take the part those games execute exceptionally well:

- from **FTL**, a route map where the player carries choices and costs forward;
- from **Balatro**, rewards that mutate the base grammar into strange builds and bosses that demand adaptation;
- from **Universal Paperclips**, a conceptual system that escalates in scope while remaining legible;
- from **Into the Breach** and **Invisible, Inc.**, enough visible information that a difficult loss feels attributable and instructive.

The distinctive answer is a roguelike where the player wins not by becoming unknowable, but by becoming *believably, strategically wrong*. The code already contains the seed of that answer. The next version should reorganise every room, upgrade, map card, and boss around making an enemy commit to a model that the player can exploit.

## References and useful study targets

- [FTL: Faster Than Light — Subset Games](https://subsetgames.com/ftl.html) — route pressure and carry-forward campaign choices.
- [Balatro official FAQ](https://www.playbalatro.com/faq) — rule-mutating Jokers, in-run shops, and boss constraints.
- [Into the Breach — Subset Games](https://subsetgames.com/itb.html) — fully telegraphed enemy intent and compact tactical puzzles.
- [Invisible, Inc. — Klei](https://www.klei.com/games/invisible-inc) — operator fantasy, stealth information, and tactical readability.
- [Universal Paperclips — Frank Lantz](https://www.franklantz.net/work) — coherent conceptual escalation through changing systems.
- [Existing local roguelike research](roguelike%20research/) — especially the notes on fairness, meaningful choice, run length, and build-changing passives.
