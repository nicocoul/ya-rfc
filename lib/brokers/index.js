'use strict'

const rpcBroker = require('./rpc')

module.exports = {
  rpc: rpcBroker.create
}
