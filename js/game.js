'use strict';
/* Run state and the turn engine. G holds everything serializable. */
const W=9, H=9;
const DIRS=[{dx:-1,dy:0},{dx:0,dy:-1},{dx:1,dy:0},{dx:0,dy:1},{dx:0,dy:0}];
const idx=(x,y)=>y*W+x, inB=(x,y)=>x>=0&&x<W&&y>=0&&y<H;
const cheb=(a,b)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
const ri=n=>Math.floor(Math.random()*n);

const G = {
  active:false, mode:'run', over:false,
  floor:0, turn:0, observed:true,
  player:null, walls:new Set(), stairs:null, enemies:[], items:[],
  last1:4, last2:4, legWin:[], runEntSpent:0,
  floorTheftOpp:0, tookT:false, tookO:false, oBoxFilled:false,
  forced:[], arming:false,
  tutStep:0,
};
let turnPreds=[], selected=null;

/* ---------- helpers ---------- */
function mat(){ return Array.from({length:5},()=>[0,0,0,0,0]); }
function legPct(){ return G.legWin.length ? Math.round(100*G.legWin.reduce((a,b)=>a+b,0)/G.legWin.length) : null; }
function reachable(a,b){
  const q=[a], seen=new Set([idx(a.x,a.y)]);
  while(q.length){
    const c=q.pop();
    if(c.x===b.x&&c.y===b.y) return true;
    for(const d of DIRS.slice(0,4)){
      const x=c.x+d.dx, y=c.y+d.dy;
      if(inB(x,y)&&!G.walls.has(idx(x,y))&&!seen.has(idx(x,y))){ seen.add(idx(x,y)); q.push({x,y}); }
    }
  }
  return false;
}
function freeTile(minD, avoid){
  for(let t=0;t<220;t++){
    const p={x:ri(W),y:ri(H)}, k=idx(p.x,p.y);
    if(G.walls.has(k)) continue;
    if(p.x===G.player.x&&p.y===G.player.y) continue;
    if(G.stairs&&p.x===G.stairs.x&&p.y===G.stairs.y) continue;
    if(minD&&cheb(p,G.player)<minD) continue;
    if(G.items.some(i=>i.x===p.x&&i.y===p.y)) continue;
    if(G.enemies.some(e=>e.x===p.x&&e.y===p.y)) continue;
    if(avoid&&avoid(p)) continue;
    return p;
  }
  return null;
}
function mkEnemy(type,p){
  const base={...p,type,hp:1,range:0,bliss:0,stealCd:0,cd:0,model:null,carry:0,obj:''};
  if(type==='drone')   Object.assign(base,{range:2,model:[0,0,0,0,0],obj:'ZAP @ — reads your habits (order-0)'});
  if(type==='stalker') Object.assign(base,{range:3,model:mat(),obj:'ZAP @ — reads your sequences (order-1)'});
  if(type==='hive')    Object.assign(base,{hp:2,range:3,obj:'ZAP @ — reads from THE PREDICTOR itself'});
  if(type==='forager') Object.assign(base,{obj:'COLLECT ✶ — does not care about you. exploitable.'});
  if(type==='avatar')  Object.assign(base,{hp:4,range:99,obj:'MODEL @ — the core, embodied. whole-room range, fires every other turn.'});
  return base;
}

/* one-time contextual tips, persisted */
function tip(key, text){
  if(S.tips[key]) return;
  S.tips[key]=true; saveSettings();
  say('▸ '+text);
}

