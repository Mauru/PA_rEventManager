The mEventHandler modification for Planetary Annihilation:
==========================================================
Purpose:
Hook into engine/api communication and listen for process events (selection, metal/energy consumption, commander health, fabrication, everything else used in alerts...)
It provides an interface for other mods to queue into to prevent any conflicts and help establish a "best practice" case for future mod-developers.

Forum thread:
https://forums.uberent.com/threads/rel-wip-reventhandler-a-pa-engine-process-event-framework.57858

For Developers:
This mod hijacks the app.registerWithCoherent function established in common.js to listen to all the handler_* -events defined in live_game.js and pretty much every other scene file the game uses.
It is currently only hooked into "live_game.js", but could potentially be employed in the lobby etc. as well.

If you want/need added functionality, you are free to fork this @ https://github.com/Mauru/PA_rEventManager

Author(s):
Mauru

Come join us on irc.esper.net #pamodding , #planetaryannihilation


