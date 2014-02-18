// Requires
var Q = require('q');
var _ = require('underscore');

var util = require('util');
var events = require('events');

var retry = require('qplus').retry;

var httpProxy = require('http-proxy');


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

    return Q.all(
        // Array of booleans saying if the resource can handle
        this.resources.map(function(resource) {
            // Should handle ?
            return Q.nfcall(resource.selector, req);
        })
    )
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
        res.write('An error has occurred: ' + JSON.stringify(err));
      }
    }

    // End
    try { res.end(); }
    catch (ex) { console.error("res.end error: %s", ex.message); }
};

GroupBalancer.prototype._proxyToBackend = function(req, res, backend, buffer) {
    // this will be resolved/rejected on request completion
    var d = Q.defer();

    // Build proxy
    var proxy = new httpProxy.HttpProxy({
        target: _.clone(backend)
    });

    function cleanup() {
        req.removeAllListeners();
    }

    // Failure
    proxy.once('proxyError', function(err) {
        cleanup();
        d.reject(err);
    });

    // Success
    proxy.once('end', function() {
        cleanup();
        d.resolve();
    });

    // Handle (actual proxying)
    proxy.proxyRequest(req, res, buffer);

    return d.promise;
};

GroupBalancer.prototype._handleHttp = function(req, res, backend, buffer) {
    var self = this;

    // Try 5 times, 50ms apart
    return retry(
        self._proxyToBackend,
        this.config.retries,
        this.config.retryTimeout,
        function canContinue(err, nTries) {
            // Only continue if headers are not sent
            return res.headerSent === false;
        }
    )
    (req, res, backend, buffer)
    .fail(function(err) {
        return self.handleError(err, req, res, backend);
    });
};

GroupBalancer.prototype.handle = function(req, res, _proxy) {
    var self = this;

    // We need to log all the req's events to a buffer
    // so that we can replay them when retrying
    var buffer = httpProxy.buffer(req);

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
        if(res.headerSent) {
            return;
        }

        return self.selectBackend(req, resource)
        .then(function(backend) {
            var d = Q.defer();

            // Resume request (after applying middleware)
            req.resume();

            // WARNING: essential
            // Lets the events from the req object flow into the buffer
            // without this the buffer is empty of events
            process.nextTick(function() {
                d.resolve(backend);
            });

            return d.promise;
        })
        .then(function(backend) {
            return self._handleHttp(req, res, backend, buffer);
        });
    })
    .fail(function(err) {
        self.handleError(err, req, res);
    });
};



GroupBalancer.prototype.handleWs = function(req, socket, head) {
    var self = this;

    // Pause request stream
    req.pause();

    return this.grabBackend(req)
    .spread(function(backend, resource) {
        // Log
        self.emit('wsHandle', req.headers.host+req.url);

        // Apply middleware
        return self.applyMiddleware(resource, req, null)
        .then(function() {

            // Build proxy
            var proxy = new httpProxy.HttpProxy({
                target: _.clone(backend)
            });

            proxy.once('webSocketProxyError', function(err, req, socket) {
                self.emit('wsProxyError', err, req, socket);
            });

            // Actual proxying
            proxy.proxyWebSocketRequest(req, socket, head);

            // Resume request
            req.resume();

            return backend;
        });
    })
    .fail(function(err) {
        req.resume();

        self.emit('wsError', err);

        socket.write('ERROR: Loadfire does not know how to handle that request');
        socket.close();
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