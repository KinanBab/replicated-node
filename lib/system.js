function System(config) {
  this._modules = {};
  this._config = Object.assign({}, config);
}

// read/write configuration
System.prototype.config = function () {
  var attr = arguments[0];
  var value = this._config[attr];
  if (arguments.length > 1) this._config[attr] = arguments[2];
  return value;
};

/*
 * Module registration and specialization
 */
System.prototype.register = function (name, specialization, module) {
  if (this._modules[name] == null) this._modules[name] = [];
  this._modules[name].push({ specialization: specialization, module: module });
};
System.prototype.specialize = function (name, old_specialization, new_specialization, module) {
  var mods = this._modules[name];
  for (var i = 0; i < mods.length; i++) {
    if (old_specialization == mods[i].specialization) {
      mods[i] = { specialization: new_specialization, module: module };
      return true;
    }
  }

  return false;
};

/*
 * Requirement matching
 */
System.prototype.getModule = function (name, requirement) {
  var mods = this._modules[name];
  for (var i = 0; i < mods.length; i++)
    if (this.requirementMatch(mods[i].specialization, requirement))
      return mods[i];
  throw new Error('cannot meet requirement "' + requirement + '" for name "' + name + '"');
};
System.prototype.requirementMatch = function (specialization, requirement) {
  var matchStart = !requirement.startsWith('*');
  var matchEnd = !requirement.endsWith('*');

  // Clean up requirement list
  requirement = requirement.split('*');
  for (var i = 1; i < requirement.length; i+=2) {
    requirement.splice(i, 0, '*');
  }
  
  if(!matchStart) requirement = requirement.slice(1);
  if(!matchEnd) requirement = requirement.slice(0, requirement.length - 1);

  // Specialization
  specialization = specialization.split(':');

  function match_one(i, j) {
    var r = requirement[j].split(':');
    for (var k = 0; k < r.length; k++) {
      if (i + k >= specialization.length || specialization[i + k] != r[k]) return -1;
    }
    return k;
  }

  // Match
  var i = 0;
  var j = 0;
  while (j < requirement.length) {
    var r = requirement[j];
    
    // Not matching exact end, and end of requirement is reached
    if (r == '*' && j == requirement.length - 1) return true;

    // Either * matches to empty, or match is in the future
    if (r == '*') {
      // try matching to empty
      var res = match_one(i, j+1);
      if (res > -1) { // matched
        i += res;
        j += 2;
      } else {
        i++;
      }
      continue;
    }
    
    // r is not *, must match here
    var res = match_one(i, j);
    if (res < 0) return false;
    i += res;
    j++;
  }

  // Reached the end of requirement AND end of requirement is not *, we must have matched all of specification
  return i >= specialization.length;
};

module.exports = System;
