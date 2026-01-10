/**
 * Task Canvas - Router
 * Hash-based routing for SPA navigation
 */

import { state } from './state.js';

/**
 * Parse the current URL hash into route info
 * @returns {{ page: string, param: string | null }}
 */
export function parseRoute() {
  const hash = window.location.hash || '#/projects';
  const parts = hash.slice(2).split('/'); // Remove '#/'

  return {
    page: parts[0] || 'projects',
    param: parts[1] || null
  };
}

/**
 * Navigate to a new route
 * @param {string} path
 */
export function navigate(path) {
  window.location.hash = path;
}

/**
 * Update navigation link active states
 * @param {string} currentPage
 */
export function updateNavActiveState(currentPage) {
  document.querySelectorAll('.nav-link').forEach(link => {
    const isActive = link.dataset.nav === currentPage;
    link.classList.toggle('active', isActive);

    // Update aria-current for accessibility
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

/**
 * Update breadcrumb navigation
 * @param {Array<{ label: string, href?: string }>} items
 */
export function updateBreadcrumb(items) {
  const breadcrumb = document.getElementById('breadcrumb');
  if (!breadcrumb) return;

  breadcrumb.innerHTML = items.map((item, index) => {
    const isLast = index === items.length - 1;

    if (isLast) {
      return `<span class="breadcrumb-current" aria-current="page">${item.label}</span>`;
    }

    return `
      <a href="${item.href}">${item.label}</a>
      <span class="breadcrumb-separator" aria-hidden="true">/</span>
    `;
  }).join('');
}

/**
 * Initialize the router
 * @param {Function} onRouteChange - Callback when route changes
 */
export function initRouter(onRouteChange) {
  // Handle hash changes
  window.addEventListener('hashchange', onRouteChange);

  // Handle initial route
  if (!window.location.hash) {
    window.location.hash = '#/projects';
  }
}
