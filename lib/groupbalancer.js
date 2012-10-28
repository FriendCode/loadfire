// Requires
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


GroupBalancer.prototype.handle = function(req, res, proxy) {
    var filteredPatterns = this.patterns.filter(function(x) {
        return x.shouldHandle(req);
    });

    // Error handler
    if(filteredPatterns.length < 1) {
        //return error.handleView(400);
        res.write('ERROR');
        res.end();
        return;
    }

    // Pick first
    var handler = filteredPatterns[0];

    // Handle
    return handler.handle(req, res, proxy);
};


// Exports
module.exports.GroupBalancer = GroupBalancer;