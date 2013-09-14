// Requires
var _ = require('underscore');

var httpProxy = require('http-proxy');

var config = require('./config');
var GroupBalancer = require('./groupbalancer').GroupBalancer;


function Server(_config) {
    // Validate and Resolve our configuration
    this.config = config.resolveConfig(_config);

    // Get the group balancer
    this.balancer = new GroupBalancer(this.config, this.config.resources);

    // Setup server and the different handlers
    this.setupServer();

    // Bind methods
    _.bindAll(this);
}

// Setup our handlers
Server.prototype.setupServer = function () {
    // Create server and handle usual HTTP Connections
    this.server = httpProxy.createServer(this.balancer.handle);

    // Handle TCP connections
    this.server.on('connection', this.balancer.tcpConnectionHandler);

    // Handle websocket upgrades
    this.server.on('upgrade', this.balancer.handleWs);
};

// Server listen
Server.prototype.listen = function () {
    var args = _.isEmpty(arguments) ? [this.config.port] : _.toArray(arguments);
    // List on port
    this.server.listen.apply(this.server, args);

    return this;
};

// Alias
Server.prototype.run = Server.prototype.listen;


// Exports
module.exports.Server = Server;