(() => {
  const hideLoader = () => {
    const loader = document.getElementById('page-loader');
    if (!loader) return;
    loader.classList.add('is-hidden');
    loader.style.opacity = '0';
    window.setTimeout(() => loader.remove(), 300);
  };

  hideLoader();
  document.addEventListener('DOMContentLoaded', hideLoader, { once: true });
})();
