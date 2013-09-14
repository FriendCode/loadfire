// Requires
var _ = require('underscore');

// Constants
var REQUIRED_FIELDS = ['resources'];
var DEFAULTS = {
    'port': 8484,
    'bind': '0.0.0.0',
    'tcpTimeout': 600
};

function ConfigLoader(rawConfig) {
    // This should not be modified
    this.rawConfig = rawConfig;

    // This will be modified (updated)
    this.config = _.clone(rawConfig);
}

ConfigLoader.prototype.isValid = function() {
    var that = this;
    var fields = REQUIRED_FIELDS.map(function(x) {
        return that.config[x];
    });

    // Check that they exist
    var exist = _.all(fields.map(function(x) {
        return !_.isUndefined(x);
    }));

    return exist;
};

ConfigLoader.prototype.resolveBackends = function(backends) {
    return backends.map(function(x) {
        x.port = Number(x.port);
        return x;
    });
};


ConfigLoader.prototype.resolveResources = function(resources) {
    var that = this;
    var newResources = resources.map(function(x) {
        var y = _.clone(x);

        y.backends = that.resolveBackends(y.backends);

        y.middleware = y.middleware || [];

        // Bind methods to resource
        _.bindAll(y);

        return y;
    });
    return newResources;
};

ConfigLoader.prototype.resolve = function() {
    // Resolve patterns and what not
    var resources = this.resolveResources(this.config.resources);

    var newConfig = _.clone(this.config);

    // Update copied config
    newConfig.resources = resources;
    newConfig.port = Number(this.config.port);

    return newConfig;
};

ConfigLoader.prototype.setDefaults = function() {
    for(var key in DEFAULTS) {
        this.config[key] = this.rawConfig[key] || DEFAULTS[key];
    }
};

ConfigLoader.prototype.load = function() {
    // Set defaults
    this.setDefaults();

    // Validate
    var valid = this.isValid();
    if(!valid) {
        throw Error("Invalid Config");
    }

    // Resolve patterns etc ...
    return this.resolve();
};

function resolveConfig(config) {
    var loader = new ConfigLoader(config);
    var newConfig = loader.load();
    return newConfig;
}

// Exports
module.exports.ConfigLoader = ConfigLoader;
module.exports.resolveConfig = resolveConfig;

