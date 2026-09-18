import assert from 'node:assert/strict'
import { test } from 'node:test'

import { apply, name } from '../index.js'

/** Minimal stand-in for the cordis context: captures the index transform. */
function tapIndexOf() {
  let tap = null
  const ctx = {
    inject: (services, callback) => {
      assert.deepEqual(services, ['webServer'])
      callback({ webServer: { tapIndex: (fn) => { tap = fn } } })
    },
  }
  apply(ctx)
  assert.equal(typeof tap, 'function', 'plugin must tap the served index page')
  return tap
}

test('plugin exposes a name', () => {
  assert.equal(name, 'dsh-download-button')
})

test('injects the script into <head>', () => {
  const tap = tapIndexOf()
  const page = '<!doctype html><html><head><title>dsh</title></head><body></body></html>'
  const out = tap(page)
  assert.match(out, /dsh-download-button/)
  assert.match(out, /\/api\/file\?path=/)
  assert.ok(out.indexOf('dsh-download-button') < out.indexOf('</head>'), 'script must land before </head>')
})

test('is idempotent (no double injection)', () => {
  const tap = tapIndexOf()
  const page = '<html><head></head><body></body></html>'
  const once = tap(page)
  assert.equal(tap(once), once)
})

test('falls back to prefixing when there is no <head>', () => {
  const tap = tapIndexOf()
  const out = tap('<html><body></body></html>')
  assert.ok(out.startsWith('<script>'), 'script should be prefixed when <head> is absent')
})
