// Roundrobin Pattern
function roundrobin(backends, req, cb) {
    // Rotate backends
    var x = backends.shift();
    backends.push(x);

    return cb(null, x);
}


// Exports
module.exports = roundrobin;
