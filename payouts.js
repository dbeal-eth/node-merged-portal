var async = require('async');
var request = require('request');

var daemon = require('merged-pool/lib/daemon');

var db = require('./db');

var utils = require('./utils');


module.exports.run = function() {
    var coins = JSON.parse(process.env.coins);
    var options = JSON.parse(process.env.payouts);
    // Connect to daemons
    async.each(coins, function(coin, callback) {
        var d = new daemon.interface(coin.daemons, function(severity, message) {
            console.log('[' + severity + '] Daemon: ' + message);
        });
        d.once('online', function() {
            coin.daemon = d;
            callback();
        }).on('connectionFailed', function(err) {
            console.log('[ERROR] Daemon Connection Error: ' + err);
        }).on('error', function(err) {
            console.log('[ERROR] Daemon Error: ' + err);
        });

        d.init();
    }, function(err) {
        // Currently, an error cannot be passed.
        setInterval(function() {
            console.log('Running payouts...');
            // Run for each currency
            async.each(coins, function(coin, callback) {
                db.processBlocks(coin.symbol, coin.daemon, function(err) {
                    // Currently, this function doesnt actually pass an error
                    // Check balances. Do they meet the threshold in options?
                    db.getUsersWithBalance(coin.symbol, function(err, users) {
                        var u = [];
                        var payouts = {};
                        async.each(users, function(user, callback) {
                            db.getBalance(coin.symbol, user, function(err, balance) {
                                balance = parseInt(balance);
                                if(err) {
                                    callback(err);
                                    return;
                                }
                                if(balance >= options.threshold) {
                                    // Query addie.cc to get user payout address
                                    request('http://addie.cc/api/' + user + '/' + coin.symbol, function(error, response, body) {
                                        if(!error && response.statusCode == 200) {
                                            // The body contains the payout address
                                            payouts[body] = utils.round(balance, 8);
                                            u.push(user);
                                        }
                                        callback();
                                    });
                                }
                            });
                        }, function(err) {
                            if(err) {
                                callback(err);
                                return;
                            }

                            coin.daemon.cmd('sendmany', ['', payouts], function(result) {
                                if(result[0].error) {
                                    console.log('Could not send payouts: ' + JSON.stringify(result[0].error));
                                    callback(result[0].error);
                                    return;
                                }
                                // Put the response in the database
                                db.pushPayout(result[0].response, payouts);
                                // Payouts were sent in success. Clear all the balances
                                u.forEach(function(user) {
                                    db.clearBalance(coin.symbol, user);
                                });

                            });
                        });
                    });
                });
            }, function(err) {
                console.log('Finished payouts');
            });
        }, options.interval * 1000); // Execute payouts as specified by the user in the main configuration file
    });
};
