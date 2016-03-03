//
// shock-trigger.js
//
// Entity script meant to be attached to a box entity.
//

var TRIGGER_CHANNEL = "shock-trigger-channel";

(function () {
    var sequenceNumber = 0;
    this.enterEntity = function(entityID) {
        Messages.sendMessage(TRIGGER_CHANNEL, JSON.stringify({ action: "enter", entityID: entityID, sequenceNumber: sequenceNumber }));
        print("trigger enter, entityId = " + entityID + ", seq = " + sequenceNumber);
        sequenceNumber++;
    };
    this.leaveEntity = function(entityID) {
        Messages.sendMessage(TRIGGER_CHANNEL, JSON.stringify({ action: "leave", entityID: entityID, sequenceNumber: sequenceNumber }));
        print("trigger leave, entityId = " + entityID + ", seq = " + sequenceNumber);
        sequenceNumber++;
    };
})
