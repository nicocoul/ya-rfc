const net = require('net')
const { pubsub, plugins } = require('../index.js')

const yapsBroker = pubsub.broker()
const server = net.Server()
yapsBroker.plug(plugins.broker.net(server))
server.listen(8000)
yapsBroker.publish('some-topic', 'hello')

const yapsClient1 = pubsub.client.net({ host: 'localhost', port: 8000 })
const yapsClient2 = pubsub.client.net({ host: 'localhost', port: 8000 })

yapsClient1.publish('some-topic', { hello: 'world1' })

yapsClient2.subscribe('some-topic', (message) => {
  console.log(message)
})

setTimeout(() => {
  yapsClient1.publish('some-topic', { hello: 'world2' })
}, 50)
