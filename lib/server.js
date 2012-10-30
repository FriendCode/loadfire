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
    this.balancer = new GroupBalancer(this.config.resources);

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
    var that = this;
    this.server.on('connection', function() {
        that.tcpConnectionHandler.apply(that, arguments);
    });

    // Handle websocket upgrades
    this.server.on('upgrade', this.balancer.handleWs);
};


Server.prototype.run = function () {
    // List on port
    this.server.listen(this.config.port);

    return this;
};


// TCP Handler, just keep the connection alive
// do nothing special besides some logging
Server.prototype.tcpConnectionHandler = function (connection) {
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
module.exports.Server = Server;