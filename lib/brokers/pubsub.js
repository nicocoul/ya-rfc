'use strict'
/* eslint-disable no-empty,no-new-func */

const { newWrapper, newTransform, newPassTrough } = require('../common')
const { COMMANDS } = require('../constants')
const cacheStore = require('./stores/cache')
const logger = require('../logger')(__filename)
// require('../array-extensions')

function newLocalSubscriptionChannel (callback) {
  const result = newTransform()
  result._transform = (d, _, next) => {
    callback(d.m)
    next()
  }
  return result
}

function newSubscriptions () {
  const state = {}
  const compileFilter = () => {
    if (Object.values(state).find(s => s.filterSpec === undefined)) {
      return newPassTrough()
    }
    const fcts = Object.values(state).map(s => s.filter)
    const fct = (m) => fcts.some(f => f(m))
    const result = newTransform()
    result._transform = (d, _, next) => {
      // logger.debug(`filter m=${JSON.stringify(d.m)} result=${fct(d.m)}`)
      if (fct(d.m)) { result.push(d) }
      next()
    }
    return result
  }
  return {
    add: (id, filterSpec, offset = -1) => {
      if (state[id] !== undefined) throw new Error(`subscription ${id} ${filterSpec} already added`)
      const filter = (filterSpec) ? new Function('m', `const f=${filterSpec}; return f(m);`) : () => (true)
      state[id] = { filterSpec, filter, offset }
      return state[id]
    },
    get: (id) => {
      return state[id]
    },
    remove: (id) => {
      delete state[id]
    },

    clear: () => {

    },
    minOffset: () => {
      let result
      Object.values(state).forEach(s => {
        if (!result) result = s.offset
        if (s.offset < result) result = s.offset
      })
      return result
    },
    compileFilter
  }
}

function newSubscribedTopic (name) {
  let _previousFilter
  let _filter
  let _sourceStream
  const _wrapper = newWrapper(name)
  const _subscriptions = newSubscriptions()
  const _passTrough = newPassTrough()
  return {
    name,
    setSourceStream: (sourceStream) => {
      _sourceStream = sourceStream
    },
    wrapper: () => {
      return _wrapper
    },
    passTrough: () => {
      return _passTrough
    },
    previousFilter: () => {
      return _previousFilter
    },
    filter: () => {
      return _filter
    },
    refreshFilter: () => {
      _previousFilter = _filter
      _filter = _subscriptions.compileFilter()
    },
    sourceStream: () => {
      return _sourceStream
    },
    subscriptions: _subscriptions,
    clear: () => {
      _wrapper && _wrapper.destroy()
      _filter && _filter.destroy()
      _sourceStream && _sourceStream.unpipe(_wrapper)
      _sourceStream && _sourceStream.destroy()
      _previousFilter && _previousFilter.destroy()
    }
  }
}

function newTopics () {
  const state = {}
  return {
    add: (topicName) => {
      if (state[topicName]) throw new Error(`topic ${topicName} already added`)
      const topic = newSubscribedTopic(topicName)
      state[topicName] = topic
      return topic
    },
    get: (topicName) => {
      return state[topicName]
    },
    remove: (topicName) => {
      delete state[topicName]
    },
    clear: () => {
      Object.keys(state).forEach(topic => {
        state[topic].clear()
        delete state[topic]
      })
    },
    values: () => {
      return Object.values(state)
    }
  }
}

function newChannels () {
  const state = {}
  return {
    add: (channel) => {
      if (state[channel.id]) throw new Error(`channel ${channel.id} already added`)
      state[channel.id] = { value: channel, topics: newTopics() }
      return state[channel.id]
    },
    get: (id) => {
      return state[id]
    },
    remove: (id) => {
      state[id].topics.clear()
      delete state[id]
    }
  }
}

