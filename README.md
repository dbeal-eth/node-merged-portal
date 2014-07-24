Node Merged Portal
==================
This is a simple pool which makes use of node-merged-pool to allow for a simple merged mining solution

Quick Start
-----------
0. Set coin configurations
0. Copy config.json.example to config.json.
0. Edit config.json as needed.
0. Create pool configurations inside pools. Place coin configurations in the coins directory
0. Start the pool with:
```
node app.js
```
6. Publicize your pool to relevant forums. ex: [LottoShares Forum](http://forum.lottoshares.org/category/7/mining)

Configuration Description
=========================
config.json
-----------
```javascript
{
    "web": {
        "port": 4567 // The port the website will be available on
    },

    "db": {
        "sharelogMaxLength": 20000, // This should always be much greater than pplnsShares
        "graphMaxLength": 10000 // Graphs are not yet implemented
    },

    "payouts": {
        "interval": 20, // How often (in seconds) should the payout daemon scan for payouts to execute?
        "threshold": 1 // How many coins are required for a client to receive payout?
    },

    "pplnsShares": 100000 // Number of shares to use for block
}

```

litecoin-merged.json
--------------------
```javascript
{
    "coin": "litecoin.json", // Make sure this file is available in the coins directory
    "auxes": [ // Defines auxillery coins
        {
            "coin": "lottoshares.json",
            "daemons": [ // It is reccomended to supply multiple daemons here for redundancy
                {
                    "host": "127.0.0.1",
                    "port": 23327,
                    "user": "lottosharesrpc",
                    "password": "By66dCmyX44uUbA7P3qqXJQeT3Ywd8dZ4dJdfgxCAxbg"
                }
            ]
        }
    ],

    "address": "LWnyEVFNBKmSezQZx7oCmPm77FLzEhaAp1", // Payout address of the primary coin
    "rewardRecipients": { // For pool operator fees
        // Donation address - leave here if you would like to donate :)
        // it supports all coins
        "02ac8adcede9992d1e4f60477a93a6445266084b3ffc429d5d243293b0e5f7701d": 0.1
    },

    "blockRefreshInterval": 1000, // How often should node-merged-pool poll for blocks?

    "jobRebroadcastTimeout": 55, // When should updated blocks/transactions be sent to clients?
    "connectionTimeout": 600,

    "emitInvalidBlockHashes": false, // Has no effect at this time

    "tcpProxyProtocol": false, // Has no effect at this time

    "banning": {
        "enabled": true,
        "time": 600, // How long bans last
        "invalidPercent": 50,
        "checkThreshold": 500,
        "purgeInterval": 300
    },

    // Define your stratum ports here
    "ports": {
        "3032": { // Here is one
            "diff": 32, // with share difficulty 32

            "varDiff": { // Vardiff configuration
                "minDiff": 8,
                "maxDiff": 512,
                "targetTime": 15, // How often a share should be submitted by a client
                "retargetTime": 90,
                "variancePercent": 30
            }
        },
        "3256": { // Another stratum port for fast miners
            "diff": 256
        }
    },

    "daemons": [ // Primary coin daemon configuration. Same as above, include multiple daemons for redundancy
        {
            "host": "127.0.0.1",
            "port": 9332,
            "user": "litecoinrpc",
            "password": "8gZFkt93ZcCuTYZ6riGJbsDNUZXmZewvETEGJEccX2mc"
        }
    ],


    // Currently has no effect
    "p2p": {
        "enabled": false,

        "host": "127.0.0.1",

        "port": 19333,

        "disableTransactions": true

    }
}
```
