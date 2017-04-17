var express = require('express');
var router = express.Router();
var proxy = require('express-http-proxy');
var url = require('url');

router.get(['/', '/*'], proxy('localhost:3001', {
  forwardPath: function(req, res) {
    // Forward requests to /api to API server target
    return url.parse(req.url).path
  }
}));

module.exports = router;
