 // Requires
var _ = require('underscore');
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
BasePattern.prototype.getMapperKey = function(mapperValue) {
    return [this.resource, mapperValue].join(':');
};

// Local hashmap
BasePattern.prototype.getMaperValue = function(req) {
    return req.url;
};

// Apply all middleware (only synchronous)
BasePattern.prototype.applyMiddleware = function(req) {
    var newReq = req;
    this.middleware.forEach(function(f) {
        newReq = f(newReq);
    });
};

// Returns a backend based on the request
BasePattern.prototype.pick = function(req) {
    var mapValue = this.getMaperValue(req);
    var mapKey = this.getMapperKey(mapValue);

    // Check if already mapped to a backend
    // if not pick one
    if(!this.hasBackend(mapKey)) {
        var newBackend = this.newBackend();
        this.setBackend(mapKey, newBackend);
    }

    var backend = this.getBackend(mapKey);
    return backend;
};

// Pick a backend to proxy to and then proxy the request
BasePattern.prototype.handle = function(req, res, proxy) {
    // Resolve the backend
    var backend = this.pick(req);

    // Do the actual proxying here
    proxy.proxyRequest(req, res, _.clone(backend));
};


// Exports
exports.BasePattern = BasePattern;