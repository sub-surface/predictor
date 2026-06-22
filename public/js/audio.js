'use strict';
/* All audio is synthesized. PITCH maps the five actions (←↑→↓·) to notes;
   the "pre-echo" plays the predicted action's note before the player acts. */
let AC = null;
const PITCH = [330, 392, 440, 494, 262];

function tone(f, dur, g, type){
  if(!S.sound) return;
  try{
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if(AC.state === 'suspended') AC.resume();
    const o = AC.createOscillator(), gn = AC.createGain();
    o.type = type || 'sine'; o.frequency.value = f;
    gn.gain.setValueAtTime(g, AC.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
    o.connect(gn); gn.connect(AC.destination);
    o.start(); o.stop(AC.currentTime + dur);
  }catch(e){}
}

const SFX = {
  move:  tok => tone(PITCH[tok], .05, .03),
  echo:  tok => tone(PITCH[tok], .09, .018),
  hit:   ()  => tone(80,  .18, .06, 'sawtooth'),
  kill:  ()  => tone(120, .12, .05, 'square'),
  pick:  ()  => tone(587, .07, .025),
  ui:    ()  => tone(262, .05, .02),
};

const Music = {
  bgm: null,
  start(){
    if(!S.sound) return;
    if(this.bgm) clearInterval(this.bgm);
    this.bgm = setInterval(() => {
      if(!G.active || G.over || !S.sound) return;
      // Generative ambient drone based on legibility
      const leg = Core.accuracy();
      const baseFreq = 55 + (leg || 0) * 0.5; // Drone gets higher pitched if legible
      tone(baseFreq, 2.0, 0.015, 'triangle');
      // Random ping based on prediction top choice
      const topAction = Core.predictOne();
      if(topAction !== null && Math.random() < 0.3){
        tone(PITCH[topAction]*2, 0.4, 0.01, 'sine');
      }
    }, 2000);
  },
  stop(){
    if(this.bgm) clearInterval(this.bgm);
    this.bgm = null;
  }
};
