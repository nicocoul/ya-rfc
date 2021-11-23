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
