//
// shock-ac.js
//
// Assignment client script for shock environment
//

var ORIGIN = {x: 0, y: 0, z: 0};
var DEFAULT_CONTAINER_LOCATION = { x: 186.0, y: -7.5, z: 377.9 };

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
                   "exit-light",          // exit way light.
                   "bloody-container"     // bloody interior
                  ];

var entityIDMap = {};

var numAvatarsInContainerTriggerMap = {};
var numAvatarsInEntryTriggerMap = {};

var state;
var timeInState = 0;
var stateEnterTime = Date.now();

var DOOR_SLAM_URL = "https://s3-us-west-1.amazonaws.com/hifi-content/DomainContent/Junkyard/dieFi/door-slam.wav";
var doorSlamSound = SoundCache.getSound(DOOR_SLAM_URL);
var doorSlamInjector;

var SCREAM_URL = "https://s3-us-west-1.amazonaws.com/hifi-content/DomainContent/Junkyard/dieFi/screams.wav";
var screamSound = SoundCache.getSound(SCREAM_URL);
var screamInjector;

var stateTable = {
    uninitialized: { update: uninitializedUpdate },
    idle: { enter: idleEnter, update: idleUpdate },
    closeEntryDoors: { enter: closeEntryDoorsEnter, update: closeEntryDoorsUpdate },
    lightsOut: { enter: lightsOutEnter, update: lightsOutUpdate },
    strobe: { enter: strobeEnter, update: strobeUpdate },
    lightsOutAgain: { enter: lightsOutAgainEnter, update: lightsOutAgainUpdate },
    openExitDoors: { enter: openExitDoorsEnter, update: openExitDoorsUpdate }
};

var strobeTimer = 0;
var strobeBlink = false;

var entryTimer = 0;

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

var uninitializedUpdateCount = 0;

function uninitializedUpdate(dt) {
    uninitializedUpdateCount++;
    if (uninitializedUpdateCount % 15 === 0) {
        var entities = Entities.findEntities(DEFAULT_CONTAINER_LOCATION, 100);

        // fill up entityIDMap
        var foundEntityCount = 0;
        var i, l = entities.length;
        for (i = 0; i < l; i++) {
            var name = Entities.getEntityProperties(entities[i], "name").name;
            var j, ll = entityNames.length;
            for (j = 0; j < ll; j++) {
                if (name === entityNames[j]) {
                    print("Found " + entityNames[j] + ": " + entities[i]);
                    entityIDMap[entityNames[j]] = entities[i];
                    foundEntityCount++;
                }
            }
        }

        if (foundEntityCount !== entityNames.length) {
            print("Warning: found " + foundEntityCount + " out of " + entityNames.length + " entities.  Will try again later.");
            // try again later...
            return;
        } else {
            print("Success: found " + foundEntityCount + " out of " + entityNames.length + " entities.  Initialization complete!");
        }

        // success! go to idle state.
        setState("idle");
    }
}

//
// idle
//

function idleEnter() {
    editEntity("bloody-container", { visible: false });
    editEntity("entry-collision", { collisionless: true, visible: false });
    editEntity("exit-collision", { collisionless: false, visible: true });
    editEntity("entry-light", { intensity: 0.5 });
    editEntity("exit-light", { intensity: 0.0 });
    editEntity("strobe-light", { intensity: 0.0 });
    entryTimer = 0;
}

function idleUpdate(dt) {
    if (numAvatarsInEntry() > 0) {
        entryTimer += dt;
    } else {
        entryTimer = 0;
    }

    if (entryTimer > 1) {
        setState("closeEntryDoors");
    }
}

//
// closeEntryDoors
//

function closeEntryDoorsEnter() {

    // slam the door!
    var id = lookupEntityByName("entry-collision");
    var doorPosition = DEFAULT_CONTAINER_LOCATION;
    if (id) {
        doorPosition = Entities.getEntityProperties(id, "position").position;
    }
    if (doorSlamSound.downloaded) {
        if (doorSlamInjector) {
            doorSlamInjector.restart();
        } else {
            doorSlamInjector = Audio.playSound(doorSlamSound, { position: doorPosition, volume: 1.0, loop: false });
        }
    }
    editEntity("entry-collision", { collisionless: false, visible: true });

    // turn out the lights!
    editEntity("entry-light", { intensity: 0 });
}

function closeEntryDoorsUpdate(dt) {
    if (timeInState > 1.0) {
        setState("lightsOut");
    }
}

//
// lightsOut
//

function lightsOutEnter() {

    // begin the scream track
    var id = lookupEntityByName("container-trigger");
    var screamPosition = DEFAULT_CONTAINER_LOCATION;
    if (id) {
        screamPosition = Entities.getEntityProperties(id, "position").position;
    }
    if (screamSound.downloaded) {
        if (screamInjector) {
            screamInjector.restart();
        } else {
            screamInjector = Audio.playSound(screamSound, { position: screamPosition, volume: 1.0, loop: false });
        }
    }
}

function lightsOutUpdate() {
    if (timeInState > 6) {
        setState("strobe");
    }
}

//
// strobe
//

function strobeEnter() {
    strobeTimer = 0;
    // show the bloody interior
    editEntity("bloody-container", { visible: true });
}

function strobeUpdate(dt) {

    strobeTimer += dt;
    if (strobeTimer > 0.05) {
        strobeTimer = 0.0;
        strobeBlink = !strobeBlink;
        editEntity("strobe-light", { intensity: strobeBlink ? 0.7 : 0.0 });
    }

    // after five seconds turn the lights out again!
    if (timeInState > 8.0) {
        setState("lightsOutAgain");
    }
}

//
// lightsOutAgain
//

function lightsOutAgainEnter() {
    // turn off the strobe
    editEntity("strobe-light", { intensity: 0.0 });

    // hide the bloody interior
    editEntity("bloody-container", { visible: false });
}

function lightsOutAgainUpdate(dt) {
    if (timeInState > 4.0) {
        setState("openExitDoors");
    }
}

//
// openExitDoors
//

function openExitDoorsEnter() {
    editEntity("strobe-light", { intensity: 0.0 });
    editEntity("bloody-container", { visible: false });
    editEntity("exit-collision", { collisionless: true, visible: false });
    editEntity("exit-light", { intensity: 0.5 });

    // play door slam
    var id = lookupEntityByName("exit-collision");
    var doorPosition = DEFAULT_CONTAINER_LOCATION;
    if (id) {
        doorPosition = Entities.getEntityProperties(id, "position").position;
    }
    if (doorSlamSound.downloaded) {
        if (doorSlamInjector) {
            doorSlamInjector.restart();
        } else {
            doorSlamInjector = Audio.playSound(doorSlamSound, { position: doorPosition, volume: 1.0, loop: false });
        }
    }
}

function openExitDoorsUpdate(dt) {
    // wait till all avatars leave the container
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

        stateEnterTime = Date.now();
        timeInState = 0;

        // enter new state
        if (stateTable[newState]) {
            var enterFunc = stateTable[newState].enter;
            if (enterFunc) {
                enterFunc();
            }
        } else {
            debug("ERROR: no state table for state = " + newState);
        }

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

    timeInState = (Date.now() - stateEnterTime) / 1000.0;

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

EntityViewer.setPosition(DEFAULT_CONTAINER_LOCATION);
EntityViewer.setCenterRadius(100);
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

