//
// shock-ac.js
//
// Assignment client script for shock environment
//

var ORIGIN = {x: 0, y: 0, z: 0};
var initialized = false;
var frameCount = 0;
var TRIGGER_CHANNEL = "shock-trigger-channel";
var RESET_CHANNEL = "shock-reset-channel";

var entityNames = ["debug-panel",
                   "entry-back-trigger",  // used to detect when avatar is deep inside container.
                   "container-trigger",   // used to detect when avatars are in the container.
                   "entry-collision",     // used to block front of container
                   "exit-collision",      // used to block back of container
                   "entry-light",         // entry way light.
                   "strobe-light",        // strobe light in middle of container
                   "exit-light"           // exit way light.
                  ];

var entityIDMap = {};

var numAvatarsInContainerTriggerMap = {};
var numAvatarsInEntryTriggerMap = {};

var state;
var timeInState = 0;

var DOOR_SLAM_URL = "https://s3.amazonaws.com/hifi-public/tony/shock/door-slam.wav?2";
var doorSlamSound = SoundCache.getSound(DOOR_SLAM_URL);
var doorSlamInjector;

var SCREAM_URL = "https://s3.amazonaws.com/hifi-public/tony/shock/screams.wav";
var screamSound = SoundCache.getSound(SCREAM_URL);
var screamInjector;

var stateTable = {
    uninitialized: { update: uninitializedUpdate },
    idle: { enter: idleEnter, update: idleUpdate },
    closeEntryDoors: { enter: closeEntryDoorsEnter, update: closeEntryDoorsUpdate },
    spook: { enter: spookEnter, update: spookUpdate },
    openExitDoors: { enter: openExitDoorsEnter, update: openExitDoorsUpdate }
};

var strobeTimer = 0;
var strobeOn = false;

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
    editEntity("entry-light", { intensity: 1.0 });
    editEntity("exit-light", { intensity: 0.0 });
    editEntity("strobe-light", { intensity: 0.0 });
}

function idleUpdate(dt) {
    if (numAvatarsInEntry() > 0) {
        setState("closeEntryDoors");
    }
}

//
// closeEntryDoors
//

function closeEntryDoorsEnter() {

    // slam the door!
    var id = lookupEntityByName("entry-collision");
    var doorPosition = ORIGIN;
    if (id) {
        doorPosition = Entities.getEntityProperties(id, "position").position;
    }
    if (doorSlamSound.downloaded) {
        if (doorSlamInjector) {
            doorSlamInjector.restart();
        } else {
            doorSlamInjector = Audio.playSound(doorSlamSound, { position: doorPosition, volume: 0.7, loop: false });
        }
    }
    editEntity("entry-collision", { collisionless: false, visible: true });

    // turn out the lights!
    editEntity("entry-light", { intensity: 0 });
}

function closeEntryDoorsUpdate(dt) {
    if (timeInState > 3.0) {
        setState("spook");
    }
}

//
// spook
//

function spookEnter() {

    // begin the screams!
    var id = lookupEntityByName("container-trigger");
    var screamPosition = ORIGIN;
    if (id) {
        screamPosition = Entities.getEntityProperties(id, "position").position;
    }
    if (screamSound.downloaded) {
        if (screamInjector) {
            screamInjector.restart();
        } else {
            screamInjector = Audio.playSound(screamSound, { position: screamPosition, volume: 0.7, loop: false });
        }
    }

    strobeTimer = 0;
}

function spookUpdate(dt) {
    // strobe the lights!
    strobeTimer += dt;
    if (strobeTimer > 0.05) {
        strobeTimer = 0.0;
        strobeOn = !strobeOn;
        editEntity("strobe-light", { intensity: strobeOn ? 1.0 : 0.0 });
    }

    if (timeInState > 10.0) {
        editEntity("strobe-light", { intensity: 0.0 });
        setState("openExitDoors");
    }
}

//
// openExitDoors
//

function openExitDoorsEnter() {
    editEntity("exit-collision", { collisionless: true, visible: false });
    editEntity("exit-light", { intensity: 1.0 });
}

function openExitDoorsUpdate(dt) {
    // TODO: push player out of the container
    if (numAvatarsInContainer() === 0) {
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

function numAvatarsInEntry() {
    var count = 0;
    var keys = Object.keys(numAvatarsInEntryTriggerMap);
    var i, l = keys.length;
    for (i = 0; i < l; i++) {
        if (numAvatarsInEntryTriggerMap[keys[i]] > 0.0) {
            count++;
        }
    }
    return count;
}

function numAvatarsInContainer() {
    var count = 0;
    var keys = Object.keys(numAvatarsInContainerTriggerMap);
    var i, l = keys.length;
    for (i = 0; i < l; i++) {
        if (numAvatarsInContainerTriggerMap[keys[i]] > 0.0) {
            count++;
        }
    }
    return count;
}

function update(dt) {
    var updateFunc = stateTable[state].update;
    timeInState += dt;
    if (updateFunc) {
        updateFunc(dt);
    }

    // decrement timers for trigger maps
    var keys = Object.keys(numAvatarsInEntryTriggerMap);
    var i, l = keys.length;
    for (i = 0; i < l; i++) {
        numAvatarsInEntryTriggerMap[keys[i]] -= dt;
    }
    keys = Object.keys(numAvatarsInContainerTriggerMap);
    l = keys.length;
    for (i = 0; i < l; i++) {
        numAvatarsInContainerTriggerMap[keys[i]] -= dt;
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

    var AVATAR_TRIGGER_TIMEOUT = 10.0;
    //print("MESSAGE, channel = " + channel + ", message = " + message + ", senderID = " + senderID);
    if (channel === TRIGGER_CHANNEL) {
        var data = JSON.parse(message);
        if (data.inside) {
            if (data.entityID === lookupEntityByName("entry-back-trigger")) {
                numAvatarsInEntryTriggerMap[senderID] = AVATAR_TRIGGER_TIMEOUT;
            } else if (data.entityID === lookupEntityByName("container-trigger")) {
                numAvatarsInContainerTriggerMap[senderID] = AVATAR_TRIGGER_TIMEOUT;
            }
        } else {
            if (data.entityID === lookupEntityByName("entry-back-trigger")) {
                numAvatarsInEntryTriggerMap[senderID] = 0;
            } else if (data.entityID === lookupEntityByName("container-trigger")) {
                numAvatarsInContainerTriggerMap[senderID] = 0;
            }
        }
    } else if (channel === RESET_CHANNEL) {
        reset();
    }
});

setState("uninitialized");

