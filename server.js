// Minimal static server for the capstone app. Binds to localhost only.
const express = require("express");
const path = require("path");

const app = express();
app.disable("x-powered-by");

app.use((req, res, next) => {
  res.set({
    "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cache-Control": "no-store",
  });
  next();
});

app.use(express.static(path.join(__dirname, "public"), { index: "app.html", dotfiles: "deny" }));

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, "127.0.0.1", () => console.log(`Listening on http://127.0.0.1:${PORT}`));
}
