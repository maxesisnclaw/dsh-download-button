/**
 * dsh-download-button — add a "Download" action to delivered-file cards in DeepSeek Harness.
 *
 * Why: the built-in card only offers
 *   - `Open`            → asks the HOST machine to open the file with its default app
 *                         (a headless server has no desktop, so this always fails), and
 *   - `Open in sidebar` → a text preview, which refuses non-text files
 *                         ("non-text file, cannot preview").
 *
 * The server already exposes an authenticated raw-bytes route
 * `GET /api/file?path=<absolute path>` that returns the correct Content-Type, so the
 * only thing missing is a download link.
 *
 * How: patch nothing. During server-side index rendering this plugin injects a small
 * script; in the browser a MutationObserver appends an `<a download>` to every
 * `[data-presented-file]` card, pointing at `/api/file?path=<abs path from the card's
 * title attribute>`. Styling is copied from the sibling button already in that card, so
 * nothing depends on bundled CSS-module hashes — it keeps working across dsh upgrades.
 */
export const name = 'dsh-download-button'

const SCRIPT = `<script>
(() => {
  const FLAG = 'dlBtnAdded';
  const BUTTON_TEXT = 'Download';
  const buildHref = (p) => '/api/file?path=' + encodeURIComponent(p);

  function addButton(card) {
    if (card.dataset[FLAG]) return;
    // The card already carries the absolute path: the preview button's title is
    // resolveWorkspacePath(cwd, file.path).
    const holder = card.querySelector('[class*="cardPreview"]') || card.querySelector('[title]');
    const path = holder && holder.getAttribute('title');
    if (!path || path[0] !== '/') return;
    const openBtn = card.querySelector('button[class*="open"], button[aria-label]');
    const a = document.createElement('a');
    if (openBtn && openBtn.className) a.className = openBtn.className;
    a.href = buildHref(path);
    a.setAttribute('download', path.split('/').pop() || 'download');
    a.textContent = BUTTON_TEXT;
    a.title = 'Download this file';
    a.style.textDecoration = 'none';
    a.style.cursor = 'pointer';
    const host = (openBtn && openBtn.parentElement) || card;
    host.insertBefore(a, openBtn || null);
    card.dataset[FLAG] = '1';
  }

  function scan(root) {
    if (!root.querySelectorAll) return;
    root.querySelectorAll('[data-presented-file]').forEach(addButton);
  }

  new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) scan(n);
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => scan(document));
  scan(document);
  console.log('dsh-download-button: enabled download buttons on file cards');
})();
</script>`

export function apply(ctx) {
  ctx.inject(['webServer'], (cctx) => {
    cctx.webServer.tapIndex((page) => {
      if (page.includes('dsh-download-button')) return page
      return page.includes('<head>')
        ? page.replace('<head>', `<head>\n    <!-- dsh-download-button -->\n    ${SCRIPT}`)
        : `${SCRIPT}\n${page}`
    })
  })
}
