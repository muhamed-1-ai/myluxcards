(() => {
  // 1. Safe Page Loader Dismissal
  const hideLoader = (immediate = false) => {
    const loader = document.getElementById('page-loader');
    if (!loader) return;
    loader.classList.add('is-hidden');
    if (immediate) {
      try { loader.style.display = 'none'; } catch { }
      return;
    }
    loader.style.opacity = '0';
    window.setTimeout(() => {
      try { loader.style.display = 'none'; } catch { }
    }, 350);
  };

  const isContentReady = typeof window !== 'undefined' && Boolean(window.__zappit_page_ready);
  if (isContentReady) {
    hideLoader(true);
  } else {
    hideLoader(false);
  }

  document.addEventListener('DOMContentLoaded', () => hideLoader(false), { once: true });
  window.addEventListener('load', () => hideLoader(false), { once: true });

  // 2. Floating Frosted Navbar Scroll Effect & Glow Indicator
  const handleScroll = () => {
    const nav = document.querySelector('.navbar');
    const wrapper = document.getElementById('navbar-wrapper');
    const indicator = document.getElementById('navbar-scroll-indicator');
    if (!nav) return;
    const isScrolled = window.scrollY > 20;
    nav.classList.toggle('navbar-scrolled', isScrolled);
    if (wrapper) wrapper.classList.toggle('is-scrolled', isScrolled);

    if (indicator) {
      const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
      indicator.style.width = `${scrolled}%`;
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // 3. Mobile Navigation Accessibility & Outside Click
  const initMobileNav = () => {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');
    if (!hamburger || !navMenu) return;

    const closeMobileMenu = () => {
      navMenu.classList.remove('is-open');
      navMenu.style.display = '';
      hamburger.setAttribute('aria-expanded', 'false');
      hamburger.setAttribute('aria-label', 'Open navigation menu');
    };

    hamburger.addEventListener('click', () => {
      const isOpen = navMenu.classList.contains('is-open');
      if (isOpen) {
        closeMobileMenu();
      } else {
        navMenu.classList.add('is-open');
        navMenu.style.display = 'flex';
        hamburger.setAttribute('aria-expanded', 'true');
        hamburger.setAttribute('aria-label', 'Close navigation menu');
      }
    });

    // Close menu on link navigation
    navMenu.querySelectorAll('a, button').forEach(link => {
      link.addEventListener('click', () => {
        closeMobileMenu();
      });
    });

    // Escape key listener for keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navMenu.classList.contains('is-open')) {
        closeMobileMenu();
        hamburger.focus();
      }
    });
  };

  // 4. Scroll Spy: active navigation states & aria-current
  const initScrollSpy = () => {
    const navLinks = [
      { id: 'nav-home-link', target: '#hero', isHome: true },
      { id: 'nav-materials-link', target: '#materials' },
      { id: 'nav-profile-link', target: '#profile-experience' },
      { id: 'nav-crm-link', target: '#crm-workspace' },
      { id: 'nav-steps-link', target: '#how-it-works' },
      { id: 'nav-bundles-link', target: '#bundles' },
      { id: 'nav-faq-link', target: '#faq' },
    ];

    const elements = navLinks.map(item => {
      const linkEl = document.getElementById(item.id);
      const sectionEl = item.target === '#hero'
        ? (document.getElementById('hero') || document.body)
        : document.querySelector(item.target);
      return { ...item, linkEl, sectionEl };
    }).filter(i => i.linkEl && i.sectionEl);

    const updateActiveNav = () => {
      const scrollPos = window.scrollY + 120;
      let currentActive = elements[0];

      for (let i = elements.length - 1; i >= 0; i--) {
        const sec = elements[i].sectionEl;
        if (sec && sec.offsetTop <= scrollPos) {
          currentActive = elements[i];
          break;
        }
      }

      elements.forEach(item => {
        if (item === currentActive) {
          item.linkEl.classList.add('active');
          if (item.isHome) {
            item.linkEl.setAttribute('aria-current', 'page');
          } else {
            item.linkEl.setAttribute('aria-current', 'true');
          }
        } else {
          item.linkEl.classList.remove('active');
          item.linkEl.removeAttribute('aria-current');
        }
      });
    };

    window.addEventListener('scroll', updateActiveNav, { passive: true });
    updateActiveNav();
  };

  // 5. Finish Selection & Coordinated Pricing Switcher
  let currentFinish = 'black'; // 'black' | 'white'

  const updateFinishUI = (finish) => {
    currentFinish = finish;
    const isBlack = finish === 'black';

    // Materials Cards Update
    const blackCard = document.getElementById('card-finish-black');
    const whiteCard = document.getElementById('card-finish-white');
    const blackPill = document.getElementById('badge-selected-black');
    const whitePill = document.getElementById('badge-selected-white');
    const btnBlack = document.getElementById('btn-choose-black');
    const btnWhite = document.getElementById('btn-choose-white');

    if (blackCard) blackCard.classList.toggle('is-selected', isBlack);
    if (whiteCard) whiteCard.classList.toggle('is-selected', !isBlack);

    if (blackPill) blackPill.style.display = isBlack ? 'inline-flex' : 'none';
    if (whitePill) whitePill.style.display = isBlack ? 'none' : 'inline-flex';

    if (btnBlack) {
      btnBlack.className = isBlack ? 'apple-btn apple-btn-primary' : 'apple-btn apple-btn-glass';
      btnBlack.textContent = isBlack ? 'Selected' : 'Choose Black';
    }
    if (btnWhite) {
      btnWhite.className = !isBlack ? 'apple-btn apple-btn-primary' : 'apple-btn apple-btn-glass';
      btnWhite.textContent = !isBlack ? 'Selected' : 'Choose White';
    }

    // Bundles Switcher Bar Update
    const toggleBlack = document.getElementById('bundle-toggle-black');
    const toggleWhite = document.getElementById('bundle-toggle-white');
    if (toggleBlack) toggleBlack.classList.toggle('is-active', isBlack);
    if (toggleWhite) toggleWhite.classList.toggle('is-active', !isBlack);

    // Bundle Prices & Feature Labels Update
    const standardPriceEl = document.getElementById('price-bundle-standard');
    const standardTermEl = document.getElementById('term-bundle-standard');
    const cardFeatureLabel = document.getElementById('card-feature-finish-label');
    const crmPriceEl = document.getElementById('price-bundle-crm');
    const crmTermEl = document.getElementById('term-bundle-crm');

    if (standardPriceEl) standardPriceEl.textContent = '1,999';
    if (standardTermEl) standardTermEl.textContent = isBlack ? 'for Matte Black PVC' : 'for Ceramic White PVC';
    if (cardFeatureLabel) cardFeatureLabel.textContent = isBlack
      ? 'Custom NFC smart card (Velvet Matte Black PVC)'
      : 'Custom NFC smart card (Ceramic White PVC)';

    if (crmPriceEl) crmPriceEl.textContent = '2,999';
    if (crmTermEl) crmTermEl.textContent = isBlack ? 'for Matte Black PVC' : 'for Ceramic White PVC';
  };

  const initFinishButtons = () => {
    document.querySelectorAll('[data-select-finish]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const finish = btn.getAttribute('data-select-finish');
        if (finish) {
          updateFinishUI(finish);
          // If triggered from materials button, smooth scroll towards bundles
          if (btn.id === 'btn-choose-black' || btn.id === 'btn-choose-white') {
            const bundlesSection = document.getElementById('bundles');
            if (bundlesSection) {
              bundlesSection.scrollIntoView({ behavior: 'smooth' });
            }
          }
        }
      });
    });
  };

  // 6. Interactive Live Sample Profile Demonstration Modal & Actions
  const initLiveProfileDemo = () => {
    const demoModal = document.getElementById('live-demo-modal');
    const heroCard = document.getElementById('tap-card');
    const heroBtn = document.getElementById('hero-live-demo-btn');
    const heroDemoTrigger = document.getElementById('hero-demo-profile-trigger');
    const sectionBtn = document.getElementById('section-live-demo-btn');
    const closeBtn = document.getElementById('close-live-demo-btn');

    const openDemoModal = () => {
      if (!demoModal) return;
      demoModal.classList.add('open');
      demoModal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      if (window.lucide) window.lucide.createIcons();
    };

    const closeDemoModal = () => {
      if (!demoModal) return;
      demoModal.classList.remove('open');
      demoModal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    };

    heroCard?.addEventListener('click', openDemoModal);
    heroBtn?.addEventListener('click', openDemoModal);
    heroDemoTrigger?.addEventListener('click', openDemoModal);
    sectionBtn?.addEventListener('click', openDemoModal);
    closeBtn?.addEventListener('click', closeDemoModal);

    demoModal?.addEventListener('click', (e) => {
      if (e.target === demoModal) closeDemoModal();
    });

    // Helper: simulate vCard download (.vcf file)
    const downloadSampleVCard = () => {
      const vcardData = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        'FN:Alex Morgan',
        'N:Morgan;Alex;;;',
        'ORG:Apex Creative Studio',
        'TITLE:Founder & Managing Director',
        'TEL;TYPE=WORK,VOICE:+919876500123',
        'EMAIL;TYPE=WORK,INTERNET:alex@apexcreativestudio.com',
        'URL:https://apexcreativestudio.com',
        'NOTE:Saved via Zappit Smart NFC Business Card',
        'END:VCARD'
      ].join('\r\n');

      const blob = new Blob([vcardData], { type: 'text/vcard;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'alex-morgan-apex.vcf');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast('Downloaded sample vCard: alex-morgan-apex.vcf', 'success');
      }
    };

    // Helper: simulate WhatsApp chat
    const simulateWhatsApp = () => {
      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast('Simulating WhatsApp Chat to +91 98765 00123: "Hi Alex, I tapped your Zappit card!"', 'success');
      }
    };

    // Helper: simulate voluntary lead exchange
    const simulateLeadExchange = () => {
      if (window.app && typeof window.app.showToast === 'function') {
        window.app.showToast('Lead Exchange: In live profiles, this opens a contact form sending your details directly to the card owner\'s CRM.', 'info');
      }
    };

    // Wire actions in mockup screen (on page) and in modal
    ['demo-save-vcard-btn', 'modal-demo-vcard'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', downloadSampleVCard);
    });

    ['demo-whatsapp-btn', 'modal-demo-whatsapp'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', simulateWhatsApp);
    });

    ['demo-share-details-btn', 'modal-demo-share-details'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', simulateLeadExchange);
    });
  };

  // 8. Practical Verified FAQ Accordion
  const initFaqAccordion = () => {
    const accordion = document.getElementById('faq-accordion');
    if (!accordion) return;

    accordion.querySelectorAll('.faq-trigger').forEach(trigger => {
      trigger.addEventListener('click', () => {
        const item = trigger.closest('.faq-item');
        if (!item) return;
        const isExpanded = trigger.getAttribute('aria-expanded') === 'true';

        // Close other items
        accordion.querySelectorAll('.faq-item').forEach(other => {
          if (other !== item) {
            other.classList.remove('is-open');
            other.querySelector('.faq-trigger')?.setAttribute('aria-expanded', 'false');
          }
        });

        // Toggle current item
        if (isExpanded) {
          item.classList.remove('is-open');
          trigger.setAttribute('aria-expanded', 'false');
        } else {
          item.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
        }
      });
    });
  };

  // 9. Add to Cart Handlers for Cards and Bundles
  const initAddToCart = () => {
    // Add individual finish cards (Direct shortcut: Add Standard Bundle)
    document.querySelectorAll('[data-add-to-cart]').forEach(btn => {
      btn.addEventListener('click', () => {
        const finish = btn.getAttribute('data-add-to-cart');
        const isBlack = finish === 'black';
        const product = {
          id: `bundle-standard-${finish}`,
          title: `NFC Card + Software (${isBlack ? 'Velvet Matte Black PVC' : 'Ceramic White PVC'})`,
          price: 1999,
          currency: 'INR',
          image: isBlack ? '/assets/black-pvc-card.jpg' : '/assets/white-pvc-card.jpg',
          details: 'Includes Hardware + 1-Year Profile Hosting',
          billingPeriod: 'One-time hardware',
          dueToday: 1999,
          renewsLater: 'Renews at ₹499/year after Year 1 · Manual profile renewal',
          renewalTerm: '₹499/yr after 1st yr',
          finish: isBlack ? 'Velvet Matte Black PVC' : 'Ceramic White PVC',
          bundleType: 'standard'
        };

        if (window.app && window.app.state) {
          const exists = window.app.state.cart.find(i => String(i.id) === product.id);
          if (exists) {
            exists.quantity = (Number(exists.quantity) || 1) + 1;
            window.app.showToast(`${product.title} quantity updated in cart.`, 'success');
          } else {
            window.app.state.cart.push({ ...product, quantity: 1 });
            window.app.showToast(`${product.title} added to cart.`, 'success');
          }
          window.app.updateCounters();
          window.app.renderCartDrawer();
          window.app.openCartDrawer();
        }
      });
    });

    // Add bundle packages
    document.querySelectorAll('[data-add-bundle-cart]').forEach(btn => {
      btn.addEventListener('click', () => {
        const bundleType = btn.getAttribute('data-add-bundle-cart');
        const isCRM = bundleType === 'crm';
        const isBlack = currentFinish === 'black';

        const bundleProduct = {
          id: isCRM ? `bundle-crm-${currentFinish}` : `bundle-standard-${currentFinish}`,
          title: isCRM
            ? `NFC Card + Lead Management CRM (${isBlack ? 'Velvet Matte Black PVC' : 'Ceramic White PVC'})`
          : `NFC Card + Software (${isBlack ? 'Velvet Matte Black PVC' : 'Ceramic White PVC'})`,
          price: isCRM ? 2999 : 1999,
            currency: 'INR',
              image: isBlack ? '/assets/black-pvc-card.jpg' : '/assets/white-pvc-card.jpg',
        details: isCRM ? 'Includes Hardware + 1-Year Full CRM Workspace' : 'Includes Hardware + 1-Year Profile Hosting',
          billingPeriod: isCRM ? '₹2,999/year' : 'One-time hardware',
            dueToday: isCRM ? 2999 : 1999,
              renewsLater: isCRM
                ? 'Renews at ₹2,999/year · Manual annual renewal'
                : 'Renews at ₹499/year after Year 1 · Manual profile renewal',
                renewalTerm: isCRM ? '₹2,999/year' : '₹499/yr after 1st yr',
                  finish: isBlack ? 'Velvet Matte Black PVC' : 'Ceramic White PVC',
                    bundleType: isCRM ? 'crm' : 'standard'
      };

      if (window.app && window.app.state) {
        const exists = window.app.state.cart.find(i => String(i.id) === bundleProduct.id);
        if (exists) {
          exists.quantity = (Number(exists.quantity) || 1) + 1;
          window.app.showToast(`${bundleProduct.title} quantity updated in cart.`, 'success');
        } else {
          window.app.state.cart.push({ ...bundleProduct, quantity: 1 });
          window.app.showToast(`${bundleProduct.title} added to cart.`, 'success');
        }
        window.app.updateCounters();
        window.app.renderCartDrawer();
        window.app.openCartDrawer();
      }
    });
  });
};

