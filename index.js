'use strict'
const pubsubClient = require('./lib/broker-clients/pubsub-client')
const rpcClient = require('./lib/broker-clients/rpc-client')
const rpcServer = require('./lib/broker-clients/rpc-server')
const rpcBroker = require('./lib/brokers/rpc-broker')
const pubsubBroker = require('./lib/brokers/pubsub-broker')
const constants = require('./lib/constants')
const tcp = require('./lib/channel')

module.exports = {
  rpc: {
    createBroker: (options) => {
      return rpcBroker.create(options.port)
    },
    createServer: (options) => {
      const tcpChannel = tcp.createChannel(options.host, options.port)
      return rpcServer.create(tcpChannel, options.modulePath, options.affinity, options.workersCount)
    },
    createClient: (options) => {
      const tcpChannel = tcp.createChannel(options.host, options.port)
      return rpcClient.create(tcpChannel)
    }
  },
  pubsub: {
    createBroker: (options) => {
      return pubsubBroker.create(options.port, 1000, options.storePath)
    },
    createClient: (options) => {
      const tcpChannel = tcp.createChannel(options.host, options.port)
      return pubsubClient.create(tcpChannel)
    }
  },
  internalTopics: { ...constants.TOPICS }
}
