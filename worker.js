var Stratum = require('merged-pooler');

var request = require('request');

var db = require('./db');

var ADDR_API = 'http://addie.cc/api/';

module.exports.run = function() {
    //console.log('OPTIONS: ' + process.env.options);
    var options = JSON.parse(process.env.options);
    var pool = Stratum.createPool(options, function(ip, port, user, password, callback) {
        console.log('AUTH from ' + ip + ':' + port + ' with user: ' + user);
        // Make sure the required addresses are available on addie.cc
        request(ADDR_API + user, function(err, res, body) {
            if(!err && res.statusCode == 200) {
                var data = JSON.parse(body);
                // Check for required keys
                var found = true;
                if(!data[options.coin.symbol]) found = false;
                options.auxes.forEach(function(aux) {
                    if(!data[aux.symbol]) found = false;
                });
                console.log('AUTH result: ' + found);
                callback({
                    error: found ? null : 'Not all required addresses are present on addie.cc',
                    authorized: found,
                    disconnect: !found
                });
            }
            else callback({
                error: "Could not access user on addie.cc",
                authorized: false,
                disconnect: true
            });
        });
    });

    pool.on('share', function(isValidShare, isValidBlock, data) {
        // We dont care if it is actually a valid block
        if(isValidShare) {
            // TODO: Factor in fees
            db.pushShare(options.coin.symbol, data.worker, data.difficulty);
        }
    });

    pool.on('block', function(coin, height, blockHash, txHash, value, difficulty, user) {
        console.log('BLOCK found by ' + user + ' on ' + coin + ', VALUE: ' + value);
        // Pass this directly to the database; it will do the rest
        db.pushBlock(options.coin.symbol, coin, height, blockHash, txHash, value, difficulty, user);
    });

    pool.on('log', function(severity, key, text) {
        console.log('[' + options.coin.symbol + '] Message: ' + text);
    });

    pool.start();
};
