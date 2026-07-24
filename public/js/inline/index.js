(() => {
      const hideLoader = () => {
        const loader = document.getElementById('page-loader');
        if (!loader) return;
        loader.classList.add('is-hidden');
        window.setTimeout(() => loader.remove(), 450);
      };

      document.addEventListener('DOMContentLoaded', () => window.setTimeout(hideLoader, 100), { once: true });
      window.setTimeout(hideLoader, 3000);
    })();
