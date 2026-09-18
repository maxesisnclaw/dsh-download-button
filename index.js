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
 * script; in the browser a MutationObserver appends an `<a download>` to the action bar of
 * every `[data-presented-file]` card. The anchor clones the sibling action button's
 * computed style (so it looks like a button, not a blue link) and its label follows the
 * interface language (`打开` → `下载`, `Open` → `Download`).
 */
export const name = 'dsh-download-button'

const SCRIPT = `<script>
(() => {
  const FLAG = 'dlBtnAdded';
  const buildHref = (p) => '/api/file?path=' + encodeURIComponent(p);

  // The action bar's own button carries an \`open\` CSS-module class. Fall back to its label.
  // NOTE: do not fall back to [aria-label] — the card itself is covered by a full-size
  // preview button that also has an aria-label, and grabbing it puts the link in the wrong spot.
  function actionButton(card) {
    const byClass = card.querySelector('button[class*="open"]');
    if (byClass) return byClass;
    return [...card.querySelectorAll('button')].find((b) => /^(打开|Open)$/.test((b.textContent || '').trim())) || null;
  }

  function addButton(card) {
    if (card.dataset[FLAG]) return;
    const btn = actionButton(card);
    if (!btn || !btn.parentElement) return;
    // The card already carries the absolute path: the preview button's title is
    // resolveWorkspacePath(cwd, file.path).
    const holder = card.querySelector('[class*="cardPreview"]') || card.querySelector('[title]');
    const path = holder && holder.getAttribute('title');
    if (!path || path[0] !== '/') return;

    const chinese = /打开/.test(btn.textContent || '');
    const cs = getComputedStyle(btn);
    const a = document.createElement('a');
    a.className = btn.className;
    a.href = buildHref(path);
    a.setAttribute('download', path.split('/').pop() || 'download');
    a.textContent = chinese ? '下载' : 'Download';
    a.title = chinese ? '下载到本地' : 'Download this file';
    a.style.color = cs.color;
    a.style.backgroundColor = cs.backgroundColor;
    a.style.font = cs.font;
    a.style.padding = cs.padding;
    a.style.borderRadius = cs.borderRadius;
    a.style.border = cs.border;
    a.style.display = cs.display;
    a.style.alignItems = cs.alignItems;
    a.style.justifyContent = cs.justifyContent;
    a.style.lineHeight = cs.lineHeight;
    a.style.cursor = 'pointer';
    a.style.textDecoration = 'none';
    btn.parentElement.insertBefore(a, btn);
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
