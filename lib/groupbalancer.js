// Requires
var Q = require('q');
var _ = require('underscore');
var es = require('event-stream');

var util = require('util');
var events = require('events');

var retry = require('qplus').retry;

var httpProxy = require('http-proxy');


// Returns only fulfilled value in a list of results
function fulfilled(results) {
    return (results || [])
    .filter(function(result) {
        return result.state === "fulfilled";
    })
    .map(function(result) {
        return result.value;
    });
}

function GroupBalancer(config, resources) {
    // Bind methods to resource
    this.resources = resources;

    this.config = config;

    // Bind methods
    _.bindAll(this);
}
util.inherits(GroupBalancer, events.EventEmitter);


GroupBalancer.prototype.selectResource = function(req) {
    var resources = this.resources;

    return Q.allSettled(
        // Array of booleans saying if the resource can handle
        this.resources.map(function(resource) {
            // Should handle ?
            return Q.nfcall(resource.selector, req);
        })
    )
    .then(fulfilled)
    .then(function (results) {
        // Associate resources with their respective results
        return _.first(_.map(
            _.filter(
                _.zip(resources, results),
                _.last
            ),
            _.first
        ));
    })
    .then(function(resource) {
        if(!resource) {
            throw new Error("No resource can handle the request");
        }
        return resource;
    });
};

GroupBalancer.prototype.selectBackend = function(req, resource) {
    return Q.nfcall(resource.balancer, resource.backends, req)
    .then(function(backend) {
        if(!backend) {
            throw new Error("Balancer could not give a valid backend to route to");
        }
        return [backend, resource];
    });
};

// selectResource then selectBackend
GroupBalancer.prototype.grabBackend = function(req) {
    return this.selectResource(req)
    .then(_.partial(this.selectBackend, req));
};

GroupBalancer.prototype.applyMiddleware = function(resource, req, res) {
    return Q.nfcall(resource.middlewareHandler, req, res);
};

// Handle an error when routing a HTTP request
// Terminate request/response
GroupBalancer.prototype.handleError = function(err, req, res, backend) {
    var target = !backend ? null : [backend.host, backend.port].join(':') + req.url;

    // Emit handling error
    this.emit('httpError', err, target);

    // Terminate request
    res.writeHead(500, { 'Content-Type': 'text/plain' });

    if (req.method !== 'HEAD') {
      //
      // This NODE_ENV=production behavior is mimics Express and
      // Connect.
      //
      if (process.env.NODE_ENV === 'production') {
        res.write('Internal Server Error');
      }
      else {
        res.write('An error has occurred:\n' + err ? err.stack : err);
      }
    }

    // End
    try { res.end(); }
    catch (ex) { console.error("res.end error: %s", ex.message); }
};

GroupBalancer.prototype._proxyToBackend = function(req, res, backend, dataArray) {
    // this will be resolved/rejected on request completion
    var d = Q.defer();

    // Create a readable stream
    // from all the data of our request that we stored
    var buffer = es.readArray(dataArray);

    // Build proxy
    var proxy = httpProxy.createProxyServer({
        target: _.clone(backend),
        buffer: buffer
    });

    function cleanup() {
        req.removeAllListeners();
    }

    // Failure
    proxy.once('error', function(err) {
        cleanup();
        d.reject(err);
    });

    // Success
    proxy.once('proxyRes', function() {
        cleanup();
        d.resolve();
    });

    // Handle (actual proxying)
    proxy.proxyRequest(req, res);

    return d.promise;
};

GroupBalancer.prototype._handleHttp = function(req, res, backend, dataArray) {
    var self = this;

    // Try 5 times, 50ms apart
    return retry(
        self._proxyToBackend,
        this.config.retries,
        this.config.retryTimeout,
        function canContinue(err, nTries) {
            // Only continue if headers are not sent
            return res.headersSent === false;
        }
    )(req, res, backend, dataArray);
};

GroupBalancer.prototype.handle = function(req, res, _proxy) {
    var self = this;

    // Pause req for middleware (async work)
    req.pause();

    return this.selectResource(req)
    .then(function(resource) {
        // Apply middleware and return backend
        return self.applyMiddleware(resource, req, res)
        .then(_.partial(_.identity, resource));
    })
    .then(function(resource) {
        // Middleware handled response so lets exit
        if(res.headersSent) {
            return;
        }

        return self.selectBackend(req, resource)
        .spread(function(backend, resource) {
            var d = Q.defer();

            // Resume request (after applying middleware)
            req.resume();

            // We need to log all the req's events to a buffer
            // so that we can replay them when retrying
            var writer = es.writeArray(function(err, dataArray) {
                if(err) {
                    return d.reject(err);
                }

                return d.resolve([backend, dataArray]);
            });

            // Pipe to the array
            req.pipe(writer);

            return d.promise;
        })
        .spread(function(backend, dataArray) {
            return self._handleHttp(req, res, backend, dataArray);
        })
        .fail(function(err) {
            // Use custom resource error handler if it exists
            if(_.isFunction(resource.error)) {
                return resource.error(err, req, res);
            }
            return self.handleError(err, req, res);
        });
    }, function(err) {
        return self.handleError(err, req, res);
    });
};



GroupBalancer.prototype.handleWs = function(req, socket, head) {
    var self = this;

    // Pause request stream
    req.pause();

    return this.grabBackend(req)
    .spread(function(backend, resource) {
        var d = Q.defer();

        // Log
        self.emit('wsHandle', req.headers.host+req.url);

        // Build proxy
        var proxy = httpProxy.createProxyServer({
            target: _.clone(backend)
        });

        // Handle errors
        proxy.once('error', function(err, req, socket) {
            return d.reject(err);
        });

        // Handle success/termination
        socket.once('end', function() {
            return d.resolve();
        });

        // Actual proxying
        proxy.proxyWebsocketRequest(req, socket, head);

        // Resume request
        req.resume();

        return d.promise;
    })
    .fail(function(err) {
        req.resume();

        console.log('WS Error:', err && err.stack);

        self.emit('wsError', err);

        // Write error and close
        socket.write('ERROR: Loadfire does not know how to handle that request\n');
        socket.end(err.toString());

    });
};


// TCP Handler, just keep the connection alive
// do nothing special besides some logging
GroupBalancer.prototype.tcpConnectionHandler = function (connection) {
    var self = this;

    var remoteAddress = connection.remoteAddress,
        remotePort = connection.remotePort,
        start = Date.now();

    var getSocketInfo = function () {
        return JSON.stringify({
            remoteAddress: remoteAddress,
            remotePort: remotePort,
            bytesWritten: connection.bytesWritten,
            bytesRead: connection.bytesRead,
            elapsed: (Date.now() - start) / 1000
        });
    };

    connection.setKeepAlive(false);
    connection.setTimeout(this.config.tcpTimeout * 1000);


    connection.on('error', function (err) {
        self.emit('tcpError', err, getSocketInfo());
    });
    connection.on('timeout', function () {
        self.emit('tcpTimeout', getSocketInfo());
        connection.destroy();
    });
};

// Exports
module.exports.GroupBalancer = GroupBalancer;