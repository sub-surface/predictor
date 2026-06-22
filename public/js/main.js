'use strict';
/* Boot sequence. */
(async function boot(){
  await loadSettings();
  await loadCore();
  buildBoard();
  bindInput();
  $('sSound').textContent=S.sound?'ON':'OFF';
  $('sFlash').textContent=S.flash?'ON':'OFF';
  $('sCb').textContent=S.cb?'ON':'OFF';
  document.body.classList.toggle('colorblind', S.cb);
  await Menu.show('home');
  setInterval(()=>{ if(Core.dirty)saveCore(); }, 8000);
})();
