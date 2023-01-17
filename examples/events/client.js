const ya = require('../../index.js')

const client = ya.client(ya.transports.tcp(8005, 'localhost'))

client.events.on('execute', (request) => console.log('execute', request))
client.events.on('executed', (request) => console.log('executed', request))
client.events.on('failed', (request) => console.log('failed', request))

for (let i = 0; i < 50; i++) {
  client.remote.replyWithDelay(i, 1000).then(console.log)
}
