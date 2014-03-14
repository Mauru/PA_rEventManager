/*======================================================================
PROCESS EVENT HANDLING "FRAMEWORK" v 0.2
------------------------------------------------------------------------
usage: mEvents.register_callback(message,callback);

valid handlers to play with can be found in "./media/alpha/live_game/live_game.js"
"selection" is one, but there are a couple of others...
You can disect the messages further by disecting mEvents.read_message
and mEvents.process_message repectively.

Most of the processes were abstracted from "./media/js/common.js"
That would be the place to check if something breaks after a patch
=======================================================================*/
var mEventHandler = function() {
	with (this) {
		var COBJ = this;
		// properties
		this.mod_requests = new Array(); // requests returned after the API	has run its own									// has processed them

		// register a regular callback
		this.register_callback = function(message, callback) {
			if (!COBJ.mod_requests[message]) {
				COBJ.mod_requests[message] = new Array();
			}
			COBJ.mod_requests[message].push(callback);
			return COBJ.mod_requests[message].length;
		};

		// handle a engine process call for mods
		this.handle_event = function(message, payload) {
			if (COBJ.mod_requests[message] != undefined) {
				// console.log('EVENT CALLBACK FOR
				// '+_msg+':'+JSON.stringify(_data));
				while (COBJ.mod_requests[message].length > 0) {
					var callback = COBJ.mod_requests[message].pop();
					callback(data);
				}
			}
		};

		// create the initial engine hook, lucky there is no private|static|final...
		this.init = function() {
			// create callback for engine process
			engine.on("process_message", COBJ.process_message);

			// create callback for signal
			engine.on("process_signal", COBJ.process_signal);
			
			//callback for asynchronous processes
		    engine.on("async_result", COBJ.async_result);
		};

		// function for interpreting a return from the process : (<-app.registerWithCoherent)
		this.read_message = function(message, payload) {
			// you could theoretically modify the payload here...
			// console.log('[mEventHandler] handling process : '+message); //uncomment this to track events

			// global handlers : execute standard API calls
			if (handlers[message]) {
				handlers[message](payload);
			} else if (globalHandlers[message]) {
				globalHandlers[message](payload);
			} else {
				// called if no handler could be found
				console.log('[mEventHandler] Unhandled msg:' + message);
			}

			// internal mod payload : these calls are made AFTER standard API calls
			COBJ.handle_event(message, payload);
		};

		// function for receiving a message from the engine : (<-app.registerWithCoherent)
		this.process_message = function(string) {
			var message;
			try {
				message = JSON.parse(string);
			} catch (e) {
				console.log('process_message: JSON parsing error');
				console.log(string);
				return;
			}

			var payload = message.payload;
			if (!payload) {
				payload = _.clone(message);
				delete payload.message_type;
			}
			COBJ.read_message(message.message_type, payload);
		};

		// processing a "message signal", i.e. a plain text engine callback : (<-app.registerWithCoherent)
		this.process_signal = function(string) {
			COBJ.read_message(string, {});
		};
		
		//processing an asynchronous request
	    this.async_result=function(tag, success /* , ... */) {
	        var request, args;
	        console.log('[mEventHandler: received async_result');
	        console.log(arguments);
	        
	        //perform default functions
	        request = async_requests[tag];
	        delete async_requests[tag];
	        if (request) {
	            args = Array.slice(arguments, 2, arguments.length);
	            if (success) {
	                request.resolve.apply(request, args);
	            } else {
	                request.reject.apply(request, args);
	            }
	        }
	    };
	}
};

var mEvents = new mEventHandler();
mEvents.init();
console.log('[mEventHandler] Successfully borrowed engine communication');