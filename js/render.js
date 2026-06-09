'use strict';
/* Rendering: the chamber, the stains, the instruments. */
let cells=[], msgOld='';
const $=id=>document.getElementById(id);

const ITEMG={gem:['✶','gemc'],ent:['◇','entc'],blissPick:['ψ','blc'],cache:['▣','cachec'],
  vault:['≡','gatec'],shrine:['♦','shrc'],trap:['ψ','blc'],chestT:['◻','gemc'],chestO:['◼','entc'],
  marker:['✦','gatec']};

function buildBoard(){
  const board=$('board');
  board.style.setProperty('grid-template-columns',`repeat(${W},var(--cs))`);
  const cs=Math.min(Math.floor((Math.min(innerWidth,620)-20)/W),50);
  document.documentElement.style.setProperty('--cs',cs+'px');
  for(let i=0;i<W*H;i++){
    const c=document.createElement('div'); c.className='cell'; c.dataset.i=i;
    c.innerHTML='<div class="stain"></div><span class="glyph"></span>';
    board.appendChild(c); cells.push(c);
  }
}

function say(t){
  msgOld=$('logNew').textContent;
  $('logNew').textContent=t;
  $('logOld').textContent=msgOld;
}

function showOver(title,good,html){
  $('overTitle').textContent=title;
  $('overTitle').className=good?'good':'';
  $('overStats').innerHTML=html;
  $('over').classList.add('show');
}
function hideOver(){ $('over').classList.remove('show'); }

function drawAll(){
  const ps=G.enemies.map(e=>({e,p:predict(e)}));
  turnPreds=ps;
  let best=null;
  for(const o of ps) if(o.p&&(!best||o.p.conf>best.p.conf)) best=o;

  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const c=cells[idx(x,y)], g=c.querySelector('.glyph'), s=c.querySelector('.stain');
    c.className='cell'; g.className='glyph'; g.textContent=''; s.style.opacity=0;
    const old=c.querySelector('.hpdots'); if(old)old.remove();
    if(G.walls.has(idx(x,y))){ c.classList.add('wall'); continue; }
    if(G.stairs&&x===G.stairs.x&&y===G.stairs.y){ g.textContent='>'; g.classList.add('exit'); }
    const it=G.items.find(i=>i.x===x&&i.y===y);
    if(it){ const[ch,cl]=ITEMG[it.type]; g.textContent=ch; g.classList.add(cl); }
    const e=G.enemies.find(e=>e.x===x&&e.y===y);
    if(e){
      g.textContent=e.type==='avatar'?'Ω':e.type==='hive'?'H':e.type==='stalker'?'S':e.type==='forager'?'f':'d';
      g.classList.add('foe'); if(e.type==='avatar')g.classList.add('big');
      if(e.bliss>0)g.classList.add('blissed');
      if(e.hp>1){ const hd=document.createElement('div'); hd.className='hpdots'; hd.textContent='•'.repeat(e.hp); c.appendChild(hd); }
      if(e===selected)c.classList.add('sel');
    }
    if(x===G.player.x&&y===G.player.y){ g.textContent='@'; g.className='glyph you'; }
    let stain=0;
    for(const o of ps) if(o.p&&o.p.x===x&&o.p.y===y) stain=Math.max(stain,.14+.42*o.p.conf);
    if(stain)s.style.opacity=stain;
    if(best&&best.p.x===x&&best.p.y===y)c.classList.add('locked');
  }

  /* HUD */
  $('hFloor').textContent=G.floor;
  $('hHp').textContent='▮'.repeat(Math.max(0,G.player.hp))+'▯'.repeat(Math.max(0,G.player.maxhp-G.player.hp));
  const lp=legPct(); $('hLeg').textContent=lp===null?'—':lp+'%';
  $('hEnt').textContent=G.player.ent; $('hGem').textContent=G.player.gems; $('hBl').textContent=G.player.bliss;
  $('hEye').textContent=G.observed?'◉':'○';
  $('hEyeWrap').style.opacity=G.observed?1:.45;

  /* model panel: selected, else nearest predictive unit */
  let show=selected&&G.enemies.includes(selected)?selected:null;
  if(!show){ for(const e of G.enemies) if(e.type!=='forager'&&(!show||cheb(e,G.player)<cheb(show,G.player))) show=e; }
  if(!show&&G.enemies.length) show=G.enemies[0];
  const fills=document.querySelectorAll('#bars .fill'), barEls=document.querySelectorAll('#bars .bar');
  if(show){
    const names={drone:'DRONE',stalker:'STALKER',hive:'HIVE (core-linked)',forager:'FORAGER',avatar:'Ω THE PREDICTOR'};
    $('modelWho').textContent=names[show.type]+(show.bliss>0?' — blissed':'');
    $('objline').innerHTML='objective: <b>'+show.obj+'</b>'+(show.range?' · zap range '+(show.range>10?'∞':show.range):'');
    const d=predRowOf(show);
    if(d){ const mx=Math.max(...d);
      d.forEach((v,i)=>{ fills[i].style.height=Math.round(100*v)+'%'; barEls[i].classList.toggle('top',v===mx&&mx>0); }); }
    else{ fills.forEach(f=>f.style.height='0%'); barEls.forEach(b=>b.classList.remove('top')); }
  } else {
    $('modelWho').textContent='no signal';
    $('objline').textContent='nothing here is modeling you. enjoy it.';
    fills.forEach(f=>f.style.height='0%'); barEls.forEach(b=>b.classList.remove('top'));
  }

  /* core panel */
  $('cRuns').textContent=Core.runs+1;
  $('cAcc').textContent=Core.accuracy()===null?'—':Core.accuracy()+'%';
  $('cN').textContent=Math.round(Core.n);
  $('cNote').textContent = G.mode==='tutorial' ? 'sandboxed — this room is not recorded.'
    : Core.n>800 ? 'it knows your gait by now.'
    : Core.n>200 ? 'it is starting to feel familiar to it.'
    : 'it keeps what it learns.';

  /* action buttons */
  $('aNoise').disabled=G.player.ent<1||G.forced.length>0||G.arming;
  $('aBliss').disabled=G.player.bliss<1||G.forced.length>0||G.arming;
  $('aDrop').disabled=G.player.gems<1||G.forced.length>0||G.arming;

  /* pre-echo: when it is confident and you are legible, the score plays your move before you do */
  if(best&&best.p.conf>.55&&lp!==null&&lp>55)SFX.echo(best.p.tok);
}
