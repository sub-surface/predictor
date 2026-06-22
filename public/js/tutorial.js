'use strict';
/* Onboarding. Five scripted rooms; the Core never trains here.
   Each step builds a hand-authored floor and gates progress on a goal. */
const Tutorial = {
  steps: [
    {
      banner:'CALIBRATION 1/5 — MOVE. no watcher yet. arrows / WASD / swipe. touch the ✦ marker.',
      build(){
        wallsRect();
        G.player.x=2; G.player.y=4;
        G.items.push({x:6,y:4,type:'marker'});
        G.stairs={x:-9,y:-9};                       // no exit yet
      },
    },
    {
      banner:'CALIBRATION 2/5 — MODEL. the drone guesses your next tile. the stain means it expects you there. move, read it, then strike from an unstained direction.',
      build(){
        wallsRect();
        G.player.x=2; G.player.y=4;
        G.enemies.push(mkEnemy('drone',{x:6,y:4}));
        G.stairs={x:-9,y:-9};
      },
    },
    {
      banner:'CALIBRATION 3/5 — LEGIBILITY. two readers compare you to yourself. stand in a predicted tile inside range and they burn you. LEG% is how plain you look. kill both to exit.',
      build(){
        wallsRect();
        G.player.x=4; G.player.y=6;
        G.enemies.push(mkEnemy('drone',{x:2,y:2}));
        G.enemies.push(mkEnemy('stalker',{x:6,y:2}));
        G.stairs={x:7,y:4};
      },
    },
    {
      banner:'CALIBRATION 4/5 — NOISE. entropy (◇) allows unlearnable random motion. grab it, get close to the relay, and press [N] to strike unpredictably. kill it.',
      build(){
        wallsRect();
        G.player.x=4; G.player.y=7;
        G.items.push({x:4,y:5,type:'ent'});
        G.enemies.push(mkEnemy('hive',{x:4,y:2}));
        G.stairs={x:-9,y:-9};
      },
    },
    {
      banner:'CALIBRATION 5/5 — BLISS. an avatar of the core. grab the trap (ψ) and press [B] to arm it. let it step near it to lock on. then exit.',
      build(){
        wallsRect();
        G.player.x=4; G.player.y=7;
        G.items.push({x:4,y:5,type:'trap'});
        G.enemies.push(mkEnemy('avatar',{x:4,y:2}));
        G.stairs={x:4,y:1};
      },
    },
  ],

  build(){
    const st=this.steps[G.tutStep];
    G.observed=false;
    st.build();
    if(typeof setBrief==='function') setBrief('CALIBRATION',(G.tutStep+1)+'/5',st.banner);
    say(st.banner);
  },
  advance(){
    G.tutStep++;
    if(G.tutStep>=this.steps.length){ this.finish(); return; }
    G.items=[]; G.enemies=[]; G.forced=[]; G.arming=false;
    this.build(); drawAll();
  },
  onMarker(){ if(G.tutStep===0){ say('clean movement. enjoy the privacy; it ends now.'); setTimeout(()=>this.advance(),900); } },
  onKill(){
    if(G.tutStep===1&&!G.enemies.length){ say('model broken. the safest path was the one it could not imagine.'); setTimeout(()=>this.advance(),900); }
    if(G.tutStep===2&&!G.enemies.length){ say('two readers down. LEG% is the score of your predictability. door open.'); }
    if(G.tutStep===3&&!G.enemies.length){ say('perfect noise. perfectly unlearnable.'); setTimeout(()=>this.advance(),900); }
  },
  onTurn(){
  },
  onExit(){
    if(G.tutStep===2) this.advance();
    if(G.tutStep===4) {
      if(G.enemies[0] && G.enemies[0].bliss > 0) {
        say('wireheaded. an optimizer captured by bliss.');
        setTimeout(() => this.finish(), 900);
      } else {
        say('exit is sealed. lock the avatar onto a bliss trap first.');
        G.player.x = 4; G.player.y = 7; // reset position
      }
    }
  },
  finish(){
    G.over=true; G.active=false; this._blissed=false;
    showOver('CALIBRATION COMPLETE', true,
      'you can move, read prediction, and stay illegible.<br><br>'+
      'outside calibration, the Core <b>remembers</b>. every run teaches it.<br><br>'+
      'between chambers, choose <b>PROTOCOLS</b> to override station logic.<br><br>'+
      'field manual: trust vaults, pacts, the warden on floor 5.');
    Menu.afterTutorial();
  },
};

/* tutorial arena: bordered empty room */
function wallsRect(){
  G.walls=new Set();
  for(let x=0;x<W;x++){ G.walls.add(idx(x,0)); G.walls.add(idx(x,H-1)); }
  for(let y=0;y<H;y++){ G.walls.add(idx(0,y)); G.walls.add(idx(W-1,y)); }
}
