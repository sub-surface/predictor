'use strict';
/* All audio is synthesized via WebAudio.
   PITCH maps the five actions (←, ↑, →, ↓, ·) to distinct frequencies.
   The "pre-echo" plays the predicted action's chime BEFORE the player acts. */
let AC = null;
const PITCH = [330, 392, 440, 494, 262];

function tone(freq, dur, gainVal, type = 'sine') {
  if (!S.sound) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    const osc = AC.createOscillator();
    const gain = AC.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainVal, AC.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
    osc.connect(gain);
    gain.connect(AC.destination);
    osc.start();
    osc.stop(AC.currentTime + dur);
  } catch (e) {}
}

const SFX = {
  move: tok => tone(PITCH[tok], 0.05, 0.03, 'sine'),
  echo: tok => tone(PITCH[tok], 0.12, 0.025, 'triangle'), // Pre-echo chime
  hit:  ()  => tone(85, 0.18, 0.08, 'sawtooth'),
  kill: ()  => tone(130, 0.14, 0.06, 'square'),
  pick: ()  => tone(587, 0.08, 0.03, 'sine'),
  gate: ()  => tone(523, 0.15, 0.04, 'triangle'),
  ui:   ()  => tone(262, 0.05, 0.02, 'sine')
};
