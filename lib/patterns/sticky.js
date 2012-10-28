 // Requires
var util = require('util');
var base = require('./base');


// Sticky Pattern
function Pattern(options) {
    // Super
    base.BasePattern.apply(this, arguments);

    // Sticky
    this.backendMap = {};
}
util.inherits(Pattern, base.BasePattern);


Pattern.prototype.hasBackend = function(key) {
    return key in this.backendMap;
};

// Get least loaded backend
Pattern.prototype.getBackend = function(key) {
    return this.backendMap[key];
};

Pattern.prototype.setBackend = function(key, backend) {
    // Keep in map
    this.backendMap[key] = backend;
    return;
};

// Exports
exports.Pattern = Pattern;