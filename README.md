# ya-rfc [![npm version](https://badge.fury.io/js/ya-rfc.svg)](http://badge.fury.io/js/ya-rfc) [![license](https://img.shields.io/npm/l/ya-rfc.svg)](http://badge.fury.io/js/ya-rfc) [![test](https://github.com/nicocoul/ya-rfc/actions/workflows/test.yml/badge.svg)](https://github.com/nicocoul/ya-rfc/actions/workflows/test.yml) [![Coverage](https://coveralls.io/repos/github/nicocoul/ya-rfc/badge.svg?branch=main)](https://coveralls.io/github/nicocoul/ya-rfc?branch=main) [![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/nicocoul/ya-rfc.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/nicocoul/ya-rfc/context:javascript)
Yet Another [Remote Function Call](https://en.wikipedia.org/wiki/Remote_procedure_call) library for Node js.

Ya-rpc anables to run functions on remote machines within a distributed system without worrying about network messaging & load balancing.

It provides an easy way to implement performance-critical applications by parallel execution on machines and processes.

![basic execution flow](https://github.com/nicocoul/ya-rfc/blob/dev/img/arch.png)

### Key Features
* blazing fast
* integrates well with [ya-pubsub](https://www.npmjs.com/package/ya-pubsub)
* asynchronous
* embeddable

### Function execution flow
![basic execution flow](https://github.com/nicocoul/ya-rfc/blob/dev/img/basicExecFlow.png)

### Example
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

// Create servers that spawns worker processes at startup.
// Round-robin scheduling is used to balance load over worker processes.
const modulePath = path.join(__dirname, 'procedures.js')
ya.server.net({ host: 'localhost', port: 8002 }, modulePath)
ya.server.net({ host: 'localhost', port: 8002 }, modulePath)

const client = ya.client.net({ host: 'localhost', port: 8002 })
// execute function 'count' from a remote client
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
