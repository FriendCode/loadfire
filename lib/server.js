// Requires
var http = require('http');
var httpProxy = require('http-proxy');
var config = require('./config');
var GroupBalancer = require('./groupbalancer').GroupBalancer;

function Server(_config) {
    this.config = config.resolveConfig(_config);
    this.balancer = new GroupBalancer(this.config.resources);
}

Server.prototype.run = function () {
    // Let the groupbalancer handle this
    this.server = httpProxy.createServer(this.balancer.handle);

    // List on port
    this.server.listen(this.config.port);

    return this;
};


// Exports
module.exports.Server = Server;