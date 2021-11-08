'use strict'
const pubsubClient = require('./lib/pubsub-client')
const rpcClient = require('./lib/rpc-client')
const rpcServer = require('./lib/rpc-server')
const broker = require('./lib/broker')
const tcp = require('./lib/channel')

module.exports = {
  createBroker: (options) => {
    return broker.createBroker(options.port, 1000, options.storePath)
  },
  createRpcServer: (options) => {
    const tcpChannel = tcp.createChannel(options.host, options.port)
    return rpcServer.createRpcServer(tcpChannel, options.modulePath, options.affinity, options.childProcessesCount)
  },
  createRpcClient: (options) => {
    const tcpChannel = tcp.createChannel(options.host, options.port)
    return rpcClient.createRpcClient(tcpChannel)
  },
  createPubSubClient: (options) => {
    const tcpChannel = tcp.createChannel(options.host, options.port)
    return pubsubClient.createPubSubClient(tcpChannel)
  }
}

process.on('warning', e => {
  console.warn(e.stack)
})
