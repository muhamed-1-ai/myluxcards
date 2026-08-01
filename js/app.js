// Main myluxcards Application Controller

class LuxApp {
  constructor() {
    this.state = {
      wishlist: JSON.parse(localStorage.getItem('myluxcards_wishlist')) || [],
      cart: (JSON.parse(localStorage.getItem('myluxcards_cart')) || []).map(item => ({ ...item, quantity: Number(item.quantity) || 1 })),
      supportTickets: JSON.parse(localStorage.getItem('myluxcards_support_tickets')) || [],
      submittedReviews: JSON.parse(localStorage.getItem('myluxcards_reviews')) || [],
      activeCategory: 'all',
      searchQuery: '',
      priceLimit: 5,
      filterPremium: true,
      filterFree: true,
      sortBy: 'popular',
      currentPage: 1,
      cardsPerPage: 6,
      currentTestimonialIndex: 0,
      engageShown: JSON.parse(localStorage.getItem('myluxcards_engage_shown')) || false
    };
    
    // Bind methods
    this.init();
  }

  async hashPassword(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  updateAccountButton(user) {
    const button = document.getElementById('login-trigger');
    if (!button || !user) return;
    button.textContent = user.name?.split(' ')[0] || 'Account';
    button.title = `Signed in as ${user.email}`;
    button.dataset.authenticated = 'true';
    button.setAttribute('aria-label', `Signed in as ${user.name || user.email}`);
  }

  init() {
    // 1. Loader dismissal
    const hideLoader = () => {
      const loader = document.getElementById('page-loader');
      if (!loader) return;
      loader.style.transition = 'opacity 0.4s ease';
      loader.style.opacity = '0';
      setTimeout(() => loader.style.display = 'none', 500);
    };

    window.addEventListener('load', hideLoader);
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      hideLoader();
    }

    // Fallback: ensure loader hides even if load events are delayed or blocked
    setTimeout(() => {
      const loader = document.getElementById('page-loader');
      if (loader && loader.style.display !== 'none') {
        hideLoader();
      }
    }, 3000);

    // 3. Render Initial Catalog Grid
    this.renderCatalog();
    this.renderCategoryChips();
    this.renderTestimonials();
    this.initTestimonialAutoPlay();
    this.renderSupportTickets();
    this.updateCounters();
    this.initTheme();

    // 4. Bind All UI Events
    this.bindEvents();
    this.initScrollReveal();
    this.initHeroParticles();
    this.initEngagementBanner();
    this.initCustomCursor();
    this.initConfigurator();
    this.initTapDemo();
    this.initProfileBuilder();
    this.initLeadCapture();
  }

