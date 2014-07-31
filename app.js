var cluster = require('cluster');

console.log('New thread launched!');

var MAIN_CONFIG = 'config.json';
var COIN_CONFIGS = 'coins/';
var POOL_CONFIGS = 'pools/';

allCoins = [];
ac = {};

function processOptions(options) {
    if(fs.existsSync(COIN_CONFIGS + options.coin)) {
        options.coin = JSON.parse(fs.readFileSync(COIN_CONFIGS + options.coin, {encoding: 'utf8'}));
        ac[options.coin.symbol] = { symbol: options.coin.symbol, daemons: options.daemons };
        if(options.auxes) {
            options.auxes.forEach(processOptions);
            options.auxes.forEach(function(aux) {
                for(var key in aux.coin) aux[key] = aux.coin[key];
                delete aux.coin;
            });
        }
    }
    else {
        console.log('Could not get coin config for ' + JSON.stringify(options));
        // Try to ignore, but it will end in an inevitable failure.
    }
}

if(cluster.isMaster) {
    var fs = require('fs');
    var path = require('path');
    var express = require('express');
    var path = require('path');
    var favicon = require('static-favicon');
    var cookieParser = require('cookie-parser');
    var bodyParser = require('body-parser');
    var logger = require('morgan');

    var async = require('async');
    var db = require('./db');
    var utils = require('./utils');

    var routes = require('./routes/index');
    var users = require('./routes/users');
    var blocks = require('./routes/blocks');
    var payouts = require('./routes/payouts');

    var poolOptions = [];

    // Read main configuration file
    if(!fs.existsSync(MAIN_CONFIG)) console.log('Main configuration file not found! Please copy the example file and edit it to your liking!');
    var config = JSON.parse(fs.readFileSync(MAIN_CONFIG, {encoding: 'utf8'}));

    // Spawn pool worker instances
    fs.readdirSync(POOL_CONFIGS).forEach(function(file) {
        if(!fs.existsSync(POOL_CONFIGS + file) || path.extname(POOL_CONFIGS + file) !== '.json') return;
        var options = JSON.parse(fs.readFileSync(POOL_CONFIGS + file, {encoding: 'utf8'}));

        processOptions(options);

        poolOptions.push(options);
        // Fork thread
        cluster.fork({ type: 'pool', options: JSON.stringify(options) });
    });
    for(symbol in ac) {
        allCoins.push(ac[symbol]);
    }
    console.log(JSON.stringify(allCoins));
    // Spawn coin payment daemon
    cluster.fork({ type: 'payouts', coins: JSON.stringify(allCoins), payouts: JSON.stringify(config.payouts) });

    // Now start website

    var app = express();

    // view engine setup
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'jade');

    app.use(favicon());
    app.use(logger('dev'));
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded());
    app.use(cookieParser());
    app.use(express.static(path.join(__dirname, 'public')));

    //app.use('/', routes);
    app.use('/user', users);
    app.use('/block', blocks);
    app.use('/payout', payouts);

    app.get('/', function(req, res) {
        var po = poolOptions;
        async.map(po, function(options, callback) {
            db.getHashrate(options.coin.symbol, function(err, hr) {
                callback(err, utils.hashrateString(hr));
            });
        }, function(err, hashrates) {
            res.render('index', { pools: poolOptions, hashrates: hashrates, title: 'Home' });
        });
    });

    /// catch 404 and forward to error handler
    app.use(function(req, res, next) {
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    });

    /// error handlers

    // development error handler
    // will print stacktrace
    if (app.get('env') === 'development') {
        app.use(function(err, req, res, next) {
            res.status(err.status || 500);
            res.render('error', {
                message: err.message,
                error: err
            });
        });
    }

    // production error handler
    // no stacktraces leaked to user
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: {}
        });
    });


    module.exports = app;

    app.set('port', config.web.port);

    var server = app.listen(app.get('port'), function() {
        console.log('Started web server!');
    });

    // Start statistics
    setInterval(function() {
        poolOptions.forEach(function(options) {
            db.rotateHashrates(options.coin.symbol);
        });
        // Now for the users
        db.getUsers(function(err, users) {
            if(err || !users) return;
            users.forEach(function(user) {
                db.rotateHashrates('users:' + user, true);
            });
        });
    }, 60000);
}
else {
    var t = null;
    if(process.env.type === 'pool') t = require('./worker');
    else if(process.env.type === 'payouts') t = require('./payouts');
    else {
        console.log('Unknown thread type: ' + process.env.type);
    }
    if(t) t.run();
}
