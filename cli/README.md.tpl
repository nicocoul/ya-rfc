# ya-rfc 
[![npm version](https://badge.fury.io/js/ya-rfc.svg)](http://badge.fury.io/js/ya-rfc) [![license](https://img.shields.io/npm/l/ya-rfc.svg)](http://badge.fury.io/js/ya-rfc) [![test](https://github.com/nicocoul/ya-rfc/actions/workflows/test.yml/badge.svg)](https://github.com/nicocoul/ya-rfc/actions/workflows/test.yml) [![Coverage Status](https://coveralls.io/repos/github/nicocoul/ya-rfc/badge.svg?branch=main)](https://coveralls.io/github/nicocoul/ya-rfc?branch=main) [![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/nicocoul/ya-rfc.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/nicocoul/ya-rfc/context:javascript)

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
{{{examples.procedures}}}
```
function 'count' can be executed remotely over tcp
```javascript
{{{examples.tcp}}}
```
or over websockets
```javascript
{{{examples.ws}}}
```

## Versioning

Yaps-node uses [Semantic Versioning](http://semver.org/) for predictable versioning.
