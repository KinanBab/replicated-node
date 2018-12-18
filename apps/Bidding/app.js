// Imports
var System = require('../../lib/system.js');
var Manager = require('../../lib/modules/tcp-manager.js');
var Liveness = require('../../lib/modules/socket-liveness.js');
var CRDT = require('../../lib/modules/crdt.js');

// Parse command line arguments
// [ <id1 hostname1> <id2 hostname2> <id3 hostname3> ... my_id ]
var hosts = {};
for (var i = 2; i < process.argv.length - 1; i+=2) {
  hosts[process.argv[i]] = process.argv[i+1];
}
var me = process.argv[process.argv.length - 1];

var my_host = hosts[me];
var my_port = parseInt(my_host.substring(my_host.indexOf(':') + 1));
delete hosts[me];

// Initialize sub-modules
var system = new System({ 'id': me, 'port': my_port, 'remotes': hosts });
var manager = new Manager(system);
var liveness = new Liveness(system);

// Initialize our CRDT
function updateBid(state, bid) {
  if (state[bid.bidName] == null || state[bid.bidName].amount < bid.amount)
    state[bid.bidName] = { 'bidder': bid.bidder, 'amount': bid.amount };
  return state;
}
function mergeBids(state1, state2) {
  for (var bid in state2) {
    if (state2.hasOwnProperty(bid)) {
      var bid1 = state1[bid];
      var bid2 = state2[bid];
      if (bid1 == null || bid1.amount < bid2.amount) state1[bid] = bid2;
    }
  }
  
  return state1;
}
var crdt = new CRDT.State(system, {}, updateBid, mergeBids);

// Deadlines for bids
var deadlines = {};
manager.listen('bidding', function (id, message) {
  message = JSON.parse(message);
  for (var bidName in message) {
    if (!message.hasOwnProperty(bidName)) continue;

    if (deadlines[bidName] != null && deadlines[bidName] != message[bidName]) {
      console.log('Warning! Bid ', bidName, ' created in multiple sessions!');
      deadlines[bidName] = deadlines[bidName] > message[bidName] ? deadlines[bidName] : message[bidName];
    } else {
      console.log('Bid ', bidName, ' announced!');
      deadlines[bidName] = bidName;
    }
  }
});

// Monitor Health
liveness.addHandler('connected', function (id) {
  console.log(id, 'connected');
  manager.sendReliableString('bidding', id, JSON.stringify(deadlines));
});
liveness.addHandler('disconnected', function (id) { console.log(id, 'disconnected'); });

// Start the entire thing
manager.start();

// Display instructions to users:
console.log('Available commands:');
console.log('\t new <bidName> <bidDuration in milliseconds : integer>       create a new bid');
console.log('\t read <bidName>                                              prints result of bid indicating whether it is the final result or not');
console.log('\t bid <bidName> <bidderName> <amount : integer>               prints result of bid indicating whether it is the final result or not');


// Read bids
var readline = require('readline');
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', function(line) {
  var command = line.split(' ');
  if (line.startsWith('new')) {
    var bidName = command[1];
    var bidDeadline = parseInt(command[2]) + new Date().getTime();
    if (deadlines[bidName] == null) {
      deadlines[bidName] = bidDeadline;
      console.log('Ok!');

      // broadcast bid name and deadline
      var message = JSON.stringify(deadlines);
      for (var id in hosts) {
        if (hosts.hasOwnProperty(id)) {
          manager.sendReliableString('bidding', id, message);
        }
      }
    } else {
      console.log('Error! bid exists');
    }
  } else if (line.startsWith('read')) {
    var bidName = command[1];
    if (deadlines[bidName] == null) {
      console.log('Error! bid does not exist yet!');
      return;
    }

    var bid = crdt.read()[bidName];
    var versions = crdt.getVersions();
    var minVersion = versions[me];
    for (var id in hosts) {
      if (hosts.hasOwnProperty(id)) {
        minVersion = minVersion < versions[id] ? minVersion : versions[id];
      }
    }

    if (minVersion != null && minVersion >= deadlines[bidName])
      console.log('Final winner is ', bid);
    else
      console.log('So far, it is ', bid);
  } else if (line.startsWith('bid')) {
    var bidName = command[1];
    
    var timestamp = new Date().getTime();
    if (deadlines[bidName] == null) {
      console.log('Error! bid does not exist yet!');
      return;
    } else if (deadlines[bidName] <= timestamp) {
      console.log('Error! bid closed!');
      return;
    }

    var bidder = command[2];
    var amount = parseInt(command[3]);
    if (amount <= 0) {
      console.log('Error! bid amount must be positive');
      return;
    }

    crdt.update({ 'amount': amount, 'bidder': bidder, 'bidName': bidName });
    console.log('Ok!');
  }
});
