// Requires
var server = require('./lib/server');

var selectors = require('./lib/selectors/');
var balancers = require('./lib/balancers/');

var groupBalancer = require('./lib/groupbalancer');
var config = require('./lib/config');


function createServer(config) {
    var newServer = new server.Server(config);
    return newServer;
}

// Exports
exports.createServer = createServer;
exports.Server = server.Server;

// Aliasing
exports.server = server;

exports.selectors = selectors;
exports.balancers = balancers;

exports.groupBalancer = groupBalancer;
exports.config = config;
