const { pubsub } = require('../index.js')

pubsub.createBroker({ port: 8888 })

const client1 = pubsub.createClient({ host: '::', port: 8888 })
const client2 = pubsub.createClient({ host: '::', port: 8888 })

client1.publish('some-topic', { hello: 'world1' })

client2.subscribe('some-topic', (message) => {
  console.log(message)
})

setTimeout(() => {
  client1.publish('some-topic', { hello: 'world2' })
}, 1000)
