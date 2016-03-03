Shock
------------

asset list

file:///msys64/home/anthony/code/shock/cargo-container.fbx
file:///msys64/home/anthony/code/shock/bloody-cargo-container.fbx

script list
-----------------
file:///msys64/home/anthony/code/shock/shock-ac-min.js
file:///msys64/home/anthony/code/shock/shock-trigger.js

AC script woes
-------------------
Avatar positions are not accessible to ac scripts.
currentapi.js doesn't work for ac-scripts.
EntityViewer is not documented and necessary for Entities.findEntities() to to function.
Sounds fail to load with no information in the logs to help debug the problem.

Entity script woes
---------------------
Not easy to determine what event methods are called.  The docs should somehow catergorize them.
The way entity scripts are structured is not standard javascript.
entity scripts have funky syntax that dont pass jshint.
Entity script onEnter doesnt trigger when someone spawns inside of the entity.
Entity scripts sometimes do not run after a server-console "restart".  (could be wrong??)


