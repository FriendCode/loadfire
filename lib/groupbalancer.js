// Requires
var Q = require('q');
var _ = require('underscore');
var util = require('util');

var utils = require('./utils');
var qretry = utils.qretry;

var httpProxy = require('http-proxy');


function ulog() {
    return util.log(_.toArray(arguments).join(' '));
}


function GroupBalancer(config, resources) {
    // Bind methods to resource
    this.resources = resources;

    this.config = config;

    // Bind methods
    _.bindAll(this);
}


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
    ulog('PROXY ERROR on ', [backend.host, backend.port].join(':')+req.url);
    ulog(err);
    ulog(err.stack || '');

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

GroupBalancer.prototype._proxyToBackend = function(req, res, backend) {
    // Headers already sent
    if(res.headerSent) {
        return Q.reject(new Error('Headers already sent, probably by middleware'));
    }

    // this will be resolved/rejected on request completion
    var d = Q.defer();

    // Build proxy
    var proxy = new httpProxy.HttpProxy({
        target: _.clone(backend)
    });

    // Failure
    proxy.once('proxyError', function(err) {
        d.reject(err);
    });

    // Success
    proxy.once('end', function() {
        d.resolve();
    });

    // Handle (actual proxying)
    proxy.proxyRequest(req, res);

    return d.promise;
};

GroupBalancer.prototype._handleHttp = function(req, res, backend) {
    var self = this;

    // Try 5 times, 50ms apart
    return qretry(self._proxyToBackend, 5, 20)(req, res, backend)
    .fail(function(err) {
        return self.handleError(err, req, res, backend);
    });
};

GroupBalancer.prototype.handle = function(req, res, _proxy) {
    var self = this;

    // Pause request stream (before )
    req.pause();

    return this.grabBackend(req)
    .spread(function(backend, resource) {
        // Apply middleware and return backend
        return self.applyMiddleware(resource, req, res)
        .then(_.partial(_.identity, backend));
    })
    .then(function(backend) {
        // Resume request (after applying middleware)
        req.resume();

        return backend;
    })
    .then(function(backend) {
        return self._handleHttp(req, res, backend);
    });
};



GroupBalancer.prototype.handleWs = function(req, socket, head) {
    var self = this;

    // Pause request stream
    req.pause();

    return this.grabBackend(req)
    .spread(function(backend, resource) {
        // Log
        ulog('handleWs:', req.headers.host+req.url);

        // Apply middleware
        return self.applyMiddleware(resource, req, null)
        .then(function() {
            ulog('handledWs:', backend.host+req.url);

            // Build proxy
            var proxy = new httpProxy.HttpProxy({
                target: _.clone(backend)
            });

            proxy.once('webSocketProxyError', function(err, req, socket) {
                ulog('WS PROXY ERROR on ', backend.host+req.url);
                ulog(err);
                ulog(err.stack);
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

        ulog('WS ERROR =');
        ulog(err);
        ulog(err.stack);

        socket.write('ERROR: Loadfire does not know how to handle that request');
        socket.close();
    });
};


// TCP Handler, just keep the connection alive
// do nothing special besides some logging
GroupBalancer.prototype.tcpConnectionHandler = function (connection) {
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


    connection.on('error', function (error) {
        ulog('TCP error from ' + getSocketInfo() + '; Error: ' + JSON.stringify(error));
    });
    connection.on('timeout', function () {
        ulog('TCP timeout from ' + getSocketInfo());
        connection.destroy();
    });
};

// Exports
module.exports.GroupBalancer = GroupBalancer;