function create (cacheTime) {
  logger.info(`create ${cacheTime}`)
  const channels = newChannels()
  const cache = cacheStore.newStore(cacheTime)
  let localChannelIndex = 0

  function initCache (topicName) {
    if (!cache.exists(topicName)) {
      cache.set(topicName, 0)
    }
  }

  function registerChannel (channel) {
    logger.debug(`registerChannel ${channel.id}`)
    channels.get(channel.id) || channels.add(channel)
  }

  function unregisterChannel (channel) {
    logger.debug(`unregisterChannel ${channel.id}`)
    channels.get(channel.id).topics.values().forEach(topic => {
      topic.sourceStream() && cache.get(topic.name).unrefReadStream(topic.sourceStream())
    })
    channels.remove(channel.id)
  }

  function handleData (channel, data) {
    if (data.c === COMMANDS.SUBSCRIBE) {
      _subscribe(channel, data.id, data.topic, data.filter, data.offset)
    } else if (data.c === COMMANDS.UNSUBSCRIBE) {
      _unsubscribe(channel, data.topic)
    } else if (data.c === COMMANDS.PUBLISH) {
      _publish(data.t, data.m)
    }
  }

  function _subscribe (channel, subscriptionId, topicName, filterSpec, fromOffset = 0) {
    logger.info(`subscribe ${channel.id} ${topicName} filterSpec=${filterSpec} fromOffset=${fromOffset}`)
    initCache(topicName)

    const c = channels.get(channel.id)
    const topic = c.topics.get(topicName) || c.topics.add(topicName)
    topic.subscriptions.get(subscriptionId) && topic.subscriptions.remove(subscriptionId)
    topic.subscriptions.add(subscriptionId, filterSpec, fromOffset)
    if (topic.subscriptions.minOffset() < cache.get(topicName).firstReadableOffset()) {
      throw new Error(`data not available anymore ${topicName} ${fromOffset}`)
    }
    topic.refreshFilter()
    if (topic.sourceStream()) {
      topic.sourceStream().unpipe(topic.wrapper()).unpipe(topic.previousFilter()).unpipe(channel)
      topic.previousFilter().destroy()
      topic.sourceStream().destroy()
      cache.get(topicName).unrefReadStream(topic.sourceStream())
      const sourceStream = cache.get(topicName).createReadStream(topic.subscriptions.minOffset())
      sourceStream.pipe(topic.wrapper()).pipe(topic.filter()).pipe(channel)
      topic.setSourceStream(sourceStream)
    } else {
      const sourceStream = cache.get(topicName).createReadStream(topic.subscriptions.minOffset())
      sourceStream.pipe(topic.wrapper()).pipe(topic.filter()).pipe(channel)
      topic.setSourceStream(sourceStream)
    }
  }

  function _unsubscribe (channel, topicName) {
    if (!channels.get(channel.id)) return
    const topic = channels.get(channel.id).topics.get(topicName)
    if (!topic) return
    if (topic.sourceStream()) {
      topic.sourceStream().unpipe(topic.wrapper()).unpipe(topic.filter()).unpipe(channel)
      topic.filter() && topic.filter().destroy()
      topic.previousFilter() && topic.previousFilter().destroy()
      topic.sourceStream() && topic.sourceStream().destroy()
      cache.get(topicName).unrefReadStream(topic.sourceStream())
    }
    channels.get(channel.id).topics.remove(topicName)
  }

  function _publish (topicName, message) {
    initCache(topicName)
    // message.c = COMMANDS.PUBLISH
    cache.get(topicName).write(message)
  }

  function plug (plugin) {
    plugin.on('new-channel', channel => {
      registerChannel(channel)
      channel.on('data', d => {
        handleData(channel, d)
      })
    })
    plugin.on('lost-channel', channel => {
      unregisterChannel(channel)
    })
  }

  function subscribe (topicName, callBack, { filterSpec, fromOffset } = {}) {
    localChannelIndex++
    const channel = newLocalSubscriptionChannel(callBack)
    channel.id = `local ${localChannelIndex}`
    registerChannel(channel)
    _subscribe(channel, channel.id, topicName, filterSpec, fromOffset)
  }

  function unsubscribe (topicName) {

  }

  function publish (topicName, message) {
    _publish(topicName, message)
  }

  return {
    subscribe,
    unsubscribe,
    publish,
    registerChannel,
    handleData,
    unregisterChannel,
    plug
  }
}

module.exports = {
  create
}
