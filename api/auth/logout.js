const handler = require('../../server.js');

module.exports = (req, res) => {
  req.url = '/api/auth/logout';
  return handler(req, res);
};
