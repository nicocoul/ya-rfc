const pubsubBroker = require('./pubsub')
const netChannel = require('./channels/net')

module.exports = {
  pubsub: pubsubBroker.create,
  channels: {
    net: netChannel.create
  }
}
