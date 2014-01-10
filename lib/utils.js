// Requires
var Q = require('q');
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

// Retry a function a maximum of N times
// the function must use promises and will always be executed once
function qretry(fn, N, retryTimeout) {
    // Default args
    N = ((N === undefined || N < 0) ? 0 : N - 1);
    retryTimeout = (retryTimeout === undefined ? 0 : retryTimeout);

    return function wrapper() {
        // Actual arguments (passed first time)
        var args = arguments;
        var d = Q.defer();

        // Our failure counter (decounter by decrementing)
        var remainingTries = N;

        // The function with the try logic
        var _try = function _try() {
            // Call function
            fn.apply(null, args)
            .then(function(result) {
                // Success
                d.resolve(result);
            }, function(err) {
                // Failure

                // Decrement
                remainingTries -= 1;

                // No tries left, so reject promise with last error
                if(remainingTries < 0) {
                    // Total failure
                    d.reject(err);
                    return;
                } else {
                    // We have some retries left, so retry
                    setTimeout(_try, retryTimeout);
                }
            }).done();
        };

        // Start trying
        _try();

        // Give promise
        return d.promise;
    };
}

// Exports
module.exports.getRemoteAddress = getRemoteAddress;
module.exports.bindMethods = bindMethods;
module.exports.randElement = randElement;
module.exports.randIndex = randIndex;
module.exports.randInt = randInt;
module.exports.qretry = qretry;
