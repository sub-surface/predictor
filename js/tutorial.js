'use strict';
/* Onboarding. Five scripted rooms; the Core never trains here.
   Each step builds a hand-authored floor and gates progress on a goal. */
const Tutorial = {
  steps: [
    {
      banner:'CALIBRATION 1/5 — MOVE. arrows / WASD / swipe. reach the ✦ marker.',
      build(){
        wallsRect();
        G.player.x=2; G.player.y=4;
        G.items.push({x:6,y:4,type:'marker'});
        G.stairs={x:-9,y:-9};                       // no exit yet
      },
    },
    {
      banner:'CALIBRATION 2/5 — BE WATCHED. the drone builds a model of your habits. watch the panel fill as you move. then DESTROY it: bump it from a direction it did not predict (no orange stain on your tile).',
      build(){
        wallsRect();
        G.player.x=2; G.player.y=4;
        G.enemies.push(mkEnemy('drone',{x:6,y:4}));
        G.stairs={x:-9,y:-9};
      },
    },
    {
      banner:'CALIBRATION 3/5 — LEGIBILITY. two readers now. if you stand where the stain says, inside range, you are zapped. your LEG% is how often they are right about you. kill both.',
      build(){
        wallsRect();
        G.player.x=4; G.player.y=6;
        G.enemies.push(mkEnemy('drone',{x:2,y:2}));
        G.enemies.push(mkEnemy('stalker',{x:6,y:2}));
        G.stairs={x:-9,y:-9};
      },
    },
    {
      banner:'CALIBRATION 4/5 — NOISE. you have 2◇ entropy. press N: a truly random move nothing can predict and nothing learns from. you also do not choose it. use noise to break its lock, then destroy the stalker.',
      build(){
        wallsRect();
        G.player.x=4; G.player.y=6; G.player.ent=2;
        const s=mkEnemy('stalker',{x:4,y:2});
        G.enemies.push(s);
        G.stairs={x:-9,y:-9};
      },
    },
    {
      banner:'CALIBRATION 5/5 — WIREHEAD. the forager wants ✶, not you. you have a ψ bliss trap: press B to arm it where you stand. lure the forager into bliss — give an optimizer a cheaper way to win — then take the exit.',
      build(){
        wallsRect();
        G.player.x=2; G.player.y=4; G.player.bliss=1; G.player.gems=1;
        G.enemies.push(mkEnemy('forager',{x:6,y:2}));
        G.items.push({x:6,y:6,type:'gem'});
        G.stairs={x:7,y:4};
      },
    },
  ],

  build(){
    const st=this.steps[G.tutStep];
    G.observed=false;
    st.build();
    say(st.banner);
  },
  advance(){
    G.tutStep++;
    if(G.tutStep>=this.steps.length){ this.finish(); return; }
    G.items=[]; G.enemies=[]; G.forced=[]; G.arming=false;
    this.build(); drawAll();
  },
  onMarker(){ if(G.tutStep===0){ say('good. nothing watched that. it is the last unwatched thing you will do.'); setTimeout(()=>this.advance(),900); } },
  onKill(){
    if(G.tutStep===1&&!G.enemies.length){ say('destroyed. unpredicted vectors are the only weapon you have.'); setTimeout(()=>this.advance(),900); }
    if(G.tutStep===2&&!G.enemies.length){ say('both down. notice your LEG% — that number is your exposure.'); setTimeout(()=>this.advance(),900); }
    if(G.tutStep===3&&!G.enemies.length){ say('noise breaks locks, and costs you your own hands. spend it like blood.'); setTimeout(()=>this.advance(),900); }
  },
  onTurn(){
    if(G.tutStep===4){
      const f=G.enemies.find(e=>e.type==='forager');
      if(f&&f.bliss>0&&!this._blissed){ this._blissed=true; say('it found the trap. it believes it has won. the exit is open.'); }
    }
  },
  onExit(){
    if(G.tutStep===4) this.finish();
  },
  finish(){
    G.over=true; G.active=false; this._blissed=false;
    showOver('CALIBRATION COMPLETE', true,
      'you can move, read its model, stay illegible, spend entropy, and wirehead an optimizer.<br><br>'+
      'the real thing differs in one way: <b>it remembers</b>. every run, forever. this room did not.<br><br>'+
      'further reading in the field manual: vaults that require trust, pacts, the warden on floor 5, the eye.');
    Menu.afterTutorial();
  },
};

/* tutorial arena: bordered empty room */
function wallsRect(){
  G.walls=new Set();
  for(let x=0;x<W;x++){ G.walls.add(idx(x,0)); G.walls.add(idx(x,H-1)); }
  for(let y=0;y<H;y++){ G.walls.add(idx(0,y)); G.walls.add(idx(W-1,y)); }
}
