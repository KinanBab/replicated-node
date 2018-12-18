# Easy replication of node.js applications
Collection of Algorithms and Infrastructure for replicating and distributing Node.js applications

## File Structure
* apps: contains demos / small applications
* lib: contains library modules:
  * lib/modules:   contains modules that implement distributed algorithms (some based on other models), in particular it contains implementations of a TCP based reliable communication and RPC protocol, liveness checks based on sending TCP heart beats, and a state-based conflict-free replicated data type based (CRDT).
  * lib/sockets:   contains a bunch of TCP socket plumbing code
  * lib/system.js: provides the system object used to register instantiated modules and specialization as well as global configuration.

## Running:
* install dependencies using `npm install`
* to run an app of interest, use `cd` to move to the app's directory, then run the app using:
```bash
node app.js <id1> <hostname:port> <id2> <hostname:port> .... <running_instance_id>
```
Note that every such command spawns an instance of the distributed protocol. It is recommended to open every instance in a seperate terminal tab.
