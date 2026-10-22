const handler = require('../../server.js');

module.exports = (req, res) => {
  req.url = '/api/auth/me';
  return handler(req, res);
};
