# LoadFire

LoadFire is an easy to script load balancer and reverse proxy in NodeJS.

It allows you to write your own pieces of logic as "Patterns" and the core engine takes care of all the proxying logic so you don't have to worry about it.

**The real power is that all it's behavior is entirely scriptable in JavaScript (NodeJS). :)**

###This allows for many different use cases, such as:
  - Dynamic realtime proxying rules (domain mappings stored in Redis for example). Such things are useful for PaaSs 
  - Add pieces of middleware to your reverse proxy
  - Customizable load balancing patterns (Sticky, RoundRobin, ...)

###It supports proxying:
  - HTTP/HTTPS
  - WebSockets

## Examples:

### Proxying HTTP traffic using RoundRobin pattern

```js
var http = require('http');
var loadfire = require('loadfire');


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
            res.writeHead(200, {'Content-Type': 'text/plain'});
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
            resource: 'localhost:8000',

            // List of backends to hit
            backends: EDITOR_SERVERS,

            // Load balancing pattern
            // As of now a few are builtin
            // random, roundrobin, sticky
            pattern: 'roundrobin'
        }
    ],

    // Server to start loadfire on
    port: 8000
};

function main() {
    // Start our http servers
    startEditorServers(EDITOR_PORTS);

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
```


It was initially built to satisfy our needs at FriendCode, and we've been using it in product for months without any issues, so it can be considered as stable.

The API however will be changed soon due to some design decisions aiming to simplify it's API. (Patterns are quite monolithic as of now, they will be split up into different parts: matcher, mapper, balancer, store).
