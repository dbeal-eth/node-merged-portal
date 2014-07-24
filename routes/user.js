var express = require('express');
var router = express.Router();

/* GET users prompt */
router.get('/', function(req, res) {
    res.send('respond with a resource');
});

/* GET user specific statistics */
router.get('/:user', function(req, res) {
    
});

module.exports = router;
