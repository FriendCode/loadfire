 // Requires
var _ = require('underscore');
var httpProxy = require('http-proxy');
var utils = require('../utils');

var BasePattern = function(options) {
    // The name of the resource to load balance
    this.resource = options.resource;

    // Hold a config of our backends
    this.backends = options.backends || [];

    // Middleware functions rewrite request object
    this.middleware = options.middleware || [];

    // Bind methods
    utils.bindMethods(this);

    return this;
};


// Should this load balancer handle this request
BasePattern.prototype.shouldHandle = function(req) {
    return req.headers.host == this.resource;
};

BasePattern.prototype.randomBackend = function() {
    return utils.randElement(this.backends);
};

BasePattern.prototype.hasBackend = function(key) {
    return true;
};

// Get least loaded backend
BasePattern.prototype.getBackend = function(key) {
    return this.newBackend(key);
};

// Assign backends randomly
BasePattern.prototype.newBackend = function(key) {
    return this.randomBackend();
};


BasePattern.prototype.setBackend = function(key, backend) {
    return;
};

// Build a key, usable in a cache for the given resource
BasePattern.prototype.getMaperKey = function(mapperValue) {
    return [this.resource, mapperValue].join(':');
};

// Local hashmap
BasePattern.prototype.getMaperValue = function(req) {
    return req.url;
};

// Apply all middleware (only synchronous)
BasePattern.prototype.applyMiddleware = function(req) {
    this.middleware.forEach(function(f) {
        req = f(req);
    });
    return req;
};

// Returns a backend based on the request
BasePattern.prototype.pick = function(req) {
    var mapValue = this.getMaperValue(req);
    var mapKey = this.getMaperKey(mapValue);

    // Check if already mapped to a backend
    // if not pick one
    if(!this.hasBackend(mapKey)) {
        var newBackend = this.newBackend();
        this.setBackend(mapKey, newBackend);
    }

    var backend = this.getBackend(mapKey);
    return backend;
};

// Bick a backend, apply middleware ...
BasePattern.prototype.pickTreat = function(req) {
    // Resolve the backend
    var backend = this.pick(req);

    // Apply our beloved middleware
    this.applyMiddleware(req);

    return backend;
};

BasePattern.prototype.handleNoBackend = function(req, res, proxy) {
    res.write('ERROR: Could not find any backend :(');
    return res.end();
};

// Pick a backend to proxy to and then proxy the request
BasePattern.prototype.handle = function(req, res, proxy) {
    var backend = this.pickTreat(req);

    if(_.isUndefined(backend)) {
        return this.handleNoBackend(req, res);
    }

    // Do the actual proxying here
    proxy.proxyRequest(req, res, _.clone(backend));
};


BasePattern.prototype.handleWs = function (req, socket, head) {
    var backend = this.pickTreat(req);

    console.log('WEBSOCKET', backend);

    // Proxy the WebSocket request to the backend
    var proxy = new httpProxy.HttpProxy({
        target: {
            host: backend.host,
            port: backend.port
        }
    });
    var buffer = httpProxy.buffer(socket);
    proxy.proxyWebSocketRequest(req, socket, head, buffer);
};

// Exports
exports.BasePattern = BasePattern;