// Imports
var WebSocketServer = require('websocket').server;
var http = require('http');

/*
 * Constructor
 * Does not auto-listen, to listen call <Server>.listen()
 */
function Server(port) {
  this.port = port;
  this.events = {
    'error': function (id, error) {},
    'close': function (id, number, description) {},
    'receiveString': function (id, string) {},
    'receiveBuffer': function (id, buffer) {},
    'connect': function (id) {},
  };

  // keep track connections by client id
  var self = this;
  this._connections = {};

  // Create server
  this._httpServer = http.createServer(function (request, response) {});
  this._socketServer = new WebSocketServer({
    httpServer: this._httpServer,
    autoAcceptConnections: false,
    keepaliveInterval: 250,
    keepaliveGracePeriod: 1000
  });

  // listen and accept connections as they come
  this._socketServer.on('request', function (request) {
    var connection = request.accept(null, request.origin);
    connection.__id = parseInt(request.resourceURL.query.id);
    self._accept.call(self, connection); 
  });
  this._socketServer.on('connect', function () {});
}

/*
 * Internal handlers
 */
Server.prototype._accept = function (connection) {
  var self = this;
  connection.server = this;
  this._connections[connection.__id] = connection;

  connection.on('message', function () { self._receive.call(self, connection, ...arguments); });
  connection.on('error', function () { self.events['error'].call(self, connection.__id, ...arguments); });
  connection.on('close', function () {
    self._connections[connection.__id] = null;
    self.events['close'].call(self, connection.__id, ...arguments);
  });

  this.events['connect'].call(this, connection.__id);
};
Server.prototype._receive = function (connection, message) {
  if (message.type === 'utf8') {
    this.events['receiveString'].call(this, connection.__id, message.utf8Data);
  } else if (message.type === 'binary') {
    this.events['receiveBuffer'].call(this, connection.__id, message.binaryData);
  }
};

/*
 * Check status and connections by id
 */
Server.prototype.ready = function (id) {
  return this.getConnection(id) != null;
};
Server.prototype.getConnection = function (id) {
  return this._connections[id];
};

/*
 * Send messages by type
 * Throws null pointer exception if connection is not ready
 */
Server.prototype.sendString = function (id, message) {
  this._connections[id].sendUTF(message);
};
Server.prototype.sendBuffer = function (id, buffer) {
  this._connections[id].sendBytes(buffer);
};

/*
 * Events:
 *  'error', function (id, error):                      error during regular execution
 *  'close', function (id, number, description)         connection is closed
 *  'receiveString', function (id, stringMessage)       string message is received
 *  'receiveBuffer', function (id, bufferMessage)       binary buffer message is received
 *  'connect', function (id)                            socket connected
 */
Server.prototype.on = function (event, handler) {
  this.events[event] = handler;
};

Server.prototype.listen = function () {
  this._httpServer.listen(this.port, function () { });
};
Server.prototype.disconnect = function (id, description) {
  this._connections[id].close(this._connections[id].CLOSE_REASON_NORMAL, description);
};

module.exports = Server;
