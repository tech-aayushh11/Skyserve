const handler = require('../../server.js');

module.exports = (req, res) => {
  if (!req.url || !req.url.startsWith('/api/admin/users')) {
    req.url = '/api/admin/users';
  }
  return handler(req, res);
};