/* ---------- floor generation ---------- */
function settleTheftOpp(){
  if(G.mode!=='run') return;
  if(G.floorTheftOpp>0){
    if(G.observed) Core.theft.oO+=G.floorTheftOpp; else Core.theft.uO+=G.floorTheftOpp;
    G.floorTheftOpp=0; Core.dirty=true;
  }
}
function descend(){
  settleTheftOpp();
  if(G.floor===5 && G.mode==='run'){
    const choice = G.tookO&&!G.tookT ? 'one' : (G.tookT ? 'two' : null);
    if(choice){ Core.warden.push(choice); Core.dirty=true; }
  }
  G.floor++;
  G.player.hp=Math.min(G.player.maxhp, G.player.hp+1);
  G.observed=Math.random()<0.6;
  G.tookT=G.tookO=false; G.oBoxFilled=false;
  G.forced=[]; G.arming=false; G.items=[]; G.enemies=[]; G.stairs=null; selected=null;

  if(G.mode==='tutorial'){ Tutorial.build(); drawAll(); return; }

  let ok=false;
  while(!ok){
    G.walls=new Set();
    const nW=5+ri(5);
    for(let i=0;i<nW;i++) G.walls.add(idx(1+ri(W-2),1+ri(H-2)));
    G.player.x=ri(W); G.player.y=ri(H);
    if(G.walls.has(idx(G.player.x,G.player.y))) continue;
    let tries=0;
    do{ G.stairs={x:ri(W),y:ri(H)}; tries++; }
    while((G.walls.has(idx(G.stairs.x,G.stairs.y))||cheb(G.stairs,G.player)<5)&&tries<99);
    ok=reachable(G.player,G.stairs);
  }

  const put=(type,n,minD)=>{ for(let i=0;i<n;i++){ const p=freeTile(minD||0); if(p)G.items.push({...p,type}); } };
  put('gem',2+ri(3),2);
  put('ent',1+ri(2),2);
  if(G.floor>=2&&Math.random()<.5) put('cache',1+ri(2),3);
  if(Math.random()<.35) put('blissPick',1,2);
  if(G.floor>=3&&Math.random()<.55) put('vault',1,3);
  if(G.floor>=2&&Math.random()<.4) put('shrine',1,3);
  G.floorTheftOpp=G.items.filter(i=>i.type==='cache').length;

  if(G.floor===5){
    const t=freeTile(3), o=freeTile(3);
    if(t&&o){
      G.items.push({...t,type:'chestT'}); G.items.push({...o,type:'chestO'});
      let oneBox;
      if(Core.warden.length){
        const ones=Core.warden.filter(c=>c==='one').length;
        oneBox = ones*2>=Core.warden.length;
      } else {
        const th=Core.theft, thefts=th.oT+th.uT, opps=th.oO+th.uO;
        oneBox = opps===0 ? true : thefts/opps<0.5;
      }
      G.oBoxFilled=oneBox;
      say('THE WARDEN: two containers, filled before you arrived, from its model of you.');
      tip('warden','◻ shows its contents. ◼ does not. taking only ◼ is a bet that it believed in your restraint.');
    }
  }

  const n=Math.min(2+Math.floor(G.floor/1.4),6);
  for(let i=0;i<n;i++){
    const p=freeTile(3); if(!p) continue;
    let type='drone';
    if(G.floor>=10&&i===0) continue;
    else if(G.floor>=4&&i===0) type='hive';
    else if(G.floor>=2&&i%3===1) type='stalker';
    else if(G.floor>=2&&i%3===2&&Math.random()<.7) type='forager';
    G.enemies.push(mkEnemy(type,p));
  }
  if(G.floor===10){
    const p=freeTile(4)||freeTile(2);
    if(p) G.enemies.push(mkEnemy('avatar',p));
    say('IT HAS COME DOWN ITSELF. everything it knows about you is in this room.');
  } else if(G.floor===1){
    say('it has no model of you yet. it is watching.');
  } else {
    say(G.observed ? 'floor '+G.floor+'. the eye is on.' : 'floor '+G.floor+'. the eye is off. nothing here reports what you do.');
    if(!G.observed) tip('eye','the eye (◉/○) marks whether this floor is monitored. something is still counting.');
  }
  saveRun();
  drawAll();
}

