// Requires
var _ = require('underscore');
var base = require('./patterns/base');
var sticky = require('./patterns/sticky');
var random = require('./patterns/random');
var roundrobin = require('./patterns/roundrobin');


// Maps pattern names to their patterns
var PATTERN_MAP = {
    'sticky': sticky.Pattern,
    'random': random.Pattern,
    'roundrobin': roundrobin.Pattern
};

// A fallback pattern
var DEFAULT_PATTERN = random.Pattern;

// A utility function to get patterns by name
// with fallbacks to either the function itself or
// the default pattern
function getPattern(nameOrFunc) {
    var mapped = _.isString(nameOrFunc) && PATTERN_MAP[nameOrFunc];
    var func = _.isFunction(nameOrFunc) && nameOrFunc;

    return mapped || func || DEFAULT_PATTERN;
}


// Exports
module.exports.getPattern = getPattern;
module.exports.BasePattern = base.BasePattern;
module.exports.StickyPattern = sticky.Pattern;
module.exports.RandomPattern = random.Pattern;
module.exports.RoundrobinPattern = roundrobin.Pattern;