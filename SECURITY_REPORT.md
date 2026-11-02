# Defensive Security Assessment Report

**Target:** Local Task Manager web application (`http://127.0.0.1:3000`)
**Assessment date:** 2026-11-02
**Assessor:** Student Security Practitioner
**Status:** Findings remediated and retested (8/8 automated checks pass)

## 1. Scope, Authorization, and Rules of Engagement

**Authorization statement:** I am the owner and sole developer of this local application and I authorize this assessment. Testing covers only the local environment (`127.0.0.1`). No third-party systems are included.

**In scope (files in this repository):** `public/app.html`, `public/app.js`, `server.js`, `package.json` / `package-lock.json`.
**Out of scope:** production hosting, third-party services (including the Tailwind CDN itself), denial-of-service testing.

**Rules of engagement:** localhost only; no destructive or flooding tests; dummy data only (no real credentials, PII or secrets).

## 2. Methodology
| Category | What was checked | How |
|---|---|---|
| Configuration | Security headers, CSP, exposed files, information disclosure | Live `curl` against the running server; header assertions in tests |
| Authentication | Login / session handling | **Not applicable:** the app has no accounts, sessions or passwords |
| Input validation | XSS in the task field, input length | Payloads run through the real page code in jsdom (before and after) |
| Dependencies | Known vulnerabilities, lockfile, unused packages | `npm audit` on the before and after dependency sets |
| Logging | Security event logging | **Not applicable / gap:** a static demo with no server-side events (see section 5) |
| Secrets | Hardcoded keys or tokens | Pattern scan of all source files: no matches |

All results are reproducible: `npm install && npm test` runs the checks, and the raw outputs are in `evidence/`.

## 3. Summary of Findings
| ID | Finding | Severity | Status |
|---|---|---|---|
| F1 | DOM-based XSS from unsanitized `innerHTML` | High | Fixed, retested |
| F2 | Vulnerable Express version (7 advisories) | High | Fixed, retested |
| F3 | Unpinned third-party CDN script, inline handlers, no CSP | Medium | Fixed, retested |
| F4 | No security headers / `X-Powered-By` disclosure | Low | Fixed, retested |
| F5 | Broken `package.json`, fake test script, unused dependency | Low | Fixed |

## 4. Findings & Remediation

