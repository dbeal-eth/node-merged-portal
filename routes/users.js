var express = require('express');
var router = express.Router();

var db = require('../db');

var utils = require('../utils');

/* GET users prompt */
router.get('/', function(req, res) {
    res.send('Use /user/<username> to look at your stats');
});

/* GET user specific statistics */
router.get('/:user', function(req, res) {
    db.getUserStats(allCoins, req.params.user, function(data) {
        /*if(!data) res.send('User does not exist');
        else res.send(JSON.stringify(data, null, 4));*/
        if(!data) {
            res.send('User not found');
            return;
        }
        data.name = req.params.user;
        data.hashrate = utils.hashrateString(data.hashrate);
        res.render('user', data);
    });
});

module.exports = router;
