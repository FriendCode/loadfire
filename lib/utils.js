// Requires
var _ = require('underscore');


// Constants
var DEFAULT_MAX = 2147483647;
var DEFAULT_MIN = 0;

// Binds all of an objects methods to itself
// typically this is useful for using
// an object's methods as callbacks
function bindMethods(obj) {
    // Get list of method names
    var method_keys = _.functions(obj);

    // Rebind every method to the object
    method_keys.forEach(function(method_name) {
        obj[method_name] = obj[method_name].bind(obj);
    });
}


// Get the IP address from a request object
function getRemoteAddress(req) {
    if (req.connection === undefined) {
        return null;
    }
    if (req.connection.remoteAddress) {
        return req.connection.remoteAddress;
    }
    if (req.connection.socket && req.connection.socket.remoteAddress) {
        return req.connection.socket.remoteAddress;
    }
    return null;
}


// Extract top level domain name from a hostname
// D.C.B.A -> B.A
// C.B.A -> B.A
// B.A -> B.A
// B -> B
function getDomainName(hostname) {
    var idx = hostname.lastIndexOf('.');

    if (idx < 0) {
        return hostname;
    }
    idx = hostname.lastIndexOf('.', idx - 1);
    if (idx < 0) {
        return hostname;
    }
    return hostname.substr(idx);
}


// Generate a random positive integer
function randInt() {
    return _.random.apply(_, arguments);
}


function randIndex(array) {
    return randInt(array.length-1);
}

// Pick a random element from an array
function randElement(array) {
    var index = randIndex(array);
    return array[index];
}

// Exports
module.exports.getRemoteAddress = getRemoteAddress;
module.exports.bindMethods = bindMethods;
module.exports.randElement = randElement;
module.exports.randIndex = randIndex;
module.exports.randInt = randInt;
