# ya-rfc 
[![npm version](https://badge.fury.io/js/ya-rfc.svg)](http://badge.fury.io/js/ya-rfc) [![license](https://img.shields.io/npm/l/ya-rfc.svg)](http://badge.fury.io/js/ya-rfc) [![test](https://github.com/nicocoul/ya-rfc/actions/workflows/test.yml/badge.svg)](https://github.com/nicocoul/ya-rfc/actions/workflows/test.yml) [![Coverage Status](https://coveralls.io/repos/github/nicocoul/ya-rfc/badge.svg?branch=main)](https://coveralls.io/github/nicocoul/ya-rfc?branch=main) [![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/nicocoul/ya-rfc.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/nicocoul/ya-rfc/context:javascript)

Yet Another [Remote Function Call](https://en.wikipedia.org/wiki/Remote_procedure_call) library for Node js.

Ya-rpc anables to run functions on remote machines within a distributed system without worrying about network messaging or load balancing.

It provides an easy way to implement performance-critical applications by parallel execution on machines and processes.

![basic execution flow](https://github.com/nicocoul/ya-rfc/blob/dev/img/arch.png)

## Key Features

* multiple transports available
  * websocket
  * tcp
  * ipc
* [configurable load balancing](###user-defined-load-balancing)
* blazing fast
* integrates well with [ya-pubsub](https://www.npmjs.com/package/ya-pubsub)
* asynchronous
* embeddable

### Typical execution flow

![basic execution flow](https://github.com/nicocoul/ya-rfc/blob/dev/img/basicExecFlow.png)

## Installation

```sh
$ npm install ya-rfc
```
**ya-rfc** is tested with versions 12, 14 & 16 on of node.js on ubuntu-latest.

## Quick start

```javascript
const ya = require('ya-rfc');
```
### Broker

Create a **rfc** broker that accepts **TCP**, **IPC** and **websocket** connections (only one transport required)
``` javascript
const namedPipe = path.join('\\\\.\\pipe', 'some-pipe');

ya.broker([
  ya.transports.ipc(namedPipe),
  ya.transports.tcp(8005, 'localhost'),
  ya.transports.ws(8006, 'localhost')]);
```

### Server

Define functions that remote **rfc** clients will request to execute
``` javascript
// procedures.js
module.exports = {
  sum: (a, b) => {
    return a + b
  },
  count: (until, progress) => {
    const x = parseInt(until / 10)
    for (let i = 0; i < until; i++) {
      if (i % x === 0) {
        progress(`${i}/${until}`)
      }
    }
    return until
  }
};
```
Create a (ideally multiple) **rfc** server that connects to the Broker over **TCP**, it can also be **IPC** or **websocket**
``` javascript
ya.server(ya.transports.tcp(8005, 'localhost'), 'procedures.js');

// ya.server(ya.transports.ws(8006, 'localhost'));

// const win32namedPipe = require('path').join('\\\\.\\pipe', 'some-pipe');
// ya.server(ya.transports.ipc(win32namedPipe));
```
### Client

Create a **rfc** client that connects to the Broker over **TCP**, it can also be **IPC** or **websocket**
``` javascript
const client = ya.client(ya.transports.tcp(8005, 'localhost'));

// const wsClient = ya.client(ya.transports.ws(8006, 'localhost'))

// const win32namedPipe = require('path').join('\\\\.\\pipe', 'some-pipe')
// const ipcClient = ya.client(ya.transports.ipc(win32namedPipe))
```
Execute a function remotely
``` javascript
tcpClient.remote.sum(1, 2)
  .then(result => {
    console.log(result)
  })
  .catch(error => {
    console.error(error)
  });
/* output:
3
*/
```
Execute a function remotely and get notified of its progression
``` javascript
client.remote.count(10000, {
  onProgress: (progress) => {
    console.log('progress', progress)
  }
})
  .then(result => {
    console.log('result is', result)
  })
  .catch(error => {
    console.error(error)
  });
/* output:
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
result is 10000
*/
```

## User defined load balancing

By default, each server will be assigned a maximum of `4*cpu-cores` concurrent requests distributed (round robin) on its `2*cpu-cores` workers. The broker will always route requests to the less loaded server.

You can create a server with an arbitrary number of *workers*
```javascript
ya.server(transport, modulePath, { workers:10 })
```

You can define the maximum accepted load. For example, if each request has a load of `1`, a maximum of 100 concurrent requests can be defined as such:
```javascript
ya.server(transport, modulePath, { maxLoad:[100] })
```
Alternatively you can unset (not recommended) the limit by providing **-1**
```javascript
ya.server(transport, modulePath, { maxLoad:[-1] })
```

By default, all requests are assigned a *load* of `1`, this can be overridden like this:
```javascript
rfc.remote.foo(bar, { load:[10] })
```

Often, the impact of a request on cpu or memory usage has to be modelled with several values, this is why *maxLoad* and *load* options are to be provided as arrays.


## Versioning
Yaps-node uses [Semantic Versioning](http://semver.org/) for predictable versioning.

## License
This library is licensed under MIT.
