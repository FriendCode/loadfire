// Requires
var httpProxy = require('http-proxy');
var utils = require('./lib/utils');
var server = require('./lib/server');
var patterns = require('./lib/patterns');
var middleware = require('./lib/middleware');
var groupBalancer = require('./lib/groupbalancer');


function createServer(config) {
    var newServer = new server.Server(config);
    return newServer;
}

// Exports
module.exports.createServer = createServer;

// Aliasing
module.server = server;
module.exports.patterns = patterns;
module.exports.middleware = middleware;
module.exports.groupBalancer = groupBalancer;
module.exports.utils = utils;