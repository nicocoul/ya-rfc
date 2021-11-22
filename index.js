'use strict'

const clients = require('./lib/clients')
const brokers = require('./lib/brokers')

module.exports = {
  rpc: {
    broker: brokers.rpc,
    client: {
      net: (options) => {
        const tcpChannel = clients.channels.net(options.host, options.port)
        return clients.rpcClient(tcpChannel)
      }
    },
    server: {
      net: (connectOptions, modulePath, options) => {
        const tcpChannel = clients.channels.net(connectOptions.host, connectOptions.port)
        return clients.rpcServer(tcpChannel, modulePath, options)
      }
    }
  },
  pubsub: {
    broker: brokers.pubsub,
    client: {
      net: (options) => {
        const tcpChannel = clients.channels.net(options.host, options.port)
        return clients.pubsub(tcpChannel)
      },
      ws: (options) => {
        const wsChannel = clients.channels.ws(options.host, options.port, options.ssl)
        return clients.pubsub(wsChannel)
      }
    }
  },
  plugins: {
    broker: brokers.plugins
  }
}
