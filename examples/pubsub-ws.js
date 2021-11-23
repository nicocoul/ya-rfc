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
