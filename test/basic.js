var http = require('http');
var loadfire = require('../');


var EDITOR_PORTS = [7001, 7002, 7003,7004];

var EDITOR_SERVERS = EDITOR_PORTS.map(function (x) {
    return {
        host: 'localhost',
        port: x
    };
});

// Start all our different http servers
function startEditorServers(ports) {
    ports.forEach(function (port) {
        // Setup HTTP Server
        var httpServer = http.createServer(function(req, res) {
            // Output the port number the server is running on
            console.log('responding');
            res.writeHead(200, {'Content-Type': 'text/plain'});
            console.log('URL =', req.url);
            req.on('data', function(data) {
                console.log("EDITOR DATA =", data.toString());
            });
            res.end(port.toString());
        });

        // Listen on assigned port
        httpServer.listen(port);
    });
}

// Config for our loadfire server
var CONFIG = {
    'resources': [
        {
            // resource is some value identify this resource
            // by default it should be the hostname to match
            selector: loadfire.selectors.host('localhost:8000'),

            // List of backends to hit
            backends: EDITOR_SERVERS,

            // Load balancing pattern
            // As of now a few are builtin
            // random, roundrobin, sticky
            balancer: loadfire.balancers.roundrobin,

            middleware: [
                function(req, res, next) {
                    console.log('heelo');
                    next();
                }
            ],
        }
    ],

    // Server to start loadfire on
    port: 8000
};

function main() {
    // Start our http servers
    setTimeout(function() {
        startEditorServers(EDITOR_PORTS);
        console.log('Started editors');
    }, 3000);


    // Setup our load balancer with the above config
    var loadServer = loadfire.createServer(CONFIG);

    // Now start our load balancer
    loadServer.run();

    // Check out localhost:8000
    // Refresh a few times and you'll see different port numbers appear
    // depending on which http server the requests are proxied to
    // since we are using the roundrobin pattern it will cycle through them
}

// Run main
main();