(() => {
  // 1. Safe Page Loader Dismissal
  const hideLoader = () => {
    const loader = document.getElementById('page-loader');
    if (!loader) return;
    loader.classList.add('is-hidden');
    loader.style.opacity = '0';
    window.setTimeout(() => {
      try { loader.remove(); } catch {}
    }, 300);
  };

  hideLoader();
  document.addEventListener('DOMContentLoaded', hideLoader, { once: true });
  window.addEventListener('load', hideLoader, { once: true });

  // 2. Floating Frosted Navbar Scroll Effect with Mint Ambient Glow
  const handleScroll = () => {
    const nav = document.querySelector('.navbar');
    const wrapper = document.getElementById('navbar-wrapper');
    if (!nav) return;
    const isScrolled = window.scrollY > 20;
    nav.classList.toggle('navbar-scrolled', isScrolled);
    if (wrapper) wrapper.classList.toggle('is-scrolled', isScrolled);
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // 3. Mobile Navigation Accessibility & Outside Click
  document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');

    if (hamburger && navMenu) {
      // Close menu on link navigation
      navMenu.querySelectorAll('a, button').forEach(link => {
        link.addEventListener('click', () => {
          navMenu.classList.remove('is-open');
          hamburger.setAttribute('aria-expanded', 'false');
          hamburger.setAttribute('aria-label', 'Open navigation menu');
        });
      });

      // Escape key listener for keyboard navigation
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navMenu.classList.contains('is-open')) {
          navMenu.classList.remove('is-open');
          hamburger.setAttribute('aria-expanded', 'false');
          hamburger.setAttribute('aria-label', 'Open navigation menu');
          hamburger.focus();
        }
      });
    }
  });
})();
