const handler = require('../../server.js');

module.exports = (req, res) => {
  req.url = '/api/admin/audit';
  return handler(req, res);
};
