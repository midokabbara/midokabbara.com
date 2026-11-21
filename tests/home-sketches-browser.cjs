/* Real-browser checks. Requires Playwright and a running static preview.
 * PLAYWRIGHT_MODULE=/path/to/playwright BASE_URL=http://127.0.0.1:8765/portfolio-current/ \
 * QA_OUTPUT=/absolute/path/to/artifacts node tests/home-sketches-browser.cjs
 * BROWSERS=chromium,webkit (default) selects installed engines.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const engines = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:8765/portfolio-current/';
const output = process.env.QA_OUTPUT || fs.mkdtempSync(path.join(os.tmpdir(), 'mido-browser-qa-'));
fs.mkdirSync(output, { recursive: true });
const key = 'mido-sketches.product-intro.v1';
const root = '[data-intro-sketches]';
const notes = [];
const state = page => page.locator(root).evaluate(el => ({ ...el.dataset }));
const waitState = (page, name, value) => page.waitForFunction(
  ([selector, name, value]) => document.querySelector(selector)?.dataset[name] === value,
  [root, name, value], { timeout: 10000 });
const idle = async page => {
  await page.keyboard.press('Escape');
  await waitState(page, 'introAnimation', 'idle');
  await waitState(page, 'animation', 'idle');
  await page.waitForFunction(() => [...document.querySelectorAll('.description-letter')]
    .every(el => getComputedStyle(el).opacity === '1'));
};
const record = text => { notes.push(text); console.log(text); };

(async () => {
  for (const name of (process.env.BROWSERS || 'chromium,webkit').split(',')) {
    const browser = await engines[name].launch();
    try {
      const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await desktop.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      // Capture trusted native inputs to diagnose hover/focus ownership failures.
      await page.addInitScript(() => {
        window.qaEvents = [];
        for (const type of ['pointerenter', 'pointerleave', 'focus', 'blur']) {
          document.addEventListener(type, event => {
            if (!event.target?.matches?.('.intro-word,.branch,.section-link,.trigger')) return;
            window.qaEvents.push({ type, text: event.target.textContent, pointer: event.pointerType,
              trusted: event.isTrusted, focusVisible: event.target.matches(':focus-visible'),
              time: performance.now(), state: { ...document.querySelector('[data-intro-sketches]')?.dataset } });
          }, true);
        }
      });
      await page.goto(base);
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(1, 1);
      await page.waitForTimeout(1500);
      assert.equal((await state(page)).introAnimation, 'idle');
      for (const kind of ['product', 'valuations', 'strategy', 'consulting']) {
        await page.locator(`.intro-word[data-intro-kind=${kind}]`).hover();
        await waitState(page, 'introKind', kind);
        await page.mouse.move(1, 1);
        await waitState(page, 'introAnimation', 'idle');
      }
      for (const kind of ['build', 'think', 'path']) {
        await page.locator(`[data-play=${kind}]`).hover();
        await waitState(page, 'animation', 'drawing');
        await page.mouse.move(1, 1);
        await waitState(page, 'animation', 'idle');
      }
      record(`${name}: native hover entry and exit passed for all seven controls`);
      await page.screenshot({ path: path.join(output, `${name}-desktop-idle.png`) });

      // Use Tab rather than programmatic focus: focus-visible is part of the contract.
      await page.reload();
      await page.keyboard.press('Tab');
      assert(await page.locator('.tree-home__root').evaluate(el => el === document.activeElement));
      for (const kind of ['product', 'valuations', 'strategy', 'consulting']) {
        await page.keyboard.press('Tab');
        const button = page.locator(`.intro-word[data-intro-kind=${kind}]`);
        assert(await button.evaluate(el => el === document.activeElement && el.matches(':focus-visible')));
        assert.notEqual(await button.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
        await waitState(page, 'introKind', kind);
        await page.keyboard.press('Enter');
        await waitState(page, 'introAnimation', 'drawing');
        await page.keyboard.press('Escape');
        await waitState(page, 'introAnimation', 'idle');
        await page.keyboard.press('Space');
        await waitState(page, 'introAnimation', 'drawing');
        await page.keyboard.press('Escape');
      }
      for (const kind of ['build', 'think', 'path']) {
        await page.keyboard.press('Tab');
        assert(await page.locator(`[data-play=${kind}]`).evaluate(el => el === document.activeElement && el.matches(':focus-visible')));
        await page.keyboard.press('Space');
        await waitState(page, 'animation', 'drawing');
        assert.equal(page.url(), base);
        await idle(page);
        await page.keyboard.press('Tab');
        assert(await page.locator('.section-link').filter({ hasText: kind }).evaluate(el => el === document.activeElement));
        await page.keyboard.press('Escape');
      }
      record(`${name}: Tab order, visible focus, Enter/Space, Escape and branch non-navigation passed`);

      for (const [kind, destination] of [['build', 'portfolio.html'], ['think', 'writing.html'], ['path', 'history.html']]) {
        await page.getByRole('link', { name: kind, exact: true }).click();
        await page.waitForURL(new URL(destination, base).href);
        assert.equal(desktop.pages().length, 1);
        await page.goBack();
        await page.waitForSelector(root);
      }
      await page.getByRole('link', { name: 'résumé', exact: true }).click();
      await page.waitForURL(new URL('resume.html', base).href);
      await page.goBack();
      await page.getByRole('link', { name: 'mido kabbara', exact: true }).click();
      await page.waitForURL(new URL('tree.html', base).href);
      await page.goBack();
      // Check external destinations without sending the test into a third-party site or mail client.
      assert.equal(await page.getByRole('link', { name: 'mkmido@gmail.com', exact: true }).getAttribute('href'), 'mailto:mkmido@gmail.com');
      assert.equal(await page.getByRole('link', { name: 'linkedin', exact: true }).getAttribute('href'), 'https://linkedin.com/in/midokabbara');
      record(`${name}: section, name and résumé links navigate in the same tab; contact destinations retained`);

      const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      const phone = await mobile.newPage();
      phone.on('pageerror', error => errors.push(error.message));
      await phone.goto(base);
      await waitState(phone, 'introKind', 'product');
      assert.equal((await state(phone)).animation, 'idle');
      assert.equal((await state(phone)).introHints, undefined);
      await waitState(phone, 'introAnimation', 'complete');
      await phone.screenshot({ path: path.join(output, `${name}-mobile-product.png`) });
      await waitState(phone, 'introAnimation', 'idle');
      assert.equal(await phone.evaluate(key => localStorage.getItem(key), key), '1');
      await phone.reload();
      await phone.waitForTimeout(1600);
      assert.equal((await state(phone)).introAnimation, 'idle');
      for (const size of [{ width: 320, height: 568 }, { width: 320, height: 480 }, { width: 390, height: 844 }, { width: 667, height: 375 }]) {
        const landscape = size.width > size.height && size.height <= 512;
        await phone.setViewportSize(size);
        await phone.locator('.intro-word[data-intro-kind=valuations]').tap();
        await waitState(phone, 'introAnimation', 'complete');
        const geometry = await phone.evaluate(() => {
          const stage = document.querySelector('.intro-stage').getBoundingClientRect();
          const name = document.querySelector('.tree-home__root').getBoundingClientRect();
          const textRight = Math.max(...['.tree-home__about', '.tree-home__branches', '.tree-home__contact']
            .map(selector => document.querySelector(selector).getBoundingClientRect().right));
          return { x: stage.x, y: stage.y, bottom: stage.bottom, right: stage.right, nameTop: name.top,
            textRight, width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth };
        });
        assert(geometry.y >= 0 && geometry.x >= 0 && geometry.bottom <= geometry.height && geometry.right <= geometry.width,
          JSON.stringify({ size, geometry }));
        assert(landscape ? geometry.x >= geometry.textRight + 20 : geometry.bottom < geometry.nameTop,
          JSON.stringify({ size, geometry }));
        assert(geometry.scrollWidth <= geometry.width, `Overflow at ${size.width}x${size.height}`);
        await phone.screenshot({ path: path.join(output, `${name}-${size.width}x${size.height}.png`), fullPage: true });
        await idle(phone);
        for (const kind of ['build', 'think', 'path']) {
          await phone.locator(`[data-play=${kind}]`).tap();
          await waitState(phone, 'animation', 'complete');
          assert.equal(phone.url(), base);
          if (landscape) {
            const menuGeometry = await phone.evaluate(() => {
              const stage = document.querySelector('.sketch-stage').getBoundingClientRect();
              const textRight = Math.max(...['.tree-home__about', '.tree-home__branches', '.tree-home__contact']
                .map(selector => document.querySelector(selector).getBoundingClientRect().right));
              return { left: stage.left, top: stage.top, right: stage.right, bottom: stage.bottom,
                textRight, width: innerWidth, height: innerHeight };
            });
            assert(menuGeometry.left >= menuGeometry.textRight + 20 && menuGeometry.top >= 0 &&
              menuGeometry.right <= menuGeometry.width && menuGeometry.bottom <= menuGeometry.height,
            JSON.stringify({ size, kind, menuGeometry }));
          }
          if (kind === 'build') await phone.screenshot({ path: path.join(output, `${name}-build-${size.width}x${size.height}.png`), fullPage: true });
          await idle(phone);
        }
      }
      record(`${name}: first/repeat mobile visits, narrow/landscape geometry, menu sketches and restoration passed`);
      assert.deepEqual(errors, []);
      fs.writeFileSync(path.join(output, `${name}-input-events.json`), JSON.stringify(await page.evaluate(() => window.qaEvents), null, 2));
      await mobile.close();
      await desktop.close();
    } catch (error) {
      // Preserve the live state before closing a failed test's browser.
      for (const [index, page] of browser.contexts().flatMap(c => c.pages()).entries()) {
        try {
          await page.screenshot({ path: path.join(output, `${name}-failure-${index}.png`), fullPage: true });
          const diagnostics = await page.evaluate(() => ({
            url: location.href,
            state: { ...document.querySelector('[data-intro-sketches]')?.dataset },
            focused: document.activeElement?.outerHTML,
            events: window.qaEvents || []
          }));
          fs.writeFileSync(path.join(output, `${name}-failure-${index}.json`), JSON.stringify(diagnostics, null, 2));
        } catch {}
      }
      throw error;
    } finally { await browser.close(); }
  }
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(notes, null, 2));
  console.log(`Artifacts: ${output}`);
})().catch(error => {
  fs.writeFileSync(path.join(output, 'failure.txt'), error.stack);
  console.error(error);
  process.exitCode = 1;
});
