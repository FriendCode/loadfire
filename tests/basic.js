var http = require('http');
var loadfire = require('../lib/index');


var EDITOR_PORTS = [7001, 7002, 7003, 7004];

var EDITOR_SERVERS = EDITOR_PORTS.map(function (x) {
    return {
        host: 'localhost',
        port: x
    };
});

var CONFIG = {
    'editor.io': {
        backends: EDITOR_SERVERS,
        pattern: 
    }
};

function startEditorServers(ports) {
    ports.forEach(function (port) {
        http.createServer(function(req, res) {
            res.send(port);
            res.close();
        });
    });
}

function main() {
    startEditorServers(EDITOR_PORTS);
    var group = loadfire.createLoadbalancer(BACKENDS, {
        'edtior.io': loadfire.LoadBalancer
    });
}

// Run main
main();