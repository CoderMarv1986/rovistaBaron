/**
 * ROVISTA BARON GLOBAL - Core Client Script
 * 
 * All data is loaded dynamically from external JSON files:
 * - packages.json: Tour packages dataset (title, country, baseRate, discountRate, duration, etc.)
 * - highlights.json: Latest promotional offers and flash discounts for the carousel
 * 
 * Features:
 * - Dynamic asynchronous fetch for packages.json and highlights.json
 * - Interactive carousel with autoplay, pause on hover, navigation arrows, dots, and touch-swipe
 * - Real-time multi-criteria package filter & search engine (Country, Budget slider, Discount %, Search keyword, Sort)
 * - Responsive mobile navigation drawer with smooth scrolling and accessible focus
 * - Interactive Package Details Modal with direct WhatsApp booking action
 * - Dynamic WhatsApp Contact Inquiry generator with live message preview
 * - Persistent floating WhatsApp concierge widget
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global Application State (Loaded dynamically from JSON)
  let packagesData = [];
  let highlightsData = [];
  let currentFilter = {
    search: '',
    country: 'all',
    maxBudget: 7500,
    minDiscount: 0,
    sortBy: 'featured'
  };

  // WhatsApp Hotline Configuration
  const WHATSAPP_PHONE = '18007684782';

  /* --------------------------------------------------------------------------
     1. Navigation, Sticky Header & Smooth Scrolling
     -------------------------------------------------------------------------- */
  const siteHeader = document.getElementById('site-header');
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const mobileDrawer = document.getElementById('mobile-drawer');
  const mobileOverlay = document.getElementById('mobile-overlay');
  const mobileCloseBtn = document.getElementById('mobile-close-btn');
  const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');

  // Sticky header on scroll
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      siteHeader.classList.add('scrolled');
    } else {
      siteHeader.classList.remove('scrolled');
    }
  }, { passive: true });

  // Open Mobile Drawer
  function openMobileMenu() {
    hamburgerBtn.classList.add('active');
    hamburgerBtn.setAttribute('aria-expanded', 'true');
    mobileDrawer.classList.add('open');
    mobileDrawer.setAttribute('aria-hidden', 'false');
    mobileOverlay.classList.add('open');
    mobileOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  // Close Mobile Drawer
  function closeMobileMenu() {
    hamburgerBtn.classList.remove('active');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    mobileDrawer.classList.remove('open');
    mobileDrawer.setAttribute('aria-hidden', 'true');
    mobileOverlay.classList.remove('open');
    mobileOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', () => {
      const isOpen = mobileDrawer.classList.contains('open');
      if (isOpen) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });
  }

  if (mobileCloseBtn) {
    mobileCloseBtn.addEventListener('click', closeMobileMenu);
  }

  if (mobileOverlay) {
    mobileOverlay.addEventListener('click', closeMobileMenu);
  }

  // Smooth Scrolling & Auto-Close Mobile Menu
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        closeMobileMenu();

        // Calculate offset position for header
        const headerOffset = 75;
        const elementPosition = targetEl.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });

        // Set focus for accessibility without jumping
        targetEl.setAttribute('tabindex', '-1');
        targetEl.focus({ preventScroll: true });

        // Update active class on desktop nav
        navLinks.forEach(link => {
          if (link.getAttribute('href') === targetId) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      }
    });
  });

  // Footer country link handler
  document.querySelectorAll('.footer-links a[data-country]').forEach(item => {
    item.addEventListener('click', function(e) {
      e.preventDefault();
      const country = this.getAttribute('data-country');
      const countryFilter = document.getElementById('country-filter');
      if (countryFilter) {
        countryFilter.value = country;
        currentFilter.country = country;
        applyFilters();
      }
      const packagesSection = document.getElementById('packages-section');
      if (packagesSection) {
        packagesSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  /* --------------------------------------------------------------------------
     2. Highlights / Latest Offers Carousel Engine (Loaded from highlights.json)
     -------------------------------------------------------------------------- */
  const carouselTrack = document.getElementById('carousel-track');
  const carouselPrevBtn = document.getElementById('carousel-prev');
  const carouselNextBtn = document.getElementById('carousel-next');
  const carouselIndicators = document.getElementById('carousel-indicators');
  const carouselContainer = document.getElementById('carousel-container');

  let currentSlideIndex = 0;
  let carouselAutoPlayTimer = null;
  let touchStartX = 0;
  let touchEndX = 0;

  async function loadHighlights() {
    try {
      const response = await fetch('./highlights.json');
      if (!response.ok) {
        throw new Error(`Failed to load highlights.json: HTTP ${response.status}`);
      }
      highlightsData = await response.json();
      renderCarouselSlides();
      initCarouselControls();
    } catch (err) {
      console.error('Error fetching highlights.json:', err);
      if (carouselTrack) {
        carouselTrack.innerHTML = `
          <div class="carousel-loading" style="padding: 60px 20px;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; color: var(--gold-light); margin-bottom: 12px; display: block;"></i>
            <p style="color: var(--text-primary); font-weight: 600;">Unable to load offers from highlights.json</p>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 6px;">Please ensure highlights.json is present and served via a local web server.</p>
          </div>
        `;
      }
    }
  }

  function renderCarouselSlides() {
    if (!carouselTrack) return;
    carouselTrack.innerHTML = '';
    carouselIndicators.innerHTML = '';

    if (!highlightsData || highlightsData.length === 0) {
      carouselTrack.innerHTML = '<div class="carousel-loading"><p>No current highlights available in highlights.json.</p></div>';
      return;
    }

    highlightsData.forEach((offer, index) => {
      // Build Slide Element
      const slide = document.createElement('div');
      slide.className = 'carousel-slide';
      slide.setAttribute('role', 'group');
      slide.setAttribute('aria-roledescription', 'slide');
      slide.setAttribute('aria-label', `${index + 1} of ${highlightsData.length}: ${offer.title}`);

      // Encode prefilled WhatsApp inquiry message
      const offerMessage = encodeURIComponent(
        `Hello Rovista Baron Global! I would like to claim the Flash Offer: "${offer.title}" (${offer.country}) at the discounted privilege rate of $${Number(offer.discountRate).toLocaleString()} (${offer.discountPercent}% OFF). Please share the booking availability and itinerary details.`
      );
      const whatsappOfferUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${offerMessage}`;

      slide.innerHTML = `
        <img src="${offer.image}" alt="${offer.title}" class="carousel-slide-bg" loading="${index === 0 ? 'eager' : 'lazy'}">
        <div class="carousel-slide-overlay"></div>
        <div class="carousel-slide-content">
          <div class="carousel-badges-row">
            <span class="slide-badge-discount">${offer.badge}</span>
            <span class="slide-badge-country"><i class="fa-solid fa-location-dot"></i> ${offer.country}</span>
            <span class="slide-badge-validity"><i class="fa-regular fa-clock"></i> ${offer.validUntil}</span>
          </div>
          <h3 class="carousel-slide-title">${offer.title}</h3>
          <p class="carousel-slide-tagline">${offer.tagline}</p>
          <p class="carousel-slide-desc">${offer.description}</p>
          <div class="carousel-slide-bottom">
            <div class="carousel-price-wrapper">
              <span class="carousel-base-price">$${Number(offer.baseRate).toLocaleString()}</span>
              <span class="carousel-deal-price">$${Number(offer.discountRate).toLocaleString()}</span>
              <span class="carousel-per-person">/ person (${offer.duration})</span>
            </div>
            <div class="carousel-actions">
              <a href="${whatsappOfferUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp">
                <i class="fa-brands fa-whatsapp"></i> Claim Offer on WhatsApp
              </a>
              <button type="button" class="btn btn-outline-glass slide-details-btn" data-pkg-id="${offer.packageId}">
                <i class="fa-solid fa-eye"></i> View Tour Details
              </button>
            </div>
          </div>
        </div>
      `;

      carouselTrack.appendChild(slide);

      // Create Indicator Dot
      const dot = document.createElement('button');
      dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
      dot.setAttribute('aria-label', `Go to slide ${index + 1}`);
      dot.addEventListener('click', () => {
        goToSlide(index);
        restartAutoplay();
      });
      carouselIndicators.appendChild(dot);
    });

    // Attach "View Tour Details" button listeners on slides
    document.querySelectorAll('.slide-details-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const pkgId = this.getAttribute('data-pkg-id');
        openPackageModal(pkgId);
      });
    });

    updateCarouselView();
  }

  function goToSlide(index) {
    if (!highlightsData || highlightsData.length === 0) return;
    if (index < 0) {
      currentSlideIndex = highlightsData.length - 1;
    } else if (index >= highlightsData.length) {
      currentSlideIndex = 0;
    } else {
      currentSlideIndex = index;
    }
    updateCarouselView();
  }

  function updateCarouselView() {
    if (!carouselTrack) return;
    carouselTrack.style.transform = `translateX(-${currentSlideIndex * 100}%)`;

    // Update dots
    const dots = carouselIndicators.querySelectorAll('.carousel-dot');
    dots.forEach((dot, idx) => {
      if (idx === currentSlideIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

  function startAutoplay() {
    stopAutoplay();
    carouselAutoPlayTimer = setInterval(() => {
      goToSlide(currentSlideIndex + 1);
    }, 5500);
  }

  function stopAutoplay() {
    if (carouselAutoPlayTimer) {
      clearInterval(carouselAutoPlayTimer);
      carouselAutoPlayTimer = null;
    }
  }

  function restartAutoplay() {
    startAutoplay();
  }

  function initCarouselControls() {
    if (carouselPrevBtn) {
      carouselPrevBtn.addEventListener('click', () => {
        goToSlide(currentSlideIndex - 1);
        restartAutoplay();
      });
    }

    if (carouselNextBtn) {
      carouselNextBtn.addEventListener('click', () => {
        goToSlide(currentSlideIndex + 1);
        restartAutoplay();
      });
    }

    // Pause on hover
    if (carouselContainer) {
      carouselContainer.addEventListener('mouseenter', stopAutoplay);
      carouselContainer.addEventListener('mouseleave', startAutoplay);

      // Touch / Swipe gestures for mobile
      carouselContainer.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      carouselContainer.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipeGesture();
      }, { passive: true });
    }

    startAutoplay();
  }

  function handleSwipeGesture() {
    const swipeThreshold = 40;
    if (touchEndX < touchStartX - swipeThreshold) {
      goToSlide(currentSlideIndex + 1);
      restartAutoplay();
    }
    if (touchEndX > touchStartX + swipeThreshold) {
      goToSlide(currentSlideIndex - 1);
      restartAutoplay();
    }
  }

  /* --------------------------------------------------------------------------
     3. Dynamic Tour Packages Engine (Loaded from packages.json)
     -------------------------------------------------------------------------- */
  const packagesGrid = document.getElementById('packages-grid');
  const resultsCount = document.getElementById('results-count');
  const activeSummary = document.getElementById('active-filter-summary');
  const activeTagPills = document.getElementById('active-tag-pills');
  const emptyState = document.getElementById('empty-state');

  async function loadPackages() {
    try {
      const response = await fetch('./packages.json');
      if (!response.ok) {
        throw new Error(`Failed to load packages.json: HTTP ${response.status}`);
      }
      packagesData = await response.json();
      populateCountryDropdown();
      applyFilters();
    } catch (err) {
      console.error('Error fetching packages.json:', err);
      if (packagesGrid) {
        packagesGrid.innerHTML = `
          <div class="grid-loading-state" style="grid-column: 1 / -1; padding: 60px 20px;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; color: var(--gold-light); margin-bottom: 12px; display: block;"></i>
            <p style="color: var(--text-primary); font-weight: 600;">Unable to load packages from packages.json</p>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 6px;">Please ensure packages.json is present and served via a local web server.</p>
          </div>
        `;
      }
      if (resultsCount) {
        resultsCount.textContent = 'Error loading packages';
      }
    }
  }

  // Populate Country dropdown dynamically from loaded data
  function populateCountryDropdown() {
    const countryFilter = document.getElementById('country-filter');
    const heroCountrySelect = document.getElementById('hero-country-select');
    if (!countryFilter || !packagesData) return;

    const countries = [...new Set(packagesData.map(pkg => pkg.country))].sort();
    
    // Refresh options
    countryFilter.innerHTML = '<option value="all">All Countries (Worldwide)</option>';
    countries.forEach(country => {
      const opt = document.createElement('option');
      opt.value = country;
      opt.textContent = country;
      countryFilter.appendChild(opt);
    });

    if (heroCountrySelect) {
      heroCountrySelect.innerHTML = '<option value="all">All Global Destinations</option>';
      countries.forEach(country => {
        const opt = document.createElement('option');
        opt.value = country;
        opt.textContent = country;
        heroCountrySelect.appendChild(opt);
      });
    }
  }

  /* --------------------------------------------------------------------------
     4. Interactive Multi-Filter & Search Controller
     -------------------------------------------------------------------------- */
  const searchInput = document.getElementById('search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  const countryFilter = document.getElementById('country-filter');
  const discountFilter = document.getElementById('discount-filter');
  const budgetSlider = document.getElementById('budget-slider');
  const budgetValue = document.getElementById('budget-value');
  const sortSelect = document.getElementById('sort-select');
  const resetFiltersBtn = document.getElementById('reset-filters-btn');
  const emptyResetBtn = document.getElementById('empty-reset-btn');

  // Search input event
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentFilter.search = e.target.value.trim().toLowerCase();
      if (searchClearBtn) {
        searchClearBtn.style.display = currentFilter.search ? 'block' : 'none';
      }
      applyFilters();
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      currentFilter.search = '';
      searchClearBtn.style.display = 'none';
      applyFilters();
    });
  }

  // Country select event
  if (countryFilter) {
    countryFilter.addEventListener('change', (e) => {
      currentFilter.country = e.target.value;
      applyFilters();
    });
  }

  // Discount select event
  if (discountFilter) {
    discountFilter.addEventListener('change', (e) => {
      currentFilter.minDiscount = parseInt(e.target.value, 10) || 0;
      applyFilters();
    });
  }

  // Budget slider event
  if (budgetSlider) {
    budgetSlider.addEventListener('input', (e) => {
      currentFilter.maxBudget = parseInt(e.target.value, 10);
      if (budgetValue) {
        budgetValue.textContent = `$${currentFilter.maxBudget.toLocaleString()}`;
      }
      applyFilters();
    });
  }

  // Sort select event
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentFilter.sortBy = e.target.value;
      applyFilters();
    });
  }

  // Reset Filters
  function resetAllFilters() {
    currentFilter = {
      search: '',
      country: 'all',
      maxBudget: 7500,
      minDiscount: 0,
      sortBy: 'featured'
    };

    if (searchInput) searchInput.value = '';
    if (searchClearBtn) searchClearBtn.style.display = 'none';
    if (countryFilter) countryFilter.value = 'all';
    if (discountFilter) discountFilter.value = '0';
    if (budgetSlider) budgetSlider.value = 7500;
    if (budgetValue) budgetValue.textContent = '$7,500';
    if (sortSelect) sortSelect.value = 'featured';

    applyFilters();
  }

  if (resetFiltersBtn) resetFiltersBtn.addEventListener('click', resetAllFilters);
  if (emptyResetBtn) emptyResetBtn.addEventListener('click', resetAllFilters);

  // Hero Quick Search Form submission
  const heroSearchSubmit = document.getElementById('hero-search-submit');
  const heroDestInput = document.getElementById('hero-destination-input');
  const heroCountrySelect = document.getElementById('hero-country-select');
  const heroDiscountSelect = document.getElementById('hero-discount-select');

  if (heroSearchSubmit) {
    heroSearchSubmit.addEventListener('click', () => {
      const keyword = heroDestInput ? heroDestInput.value.trim().toLowerCase() : '';
      const selectedCountry = heroCountrySelect ? heroCountrySelect.value : 'all';
      const selectedDiscount = heroDiscountSelect ? (parseInt(heroDiscountSelect.value, 10) || 0) : 0;

      // Sync into filter dashboard
      if (keyword) {
        currentFilter.search = keyword;
        if (searchInput) {
          searchInput.value = keyword;
          if (searchClearBtn) searchClearBtn.style.display = 'block';
        }
      }
      if (selectedCountry !== 'all') {
        currentFilter.country = selectedCountry;
        if (countryFilter) countryFilter.value = selectedCountry;
      }
      if (selectedDiscount > 0) {
        currentFilter.minDiscount = selectedDiscount;
        if (discountFilter) discountFilter.value = String(selectedDiscount);
      }

      applyFilters();

      // Smooth scroll to packages section
      const targetSec = document.getElementById('packages-section');
      if (targetSec) {
        targetSec.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  // Master Filter & Sort function
  function applyFilters() {
    if (!packagesData || packagesData.length === 0) return;

    let filtered = packagesData.filter(pkg => {
      // 1. Text Search
      if (currentFilter.search) {
        const query = currentFilter.search;
        const matchesTitle = pkg.title.toLowerCase().includes(query);
        const matchesCountry = pkg.country.toLowerCase().includes(query);
        const matchesDesc = pkg.description.toLowerCase().includes(query);
        const matchesCategory = pkg.category ? pkg.category.toLowerCase().includes(query) : false;
        const matchesHighlights = pkg.highlights ? pkg.highlights.some(h => h.toLowerCase().includes(query)) : false;

        if (!matchesTitle && !matchesCountry && !matchesDesc && !matchesCategory && !matchesHighlights) {
          return false;
        }
      }

      // 2. Country Filter
      if (currentFilter.country !== 'all') {
        if (pkg.country.toLowerCase() !== currentFilter.country.toLowerCase()) {
          return false;
        }
      }

      // 3. Budget / Max Rate Filter (checks discounted rate)
      if (pkg.discountRate > currentFilter.maxBudget) {
        return false;
      }

      // 4. Minimum Discount Rate Filter
      if (currentFilter.minDiscount > 0) {
        if ((pkg.discountPercent || 0) < currentFilter.minDiscount) {
          return false;
        }
      }

      return true;
    });

    // Apply Sorting
    filtered.sort((a, b) => {
      switch (currentFilter.sortBy) {
        case 'price-low':
          return a.discountRate - b.discountRate;
        case 'price-high':
          return b.discountRate - a.discountRate;
        case 'discount-high':
          return (b.discountPercent || 0) - (a.discountPercent || 0);
        case 'rating-high':
          return (b.rating || 0) - (a.rating || 0);
        case 'featured':
        default:
          return (b.featured === true ? 1 : 0) - (a.featured === true ? 1 : 0);
      }
    });

    renderPackagesGrid(filtered);
    updateFilterStatusUI(filtered.length);
  }

  // Render Packages to DOM
  function renderPackagesGrid(items) {
    if (!packagesGrid) return;
    packagesGrid.innerHTML = '';

    if (items.length === 0) {
      packagesGrid.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    packagesGrid.style.display = 'grid';
    if (emptyState) emptyState.style.display = 'none';

    items.forEach(pkg => {
      const card = document.createElement('article');
      card.className = 'package-card';
      card.setAttribute('data-id', pkg.id);

      // WhatsApp booking URL for this package
      const pkgMsg = encodeURIComponent(
        `Hello Rovista Baron Global, I would like to book the tour package: "${pkg.title}" (${pkg.country}) - ${pkg.duration} for $${Number(pkg.discountRate).toLocaleString()} per person. Please provide booking details and availability.`
      );
      const pkgWhatsAppUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${pkgMsg}`;

      // Render top highlights chips
      const highlightsHtml = (pkg.highlights || []).slice(0, 3).map(h => 
        `<span class="highlight-pill"><i class="fa-solid fa-check"></i> ${h}</span>`
      ).join('');

      card.innerHTML = `
        <div class="card-image-box">
          <img src="${pkg.image}" alt="${pkg.title}" class="card-img" loading="lazy">
          <div class="card-image-overlay"></div>
          <span class="card-badge-discount">${pkg.discountPercent}% OFF</span>
          <span class="card-badge-country"><i class="fa-solid fa-location-dot"></i> ${pkg.country}</span>
          <span class="card-badge-duration"><i class="fa-regular fa-clock"></i> ${pkg.duration}</span>
        </div>

        <div class="card-body">
          <div class="card-meta-row">
            <span class="card-category">${pkg.category || 'Luxury Expedition'}</span>
            <div class="card-rating">
              <i class="fa-solid fa-star"></i>
              <span>${Number(pkg.rating).toFixed(1)}</span>
              <span class="card-reviews-count">(${pkg.reviewsCount})</span>
            </div>
          </div>

          <h3 class="card-title">${pkg.title}</h3>
          <p class="card-description">${pkg.description}</p>

          <div class="card-highlights-pills">
            ${highlightsHtml}
          </div>

          <div class="card-footer">
            <div class="card-pricing-block">
              <span class="price-strikethrough">$${Number(pkg.baseRate).toLocaleString()}</span>
              <span class="price-discounted">$${Number(pkg.discountRate).toLocaleString()}</span>
              <span class="price-per-person-tag">per person</span>
            </div>
            <div class="card-actions-row">
              <button type="button" class="btn-icon-square view-details-trigger" data-id="${pkg.id}" title="Quick Details">
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
              </button>
              <a href="${pkgWhatsAppUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp btn-sm" title="Book via WhatsApp">
                <i class="fa-brands fa-whatsapp"></i> Book via WhatsApp
              </a>
            </div>
          </div>
        </div>
      `;

      packagesGrid.appendChild(card);
    });

    // Attach click listeners for quick details
    document.querySelectorAll('.view-details-trigger').forEach(btn => {
      btn.addEventListener('click', function() {
        const pkgId = this.getAttribute('data-id');
        openPackageModal(pkgId);
      });
    });
  }

  // Update Status UI and Active Filter Pills
  function updateFilterStatusUI(matchCount) {
    if (resultsCount) {
      resultsCount.textContent = `Showing ${matchCount} of ${packagesData.length} Tour Packages`;
    }

    if (activeTagPills) {
      activeTagPills.innerHTML = '';

      if (currentFilter.search) {
        createPill(`Search: "${currentFilter.search}"`, () => {
          currentFilter.search = '';
          if (searchInput) searchInput.value = '';
          if (searchClearBtn) searchClearBtn.style.display = 'none';
          applyFilters();
        });
      }

      if (currentFilter.country !== 'all') {
        createPill(`Country: ${currentFilter.country}`, () => {
          currentFilter.country = 'all';
          if (countryFilter) countryFilter.value = 'all';
          applyFilters();
        });
      }

      if (currentFilter.maxBudget < 7500) {
        createPill(`Max Budget: $${currentFilter.maxBudget.toLocaleString()}`, () => {
          currentFilter.maxBudget = 7500;
          if (budgetSlider) budgetSlider.value = 7500;
          if (budgetValue) budgetValue.textContent = '$7,500';
          applyFilters();
        });
      }

      if (currentFilter.minDiscount > 0) {
        createPill(`Min Discount: ${currentFilter.minDiscount}%+`, () => {
          currentFilter.minDiscount = 0;
          if (discountFilter) discountFilter.value = '0';
          applyFilters();
        });
      }
    }
  }

  function createPill(label, onRemove) {
    const pill = document.createElement('span');
    pill.className = 'active-pill';
    pill.innerHTML = `<span>${label}</span> <button type="button" aria-label="Remove filter"><i class="fa-solid fa-xmark"></i></button>`;
    pill.querySelector('button').addEventListener('click', onRemove);
    activeTagPills.appendChild(pill);
  }

  /* --------------------------------------------------------------------------
     5. Package Details Modal Controller
     -------------------------------------------------------------------------- */
  const packageModal = document.getElementById('package-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  function openPackageModal(packageId) {
    const pkg = packagesData.find(p => p.id === packageId);
    if (!pkg || !packageModal) return;

    // Populate Modal Content
    const modalImg = document.getElementById('modal-image');
    const modalDiscountBadge = document.getElementById('modal-discount-badge');
    const modalCountryText = document.getElementById('modal-country-text');
    const modalRatingScore = document.getElementById('modal-rating-score');
    const modalReviewsCount = document.getElementById('modal-reviews-count');
    const modalDurationText = document.getElementById('modal-duration-text');
    const modalTitle = document.getElementById('modal-package-title');
    const modalDesc = document.getElementById('modal-description');
    const modalHighlightsList = document.getElementById('modal-highlights-list');
    const modalDiscountRate = document.getElementById('modal-discount-rate');
    const modalBaseRate = document.getElementById('modal-base-rate');
    const modalSavingsNote = document.getElementById('modal-savings-note');
    const modalWhatsAppCta = document.getElementById('modal-whatsapp-cta');

    if (modalImg) {
      modalImg.src = pkg.image;
      modalImg.alt = pkg.title;
    }
    if (modalDiscountBadge) modalDiscountBadge.textContent = `${pkg.discountPercent}% OFF`;
    if (modalCountryText) modalCountryText.textContent = pkg.country;
    if (modalRatingScore) modalRatingScore.textContent = Number(pkg.rating).toFixed(2);
    if (modalReviewsCount) modalReviewsCount.textContent = `(${pkg.reviewsCount} verified reviews)`;
    if (modalDurationText) modalDurationText.textContent = pkg.duration;
    if (modalTitle) modalTitle.textContent = pkg.title;
    if (modalDesc) modalDesc.textContent = pkg.description;

    if (modalHighlightsList) {
      modalHighlightsList.innerHTML = '';
      (pkg.highlights || []).forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        modalHighlightsList.appendChild(li);
      });
    }

    const savings = pkg.baseRate - pkg.discountRate;
    if (modalDiscountRate) modalDiscountRate.textContent = `$${Number(pkg.discountRate).toLocaleString()}`;
    if (modalBaseRate) modalBaseRate.textContent = `$${Number(pkg.baseRate).toLocaleString()}`;
    if (modalSavingsNote) modalSavingsNote.textContent = `You save $${Number(savings).toLocaleString()} per person!`;

    // WhatsApp Message
    const encodedMsg = encodeURIComponent(
      `Hello Rovista Baron Global! I am interested in reserving the luxury tour: "${pkg.title}" (${pkg.country}) - ${pkg.duration}. The privilege rate is $${Number(pkg.discountRate).toLocaleString()}. Please provide confirmation details and concierge assistance.`
    );
    if (modalWhatsAppCta) {
      modalWhatsAppCta.href = `https://wa.me/${WHATSAPP_PHONE}?text=${encodedMsg}`;
    }

    // Show modal
    packageModal.classList.add('open');
    packageModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closePackageModal() {
    if (!packageModal) return;
    packageModal.classList.remove('open');
    packageModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closePackageModal);
  if (packageModal) {
    packageModal.addEventListener('click', (e) => {
      if (e.target === packageModal) {
        closePackageModal();
      }
    });
  }

  // Escape key to close modal or mobile drawer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePackageModal();
      closeMobileMenu();
    }
  });

  /* --------------------------------------------------------------------------
     6. Interactive Contact Form & WhatsApp Dispatch Generator
     -------------------------------------------------------------------------- */
  const contactForm = document.getElementById('whatsapp-inquiry-form');
  const contactNameInput = document.getElementById('contact-name');
  const contactPhoneInput = document.getElementById('contact-phone');
  const contactDestSelect = document.getElementById('contact-destination');
  const contactTravelersSelect = document.getElementById('contact-travelers');
  const contactDateInput = document.getElementById('contact-date');
  const contactBudgetSelect = document.getElementById('contact-budget');
  const contactMessageInput = document.getElementById('contact-message');
  const previewText = document.getElementById('whatsapp-preview-text');

  function updateWhatsAppPreview() {
    const name = contactNameInput && contactNameInput.value.trim() ? contactNameInput.value.trim() : '[Your Name]';
    const destination = contactDestSelect && contactDestSelect.value ? contactDestSelect.value : '[Selected Destination]';
    const travelers = contactTravelersSelect ? contactTravelersSelect.value : '2 Guests';
    const travelDate = contactDateInput && contactDateInput.value.trim() ? contactDateInput.value.trim() : 'Upcoming Season';
    const budget = contactBudgetSelect ? contactBudgetSelect.value : 'Flexible';
    const userNote = contactMessageInput && contactMessageInput.value.trim() ? `\n• Special Requests: "${contactMessageInput.value.trim()}"` : '';

    const previewMsg = `"Hello Rovista Baron Global,\n\nMy name is ${name}. I would like to plan a luxury journey:\n• Destination: ${destination}\n• Travelers: ${travelers}\n• Preferred Dates: ${travelDate}\n• Budget Range: ${budget}${userNote}\n\nPlease share availability and bespoke itinerary recommendations."`;

    if (previewText) {
      previewText.textContent = previewMsg;
    }

    return previewMsg.replace(/^"|"$/g, '');
  }

  // Update preview on any input change
  const formFields = [
    contactNameInput, contactPhoneInput, contactDestSelect, 
    contactTravelersSelect, contactDateInput, contactBudgetSelect, contactMessageInput
  ];
  formFields.forEach(field => {
    if (field) {
      field.addEventListener('input', updateWhatsAppPreview);
      field.addEventListener('change', updateWhatsAppPreview);
    }
  });

  // Handle Form Submission -> Opens WhatsApp
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      if (!contactNameInput.value.trim()) {
        contactNameInput.focus();
        return;
      }
      if (!contactDestSelect.value) {
        contactDestSelect.focus();
        return;
      }

      const rawMessage = updateWhatsAppPreview();
      const whatsappUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(rawMessage)}`;

      // Open WhatsApp in new tab
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    });
  }

  /* --------------------------------------------------------------------------
     7. Floating WhatsApp Widget Interactive Enhancements
     -------------------------------------------------------------------------- */
  const floatingTooltip = document.getElementById('floating-tooltip');
  if (floatingTooltip) {
    setTimeout(() => {
      floatingTooltip.style.opacity = '1';
      floatingTooltip.style.visibility = 'visible';
      floatingTooltip.style.transform = 'translateY(0)';

      setTimeout(() => {
        floatingTooltip.style.opacity = '';
        floatingTooltip.style.visibility = '';
        floatingTooltip.style.transform = '';
      }, 5000);
    }, 3000);
  }

  /* --------------------------------------------------------------------------
     8. Bootstrap App: Asynchronously Load Dynamic JSON Files
     -------------------------------------------------------------------------- */
  loadHighlights();
  loadPackages();
  updateWhatsAppPreview();
});
