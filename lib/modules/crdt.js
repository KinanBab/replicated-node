// Conflict-Free Replicated Data Types
// All operations are commutative and associative
// Hence you cannot have conflicts
// https://link.springer.com/chapter/10.1007%2F978-3-642-24550-3_29
var COUNTER = 0;

// State based CRDT: when synchronizing, all CRDTs share their state, and apply the merge function 
// to merge it into a single state.
// merge must be associative, commutative, and idempotent, and update must be monotic.
function StateCRDT(system, initial_state, update, merge) {
  this.id = system.config('id');
  this.c = COUNTER++;

  this.state = initial_state;
  this._updateFunc = update;
  this._mergeFunc = merge;

  var self = this;
  this._communicationManager = system.getModule('Manager', '*').module;
  this._communicationManager.registerRPC('CRDT'+this.c, '_merge', function () { self._merge.apply(self, arguments);  });

  this.versions = {};
  this.versions[this.id] = new Date().getTime();

  this.liveness = system.getModule('Liveness', '*').module;
  this.liveness.addHandler('connected', function (id) {
    self.mergeRPC(id);
  });

  this._mergeScheduler = setInterval(function () {
    self.versions[self.id] = new Date().getTime();

    var alive = self.liveness.getAlive();
    for (var i = 0; i < alive.length; i++)
      self.mergeRPC(alive[i]);
  }, 10000); // 10 seconds intervals
}

StateCRDT.prototype.update = function () {
  this.state = this._updateFunc.call(this, this.state, ...arguments);
  this.versions[this.id]++;
};

StateCRDT.prototype.read = function () {
  return this.state;
};

StateCRDT.prototype.getVersions = function () {
  return this.versions;
};

StateCRDT.prototype._merge = function (ret, id, oVersions, oState) {
  this.state = this._mergeFunc(this.state, oState);
  this._mergeVersions(oVersions);

  ret({ 'state': this.state, 'versions': this.versions });
};

StateCRDT.prototype.mergeRPC = function (id) {
  var self = this;
  var retFunc = function (status, retVal) {
    // no timeout or errors
    if (status) self._merge(function() {}, null, retVal.versions, retVal.state);
  };
  this._communicationManager.sendRPC('CRDT'+this.c, id, retFunc, 5000, '_merge', self.versions, self.state); // 5 seconds timeout
}

StateCRDT.prototype._mergeVersions = function (oVersions) {
  for (var id in oVersions) {
    if (oVersions.hasOwnProperty(id))
      this.versions[id] = (this.versions[id] == null || oVersions[id] > this.versions[id]) ? oVersions[id] : this.versions[id];
  }
};

module.exports = {
  'State': StateCRDT
};
