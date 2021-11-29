'use strict'
const yac = require('ya-common')
const clients = require('./lib/clients')
const brokers = require('./lib/brokers/rpc')

module.exports = {
  broker: brokers.create,
  client: {
    net: (connectOptions) => {
      const tcpChannel = yac.channels.net(connectOptions.host, connectOptions.port)
      return clients.rpcClient(tcpChannel)
    },
    ws: (connectOptions) => {
      const wsChannel = yac.channels.ws(connectOptions.host, connectOptions.port, connectOptions.ssl)
      return clients.rpcClient(wsChannel)
    }
  },
  server: {
    net: (connectOptions, modulePath, options) => {
      const tcpChannel = yac.channels.net(connectOptions.host, connectOptions.port)
      return clients.rpcServer(tcpChannel, modulePath, options)
    },
    ws: (connectOptions, modulePath, options) => {
      const wsChannel = yac.channels.ws(connectOptions.host, connectOptions.port, connectOptions.ssl)
      return clients.rpcServer(wsChannel, modulePath, options)
    }
  },
  plugins: yac.plugins
}