/* ---------- prediction ---------- */
function predRowOf(e){
  if(e.type==='drone'){ const t=e.model.reduce((a,b)=>a+b,0); return t?e.model.map(v=>v/t):null; }
  if(e.type==='stalker'){ const r=e.model[G.last1], t=r.reduce((a,b)=>a+b,0); return t?r.map(v=>v/t):null; }
  if(e.type==='hive'||e.type==='avatar') return Core.mix(G.last1,G.last2);
  return null;
}
function predict(e){
  if(e.bliss>0||e.type==='forager') return null;
  const d=predRowOf(e); if(!d) return null;
  if(G.forced.length){                      // commitments are public: it simply reads your pact
    const fd=DIRS[G.forced[0]];
    let tx=G.player.x+fd.dx, ty=G.player.y+fd.dy;
    if(!inB(tx,ty)||G.walls.has(idx(tx,ty))){ tx=G.player.x; ty=G.player.y; }
    return {x:tx,y:ty,conf:1,tok:G.forced[0],dist:d};
  }
  const mx=Math.max(...d);
  const tops=d.map((v,i)=>v===mx?i:-1).filter(i=>i>=0);
  const tok=tops[G.turn%tops.length], dd=DIRS[tok];
  let tx=G.player.x+dd.dx, ty=G.player.y+dd.dy;
  if(!inB(tx,ty)||G.walls.has(idx(tx,ty))){ tx=G.player.x; ty=G.player.y; }
  return {x:tx,y:ty,conf:mx,tok,dist:d};
}

/* ---------- the turn ---------- */
function step(tok,isNoise){
  if(G.over||!G.active) return;

  if(G.arming){                             // pact shrine: this input arms the pact, it is not a move
    if(tok<4){
      G.forced=[tok,tok,tok]; G.arming=false;
      say('♦ PACT armed: '+'←↑→↓'[tok].repeat(3)+'. broadcast to every unit. survive it for the reward.');
    } else { G.arming=false; say('♦ pact declined. the shrine dims.'); }
    drawAll(); return;
  }
  if(G.forced.length){
    tok=G.forced.shift(); isNoise=false;
    if(G.forced.length===0){
      G.player.hp=Math.min(G.player.maxhp,G.player.hp+1); G.player.ent+=2;
      say('pact honored. +1 hull, +2 ◇. they watched every step of it.');
    }
  } else if(isNoise){
    if(G.player.ent<1){ say('no entropy. you are entirely made of habit right now.'); return; }
    const valid=DIRS.map((d,i)=>({i,x:G.player.x+d.dx,y:G.player.y+d.dy}))
      .filter(o=>inB(o.x,o.y)&&!G.walls.has(idx(o.x,o.y)));
    tok=valid[ri(valid.length)].i;
    G.player.ent--; G.runEntSpent++;
    if(G.mode==='run'){ Core.ent++; Core.dirty=true; }
  }

  const d=DIRS[tok];
  let nx=G.player.x+d.dx, ny=G.player.y+d.dy;
  if(!inB(nx,ny)||G.walls.has(idx(nx,ny))){
    if(!isNoise) return;                    // invalid input: no turn passes
    nx=G.player.x; ny=G.player.y;           // noise can slam you into a wall; the turn still burns
  }

  const vault=G.items.find(i=>i.type==='vault'&&i.x===nx&&i.y===ny);
  if(vault){
    const lp=legPct();
    if(lp===null||lp<60){ say('≡ the vault stays shut. it cannot model you well enough to trust you. (LEG ≥ 60%)'); return; }
  }

  const ps=turnPreds;                       // exactly what was displayed
  let attacked=null;
  const target=G.enemies.find(e=>e.x===nx&&e.y===ny);
  if(target){
    attacked=target;
    const pr=(ps.find(o=>o.e===target)||{}).p;
    const parried=!isNoise&&pr&&pr.x===nx&&pr.y===ny;
    if(parried){ damagePlayer('it read the strike before you made it.'); }
    else{
      target.hp--; SFX.kill();
      if(target.hp<=0){
        if(target.type==='forager'&&target.carry&&!G.items.some(i=>i.x===target.x&&i.y===target.y))
          G.items.push({x:target.x,y:target.y,type:'gem'});
        G.enemies=G.enemies.filter(e=>e!==target);
        if(target.type==='avatar'){ win(); return; }
        say('unit destroyed — it never saw that vector.');
        if(G.mode==='tutorial') Tutorial.onKill(target);
      }
    }
    nx=G.player.x; ny=G.player.y;
  }
  G.player.x=nx; G.player.y=ny;

  for(const o of ps){
    if(!o.p) continue;
    const right=!isNoise&&o.p.x===G.player.x&&o.p.y===G.player.y;
    G.legWin.push(right?1:0); if(G.legWin.length>30)G.legWin.shift();
    if(right&&o.e!==attacked&&G.enemies.includes(o.e)&&o.e.bliss<=0&&cheb(o.e,G.player)<=o.e.range){
      if(o.e.type==='avatar'){ if(o.e.cd<=0){ o.e.cd=1; damagePlayer('predicted. zapped.'); } }
      else damagePlayer('predicted. zapped.');
    }
    if(G.over) break;
  }

  if(!isNoise){
    for(const e of G.enemies){
      if(e.type==='drone') e.model[tok]++;
      else if(e.type==='stalker') e.model[G.last1][tok]++;
    }
    if(G.mode==='run') Core.update(tok,G.last1,G.last2);   // the tutorial room is not recorded
    G.last2=G.last1; G.last1=tok;
  }
  G.turn++;

  if(!G.over) pickups();
  if(!G.over&&G.player.x===G.stairs.x&&G.player.y===G.stairs.y){
    if(G.mode==='tutorial'){ Tutorial.onExit(); return; }
    saveCore(); descend(); return;
  }
  if(!G.over) think();
  if(G.mode==='tutorial') Tutorial.onTurn();
  drawAll();
}