### F1: DOM-based Cross-Site Scripting (High)
**Category:** Input validation
**Description:** The task text was inserted into the page with `innerHTML`, so HTML typed into the task field became live markup. This is DOM-based XSS: the input is processed entirely in the browser, so it is not "reflected" from a server response.
**Reproduction (dummy payload, local only):** enter `<img src=x onerror=alert(1)>` as a task. Test 1 confirms an `<img onerror>` element is created in the task list.
**Note on payloads:** a `<script>alert()</script>` payload inserted through `innerHTML` does **not** execute in browsers (scripts added this way are inert), so event-handler payloads like `<img onerror>` are the reliable proof. Both kinds are tested.
**Before:** `li.innerHTML = '<span>' + taskText + '</span>'` (reconstructed in `evidence/app.vulnerable.html`; the original vulnerable file was not in the repository, so this is rebuilt from the original report's snippet).
**After (`public/app.js`):**
```js
const span = document.createElement("span");
span.textContent = taskText;   // text-only sink: markup is displayed, never parsed
li.appendChild(span);
```
Also added `maxlength="200"` on the input and a matching `slice(0, 200)` in code.
**Retest:** three payloads (`<img onerror>`, `<script>`, `<svg onload>`) render as literal text, with zero `img/script/svg` elements created. Tests 2 and 3 pass.

### F2: Vulnerable dependency (High)
**Category:** Dependencies
**Description:** With Express pinned at `4.19.2`, `npm audit` reports **7 vulnerabilities (3 high, 1 moderate, 3 low)** in `express` and its dependencies `body-parser` (denial of service), `path-to-regexp` (ReDoS), `qs` (denial of service), `cookie` (out-of-bounds characters), plus `send` / `serve-static`. (The earlier report called this "prototype pollution"; npm's actual advisories are denial-of-service and ReDoS issues.)
**Remediation:** raised the requirement to `express ^4.21.2`, which resolves to **4.22.3**, and committed `package-lock.json` so installs are reproducible.
**Evidence:** `evidence/npm-audit-before.txt` vs `evidence/npm-audit-after.txt`.
**Retest:** `npm audit` reports **0 vulnerabilities** on the current tree (68 production and 117 dev packages, 185 total). This reflects the advisory database on the assessment date, so re-run it regularly.

### F3: Third-party script, inline code and no CSP (Medium)
**Category:** Configuration / supply chain
**Description:** The page loaded `https://cdn.tailwindcss.com` with no version pin or Subresource Integrity, so a compromised or changed CDN response would run with full access to the page. Tailwind documents that script as a development tool. The page also relied on an inline `onclick` and an inline `<script>`, which prevents a strict Content-Security-Policy.
**Remediation:**
- Tailwind is now compiled at build time (`npm run build:css`) into a local `public/styles.css`, so the page loads no external resources.
- The inline script moved to `public/app.js`, and `onclick` was replaced with `addEventListener`.
- Added a strict CSP: `default-src 'none'; script-src 'self'; style-src 'self'; ...`, with no `unsafe-inline`.
**Retest:** tests 4 to 6 confirm a CSP is present, there are no external URLs, no inline scripts or `on*` handlers, and `app.js` uses no HTML-parsing or code-evaluation sinks.

### F4: Missing security headers and technology disclosure (Low)
**Category:** Configuration
**Description:** A default Express static server sends `X-Powered-By: Express` and none of the common protective headers (this is Express's standard behaviour, not something observed on the original, which had no server code in the repository).
**Remediation (`server.js`):** `x-powered-by` disabled; added `Content-Security-Policy` (also as an HTTP header, because `frame-ancestors` is ignored in a `<meta>` CSP), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy`, and `Cache-Control: no-store`. The server binds to `127.0.0.1` only and denies dotfiles.
**Retest:** `evidence/headers.txt` shows the headers on a live response. `/package.json`, `/server.js`, `/.env` and encoded path-traversal attempts all return 404. Test 8 passes.

### F5: Project hygiene (Low)
**Description and fixes:**
- `package.json` was **invalid JSON** (unescaped quotes in the `test` script, so `npm` could not read it). Fixed.
- The `test` script was a placeholder that printed an error but exited 0, giving false assurance. It now runs the real security tests.
- `express` was declared, but the repository had no server. Now `server.js` exists and uses it.
- `tailwindcss` was a dev dependency that was not used (the CDN was). It is now used for the local build.
- Duplicate files (`app.html` and `sample_local_application.html` were byte-identical) were reduced to one copy.

## 5. Residual Risks and Limitations
- **CSP not browser-enforced in tests.** jsdom does not enforce CSP, so the policy was verified by header inspection and static checks. A quick manual check in a real browser is still recommended.
- **No authentication, persistence or logging.** Tasks vanish on reload and no events are logged. Any real version needs authentication, server-side validation, and security event logging (failed logins, privilege changes) without sensitive payloads.
- **Reconstructed "before" file.** F1's vulnerable version was rebuilt, not recovered.
- **Dependencies drift.** The 0-vulnerability result is a point-in-time result; schedule `npm audit` in CI.
- The tests are evidence for this scope only, not proof the app is free of all vulnerabilities.

## 6. Conclusion
Five findings (2 high, 1 medium, 2 low) were identified, fixed and retested within the stated scope. The automated checks pass 8 of 8 and `npm audit` reports no known vulnerabilities. The application is suitable as a local demo; it is **not** production-ready until authentication, logging and the items in section 5 are addressed.
