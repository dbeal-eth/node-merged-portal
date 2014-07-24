var express = require('express');
var router = express.Router();

var db = require('../db');

/* GET users prompt */
router.get('/', function(req, res) {
    res.send('Use /users/<username> to look at your stats');
});

/* GET user specific statistics */
router.get('/:user', function(req, res) {
    db.getUserStats(allCoins, req.params.user, function(data) {
        if(!data) res.send('User does not exist');
        else res.send(JSON.stringify(data, null, 4));
    });
});

module.exports = router;
