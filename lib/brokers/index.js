'use strict'

const pubsubBroker = require('./pubsub')
const rpcBroker = require('./rpc')
const netPlugin = require('./plugins/net')
const wsPlugin = require('./plugins/ws')

module.exports = {
  pubsub: pubsubBroker.create,
  rpc: rpcBroker.create,
  plugins: {
    net: netPlugin.create,
    ws: wsPlugin.create
  }
}
