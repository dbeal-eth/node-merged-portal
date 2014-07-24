var PPLNS_SHARES = 100000;

var SHARELOG_MAX_LENGTH = 20000;
var GRAPH_MAX_LENGTH = 20000; // Space is not a huge issue ATM... probobly should be keeping more details anyway.

// Functions to modify the database

var redis = require('redis');

var async = require('async');

var utils = require('./utils');

var db = redis.createClient();

db.on('error', function(err) {
	console.error('Database Error: ' + err);
	console.error(err.stack);
});

module.exports = {
    pushShare: function(coin, user, value) {
        // sharelog
        db.lpush(coin + ':sharelog', [user, value.toString()].join(':'));
        db.ltrim(coin + ':sharelog', 0, SHARELOG_MAX_LENGTH);
        // other stats
        db.incrbyfloat('totalshares', value.toString());
        db.incrbyfloat('totalshares:' + user, value.toString());
    },

    // value is assuming the fee was already removed
    pushBlock: function(primary, aux, height, hash, txHash, value, difficulty, user) {

        var fs = require('fs');
        fs.readFile(__dirname + '/shares.lua', function(err, data) {
            if(err) {
                console.log('Could not read shares.lua... cannot parse found block shares!');
            }
            db.eval(data.toString(), 1, primary + ':sharelog', PPLNS_SHARES, function(err, reply) {
                if(err) {
                    console.log('Could not execute LUA script for block shares: ' + err);
                    return;
                }
                var p = JSON.parse(reply);
                var total = 0;
                for(var user in p) total += p[user];
                var payouts = { reward: utils.round(value, 8), shares: total, users: reply };
                //console.log(payouts);
                //var info = JSON.stringify({ height: height, hash: hash, reward: value, status: 'pending' });
                var info = [height.toString(), hash, txHash, value.toString(), user].join(':');
                // Consider chaining calls?
                db.hmset(aux + ':blocks:' + height, payouts);
                db.lpush(aux + ':blocks', height.toString());
                db.lpush(aux + ':curblocks', info);
                db.lpush(user + ':blocks', height.toString());
            });
        });
    },

    getCurrentBlockList: function(coin, callback) {
        db.lrange(coin + ':curblocks', '0', '-1', function(err, reply) {
            //console.log(reply);
            // Decode the blocks
            for(var i = 0;i < reply.length;i++) {
                var arr = reply[i].split(':');
                reply[i] = {
                    height: parseInt(arr[0]),
                    hash: arr[1],
                    txHash: arr[2],
                    reward: parseFloat(arr[3]),
					user: arr[4]
                };
            }
            callback(reply);
        });
    },

    getBlockPayouts: function(coin, height, callback) {
        db.hgetall(coin + ':blocks:' + height, function(err, reply) {
            if(err || !reply) callback(null);
            var payouts = JSON.parse(reply.users);


            // Convert into a format which shows the actual amounts - since that is what this function does
            var total = reply.shares;
            for(var user in payouts) payouts[user] = utils.round(reply.reward * (payouts[user] / total), 8);
            reply.users = payouts;
            callback(reply); // Already in the correct format
        });
    },

    getUserPayouts: function(coin, user, callback) {
        module.exports.getCurrentBlockList(coin, function(blocks) {
            async.map(blocks, function(block, callback) {
                db.hgetall(coin + ':blocks:' + block.height, function(err, payouts) {
                    if(err || !payouts) {
                        callback(err, { height: block.height, reward: 0 });
                        return;
                    }
                    var p = JSON.parse(payouts.users);
                    var shares = 0;
                    if(p[user]) shares = p[user];
                    var value = utils.round(payouts.reward * (shares / payouts.shares), 8);
                    callback(null, { height: block.height, reward: value });
                });
            }, function(err, data) {
                //console.log('Callback executed');
                if(err) console.error('Could not get payouts for address ' + user);
                callback(data);
            });
        });
    },

	getUserStats: function(coins, user, callback) {
		var data = {};
		data.payouts = {};
		data.balances = {};
		async.each(coins, function(coin, callback) {
			module.exports.getUserPayouts(coin, user, function(payouts) {
				data.payouts[coin] = payouts;
				module.exports.getBalance(coin, user, function(err, balance) {
					if(err || !balance) balance = 0;
					data.balances[coin] = balance;
					callback();
				});
			});
		}, function(err) {
			db.get('totalshares:' + user, function(err, shares) {
				data.totalshares = shares;
				callback(data);
			});
		});
	},

    // Gets the payouts for each block, adds to user balances, and then archives the block
    processBlocks: function(coin, daemon, callback) {
        module.exports.getCurrentBlockList(coin, function(blocks) {
			if(blocks.length < 1) {
				callback();
				return;
			}
            var commands = blocks.map(function(b) {
                return ['gettransaction', [b.txHash]];
            });
            daemon.batchCmd(commands, function(err, results) {
                results.forEach(function(tx, i) {
                    if(tx.error && tx.error.code === -5) {
                        console.log('Daemon reports invalid txn for payouts!');
                        return;
                    }
                    else if(tx.error) {
                        console.log('Error encountered while requesting transaction details: ' + JSON.stringify(tx.error));
                        return;
                    }
                    var status = tx.result.details[0].category;
                    if(status === 'generate') {
                        // Process payouts for this block
                        module.exports.getBlockPayouts(coin, blocks[i].height, function(payouts) {
                            payouts = payouts.users;
                            for(var user in payouts) {
                                module.exports.addBalance(coin, user, payouts[user]);
                            }
							// Remove block from current list
							// Convert back into format to be deleted
							var blk = [blocks[i].height.toString(), blocks[i].hash, blocks[i].txHash, blocks[i].reward.toString(), blocks[i].user].join(':');
							db.lrem(coin + ':curblocks', 1, blk);
                        });
                    }
                    if(i == results.length - 1) {
                        // Execute the callback
                        callback();
                    }
                });
            });
        });
    },

    // Graph functions

    pushGraph: function(graph, value) {
        db.lpush('graph:' + graph, JSON.stringify({ time: utils.time(), value: value }));
        db.ltrim('graph:' + graph, '0', GRAPH_MAX_LENGTH);
    },

    readGraph: function(graph, step, entries, callback) {
        db.lrange('graph:' + graph, '0', (step * entries).toString(), function(err, data) {
            if(err) {
                console.log('Could not get graph data: ' + err);
                return [];
            }

            var d = [];

            for(var i = 0;i < data.length - step + 1;i += step) {
                // Average all the values together (may not be necessary, but I think it may be more accurate for sampling)
                var value = 0;
                for(var j = 0;j < step;j++) {
                    value += JSON.parse(data[i + j]).value;
                }
                value /= step;
                d.push([JSON.parse(data[i]).time, value]);
            }
            callback(d);
        });
    },

    getTotalShares: function(user, callback) {
        var f = function(err, reply) {
            if(err) return 0;
            callback(parseInt(reply));
        };
        if(!user) db.get('totalshares', f);
        else db.get('totalshares:' + user, f);
    },

    // User balance functions

    addBalance: function(coin, user, amount) {
        db.incrbyfloat('balances:' + coin + ':' + user, amount);
		db.sadd('balances:' + coin, user);
    },

    getBalance: function(coin, user, callback) {
        db.get('balances:' + coin + ':' + user, callback);
    },

    clearBalance: function(coin, user) {
        db.del('balances:' + coin + ':' + user);
		db.srem('balances:' + coin, user);
    },

	getUsersWithBalance: function(coin, callback) {
		db.smembers('balances:' + coin, callback);
	},

	pushPayout: function(id, payouts) {
		db.set('payouts:' + id, JSON.stringify(payouts));
		db.lpush('payouts', id);
	},

	listPayouts: function(callback, start, end) {
		if(!start) start = 0;
		if(!end) end = 9;
		db.lrange('payouts', start, end, callback);
	},

	getPayout: function(id, callback) {
		db.get('payouts:' + id, function(err, res) {
			if(err) {
				callback(err);
				return;
			}
			callback(null, JSON.parse(res));
		});
	}
};
