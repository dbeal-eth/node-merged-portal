var express = require('express');
var router = express.Router();

var db = require('../db');

/* GET nothing */
router.get('/', function(req, res) {
    res.send('Use /payouts/<coin> to get list of payouts for coin');
    res.send('Use /payouts/<coin>/<id> to get payouts to specific addresses');
});

/* GET payout addresses */
router.get('/:coin', function(req, res) {
    db.listPayouts(req.params.coin, function(err, payouts) {
        if(!payouts) res.send('Coin does not exist, or no payouts have been sent for this coin yet');
        else res.send(JSON.stringify(payouts, null, 4));
    });
});

router.get('/:coin/:id', function(req, res) {
    db.getPayout(req.params.coin, req.params.id, function(err, payout) {
        if(!payout) res.send('Payout does not exist');
        else res.send(JSON.stringify(payout, null, 4));
    });
});

module.exports = router;
