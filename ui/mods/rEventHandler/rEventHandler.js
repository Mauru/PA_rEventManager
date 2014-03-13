var rEventHandler=function(){
with(this){
var COBJ=this;
	//properties
	this.async_requests = {}; //stores asynchronous requests
	this.mod_requests=new Array(); //requests returned after the API has processed them
	
	//register a regular callback
    this.register_callback=function(message,callback){
    	if(!COBJ.mod_requests[message]){
    		COBJ.mod_requests[message]=new Array();
    	}
    	COBJ.mod_requests[message].push(callback);
    	return COBJ.mod_requests[message].length;
    };
    
    //handle a engine process call for mods
    this.handle_event=function(message,payload){
    	if(COBJ.mod_requests[message]!=undefined){
        	//console.log('EVENT CALLBACK FOR '+_msg+':'+JSON.stringify(_data));
        	while(COBJ.mod_requests[message].length>0){
        		var callback=COBJ.mod_requests[message].pop();
        		callback(data);
        	}
    	}
    };

	//create the initial engine hook, lucky there is no private|static|final...
	this.init=function(){
		app.registerWithCoherent=function(model,handlers){
			COBJ.register_coherent(model,handlers);
		};
	};	
	
	//overide (app.registerWithCoherent) : overides a number of functions from common.js
	this.register_coherent=function(model,handlers){
	    var response_key = Math.floor(Math.random() * 65536);
	    var responses = {};
	    
	    //define response function
	    globalHandlers.response = function(msg) {
	        if (!msg.hasOwnProperty('key'))
	            return;
	        var key = msg.key;
	        delete msg.key;
	        if (!responses[key])
	            return;

	        var respond = responses[key];
	        delete responses[key];
	        respond(msg.status === 'success', msg.result);
	    };
	    
	    //create callback for engine process
	    engine.on("process_message", COBJ.process_message);

	    //create callback for signal
	    engine.on("process_signal", COBJ.process_signal);
	    
	    //define method the engine uses to place a request
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
	    
	    //register result function
	    engine.on("async_result",COBJ.async_result);
	    
	    //register send_message function
	    model.send_message = function (message, payload, respond) {
	        var m = {};
	        if (payload)
	            m.payload = payload;

	        m.message_type = message;
	        if (respond)
	        {
	            m.response_key = ++response_key;
	            responses[m.response_key] = respond;
	        }

	        engine.call("conn_send_message", JSON.stringify(m));
	    }

	    //register disconnect function
	    model.disconnect = function () {
	        engine.call("reset_game_state");
	    }

	    //register exit function
	    model.exit = function () {
	        engine.call("exit");
	    }

	    //register handshake
	    app.hello = function(succeed, fail) {
	        model.send_message('hello', {}, function(success, response) {
	            if (success)
	                succeed(response);
	            else
	                fail(response);
	        });
	    };
	    
	    //tell the API we are ready
	    api.Panel.ready(_.keys(handlers).concat(_.keys(globalHandlers)));
	};
	
	//handle a request result (<-app.registerWithCoherent)
	function async_result(tag, success /* , ... */) {
	   var request, args;
	   // console.log(arguments);
	   request = COBJ.async_requests[tag];
	   delete COBJ.async_requests[tag];
	   
	   if (request) {
	       args = Array.slice(arguments, 2, arguments.length);
	       if (success) {
	           request.resolve.apply(request, args);
	       } else {
	           request.reject.apply(request, args);
	       }
	   }
	};
   
   //function for interpreting a return from the process : (<-app.registerWithCoherent)
   this.read_message=function(message, payload) {	   
	   	//you could theoretically modify the payload here...
	   console.log('[rEventHandler] handling process : '+message);
	    
	    //global handlers : execute standard API calls
	    if (handlers[message]) {
	        handlers[message](payload);
	    }
	    else if (globalHandlers[message]) {
	        globalHandlers[message](payload);
	    } 
	    else{
	    	//called if no handler could be found
	        console.log('[rEventHandler] Unhandled msg:' + message);
	    }
	    
	    //internal mod payload : these calls are made AFTER standard API calls
	    COBJ.handle_event(message,payload);
	};
	
	//function for receiving a message from the engine : (<-app.registerWithCoherent)
	this.process_message=function(string) {
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
  
   //processing a "message signal", i.e. a plain text engine callback : (<-app.registerWithCoherent)
   this.process_signal=function(string) {
      COBJ.read_message(string, {});
   };  
}	
};

var rEvents=new rEventHandler();
rEvents.init();
console.log('[rEventHandler] Successfully borrowed engine communication');