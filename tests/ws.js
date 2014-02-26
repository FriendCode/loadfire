var loadfire = require('../');

var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 8080});
wss.on('connection', function(ws) {
  console.log('CLIENT CONNECTED');
    ws.on('message', function(message) {
        console.log('received: %s', message);
    });
    ws.send('something');
});

// Config for our loadfire server
var CONFIG = {
    'resources': [
        {
            selector: function(req, cb) {
                return cb(null, true);
            },

            // resource is some value identify this resource
            // by default it should be the hostname to match
            //selector: loadfire.selectors.host('localhost:8000'),
            backends: [],

            // Load balancing pattern
            // As of now a few are builtin
            // random, roundrobin, sticky
            balancer: function(backends, req, cb) {
                return cb(null, {
                    host: 'localhost',
                    port: 8081
                });
            },

/*
            middleware: [
                function(req, res, next) {
                    console.log('heelo');
                    next();
                }
            ],
*/
        }
    ],

    // Server to start loadfire on
    port: 8000
};

function main() {
    // Setup our load balancer with the above config
    var loadServer = loadfire.createServer(CONFIG);

    // Now start our load balancer
    loadServer.run();
}

// Run main
main();