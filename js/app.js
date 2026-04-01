import { loadWorkoutView, loadHistoryView, initEvents, initContextMenu, switchView } from './ui.js';

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .catch((err) => console.warn('SW registration failed:', err));
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  initEvents();
  initContextMenu();
  switchView('today');
});
