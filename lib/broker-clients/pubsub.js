'use strict'
/* eslint-disable no-new-func */
const { COMMANDS } = require('../constants')
const logger = require('../logger')(__filename)
require('../array-extensions')

function addPublisherRole (channel) {
  const publish = (topic, message) => {
    channel.write({ c: COMMANDS.PUBLISH, t: topic, m: message })
  }
  return { publish }
}

function newSubscriptions () {
  const state = []
  const getIndex = (topic, filter) => {
    return state.findIndex(s => s.topic === topic && s.filter === filter)
  }
  let id = 0
  return {
    add: (topic, filter, callback) => {
      const index = getIndex(topic, filter)
      if (index !== -1) {
        throw new Error(`already subscribed ${topic} ${filter}`)
      }
      id++
      const filterFun = (filter) ? new Function('m', filter) : () => (true)
      const subscription = { id, topic, filter, filterFun, callback, offset: -1 }
      state.push(subscription)
      return id
    },
    setOffset: (id, offset) => {
      const subscription = state.find(s => s.id === id)
      if (!subscription) throw new Error(`cannot set offset, subscription ${id} not found`)
      subscription.offset = offset
    },
    offset: (id) => {
      const subscription = state.find(s => s.id === id)
      if (!subscription) throw new Error(`cannot get offset, subscription ${id} not found`)
      return subscription.offset
    },
    byTopic: (topic) => {
      return state.filter(s => s.topic === topic).map(s => ({ ...s }))
    },
    topicExists: (topic) => {
      return state.findIndex(s => s.topic === topic) !== -1
    },
    removeByTopic: (topic) => {
      state.remove(s => s.topic === topic)
    },
    all: () => {
      return state.map(s => ({ ...s }))
    }
  }
}

function addSubscriberRole (channel, subscribeDelay = 10000) {
  const subscriptions = newSubscriptions()
  let notifyBrokerTimeout

  channel.on('data', d => {
    if (d.c !== COMMANDS.PUBLISH) return
    if (d.o === undefined || d.m === undefined) return
    if (!subscriptions.topicExists(d.t)) return
    subscriptions.byTopic(d.t).forEach(({ id, callback, offset, filterFun }) => {
      if (d.o > offset) {
        if (filterFun(d.m)) {
          callback(d.m, d.o)
        }
        subscriptions.setOffset(id, d.o)
      } else {
        logger.debug(`skipped received offset${d.o}, current offset is ${offset}`)
      }
    })
  })

  const notifyBroker = () => {
    subscriptions.all().forEach(s => {
      const f = (s.filter.constructor.name === 'Function') ? s.filter.toString() : undefined
      channel.write({ c: COMMANDS.SUBSCRIBE, id: s.id, topic: s.topic, filter: f, offset: s.offset + 1 })
    })
    if (notifyBrokerTimeout) clearTimeout(notifyBrokerTimeout)
    notifyBrokerTimeout = setTimeout(() => {
      notifyBroker()
    }, subscribeDelay)
  }
  const subscribe = (topic, callback, { offset, filter } = {}) => {
    logger.info(`subcribe ${topic} offset=${offset} filter=${filter}`)
    const id = subscriptions.add(topic, filter, callback)
    const o = (offset === undefined) ? subscriptions.offset(id) + 1 : offset
    const f = (filter.constructor.name === 'Function') ? filter.toString() : undefined
    channel.write({ c: COMMANDS.SUBSCRIBE, id, topic, filter: f, offset: o })
    return id
  }
  const unsubscribe = (topic) => {
    logger.info(`unsubcribe ${topic}`)
    channel.write({ c: COMMANDS.UNSUBSCRIBE, topic })
    subscriptions.removeByTopic(topic)
  }

  notifyBroker()

  const destroy = () => {
    if (notifyBrokerTimeout) clearTimeout(notifyBrokerTimeout)
  }

  return { subscribe, unsubscribe, destroy }
}

function create (channel, options) {
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
