// Requires
var Q = require('q');
var _ = require('underscore');
var utils = require('./utils');

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
    // Apply a series of middleware
    return _.map(resource.middleware, function(middleware) {
        return Q.nfcall(middleware, req, res);
    }).reduce(Q.when, Q());
};


GroupBalancer.prototype.handle = function(req, res, proxy) {
    var self = this;

    // Pause request stream
    req.pause();

    return this.grabBackend(req)
    .spread(function(backend, resource) {
        // Log
        console.log('Handle: ', req.headers.host+req.url);

        // Apply middleware
        return self.applyMiddleware(resource, req, res)
        .then(function() {
            console.log('backend =', backend);

            // Resume request
            req.resume();

            // Handle (actual proxying)
            proxy.proxyRequest(req, res, _.clone(backend));

            return backend;
        });
    })
    .fail(function(err) {
        console.log(err.stack);
        res.write(err.stack);
        res.write('\nERROR: Loadfire does not know how to handle that request\n');
        res.end();
    });
};

GroupBalancer.prototype.handleWs = function(req, socket, head) {
    return this.grabBackend(req)
    .spread(function(backend, resource) {
        // Log
        console.log('handleWs: ', req.headers.host+req.url);

        // Build proxy
        var proxy = new httpProxy.HttpProxy({
            target: _.clone(backend)
        });
        // Buffer from socket
        var buffer = httpProxy.buffer(socket);

        // Actual proxying
        proxy.proxyWebSocketRequest(req, socket, head, buffer);

        return backend;
    })
    .fail(function(err) {
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
        console.log('TCP error from ' + getSocketInfo() + '; Error: ' + JSON.stringify(error));
    });
    connection.on('timeout', function () {
        console.log('TCP timeout from ' + getSocketInfo());
        connection.destroy();
    });
};

// Exports
module.exports.GroupBalancer = GroupBalancer;