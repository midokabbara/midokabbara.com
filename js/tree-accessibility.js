/* Keyboard support for the existing tree controls; click handlers stay in tree.html. */
(() => {
  const disclosures = [];
  let nextId = 0;
  let activeDialog = null;
  let returnFocus = null;
  const background = document.querySelector('.tree-takeover');

  function identify(element) {
    if (!element.id) element.id = `tree-control-${++nextId}`;
    return element.id;
  }

  function button(element) {
    element.setAttribute('role', 'button');
    element.tabIndex = 0;
    element.addEventListener('keydown', event => {
      if (event.target !== element || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat && event.key === 'Enter') element.click();
    });
    element.addEventListener('keyup', event => {
      if (event.target !== element || event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      element.click();
    });
  }

  document.querySelectorAll('.expandable').forEach(item => {
    // Put the button on the label, not around its nested buttons and links.
    const trigger = item.querySelector(':scope > .leaf-text');
    const content = item.querySelector(':scope > .expanded');
    if (!trigger || !content) return;
    button(trigger);
    trigger.setAttribute('aria-controls', identify(content));
    disclosures.push({ trigger, expanded: () => item.dataset.expanded === 'true' });
  });

  document.querySelectorAll('.idea-tag').forEach(trigger => {
    button(trigger);
    trigger.setAttribute('aria-controls', identify(trigger.nextElementSibling));
    disclosures.push({ trigger, expanded: () => trigger.dataset.expanded === 'true' });
  });

  document.querySelectorAll('.overflow-more, .driver__more').forEach(trigger => {
    button(trigger);
    const isMainTree = trigger.classList.contains('overflow-more');
    const parent = isMainTree ? trigger.parentElement : trigger.closest('.driver__children');
    const hidden = [...parent.querySelectorAll(isMainTree ? ':scope > .overflow-hidden' : ':scope > .driver__hidden')];
    if (hidden.length) trigger.setAttribute('aria-controls', hidden.map(identify).join(' '));
    disclosures.push({ trigger, expanded: () => (isMainTree ? parent.dataset.overflowExpanded : parent.dataset.expanded) === 'true' });
    trigger.addEventListener('click', () => {
      // The "more" control disappears; keep keyboard focus on the revealed items.
      if (document.activeElement === trigger) {
        hidden[0]?.querySelector('a, [tabindex="0"]')?.focus({ preventScroll: true });
      }
    });
  });

  document.querySelectorAll('.metric-link').forEach(trigger => {
    button(trigger);
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', `metric-takeover-${trigger.dataset.metric}`);
  });

  document.querySelectorAll('.metric-takeover').forEach(dialog => {
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', `${dialog.id.replace('metric-takeover-', '')} metric driver tree`);
    button(dialog.querySelector('.metric-takeover__back'));
  });

  function sync() {
    disclosures.forEach(({ trigger, expanded }) => trigger.setAttribute('aria-expanded', String(expanded())));
    const dialog = document.querySelector('.metric-takeover.active');
    if (dialog === activeDialog) return;
    if (dialog) {
      returnFocus = document.querySelector(`.metric-link[aria-controls="${dialog.id}"]`);
      activeDialog = dialog;
      background.inert = true;
      dialog.querySelector('.metric-takeover__back').focus({ preventScroll: true });
    } else {
      activeDialog = null;
      background.inert = false;
      if (returnFocus?.isConnected) {
        // The existing back action can also collapse the decompose branch.
        const target = returnFocus.getClientRects().length
          ? returnFocus
          : document.querySelector('.decompose-trigger > .leaf-text');
        target?.focus({ preventScroll: true });
      }
      returnFocus = null;
    }
  }

  // Reflect every existing mouse, touch and Escape path, including automatic closures.
  new MutationObserver(sync).observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-expanded', 'data-overflow-expanded', 'class']
  });
  sync();

  document.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || !activeDialog) return;
    const controls = [...activeDialog.querySelectorAll('a[href], button, [tabindex="0"]')]
      .filter(element => element.getClientRects().length);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
})();
