'use strict'
const { TOPICS } = require('../constants')
const logger = require('../logger')(__filename)
require('../array-extensions')

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

function addSubscriberRole (channel, subscribeDelay = 10000) {
  const topics = newTopics()
  let notifyBrokerTimeout

  channel.on('data', d => {
    if (!d.t) return
    if (d.t.includes([TOPICS.RPC_EXECUTOR, TOPICS.RPC_EXECUTE, TOPICS.OS_LOAD])) return
    if (!topics.exists(d.t)) return
    if (d.o === undefined || d.m === undefined) return
    if (d.o !== topics.getOffset(d.t) + 1) return
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
    logger.info(`subcribe ${topic}`)
    topics.set(topic)
    channel.write({ t: TOPICS.SUBSCRIBE, m: { topic, offset: topics.getOffset(topic) + 1 } })
    topics.addCallback(topic, callback)
  }
  const unsubscribe = (topic) => {
    logger.info(`unsubcribe ${topic}`)
    channel.write({ t: TOPICS.UNSUBSCRIBE, m: { topic } })
    topics.removeCallbacks(topic)
  }

  notifyBroker()

  const destroy = () => {
    if (notifyBrokerTimeout) clearTimeout(notifyBrokerTimeout)
  }

  return { subscribe, unsubscribe, destroy }
}

function create (channel) {
  logger.info('create')
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
  create
}
