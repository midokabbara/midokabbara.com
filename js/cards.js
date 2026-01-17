/**
 * Card interactions - flip effect and click handling
 */

(function() {
  'use strict';

  function initCards() {
    const cards = document.querySelectorAll('.card');

    cards.forEach(card => {
      // Add click handler to navigate to project page
      card.addEventListener('click', (e) => {
        const title = card.querySelector('.card__title');
        if (!title) return;

        // Convert title to URL-friendly slug
        const slug = title.textContent
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');

        // Navigate to project page
        window.location.href = `projects/${slug}.html`;
      });

      // Keyboard accessibility
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', initCards);

})();
