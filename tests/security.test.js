const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { JSDOM } = require("jsdom");

const root = path.join(__dirname, "..");
const PAYLOADS = [
  "<img src=x onerror=alert(1)>",
  "<script>alert('XSS_TEST')</script>",
  '"><svg onload=alert(1)>',
];

async function load(file) {
  // only local files may load (external CDN requests stay blocked in tests)
  const resources = file.startsWith("public/") ? "usable" : undefined;
  return JSDOM.fromFile(path.join(root, file), { runScripts: "dangerously", resources });
}
function addTaskViaUi(dom, text) {
  const { document } = dom.window;
  document.getElementById("taskInput").value = text;
  document.getElementById("addTaskBtn")
    ? document.getElementById("addTaskBtn").click()
    : dom.window.addTask(); // vulnerable page uses an inline onclick
}
async function loaded(dom) {
  if (dom.window.document.readyState !== "complete") await new Promise((r) => dom.window.addEventListener("load", r));
}

// ---------- F1: XSS ----------
test("F1 BEFORE: vulnerable page turns payload into live HTML (reproduction)", async () => {
  const dom = await load("evidence/app.vulnerable.html");
  await loaded(dom);
  addTaskViaUi(dom, PAYLOADS[0]);
  const injected = dom.window.document.querySelector("#taskList img[onerror]");
  assert.ok(injected, "expected injected <img onerror> element in vulnerable page");
});

test("F1 AFTER: fixed page shows every payload as literal text, no elements created", async () => {
  for (const p of PAYLOADS) {
    const dom = await load("public/app.html");
    await loaded(dom);
    addTaskViaUi(dom, p);
    const item = dom.window.document.querySelector("#taskList li:last-child");
    assert.strictEqual(item.textContent, p);
    assert.strictEqual(item.querySelectorAll("img, script, svg").length, 0, `markup created for ${p}`);
    assert.strictEqual(item.querySelector("span").children.length, 0);
  }
});

test("F1 AFTER: input is length-limited", async () => {
  const dom = await load("public/app.html");
  await loaded(dom);
  assert.strictEqual(dom.window.document.getElementById("taskInput").maxLength, 200);
  addTaskViaUi(dom, "a".repeat(500));
  assert.strictEqual(dom.window.document.querySelector("#taskList li:last-child").textContent.length, 200);
});

// ---------- F3: static hardening of the page ----------
const html = fs.readFileSync(path.join(root, "public/app.html"), "utf8");
test("F3 page has a CSP and no external resources", () => {
  assert.match(html, /http-equiv="Content-Security-Policy"/);
  assert.doesNotMatch(html, /(src|href)\s*=\s*"(https?:)?\/\//i, "external resource found");
});
test("F3 no inline scripts or inline event handlers (strict CSP possible)", () => {
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i, "inline <script> found");
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i, "inline on* handler found");
});
test("F3 app.js never uses innerHTML/outerHTML/insertAdjacentHTML/eval/document.write", () => {
  const js = fs.readFileSync(path.join(root, "public/app.js"), "utf8");
  assert.doesNotMatch(js, /innerHTML|outerHTML|insertAdjacentHTML|eval\(|document\.write|new Function/);
});

// ---------- F2/F4: project + server ----------
test("F2 package.json is valid JSON and test script is real", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.doesNotMatch(pkg.scripts.test, /no test specified/);
  assert.ok(fs.existsSync(path.join(root, "package-lock.json")), "lockfile missing");
});

test("F4 server sends security headers and hides sensitive paths", async () => {
  const app = require("../server");
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.on("listening", r));
  const port = server.address().port;
  const get = (p) => new Promise((resolve, reject) =>
    http.get({ host: "127.0.0.1", port, path: p }, (res) => {
      let body = ""; res.on("data", (c) => (body += c)); res.on("end", () => resolve({ res, body }));
    }).on("error", reject));
  try {
    const { res } = await get("/");
    assert.strictEqual(res.statusCode, 200);
    assert.match(res.headers["content-security-policy"], /default-src 'none'/);
    assert.strictEqual(res.headers["x-content-type-options"], "nosniff");
    assert.strictEqual(res.headers["x-frame-options"], "DENY");
    assert.strictEqual(res.headers["x-powered-by"], undefined);
    for (const p of ["/package.json", "/server.js", "/.env", "/..%2fpackage.json", "/%2e%2e/package.json"]) {
      const r = await get(p);
      assert.notStrictEqual(r.res.statusCode, 200, `${p} must not be served`);
      assert.doesNotMatch(r.body, /defensive-security-capstone/);
    }
  } finally { server.close(); }
});