// 9. Global Escape Key for Dialogs & Modals
const initGlobalEscape = () => {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const demoModal = document.getElementById('live-demo-modal');
      if (demoModal?.classList.contains('open')) {
        demoModal.classList.remove('open');
        demoModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
      }
    }
  });
};

// 10. Isolated CRM Dashboard Preview Theme Switcher (Dark / Light)
const initCrmPreviewThemeSwitcher = () => {
  const card = document.getElementById('crm-preview-card');
  const toggleBtns = document.querySelectorAll('.crm-theme-btn');
  if (!card || !toggleBtns.length) return;

  const setPreviewMode = (mode) => {
    const isLight = mode === 'light';
    card.setAttribute('data-preview-theme', isLight ? 'light' : 'dark');

    toggleBtns.forEach((btn) => {
      const active = btn.getAttribute('data-theme-val') === (isLight ? 'light' : 'dark');
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    // Synchronize full-size lightbox image & badge if present
    const fullsizeImg = document.getElementById('crm-fullsize-img');
    const fullsizeBadge = document.getElementById('crm-fullsize-mode-badge');
    if (fullsizeImg) fullsizeImg.src = isLight ? '/assets/crm-dashboard-light.png' : '/assets/crm-dashboard-dark.png';
    if (fullsizeBadge) fullsizeBadge.textContent = isLight ? 'Light Mode' : 'Dark Mode';

    try {
      sessionStorage.setItem('zappit_crm_preview_mode', isLight ? 'light' : 'dark');
    } catch { }
  };

  toggleBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const mode = btn.getAttribute('data-theme-val');
      if (mode) setPreviewMode(mode);
    });
  });

  try {
    const saved = sessionStorage.getItem('zappit_crm_preview_mode');
    if (saved === 'light') {
      setPreviewMode('light');
    }
  } catch { }
};

