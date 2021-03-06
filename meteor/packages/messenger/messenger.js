//locally the messenger iframe is at localhost:3000, so that must be the targetUrl
var targetUrl = Environment.isLocal ? "http://localhost:3000" : Meteor.settings["ROOT_URL"];

Messenger = {
    target: {
        application: targetUrl,
        plugin: "https://github.com"
    }
};

/**
 * @param message
 * @param [target] Defaults to all
 */
Messenger.send = function (message, target) {
    if (!target)
        target = "*";

    parent.postMessage(message, target);
};

var eventCallbacks = [];
/**
 * Listen for whenever an event is called
 * @param name
 * @param callback
 */
Messenger.registerEvent = function (name, callback) {
    var callbacks = eventCallbacks[name];
    if (!callbacks)
        callbacks = eventCallbacks[name] = [];

    callbacks.push(callback);
};

var listening = false;

/**
 * Listen for messages from a target
 * @param {Messenger.target} from
 */
Messenger.listen = function (from) {
    if (listening)
        return;
    listening = true;

    window.addEventListener("message", function (event) {
        //only process messages from who we want to listen to
        if (event.origin !== from)
            return;

        var message = event.data;

        //if there is an event parameter, trigger any registered event callbacks
        if (message.event) {
            var callbacks = eventCallbacks[message.event];
            if (callbacks)
                _.each(callbacks, function (callback) {
                    callback(message);
                });
        }

        //if there is a method parameter, the sender wants to call a meteor method
        if (message.method) {
            //setup Meteor.call params (methodName, param1, param2..., callback)
            var callParams = [message.method];
            callParams = _.union(callParams, message.params);

            //add the callback
            callParams.push(function (error, result) {
                Messenger.send({id: message.id, error: error, result: result}, Messenger.target.plugin);
            });

            Meteor.call.apply(null, callParams);
        }
    }, false);
};
