import type { Metadata } from 'next';
import LegacyPage from '@/components/layout/LegacyPage';
import RecoveryRedirect from './RecoveryRedirect';

export const metadata: Metadata = {
  title: 'Zappit | Your business card. Your digital profile. One tap.',
  description: 'Smart NFC business cards, instant digital profiles, and integrated lead management. Share your contact details with one tap. No app needed.',
};

const redesignedMarkup = `
<div class="landing-page">
  <!-- Custom Dynamic Cursor -->
  <div id="custom-cursor-ring" class="custom-cursor-ring"></div>

  <!-- Branded Lightning Page Loader -->
  <div class="page-loader" id="page-loader" role="status" aria-live="polite">
    <div class="loader-stage">
      <div class="loader-ripple" aria-hidden="true"></div>
      <div class="loader-logo-glow" aria-hidden="true"></div>
      <svg class="loader-lightning-svg" viewBox="0 0 90 85" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path class="lightning-bolt-branch" d="M 50 34 L 62 45" pathLength="100" />
        <path class="lightning-bolt-main" d="M 62 2 L 38 30 L 50 34 L 32 60 L 44 63 L 45 85" pathLength="100" />
      </svg>
      <div class="loader-logo">
        <img src="/brand/zappit-logo-transparent.png" alt="Zappit logo" class="loader-logo-img" width="140" height="48" fetchpriority="high">
      </div>
      <div class="loader-status-label" id="loader-status-label">Loading Zappit…</div>
    </div>
  </div>

  <!-- Floating Glass Navbar -->
  <header class="navbar-wrapper" id="navbar-wrapper">
    <div class="navbar-glow-indicator" id="navbar-scroll-indicator" aria-hidden="true"></div>
    <nav class="navbar" id="main-navbar" aria-label="Main Navigation">
      <div class="navbar-container">
        <!-- Logo on Left -->
        <a href="/" class="logo logo-img-link" aria-label="Zappit Home">
          <img src="/brand/zappit-logo-navbar.png" alt="Zappit" class="brand-logo" width="118" height="55" loading="eager" decoding="async">
        </a>
        
        <!-- Navigation Menu in Center -->
        <ul class="nav-menu" id="nav-menu">
          <li><a href="/" class="nav-link active" id="nav-home-link" aria-current="page">Home</a></li>
          <li><a href="#materials" class="nav-link" id="nav-materials-link">Cards</a></li>
          <li><a href="#profile-experience" class="nav-link" id="nav-profile-link">Digital Profile</a></li>
          <li><a href="#crm-workspace" class="nav-link" id="nav-crm-link">CRM Software</a></li>
          <li><a href="#how-it-works" class="nav-link" id="nav-steps-link">How It Works</a></li>
          <li><a href="#bundles" class="nav-link" id="nav-bundles-link">Bundles</a></li>
          <li><a href="#faq" class="nav-link" id="nav-faq-link">FAQ</a></li>
          <li class="nav-dashboard-link"><a href="/dashboard" class="nav-link">Dashboard</a></li>
        </ul>
        
        <!-- Controls on Right -->
        <div class="nav-actions">
          <!-- Shopping Bag Trigger with Dynamic Badge -->
          <button class="btn-icon" id="cart-trigger" type="button" title="Shopping Cart" aria-label="Open shopping cart" aria-haspopup="dialog" aria-controls="cart-drawer">
            <i data-lucide="shopping-bag" style="width: 17px; height: 17px;"></i>
            <span class="badge-count cart-count-badge">0</span>
          </button>
          
          <!-- Authenticated User Avatar and Name Dropdown Trigger -->
          <div class="account-menu" id="account-menu">
            <button class="account-button" id="login-trigger" type="button" aria-haspopup="menu" aria-controls="account-dropdown" aria-expanded="false">
              <i data-lucide="user" style="width: 15px; height: 15px;"></i>
              <span class="account-label">Login</span>
            </button>
            <div class="account-dropdown" id="account-dropdown" role="menu" hidden>
              <a href="/dashboard" id="account-dashboard" role="menuitem">Dashboard</a>
              <a href="/orders" id="account-orders" role="menuitem">My orders</a>
              <button id="account-logout" type="button" role="menuitem">Log out</button>
            </div>
          </div>

          <!-- Primary Blue CTA -->
          <a class="nav-design-cta" id="nav-design-cta" href="#materials">Choose Your Card</a>
          
          <!-- Hamburger Button for Mobile -->
          <button class="hamburger" id="hamburger" type="button" aria-label="Open navigation menu" aria-controls="nav-menu" aria-expanded="false">
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>
    </nav>
  </header>

  <!-- Hero Section -->
  <section class="apple-hero" id="hero" aria-labelledby="hero-title">
    <div class="hero-container">
      <div class="hero-grid">
        <!-- Left Content Column (~52%) -->
        <div class="hero-content-col">
          <span class="hero-eyebrow">Zappit Smart Tap Solutions</span>
          <h1 class="hero-headline" id="hero-title">
            Your business card.<br>
            Your digital profile.<br>
            <span class="hero-headline-accent">One tap.</span>
          </h1>
          <p class="hero-subtitle">
            Share your contact details, social links, and services instantly. No app needed.
          </p>

          <div class="hero-cta-group">
            <a href="#materials" class="apple-btn apple-btn-primary">Choose Your Card</a>
            <button class="apple-btn apple-btn-glass" id="hero-live-demo-btn" type="button">Try a Live Profile</button>
          </div>
        </div>

        <!-- Right Product Visual Column (~48%) -->
        <div class="hero-visual-col">
          <div class="nfc-card-scene" aria-label="Zappit NFC smart cards demonstration">
            <!-- Rear Card (Tilted slightly back-right, elevated) -->
            <div class="nfc-card nfc-card-back" aria-hidden="true">
              <div class="nfc-card-shine"></div>
              <div class="nfc-card-top-row">
                <div class="nfc-card-identity">
                  <div class="nfc-card-name">Alex Morgan</div>
                  <div class="nfc-card-subtitle">Apex Creative Studio</div>
                </div>
                <div class="nfc-nfc-icon-top">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12" stroke="#00E5FF" stroke-width="2" stroke-linecap="round"/>
                    <path d="M17 12C17 8.68629 14.3137 6 11 6" stroke="#00E5FF" stroke-width="2" stroke-linecap="round"/>
                    <path d="M14 12C14 10.3431 12.6569 9 11 9" stroke="#00E5FF" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="11" cy="12" r="1.5" fill="#00E5FF"/>
                  </svg>
                </div>
              </div>

              <!-- Stylized Matrix / QR Grid -->
              <div class="nfc-qr-area">
                <div class="qr-box">
                  <div class="qr-corner qr-tl"></div>
                  <div class="qr-corner qr-tr"></div>
                  <div class="qr-corner qr-bl"></div>
                  <div class="qr-dots">
                    <span></span><span></span><span></span><span></span>
                    <span></span><span></span><span></span><span></span>
                    <span></span><span></span><span></span><span></span>
                    <span></span><span></span><span></span><span></span>
                  </div>
                  <div class="qr-logo-center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2.5">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                  </div>
                </div>
                <span class="qr-label">Scan to Connect</span>
              </div>
            </div>

            <!-- Front Card (Lower, left-shifted, interactive tap card) -->
            <button class="nfc-card nfc-card-front tap-card" id="tap-card" type="button" aria-label="Click or tap to preview digital profile" title="Click to test live profile demonstration">
              <div class="nfc-card-shine"></div>
              
              <!-- Top Row: Zappit Brand & NFC Icon -->
              <div class="nfc-card-top-row">
                <div class="nfc-card-logo-group">
                  <div class="nfc-card-logo">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                    <span>ZAPPIT</span>
                  </div>
                  <div class="nfc-card-tagline">SMART NFC CONNECTED CARD</div>
                </div>
                
                <div class="nfc-nfc-icon-top">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12" stroke="#00E5FF" stroke-width="2" stroke-linecap="round"/>
                    <path d="M17 12C17 8.68629 14.3137 6 11 6" stroke="#00E5FF" stroke-width="2" stroke-linecap="round"/>
                    <path d="M14 12C14 10.3431 12.6569 9 11 9" stroke="#00E5FF" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="11" cy="12" r="1.5" fill="#00E5FF"/>
                  </svg>
                </div>
              </div>

              <!-- Sleek Divider -->
              <div class="nfc-card-divider"></div>

              <!-- Bottom Row: Name, Title & Microchip -->
              <div class="nfc-card-bottom-row">
                <div class="nfc-card-person">
                  <div class="nfc-card-name">Alex Morgan</div>
                  <div class="nfc-card-subtitle">Founder &amp; Managing Director</div>
                </div>
                
                <div class="nfc-chip-icon" aria-hidden="true">
                  <svg width="38" height="28" viewBox="0 0 36 28" fill="none">
                    <rect x="1" y="1" width="34" height="26" rx="5" stroke="#00E5FF" stroke-width="1.5" stroke-opacity="0.85"/>
                    <rect x="5" y="5" width="26" height="18" rx="3" stroke="#0066FF" stroke-width="1.2" stroke-opacity="0.8"/>
                    <line x1="12" y1="1" x2="12" y2="5" stroke="#00E5FF" stroke-width="1.2"/>
                    <line x1="18" y1="1" x2="18" y2="5" stroke="#00E5FF" stroke-width="1.2"/>
                    <line x1="24" y1="1" x2="24" y2="5" stroke="#00E5FF" stroke-width="1.2"/>
                    <line x1="12" y1="23" x2="12" y2="27" stroke="#00E5FF" stroke-width="1.2"/>
                    <line x1="18" y1="23" x2="18" y2="27" stroke="#00E5FF" stroke-width="1.2"/>
                    <line x1="24" y1="23" x2="24" y2="27" stroke="#00E5FF" stroke-width="1.2"/>
                  </svg>
                </div>
              </div>

              <!-- Discoverable Tap Hint -->
              <span class="card-tap-hint">
                <i data-lucide="sparkles" style="width: 14px; height: 14px;"></i>
                Tap or click to preview live profile
              </span>
            </button>
          </div>
        </div>
      </div>

      <!-- Micro Assurances Pill Strip -->
      <div class="hero-pill-strip" aria-label="Key Product Features">
        <div class="hero-pill-item">
          <i data-lucide="radio"></i>
          <span>High-Speed NTAG216 NFC</span>
        </div>
        <div class="hero-pill-item">
          <i data-lucide="qr-code"></i>
          <span>High-Contrast QR Backup</span>
        </div>
        <div class="hero-pill-item">
          <i data-lucide="smartphone"></i>
          <span>No App or Download Required</span>
        </div>
        <div class="hero-pill-item">
          <i data-lucide="refresh-cw"></i>
          <span>Live Cloud Profile Updates</span>
        </div>
      </div>
    </div>
  </section>

  <!-- Trust & Product Assurances -->
  <section class="apple-trust" id="assurances" aria-label="Product Assurances">
    <div class="container">
      <div class="trust-grid">
        <article class="trust-card">
          <div class="trust-icon-box">
            <i data-lucide="smartphone"></i>
          </div>
          <h3>No App Required</h3>
          <p>Profiles open instantly in native Safari or Chrome. Recipients don't need to install any app or create an account.</p>
        </article>

        <article class="trust-card">
          <div class="trust-icon-box">
            <i data-lucide="shield-check"></i>
          </div>
          <h3>Dual-Layer Connection</h3>
          <p>Every card features an NFC antenna paired with a high-contrast QR code backup for complete smartphone compatibility.</p>
        </article>

        <article class="trust-card">
          <div class="trust-icon-box">
            <i data-lucide="refresh-cw"></i>
          </div>
          <h3>Live Cloud Updates</h3>
          <p>Change your contact numbers, title, company, links, or catalogue anytime in your dashboard without replacing the card.</p>
        </article>

        <article class="trust-card">
          <div class="trust-icon-box">
            <i data-lucide="check-circle-2"></i>
          </div>
          <h3>Quality Checked Hardware</h3>
          <p>Cards are constructed with durable water-resistant PVC and checked for NFC chip encoding and URL routing before dispatch.</p>
        </article>
      </div>
    </div>
  </section>

  <!-- Materials & Hardware Craftsmanship -->
  <section class="apple-materials" id="materials" aria-labelledby="materials-title">
    <div class="container">
      <div class="section-intro">
        <span class="section-eyebrow">Card Finishes</span>
        <h2 class="section-title" id="materials-title">Crafted for presence. Finished with restraint.</h2>
        <p class="section-desc">Two durable PVC card finishes built to make an impression. Both cards feature embedded NTAG216 NFC chips and high-contrast QR backups.</p>
      </div>

      <div class="materials-grid">
        <!-- Matte Black PVC -->
        <article class="material-card is-selected" id="card-finish-black" data-finish="black">
          <div class="material-img-wrap">
            <img src="/assets/black-pvc-card.jpg" alt="Zappit Velvet Matte Black PVC smart card" class="material-img" loading="lazy">
          </div>
          <div class="material-body">
            <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
              <span class="material-badge">Matte Finish</span>
              <span class="material-selected-pill" id="badge-selected-black"><i data-lucide="check" style="width: 13px; height: 13px;"></i> Selected Finish</span>
            </div>
            <h3>Velvet Matte Black PVC</h3>
            <p>Durable matte PVC with a smooth, glare-free black finish. Water-resistant, sturdy, and embedded with a high-speed NTAG216 NFC chip and high-contrast QR backup.</p>
            <div class="material-footer">
              <div class="material-price">₹1,999 <small>incl. 1-year profile hosting</small></div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button type="button" class="apple-btn apple-btn-primary" id="btn-choose-black" data-select-finish="black">Choose Black</button>
                <button type="button" class="apple-btn apple-btn-glass" data-add-to-cart="black" title="Add Velvet Matte Black PVC to cart">Add to Cart</button>
              </div>
            </div>
          </div>
        </article>

        <!-- Minimalist Ceramic White PVC -->
        <article class="material-card" id="card-finish-white" data-finish="white">
          <div class="material-img-wrap">
            <img src="/assets/white-pvc-card.jpg" alt="Zappit Ceramic White PVC smart card" class="material-img" loading="lazy">
          </div>
          <div class="material-body">
            <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
              <span class="material-badge">Clean Gloss Finish</span>
              <span class="material-selected-pill" id="badge-selected-white" style="display: none;"><i data-lucide="check" style="width: 13px; height: 13px;"></i> Selected Finish</span>
            </div>
            <h3>Ceramic White PVC</h3>
            <p>Durable white PVC with a clean gloss ceramic-look finish. Resilient, water-resistant, and printed with crisp high-contrast typography and QR code backup.</p>
            <div class="material-footer">
              <div class="material-price">₹1,999 <small>incl. 1-year profile hosting</small></div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button type="button" class="apple-btn apple-btn-glass" id="btn-choose-white" data-select-finish="white">Choose White</button>
                <button type="button" class="apple-btn apple-btn-glass" data-add-to-cart="white" title="Add Ceramic White PVC to cart">Add to Cart</button>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>

  <!-- Digital Profile Section -->
  <section class="apple-experience" id="profile-experience" aria-labelledby="experience-title">
    <div class="container">
      <div class="section-intro">
        <span class="section-eyebrow">Digital Profile</span>
        <h2 class="section-title" id="experience-title">Your complete digital presence in one tap.</h2>
        <p class="section-desc">Instantly share your contact details, portfolio, and social channels without requiring the recipient to install any application.</p>
      </div>

      <!-- Bento Features -->
      <div class="experience-bento">
        <!-- Contact Save -->
        <article class="bento-card">
          <div class="bento-icon">
            <i data-lucide="user-plus"></i>
          </div>
          <h3>One-Tap Contact Save</h3>
          <p>Recipients can download your standard .vcf contact card with one tap and prompt to save your details directly into their phone contacts.</p>
        </article>

        <!-- WhatsApp Integration -->
        <article class="bento-card">
          <div class="bento-icon">
            <i data-lucide="message-circle"></i>
          </div>
          <h3>WhatsApp Direct Chat</h3>
          <p>Set up a direct WhatsApp chat link with an optional pre-filled greeting so visitors can message you directly in WhatsApp with one tap.</p>
        </article>

        <!-- Vehicle & Recovery Modes -->
        <article class="bento-card">
          <div class="bento-icon">
            <i data-lucide="shield-alert"></i>
          </div>
          <h3>Vehicle &amp; Recovery Modes</h3>
          <p>Switch your profile to Vehicle Connect to display parking notes and emergency contacts, or enable private Lost &amp; Found QR tags.</p>
        </article>

        <!-- Catalogue & Booking (Wide) -->
        <article class="bento-card bento-card-wide">
          <div class="bento-icon">
            <i data-lucide="calendar"></i>
          </div>
          <h3>Service Showcase &amp; Booking Links</h3>
          <p>Display your products and services with pricing, and link directly to your Calendly or booking page so clients can schedule time or review offerings.</p>
        </article>

        <!-- Privacy Controls -->
        <article class="bento-card">
          <div class="bento-icon">
            <i data-lucide="shield-check"></i>
          </div>
          <h3>Granular Privacy Controls</h3>
          <p>Choose which phone numbers or links are publicly visible. You maintain full control over your published information. <a href="/privacy" style="color: var(--apple-blue); text-decoration: underline;">Privacy Centre &rarr;</a></p>
        </article>
      </div>
    </div>
  </section>

  <!-- Show the Software: CRM Lead Management Section -->
  <section class="apple-experience" id="crm-workspace" aria-labelledby="crm-title" style="padding-top: 20px;">
    <div class="container">
      <div class="section-intro">
        <span class="section-eyebrow">Lead Management mini-CRM</span>
        <h2 class="section-title" id="crm-title">Turn conversations into tracked pipeline revenue.</h2>
        <p class="section-desc">A centralized workspace to capture, follow up, and close opportunities generated from your digital business card.</p>
      </div>

      <!-- CRM Preview Controls Toolbar with Light / Dark Switch -->
      <div class="crm-preview-toolbar">
        <span class="crm-preview-tag">
          <span class="crm-preview-tag-dot" aria-hidden="true"></span>
          Real Workspace Preview
        </span>
        <div class="crm-preview-theme-switch" role="group" aria-label="Dashboard preview theme">
          <button
            type="button"
            id="crm-theme-dark-btn"
            class="crm-theme-btn active"
            data-theme-val="dark"
            aria-pressed="true"
            aria-label="View CRM dashboard preview in Dark Mode"
            onclick="(function(){var c=document.getElementById('crm-preview-card');if(c){c.setAttribute('data-preview-theme','dark');document.querySelectorAll('.crm-theme-btn').forEach(function(b){var isD=b.getAttribute('data-theme-val')==='dark';b.classList.toggle('active',isD);b.setAttribute('aria-pressed',isD?'true':'false');});try{sessionStorage.setItem('zappit_crm_preview_mode','dark');}catch(e){}}})()"
          >
            <svg class="crm-theme-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
            </svg>
            <span>Dark</span>
          </button>
          <button
            type="button"
            id="crm-theme-light-btn"
            class="crm-theme-btn"
            data-theme-val="light"
            aria-pressed="false"
            aria-label="View CRM dashboard preview in Light Mode"
            onclick="(function(){var c=document.getElementById('crm-preview-card');if(c){c.setAttribute('data-preview-theme','light');document.querySelectorAll('.crm-theme-btn').forEach(function(b){var isL=b.getAttribute('data-theme-val')==='light';b.classList.toggle('active',isL);b.setAttribute('aria-pressed',isL?'true':'false');});try{sessionStorage.setItem('zappit_crm_preview_mode','light');}catch(e){}}})()"
          >
            <svg class="crm-theme-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="5"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
            </svg>
            <span>Light</span>
          </button>
        </div>
      </div>

      <!-- High Fidelity CRM UI Preview (Actual Dashboard Screenshot Frame) -->
      <figure class="crm-preview-card" id="crm-preview-card" data-preview-theme="dark" style="margin: 0 0 36px 0; padding: 0; border-radius: 16px; overflow: hidden; display: block;">
        <div class="crm-preview-image-wrap" style="position: relative; width: 100%; aspect-ratio: 1024 / 519; overflow: hidden; display: flex; justify-content: center; align-items: center;">
          <img
            src="/assets/crm-dashboard-dark.png"
            alt="Zappit CRM dashboard dark mode preview showing KPI cards, daily follow-up capacity, growth velocity chart, and pipeline stages distribution"
            width="1024"
            height="519"
            loading="eager"
            decoding="async"
            class="crm-preview-img crm-preview-img-dark"
          />
          <img
            src="/assets/crm-dashboard-light.png"
            alt="Zappit CRM dashboard light mode preview showing KPI cards, daily follow-up capacity, growth velocity chart, and pipeline stages distribution"
            width="1024"
            height="519"
            loading="eager"
            decoding="async"
            class="crm-preview-img crm-preview-img-light"
          />
        </div>
        <figcaption class="crm-preview-caption" id="crm-preview-caption">
          Zappit CRM dashboard preview
        </figcaption>
      </figure>

      <!-- Ethical Voluntary Capture Explanation -->
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px; padding: 24px; display: flex; gap: 18px; align-items: flex-start;">
        <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(0, 102, 255, 0.1); color: var(--apple-blue); display: grid; place-items: center; flex-shrink: 0;">
          <i data-lucide="shield-check" style="width: 22px; height: 22px;"></i>
        </div>
        <div>
          <h4 style="font-size: 1.05rem; font-weight: 700; color: #0F172A; margin: 0 0 6px 0;">Ethical &amp; Voluntary Lead Capture</h4>
          <p style="font-size: 0.925rem; color: #526176; margin: 0; line-height: 1.6;">
            <strong>How taps become leads:</strong> When a recipient views your digital profile, they can tap the <em>Share Details</em> button to voluntarily submit their name, phone number, and requirements. Those details are instantly organized in your Zappit CRM workspace with source attribution.
          </p>
          <small style="display: block; margin-top: 8px; color: #64748B; font-size: 0.8rem;">
            *Privacy guarantee: NFC cards do not silently capture or scrape private phone data without the visitor's explicit action and consent.
          </small>
        </div>
      </div>
    </div>
  </section>

  <!-- How It Works (3 Clear Steps) -->
  <section class="apple-steps" id="how-it-works" aria-labelledby="steps-title">
    <div class="container">
      <div class="section-intro">
        <span class="section-eyebrow">Simple Workflow</span>
        <h2 class="section-title" id="steps-title">From first tap to lasting impression.</h2>
        <p class="section-desc">Getting started with your Zappit smart card is straightforward and takes only a few minutes.</p>
      </div>

      <div class="steps-grid">
        <article class="step-item">
          <span class="step-number">01</span>
          <h3>Choose your card finish</h3>
          <p>Select your card finish (Velvet Matte Black or Ceramic White PVC), place your order, and receive your card delivered ready to tap.</p>
        </article>

        <article class="step-item">
          <span class="step-number">02</span>
          <h3>Build your profile</h3>
          <p>Sign in to your Zappit Dashboard to add contact numbers, social links, services, portfolio images, and custom action buttons.</p>
        </article>

        <article class="step-item">
          <span class="step-number">03</span>
          <h3>Tap, share &amp; connect</h3>
          <p>Hold your card to any compatible iPhone or Android. Your digital profile opens instantly in their browser with zero app installation.</p>
        </article>
      </div>
    </div>
  </section>

  <!-- Two-Bundle Comparison Section -->
  <section class="apple-bundles" id="bundles" aria-labelledby="bundles-title">
    <div class="container">
      <div class="section-intro">
        <span class="section-eyebrow">Solutions &amp; Bundles</span>
        <h2 class="section-title" id="bundles-title">Two transparent packages. Built for performance.</h2>
        <p class="section-desc">Choose our core smart NFC card with standard profile software, or upgrade to complete Lead Management to turn taps into tracked business revenue.</p>
      </div>

      <!-- Finish Switcher Bar -->
      <div class="bundles-finish-bar" aria-label="Choose card finish for bundle">
        <span class="bundles-finish-label">Selected Card Finish:</span>
        <button type="button" class="finish-toggle-btn is-active" id="bundle-toggle-black" data-select-finish="black">
          <span class="finish-color-dot dot-black"></span>
          <span>Velvet Matte Black PVC</span>
        </button>
        <button type="button" class="finish-toggle-btn" id="bundle-toggle-white" data-select-finish="white">
          <span class="finish-color-dot dot-white"></span>
          <span>Ceramic White PVC</span>
        </button>
      </div>

      <div class="bundles-container">
        <!-- Bundle 1: NFC Card + Software -->
        <article class="bundle-card" id="bundle-standard-card">
          <div class="bundle-card-header">
            <span class="bundle-kicker">Standard Bundle</span>
            <h3 class="bundle-title">NFC Card + Software</h3>
            <p class="bundle-desc">Physical NFC smart business card paired with our complete digital identity software for instant contact sharing.</p>
            
            <div class="bundle-price-block">
              <div class="bundle-price-row">
                <span class="bundle-currency">₹</span>
                <span class="bundle-price" id="price-bundle-standard">1,999</span>
                <span class="bundle-price-term" id="term-bundle-standard">for Matte Black PVC</span>
              </div>
              <div class="bundle-billing-type">One-time hardware purchase</div>
              <p class="bundle-billing-detail">Includes 1-year digital profile hosting. Annual renewal at ₹499/year. No app required.</p>
            </div>
          </div>

          <div class="bundle-divider"></div>

          <div class="bundle-features-block">
            <span class="bundle-features-label">Included Features</span>
            <ul class="bundle-feature-list">
              <li>
                <i data-lucide="check" class="bundle-check-icon"></i>
                <span id="card-feature-finish-label">Custom NFC smart card (Velvet Matte Black PVC)</span>
              </li>
              <li>
                <i data-lucide="check" class="bundle-check-icon"></i>
                <span>High-speed NTAG216 chip + high-contrast QR backup</span>
              </li>
              <li>
                <i data-lucide="check" class="bundle-check-icon"></i>
                <span>Digital profile page with 1-tap contact download (.vcf file)</span>
              </li>
              <li>
                <i data-lucide="check" class="bundle-check-icon"></i>
                <span>Social links, direct WhatsApp chat link, and profile bio</span>
              </li>
              <li>
                <i data-lucide="check" class="bundle-check-icon"></i>
                <span>Live cloud profile updates anytime without reprinting</span>
              </li>
            </ul>
          </div>

          <div class="bundle-card-footer">
            <button type="button" class="bundle-btn bundle-btn-primary" id="btn-cart-standard" data-add-bundle-cart="standard" style="width: 100%;">Add Standard to Cart</button>
          </div>
        </article>

        <!-- Bundle 2: NFC Card + Lead Management -->
        <article class="bundle-card bundle-featured" id="bundle-crm-card">
          <div class="bundle-card-header">
            <div class="bundle-badge-wrapper">
              <span class="bundle-badge">Includes Full CRM Workspace</span>
            </div>
            <h3 class="bundle-title">NFC Card + Lead Management</h3>
            <p class="bundle-desc">Everything in the Standard bundle, plus our complete Lead Management mini-CRM to capture, track, and close deals.</p>
            
            <div class="bundle-price-block">
              <div class="bundle-price-row">
                <span class="bundle-currency">₹</span>
                <span class="bundle-price" id="price-bundle-crm">2,999</span>
                <span class="bundle-period">/year</span>
                <span class="bundle-price-term" id="term-bundle-crm">for Matte Black PVC</span>
              </div>
              <div class="bundle-billing-type">Yearly Plan · Billed Annually</div>
              <p class="bundle-billing-detail">Includes smart NFC card + 1 year of Lead Management CRM access. No app required.</p>
            </div>
          </div>

          <div class="bundle-divider"></div>

          <div class="bundle-features-block">
            <span class="bundle-features-label">Everything in the NFC Card + Software bundle, plus:</span>
            <ul class="bundle-feature-list">
              <li>
                <i data-lucide="check" class="bundle-check-icon"></i>
                <span>Centralized Leads CRM workspace with custom pipeline stages</span>
              </li>
              <li>
                <i data-lucide="check" class="bundle-check-icon"></i>
                <span>Voluntary lead capture when profile visitors tap "Share Details"</span>
              </li>
              <li>
                <i data-lucide="check" class="bundle-check-icon"></i>
                <span>Lead acquisition source attribution &amp; performance tracking</span>
              </li>
              <li>
                <i data-lucide="check" class="bundle-check-icon"></i>
                <span>Follow-up scheduling with calendar tracking &amp; in-app reminder alerts</span>
              </li>
              <li>
                <i data-lucide="check" class="bundle-check-icon"></i>
                <span>Product catalog integration with revenue &amp; advance tracking</span>
              </li>
              <li>
                <i data-lucide="check" class="bundle-check-icon"></i>
                <span>Dynamic custom fields builder for tailored lead capture</span>
              </li>
            </ul>
          </div>

          <div class="bundle-card-footer">
            <button type="button" class="bundle-btn bundle-btn-primary" id="btn-cart-crm" data-add-bundle-cart="crm" style="width: 100%;">Add CRM Bundle to Cart</button>
          </div>
        </article>
      </div>
    </div>
  </section>

  <!-- Practical Verified FAQ Section -->
  <section class="apple-faq" id="faq" aria-labelledby="faq-title">
    <div class="container">
      <div class="section-intro">
        <span class="section-eyebrow">Clear Answers</span>
        <h2 class="section-title" id="faq-title">Frequently Asked Questions</h2>
        <p class="section-desc">Practical details about phone compatibility, ordering, delivery, and profile renewals.</p>
      </div>

      <div class="faq-grid" id="faq-accordion">
        <!-- FAQ 1 -->
        <div class="faq-item">
          <button type="button" class="faq-trigger" aria-expanded="false" aria-controls="faq-ans-1">
            <span>Which smartphones are compatible with Zappit cards?</span>
            <i data-lucide="chevron-down" class="faq-icon"></i>
          </button>
          <div class="faq-answer" id="faq-ans-1">
            Zappit cards work natively with all modern iPhones (iPhone 7 and newer; background tag reading is supported natively on iPhone XS, XR, 11, 12, 13, 14, 15, and 16 running iOS 14+) and all NFC-enabled Android devices. For older smartphones or devices with NFC disabled, every Zappit card includes a high-contrast QR code on the back that works with any smartphone camera.
          </div>
        </div>

        <!-- FAQ 2 -->
        <div class="faq-item">
          <button type="button" class="faq-trigger" aria-expanded="false" aria-controls="faq-ans-2">
            <span>Does the recipient need to install an app or create an account?</span>
            <i data-lucide="chevron-down" class="faq-icon"></i>
          </button>
          <div class="faq-answer" id="faq-ans-2">
            No. The recipient does not need to download an app or create an account. When they tap your card or scan the QR code, your digital profile opens directly in their default mobile browser (Safari, Chrome, etc.). They can save your contact details or start a chat immediately.
          </div>
        </div>

        <!-- FAQ 3 -->
        <div class="faq-item">
          <button type="button" class="faq-trigger" aria-expanded="false" aria-controls="faq-ans-3">
            <span>How do I update my profile details after purchasing?</span>
            <i data-lucide="chevron-down" class="faq-icon"></i>
          </button>
          <div class="faq-answer" id="faq-ans-3">
            You can sign in to your Zappit web dashboard from any computer or mobile browser to update your phone numbers, title, bio, social links, company information, or catalogue at any time. Changes sync to the cloud instantly — your physical card never needs to be re-encoded or replaced.
          </div>
        </div>

        <!-- FAQ 4 -->
        <div class="faq-item">
          <button type="button" class="faq-trigger" aria-expanded="false" aria-controls="faq-ans-4">
            <span>How does card customization and ordering work?</span>
            <i data-lucide="chevron-down" class="faq-icon"></i>
          </button>
          <div class="faq-answer" id="faq-ans-4">
            First, choose your finish (Velvet Matte Black PVC or Ceramic White PVC) and select either the Standard or Lead Management bundle. Add it to your cart and complete checkout securely. Our team will verify your requirements, confirm personalization details, and program the high-speed NTAG216 chip before shipping your card ready to tap.
          </div>
        </div>

        <!-- FAQ 5 -->
        <div class="faq-item">
          <button type="button" class="faq-trigger" aria-expanded="false" aria-controls="faq-ans-5">
            <span>What are the shipping and delivery terms?</span>
            <i data-lucide="chevron-down" class="faq-icon"></i>
          </button>
          <div class="faq-answer" id="faq-ans-5">
            Personalised cards enter production and encoding once your order and details are confirmed. Production and delivery estimates are provided on your order page. Address changes must be submitted to support prior to dispatch, as addresses cannot be modified once a parcel has left our facility.
          </div>
        </div>

        <!-- FAQ 6 -->
        <div class="faq-item">
          <button type="button" class="faq-trigger" aria-expanded="false" aria-controls="faq-ans-6">
            <span>How does annual renewal work, and what happens after expiry?</span>
            <i data-lucide="chevron-down" class="faq-icon"></i>
          </button>
          <div class="faq-answer" id="faq-ans-6">
            The physical smart card is a one-time hardware purchase that you own permanently. The Standard bundle includes 1 year of digital profile hosting (annual profile renewal is ₹499/year). If a profile expires, your physical card remains yours, and your profile can be reactivated anytime upon renewal without needing a new card. The CRM bundle is billed annually and includes ongoing CRM workspace access.
          </div>
        </div>

        <!-- FAQ 7 -->
        <div class="faq-item">
          <button type="button" class="faq-trigger" aria-expanded="false" aria-controls="faq-ans-7">
            <span>What happens if my card is lost or physically damaged?</span>
            <i data-lucide="chevron-down" class="faq-icon"></i>
          </button>
          <div class="faq-answer" id="faq-ans-7">
            Because your digital profile lives securely in the Zappit cloud, your data, contacts, and settings are never lost. If your physical card is lost or damaged, you can order a replacement card from your dashboard and link it to your existing profile in one click.
          </div>
        </div>

        <!-- FAQ 8 -->
        <div class="faq-item">
          <button type="button" class="faq-trigger" aria-expanded="false" aria-controls="faq-ans-8">
            <span>What is the difference between the Standard and CRM bundles?</span>
            <i data-lucide="chevron-down" class="faq-icon"></i>
          </button>
          <div class="faq-answer" id="faq-ans-8">
            The Standard bundle (₹1,999) includes the physical smart NFC card and 1 year of digital profile hosting, featuring 1-tap .vcf contact downloads, WhatsApp chat, and social links. The Lead Management bundle (₹2,999/year) adds our complete CRM workspace, capturing voluntarily submitted visitor contact details, tracking lead acquisition sources (NFC Tap vs. QR Scan), scheduling follow-ups with reminders, and managing deals through pipeline stages.
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Final Call to Action -->
  <section class="apple-final-cta" id="final-cta" aria-labelledby="cta-headline">
    <div class="final-cta-container">
      <h2 class="final-cta-headline" id="cta-headline">Make an impression that lasts.</h2>
      <p class="final-cta-desc">Engineered with durable PVC polymer materials and high-speed NFC technology. Delivered ready to tap.</p>
      <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">
        <a href="#materials" class="apple-btn apple-btn-primary" style="font-size: 1.05rem; padding: 16px 36px;">Choose Your Card</a>
        <a href="/dashboard" class="apple-btn apple-btn-glass" style="font-size: 1.05rem; padding: 16px 36px;">Open Dashboard</a>
      </div>
    </div>
  </section>

  <!-- Apple-Grade Footer -->
  <footer class="apple-footer" role="contentinfo">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand-col">
          <img src="/brand/zappit-logo-transparent.png" alt="Zappit" class="footer-logo-img" width="140" height="48" loading="lazy">
          <p>Smart NFC cards and digital identity profiles engineered for unforgettable first impressions.</p>
        </div>

        <div class="footer-col">
          <h4>Products</h4>
          <ul class="footer-links">
            <li><a href="#materials">NFC Business Cards</a></li>
            <li><a href="#bundles">Software Bundles</a></li>
            <li><a href="#crm-workspace">Lead Management CRM</a></li>
            <li><a href="/partners">Partners Programme</a></li>
          </ul>
        </div>

        <div class="footer-col">
          <h4>Account</h4>
          <ul class="footer-links">
            <li><a href="/dashboard">Account Dashboard</a></li>
            <li><a href="/dashboard?tab=cards">My Cards</a></li>
            <li><a href="/orders">Order History</a></li>
            <li><a href="/privacy">Privacy Centre</a></li>
          </ul>
        </div>

        <div class="footer-col">
          <h4>Support &amp; Legal</h4>
          <ul class="footer-links">
            <li><a href="/support">Help &amp; Support</a></li>
            <li><a href="/terms-of-service">Terms of Service</a></li>
            <li><a href="/privacy-policy">Privacy Policy</a></li>
            <li><a href="/cookie-policy">Cookie Policy</a></li>
            <li><a href="/shipping">Shipping Information</a></li>
            <li><a href="/refunds">Returns &amp; Refunds</a></li>
            <li><a href="/acceptable-use">Acceptable Use</a></li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <p>&copy; 2026 Zappit. All rights reserved. Smart connections, beautifully made.</p>
        <div class="footer-legal-links">
          <a href="/privacy-policy">Privacy Policy</a>
          <a href="/terms-of-service">Terms of Service</a>
          <a href="/cookie-policy">Cookie Policy</a>
          <a href="/support">Contact Support</a>
        </div>
      </div>
    </div>
  </footer>

  <!-- Drawer Overlay -->
  <div class="drawer-overlay" id="drawer-overlay" aria-hidden="true"></div>

  <!-- Cart Drawer -->
  <div class="drawer glass-solid" id="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title">
    <div class="drawer-header">
      <h3 id="cart-drawer-title">My Cart (<span class="cart-count-badge">0</span>)</h3>
      <button class="drawer-close" type="button" aria-label="Close shopping cart panel"><i data-lucide="x"></i></button>
    </div>
    <div class="drawer-body" id="cart-items">
      <!-- Populated via Javascript -->
    </div>
    <div class="drawer-footer">
      <div class="drawer-total" style="display: flex; justify-content: space-between; margin-bottom: 16px; font-weight: 700; font-size: 1.15rem;">
        <span>Total:</span>
        <span id="cart-total-price">₹0</span>
      </div>
      <button class="apple-btn apple-btn-primary" id="checkout-trigger" type="button" style="width: 100%;">Continue to Payment</button>
    </div>
  </div>

  <!-- Checkout Modal -->
  <div class="modal-overlay" id="checkout-modal" aria-hidden="true">
    <div class="modal-card checkout-modal-card glass-solid" role="dialog" aria-modal="true" aria-labelledby="checkout-title">
      <button class="modal-close" type="button" data-close-checkout aria-label="Close checkout dialog"><i data-lucide="x"></i></button>
      <div class="modal-header">
        <h3 id="checkout-title">Choose Payment Method</h3>
        <p id="checkout-summary">Your secure order summary will appear here.</p>
      </div>
      <form id="checkout-form" class="checkout-form">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
          <label class="payment-option active" style="padding: 12px; border-radius: 12px; border: 1px solid var(--apple-border); display: flex; gap: 10px; align-items: center; cursor: pointer;">
            <input type="radio" name="payment-method" value="UPI" checked style="accent-color: var(--apple-blue);">
            <span><b>UPI</b><br><small style="color: var(--apple-text-tertiary);">PhonePe, GPay, Paytm</small></span>
          </label>
          <label class="payment-option" style="padding: 12px; border-radius: 12px; border: 1px solid var(--apple-border); display: flex; gap: 10px; align-items: center; cursor: pointer;">
            <input type="radio" name="payment-method" value="Card" style="accent-color: var(--apple-blue);">
            <span><b>Cards</b><br><small style="color: var(--apple-text-tertiary);">Visa, MC, RuPay</small></span>
          </label>
          <label class="payment-option" style="padding: 12px; border-radius: 12px; border: 1px solid var(--apple-border); display: flex; gap: 10px; align-items: center; cursor: pointer;">
            <input type="radio" name="payment-method" value="Net Banking" style="accent-color: var(--apple-blue);">
            <span><b>Net Banking</b><br><small style="color: var(--apple-text-tertiary);">All Indian Banks</small></span>
          </label>
          <label class="payment-option" style="padding: 12px; border-radius: 12px; border: 1px solid var(--apple-border); display: flex; gap: 10px; align-items: center; cursor: pointer;">
            <input type="radio" name="payment-method" value="Cash on Delivery" style="accent-color: var(--apple-blue);">
            <span><b>Cash on Delivery</b><br><small style="color: var(--apple-text-tertiary);">Pay on delivery</small></span>
          </label>
        </div>

        <div class="payment-fields checkout-details" id="payment-fields">
          <h4 style="margin-bottom: 14px; font-size: 1rem;">Customer and Delivery Details</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <label style="display: flex; flex-direction: column; gap: 6px; font-size: 0.825rem; font-weight: 600;">Full Name
              <input id="checkout-name" name="name" required autocomplete="name" maxlength="120" placeholder="Customer name" style="height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--apple-border); background: rgba(255,255,255,0.04); color: inherit;">
            </label>
            <label style="display: flex; flex-direction: column; gap: 6px; font-size: 0.825rem; font-weight: 600;">Job Title <small style="opacity: 0.6;">Optional</small>
              <input id="checkout-job-title" name="jobTitle" autocomplete="organization-title" maxlength="100" placeholder="e.g. Founder" style="height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--apple-border); background: rgba(255,255,255,0.04); color: inherit;">
            </label>
            <label style="display: flex; flex-direction: column; gap: 6px; font-size: 0.825rem; font-weight: 600;">Email Address
              <input id="checkout-email" name="email" type="email" required autocomplete="email" maxlength="254" placeholder="name@domain.com" style="height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--apple-border); background: rgba(255,255,255,0.04); color: inherit;">
            </label>
            <label style="display: flex; flex-direction: column; gap: 6px; font-size: 0.825rem; font-weight: 600;">Phone Number
              <input id="checkout-phone" name="phone" type="tel" required autocomplete="tel" maxlength="30" placeholder="+91 98765 43210" style="height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--apple-border); background: rgba(255,255,255,0.04); color: inherit;">
            </label>
            <label style="grid-column: span 2; display: flex; flex-direction: column; gap: 6px; font-size: 0.825rem; font-weight: 600;">Delivery Address
              <input id="checkout-address1" name="address1" required autocomplete="address-line1" maxlength="200" placeholder="Flat, building, street, area" style="height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--apple-border); background: rgba(255,255,255,0.04); color: inherit;">
            </label>
            <label style="grid-column: span 2; display: flex; flex-direction: column; gap: 6px; font-size: 0.825rem; font-weight: 600;">Address Line 2 <small style="opacity: 0.6;">Optional</small>
              <input id="checkout-address2" name="address2" autocomplete="address-line2" maxlength="200" placeholder="Landmark or locality" style="height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--apple-border); background: rgba(255,255,255,0.04); color: inherit;">
            </label>
            <label style="display: flex; flex-direction: column; gap: 6px; font-size: 0.825rem; font-weight: 600;">City
              <input id="checkout-city" name="city" required autocomplete="address-level2" maxlength="100" style="height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--apple-border); background: rgba(255,255,255,0.04); color: inherit;">
            </label>
            <label style="display: flex; flex-direction: column; gap: 6px; font-size: 0.825rem; font-weight: 600;">State
              <input id="checkout-state" name="state" required autocomplete="address-level1" maxlength="100" style="height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--apple-border); background: rgba(255,255,255,0.04); color: inherit;">
            </label>
            <label style="display: flex; flex-direction: column; gap: 6px; font-size: 0.825rem; font-weight: 600;">PIN Code
              <input id="checkout-postal" name="postal" required autocomplete="postal-code" maxlength="20" style="height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--apple-border); background: rgba(255,255,255,0.04); color: inherit;">
            </label>
            <label style="display: flex; flex-direction: column; gap: 6px; font-size: 0.825rem; font-weight: 600;">Country
              <input id="checkout-country" name="country" required autocomplete="country-name" maxlength="100" value="India" style="height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--apple-border); background: rgba(255,255,255,0.04); color: inherit;">
            </label>
            <label style="grid-column: span 2; display: flex; flex-direction: column; gap: 6px; font-size: 0.825rem; font-weight: 600;">Coupon or Affiliate Code <small style="opacity: 0.6;">Optional</small>
              <input id="checkout-coupon" name="coupon" maxlength="50" autocomplete="off" style="height: 38px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--apple-border); background: rgba(255,255,255,0.04); color: inherit;">
            </label>
          </div>
        </div>

        <button class="apple-btn apple-btn-primary" id="checkout-submit" type="submit" style="width: 100%; margin-top: 24px; padding: 14px;">Place Order Securely</button>
      </form>
    </div>
  </div>

  <!-- Interactive Live Sample Profile Modal -->
  <div class="modal-overlay" id="live-demo-modal" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="live-demo-title">
    <div class="modal-card glass-solid" style="max-width: 480px !important; padding: 24px 20px !important;">
      <button class="modal-close" type="button" id="close-live-demo-btn" aria-label="Close live profile demo">
        <i data-lucide="x"></i>
      </button>

      <div style="text-align: center; margin-bottom: 16px;">
        <span style="font-size: 0.75rem; font-weight: 700; color: var(--apple-blue); text-transform: uppercase; letter-spacing: 0.05em;">Interactive Demonstration</span>
        <h3 id="live-demo-title" style="font-size: 1.25rem; font-weight: 800; color: #111827; margin: 4px 0;">Zappit Digital Profile Experience</h3>
        <p style="font-size: 0.825rem; color: #64748B; margin: 0;">This is exactly what opens when someone taps your Zappit smart card.</p>
      </div>

      <div class="phone-mockup-wrapper" style="box-shadow: none; border-width: 6px; max-width: 100%;">
        <div class="phone-mockup-speaker"></div>
        <div class="phone-mockup-screen">
          <!-- Profile Header -->
          <div style="text-align: center; padding: 12px 0 16px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
            <div style="width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, #0066FF, #00E5FF); margin: 0 auto 10px auto; display: grid; place-items: center; font-size: 1.5rem; font-weight: 800; color: #FFF; box-shadow: 0 4px 14px rgba(0, 102, 255, 0.4);">
              AM
            </div>
            <h4 style="font-size: 1.2rem; font-weight: 800; margin: 0 0 2px 0; color: #FFFFFF;">Alex Morgan</h4>
            <p style="font-size: 0.825rem; color: #94A3B8; margin: 0 0 4px 0; font-weight: 500;">Founder &amp; Managing Director</p>
            <span style="display: inline-block; font-size: 0.75rem; color: #00E5FF; font-weight: 600;">Apex Creative Studio</span>
          </div>

          <!-- Quick Action Buttons -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 14px 0;">
            <button type="button" class="demo-phone-action" id="modal-demo-vcard" style="padding: 10px; border-radius: 10px; background: #0066FF; color: #FFF; border: none; font-size: 0.8rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
              <i data-lucide="user-plus" style="width: 14px; height: 14px;"></i>
              Save Contact (.vcf)
            </button>
            <button type="button" class="demo-phone-action" id="modal-demo-whatsapp" style="padding: 10px; border-radius: 10px; background: #10B981; color: #FFF; border: none; font-size: 0.8rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
              <i data-lucide="message-circle" style="width: 14px; height: 14px;"></i>
              WhatsApp Chat
            </button>
          </div>

          <!-- Contact Info Tiles -->
          <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px;">
            <div style="padding: 10px 12px; border-radius: 10px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); display: flex; align-items: center; gap: 10px; font-size: 0.8rem;">
              <i data-lucide="phone" style="width: 15px; height: 15px; color: #00E5FF;"></i>
              <span>+91 98765 00123</span>
            </div>
            <div style="padding: 10px 12px; border-radius: 10px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); display: flex; align-items: center; gap: 10px; font-size: 0.8rem;">
              <i data-lucide="mail" style="width: 15px; height: 15px; color: #00E5FF;"></i>
              <span>alex@apexcreativestudio.com</span>
            </div>
            <div style="padding: 10px 12px; border-radius: 10px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.08); display: flex; align-items: center; gap: 10px; font-size: 0.8rem;">
              <i data-lucide="globe" style="width: 15px; height: 15px; color: #00E5FF;"></i>
              <span>apexcreativestudio.com</span>
            </div>
          </div>

          <!-- Voluntary Share Details Lead Trigger -->
          <button type="button" class="demo-phone-action" id="modal-demo-share-details" style="width: 100%; padding: 11px; border-radius: 10px; background: rgba(0, 102, 255, 0.2); border: 1px solid rgba(0, 229, 255, 0.4); color: #00E5FF; font-size: 0.825rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
            <i data-lucide="send" style="width: 15px; height: 15px;"></i>
            Exchange Contact (Share Details)
          </button>
        </div>
      </div>

      <div style="margin-top: 18px; text-align: center;">
        <button type="button" class="apple-btn apple-btn-primary" onclick="document.getElementById('live-demo-modal')?.classList.remove('open'); document.querySelector('#materials')?.scrollIntoView({behavior: 'smooth'});" style="width: 100%;">
          Choose Your Card Now
        </button>
      </div>
    </div>
  </div>

  <!-- Login Modal -->
  <div class="modal-overlay" id="login-modal" aria-hidden="true" role="dialog" aria-labelledby="login-dialog-title">
    <div class="zappit-login-panel glass-solid">
      <button class="modal-close zappit-login-close" type="button" aria-label="Close login dialog" onclick="window.app.closeModal('login-modal')">
        <i data-lucide="x"></i>
      </button>

      <div class="zappit-login-grid">
        <div class="zappit-login-form-col">
          <div class="zappit-login-header">
            <h3 id="login-dialog-title" class="zappit-login-title">Welcome Back</h3>
            <p class="zappit-login-subtitle">Sign in to manage your digital card profile and orders.</p>
          </div>

          <div class="google-auth-container">
            <div id="google-login-onetap-container"></div>
            <button type="button" class="btn btn-google" id="google-login-btn" onclick="window.app.loginWithGoogle()">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="margin-right: 10px; flex-shrink: 0;">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span class="btn-google-text">Continue with Google</span>
            </button>
          </div>

          <div class="auth-divider"><span>OR</span></div>

          <form id="login-form" autocomplete="on">
            <div class="form-group" style="margin-bottom: 18px;">
              <label for="login-email" class="auth-field-label" style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 7px; color: var(--apple-text-primary, #1E293B);">Email Address</label>
              <input type="email" id="login-email" required placeholder="name@domain.com" autocomplete="email" style="width: 100%; height: 44px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--apple-border, #CBD5E1); background: #FFFFFF; color: #0F172A; box-sizing: border-box;">
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 7px;">
                <label for="login-password" class="auth-field-label" style="font-size: 0.85rem; font-weight: 600; margin: 0; color: var(--apple-text-primary, #1E293B);">Password</label>
                <a href="/forgot-password" class="forgot-password-link" id="forgot-password-trigger" style="font-size: 0.8rem; color: var(--apple-blue, #0066FF); text-decoration: none; font-weight: 500;">Set or reset password?</a>
              </div>
              <div class="password-field" style="position: relative;">
                <input type="password" id="login-password" required autocomplete="current-password" placeholder="••••••••" style="width: 100%; height: 44px; padding: 0 48px 0 14px; border-radius: 8px; border: 1px solid var(--apple-border, #CBD5E1); background: #FFFFFF; color: #0F172A; box-sizing: border-box;">
                <button type="button" class="password-toggle" id="login-password-toggle" data-password-toggle="login-password" aria-controls="login-password" aria-pressed="false" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #64748B; font-size: 0.8rem; font-weight: 600; cursor: pointer; padding: 4px 6px;">Show</button>
              </div>
            </div>

            <small class="form-error" id="login-error" role="alert" style="color: #EF4444; font-size: 0.825rem; margin-bottom: 14px; display: block; min-height: 18px;"></small>

            <button class="apple-btn apple-btn-primary" type="submit" style="width: 100%; height: 46px; border-radius: 12px; font-weight: 600; font-size: 0.95rem; background: var(--apple-blue, #0066FF); color: #FFFFFF; border: none; cursor: pointer; transition: all 0.2s ease;">Login Securely</button>
          </form>

          <!-- Forgot Password Panel within Modal -->
          <div id="forgot-password-panel" style="display: none;">
            <div style="margin-bottom: 18px;">
              <h4 style="font-size: 1.15rem; font-weight: 700; margin: 0 0 6px 0; color: var(--apple-text-primary, #1E293B);">Set or Reset Password</h4>
              <p style="font-size: 0.825rem; color: #64748B; margin: 0; line-height: 1.5;">Enter your registered email address and we'll send a link to set or reset your password.</p>
            </div>

            <form id="forgot-password-form">
              <div class="form-group" style="margin-bottom: 18px;">
                <label for="forgot-modal-email" class="auth-field-label" style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 7px; color: var(--apple-text-primary, #1E293B);">Registered Email</label>
                <input type="email" id="forgot-modal-email" required placeholder="name@domain.com" autocomplete="email" style="width: 100%; height: 44px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--apple-border, #CBD5E1); background: #FFFFFF; color: #0F172A; box-sizing: border-box;">
              </div>

              <div id="forgot-modal-message" role="status" style="display: none; padding: 12px 14px; border-radius: 8px; font-size: 0.825rem; margin-bottom: 16px; line-height: 1.5; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #059669;"></div>

              <button class="apple-btn apple-btn-primary" id="forgot-modal-submit" type="submit" style="width: 100%; height: 46px; border-radius: 12px; font-weight: 600; font-size: 0.95rem; background: var(--apple-blue, #0066FF); color: #FFFFFF; border: none; cursor: pointer; transition: all 0.2s ease;">Send Setup or Reset Link</button>
            </form>

            <div style="margin-top: 18px; text-align: center;">
              <a href="#" id="forgot-back-to-login" style="font-size: 0.85rem; color: var(--apple-blue, #0066FF); font-weight: 600; text-decoration: none;">← Back to Login</a>
            </div>
          </div>

          <div class="zappit-login-footer" id="login-modal-footer" style="margin-top: 20px; text-align: center; font-size: 0.85rem; color: #64748B;">
            <p>Don't have an account? <a href="#" id="signup-trigger" style="color: var(--apple-blue, #0066FF); font-weight: 600; text-decoration: none;">Sign up</a></p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Sign Up Modal -->
  <div class="modal-overlay" id="signup-modal" aria-hidden="true" role="dialog" aria-labelledby="signup-dialog-title">
    <div class="zappit-login-panel glass-solid">
      <button class="modal-close zappit-login-close" type="button" aria-label="Close sign up dialog" onclick="window.app.closeModal('signup-modal')">
        <i data-lucide="x"></i>
      </button>

      <div class="zappit-login-grid">
        <div class="zappit-login-form-col">
          <div class="zappit-login-header">
            <h3 id="signup-dialog-title" class="zappit-login-title">Create Your Account</h3>
            <p class="zappit-login-subtitle">Join ZAPPIT to create smart NFC cards and manage your profile.</p>
          </div>

          <div class="google-auth-container">
            <div id="google-signup-onetap-container"></div>
            <button type="button" class="btn btn-google" id="google-signup-btn" onclick="window.app.loginWithGoogle()">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="margin-right: 10px; flex-shrink: 0;">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span class="btn-google-text">Continue with Google</span>
            </button>
          </div>

          <div class="auth-divider"><span>OR</span></div>

          <form id="signup-form" autocomplete="on">
            <div class="form-group" style="margin-bottom: 14px;">
              <label for="signup-name" class="auth-field-label" style="display: block; font-size: 0.825rem; font-weight: 600; margin-bottom: 6px; color: var(--apple-text-primary, #1E293B);">Full Name</label>
              <input type="text" id="signup-name" name="name" required minlength="2" maxlength="100" placeholder="Enter your full name" autocomplete="name" style="width: 100%; height: 40px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--apple-border, #CBD5E1); background: #FFFFFF; color: #0F172A; box-sizing: border-box;">
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
              <label for="signup-email" class="auth-field-label" style="display: block; font-size: 0.825rem; font-weight: 600; margin-bottom: 6px; color: var(--apple-text-primary, #1E293B);">Email Address</label>
              <input type="email" id="signup-email" name="email" required placeholder="you@example.com" autocomplete="email" style="width: 100%; height: 40px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--apple-border, #CBD5E1); background: #FFFFFF; color: #0F172A; box-sizing: border-box;">
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
              <label for="signup-phone" class="auth-field-label" style="display: block; font-size: 0.825rem; font-weight: 600; margin-bottom: 6px; color: var(--apple-text-primary, #1E293B);">Phone Number <span class="auth-optional-tag" style="font-weight: 400; color: #64748B; font-size: 0.8rem; margin-left: 4px;">(optional)</span></label>
              <input type="tel" id="signup-phone" name="phone" placeholder="Enter your phone number" autocomplete="tel" style="width: 100%; height: 40px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--apple-border, #CBD5E1); background: #FFFFFF; color: #0F172A; box-sizing: border-box;">
            </div>

            <div class="form-group" style="margin-bottom: 14px;">
              <label for="signup-password" class="auth-field-label" style="display: block; font-size: 0.825rem; font-weight: 600; margin-bottom: 6px; color: var(--apple-text-primary, #1E293B);">Password</label>
              <div class="password-field" style="position: relative;">
                <input type="password" id="signup-password" name="password" required autocomplete="new-password" placeholder="At least 12 characters" style="width: 100%; height: 40px; padding: 0 48px 0 14px; border-radius: 8px; border: 1px solid var(--apple-border, #CBD5E1); background: #FFFFFF; color: #0F172A; box-sizing: border-box;">
                <button type="button" class="password-toggle" id="signup-password-toggle" data-password-toggle="signup-password" aria-controls="signup-password" aria-pressed="false" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #64748B; font-size: 0.8rem; font-weight: 600; cursor: pointer; padding: 4px 6px;">Show</button>
              </div>
              <div class="password-requirements" style="display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px; font-size: 0.7rem; color: #64748B;">
                <span class="rule-chip" data-rule="length" style="padding: 2px 7px; border-radius: 10px; background: rgba(0,0,0,0.04); border: 1px solid #E2E8F0;">12+ chars</span>
                <span class="rule-chip" data-rule="upper" style="padding: 2px 7px; border-radius: 10px; background: rgba(0,0,0,0.04); border: 1px solid #E2E8F0;">Uppercase</span>
                <span class="rule-chip" data-rule="lower" style="padding: 2px 7px; border-radius: 10px; background: rgba(0,0,0,0.04); border: 1px solid #E2E8F0;">Lowercase</span>
                <span class="rule-chip" data-rule="number" style="padding: 2px 7px; border-radius: 10px; background: rgba(0,0,0,0.04); border: 1px solid #E2E8F0;">Number</span>
                <span class="rule-chip" data-rule="symbol" style="padding: 2px 7px; border-radius: 10px; background: rgba(0,0,0,0.04); border: 1px solid #E2E8F0;">Symbol</span>
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 16px;">
              <label for="signup-confirm-password" class="auth-field-label" style="display: block; font-size: 0.825rem; font-weight: 600; margin-bottom: 6px; color: var(--apple-text-primary, #1E293B);">Confirm Password</label>
              <div class="password-field" style="position: relative;">
                <input type="password" id="signup-confirm-password" name="confirmPassword" required autocomplete="new-password" placeholder="Re-enter your password" style="width: 100%; height: 40px; padding: 0 48px 0 14px; border-radius: 8px; border: 1px solid var(--apple-border, #CBD5E1); background: #FFFFFF; color: #0F172A; box-sizing: border-box;">
                <button type="button" class="password-toggle" id="signup-confirm-password-toggle" data-password-toggle="signup-confirm-password" aria-controls="signup-confirm-password" aria-pressed="false" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #64748B; font-size: 0.8rem; font-weight: 600; cursor: pointer; padding: 4px 6px;">Show</button>
              </div>
            </div>

            <small class="form-error" id="signup-error" role="alert" style="color: #EF4444; font-size: 0.825rem; margin-bottom: 12px; display: block; min-height: 16px;"></small>

            <button class="apple-btn apple-btn-primary" type="submit" style="width: 100%; height: 44px; border-radius: 10px; font-weight: 600; font-size: 0.95rem; background: var(--apple-blue, #0066FF); color: #FFFFFF; border: none; cursor: pointer; transition: all 0.2s ease;">Create Account</button>
          </form>

          <div class="zappit-login-footer" style="margin-top: 14px; text-align: center; font-size: 0.85rem; color: #64748B;">
            <p>Already have an account? <a href="#" id="back-to-login" style="color: var(--apple-blue, #0066FF); font-weight: 600; text-decoration: none;">Log in</a></p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Toast Alerts Container -->
  <div class="toast-container" id="toast-container"></div>

  <!-- Sticky Mobile Action Pill -->
  <a class="mobile-design-cta" href="#materials">Choose Your Card</a>
</div>
`;

export default function Page() {
  return (
    <>
      <RecoveryRedirect />
      <LegacyPage markup={redesignedMarkup} inlineScript="/js/inline/index.js" />
    </>
  );
}
