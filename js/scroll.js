/**
 * Scroll-triggered animations and depth indicator
 */

(function() {
  'use strict';

  // Animate metrics on scroll
  function initMetricCounters() {
    const metrics = document.querySelectorAll('.metric__value');

    if (!metrics.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.5
    });

    metrics.forEach(metric => observer.observe(metric));
  }

  // Update depth indicator based on scroll position
  function initDepthIndicator() {
    const depthFill = document.querySelector('.depth__fill');
    const depthLabel = document.querySelector('.depth__label');

    if (!depthFill || !depthLabel) return;

    // Get current depth from page (set in HTML)
    const currentDepth = parseInt(depthLabel.textContent.replace('depth: ', '')) || 1;
    const maxDepth = 4;
    const baseHeight = (currentDepth / maxDepth) * 100;

    // Adjust fill based on scroll
    function updateDepth() {
      const scrollPercent = window.scrollY / (document.body.scrollHeight - window.innerHeight);
      const additionalHeight = scrollPercent * (25 / maxDepth); // Add up to 25% based on scroll
      const totalHeight = Math.min(baseHeight + additionalHeight, 100);

      depthFill.style.height = totalHeight + '%';
    }

    window.addEventListener('scroll', updateDepth, { passive: true });
    updateDepth();
  }

  // Fade in elements on scroll
  function initScrollFade() {
    const fadeElements = document.querySelectorAll('.card, .timeline__item, .article-preview');

    if (!fadeElements.length) return;

    // Add initial state
    fadeElements.forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          // Stagger the animations
          setTimeout(() => {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
          }, index * 100);
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    fadeElements.forEach(el => observer.observe(el));
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    initMetricCounters();
    initDepthIndicator();
    initScrollFade();
  });

})();
