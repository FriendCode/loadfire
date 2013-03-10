// Requires
var _ = require('underscore');
var utils = require('./utils');

function GroupBalancer(resources) {
    // Build our patterns
    var patterns = resources.map(function(resource) {
        var pattern = resource.pattern;
        return new pattern(resource);
    });

    this.patterns = patterns || [];

    // Bind methods
    utils.bindMethods(this);
}


GroupBalancer.prototype.selectPattern = function(req) {
    var filteredPatterns = this.patterns.filter(function(x) {
        return x.shouldHandle(req);
    });

    // Error handler
    if(filteredPatterns.length < 1) {
        return undefined;
    }

    // Pick first
    var handler = filteredPatterns[0];
    return handler;
};

GroupBalancer.prototype.handle = function(req, res, proxy) {
    var handler = this.selectPattern(req);

    console.log('Handle: ', req.headers.host+req.url);

    // Handle no handler
    if(_.isUndefined(handler)) {
        res.write('ERROR: Loadfire does not know how to handle that request');
        res.end();
        return;
    }

    // Handle
    return handler.handle(req, res, proxy);
};

GroupBalancer.prototype.handleWs = function(req, socket, head) {
    var handler = this.selectPattern(req);

    console.log('handleWs: ', req.headers.host+req.url);

    // Handle no handler
    if(_.isUndefined(handler)) {
        socket.write('ERROR: Loadfire does not know how to handle that request');
        socket.close();
        return;
    }

    // Handle
    return handler.handleWs(req, socket, head);
};

// Exports
module.exports.GroupBalancer = GroupBalancer;