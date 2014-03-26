
var http = require('http');
var httpProxy = require('http-proxy');

var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 8080});
wss.on('connection', function(ws) {
  console.log('CLIENT CONNECTED');
    ws.on('message', function(message) {
        console.log('received: %s', message);
    });
    ws.send('something');
});


var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 8081});
wss.on('connection', function(ws) {
  console.log('CLIENT CONNECTED 22');
    ws.on('message', function(message) {
        console.log('received other: %s', message);
    });
    ws.send('something else');
});


//
// A simple round-robin load balancing strategy.
//
// First, list the servers you want to use in your rotation.
//
var addresses = [
  {
    host: 'localhost',
    port: 8080
  },
  {
    host: 'localhost',
    port: 8081
  }
];

//
// Create a HttpProxy object for each target
//

var proxies = addresses.map(function (target) {
  return new httpProxy.createProxyServer({
    target: target
  });
});

//
// Get the proxy at the front of the array, put it at the end and return it
// If you want a fancier balancer, put your code here
//

function nextProxy() {
  var proxy = proxies.shift();
  proxies.push(proxy);
  return proxy;
}

//
// Get the 'next' proxy and send the http request
//

var server = http.createServer(function (req, res) {
  nextProxy().web(req, res);
});

//
// Get the 'next' proxy and send the upgrade request
//

server.on('upgrade', function (req, socket, head) {
  nextProxy().ws(req, socket, head);
});

server.listen(8000);
