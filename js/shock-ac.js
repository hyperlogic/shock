//
// shock-ac.js
//
// Assignment client script for shock environment
//

var ORIGIN = {x: 0, y: 0, z: 0};
var soundURL = "https://s3.amazonaws.com/hifi-public/sounds/08_Funny_Bone.wav";
var sound = SoundCache.getSound(soundURL);
var initialized = false;
var frameCount = 0;
var TRIGGER_CHANNEL = "shock-trigger-channel";
var RESET_CHANNEL = "shock-reset-channel";

var entityNames = ["debug-panel",
                   "entry-back-trigger",  // used to detect when avatar is deep inside container.
                   "container-trigger",   // used to detect when avatars are in the container.
                   "entry-collision",     // used to block front of container
                   "exit-collision"];     // used to block back of container
var entityIDMap = {};

var numAvatarsInEntryTrigger = 0;
var numAvatarsInContainer = 0;

var state;
var timeInState = 0;

var stateTable = {
    uninitialized: { update: uninitializedUpdate },
    idle: { enter: idleEnter, update: idleUpdate },
    closeEntryDoors: { enter: closeEntryDoorsEnter, update: closeEntryDoorsUpdate },
    openExitDoors: { enter: openExitDoorsEnter, update: openExitDoorsUpdate }
};

function editEntity(name, props) {
    var id = lookupEntityByName(name);
    if (id) {
        Entities.editEntity(id, props);
    }
}

function lookupEntityByName(name) {
    var id = entityIDMap[name];
    if (id) {
        return id;
    } else {
        debug("ERROR: Could not find entity \"" + name + "\"");
    }
}

var lineBuffer = ["~", "~", "~", "~", "~", "~", "~", "~", "~"];
function debug(str) {
    print(str);
    lineBuffer.push(str);
    var debugPanelID = entityIDMap["debug-panel"];
    if (debugPanelID) {
        Entities.editEntity(debugPanelID, {text: lineBuffer.slice(-8, lineBuffer.length).join("\n")});
    }
}

function uninitializedUpdate(dt) {
    var entities = Entities.findEntities(ORIGIN, 100);

    if (entities.length === 0) {
        // try again later...
        return;
    }

    // fill up entityIDMap
    var i, l = entities.length;
    for (i = 0; i < l; i++) {
        var name = Entities.getEntityProperties(entities[i], "name").name;
        var j, ll = entityNames.length;
        for (j = 0; j < ll; j++) {
            if (name === entityNames[j]) {
                print("Found " + entityNames[j] + ": " + entities[i]);
                entityIDMap[entityNames[j]] = entities[i];
            }
        }
    }

    setState("idle");
}

//
// idle
//

function idleEnter() {
    editEntity("entry-collision", { collisionless: true, visible: false });
    editEntity("exit-collision", { collisionless: false, visible: true });
}

function idleUpdate(dt) {
    if (numAvatarsInEntryTrigger > 0) {
        setState("closeEntryDoors");
    }
}

//
// closeEntryDoors
//

function closeEntryDoorsEnter() {
    editEntity("entry-collision", { collisionless: false, visible: true });
}

function closeEntryDoorsUpdate(dt) {
    if (timeInState > 3.0) {
        setState("openExitDoors");
    }
}

//
// openExitDoors
//

function openExitDoorsEnter() {
    editEntity("exit-collision", { collisionless: true, visible: false });
}

function openExitDoorsUpdate(dt) {
    // TODO: push player out of the container
    if (numAvatarsInContainer === 0) {
        setState("idle");
    }
}

//
//
//

function setState(newState) {
    if (state !== newState) {

        // exit old state
        if (stateTable[state]) {
            var exitFunc = stateTable[state].exit;
            if (exitFunc) {
                exitFunc();
            }
        } else {
            debug("ERROR: no state table for state = " + state);
        }

        // enter new state
        if (stateTable[newState]) {
            var enterFunc = stateTable[newState].enter;
            if (enterFunc) {
                enterFunc();
            }
        } else {
            debug("ERROR: no state table for state = " + newState);
        }

        timeInState = 0;
        state = newState;
        debug("state = " + state);
    }
}

function update(dt) {
    var updateFunc = stateTable[state].update;
    timeInState += dt;
    if (updateFunc) {
        updateFunc(dt);
    }
}

function reset() {
    goToState("idle");
}

EntityViewer.setPosition(ORIGIN);
EntityViewer.setCenterRadius(60000);
var octreeQueryInterval = Script.setInterval(function() {
    EntityViewer.queryOctree();
}, 1000);

Script.update.connect(update);

Messages.subscribe(TRIGGER_CHANNEL);
Messages.messageReceived.connect(function (channel, message, senderID) {
    print("MESSAGE, channel = " + channel + ", message = " + message + ", senderID = " + senderID);
    if (channel === TRIGGER_CHANNEL) {
        var data = JSON.parse(message);
        switch (data.action) {
        case 'enter':
            if (data.entityID === lookupEntityByName("entry-back-trigger")) {
                numAvatarsInEntryTrigger++;
            } else if (data.entityID === lookupEntityByName("container-trigger")) {
                numAvatarsInContainer++;
            }
            break;
        case 'leave':
            if (data.entityID === lookupEntityByName("entry-back-trigger")) {
                numAvatarsInEntryTrigger--;
            } else if (data.entityID === lookupEntityByName("container-trigger")) {
                numAvatarsInContainer--;
            }
            break;
        }
    } else if (channel === RESET_CHANNEL) {
        reset();
    }
});

setState("uninitialized");

