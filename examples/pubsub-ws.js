const { WebSocketServer } = require('ws')
const { pubsub, plugins } = require('../index.js')

const yapsBroker = pubsub.broker()
const server = new WebSocketServer({ port: 8001 })
yapsBroker.plug(plugins.broker.ws(server))
yapsBroker.publish('some-topic', 'hello')

const yapsClient1 = pubsub.client.ws({ host: 'localhost', port: 8001 })
const yapsClient2 = pubsub.client.ws({ host: 'localhost', port: 8001 })

yapsClient1.publish('some-topic', { hello: 'world1' })

yapsClient2.subscribe('some-topic', (message) => {
  console.log(message)
})

setTimeout(() => {
  yapsClient1.publish('some-topic', { hello: 'world2' })
}, 50)
