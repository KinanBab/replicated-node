function Liveness(system) {
  this._TCPManager = system.getModule('Manager', '*TCP*').module;

  this._status = {};
  this.events = {
    'connected': [],
    'disconnected': []
  };

  var self = this;
  this._TCPManager.addHandler('connect', function (id) { self._connected(id); });
  this._TCPManager.addHandler('close', function (id) { self._disconnected(id); });

  system.register('Liveness', 'TCP', this);
}

/*
 * Keep status of remotes up to date
 */
Liveness.prototype._connected = function (id) {
  this._status[id] = true;
  this.event('connected', id);
};
Liveness.prototype._disconnected = function (id) {
  this._status[id] = false;
  this.event('disconnected', id);
};
Liveness.prototype.isAlive = function (id) {
  return this._status[id] === true; // null -> false
};
Liveness.prototype.getAlive = function () {
  var alive = [];
  for (var id in this._status)
    if (this._status.hasOwnProperty(id))
      if (this.isAlive(id)) alive.push(id);
  return alive;
}

/*
 * Events:
 *  'connected', function (id)         remote connected
 *  'disconnected', function (id)      remote disconnected
 */
Liveness.prototype.addHandler = function (event, handler) {
  this.events[event].push(handler);
};
Liveness.prototype.event = function (event, id) {
  var handlers = this.events[event];
  for (var i = 0; i < handlers.length; i++)
    handlers[i].call(this, id);
};

module.exports = Liveness;
