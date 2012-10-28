 // Requires
var util = require('util');
var base = require('./base');


// Roundrobin Pattern
function Pattern(options) {
    // Super
    base.BasePattern.apply(this, arguments);
}
util.inherits(Pattern, base.BasePattern);


Pattern.prototype.hasBackend = function(key) {
    return false;
};

Pattern.prototype.newBackend = function(key) {
    // Rotate backends
    var x = this.backends.shift();
    this.backends.push(x);

    return x;
};

// Get least loaded backend
Pattern.prototype.getBackend = function(key) {
    return this.backends[0];
};


// Exports
exports.Pattern = Pattern;