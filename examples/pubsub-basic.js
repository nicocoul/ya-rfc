const { createBroker, createPubSubClient } = require('../index.js')

createBroker({ port: 8888 })

const client1 = createPubSubClient({ host: '::', port: 8888 })
const client2 = createPubSubClient({ host: '::', port: 8888 })

client1.publish('some-topic', { hello: 'world1' })

client2.subscribe('some-topic', (message) => {
  console.log(message)
})

setTimeout(() => {
  client1.publish('some-topic', { hello: 'world2' })
}, 5000)
