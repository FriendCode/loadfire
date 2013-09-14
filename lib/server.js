// Requires
var http = require('http');
var httpProxy = require('http-proxy');
var utils = require('./utils');
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
    utils.bindMethods(this);
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


Server.prototype.run = function () {
    // List on port
    this.server.listen(this.config.port);

    return this;
};




// Exports
module.exports.Server = Server;