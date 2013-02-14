var BOUNTY = (function () {
    var my = {};

    var url = NodeModules.require('url');

    //parses bounty data from the url
    //callback passes an error or the bounty data
    my.parse = function (amount, bountyUrl, callback) {
        if ((!_.isNumber(amount)) || _.isNaN(amount)) {
            callback("Need to specify an amount");
            return;
        }

        var parsedUrl = url.parse(bountyUrl, true);
        var path = parsedUrl.pathname;

        if (parsedUrl.hostname !== "github.com" || path.indexOf("/issues") < 0) {
            callback("Only accepting bounties for github issues currently");
            return;
        }

        var paths = path.split('/');

        //parse repository and issue
        var repository = paths[1] + "/" + paths[2];
        var issue = paths[4];

        //TODO check repo exists with GitHub

        var bounty = {
            type: "github",
            amount: amount,
            issue: issue,
            repo: repository,
            desc: "$" + amount + " bounty for Issue #" + issue + " in " + repository
        };

        callback(null, bounty);
    };

    return my;
})();