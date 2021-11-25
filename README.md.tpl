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
