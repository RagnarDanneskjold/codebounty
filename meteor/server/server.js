Bounties = new Meteor.Collection("bounties");

//TODO before publish: remove this
Meteor.publish("allUserData", function () {
    return Meteor.users.find();
});

var Future = __meteor_bootstrap__.require('fibers/future');
var Fiber = __meteor_bootstrap__.require('fibers');

Meteor.methods({
    //return the paypal pre-approval url
    'createBounty': function (amount, bountyUrl) {
        var fut = new Future();

        var userId = this.userId;

        Fiber(function () {
            BOUNTY.parse(amount, bountyUrl, function (error, bounty) {
                if (error)
                    throw new Meteor.Error(404, "Incorrect parameters");

                //store the bounty
                bounty.userId = userId;

                var id = Bounties.insert(bounty);

                var cancel = CONFIG.rootUrl + "cancelBounty?id=" + id;
                var confirm = CONFIG.rootUrl + "confirmBounty?id=" + id;

                //Start pre-approval process
                PAYPAL.GetApproval(bounty.amount, bounty.desc, cancel, confirm, function (error, data, approvalUrl) {
                    if (error) {
                        Bounties.remove({_id: id});
                        throw new Meteor.Error(500, "Error starting preapproval");
                    }

                    Fiber(function () {
                        Bounties.update({_id: id}, {$set: {preapprovalKey: data.preapprovalKey}})
                    }).run();

                    fut.ret(approvalUrl);
                });
            });
        }).run();

        return fut.wait();
    },
    'cancelBounty': function (id) {
        Bounties.remove({_id: id, userId: this.userId});
    },
    //TODO move confirm bounty to an IPN method instead. will be more stable
    //after a bounty payment has been authorized
    //test the the token and payer id are valid (since the client passed them)
    //then store them to capture the payment later
    'confirmBounty': function (id) {
        var fut = new Future();

        var user = Meteor.users.findOne(this.userId);
        var bounty = Bounties.findOne({_id: id, userId: this.userId});

        //Start pre-approval process
        PAYPAL.ConfirmApproval(bounty.preapprovalKey, function (error, data) {
            if (error)
                throw new Meteor.Error(500, "Error confirming preapproval");

            console.log("Confirmed!");
            console.log(data);

            if (!data.approved)
                throw new Meteor.Error(402, "Payment not approved");

            Fiber(function () {
                Bounties.update(bounty, {$set: {approved: true}});
            }).run();

            //TODO prettify comment
            var commentBody = "I just added a " + bounty.desc +
                ". [Download](http://codebounty.com/extension) the codebounty code extension to add your bounties.";

            GitHub.PostComment(user, bounty.repo, bounty.issue, commentBody);

            fut.ret(true);
        });

        return fut.wait();
    }
});

Meteor.Router.add({
    '/totalBounties': function () {
        var query = this.request.query;

        if (!query.url)
            return 0;

        var bounties = Bounties.find({url: query.url}).fetch();

        var totalBounty = _.reduce(bounties, function (sum, bounty) {
            return sum + parseFloat(bounty.amount);
        }, 0);

        return totalBounty.toString();
    }
});

Meteor.startup(function () {
//Setup Authentication Providers
//TODO need to pass settings json with deploy http://docs.meteor.com/#meteor_settings ex: meteor deploy --settings deploySettings.json
    Accounts.loginServiceConfiguration.remove({
        service: "github"
    });

    Accounts.loginServiceConfiguration.insert({
        service: "github",
        clientId: "a2087b445e1e1493bb7b",
        secret: "74e9f41bd555149d3a546620f5a398ace8e1a34f"
        //clientId: Meteor.settings.GITHUB_CLIENT_ID,
        //secret: Meteor.settings.GITHUB_SECRET
    });
});