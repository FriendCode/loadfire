 // Requires
var util = require('util');
var base = require('./base');


// Random Pattern
// base pattern implements random pattern by de
function Pattern(options) {
    // Super
    base.BasePattern.apply(this, arguments);
}
util.inherits(Pattern, base.BasePattern);


// Exports
exports.Pattern = Pattern;