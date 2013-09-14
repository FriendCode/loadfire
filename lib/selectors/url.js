// Url selector
function url(urlRegex) {
    var regex = new RegExp(urlRegex);
    return function _url_selector(req, cb) {
        return cb(
            null,
            req.url.match(regex) !== null
        );
    };
}


// Exports
module.exports = url;