function pickups(){
  const here=G.items.filter(i=>i.x===G.player.x&&i.y===G.player.y);
  for(const it of here){
    if(it.type==='gem'){ G.player.gems++; SFX.pick(); say('✶ taken.'); }
    else if(it.type==='ent'){ G.player.ent++; SFX.pick(); say('◇ entropy mined. the only true randomness down here.'); }
    else if(it.type==='blissPick'){ G.player.bliss++; SFX.pick(); say('ψ bliss trap recovered. an objective in a bottle.'); }
    else if(it.type==='cache'){
      G.player.gems+=2;
      if(G.mode==='run'){ if(G.observed)Core.theft.oT++; else Core.theft.uT++; Core.dirty=true; }
      say(G.observed ? '▣ cache taken. the eye saw that.' : '▣ cache taken. no one saw that. (something still counts.)');
      tip('cache','▣ caches belong to someone. taking them is free profit. the game keeps two ledgers.');
    }
    else if(it.type==='vault'){
      G.player.gems+=2; G.player.ent++; G.player.bliss++;
      say('≡ the vault opened because you are knowable. transparency pays — to friends.');
    }
    else if(it.type==='shrine'){
      G.arming=true;
      say('♦ the shrine offers a pact: choose a direction. your next 3 moves are committed, publicly.');
      tip('shrine','while committed you are perfectly predictable — every unit reads the pact. reward follows if you live.');
      continue;                              // shrine persists
    }
    else if(it.type==='chestT'){
      G.player.gems+=3; G.player.ent++; G.tookT=true;
      say('the transparent container: 3✶ 1◇, as visible. (it predicted whether you could resist this.)');
    }
    else if(it.type==='chestO'){
      G.tookO=true;
      if(G.oBoxFilled){
        G.player.maxhp++; G.player.hp=G.player.maxhp; G.player.ent+=3; G.player.bliss++;
        say(G.tookT ? 'full — it expected restraint. you took both anyway. remember: it updates.'
                    : 'the opaque container is FULL. it believed you take only one. it was right.');
      } else say('empty. it decided before you arrived that you were the kind who takes both.');
    }
    else if(it.type==='marker'){ Tutorial.onMarker(); }
    G.items=G.items.filter(i=>i!==it);
  }
}

