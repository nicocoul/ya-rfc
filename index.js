'use strict'
// const pubsubClient = require('./lib/broker-clients/pubsub')
// const rpcClient = require('./lib/broker-clients/rpc-client')
// const rpcServer = require('./lib/broker-clients/rpc-server')
const clients = require('./lib/broker-clients')
const brokers = require('./lib/brokers')
// const constants = require('./lib/constants')
// const tcp = require('./lib/channel')
// const brokerPlugins = require('./lib/brokers/plugins')

module.exports = {
  // rpc: {
  //   createServer: (options) => {
  //     const tcpChannel = tcp.createChannel(options.host, options.port)
  //     return rpcServer.create(tcpChannel, options.modulePath, options.affinity, options.workersCount)
  //   },
  //   createClient: (options) => {
  //     const tcpChannel = tcp.createChannel(options.host, options.port)
  //     return rpcClient.create(tcpChannel)
  //   }
  // },
  pubsub: {
    broker: brokers.pubsub,
    client: {
      net: (options) => {
        const tcpChannel = clients.channels.net(options.host, options.port)
        return clients.pubsub(tcpChannel)
      }
    }
  },
  plugins: {
    broker: brokers.plugins
  }
}