// 11. CRM Full-Size Preview Lightbox Modal
const initCrmFullsizeModal = () => {
  const openBtn = document.getElementById('crm-preview-fullsize-btn');
  const modal = document.getElementById('crm-fullsize-modal');
  const closeBtn = document.getElementById('crm-fullsize-close-btn');
  const img = document.getElementById('crm-fullsize-img');
  const badge = document.getElementById('crm-fullsize-mode-badge');
  const card = document.getElementById('crm-preview-card');
  if (!openBtn || !modal) return;

  let lastOpener = null;

  const openModal = () => {
    lastOpener = document.activeElement;
    const isLight = card?.getAttribute('data-preview-theme') === 'light';
    if (img) img.src = isLight ? '/assets/crm-dashboard-light.png' : '/assets/crm-dashboard-dark.png';
    if (badge) badge.textContent = isLight ? 'Light Mode' : 'Dark Mode';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
    if (closeBtn) {
      setTimeout(() => {
        try { closeBtn.focus(); } catch (err) { }
      }, 50);
    }
  };

  const closeModal = () => {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
    if (lastOpener && typeof lastOpener.focus === 'function') {
      try { lastOpener.focus(); } catch (err) { }
      lastOpener = null;
    }
  };

  openBtn.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      e.preventDefault();
      closeModal();
    }
  });
};

// Master Initializer
const init = () => {
  initMobileNav();
  initScrollSpy();
  initFinishButtons();
  initLiveProfileDemo();
  initFaqAccordion();
  initAddToCart();
  initGlobalEscape();
  initCrmPreviewThemeSwitcher();
  initCrmFullsizeModal();
  updateFinishUI('black');
  if (window.lucide) window.lucide.createIcons();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
}) ();
