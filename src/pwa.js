// Development stays uncached; production works at / and GitHub Pages subpaths.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch((error) => {
      console.warn('Offline support could not be enabled:', error);
    });
  }, { once: true });
}
