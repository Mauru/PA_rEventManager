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
		this.mod_requests = new Array(); // requests returned after the API	has run its own	
		this.mod_requests_inject = new Array(); //requests for injecting messages to be sent
		this.async_requests={}; //tracking asynchronous requests

		// register a regular callback
		this.register_callback = function(message, callback) {
			if (!COBJ.mod_requests[message]) {
				COBJ.mod_requests[message] = new Array();
			}
			COBJ.mod_requests[message].push(callback);
			return COBJ.mod_requests[message].length;
		};

		// register a injected callback
		this.register_callback_inject = function(message, callback) {
			if (!COBJ.mod_requests_inject[message]) {
				COBJ.mod_requests_inject[message] = new Array();
			}
			COBJ.mod_requests_inject[message].push(callback);
			return COBJ.mod_requests_inject[message].length;
		};

		// handle a engine process call for mods
		this.handle_event = function(message, payload) {
			if (COBJ.mod_requests[message] != undefined) {
				// console.log('EVENT CALLBACK FOR '+_msg+':'+JSON.stringify(payload));
				while (COBJ.mod_requests[message].length > 0) {
					var callback = COBJ.mod_requests[message].pop();
					callback(payload);
				}
			}
		};
		
		// handle a engine process call, allow mods to modify the payload and message
		this.handle_injection=function(message,payload) {
			//so... how to we handle multiple injections...
			var c_count=COBJ.mod_requests_inject[message].length;
			if(c_count>1){
				console.log('[mEventHandler] WARNING! Multiple injections for event "'+message+'"');
			}
			var result=false;
			//just cycle through all the callbacks...
			while (COBJ.mod_requests_inject[message].length > 0) {
				var callback = COBJ.mod_requests_inject[message].pop();
				result=callback(payload,c_count);
			}
			return result;			
		};

		// create the initial engine hook, lucky there is no private|static|final...
		this.init_incoming = function() {
			// create callback for engine process
			engine.on("process_message", COBJ.process_message);

			// create callback for signal
			engine.on("process_signal", COBJ.process_signal);
			
			//callback for asynchronous processes
		    engine.on("async_result", COBJ.async_result); 
		};
		
		//modify how data is SENT to the engine
		this.init_outgoing=function(){
			//define unique response key
		    var response_key = Math.floor(Math.random() * 65536);
		    var responses = {};			
			
		    //asynchronous request
		    engine.asyncCall = function (/* ... */) {
		        // console.log('in engine.asyncCall');
		        // console.log(arguments);
		        var request = new $.Deferred();
		        engine.call.apply(engine, arguments).then(
		            function (tag) {
		                // console.log('in engine.asyncCall .then handler, tag=', tag);
		                COBJ.async_requests[tag] = request;
		            }
		        );
		        return request.promise();
		    };
		    
		    //regular outgoing message system 
		    model.send_message = function (message, payload, respond) {
		        var m = {};
		        
		        //define outgoing message "data"
		        if (payload){
		            m.payload = payload;
		        }
		        m.message_type = message;
		        //how to "respond" on a multi-part communication request
		        if(respond){
		            m.response_key = ++response_key;
		            responses[m.response_key] = respond;
		        }
		        engine.call("conn_send_message", JSON.stringify(m));
		    }	
		    
		    //how to handle API to Engine handshake events, this could potentially inehrit additional hooks
		    app.hello = function(succeed, fail) {
		    	console.log('[mEventHandler] handshake requested');
		        model.send_message('hello', {}, function(success, response) {
		            if(success){
		               succeed(response);
		            }else{
		               fail(response);
		            }
		        });
		    };
		};

		// function for interpreting a return from the process : (<-app.registerWithCoherent)
		this.read_message = function(message, payload) {
			// console.log('[mEventHandler] handling process : '+message); //uncomment this to track events			
			
			var skip=false;
			
			//if necessary modify the payload here...
			if(COBJ.mod_requests_inject[message]){
				var result=COBJ.handle_injection(message,payload);
				if(result){
					if(result.abandon){//abandon the callback process here, we don't want this result to reach the API
						return false;
					}
					if(result.message&&result.payload){//we want to modify the callback then return it to the event chain
						var message=result.message;
						var payload=result.payload;
					}
				}
			}

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
			
			//there might be extra information attached here...
			
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
	        
	        //grab the outgoing request if existing
	        request = COBJ.async_requests[tag];
	        delete  COBJ.async_requests[tag];
	        if (request) {
	            args = Array.slice(arguments, 2, arguments.length);
	            if (success) {//request resolved
	                request.resolve.apply(request, args);
	            }else{//request rejected
	                request.reject.apply(request, args);
	            }
	        }
	    };	
	}
};

var mEvents = new mEventHandler();
mEvents.init_incoming();
mEvents.init_outgoing();
console.log('[mEventHandler] Successfully "borrowed" engine communication');