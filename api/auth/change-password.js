const handler = require('../../server.js');

module.exports = (req, res) => {
  req.url = '/api/auth/change-password';
  return handler(req, res);
};
