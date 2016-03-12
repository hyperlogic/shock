//
// shock-trigger.js
//
// Entity script meant to be attached to a box entity.
//

var TRIGGER_CHANNEL = "shock-trigger-channel";

(function () {
    var inside = false;
    var timer = 0.0;
    var entityID;
    this.preload = function (id) {
        entityID = id;
        Script.update.connect(this.update);
    };
    this.enterEntity = function (id) {
        inside = true;
        this.sendUpdate();
    };
    this.leaveEntity = function (id) {
        inside = false;
        this.sendUpdate();
    };
    this.update = function (dt) {
        timer += dt;
        if (timer > 1) {
            sendUpdate();
            timer = 0;
        }
    };
    function sendUpdate() {
        Messages.sendMessage(TRIGGER_CHANNEL, JSON.stringify({ inside: inside, entityID: entityID }));
    };
    this.unload = function (entityID) {
        Script.update.disconnect(this.update);
    };
})
