'use strict'

const rpcClient = require('./rpc-client')
const rpcServer = require('./rpc-server')

module.exports = {
  rpcClient: rpcClient.create,
  rpcServer: rpcServer.create
}
