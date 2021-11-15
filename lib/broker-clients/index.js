const pubsubBroker = require('./pubsub')
const netChannel = require('./channels/net')
const wsChannel = require('./channels/ws')

module.exports = {
  pubsub: pubsubBroker.create,
  channels: {
    net: netChannel.create,
    ws: wsChannel.create
  }
}
