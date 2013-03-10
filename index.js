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
exports.createServer = createServer;
exports.Server = server.Server;

// Aliasing
exports.server = server;
exports.patterns = patterns;
exports.middleware = middleware;
exports.groupBalancer = groupBalancer;
exports.utils = utils;