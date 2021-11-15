const pubsubBroker = require('./pubsub')
const netPlugin = require('./plugins/net')
const wsPlugin = require('./plugins/ws')

module.exports = {
  pubsub: pubsubBroker.create,
  plugins: {
    net: netPlugin.create,
    ws: wsPlugin.create
  }
}
