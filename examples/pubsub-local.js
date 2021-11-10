const { pubsub } = require('../index.js')

const yaps = pubsub.broker()

yaps.publish('some-topic', 'hello')

yaps.subscribe('some-topic', (message) => {
  console.log('received from first subscriber', message)
})

yaps.subscribe('some-topic', (message) => {
  console.log('received from second subscriber', message)
})

setTimeout(() => {
  yaps.publish('some-topic', { hello: 'world2' })
}, 50)
