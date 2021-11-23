Yaps-node is a [topic-based](http://en.wikipedia.org/wiki/Publish–subscribe_pattern#Message_filtering) [publish/subscribe](http://en.wikipedia.org/wiki/Publish/subscribe) library for Node js.

### Key Features
* asynchronous
* embeddable
* designed for micro-services


### Examples
Publishing and subscribing locally (same process)
```javascript
const { pubsub } = require('../index.js')

const broker = pubsub.broker()

broker.publish('some-topic', 'hello')

broker.subscribe('some-topic', (message) => {
  console.log('received from first subscriber', message)
})

broker.subscribe('some-topic', (message) => {
  console.log('received from second subscriber', message)
})

setTimeout(() => {
  broker.publish('some-topic', { hello: 'world2' })
}, 50)

```
Publishing and subscribing over tcp
```javascript
const net = require('net')
const { pubsub, plugins } = require('../index.js')

const broker = pubsub.broker()
broker.plug(plugins.broker.net(net.Server().listen(8000)))

broker.publish('some-topic', 'hello')

const client1 = pubsub.client.net({ host: 'localhost', port: 8000 })
const client2 = pubsub.client.net({ host: 'localhost', port: 8000 })

client1.publish('some-topic', { hello: 'world1' })

client2.subscribe('some-topic', (message) => {
  console.log(message)
})

setTimeout(() => {
  client1.publish('some-topic', { hello: 'world2' })
}, 50)

```
Publishing and subscribing over web sockets
```javascript
const { WebSocketServer } = require('ws')
const { pubsub, plugins } = require('../index.js')

const broker = pubsub.broker()
broker.plug(plugins.broker.ws(new WebSocketServer({ port: 8001 })))
broker.publish('some-topic', 'hello')

const client1 = pubsub.client.ws({ host: 'localhost', port: 8001 })
const client2 = pubsub.client.ws({ host: 'localhost', port: 8001 })

client2.publish('some-topic', { hello: 'world1' })

client2.subscribe('some-topic', (message) => {
  console.log(message)
})

setTimeout(() => {
  client1.publish('some-topic', { hello: 'world2' })
}, 50)

```

### Topic Filtering


## Versioning

Yaps-node uses [Semantic Versioning](http://semver.org/) for predictable versioning.

## Alternatives

These are a few alternative projects that also implement topic based publish subscribe in JavaScript.

* https://raw.githubusercontent.com/mroderick/PubSubJS/
* http://www.joezimjs.com/projects/publish-subscribe-jquery-plugin/
* http://amplifyjs.com/api/pubsub/
* http://radio.uxder.com/ — oriented towards 'channels', free of dependencies
* https://github.com/pmelander/Subtopic - supports vanilla, underscore, jQuery and is even available in NuGet