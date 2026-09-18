# dsh-download-button

English | [中文](README.zh.md)

A **Download** button for delivered-file cards in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`) web.

## The problem

When an agent produces a file, `dsh` renders a card with two actions:

| Action | What it does | Why it is not enough |
|---|---|---|
| `Open` | Asks the **host** machine to open the file with its default application | A headless server has no desktop, so this always fails |
| `Open in sidebar` | Text preview | Non-text files (docx / xlsx / pdf / zip …) answer *"non-text file, cannot preview"* |

So a docx the agent just wrote has **no way out of the browser**.

## What this plugin does

It appends a **Download** link to every delivered-file card. Clicking it saves the file
straight from the server to your disk.

```
[ Download ] [ Open ▾ ]
```

## Design (why it survives upgrades)

- **No vendor patching.** Nothing under `node_modules` is modified. The plugin only taps
  the server-rendered index page and injects a small script.
- **No server route of its own.** It reuses the built-in authenticated raw-bytes route
  `GET /api/file?path=<absolute path>` (correct `Content-Type`, cookie-authenticated), with
  the HTML `download` attribute supplying the filename.
- **No bundled-class-name assumptions.** The button copies its `className` from the sibling
  action button already present in that card, so it follows theme/style changes.
- The absolute path is read from the card's own `title` attribute (which `dsh` already sets
  to the resolved workspace path).

## Install

```sh
dsh plugin --profile web add github:maxesisnclaw/dsh-download-button
```

Manual install:

1. Copy this directory to `<dsh-install>/plugins/dsh-download-button/`.
2. Add to `$DSH_HOME/cordis.patch.yml`:

   ```yaml
   - insert:
       - id: download-button
         name: /absolute/path/to/dsh-download-button/index.js
   ```

3. Restart the service: `systemctl restart dsh` (or restart your `dsh web` process).

When the package is listed in a profile's `dsh.profile.bundles` instead, the bundled
[`cordis.patch.yml`](cordis.patch.yml) applies the same insert automatically.

## Verify

- Open the web UI, have the agent produce any non-text file (docx, xlsx, pdf), and look for
  the **Download** button on the file card; clicking it should save the file.
- Server-side check that the underlying route works:

  ```sh
  curl -b "<your session cookie>" \
    "http://127.0.0.1:3080/api/file?path=/absolute/path/to/file.docx" -o out.docx
  # out.docx must be byte-identical to the source file
  ```

- Unit test: `npm test` (checks the index-page injection is applied once, and is idempotent).

## Limitations

- The card must expose the file's absolute path in a `title` attribute (that is how the
  current `dsh` renders delivered files). If a future version changes the card markup,
  update the selector in the injected script.
- Only delivered-file cards get the button; other surfaces (e.g. a sidebar preview of a
  text file) are untouched.

## License

MIT
