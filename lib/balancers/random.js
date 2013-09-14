 // Requires
var _ = require('underscore');


// Random Pattern
function random(backends, req, cb) {
    return cb(null, _.sample(backends));
}


// Exports
module.exports = random;
