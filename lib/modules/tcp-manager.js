// Manages communication
var Client = require('../sockets/tcp/client.js');
var Server = require('../sockets/tcp/server.js');

var ACK_PREFIX = '@_#_@';
var REL_PREFIX = '!_#_!';
var RPC_PREFIX = '_RPC_';
var SEP = ':';

var DEFAULT_RPC_TIMEOUT = 2000; // 2 seconds
var DEFAULT_TIMEOUT = 2000; // 250 milliseconds

/*
 * Constructor: Create a communication manager
 * Communication manager creates a server, and $n-1$ clients.
 * Each client connects to one of the other servers.
 * Manager listens to incoming communication through the server,
 * and sends outgoing communication through clients.
 */
function CommunicationManager(system, me, port, servers) {
  // Create the server
  this._server = new Server(port);
  this.events = {
    'error': [], // function (id, error) {}
    'close': [], // function (id, number, description) {}
    'connect': [], // function (id) {}
  };

  // Create a client by remote server
  this._clients = {};
  this._remotes = [];
  this._counters = {};
  this._pending = {};
  this._pendingRPC = {};
  for (var id in servers) {
    if (servers.hasOwnProperty(id)) {
      this._remotes.push(id);
      this._clients[id] = new Client(me, id, servers[id]);
      this._counters[id] = 0;
      this._pending[id] = {};
      this._pendingRPC[id] = {};
    }
  }

  // Listeners
  var self = this;
  this._listeners = {};
  this._rpc = {};
  this._server.on('connect', this.event('connect'));
  this._server.on('error', this.event('error'));
  this._server.on('close', this.event('close'));
  this._server.on('receiveString', function (id, message) { self._receiveString(id, message); });

  system.register('Manager', 'TCP', this);
}

/*
 * Start connecting and listening on all sockets/servers
 */
CommunicationManager.prototype.start = function () {
  this._server.listen();
  for (var i = 0; i < this._remotes.length; i++) {
    this._clients[this._remotes[i]].connect();
  }
};

/*
 * Unreliable send
 */
CommunicationManager.prototype.sendString = function (module_name, id, message) {
  if (!this._clients[id].ready) return false;
  if (module_name != null) message = module_name + SEP + message;

  this._clients[id].sendString(message);
  return true;
};

/*
 * Reliable send
 */
CommunicationManager.prototype.sendReliableString = function (module_name, id, message, timeout) {
  if (timeout == null) timeout = DEFAULT_TIMEOUT;

  var counter = this._counters[id]++;
  var message = REL_PREFIX + counter + SEP + module_name + SEP + message;
  
  var self = this;
  this._pending[id][counter] = message;

  (function resend() {
    if (self._pending[id][counter] != null) {
      self.sendString(null, id, message);
      setTimeout(resend, timeout);
    }
  })();
};
CommunicationManager.prototype._sendAck = function (id, counter) {
  this.sendString(null, id, ACK_PREFIX+counter);
};

/*
 * Receive
 */
CommunicationManager.prototype._receiveString = function (id, message) {
  if (message.startsWith(RPC_PREFIX)) {
    this._receiveRPC(id, message.substring(RPC_PREFIX.length));
    return;
  }
  else if (message.startsWith(ACK_PREFIX)) {
    // ack
    var counter = parseInt(message.substring(ACK_PREFIX.length));
    delete this._pending[id][counter];
    return;
  }
  else if (message.startsWith(REL_PREFIX)) {
    // reliable message, must ack
    var counter = parseInt(message.substring(REL_PREFIX.length, message.indexOf(SEP)));
    message = message.substring(message.indexOf(SEP) + SEP.length);
    this._sendAck(id, counter);
  }

  // Received message, handle it!
  var module_name = message.substring(0, message.indexOf(SEP));
  message = message.substring(message.indexOf(SEP) + SEP.length);
  this._listeners[module_name](id, message);
};

/*
 * Events:
 *  'error', function (id, error):                      error
 *  'close', function (id, number, description)         remote disconnected
 *  'connect', function (id)                            remote connected
 */
CommunicationManager.prototype.addHandler = function (event, handler) {
  this.events[event].push(handler);
};
CommunicationManager.prototype.event = function (event) {
  var self = this;
  return function () {
    var handlers = self.events[event];
    for (var i = 0; i < handlers.length; i++)
      handlers[i].apply(self, arguments);
  }
};
CommunicationManager.prototype.listen = function (module_name, listener) {
  this._listeners[module_name] = listener;
};

/*
 * RPC
 */
CommunicationManager.prototype.registerRPC = function (module_name, name, func) {
  var RPC = this._rpc[module_name];
  if (RPC == null) {
    RPC = {};
    this._rpc[module_name] = RPC;
  }

  RPC[name] = func;
};
CommunicationManager.prototype.sendRPC = function (module_name, id, ret_handler, timeout, func_name, ...parameters) {
  if (timeout == null) timeout = DEFAULT_RPC_TIMEOUT;

  var counter = this._counters[id]++;
  var message = { a: 1, m: module_name, c: counter, n: func_name, p: parameters };
  message = RPC_PREFIX + JSON.stringify(message);

  this._pendingRPC[id][counter] = ret_handler;
  this.sendString(null, id, message);

  if (timeout > 0) {
    var self = this;
    setTimeout(function () {
      var handler = self._pendingRPC[id][counter];
      if (handler != null) {
        delete self._pendingRPC[id][counter];
        handler(false);
      }
    }, timeout);
  }
};
CommunicationManager.prototype._receiveRPC = function (id, message) {
  // parse RPC request
  message = JSON.parse(message);
  var module_name = message.m;
  var counter = message.c;
  var func_name = message.n;
  var parameters = message.p;
  var action = message.a;
  var ret_val = message.r;

  // RPC Request, must call function and return
  if (action === 1) {
    var self = this;
    var func = this._rpc[module_name][func_name];
    var ret_func = function (ret_val) {
      var ret_message = { a: 0, c: counter, r: ret_val };
      self.sendString(null, id, RPC_PREFIX + JSON.stringify(ret_message));
    };
    func.call(null, ret_func, ...parameters);
  }

  // RPC Response, must return value to handler
  else {
    var handler = this._pendingRPC[id][counter];
    delete this._pendingRPC[id][counter];
    handler(true, ret_val);
  }
}

module.exports = CommunicationManager;
