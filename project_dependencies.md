# Project Dependencies

Source of truth: `package.json` and `package-lock.json` (185 packages total: 68 production, 117 dev).

## Direct dependencies
| Package | Type | Requirement | Installed | Purpose |
|---|---|---|---|---|
| express | production | `^4.21.2` | 4.22.3 | Static server with security headers (`server.js`) |
| tailwindcss | dev | `^3.4.17` | 3.4.19 | Build-time CSS (`npm run build:css`), replaces the CDN script |
| jsdom | dev | `^25.0.1` | 25.0.1 | Runs the XSS tests against the real page code |

## Audit results (`npm audit`, 2026-11-02)
| State | Express | Result |
|---|---|---|
| Before | 4.19.2 | 7 vulnerabilities: 3 high, 1 moderate, 3 low (`body-parser`, `path-to-regexp`, `qs`, `cookie`, `express`) |
| After | 4.22.3 | **0 vulnerabilities** |

Raw output: `evidence/npm-audit-before.txt`, `evidence/npm-audit-after.txt`.

## Maintenance
- Commit `package-lock.json` and install with `npm ci` for reproducible builds.
- Run `npm audit` regularly (`npm run audit`) and update on new advisories.
- Rebuild CSS after changing any markup classes: `npm run build:css`.
