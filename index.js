'use strict'

const clients = require('./lib/broker-clients')
const brokers = require('./lib/brokers')

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
