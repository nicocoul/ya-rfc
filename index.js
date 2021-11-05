'use strict'
const clients = require('./lib/pubsub')
const broker = require('./lib/broker')
const tcp = require('./lib/client')

module.exports = {
  createBroker: (options) => {
    return broker.createBroker(options.port, 1000, options.storePath)
  },
  createRpcServer: (options) => {
    const tcpClient = tcp.newClient(options.host, options.port)
    return clients.createRpcServer(tcpClient, options.modulePath, options.affinity, options.childProcessesCount)
  },
  createRpcClient: (options) => {
    const tcpClient = tcp.newClient(options.host, options.port)
    return clients.createRpcClient(tcpClient)
  },
  createPubSubClient: (options) => {
    const tcpClient = tcp.newClient(options.host, options.port)
    return clients.createPubSubClient(tcpClient)
  }
}
