import type { Metadata } from 'next';
import LegacyPage from '@/components/layout/LegacyPage';
import RecoveryRedirect from './RecoveryRedirect';

export const metadata: Metadata = {
  title: 'Zappit | One Tap. Your Digital World Connected.',
  description: 'Smart NFC cards, vehicle identification, lost & found solutions, and business tools connected through one powerful platform.',
};

const redesignedMarkup = `
<div class="landing-page">
  <!-- Custom Dynamic Cursor -->
  <div id="custom-cursor-ring" class="custom-cursor-ring"></div>

  <!-- Page Loader -->
  <div class="page-loader" id="page-loader">
    <div class="loader-spinner"></div>
    <div class="loader-logo">
      <img src="/brand/zappit-logo-transparent.png" alt="Zappit logo" class="loader-logo-img" width="140" height="48">
    </div>
  </div>

  <!-- Floating Glass Navbar (Reference Design) -->
  <header class="navbar-wrapper" id="navbar-wrapper">
    <div class="navbar-glow-indicator" id="navbar-scroll-indicator" aria-hidden="true"></div>
    <nav class="navbar" id="main-navbar" aria-label="Main Navigation">
      <div class="navbar-container">
        <!-- Rounded Logo Container on Left -->
        <div class="logo-capsule">
          <a href="/" class="logo logo-img-link" aria-label="Zappit Homepage">
            <img src="/brand/zappit-logo-transparent.png" alt="Zappit" class="brand-logo" width="102" height="30">
          </a>
        </div>
        
        <!-- Navigation items grouped inside one light-grey rounded capsule in Center -->
        <ul class="nav-menu" id="nav-menu">
          <li><a href="/" class="nav-link active">Home</a></li>
          <li><a href="#materials" class="nav-link">Materials</a></li>
          <li><a href="#profile-experience" class="nav-link">Digital Profile</a></li>
          <li><a href="#how-it-works" class="nav-link">How It Works</a></li>
          <li><a href="#card-configurator" class="nav-link">Card Studio</a></li>
          <li><a href="#featured-categories-section" class="nav-link">Shop</a></li>
          <li class="nav-dashboard-link"><a href="/dashboard" class="nav-link">Dashboard</a></li>
        </ul>
        
        <!-- Properly Separated Controls on Right -->
        <div class="nav-actions">
          <!-- Wishlist Trigger with Dynamic Badge -->
          <button class="btn-icon" id="wishlist-trigger" type="button" title="Wishlist" aria-label="Open wishlist">
            <i data-lucide="heart" style="width: 17px; height: 17px;"></i>
            <span class="badge-count wishlist-count-badge">0</span>
          </button>
          
          <!-- Shopping Bag Trigger with Dynamic Badge -->
          <button class="btn-icon" id="cart-trigger" type="button" title="Shopping Cart" aria-label="Open shopping cart">
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
          <a class="nav-design-cta" id="nav-design-cta" href="#card-configurator">Design Your Card</a>
          
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
            One Tap.<br>
            Your Digital<br>
            World<br>
            <span class="hero-headline-accent">Connected.</span>
          </h1>
          <p class="hero-subtitle">
            Smart NFC cards, vehicle identification, lost &amp; found solutions, and business tools connected through one powerful platform.
          </p>

          <div class="hero-cta-group">
            <a href="#card-configurator" class="apple-btn apple-btn-primary">Design Your Card</a>
            <button class="apple-btn apple-btn-glass" id="tap-demo-trigger" type="button" onclick="document.getElementById('tap-card')?.click()">
              <i data-lucide="zap" style="width: 16px; height: 16px; margin-right: 4px;"></i>
              Try the Tap Demo
            </button>
          </div>
        </div>

        <!-- Right Product Visual Column (~48%) -->
        <div class="hero-visual-col">
          <div class="nfc-card-scene" aria-label="Two overlapping Zappit NFC smart cards">
            <!-- Rear Card (Tilted slightly back-right, elevated) -->
            <div class="nfc-card nfc-card-back" aria-hidden="true">
              <div class="nfc-card-shine"></div>
              <div class="nfc-card-top-row">
                <div class="nfc-card-identity">
                  <div class="nfc-card-name">Your Name</div>
                  <div class="nfc-card-subtitle">Sub Heading</div>
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

            <!-- Front Card (Lower, left-shifted, overlapping with z-index: 2, interactive tap card) -->
            <button class="nfc-card nfc-card-front tap-card" id="tap-card" type="button" aria-label="Simulate tapping Zappit NFC card">
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
                  <div class="nfc-card-name">Your Name</div>
                  <div class="nfc-card-subtitle">CEO &amp; Founder</div>
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
          <span>Laser-Engraved QR Backup</span>
        </div>
        <div class="hero-pill-item">
          <i data-lucide="smartphone"></i>
          <span>No App or Download Required</span>
        </div>
        <div class="hero-pill-item">
          <i data-lucide="refresh-cw"></i>
          <span>Unlimited Cloud Profile Updates</span>
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
          <p>Every card features a high-frequency NFC antenna paired with a high-contrast QR code backup for complete phone compatibility.</p>
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
          <h3>Pre-Dispatch Tested</h3>
          <p>Every single card is individually signal-tested for NFC resonance and print fidelity before it leaves our workshop.</p>
        </article>
      </div>
    </div>
  </section>

  <!-- Materials & Hardware Craftsmanship -->
  <section class="apple-materials" id="materials" aria-labelledby="materials-title">
    <div class="container">
      <div class="section-intro">
        <span class="section-eyebrow">Precision Engineering</span>
        <h2 class="section-title" id="materials-title">Crafted for presence. Finished with restraint.</h2>
        <p class="section-desc">Two distinct tactile materials designed to feel substantial, durable, and unmistakably premium in any professional exchange.</p>
      </div>

      <div class="materials-grid">
        <!-- Matte Black PVC -->
        <article class="material-card">
          <div class="material-img-wrap">
            <img src="/assets/black-pvc-card.jpg" alt="Zappit Velvet Matte Black PVC smart card" class="material-img" loading="lazy">
          </div>
          <div class="material-body">
            <span class="material-badge">Best Seller</span>
            <h3>Velvet Matte Black PVC</h3>
            <p>Deep obsidian polymer treated with a soft-touch micro-texture and chamfered edges. Scratch-resistant, waterproof, and equipped with a full-surface NFC antenna.</p>
            <div class="material-footer">
              <div class="material-price">₹899 <small>incl. 1-year profile</small></div>
              <a href="#card-configurator" class="apple-btn apple-btn-glass" onclick="document.querySelector('[data-material=\\'Matte Black PVC\\']')?.click()">Customize Black</a>
            </div>
          </div>
        </article>

        <!-- Minimalist White PVC -->
        <article class="material-card">
          <div class="material-img-wrap">
            <img src="/assets/white-pvc-card.jpg" alt="Zappit Minimalist Ceramic White PVC smart card" class="material-img" loading="lazy">
          </div>
          <div class="material-body">
            <span class="material-badge">Minimalist</span>
            <h3>Ceramic White PVC</h3>
            <p>Pristine ceramic white aesthetic with laser-precise typography and ultra-durable composite core. Clean, architectural, and timeless in every setting.</p>
            <div class="material-footer">
              <div class="material-price">₹799 <small>incl. 1-year profile</small></div>
              <a href="#card-configurator" class="apple-btn apple-btn-glass" onclick="document.querySelector('[data-material=\\'White PVC\\']')?.click()">Customize White</a>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>

  <!-- Digital Profile Experience -->
  <section class="apple-experience" id="profile-experience" aria-labelledby="experience-title">
    <div class="container">
      <div class="section-intro">
        <span class="section-eyebrow">The Digital Ecosystem</span>
        <h2 class="section-title" id="experience-title">More than a business card. Your complete presence.</h2>
        <p class="section-desc">Turn a single tap into permanent client relationships, booked appointments, and immediate customer conversations.</p>
      </div>

      <div class="experience-bento">
        <!-- Contact Save -->
        <article class="bento-card">
          <div class="bento-icon">
            <i data-lucide="user-plus"></i>
          </div>
          <h3>One-Tap Contact Save</h3>
          <p>Recipients can download your verified .vcf contact card straight to their phone address book with a single tap.</p>
        </article>

        <!-- WhatsApp Integration -->
        <article class="bento-card">
          <div class="bento-icon">
            <i data-lucide="message-circle"></i>
          </div>
          <h3>WhatsApp Quick Chat</h3>
          <p>Pre-configure a greeting message so new leads and partners can initiate direct WhatsApp conversations instantly.</p>
        </article>

        <!-- Digital Wallet -->
        <article class="bento-card">
          <div class="bento-icon">
            <i data-lucide="wallet"></i>
          </div>
          <h3>Apple & Google Wallet</h3>
          <p>Keep a digital backup pass saved inside Apple Wallet or Google Wallet ready to display whenever your card is in your bag.</p>
        </article>

        <!-- Catalogue & Booking (Wide) -->
        <article class="bento-card bento-card-wide">
          <div class="bento-icon">
            <i data-lucide="calendar"></i>
          </div>
          <h3>Appointment Booking & Service Catalogue</h3>
          <p>Embed your Calendly, Google Calendar, or service pricing directly on your profile page so prospects can book meetings or review your offerings immediately after meeting you.</p>
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
          <h3>Design and customise</h3>
          <p>Select your card material, background tones, and typography in our Studio Configurator below, then preview your design live.</p>
        </article>

        <article class="step-item">
          <span class="step-number">02</span>
          <h3>Build your profile</h3>
          <p>Sign in to your Zappit Dashboard to add contact numbers, social links, portfolio images, and custom action buttons.</p>
        </article>

        <article class="step-item">
          <span class="step-number">03</span>
          <h3>Tap, share & connect</h3>
          <p>Hold your card to any compatible iPhone or Android. Your digital profile opens instantly in their browser with zero app installation.</p>
        </article>
      </div>
    </div>
  </section>

  <!-- Guided Card Studio Configurator -->
  <section class="section-padding guided-configurator" id="card-configurator" aria-labelledby="configurator-title">
    <div class="container">
      <div class="section-intro">
        <span class="section-eyebrow">Interactive Studio</span>
        <h2 class="section-title" id="configurator-title">Design Your Zappit Card</h2>
        <p class="section-desc">Build your print-ready premium NFC card in five simple steps with real-time 3D preview.</p>
      </div>

      <div class="designer-progress">
        <div>
          <span id="designer-step-label">Step 1 of 5 — Choose Your Material</span>
          <b id="designer-progress-bar" style="width: 20%;"></b>
        </div>
      </div>

      <div class="designer-layout">
        <!-- Live Card Preview Column -->
        <aside class="designer-preview">
          <div class="preview-toolbar">
            <button class="active" data-card-side="front" type="button">Front</button>
            <button data-card-side="back" type="button">Back</button>
            <button id="rotate-config-card" type="button">Flip Card</button>
          </div>

          <div class="configurator-preview">
            <div class="config-card" id="config-card" data-side="front">
              <div class="print-safe-area"></div>
              <div class="config-front">
                <div class="config-logo" id="config-logo"></div>
                <div class="config-nfc" id="config-nfc">)))</div>
                <div class="config-person">
                  <div class="nfc-card-name">Your Name</div>
                  <div class="nfc-card-subtitle">Your Designation</div>
                  <div class="config-company">Your Company</div>
                </div>
              </div>
              <div class="config-back">
                <div class="config-qr" id="config-qr"><span></span><span></span><span></span><span></span><b>QR</b></div>
                <p style="font-size: 0.75rem; text-align: center; margin-top: 8px; opacity: 0.8;">Scan to connect</p>
              </div>
            </div>
          </div>

          <div class="preview-quick-info">
            <label>Name on card
              <input id="quick-card-name" maxlength="32" placeholder="Enter your name">
            </label>
            <label>Designation
              <input id="quick-card-title" maxlength="38" placeholder="Enter your designation">
            </label>
            <label>Company
              <input id="quick-card-company" maxlength="38" placeholder="Enter your company">
            </label>
          </div>

          <div class="design-warning" id="design-warning" hidden></div>
        </aside>

        <!-- Stepped Controls Column -->
        <div class="designer-controls">
          <!-- Step 1: Material -->
          <div class="designer-step active" data-step="1">
            <span class="step-kicker">Step 1</span>
            <h3>Choose Your Material</h3>
            <div class="material-grid">
              <button class="material-option active" data-material="White PVC" data-price="799" type="button">
                <div>
                  <strong>White Minimalist PVC</strong>
                  <div style="font-size: 0.8rem; opacity: 0.75;">Clean and durable ceramic finish</div>
                </div>
                <b>₹799</b>
              </button>
              <button class="material-option" data-material="Matte Black PVC" data-price="899" type="button">
                <div>
                  <strong>Matte Black PVC</strong>
                  <div style="font-size: 0.8rem; opacity: 0.75;">Soft-touch velvet premium finish</div>
                </div>
                <b>+₹100</b>
              </button>
              <button class="material-option" data-material="Stainless Steel" data-price="1999" type="button" disabled aria-disabled="true">
                <div>
                  <strong>Stainless Steel</strong>
                  <div style="font-size: 0.8rem; opacity: 0.75;">Maximum weight and presence</div>
                </div>
                <b style="color: var(--apple-text-tertiary);">Out of stock</b>
              </button>
            </div>
          </div>

          <!-- Step 2: Color and Finish -->
          <div class="designer-step" data-step="2">
            <span class="step-kicker">Step 2</span>
            <h3>Colour and Finish</h3>
            <div class="preset-grid">
              <button class="colour-preset active" data-bg="#070D19" data-text="#FFFFFF" data-border="#0066FF" data-accent="#38BDF8" type="button">
                <i style="--a:#070D19;--b:#0066FF"></i>Apple Midnight
              </button>
              <button class="colour-preset" data-bg="#0A0A0A" data-text="#E5E7EB" data-border="#334155" data-accent="#94A3B8" type="button">
                <i style="--a:#0A0A0A;--b:#94A3B8"></i>Stealth Graphite
              </button>
              <button class="colour-preset" data-bg="#041E42" data-text="#FFFFFF" data-border="#0066FF" data-accent="#38BDF8" type="button">
                <i style="--a:#041E42;--b:#0066FF"></i>Deep Royal Navy
              </button>
              <button class="colour-preset" data-bg="#181818" data-text="#C47A44" data-border="#A85D32" data-accent="#E0A06F" type="button">
                <i style="--a:#181818;--b:#C47A44"></i>Charcoal &amp; Copper
              </button>
              <button class="colour-preset" data-bg="#F8FAFC" data-text="#0F172A" data-border="#CBD5E1" data-accent="#0066FF" type="button">
                <i style="--a:#F8FAFC;--b:#0F172A"></i>Ceramic White
              </button>
              <button class="colour-preset" data-bg="#052E26" data-text="#E5E7EB" data-border="#059669" data-accent="#10B981" type="button">
                <i style="--a:#052E26;--b:#10B981"></i>Emerald Studio
              </button>
            </div>
            <div class="advanced-colours" style="display: flex; gap: 16px; margin-top: 16px;">
              <label style="font-size: 0.8rem; font-weight: 600;">Custom Background <input id="custom-card-bg" type="color" value="#070D19" style="height: 36px; padding: 0 4px;"></label>
              <label style="font-size: 0.8rem; font-weight: 600;">Custom Text <input id="custom-card-text" type="color" value="#FFFFFF" style="height: 36px; padding: 0 4px;"></label>
              <label style="font-size: 0.8rem; font-weight: 600;">Finish 
                <select id="card-finish" style="height: 36px; padding: 0 10px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid var(--apple-border); color: inherit;">
                  <option>Matte</option>
                  <option>Glossy</option>
                  <option>Brushed</option>
                </select>
              </label>
            </div>
          </div>

          <!-- Step 3: Information -->
          <div class="designer-step" data-step="3">
            <span class="step-kicker">Step 3</span>
            <h3>Card Typography & Details</h3>
            <div class="config-fields">
              <label>Full Name <input id="card-name-input" maxlength="32" placeholder="Your name"></label>
              <label>Professional Designation <input id="card-title-input" maxlength="38" placeholder="Your designation"></label>
              <label>Company or Brand <input id="card-company-input" maxlength="38" placeholder="Your company"></label>
              <label>Typography Style 
                <select id="card-font">
                  <option value="minimal">Minimal Professional (Inter)</option>
                  <option value="modern">Modern Geometric (Outfit)</option>
                  <option value="editorial">Luxury Editorial</option>
                  <option value="classic">Classic Serif</option>
                </select>
              </label>
            </div>
          </div>

          <!-- Step 4: Logo & QR Layout -->
          <div class="designer-step" data-step="4">
            <span class="step-kicker">Step 4</span>
            <h3>Logo and QR Layout</h3>
            <div style="margin-bottom: 20px;">
              <input id="card-logo-upload" type="file" accept=".png,.jpg,.jpeg,image/png,image/jpeg" style="display: none;">
              <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 8px;">
                <label for="card-logo-upload" class="apple-btn apple-btn-glass" style="font-size: 0.85rem; padding: 8px 16px;">
                  <i data-lucide="upload" style="width: 14px; height: 14px;"></i> Upload Logo
                </label>
                <button id="remove-card-logo" type="button" class="text-action">Remove Logo</button>
              </div>
              <p style="font-size: 0.775rem; color: var(--apple-text-tertiary); margin: 0;">Supports high-res PNG or JPG up to 2 MB.</p>
            </div>

            <div class="config-fields">
              <label>Logo Placement 
                <select id="logo-placement">
                  <option>Top left</option>
                  <option>Top centre</option>
                  <option>Centre</option>
                </select>
              </label>
              <label>QR Code Placement 
                <select id="qr-placement">
                  <option>Back centre</option>
                  <option>Back left</option>
                  <option>Back right</option>
                </select>
              </label>
              <label style="flex-direction: row; align-items: center; gap: 10px; cursor: pointer; margin-top: 6px;">
                <input id="nfc-symbol-toggle" type="checkbox" checked style="width: 18px; height: 18px; accent-color: var(--apple-blue);">
                <span>Show contactless NFC symbol</span>
              </label>
            </div>
          </div>

          <!-- Step 5: Review & Order -->
          <div class="designer-step" data-step="5">
            <span class="step-kicker">Step 5</span>
            <h3>Review and Order</h3>
            <div class="package-summary" style="margin-bottom: 20px;">
              <h4 style="font-size: 0.95rem; margin-bottom: 10px; color: var(--apple-text-primary);">Included in your order:</h4>
              <ul id="package-list" style="padding-left: 20px; font-size: 0.875rem; color: var(--apple-text-secondary); line-height: 1.6;"></ul>
            </div>

            <label style="display: flex; gap: 12px; padding: 14px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid var(--apple-border); cursor: pointer; margin-bottom: 20px;">
              <input id="expert-design" type="checkbox" style="width: 18px; height: 18px; accent-color: var(--apple-blue); margin-top: 2px;">
              <span>
                <strong style="display: block; font-size: 0.9rem; color: var(--apple-text-primary);">Let Our In-House Designer Assist</strong>
                <small style="font-size: 0.8rem; color: var(--apple-text-secondary);">Upload your brand assets. Our design team will prepare a refined print concept for your approval. (+₹499)</small>
              </span>
            </label>

            <div style="font-size: 0.8rem; color: var(--apple-text-secondary); display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <span>✓ NFC tested before delivery</span>
              <span>✓ High-contrast QR fallback</span>
              <span>✓ Design preview confirmed</span>
              <span>✓ Direct replacement guarantee</span>
            </div>
          </div>

          <!-- Live Price Display -->
          <div class="live-price">
            <h4>Live Price Summary</h4>
            <dl>
              <div>
                <dt id="price-material-name">White PVC Card</dt>
                <dd id="price-material">₹799</dd>
              </div>
              <div>
                <dt>Double-sided printing</dt>
                <dd>Included</dd>
              </div>
              <div>
                <dt>Custom logo engraving</dt>
                <dd>Included</dd>
              </div>
              <div>
                <dt>1-Year Digital Profile</dt>
                <dd>₹499</dd>
              </div>
              <div id="expert-price-row" hidden>
                <dt>Expert design service</dt>
                <dd>₹499</dd>
              </div>
              <div class="price-total">
                <dt>Total</dt>
                <dd id="config-total">₹1,298</dd>
              </div>
            </dl>
          </div>

          <!-- Actions -->
          <div class="designer-actions">
            <button id="designer-prev" class="apple-btn apple-btn-glass" type="button" disabled>Back</button>
            <button id="save-design-draft" class="text-action" type="button">Save Draft</button>
            <button id="reset-card-design" class="text-action" type="button">Reset</button>
            <button id="designer-next" class="apple-btn apple-btn-primary" type="button">Continue &rarr;</button>
            <button id="save-card-design" class="apple-btn apple-btn-primary" type="button" hidden>Add to Cart</button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Product Lineup & Hardware Showcase -->
  <section class="apple-shop" id="featured-categories-section" aria-labelledby="shop-title">
    <div class="container">
      <div class="section-intro">
        <span class="section-eyebrow">Product Lineup</span>
        <h2 class="section-title" id="shop-title">Engineered for seamless networking.</h2>
        <p class="section-desc">Choose a premium NFC card, keytag, or QR solution for yourself or your entire team.</p>
      </div>

      <div class="shop-grid">
        <!-- 1. Premium NFC Cards -->
        <article class="shop-card">
          <div class="shop-card-img-wrap">
            <img src="/assets/black-pvc-card.jpg" alt="Premium NFC Business Cards" class="shop-card-img" loading="lazy">
          </div>
          <h3>Premium NFC Cards</h3>
          <p>Luxury double-sided business cards that share your verified contact profile with a single tap.</p>
          <div class="shop-card-meta">
            <span class="shop-card-price">₹1,499</span>
            <button 
              class="apple-btn apple-btn-primary buy-featured-product" 
              data-product-id="nfc-card" 
              data-product-name="Premium NFC Cards" 
              data-product-price="1499" 
              data-product-image="/assets/black-pvc-card.jpg"
              type="button"
            >Buy Now</button>
          </div>
        </article>

        <!-- 2. Smart NFC Keytags -->
        <article class="shop-card">
          <div class="shop-card-img-wrap">
            <img src="/assets/cards/luxcards.svg" alt="Smart NFC Keytags" class="shop-card-img" loading="lazy">
          </div>
          <h3>Smart NFC Keytags</h3>
          <p>Compact, durable keytag for on-the-go contact sharing, review links, and digital access.</p>
          <div class="shop-card-meta">
            <span class="shop-card-price">₹799</span>
            <button 
              class="apple-btn apple-btn-glass buy-featured-product" 
              data-product-id="nfc-keytag" 
              data-product-name="Smart NFC Keytags" 
              data-product-price="799" 
              data-product-image="/assets/cards/luxcards.svg"
              type="button"
              disabled
              aria-disabled="true"
            >Out of Stock</button>
          </div>
        </article>

        <!-- 3. Custom QR Tags -->
        <article class="shop-card">
          <div class="shop-card-img-wrap">
            <img src="/assets/cards/luxcards.svg" alt="Custom QR Tags" class="shop-card-img" loading="lazy">
          </div>
          <h3>Custom QR Tags</h3>
          <p>Weatherproof high-contrast QR tags that open your portfolio from any camera-enabled phone.</p>
          <div class="shop-card-meta">
            <span class="shop-card-price">₹499</span>
            <button 
              class="apple-btn apple-btn-glass buy-featured-product" 
              data-product-id="qr-tag" 
              data-product-name="Custom QR Tags" 
              data-product-price="499" 
              data-product-image="/assets/cards/luxcards.svg"
              type="button"
              disabled
              aria-disabled="true"
            >Out of Stock</button>
          </div>
        </article>

        <!-- 4. Lost & Found Tags -->
        <article class="shop-card">
          <div class="shop-card-img-wrap">
            <img src="/assets/cards/luxcards.svg" alt="Lost & Found QR Tags" class="shop-card-img" loading="lazy">
          </div>
          <h3>Lost &amp; Found QR Tags</h3>
          <p>Private tags that help finders return your valuables through secure anonymous messaging.</p>
          <div class="shop-card-meta">
            <span class="shop-card-price">₹349</span>
            <button 
              class="apple-btn apple-btn-glass buy-featured-product" 
              data-product-id="lost-found-tag" 
              data-product-name="Lost & Found QR Tags" 
              data-product-price="349" 
              data-product-image="/assets/cards/luxcards.svg"
              type="button"
              disabled
              aria-disabled="true"
            >Out of Stock</button>
          </div>
        </article>
      </div>
    </div>
  </section>

  <!-- Final Call to Action -->
  <section class="apple-final-cta" aria-labelledby="cta-headline">
    <div class="final-cta-container">
      <h2 class="final-cta-headline" id="cta-headline">Make an impression that lasts.</h2>
      <p class="final-cta-desc">Engineered with aerospace-grade composite materials and high-speed NFC technology. Delivered ready to tap.</p>
      <div style="display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;">
        <a href="#card-configurator" class="apple-btn apple-btn-primary" style="font-size: 1.05rem; padding: 16px 36px;">Design Your Card</a>
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
            <li><a href="#featured-categories-section">NFC Business Cards</a></li>
            <li><a href="#featured-categories-section">Smart NFC Keytags</a></li>
            <li><a href="#card-configurator">Card Customizer Studio</a></li>
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
  <div class="drawer-overlay" id="drawer-overlay"></div>

  <!-- Wishlist Drawer -->
  <div class="drawer glass-solid" id="wishlist-drawer">
    <div class="drawer-header">
      <h3>My Wishlist (<span class="wishlist-count-badge">0</span>)</h3>
      <button class="drawer-close" type="button" aria-label="Close wishlist panel"><i data-lucide="x"></i></button>
    </div>
    <div class="drawer-body" id="wishlist-items"></div>
    <div class="drawer-footer">
      <button class="apple-btn apple-btn-primary" onclick="document.querySelector('#featured-categories-section')?.scrollIntoView({behavior: 'smooth'}); document.querySelector('#wishlist-drawer .drawer-close')?.click();" style="width: 100%;">Explore More Cards</button>
    </div>
  </div>

  <!-- Cart Drawer -->
  <div class="drawer glass-solid" id="cart-drawer">
    <div class="drawer-header">
      <h3>My Cart (<span class="cart-count-badge">0</span>)</h3>
      <button class="drawer-close" type="button" aria-label="Close shopping cart panel"><i data-lucide="x"></i></button>
    </div>
    <div class="drawer-body" id="cart-items"></div>
    <div class="drawer-footer">
      <div class="drawer-total" style="display: flex; justify-content: space-between; margin-bottom: 16px; font-weight: 700; font-size: 1.15rem;">
        <span>Total:</span>
        <span id="cart-total-price">&#8377;0</span>
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
            <div class="form-group" style="margin-bottom: 16px;">
              <label for="login-email" style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px;">Email Address</label>
              <input type="email" id="login-email" required placeholder="name@domain.com" autocomplete="email" style="width: 100%; height: 42px; padding: 0 14px; border-radius: 8px; border: 1px solid var(--apple-border); background: rgba(255,255,255,0.04); color: inherit;">
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label for="login-password" style="font-size: 0.85rem; font-weight: 600; margin: 0;">Password</label>
                <a href="/reset-password" class="forgot-password-link" style="font-size: 0.8rem; color: var(--apple-sky); text-decoration: none;">Forgot password?</a>
              </div>
              <div class="password-field" style="position: relative;">
                <input type="password" id="login-password" required autocomplete="current-password" placeholder="••••••••" style="width: 100%; height: 42px; padding: 0 45px 0 14px; border-radius: 8px; border: 1px solid var(--apple-border); background: rgba(255,255,255,0.04); color: inherit;">
                <button type="button" class="password-toggle" id="login-password-toggle" aria-controls="login-password" aria-pressed="false" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; color: var(--apple-text-tertiary); font-size: 0.75rem; cursor: pointer;">Show</button>
              </div>
            </div>

            <small class="form-error" id="login-error" role="alert" style="color: #EF4444; margin-bottom: 12px; display: block;"></small>

            <button class="apple-btn apple-btn-primary" type="submit" style="width: 100%; padding: 13px;">Login Securely</button>
          </form>

          <div class="zappit-login-footer" style="margin-top: 20px; text-align: center; font-size: 0.85rem; color: var(--apple-text-secondary);">
            <p>Don't have an account? <a href="#" id="signup-trigger" style="color: var(--apple-blue); font-weight: 600;">Sign up</a></p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Forgot Password Modal -->
  <div class="modal-overlay" id="forgot-password-modal" aria-hidden="true">
    <div class="modal-card glass-solid" role="dialog" aria-modal="true" aria-labelledby="forgot-password-title">
      <button class="modal-close" type="button" aria-label="Close forgot password"><i data-lucide="x"></i></button>
      <div class="modal-header">
        <h3 id="forgot-password-title">Reset your password</h3>
        <p>We'll email you a secure link to choose a new password.</p>
      </div>
      <form id="forgot-password-form">
        <div class="form-group">
          <label for="forgot-password-email">Email Address</label>
          <input type="email" id="forgot-password-email" required autocomplete="email" placeholder="name@domain.com">
        </div>
        <small class="form-error" id="forgot-password-error" role="alert"></small>
        <button class="apple-btn apple-btn-primary" type="submit" style="width:100%">Send reset link</button>
      </form>
      <div class="modal-footer"><p><a href="#" id="forgot-back-to-login">Back to login</a></p></div>
    </div>
  </div>

  <!-- Toast Alerts Container -->
  <div class="toast-container" id="toast-container"></div>

  <!-- Sticky Mobile Action Pill -->
  <a class="mobile-design-cta" href="#card-configurator">Design Your Card</a>
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
