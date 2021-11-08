'use strict'
const { TOPICS } = require('./constants')

require('./array-extensions')
const logger = require('./logger')(__filename)

function addPublisherRole (channel) {
  const publish = (topic, message) => {
    channel.write({ t: topic, m: message })
  }
  return { publish }
}

function newTopics () {
  const state = {}
  return {
    set: (topic) => {
      if (!state[topic]) { state[topic] = { offset: -1, callbacks: [] } }
    },
    setOffset: (topic, offset) => {
      state[topic].offset = offset
    },
    getOffset: (topic) => {
      return state[topic].offset
    },
    addCallback: (topic, callback) => {
      state[topic].callbacks.push(callback)
    },
    getCallbacks: (topic) => {
      return state[topic].callbacks
    },
    exists: (topic) => {
      return state[topic] !== undefined
    },
    removeCallbacks: (topic) => {
      state[topic].callbacks.length = 0
    },
    all: () => {
      return Object.keys(state)
    }
  }
}

function addSubscriberRole (channel, subscribeDelay = 1000) {
  const topics = newTopics()
  let notifyBrokerTimeout

  channel.on('data', d => {
    // logger.debug(JSON.stringify(d))
    if (!d.t) {
      logger.warn(`${channel.id}: no .t in received data`)
      return
    }
    if (d.t === TOPICS.RPC_EXECUTE) return
    if (!topics.exists(d.t)) {
      logger.warn(`${channel.id}: unknown .t ${d.t} in received data`)
      return
    }
    if (d.o === undefined || d.m === undefined) {
      logger.warn(`${channel.id}: undefined .o or .m for .t ${d.t}`)
      return
    }
    if (d.o !== topics.getOffset(d.t) + 1) {
      return
    }
    // logger.debug(`topic:${d.t} ,${JSON.stringify(d)}`)
    topics.getCallbacks(d.t).forEach(callback => {
      topics.setOffset(d.t, d.o)
      try {
        callback(d.m, d.o)
      } catch (error) {
        console.error(error)
      }
    })
  })

  const notifyBroker = () => {
    topics.all().forEach(topic => {
      channel.write({ t: TOPICS.SUBSCRIBE, m: { topic, offset: topics.getOffset(topic) + 1 } })
    })
    if (notifyBrokerTimeout) clearTimeout(notifyBrokerTimeout)
    notifyBrokerTimeout = setTimeout(() => {
      notifyBroker()
    }, subscribeDelay)
  }
  const subscribe = (topic, callback) => {
    topics.set(topic)
    channel.write({ t: TOPICS.SUBSCRIBE, m: { topic, offset: topics.getOffset(topic) + 1 } })
    topics.addCallback(topic, callback)
  }
  const unsubscribe = (topic) => {
    topics.removeCallbacks(topic)
  }

  notifyBroker()

  const destroy = () => {
    if (notifyBrokerTimeout) clearTimeout(notifyBrokerTimeout)
  }

  return { subscribe, unsubscribe, destroy }
}

function createPubSubClient (channel) {
  const subscriberRole = addSubscriberRole(channel)
  const publisherRole = addPublisherRole(channel)
  return {
    subscribe: subscriberRole.subscribe,
    unsubscribe: subscriberRole.unsubscribe,
    publish: publisherRole.publish,
    destroy: () => {
      channel.destroy()
      subscriberRole.destroy()
    }
  }
}

module.exports = {
  createPubSubClient
}
