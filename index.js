'use strict'
const clients = require('./lib/pubsub')
const broker = require('./lib/broker')
const tcp = require('./lib/channel')

module.exports = {
  createBroker: (options) => {
    return broker.createBroker(options.port, 1000, options.storePath)
  },
  createRpcServer: (options) => {
    const tcpChannel = tcp.createChannel(options.host, options.port)
    return clients.createRpcServer(tcpChannel, options.modulePath, options.affinity, options.childProcessesCount)
  },
  createRpcClient: (options) => {
    const tcpChannel = tcp.createChannel(options.host, options.port)
    return clients.createRpcClient(tcpChannel)
  },
  createPubSubClient: (options) => {
    const tcpChannel = tcp.createChannel(options.host, options.port)
    return clients.createPubSubClient(tcpChannel)
  }
}
