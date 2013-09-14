// Host selector
function host(hostRegex) {
    var regex = new RegExp(hostRegex);
    return function _host_selector(req, cb) {
        return cb(
            null,
            req.headers.host.match(regex) !== null
        );
    };
}


// Exports
module.exports = host;
