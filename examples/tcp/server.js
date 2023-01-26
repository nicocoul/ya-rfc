const path = require('path')
const ya = require('../../index.js')

const modulePath = path.join(__dirname, 'procedures.js')
ya.server(ya.transports.tcp(8005, 'localhost'), modulePath, { workers: 2 })
