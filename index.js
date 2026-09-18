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

/**
 * dsh mounts its desktop-integration surface only when the host process can reach a
 * display (`dsh-host-directory-picker-auto` uses exactly this rule on Linux). On a
 * headless server the cards still render a "this host has no available desktop"
 * notice plus a permanently disabled actions menu, which only misleads users: there is
 * no desktop to open the file on. When that is the case we hide the notice and keep the
 * Download button as the way out.
 */
const HAS_DESKTOP =
  process.platform === 'darwin' ||
  process.platform === 'win32' ||
  Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY)

const SCRIPT = `<script>
(() => {
  const FLAG = 'dlBtnAdded';
  const NO_DESKTOP = ${HAS_DESKTOP ? 'false' : 'true'};
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
    // Clone the sibling action button: same element type and classes, so the look
    // (including theme/hover rules) is identical by construction, and it lands in the
    // action bar instead of floating over the card.
    const clone = btn.cloneNode(false);
    clone.removeAttribute('aria-label');
    clone.removeAttribute('aria-expanded');
    clone.removeAttribute('aria-haspopup');
    clone.textContent = chinese ? '下载' : 'Download';
    clone.title = chinese ? '下载到本地' : 'Download this file';
    clone.style.textDecoration = 'none';
    clone.style.cursor = 'pointer';
    clone.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const link = document.createElement('a');
      link.href = buildHref(path);
      link.download = path.split('/').pop() || 'download';
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
    btn.parentElement.insertBefore(clone, btn);
    card.dataset[FLAG] = '1';
  }

  function scan(root) {
    if (!root.querySelectorAll) return;
    root.querySelectorAll('[data-presented-file]').forEach(addButton);
    if (NO_DESKTOP) hideDesktopNotice(root);
  }

  /**
   * Hide the "no desktop available" notice. The group renders two different
   * [class*=hostStatus] spans: the real error one embeds a Retry button, the notice is
   * plain text — so only the button-less one is suppressed.
   */
  function hideDesktopNotice(root) {
    const scope = root.querySelectorAll ? root : document;
    scope.querySelectorAll('[class*="hostStatus"]').forEach((el) => {
      if (el.querySelector('button')) return;
      el.style.display = 'none';
    });
  }

  new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) scan(n);
    if (NO_DESKTOP) hideDesktopNotice(document);
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => scan(document));
  scan(document);
  console.log('dsh-download-button: enabled (download buttons' + (NO_DESKTOP ? ', headless notice hidden' : '') + ')');
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
