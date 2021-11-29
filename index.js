'use strict'
const yac = require('../ya-common/index')
const clients = require('./lib/clients')
const brokers = require('./lib/brokers/rpc')

const TYPES = {
  tcp: 'tcp',
  ws: 'ws',
  ipc: 'ipc'
}

module.exports = {
  broker: (transports) => {
    const broker = brokers.create()
    for (const transport of transports) {
      if (transport.type === TYPES.tcp) {
        if (!transport.port) throw new Error('port required for tcp broker transport')
        const { Server } = require('net')
        broker.plug(yac.plugins.net(new Server().listen(transport.port)))
      } else if (transport.type === TYPES.ws) {
        if (!transport.port) throw new Error('port required for ws broker transport')
        const { WebSocketServer } = require('ws')
        broker.plug(yac.plugins.ws(new WebSocketServer({ port: transport.port })))
      } else if (transport.type === TYPES.ipc) {
        if (!transport.path) throw new Error('path required for ipc broker transport')
        const { Server } = require('net')
        broker.plug(yac.plugins.net(new Server().listen(transport.path)))
      } else {
        throw new Error('unsupported transport')
      }
    }
    return broker
  },
  transports: {
    tcp: (port, host, reconnectDelay) => {
      return { type: TYPES.tcp, host, port, reconnectDelay }
    },
    ws: (port, host, ssl, reconnectDelay) => {
      return { type: TYPES.ws, host, port, ssl, reconnectDelay }
    },
    ipc: (path) => {
      return { type: TYPES.ipc, path }
    }
  },
  client: (transport) => {
    if (!transport) throw new Error('transport required')
    if (transport.type === TYPES.tcp) {
      if (!transport.port) throw new Error('port required for tcp client transport')
      if (!transport.host) throw new Error('host required for tcp client transport')
      const tcpChannel = yac.channels.net({ host: transport.host, port: transport.port }, transport.reconnectDelay)
      return clients.rpcClient(tcpChannel)
    } else if (transport.type === TYPES.ws) {
      if (!transport.port) throw new Error('port required for ws client transport')
      if (!transport.host) throw new Error('host required for ws client transport')
      const wsChannel = yac.channels.ws(transport.host, transport.port, transport.ssl, transport.reconnectDelay)
      return clients.rpcClient(wsChannel)
    } else if (transport.type === TYPES.ipc) {
      if (!transport.path) throw new Error('path required for ipc client transport')
      const wsChannel = yac.channels.net({ path: transport.path })
      return clients.rpcClient(wsChannel)
    } else {
      throw new Error(`unsupported transport ${JSON.stringify(transport)}`)
    }
  },
  server: (transport, modulePath) => {
    if (!transport) throw new Error('transport required')
    if (!modulePath) throw new Error('modulePath required')
    if (transport.type === TYPES.tcp) {
      if (!transport.port) throw new Error('port required for tcp client transport')
      if (!transport.host) throw new Error('host required for tcp client transport')
      const netChannel = yac.channels.net({ host: transport.host, port: transport.port }, transport.reconnectDelay)
      return clients.rpcServer(netChannel, modulePath)
    } else if (transport.type === TYPES.ws) {
      if (!transport.port) throw new Error('port required for ws client transport')
      if (!transport.host) throw new Error('host required for ws client transport')
      const wsChannel = yac.channels.ws(transport.host, transport.port, transport.ssl, transport.reconnectDelay)
      return clients.rpcServer(wsChannel, modulePath)
    } else if (transport.type === TYPES.ipc) {
      if (!transport.path) throw new Error('path required for ipc client transport')
      const netChannel = yac.channels.net({ path: transport.path })
      return clients.rpcServer(netChannel, modulePath)
    } else {
      throw new Error('unsupported transport')
    }
  }
}
