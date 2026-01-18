/**
 * Contextual Navigation
 *
 * Tracks where users navigate from and updates breadcrumbs accordingly.
 * Always shows: ← mido / [referrer] / current
 * - mido always links to home
 * - referrer shows where you came from (contextual)
 * - current is the page you're on
 */

(function() {
  const NAV_FROM_KEY = 'nav_from';

  // Page info mapping
  const PAGE_INFO = {
    'index.html': { name: 'mido', isHome: true },
    'tree.html': { name: 'tree', isFullPage: true },
    'portfolio.html': { name: 'build', isSection: true },
    'writing.html': { name: 'think', isSection: true },
    'history.html': { name: 'path', isSection: true }
  };

  // Get filename from path
  function getFilename(path) {
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'index.html';
  }

  // Get current page filename
  function getCurrentFilename() {
    const path = window.location.pathname;
    const filename = getFilename(path);
    if (filename === '' || path.endsWith('/')) return 'index.html';
    return filename;
  }

  // Get page info for a filename
  function getPageInfo(filename) {
    return PAGE_INFO[filename] || null;
  }

  // Get current page info
  function getCurrentPageInfo() {
    return getPageInfo(getCurrentFilename());
  }

  // Check if in subdirectory
  function isInSubdirectory() {
    const path = window.location.pathname;
    return path.includes('/projects/') || path.includes('/writing/');
  }

  // Get relative path prefix to root
  function getPathPrefix() {
    return isInSubdirectory() ? '../' : '';
  }

  // Store navigation source
  function storeNavSource() {
    const filename = getCurrentFilename();
    const pageInfo = getCurrentPageInfo();
    const hash = window.location.hash || '';

    const navData = {
      filename: filename,
      hash: hash,
      name: pageInfo ? pageInfo.name : filename.replace('.html', '').replace(/-/g, ' '),
      isHome: pageInfo ? (pageInfo.isHome || false) : false,
      timestamp: Date.now()
    };

    sessionStorage.setItem(NAV_FROM_KEY, JSON.stringify(navData));
  }

  // Get stored navigation source
  function getNavSource() {
    const stored = sessionStorage.getItem(NAV_FROM_KEY);
    if (!stored) return null;

    try {
      const data = JSON.parse(stored);
      if (Date.now() - data.timestamp > 30 * 60 * 1000) {
        sessionStorage.removeItem(NAV_FROM_KEY);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  // Get current page name from breadcrumb or filename
  function getCurrentPageName() {
    const locationEl = document.querySelector('.location');
    if (locationEl) {
      const currentEl = locationEl.querySelector('.location__current');
      if (currentEl) return currentEl.textContent.trim();
    }
    const currentPageInfo = getCurrentPageInfo();
    if (currentPageInfo) return currentPageInfo.name;
    return getCurrentFilename().replace('.html', '').replace(/-/g, ' ');
  }

  // Build multi-segment breadcrumb HTML
  // Format: ← mido / [referrer] / current
  function buildBreadcrumbHTML(navSource, currentName, prefix) {
    const homeHref = prefix + 'index.html';
    let referrerHref = prefix + navSource.filename;
    if (navSource.hash) referrerHref += navSource.hash;

    // If referrer is home, just show: ← mido / current
    if (navSource.isHome) {
      return `
        <a href="${homeHref}" class="location__back">mido</a>
        <span class="location__sep">/</span>
        <span class="location__current">${currentName}</span>
      `;
    }

    // Otherwise show: ← mido / referrer / current
    return `
      <a href="${homeHref}" class="location__back">mido</a>
      <span class="location__sep">/</span>
      <a href="${referrerHref}" class="location__link">${navSource.name}</a>
      <span class="location__sep">/</span>
      <span class="location__current">${currentName}</span>
    `;
  }

  // Update breadcrumb
  function updateBreadcrumb() {
    const navSource = getNavSource();
    if (!navSource) return;

    const currentPageInfo = getCurrentPageInfo();
    const currentFilename = getCurrentFilename();

    // Don't update on home page
    if (currentPageInfo && currentPageInfo.isHome) return;

    // Don't update if source is same as current
    if (navSource.filename === currentFilename) return;

    const prefix = getPathPrefix();
    const currentName = getCurrentPageName();

    // Handle tree.html - convert simple back to full breadcrumb
    if (currentPageInfo && currentPageInfo.isFullPage) {
      const treeBack = document.querySelector('.tree__back');
      if (treeBack) {
        // Create a location div to replace/augment the tree__back
        const breadcrumbHTML = buildBreadcrumbHTML(navSource, currentName, prefix);

        // Create new location element
        const locationEl = document.createElement('div');
        locationEl.className = 'location';
        locationEl.innerHTML = breadcrumbHTML;

        // Replace tree__back with location breadcrumb
        treeBack.parentNode.replaceChild(locationEl, treeBack);
      }
      return;
    }

    // Handle standard .location breadcrumb
    const locationEl = document.querySelector('.location');
    if (!locationEl) return;

    locationEl.innerHTML = buildBreadcrumbHTML(navSource, currentName, prefix);
  }

  // Check if internal link
  function isInternalLink(href) {
    if (!href) return false;
    if (href.startsWith('http://') || href.startsWith('https://')) {
      try {
        const url = new URL(href, window.location.origin);
        return url.origin === window.location.origin;
      } catch (e) {
        return false;
      }
    }
    if (href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return false;
    }
    if (href.startsWith('#')) {
      return false;
    }
    return true;
  }

  // Check if link is a back/home button (first link in breadcrumb)
  function isBackButton(link) {
    return link.classList.contains('location__back') ||
           link.classList.contains('tree__back');
  }

  // Clear navigation source
  function clearNavSource() {
    sessionStorage.removeItem(NAV_FROM_KEY);
  }

  // Attach click handlers
  function attachNavTracking() {
    document.addEventListener('click', function(e) {
      const link = e.target.closest('a');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!isInternalLink(href)) return;

      // If clicking the home/back button (first segment), clear nav source
      if (isBackButton(link)) {
        clearNavSource();
        return;
      }

      // Store current page before navigating
      storeNavSource();
    });
  }

  // Initialize
  function init() {
    attachNavTracking();
    updateBreadcrumb();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
