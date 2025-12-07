const app = require("../app");

module.exports = (req, res) => {
  const url = req.url || "";
  if (!url.startsWith("/api")) {
    req.url = "/api" + url;
  }
  return app(req, res);
};
