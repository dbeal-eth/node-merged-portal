var express = require('express');
var router = express.Router();

var db = require('../db');

/* GET nothing yet */
router.get('/', function(req, res) {
    res.send('Use /blocks/<coin> to get a block list');
    res.send('Use /blocks/<coin>/<height> to get payouts for a specific block');
});

/* GET block list */
router.get('/:coin', function(req, res) {
    db.getCurrentBlockList(req.params.coin, function(blocks) {
        if(!blocks) res.send('Coin is not being mined by this pool, or no blocks have been found for this coin');
        else res.send(JSON.stringify(blocks, null, 4));
    });
});

/* GET block payouts */
router.get('/:coin/:height', function(req, res) {
    db.getBlockPayouts(req.params.coin, req.params.height, function(data) {
        if(!data) res.send('Block does not exist, or block not found by this pool');
        else {
            data.height = req.params.height;
            res.render('block', data);
        }
    });
});

module.exports = router;
