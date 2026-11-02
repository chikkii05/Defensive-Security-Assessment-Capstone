# Defensive Security Assessment Capstone

Assessment of a small local task manager: findings, fixes with before/after evidence, and automated retests.

## Deliverables
- **[Security Report](./SECURITY_REPORT.md)**: scope, authorization, methodology, 5 findings with remediation and retest results.
- **[Project Dependencies](./project_dependencies.md)**: dependency list and `npm audit` before/after.
- **[Fixed application](./public/app.html)** (`public/`): hardened app with strict CSP, no inline code, no HTML-injection sinks.
- **[Security tests](./tests/security.test.js)**: 8 automated checks (XSS before/after, CSP, headers, path exposure, package validity).
- **[Evidence](./evidence/)**: test output, live response headers, `npm audit` before/after, reconstructed vulnerable page (never deploy).

## Run
```bash
npm install
npm test          # 8 security checks
npm start         # http://127.0.0.1:3000
npm run audit     # dependency audit
```

## Key results
| Finding | Severity | Result |
|---|---|---|
| F1 DOM XSS (`innerHTML`) | High | Fixed (`textContent`), 3 payloads retested |
| F2 Express 4.19.2 (7 advisories) | High | Upgraded to 4.22.3, 0 vulnerabilities |
| F3 CDN script, inline code, no CSP | Medium | Local CSS build, strict CSP |
| F4 Missing headers | Low | Added in `server.js` |
| F5 Broken `package.json`, fake test | Low | Fixed |

Local use only. Do not deploy as-is (no authentication or logging).
