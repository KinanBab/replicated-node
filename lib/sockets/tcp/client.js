// Imports
var WebSocketClient = require('websocket').client;

/*
 * Constructor
 * Does not auto-connect, to connect call <Client>.connect()
 */
function Client(me, remote, hostname) {
  this.id = me;
  this.remote = remote;
  this.hostname = hostname;
  this.ready = false;
  this.reconnectTimeout = 1000;
  this.events = {
    'connectError': function (error) {},
    'error': function (error) {},
    'close': function (number, description) {},
    'receiveString': function (string) {},
    'receiveBuffer': function (buffer) {},
    'connect': function () {},
  };
  
  // Create connection
  var self = this;
  this._client = new WebSocketClient();
  this._connection = null;

  this._client.on('connectFailed', function () {
    if (self.events['connectError'].apply(self, arguments) !== false) self._reconnect();
  });
  this._client.on('connect', function () { self._accept.apply(self, arguments); });
}

/*
 * Internal handlers
 */
Client.prototype._accept = function (connection) {
  var self = this;

  this.ready = true;
  this._connection = connection;

  this._connection.on('message', function () { self._receive.apply(self, arguments); });
  this._connection.on('error', this.event('error'));
  this._connection.on('close', function () {
    self.ready = false;
    self._connection = null;
    if (self.events['close'].apply(self, arguments) !== false) self._reconnect();
  });

  this.events['connect'].call(self);
};
Client.prototype._receive = function (message) {
  if (message.type === 'utf8') {
    this.events['receiveString'].call(this, message.utf8Data);
  } else if (message.type === 'binary') {
    this.events['receiveBuffer'].call(this, message.binaryData);
  }
};

/*
 * Send messages by type
 * Throws null pointer exception if connection is not ready
 */
Client.prototype.sendString = function (message) {
  this._connection.sendUTF(message);
};
Client.prototype.sendBuffer = function (buffer) {
  this._connection.sendBytes(buffer);
};

/*
 * Events:
 *  'connectError', function (error):               error during setup
 *  'error', function (error):                      error during regular execution
 *  'close', function (number, description)         connection is closed
 *  'receiveString', function (stringMessage)       string message is received
 *  'receiveBuffer', function (bufferMessage)       binary buffer message is received
 *  'connect', function ()                          socket connected
 */
Client.prototype.on = function (event, handler) {
  this.events[event] = handler;
};
Client.prototype.event = function (event) {
  var self = this;
  return function () {
    self.events[event].apply(self, arguments);
  }
};

/*
 * Connect/disconnect to/from server
 */
Client.prototype.connect = function () {
  this._client.connect('ws://'+this.hostname+'/?id='+this.id, null);
};
Client.prototype.disconnect = function (description) {
  this._connection.close(this._connection.CLOSE_REASON_NORMAL, description);
};
Client.prototype._reconnect = function () {
  var self = this;
  setTimeout(function () { self.connect.call(self); }, this.reconnectTimeout);
};

// exports
module.exports = Client;
