const handler = require('../server.js');

module.exports = (req, res) => {
  req.url = '/healthz';
  return handler(req, res);
};
