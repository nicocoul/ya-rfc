const ya = require('../../index.js')

const broker = ya.broker([ya.transports.tcp(8005)])

broker.events.on('new-channel', (channel) => console.log('new-channel', channel))
broker.events.on('lost-channel', (channel) => console.log('lost-channel', channel))

broker.events.on('schedule', (request) => console.log('schedule', request))
broker.events.on('execute', (request) => console.log('execute', request))
broker.events.on('executed', (request) => console.log('executed', request))
broker.events.on('error', (request) => console.log('error', request))