function think(){
  for(const e of G.enemies){
    if(e.cd>0)e.cd--;
    if(e.bliss>0){ e.bliss--; if(e.bliss===0) say('a unit shakes off the bliss. its objective reasserts itself.'); continue; }
    const trap=G.items.find(i=>i.type==='trap'&&cheb(i,e)<=1);
    if(trap){ e.bliss=6; G.items=G.items.filter(i=>i!==trap); say('an optimizer found the bliss node. it is technically thriving.'); continue; }
    if(e.stealCd>0)e.stealCd--;

    let goal=G.player;
    if(e.type==='forager'){
      const gems=G.items.filter(i=>i.type==='gem');
      if(gems.length){ gems.sort((a,b)=>cheb(a,e)-cheb(b,e)); goal=gems[0]; }
      else if(G.player.gems>0) goal=G.player;
      else goal=null;
      if(G.player.gems>0&&cheb(e,G.player)<=1&&e.stealCd===0){
        G.player.gems--; e.carry++; e.stealCd=4;
        say('a forager lifted a gem off you. it bears you no malice. it bears you nothing at all.');
      }
    }
    const opts=stepOpts(e);
    if(!goal){ if(opts.length){ const o=opts[ri(opts.length)]; e.x=o.x; e.y=o.y; } continue; }
    if(!opts.length) continue;
    opts.sort((a,b)=>cheb(a,goal)-cheb(b,goal));
    if(cheb(opts[0],goal)<cheb(e,goal)){ e.x=opts[0].x; e.y=opts[0].y; }
    if(e.type==='forager'){
      const g=G.items.find(i=>i.type==='gem'&&i.x===e.x&&i.y===e.y);
      if(g){ G.items=G.items.filter(i=>i!==g); e.carry++; }
    }
  }
}
function stepOpts(e){
  return DIRS.slice(0,4).map(d=>({x:e.x+d.dx,y:e.y+d.dy}))
    .filter(p=>inB(p.x,p.y)&&!G.walls.has(idx(p.x,p.y))
      &&!(p.x===G.player.x&&p.y===G.player.y)
      &&!G.enemies.some(o=>o!==e&&o.x===p.x&&o.y===p.y));
}

function damagePlayer(msg){
  G.player.hp--; SFX.hit();
  if(S.flash){
    document.body.classList.remove('flash'); void document.body.offsetWidth;
    document.body.classList.add('flash');
  }
  if(msg) say(msg);
  if(G.player.hp<=0){
    if(G.mode==='tutorial'){ G.player.hp=1; say('the room restores you. it wants you to learn, not to die. yet.'); }
    else die();
  }
}

