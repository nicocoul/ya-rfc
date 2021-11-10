const pubsubBroker = require('./pubsub')
const netPlugin = require('./plugins/net')

module.exports = {
  pubsub: pubsubBroker.create,
  plugins: {
    net: netPlugin.create
  }
}
