/**
 * Contextual Navigation
 *
 * Tracks where users navigate from and updates breadcrumbs accordingly.
 * Like browser back behavior - the back button takes you to where you came from.
 * Works for all pages: sections (build/think/path), projects, articles, etc.
 */

(function() {
  const NAV_FROM_KEY = 'nav_from';

  // Page info mapping - used to identify known pages
  const PAGE_INFO = {
    'index.html': { name: 'mido', isHome: true },
    'tree.html': { name: 'tree', isFullPage: true },
    'portfolio.html': { name: 'build', isSection: true },
    'writing.html': { name: 'think', isSection: true },
    'history.html': { name: 'path', isSection: true }
  };

  // Get the filename from a path
  function getFilename(path) {
    // Handle both absolute and relative paths
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'index.html';
  }

  // Get current page filename
  function getCurrentFilename() {
    const path = window.location.pathname;
    const filename = getFilename(path);
    // Handle root path
    if (filename === '' || path.endsWith('/')) return 'index.html';
    return filename;
  }

  // Get current page info
  function getCurrentPageInfo() {
    const filename = getCurrentFilename();
    return PAGE_INFO[filename] || null;
  }

  // Check if current page is in a subdirectory
  function isInSubdirectory() {
    const path = window.location.pathname;
    return path.includes('/projects/') || path.includes('/writing/');
  }

  // Get the relative path prefix to root
  function getPathPrefix() {
    return isInSubdirectory() ? '../' : '';
  }

  // Store the current page as the navigation source
  function storeNavSource() {
    const filename = getCurrentFilename();
    const pageInfo = getCurrentPageInfo();
    const hash = window.location.hash || '';

    // Build the navigation source data
    const navData = {
      filename: filename,
      hash: hash,
      name: pageInfo ? pageInfo.name : filename.replace('.html', ''),
      isFullPage: pageInfo ? (pageInfo.isFullPage || false) : false,
      isSection: pageInfo ? (pageInfo.isSection || false) : false,
      isHome: pageInfo ? (pageInfo.isHome || false) : false,
      timestamp: Date.now()
    };

    sessionStorage.setItem(NAV_FROM_KEY, JSON.stringify(navData));
  }

  // Get the stored navigation source
  function getNavSource() {
    const stored = sessionStorage.getItem(NAV_FROM_KEY);
    if (!stored) return null;

    try {
      const data = JSON.parse(stored);
      // Only use if less than 30 minutes old
      if (Date.now() - data.timestamp > 30 * 60 * 1000) {
        sessionStorage.removeItem(NAV_FROM_KEY);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  // Build the back href based on nav source and current page
  function buildBackHref(navSource) {
    const prefix = getPathPrefix();
    let href = prefix + navSource.filename;
    if (navSource.hash) {
      href += navSource.hash;
    }
    return href;
  }

  // Get current page name from the breadcrumb or derive from filename
  function getCurrentPageName() {
    const locationEl = document.querySelector('.location');
    if (locationEl) {
      const currentEl = locationEl.querySelector('.location__current');
      if (currentEl) return currentEl.textContent.trim();
    }
    // Fallback: derive from filename
    const filename = getCurrentFilename();
    return filename.replace('.html', '').replace(/-/g, ' ');
  }

  // Update breadcrumb based on navigation context
  function updateBreadcrumb() {
    const navSource = getNavSource();
    if (!navSource) return;

    const currentPageInfo = getCurrentPageInfo();

    // Don't update if we're on the home page (no breadcrumb needed)
    if (currentPageInfo && currentPageInfo.isHome) return;

    // Don't update if the source is the same as current page
    if (navSource.filename === getCurrentFilename()) return;

    const backHref = buildBackHref(navSource);
    const backName = navSource.name;

    // Handle tree.html's special back button
    if (currentPageInfo && currentPageInfo.isFullPage) {
      const treeBack = document.querySelector('.tree__back');
      if (treeBack) {
        treeBack.href = backHref;
        treeBack.textContent = backName;
      }
      return;
    }

    // Handle standard .location breadcrumb
    const locationEl = document.querySelector('.location');
    if (!locationEl) return;

    const currentName = getCurrentPageName();

    // Determine what to show based on current page type
    if (currentPageInfo && currentPageInfo.isSection) {
      // Current page is a section page (build/think/path)
      // Show: ← [source] / [section]
      locationEl.innerHTML = `
        <a href="${backHref}" class="location__back">${backName}</a>
        <span class="location__sep">/</span>
        <span class="location__current">${currentName}</span>
      `;
    } else if (isInSubdirectory()) {
      // Current page is a detail page (project or article)
      // Show: ← [source] / [page]
      locationEl.innerHTML = `
        <a href="${backHref}" class="location__back">${backName}</a>
        <span class="location__sep">/</span>
        <span class="location__current">${currentName}</span>
      `;
    }
  }

  // Check if a link is internal (same site)
  function isInternalLink(href) {
    if (!href) return false;
    // Exclude external links, javascript:, mailto:, tel:, #anchors on same page
    if (href.startsWith('http://') || href.startsWith('https://')) {
      // Check if it's the same origin
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
    // Pure hash links on the same page
    if (href.startsWith('#')) {
      return false;
    }
    return true;
  }

  // Attach click handlers to track navigation
  function attachNavTracking() {
    document.addEventListener('click', function(e) {
      const link = e.target.closest('a');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!isInternalLink(href)) return;

      // Store current page before navigating
      storeNavSource();
    });
  }

  // Initialize
  function init() {
    // Attach tracking for future navigations
    attachNavTracking();

    // Update breadcrumb if we have a stored navigation source
    updateBreadcrumb();
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