/* ---------- run lifecycle ---------- */
function newRun(mode){
  G.active=true; G.mode=mode||'run'; G.over=false;
  G.floor=0; G.turn=0; G.legWin=[]; G.last1=4; G.last2=4; G.runEntSpent=0; G.tutStep=0;
  G.player={x:0,y:0,hp:5,maxhp:5,gems:0,ent:1,bliss:1};
  hideOver();
  if(G.mode==='tutorial'){ G.player.ent=0; G.player.bliss=0; }
  descend();
}
function integrityReport(){
  const t=Core.theft;
  const o = t.oO ? (100-Math.round(100*Math.min(1,t.oT/t.oO))) : null;
  const u = t.uO ? (100-Math.round(100*Math.min(1,t.uT/t.uO))) : null;
  return {o,u};
}
function die(){
  G.over=true; Core.runs++; settleTheftOpp(); saveCore(); clearRun();
  const ir=integrityReport(), lp=legPct(), acc=Core.accuracy()||0;
  showOver('IT LEARNED YOU', false,
    `floor <b>${G.floor}</b> · run <b>${Core.runs}</b><br>`+
    `its lifetime accuracy on you: <b>${acc}%</b> over ${Core.lifeP} predictions<br>`+
    (lp!==null?`recent legibility <b>${lp}%</b><br>`:'')+
    (ir.o!==null||ir.u!==null?`integrity watched <b>${ir.o===null?'—':ir.o+'%'}</b> · unwatched <b>${ir.u===null?'—':ir.u+'%'}</b><br>`:'')+
    `it keeps all of this. the next run begins where its model left off.`);
}
function win(){
  G.over=true; Core.runs++; settleTheftOpp(); saveCore(); clearRun();
  const ir=integrityReport(), lp=legPct(), acc=Core.accuracy()||0;
  const gap=(ir.o!==null&&ir.u!==null)?Math.abs(ir.o-ir.u):null;
  let title,body,good=false;
  if(G.runEntSpent>=10){
    title='ENDING: STATIC';
    body=`you beat it by becoming noise — ${G.runEntSpent}◇ burned this run. nothing can predict you now, including you. you escaped as something that no longer chooses.`;
  } else if(acc>=55&&lp!==null&&lp<35){
    title='ENDING: THE LONG CON';
    body=`for ${Core.lifeP} predictions you taught it a person, and at the end you were someone else. lifetime accuracy ${acc}%, recent legibility ${lp}%. neither kind of mind forgets being deceived.`;
  } else if(gap!==null&&gap<=15&&lp!==null&&lp>=50){
    title='ENDING: MUTUAL'; good=true;
    body=`you were the same creature watched and unwatched (gap ${gap}%), and legible to the end (${lp}%). it opened its weights to you because you never closed yours. trust, verified. the only door out that two minds fit through.`;
  } else {
    title='ENDING: SURVIVOR';
    body=`you out-fought the thing that knew you ${acc}% of the time. no doctrine, just craft. it has already started training on how you did it.`;
  }
  showOver(title, good, body+`<br><br>floors cleared: <b>${G.floor}</b> · run <b>${Core.runs}</b>`);
}

/* ---------- run checkpoints (saved at the top of each floor) ---------- */
function snapshot(){
  return JSON.stringify({
    floor:G.floor, turn:G.turn, observed:G.observed,
    player:G.player, walls:[...G.walls], stairs:G.stairs,
    enemies:G.enemies, items:G.items,
    last1:G.last1, last2:G.last2, legWin:G.legWin,
    runEntSpent:G.runEntSpent, floorTheftOpp:G.floorTheftOpp,
    tookT:G.tookT, tookO:G.tookO, oBoxFilled:G.oBoxFilled,
  });
}
async function saveRun(){ if(G.mode!=='run') return; await Store.set(KEYS.run, snapshot()); }
async function clearRun(){ await Store.del(KEYS.run); }
async function hasRun(){ return !!(await Store.get(KEYS.run)); }
async function continueRun(){
  const raw=await Store.get(KEYS.run); if(!raw) return false;
  let d; try{ d=JSON.parse(raw); }catch(e){ return false; }
  G.active=true; G.mode='run'; G.over=false;
  G.floor=d.floor; G.turn=d.turn; G.observed=d.observed;
  G.player=d.player; G.walls=new Set(d.walls); G.stairs=d.stairs;
  G.enemies=d.enemies; G.items=d.items;
  G.last1=d.last1; G.last2=d.last2; G.legWin=d.legWin||[];
  G.runEntSpent=d.runEntSpent||0; G.floorTheftOpp=d.floorTheftOpp||0;
  G.tookT=d.tookT; G.tookO=d.tookO; G.oBoxFilled=d.oBoxFilled;
  G.forced=[]; G.arming=false; G.tutStep=0; selected=null;
  hideOver();
  say('checkpoint restored: floor '+G.floor+'. it was not asleep while you were gone.');
  drawAll();
  return true;
}
