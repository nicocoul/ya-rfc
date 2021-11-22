const pubsub = require('./pubsub')
const rpcClient = require('./rpc-client')
const rpcServer = require('./rpc-server')
const netChannel = require('./channels/net')
const wsChannel = require('./channels/ws')

module.exports = {
  pubsub: pubsub.create,
  rpcClient: rpcClient.create,
  rpcServer: rpcServer.create,
  channels: {
    net: netChannel.create,
    ws: wsChannel.create
  }
}