  initCustomCursor() {
    const ring = document.getElementById('custom-cursor-ring');
    if (!ring) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;
    let speedRing = 0.2;

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    const animateCursor = () => {
      ringX += (mouseX - ringX) * speedRing;
      ringY += (mouseY - ringY) * speedRing;
      
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate3d(-50%, -50%, 0)`;
      requestAnimationFrame(animateCursor);
    };
    animateCursor();

    const interactiveElements = document.querySelectorAll('a, button, .color-swatch, .product-card, .btn, input, select, textarea');
    interactiveElements.forEach(el => {
      el.addEventListener('mouseenter', () => {
        ring.classList.add('cursor-hover');
      });
      el.addEventListener('mouseleave', () => {
        ring.classList.remove('cursor-hover');
      });
    });
  }

  initConfigurator() {
    const swatches = document.querySelectorAll('.color-swatch');
    const configCard = document.getElementById('config-card');
    if (!swatches.length || !configCard) return;
    const saveButton = document.getElementById('save-card-design');
    if (saveButton) saveButton.textContent = 'Save Design & Add to Cart · ₹1,499';

    swatches.forEach(swatch => {
      swatch.addEventListener('click', () => {
        swatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        
        const color = swatch.dataset.color;
        const accent = swatch.dataset.accent;
        
        configCard.style.background = `linear-gradient(135deg, ${color}, #000)`;
        configCard.style.color = accent;
        configCard.style.borderColor = accent;
        configCard.style.boxShadow = `0 10px 40px ${accent}44`;
      });
    });

    const previewName = configCard.querySelector('.nfc-card-name');
    const previewTitle = configCard.querySelector('.nfc-card-subtitle');
    document.getElementById('card-name-input')?.addEventListener('input', (event) => previewName.textContent = event.target.value || 'Your Name');
    document.getElementById('card-title-input')?.addEventListener('input', (event) => previewTitle.textContent = event.target.value || 'Your Title');
    document.getElementById('card-finish')?.addEventListener('change', (event) => {
      configCard.style.filter = event.target.value === 'Glossy' ? 'saturate(1.2) brightness(1.15)' : 'none';
    });
    document.getElementById('card-material')?.addEventListener('change', (event) => {
      configCard.dataset.material = event.target.value;
      configCard.title = `${event.target.value} card preview`;
    });
    configCard.addEventListener('pointermove', (event) => {
      const bounds = configCard.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - .5;
      const y = (event.clientY - bounds.top) / bounds.height - .5;
      configCard.style.transform = `rotateY(${x * 20}deg) rotateX(${-y * 16}deg) scale(1.03)`;
    });
    configCard.addEventListener('pointerleave', () => configCard.style.transform = 'rotateY(-15deg) rotateX(5deg)');
    saveButton?.addEventListener('click', () => {
      const activeSwatch = document.querySelector('.color-swatch.active') || swatches[0];
      const design = {
        material: document.getElementById('card-material')?.value || 'PVC',
        finish: document.getElementById('card-finish')?.value || 'Matte',
        name: document.getElementById('card-name-input')?.value.trim() || 'Your Name',
        designation: document.getElementById('card-title-input')?.value.trim() || 'Your Title',
        logoPlacement: document.getElementById('logo-placement')?.value || 'Top left',
        qrPlacement: document.getElementById('qr-placement')?.value || 'Back of card',
        color: activeSwatch.dataset.color || '#0E0E10',
        accent: activeSwatch.dataset.accent || '#D4AF37',
        colorName: activeSwatch.title || 'Custom'
      };
      const customCard = {
        id: 'custom-nfc-card',
        title: `${design.name}'s Custom NFC Card`,
        price: 1499,
        currency: 'INR',
        quantity: 1,
        image: this.createConfiguredCardImage(design),
        details: `${design.material} · ${design.finish} · ${design.colorName}`,
        design
      };
      const existingIndex = this.state.cart.findIndex(item => String(item.id) === customCard.id);
      if (existingIndex === -1) {
        this.state.cart.push(customCard);
      } else {
        customCard.quantity = Number(this.state.cart[existingIndex].quantity) || 1;
        this.state.cart[existingIndex] = customCard;
      }
      localStorage.setItem('myluxcards_saved_card_design', JSON.stringify(design));
      this.updateCounters();
      this.renderCartDrawer();
      this.openCartDrawer();
      this.showToast('Your design was saved and added to cart for ₹1,499.', 'success');
    });
  }

  createConfiguredCardImage(design) {
    const xml = (value) => String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
    })[character]);
    const glossy = design.finish === 'Glossy'
      ? '<path d="M0 0h560L260 350H0z" fill="#fff" opacity=".12"/>'
      : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="350" viewBox="0 0 560 350">
      <defs><linearGradient id="card" x2="1" y2="1"><stop stop-color="${xml(design.color)}"/><stop offset="1"/></linearGradient></defs>
      <rect width="560" height="350" rx="28" fill="url(#card)" stroke="${xml(design.accent)}" stroke-width="4"/>
      ${glossy}
      <g fill="${xml(design.accent)}">
        <text x="38" y="68" font-family="Arial,sans-serif" font-size="27" font-weight="700">MYLUXCARDS</text>
        <text x="38" y="96" font-family="Arial,sans-serif" font-size="13" letter-spacing="3">PREMIUM EDITION</text>
        <text x="38" y="268" font-family="Georgia,serif" font-size="30" font-weight="700">${xml(design.name)}</text>
        <text x="38" y="300" font-family="Arial,sans-serif" font-size="17">${xml(design.designation)}</text>
        <rect x="455" y="260" width="58" height="43" rx="8" fill="none" stroke="${xml(design.accent)}" stroke-width="4"/>
        <path d="M474 22q30 18 0 36m10-29q17 10 0 21m10-14q7 4 0 8" fill="none" stroke="${xml(design.accent)}" stroke-width="4" stroke-linecap="round"/>
      </g>
    </svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  initTapDemo() {
    const card = document.getElementById('tap-card');
    const phone = document.getElementById('tap-phone');
    const trigger = document.getElementById('tap-demo-trigger');
    const openProfile = () => {
      if (!phone) return;
      phone.classList.add('is-open');
      const state = document.getElementById('tap-profile-state');
      if (state) state.innerHTML = '<i data-lucide="badge-check"></i><strong>Aarav Menon</strong><span>Creative Director · MyLux Studio</span><button class="mini-profile-btn" type="button">View profile</button>';
      if (window.lucide) window.lucide.createIcons();
      this.showToast('Tap successful — digital profile opened.', 'success');
    };
    card?.addEventListener('click', openProfile);
    trigger?.addEventListener('click', openProfile);
  }

  initProfileBuilder() {
    const inputs = document.querySelectorAll('[data-profile]');
    if (!inputs.length) return;
    const value = (key) => document.querySelector(`[data-profile="${key}"]`)?.value.trim() || '';
    const update = () => {
      const name = value('name') || 'Your Name';
      const title = value('title') || 'Your title';
      const company = value('company');
      document.getElementById('preview-name').textContent = name;
      document.getElementById('preview-role').textContent = company ? `${title} · ${company}` : title;
      ['whatsapp', 'instagram', 'linkedin', 'website'].forEach(key => {
        const el = document.getElementById(`preview-${key}`);
        if (el) el.querySelector('span').textContent = value(key) || `Add ${key}`;
      });
      const image = document.getElementById('preview-photo'); const fallback = document.getElementById('preview-avatar-fallback');
      if (image && value('photo')) { image.src = value('photo'); image.style.display = 'flex'; fallback.style.display = 'none'; image.onerror = () => { image.style.display = 'none'; fallback.style.display = 'flex'; }; } else if (image) { image.style.display = 'none'; fallback.style.display = 'flex'; }
    };
    inputs.forEach(input => input.addEventListener('input', update));
    update();
  }

  initLeadCapture() {
    const form = document.getElementById('lead-form');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const lead = Object.fromEntries(new FormData(form).entries());
      const leads = JSON.parse(localStorage.getItem('myluxcards_demo_leads') || '[]');
      leads.push({ ...lead, receivedAt: new Date().toISOString() });
      localStorage.setItem('myluxcards_demo_leads', JSON.stringify(leads));
      form.reset();
      document.getElementById('lead-status').textContent = 'Thanks — your details were securely shared with the card owner.';
      this.showToast('Lead captured successfully.', 'success');
    });
  }

  openSupportModal() {
    const modal = document.getElementById('support-modal');
    if (modal) modal.classList.add('open');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
  }

  // --- Theme Management ---
  initTheme() {
    const savedTheme = localStorage.getItem('myluxcards_theme') || 'light';
    const body = document.body;
    const themeIcon = document.querySelector('#theme-toggle i');
    
    if (savedTheme === 'dark') {
      body.classList.add('dark-mode');
      if (themeIcon) themeIcon.className = 'lucide-sun';
    } else {
      body.classList.remove('dark-mode');
      if (themeIcon) themeIcon.className = 'lucide-moon';
    }
  }

  toggleTheme() {
    const body = document.body;
    const themeIcon = document.querySelector('#theme-toggle i');
    
    if (body.classList.contains('dark-mode')) {
      body.classList.remove('dark-mode');
      localStorage.setItem('myluxcards_theme', 'light');
      if (themeIcon) themeIcon.className = 'lucide-moon';
      this.showToast('Switched to Light Mode', 'info');
    } else {
      body.classList.add('dark-mode');
      localStorage.setItem('myluxcards_theme', 'dark');
      if (themeIcon) themeIcon.className = 'lucide-sun';
      this.showToast('Switched to Dark Mode', 'info');
    }
    // Re-create icons via Lucide to match theme switches if applicable
    if (window.lucide) window.lucide.createIcons();
  }

  // --- Toast Alerts ---
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 'info';
    toast.innerHTML = `
      <i data-lucide="${icon}"></i>
      <span>${message}</span>
    `;
    
    container.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      toast.style.transition = 'all 0.4s ease';
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

  // --- State counters update ---
  updateCounters() {
    const wishlistBadges = document.querySelectorAll('.wishlist-count-badge');
    const cartBadges = document.querySelectorAll('.cart-count-badge');
    
    wishlistBadges.forEach(b => b.textContent = this.state.wishlist.length);
    const cartItemCount = this.state.cart.reduce((total, item) => total + (Number(item.quantity) || 1), 0);
    cartBadges.forEach(b => b.textContent = cartItemCount);
    
    localStorage.setItem('myluxcards_wishlist', JSON.stringify(this.state.wishlist));
    localStorage.setItem('myluxcards_cart', JSON.stringify(this.state.cart));
  }

  // --- Wishlist Actions ---
  toggleWishlist(cardId) {
    const index = this.state.wishlist.indexOf(cardId);
    if (index === -1) {
      this.state.wishlist.push(cardId);
      this.showToast('Added to Wishlist!', 'success');
    } else {
      this.state.wishlist.splice(index, 1);
      this.showToast('Removed from Wishlist', 'info');
    }
    this.updateCounters();
    this.renderCatalog();
    this.renderWishlistDrawer();
  }

  // --- Cart Actions ---
  addToCart(cardId) {
    const card = window.LuxData.CARDS.find(c => c.id === cardId);
    if (!card) return;
    
    // Check if already in cart
    const exists = this.state.cart.some(item => item.id === cardId);
    if (exists) {
      exists.quantity = (Number(exists.quantity) || 1) + 1;
      this.showToast('Item quantity updated in your cart.', 'success');
    } else {
      this.state.cart.push({ ...card, quantity: 1 });
      this.showToast('Added to Shopping Cart!', 'success');
    }
    this.updateCounters();
    this.renderCartDrawer();
  }

  addFeaturedProduct(button) {
    const unavailableProducts = new Set(['nfc-keytag', 'qr-tag', 'lost-found-tag']);
    if (unavailableProducts.has(button.dataset.productId)) {
      this.showToast('This product is currently out of stock.', 'info');
      return;
    }
    const product = {
      id: button.dataset.productId,
      title: button.dataset.productName,
      price: Number(button.dataset.productPrice),
      image: button.dataset.productImage,
      currency: 'INR'
    };
    const exists = this.state.cart.some(item => String(item.id) === product.id);
    if (!exists) {
      this.state.cart.push({ ...product, quantity: 1 });
      this.updateCounters();
      this.showToast(`${product.title} added to your cart.`, 'success');
    } else {
      exists.quantity = (Number(exists.quantity) || 1) + 1;
      this.updateCounters();
      this.showToast(`${product.title} quantity updated in your cart.`, 'success');
    }
    this.renderCartDrawer();
    this.openCartDrawer();
  }

  formatPrice(item) {
    const price = Number(item.price) || 0;
    return item.currency === 'INR'
      ? `\u20B9${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(price)}`
      : `$${price.toFixed(2)}`;
  }

  escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  formatCartTotal() {
    const totals = this.state.cart.reduce((result, item) => {
      const currency = item.currency || 'USD';
      result[currency] = (result[currency] || 0) + ((Number(item.price) || 0) * (Number(item.quantity) || 1));
      return result;
    }, {});
    return Object.entries(totals).map(([currency, amount]) => this.formatPrice({ currency, price: amount })).join(' + ');
  }

  openCartDrawer() {
    const overlay = document.getElementById('drawer-overlay');
    const drawer = document.getElementById('cart-drawer');
    if (!overlay || !drawer) return;
    overlay.classList.add('open');
    drawer.classList.add('open');
  }

  openCheckout() {
    const unavailableProducts = new Set(['nfc-keytag', 'qr-tag', 'lost-found-tag']);
    const availableCart = this.state.cart.filter(item => !unavailableProducts.has(String(item.id)));
    if (availableCart.length !== this.state.cart.length) {
      this.state.cart = availableCart;
      this.updateCounters();
      this.renderCartDrawer();
      this.showToast('Out-of-stock products were removed from your cart.', 'info');
    }
    if (!this.state.cart.length) {
      this.showToast('Add a product to your cart before continuing to payment.', 'info');
      return;
    }
    const checkout = document.getElementById('checkout-modal');
    const summary = document.getElementById('checkout-summary');
    if (!checkout) return;
    const itemCount = this.state.cart.reduce((total, item) => total + (Number(item.quantity) || 1), 0);
    if (summary) summary.textContent = `${itemCount} item${itemCount === 1 ? '' : 's'} · ${this.formatCartTotal()}`;
    checkout.classList.add('open');
    checkout.setAttribute('aria-hidden', 'false');
  }

  closeCheckout() {
    const checkout = document.getElementById('checkout-modal');
    checkout?.classList.remove('open');
    checkout?.setAttribute('aria-hidden', 'true');
  }

  setPaymentMethod(method) {
    document.querySelectorAll('.payment-option').forEach(option => {
      option.classList.toggle('active', option.querySelector('input')?.value === method);
    });
    const button = document.getElementById('pay-now-btn');
    if (button) button.textContent = method === 'Cash on Delivery' ? 'Place cash on delivery order' : `Continue with ${method}`;
  }

  completeCheckout() {
    const method = document.querySelector('input[name="payment-method"]:checked')?.value || 'selected payment method';
    this.state.cart = [];
    this.updateCounters();
    this.renderCartDrawer();
    this.closeCheckout();
    document.getElementById('drawer-overlay')?.classList.remove('open');
    document.getElementById('cart-drawer')?.classList.remove('open');
    this.showToast(`Demo order placed with ${method}.`, 'success');
  }

  removeFromCart(cardId) {
    this.state.cart = this.state.cart.filter(item => String(item.id) !== String(cardId));
    this.showToast('Removed from Cart', 'info');
    this.updateCounters();
    this.renderCartDrawer();
  }

  changeCartQuantity(cardId, amount) {
    const item = this.state.cart.find(product => String(product.id) === String(cardId));
    if (!item) return;
    item.quantity = Math.max(0, (Number(item.quantity) || 1) + amount);
    if (item.quantity === 0) {
      this.removeFromCart(cardId);
      return;
    }
    this.updateCounters();
    this.renderCartDrawer();
  }

  // --- Rendering UI Panels ---
  renderCategoryChips() {
    const sidebarChips = document.querySelector('.category-chips');
    if (!sidebarChips) return;
    
    let html = `
      <div class="chip ${this.state.activeCategory === 'all' ? 'active' : ''}" data-category="all">
        <span>All Occasions</span>
        <span class="chip-count">${window.LuxData.CARDS.length}</span>
      </div>
    `;
    
    window.LuxData.CATEGORIES.forEach(cat => {
      const matchCount = window.LuxData.CARDS.filter(c => c.category === cat.id).length;
      html += `
        <div class="chip ${this.state.activeCategory === cat.id ? 'active' : ''}" data-category="${cat.id}">
          <span>${cat.name}</span>
          <span class="chip-count">${matchCount}</span>
        </div>
      `;
    });
    
    sidebarChips.innerHTML = html;
    
    // Attach click events
    sidebarChips.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.state.activeCategory = chip.dataset.category;
        this.state.currentPage = 1;
        this.renderCategoryChips();
        this.renderCatalog();
      });
    });
  }

  renderCatalog() {
    const grid = document.querySelector('.cards-grid');
    if (!grid) return;
    
    // Filter and Sort data
    let filtered = window.LuxData.CARDS.filter(card => {
      const matchCategory = this.state.activeCategory === 'all' || card.category === this.state.activeCategory;
      const matchSearch = card.title.toLowerCase().includes(this.state.searchQuery.toLowerCase());
      const matchPrice = card.price <= this.state.priceLimit;
      const matchPremium = this.state.filterPremium || !card.isPremium;
      const matchFree = this.state.filterFree || card.isPremium;
      return matchCategory && matchSearch && matchPrice && matchPremium && matchFree;
    });

    if (this.state.sortBy === 'popular') {
      filtered.sort((a, b) => b.downloads - a.downloads);
    } else if (this.state.sortBy === 'rating') {
      filtered.sort((a, b) => b.rating - a.rating);
    } else if (this.state.sortBy === 'price-low') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (this.state.sortBy === 'price-high') {
      filtered.sort((a, b) => b.price - a.price);
    }

    // Pagination slice
    const totalPages = Math.ceil(filtered.length / this.state.cardsPerPage) || 1;
    const startIdx = (this.state.currentPage - 1) * this.state.cardsPerPage;
    const paginated = filtered.slice(startIdx, startIdx + this.state.cardsPerPage);
    
    if (paginated.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
          <i data-lucide="info" style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;"></i>
          <h3>No templates match your filters.</h3>
          <p style="margin-top: 8px;">Try clearing search text or adjusting the price slider.</p>
        </div>
      `;
      this.renderPagination(1);
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    grid.innerHTML = paginated.map(card => {
      const isLiked = this.state.wishlist.includes(card.id);
      return `
        <div class="card-item glass reveal">
          <div class="card-image-wrapper">
            <span class="card-badge badge ${card.isPremium ? 'badge-premium' : 'badge-free'}">
              ${card.isPremium ? 'Premium' : 'Free'}
            </span>
            <div class="card-action-overlay">
              <button class="card-btn-action ${isLiked ? 'active' : ''}" onclick="window.app.toggleWishlist(${card.id})" title="Wishlist">
                <i data-lucide="heart" ${isLiked ? 'fill="currentColor"' : ''}></i>
              </button>
              <button class="card-btn-action" onclick="window.app.addToCart(${card.id})" title="Add to Cart">
                <i data-lucide="shopping-cart"></i>
              </button>
            </div>
            <img src="${card.image}" alt="${card.title}" loading="lazy">
          </div>
          <div class="card-info">
            <div class="card-meta">
              <div class="card-rating">
                <i data-lucide="star" fill="currentColor"></i>
                <span>${card.rating.toFixed(1)}</span>
              </div>
              <div>${card.downloads.toLocaleString()} downloads</div>
            </div>
            <div class="card-title-price">
              <h3 class="card-title">${card.title}</h3>
              <span class="card-price">${card.price === 0 ? 'Free' : '$' + card.price.toFixed(2)}</span>
            </div>
            <div class="card-footer-btns">
              <button class="btn btn-glass" onclick="window.app.openPreviewModal(${card.id})">Preview</button>
              <button class="btn btn-primary" onclick="window.app.addToCart(${card.id})">Add to Cart</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.renderPagination(totalPages);
    if (window.lucide) window.lucide.createIcons();
  }

  renderPagination(totalPages) {
    const pagContainer = document.querySelector('.pagination');
    if (!pagContainer) return;
    
    let html = '';
    for (let i = 1; i <= totalPages; i++) {
      html += `
        <div class="page-btn glass ${i === this.state.currentPage ? 'active' : ''}" onclick="window.app.setPage(${i})">
          ${i}
        </div>
      `;
    }
    pagContainer.innerHTML = html;
  }

  getAllReviews() {
    return [
      ...(window.LuxData.TESTIMONIALS || []),
      ...this.state.submittedReviews
    ];
  }

  getReviewStats() {
    const reviews = this.getAllReviews();
    const total = reviews.length;
    const sum = reviews.reduce((acc, cur) => acc + (cur.rating || 0), 0);
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    reviews.forEach(review => {
      const rating = Math.max(1, Math.min(5, Math.round(review.rating || 0)));
      counts[rating] += 1;
    });

    const average = total ? sum / total : 0;
    const percent = {
      5: total ? (counts[5] / total) * 100 : 0,
      4: total ? (counts[4] / total) * 100 : 0,
      3: total ? (counts[3] / total) * 100 : 0,
      2: total ? (counts[2] / total) * 100 : 0,
      1: total ? (counts[1] / total) * 100 : 0
    };

    return { total, average, counts, percent };
  }

  renderReviewSummary() {
    const summary = this.getReviewStats();
    const avgScore = document.getElementById('review-average-score');
    const avgStars = document.getElementById('review-average-stars');
    const totalCount = document.getElementById('review-total-count');

    if (avgScore) avgScore.textContent = summary.average.toFixed(1);
    if (totalCount) totalCount.textContent = summary.total;

    if (avgStars) {
      avgStars.innerHTML = Array.from({ length: 5 }, (_, idx) => {
        const filled = idx < Math.round(summary.average);
        return `<i data-lucide="star" ${filled ? 'fill="currentColor"' : ''}></i>`;
      }).join('');
    }

    [5, 4, 3, 2, 1].forEach(value => {
      const countEl = document.getElementById(`count-${value}`);
      const barEl = document.getElementById(`bar-${value}`);
      if (countEl) countEl.textContent = summary.counts[value] || 0;
      if (barEl) barEl.style.width = `${summary.percent[value]}%`;
    });

    if (window.lucide) window.lucide.createIcons();
  }

  renderTestimonials() {
    const track = document.getElementById('testimonials-track');
    const dotsContainer = document.getElementById('testimonials-dots');
    if (!track || !dotsContainer) return;

    const reviews = this.getAllReviews();

    track.innerHTML = reviews.map((testimonial) => `
      <div class="testimonial-slide">
        <div class="testimonial-card">
          <div class="testimonial-rating">
            <div class="review-stars">
              ${Array.from({ length: 5 }, (_, idx) => {
                const filled = idx < Math.round(testimonial.rating || 0);
                return `<i data-lucide="star" ${filled ? 'fill="currentColor"' : ''}></i>`;
              }).join('')}
            </div>
            <span>${testimonial.rating.toFixed(1)}</span>
          </div>
          <blockquote class="testimonial-text">${testimonial.text}</blockquote>
          <div class="testimonial-user">
            <img src="${testimonial.avatar}" alt="${testimonial.name}" class="testimonial-avatar">
            <div class="testimonial-info">
              <h4>${testimonial.name}</h4>
              <p>${testimonial.role}</p>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    dotsContainer.innerHTML = reviews.map((_, idx) => `
      <div class="dot-indicator ${idx === this.state.currentTestimonialIndex ? 'active' : ''}" data-index="${idx}"></div>
    `).join('');

    this.renderReviewSummary();
    this.updateTestimonialPosition();

    if (window.lucide) window.lucide.createIcons();
  }

  updateTestimonialPosition() {
    const track = document.getElementById('testimonials-track');
    const dots = document.querySelectorAll('.dot-indicator');
    if (!track) return;

    track.style.transform = `translateX(-${this.state.currentTestimonialIndex * 100}%)`;
    dots.forEach((dot, index) => dot.classList.toggle('active', index === this.state.currentTestimonialIndex));
  }

  handleSupportTicket() {
    const name = document.getElementById('support-name')?.value.trim();
    const email = document.getElementById('support-email')?.value.trim();
    const topic = document.getElementById('support-topic')?.value;
    const message = document.getElementById('support-message')?.value.trim();

    if (!name || !email || !topic || !message) {
      this.showToast('Please complete all support fields before submitting.', 'info');
      return;
    }

    const newTicket = {
      id: `TKT-${Date.now()}`,
      name,
      email,
      topic,
      message,
      createdAt: new Date().toISOString(),
      status: 'Open'
    };

    this.state.supportTickets.unshift(newTicket);
    localStorage.setItem('myluxcards_support_tickets', JSON.stringify(this.state.supportTickets));
    this.renderSupportTickets();
    this.showToast('Support ticket submitted successfully.', 'success');

    document.getElementById('support-form')?.reset();
  }

  handleReviewSubmission() {
    const name = document.getElementById('reviewer-name')?.value.trim();
    const role = document.getElementById('reviewer-role')?.value.trim();
    const rating = parseInt(document.getElementById('reviewer-rating')?.value, 10);
    const text = document.getElementById('reviewer-text')?.value.trim();

    if (!name || !role || !rating || !text) {
      this.showToast('Please complete all review fields before submitting.', 'info');
      return;
    }

    const newReview = {
      id: `user-${Date.now()}`,
      name,
      role,
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
      rating,
      text
    };

    this.state.submittedReviews.unshift(newReview);
    localStorage.setItem('myluxcards_reviews', JSON.stringify(this.state.submittedReviews));
    this.renderTestimonials();
    this.showToast('Thank you! Your review has been added.', 'success');
    document.getElementById('review-form')?.reset();
  }

  renderSupportTickets() {
    const list = document.getElementById('support-ticket-list');
    if (!list) return;

    const tickets = this.state.supportTickets;
    const ticketItems = tickets.length ? tickets.map(ticket => `
      <div class="ticket-card">
        <strong>${ticket.topic} • ${ticket.status}</strong>
        <span><strong>Name:</strong> ${ticket.name}</span>
        <span><strong>Email:</strong> ${ticket.email}</span>
        <span><strong>Submitted:</strong> ${new Date(ticket.createdAt).toLocaleString()}</span>
        <span>${ticket.message}</span>
      </div>
    `).join('') : '<div class="ticket-empty">No support tickets yet. Submit one using the form to see your request appear here.</div>';

    list.innerHTML = `
      <h4>Recent requests</h4>
      ${ticketItems}
    `;
  }

  initTestimonialAutoPlay() {
    if (!window.LuxData.TESTIMONIALS || window.LuxData.TESTIMONIALS.length < 2) return;
    setInterval(() => {
      this.moveTestimonial(1);
    }, 9000);
  }

  setPage(num) {
    this.state.currentPage = num;
    this.renderCatalog();
    // catalog-cards section removed — scroll to top of catalog area instead
    const el = document.querySelector('.catalog-content') || document.getElementById('featured-categories-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }

  // --- Drawers Panels Rendering ---
  renderWishlistDrawer() {
    const listContainer = document.getElementById('wishlist-items');
    if (!listContainer) return;
    
    if (this.state.wishlist.length === 0) {
      listContainer.innerHTML = `
        <div class="drawer-empty">
          <i data-lucide="heart"></i>
          <h4>Your wishlist is empty</h4>
          <p>Click the heart icon on designs to save them here.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    listContainer.innerHTML = this.state.wishlist.map(id => {
      const card = window.LuxData.CARDS.find(c => c.id === id);
      if (!card) return '';
      return `
        <div class="drawer-item glass">
          <div class="drawer-item-img">
            <img src="${card.image}" alt="">
          </div>
          <div class="drawer-item-info">
            <h4>${card.title}</h4>
            <p>${card.price === 0 ? 'Free' : '$' + card.price.toFixed(2)}</p>
          </div>
          <i data-lucide="trash-2" class="drawer-item-remove" onclick="window.app.toggleWishlist(${card.id})"></i>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  renderCartDrawer() {
    const listContainer = document.getElementById('cart-items');
    const totalElem = document.getElementById('cart-total-price');
    if (!listContainer) return;
    
    if (this.state.cart.length === 0) {
      listContainer.innerHTML = `
        <div class="drawer-empty">
          <i data-lucide="shopping-cart"></i>
          <h4>Your cart is empty</h4>
          <p>Find premium designs and unlock them to download.</p>
        </div>
      `;
      if (totalElem) totalElem.textContent = '\u20B90';
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    listContainer.innerHTML = this.state.cart.map(card => {
      const safeTitle = this.escapeHtml(card.title);
      const safeDetails = card.details ? this.escapeHtml(card.details) : '';
      return `
        <div class="drawer-item glass">
          <div class="drawer-item-img">
            <img src="${card.image}" alt="${safeTitle}">
          </div>
          <div class="drawer-item-info">
            <h4>${safeTitle}</h4>
            ${safeDetails ? `<small>${safeDetails}</small>` : ''}
            <p>${this.formatPrice({ ...card, price: (Number(card.price) || 0) * (Number(card.quantity) || 1) })}</p>
          </div>
          <div class="drawer-item-actions">
            <div class="quantity-control" aria-label="Quantity for ${safeTitle}">
              <button type="button" data-quantity-change="-1" data-cart-id="${card.id}" aria-label="Decrease quantity">−</button>
              <span>${Number(card.quantity) || 1}</span>
              <button type="button" data-quantity-change="1" data-cart-id="${card.id}" aria-label="Increase quantity">+</button>
            </div>
            <button class="drawer-item-remove" type="button" data-cart-id="${card.id}" aria-label="Remove ${safeTitle}"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
      `;
    }).join('');

    if (totalElem) totalElem.textContent = this.formatCartTotal();
    listContainer.querySelectorAll('[data-cart-id]').forEach(button => {
      if (button.dataset.quantityChange) {
        button.addEventListener('click', () => this.changeCartQuantity(button.dataset.cartId, Number(button.dataset.quantityChange)));
      } else {
        button.addEventListener('click', () => this.removeFromCart(button.dataset.cartId));
      }
    });
    if (window.lucide) window.lucide.createIcons();
  }

  // --- Search Autocomplete Handler ---
  handleSearchInput(val) {
    this.state.searchQuery = val;
    const suggestions = document.getElementById('search-suggestions');
    if (!suggestions) return;
    
    if (!val.trim()) {
      suggestions.style.display = 'none';
      return;
    }
    
    const products = [
      { id: 'nfc-card', title: 'Premium NFC Cards', keywords: 'business card nfc profile professional' },
      { id: 'nfc-keytag', title: 'Smart NFC Keytags', keywords: 'keytag nfc menu review contact' },
      { id: 'qr-tag', title: 'Custom QR Tags', keywords: 'qr tag scan profile link' },
      { id: 'lost-found-tag', title: 'Lost & Found QR Tags', keywords: 'lost find luggage pet recovery tag' }
    ];
    const query = val.toLowerCase();
    const matches = products.filter(product =>
      `${product.title} ${product.keywords}`.toLowerCase().includes(query)
    ).slice(0, 5);
    
    if (matches.length === 0) {
      suggestions.innerHTML = `
        <div class="suggestion-item" style="cursor: default; color: var(--text-muted)">No NFC products found</div>
      `;
      suggestions.style.display = 'block';
      return;
    }
    
    suggestions.innerHTML = matches.map(product => `
      <button class="suggestion-item" type="button" data-featured-product="${product.id}">
        <i data-lucide="search" style="width: 14px; height: 14px;"></i>
        <span>${product.title}</span>
      </button>
    `).join('');
    suggestions.querySelectorAll('[data-featured-product]').forEach(item => {
      item.addEventListener('click', () => this.selectFeaturedProduct(item.dataset.featuredProduct));
    });
    
    suggestions.style.display = 'block';
    if (window.lucide) window.lucide.createIcons();
  }

  selectFeaturedProduct(productId) {
    const button = document.querySelector(`[data-product-id="${productId}"]`);
    const title = button?.dataset.productName || 'NFC product';
    document.getElementById('search-input').value = title;
    document.getElementById('search-suggestions').style.display = 'none';
    button?.closest('.luxcard-item')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    button?.focus({ preventScroll: true });
  }

  // --- Modal Openers ---
  openPreviewModal(cardId) {
    const card = window.LuxData.CARDS.find(c => c.id === cardId);
    if (!card) return;
    
    const modal = document.getElementById('preview-modal');
    const modalBody = document.getElementById('preview-modal-body');
    if (!modal || !modalBody) return;
    
    modalBody.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px; align-items: center;">
        <div style="width: 100%; max-width: 320px; aspect-ratio: 3/4; border-radius: 16px; overflow: hidden; box-shadow: var(--card-shadow-hover);">
          <img src="${card.image}" style="width:100%; height:100%; object-fit:cover;">
        </div>
        <div style="text-align: center;">
          <h3 style="font-size:1.6rem; margin-bottom: 8px;">${card.title}</h3>
          <p style="color:var(--text-muted); font-size: 0.95rem; margin-bottom: 16px;">
            Category: ${card.category.toUpperCase()} &bull; Rated ${card.rating.toFixed(1)} ⭐
          </p>
          <div style="display: flex; gap: 12px; justify-content: center;">
            <button class="btn btn-primary" onclick="window.app.addToCart(${card.id}); window.app.closeModal('preview-modal');">Add to Cart ($${card.price.toFixed(2)})</button>
            <button class="btn btn-glass" onclick="window.app.closeModal('preview-modal');">Close</button>
          </div>
        </div>
      </div>
    `;
    
    modal.classList.add('open');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
  }

  // --- Testimonial slider controllers ---
  moveTestimonial(direction) {
    const track = document.getElementById('testimonials-track');
    const dots = document.querySelectorAll('.dot-indicator');
    if (!track) return;
    
    const maxIdx = window.LuxData.TESTIMONIALS.length - 1;
    let nextIdx = this.state.currentTestimonialIndex + direction;
    
    if (nextIdx < 0) nextIdx = maxIdx;
    if (nextIdx > maxIdx) nextIdx = 0;
    
    this.state.currentTestimonialIndex = nextIdx;
    track.style.transform = `translateX(-${nextIdx * 100}%)`;
    
    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === nextIdx);
    });
  }

  jumpTestimonial(idx) {
    const track = document.getElementById('testimonials-track');
    const dots = document.querySelectorAll('.dot-indicator');
    if (!track) return;
    
    this.state.currentTestimonialIndex = idx;
    track.style.transform = `translateX(-${idx * 100}%)`;
    
    dots.forEach((dot, index) => {
      dot.classList.toggle('active', index === idx);
    });
  }

  // --- Event Bindings ---
  bindEvents() {
    // 1. Theme toggle
    document.getElementById('theme-toggle')?.addEventListener('click', () => this.toggleTheme());
    
    // 2. Drawers triggering
    const overlay = document.getElementById('drawer-overlay');
    const cartDrawer = document.getElementById('cart-drawer');
    const wishlistDrawer = document.getElementById('wishlist-drawer');
    const supportTrigger = document.getElementById('support-trigger');

    supportTrigger?.addEventListener('click', () => this.openSupportModal());
    
    const openDrawer = (drawer) => {
      overlay.classList.add('open');
      drawer.classList.add('open');
      if (drawer === cartDrawer) this.renderCartDrawer();
      if (drawer === wishlistDrawer) this.renderWishlistDrawer();
    };
    
    const closeDrawers = () => {
      overlay.classList.remove('open');
      cartDrawer.classList.remove('open');
      wishlistDrawer.classList.remove('open');
    };
    
    document.getElementById('cart-trigger')?.addEventListener('click', () => openDrawer(cartDrawer));
    document.getElementById('wishlist-trigger')?.addEventListener('click', () => openDrawer(wishlistDrawer));
    document.querySelectorAll('.buy-featured-product').forEach(button => {
      if (['nfc-keytag', 'qr-tag', 'lost-found-tag'].includes(button.dataset.productId)) {
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
        button.textContent = 'Out of Stock';
      }
      button.addEventListener('click', () => this.addFeaturedProduct(button));
    });
    
    document.querySelectorAll('.drawer-close').forEach(b => b.addEventListener('click', closeDrawers));
    overlay?.addEventListener('click', closeDrawers);

    // 3. Checkout payment choices
    document.getElementById('checkout-trigger')?.addEventListener('click', () => this.openCheckout());
    document.querySelector('[data-close-checkout]')?.addEventListener('click', () => this.closeCheckout());
    document.getElementById('checkout-modal')?.addEventListener('click', (event) => {
      if (event.target.id === 'checkout-modal') this.closeCheckout();
    });
    document.querySelectorAll('input[name="payment-method"]').forEach(input => {
      input.addEventListener('change', () => this.setPaymentMethod(input.value));
    });
    document.getElementById('checkout-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      this.completeCheckout();
    });
    this.setPaymentMethod(document.querySelector('input[name="payment-method"]:checked')?.value || 'UPI');

    // 4. Hamburger Mobile Menu Toggle
    const mobileMenu = document.getElementById('nav-menu');
    document.getElementById('hamburger')?.addEventListener('click', () => {
      if (mobileMenu) {
        if (mobileMenu.style.display === 'flex') {
          mobileMenu.style.display = 'none';
        } else {
          mobileMenu.style.display = 'flex';
          mobileMenu.style.flexDirection = 'column';
          mobileMenu.style.position = 'absolute';
          mobileMenu.style.top = '80px';
          mobileMenu.style.left = '0';
          mobileMenu.style.width = '100%';
          mobileMenu.style.background = 'var(--bg-glass-solid)';
          mobileMenu.style.padding = '20px';
          mobileMenu.style.borderBottom = '1px solid var(--border-glass)';
        }
      }
    });

    // 4. Search actions
    const searchInput = document.getElementById('search-input');
    searchInput?.addEventListener('input', (e) => this.handleSearchInput(e.target.value));
    
    // Dismiss suggestions list on clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) {
        const suggestions = document.getElementById('search-suggestions');
        if (suggestions) suggestions.style.display = 'none';
      }
    });

    // 5. Catalog Filters
    document.getElementById('price-limit-slider')?.addEventListener('input', (e) => {
      this.state.priceLimit = parseFloat(e.target.value);
      document.getElementById('price-limit-val').textContent = this.state.priceLimit.toFixed(2);
      this.state.currentPage = 1;
      this.renderCatalog();
    });

    document.getElementById('filter-premium')?.addEventListener('change', (e) => {
      this.state.filterPremium = e.target.checked;
      this.state.currentPage = 1;
      this.renderCatalog();
    });

    document.getElementById('filter-free')?.addEventListener('change', (e) => {
      this.state.filterFree = e.target.checked;
      this.state.currentPage = 1;
      this.renderCatalog();
    });

    document.getElementById('sort-select')?.addEventListener('change', (e) => {
      this.state.sortBy = e.target.value;
      this.state.currentPage = 1;
      this.renderCatalog();
    });

    // Mobile Sidebar filter trigger
    document.getElementById('filter-sidebar-trigger')?.addEventListener('click', () => {
      document.querySelector('.filter-sidebar')?.classList.toggle('open');
    });

    // 7. Back-to-Top triggers
    const backToTopBtn = document.getElementById('back-to-top');
    window.addEventListener('scroll', () => {
      if (window.scrollY > 500) {
        backToTopBtn?.classList.add('visible');
      } else {
        backToTopBtn?.classList.remove('visible');
      }
    });

    backToTopBtn?.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 8. Testimonials carousel sliders trigger
    document.querySelector('.testimonial-nav-prev')?.addEventListener('click', () => this.moveTestimonial(-1));
    document.querySelector('.testimonial-nav-next')?.addEventListener('click', () => this.moveTestimonial(1));

    document.querySelectorAll('.testimonials-dots .dot-indicator').forEach((dot, idx) => {
      dot.addEventListener('click', () => this.jumpTestimonial(idx));
    });

    // 9. FAQ accordion sliders
    document.querySelectorAll('.faq-trigger').forEach(trigger => {
      trigger.addEventListener('click', () => {
        const item = trigger.closest('.faq-item');
        const isActive = item.classList.contains('active');
        
        // Collapse all others
        document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
        
        if (!isActive) {
          item.classList.add('active');
        }
      });
    });

    // 10. Modals Closures
    document.querySelectorAll('.modal-close').forEach(b => {
      b.addEventListener('click', (e) => {
        const overlay = e.target.closest('.modal-overlay');
        if (overlay) overlay.classList.remove('open');
      });
    });

    // Trigger login modal
    document.getElementById('login-trigger')?.addEventListener('click', () => {
      const currentUser = JSON.parse(localStorage.getItem('myluxcards_current_user') || 'null');
      if (currentUser) return;
      document.getElementById('login-modal')?.classList.add('open');
    });

    document.getElementById('dashboard-nav-link')?.addEventListener('click', async (event) => {
      event.preventDefault();
      let session = await fetch('/api/auth/me', { cache: 'no-store' });
      if (session.status === 401) {
        const refreshed = await fetch('/api/auth/refresh', { method: 'POST' });
        if (refreshed.ok) session = await fetch('/api/auth/me', { cache: 'no-store' });
      }
      if (session.ok) {
        window.location.href = '/dashboard';
        return;
      }
      sessionStorage.setItem('myluxcards_auth_next', '/dashboard');
      document.getElementById('login-modal')?.classList.add('open');
    });

    const switchAuthModal = (fromId, toId) => {
      this.closeModal(fromId);
      const modal = document.getElementById(toId);
      modal?.classList.add('open');
      modal?.setAttribute('aria-hidden', 'false');
    };

    document.getElementById('signup-trigger')?.addEventListener('click', (e) => {
      e.preventDefault();
      switchAuthModal('login-modal', 'signup-modal');
    });

    document.getElementById('back-to-login')?.addEventListener('click', (e) => {
      e.preventDefault();
      switchAuthModal('signup-modal', 'login-modal');
    });

    document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('signup-name')?.value.trim();
      const email = document.getElementById('signup-email')?.value.trim().toLowerCase();
      const password = document.getElementById('signup-password')?.value || '';
      const confirmation = document.getElementById('signup-confirm-password')?.value || '';
      const error = document.getElementById('signup-error');
      if (error) error.textContent = '';

      if (password !== confirmation) {
        if (error) error.textContent = 'Passwords do not match.';
        document.getElementById('signup-confirm-password')?.focus();
        return;
      }

      const accounts = JSON.parse(localStorage.getItem('myluxcards_accounts') || '[]');
      if (accounts.some((account) => account.email === email)) {
        if (error) error.textContent = 'An account with this email already exists.';
        return;
      }

      const passwordHash = await this.hashPassword(password);
      accounts.push({ name, email, passwordHash, createdAt: new Date().toISOString() });
      localStorage.setItem('myluxcards_accounts', JSON.stringify(accounts));
      localStorage.setItem('myluxcards_current_user', JSON.stringify({ name, email }));
      this.updateAccountButton({ name, email });
      e.currentTarget.reset();
      this.closeModal('signup-modal');
      this.showToast(`Welcome to MyLuxCards, ${name}!`, 'success');
    });

    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email')?.value.trim().toLowerCase();
      const password = document.getElementById('login-password')?.value || '';
      const error = document.getElementById('login-error');
      if (error) error.textContent = '';
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (error) error.textContent = data.message || 'Email or password is incorrect.';
        return;
      }
      const user = {
        name: data.user?.user_metadata?.name || data.user?.email?.split('@')[0] || email.split('@')[0],
        email: data.user?.email || email,
      };
      localStorage.setItem('myluxcards_current_user', JSON.stringify(user));
      this.updateAccountButton(user);
      e.currentTarget.reset();
      this.closeModal('login-modal');
      this.showToast(`Welcome back, ${user.name}!`, 'success');
      const next = sessionStorage.getItem('myluxcards_auth_next');
      if (next) {
        sessionStorage.removeItem('myluxcards_auth_next');
        window.location.href = next;
      }
    });

    const currentUser = JSON.parse(localStorage.getItem('myluxcards_current_user') || 'null');
    if (currentUser) this.updateAccountButton(currentUser);
    if (new URLSearchParams(window.location.search).get('login') === '1') {
      if (new URLSearchParams(window.location.search).get('next') === '/dashboard') sessionStorage.setItem('myluxcards_auth_next', '/dashboard');
      document.getElementById('login-modal')?.classList.add('open');
    }

    // Support form submission
    document.getElementById('support-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSupportTicket();
    });

    // Support Panel Topics selection
    const supportPanelItems = document.querySelectorAll('.support-panel-item');
    const supportTopicSelect = document.getElementById('support-topic');
    
    supportPanelItems.forEach(item => {
      item.addEventListener('click', () => {
        // Remove active class from all items
        supportPanelItems.forEach(i => i.classList.remove('active'));
        // Add active class to clicked item
        item.classList.add('active');
        
        // Update select value based on data-topic
        if (supportTopicSelect) {
          supportTopicSelect.value = item.getAttribute('data-topic');
          
          // Optionally, smoothly focus or highlight the form area
          const formName = document.getElementById('support-name');
          if (formName) {
            formName.focus();
          }
        }
      });
    });

    if (supportTopicSelect) {
      supportTopicSelect.addEventListener('change', (e) => {
        const selectedTopic = e.target.value;
        supportPanelItems.forEach(i => {
          if (i.getAttribute('data-topic') === selectedTopic) {
            i.classList.add('active');
          } else {
            i.classList.remove('active');
          }
        });
      });
    }

    document.getElementById('review-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleReviewSubmission();
    });

    // 11. Ripple Effect on Buttons
    document.addEventListener('click', (e) => {
      const button = e.target.closest('.btn');
      if (button) {
        const rect = button.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const ripple = document.createElement('span');
        ripple.className = 'ripple-effect';
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        
        // Calculate max dimension to cover entire button
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = `${size}px`;
        ripple.style.height = `${size}px`;
        ripple.style.transform = 'translate(-50%, -50%) scale(0)';
        
        button.appendChild(ripple);
        
        setTimeout(() => {
          ripple.remove();
        }, 600);
      }
    });

    document.getElementById('engage-cta')?.addEventListener('click', () => this.handleEngageAction());
    document.getElementById('engage-close')?.addEventListener('click', () => this.hideEngageBanner());
  }

  // --- Scroll Reveal animations using Intersection Observer ---
  initScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(el => observer.observe(el));
  }

  // --- Particles Background Engine in Hero ---
  initHeroParticles() {
    const container = document.getElementById('particles-container');
    if (!container) return;

    const colors = ['#D4AF37', '#AA7C11', '#FFDF73', '#FFEBA0'];
    const particleCount = 20;

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      const size = Math.random() * 20 + 8;
      const left = Math.random() * 100;
      const delay = Math.random() * 8;
      const duration = Math.random() * 12 + 6;
      const color = colors[Math.floor(Math.random() * colors.length)];

      particle.style.position = 'absolute';
      particle.style.bottom = '-40px';
      particle.style.left = `${left}%`;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.borderRadius = '50%';
      particle.style.background = color;
      particle.style.opacity = '0';
      particle.style.filter = 'blur(4px)';
      particle.style.animation = `floatParticle ${duration}s linear ${delay}s infinite`;
      
      container.appendChild(particle);
    }
  }

  initEngagementBanner() {
    const engageBanner = document.getElementById('engage-banner');
    if (!engageBanner || this.state.engageShown) return;

    const showBanner = () => {
      if (this.state.engageShown) return;
      this.state.engageShown = true;
      localStorage.setItem('myluxcards_engage_shown', 'true');
      engageBanner.classList.add('open');
      this.showToast('Discover exclusive NFC cards before you go!', 'success');
    };

    const handleExitIntent = (event) => {
      if (event.clientY <= 10 && !this.state.engageShown && window.innerWidth > 768) {
        showBanner();
      }
    };

    window.addEventListener('mouseleave', handleExitIntent);
    window.addEventListener('scroll', () => {
      if (!this.state.engageShown && window.scrollY > window.innerHeight * 0.45) {
        showBanner();
      }
    });

    setTimeout(() => showBanner(), 14000);
  }

  handleEngageAction() {
    this.showToast('Let’s keep exploring the premium collection.', 'success');
    document.querySelector('#featured-categories-section')?.scrollIntoView({ behavior: 'smooth' });
    this.hideEngageBanner();
  }

  hideEngageBanner() {
    const engageBanner = document.getElementById('engage-banner');
    if (!engageBanner) return;
    engageBanner.classList.remove('open');
  }
}

// Instantiate App on DOM complete
const initLuxApp = () => {
  if (!window.app) window.app = new LuxApp();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLuxApp, { once: true });
} else {
  initLuxApp();
}
