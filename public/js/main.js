'use strict';
/* THE PREDICTOR — Main Boot Sequence with BIOS & Menu Router. */
(async function boot() {
  await loadSettings();
  await loadCore();

  // Restore saved theme
  if (S.theme) {
    setTheme(S.theme);
  }

  bindInput();

  // Update Main Menu status bar
  const menuStatus = $('menu-core-status');
  if (menuStatus) {
    const acc = Core.accuracy();
    menuStatus.textContent = `CORE STATUS: MOUNTED // OBSERVED: ${Core.n} MOVES // ACCURACY: ${acc !== null ? acc + '%' : 'CALIBRATING'}`;
  }

  // Initial greeting in CLI
  cliPrint('A-9 SUBSYSTEM MOUNTED: PROTOCOL OK.', 'daemon');
  cliPrint('Type "help" for a list of system commands.', 'system');

  // Launch Retro BIOS sequence on boot, then transition to DOS Menu
  runBiosSequence(() => {
    showScreen('menu');
  });

  // Periodic persistence
  setInterval(() => {
    if (Core.dirty) saveCore();
  }, 5000);
})();
