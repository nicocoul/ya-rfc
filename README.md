Ya Rfc (Remote Function Execution) is a [rpc](https://en.wikipedia.org/wiki/Remote_procedure_call) library for Node js.

Integrates well with [ya-pubsub](https://www.npmjs.com/package/ya-pubsub).

### Key Features
* asynchronous
* embeddable
* designed for micro-services

### Execution Flow
![basic execution flow](https://github.com/nicocoul/ya-rfc/blob/dev/img/basicExecFlow.png)

### Basic Example
Given a module accessible by the RFC server
```javascript
// procedures.js

module.exports = {
  count: (until, progress) => {
    const x = parseInt(until / 10)
    for (let i = 0; i < until; i++) {
      if (i % x === 0) {
        progress(`${i}/${until}`)
      }
    }
    return until
  }
}

```
function 'count' can be executed remotely over tcp
```javascript
const net = require('net')
const path = require('path')
const ya = require('../index.js')

// Create broker a that forwards requests to servers
// according to their CPU and memory usage.
const broker = ya.broker()
broker.plug(ya.plugins.net(net.Server().listen(8002)))

// Server spawns worker processes at startup.
// Round-robin scheduling is used to balance load over worker processes.
const modulePath = path.join(__dirname, 'procedures.js')
ya.server.net({ host: 'localhost', port: 8002 }, modulePath)
ya.server.net({ host: 'localhost', port: 8002 }, modulePath)

// execute function 'count' from a remote client
const client = ya.client.net({ host: 'localhost', port: 8002 })
client.execute('count', [10000], (err, data) => {
  if (!err) {
    console.log('result is', data)
  }
}, {
  onProgress: (progress) => {
    console.log('progress', progress)
  },
  onStatus: (status) => {
    console.log('status', status)
  }
})

/* output:
status scheduled
status started
progress 0/10000
progress 1000/10000
progress 2000/10000
progress 3000/10000
progress 4000/10000
progress 5000/10000
progress 6000/10000
progress 7000/10000
progress 8000/10000
progress 9000/10000
status end
result is 10000
*/

```
or over websockets
```javascript
const { WebSocketServer } = require('ws')
const path = require('path')
const ya = require('../index.js')

const broker = ya.broker()
broker.plug(ya.plugins.ws(new WebSocketServer({ port: 8004 })))

const modulePath = path.join(__dirname, 'procedures.js')
ya.server.ws({ host: 'localhost', port: 8004 }, modulePath)

// execute procedure count from the client
const rpcClient = ya.client.ws({ host: 'localhost', port: 8004 })
rpcClient.execute('count', [10000], (err, data) => {
  if (!err) {
    console.log(data)
  }
})

/* output:
10000
*/

```

## Versioning

Yaps-node uses [Semantic Versioning](http://semver.org/) for predictable versioning.
