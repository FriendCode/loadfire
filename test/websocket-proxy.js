var util = require('util'),
    http = require('http'),
    httpProxy = require('http-proxy');

//
// Create the target HTTP server and setup
// socket.io on it.
//
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 8080});
wss.on('connection', function(ws) {
  console.log('CLIENT CONNECTED');
    ws.on('message', function(message) {
        console.log('received: %s', message);
    });
    ws.send('something');
});

//
// Create a proxy server with node-http-proxy
//
httpProxy.createServer({target: {
  host: 'localhost',
  port:8080
}, ws:true}).listen(8000);

var WebSocket = require('ws');
var ws = new WebSocket('ws://localhost:8000/');
ws.on('open', function() {
    console.log('connected');
    ws.send(Date.now().toString(), {mask: true});
});
ws.on('close', function() {
    console.log('disconnected');
});
ws.on('message', function(data, flags) {
  console.log('CLIENT GOT', data);
    console.log('Roundtrip time: ' + (Date.now() - parseInt(data)) + 'ms', flags);
    setTimeout(function() {
        ws.send(Date.now().toString(), {mask: true});
    }, 500);
});