const path = require('path')
const ya = require('../../index.js')

const modulePath = path.join(__dirname, 'procedures.js')
const server = ya.server(ya.transports.tcp(8005, 'localhost'), modulePath)
server.events.on('schedule', (request) => console.log('schedule', request))
server.events.on('execute', (request) => console.log('execute', request))
server.events.on('executed', (request) => console.log('executed', request))
server.events.on('error', (request) => console.log('executed', request))
