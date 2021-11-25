# ya-rfc [![npm version](https://badge.fury.io/js/ya-rfc.svg)](http://badge.fury.io/js/ya-rfc) [![license](https://img.shields.io/npm/l/ya-rfc.svg)](http://badge.fury.io/js/ya-rfc) [![test](https://github.com/nicocoul/ya-rfc/actions/workflows/test.yml/badge.svg)](https://github.com/nicocoul/ya-rfc/actions/workflows/test.yml) [![Coverage](https://coveralls.io/repos/github/nicocoul/ya-rfc/badge.svg?branch=main)](https://coveralls.io/github/nicocoul/ya-rfc?branch=main) [![Activity](https://img.shields.io/github/commit-activity/m/nicocoul/ya-rfc)](https://github.com/badges/shields/pulse)
Ya Rfc (Remote Function Call) is a [rpc](https://en.wikipedia.org/wiki/Remote_procedure_call) library for Node js.

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
