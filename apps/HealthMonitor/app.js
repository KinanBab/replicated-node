// Imports
var System = require('../../lib/system.js');
var Manager = require('../../lib/modules/tcp-manager.js');
var Liveness = require('../../lib/modules/socket-liveness.js');

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

// Monitor Health
liveness.addHandler('connected', function (id) { console.log(id, 'connected'); });
liveness.addHandler('disconnected', function (id) { console.log(id, 'disconnected'); });

// Start the entire thing
manager.start();
