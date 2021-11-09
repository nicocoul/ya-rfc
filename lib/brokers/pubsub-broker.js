'use strict'
/* eslint-disable no-empty */

const { newServer } = require('../server')
const { newWrapper } = require('../common')
const { TOPICS } = require('../constants')
const cacheStore = require('./stores/memory-store')
const fsStore = require('./stores/fs-store')
const logger = require('../logger')(__filename)
require('../array-extensions')
const { newChannels } = require('./common')

function newTopicSubscribers () {
  const state = []
  const getIndex = (topic, channelId) => {
    return state.findIndex(s => s.topic === topic && s.channelId === channelId)
  }
  return {
    exists: (topic, channelId) => {
      return getIndex(topic, channelId) !== -1
    },
    add: (topic, channelId, sourceStream, wrapper) => {
      if (getIndex(topic, channelId) !== -1) return
      state.push({ topic, channelId, sourceStream, wrapper })
    },
    remove: (topic, channelId) => {
      const index = getIndex(topic, channelId)
      if (index !== -1) {
        state.splice(index, 1)
      }
    },
    removeChannel: (channelId) => {
      state.remove(s => s.channelId === channelId)
    },
    channelIdsByTopic: (topic) => {
      return state.filter(s => s.topic === topic).map(s => s.id)
    },
    sourceStream: (topic, channelId) => {
      const index = getIndex(topic, channelId)
      if (index !== -1) {
        return state[index].sourceStream
      }
    },
    wrapper: (topic, channelId) => {
      const index = getIndex(topic, channelId)
      if (index !== -1) {
        return state[index].wrapper
      }
    }
  }
}

function create (port, cacheTime, storePath) {
  logger.info(`create port=${port} cacheTime=${cacheTime} storePath=${storePath}`)
  const server = newServer(port)
  const channels = newChannels()
  const subscribers = newTopicSubscribers()
  const cache = cacheStore.newStore(cacheTime)
  const store = storePath && fsStore.newStore(storePath)

  const initTopic = (topic) => {
    if (!cache.exists(topic)) {
      if (store) {
        const count = store.get(topic).count()
        cache.set(topic, count)
        store.get(topic).pipe(cache.get(topic))
        logger.debug(`topic ${topic}: store pipes to cache`)
      } else {
        cache.set(topic, 0)
      }
    }
  }

  store && store.getTopicNames().forEach(topicName => {
    initTopic(topicName)
  })



  const subscribe = (channel, topic, fromOffset = 0) => {
    logger.info(`subscribe ${channel.id} ${topic} ${fromOffset}`)
    initTopic(topic)
    let sourceStream
    if (fromOffset >= cache.get(topic).firstReadableOffset()) {
      logger.debug(`topic ${topic}: cache streams to channel ${channel.id} from offset ${fromOffset}`)
      sourceStream = cache.get(topic).createReadStream(fromOffset)
    } else {
      logger.debug(`topic ${topic}: store streams to channel ${channel.id} from offset ${fromOffset}`)
      sourceStream = store.get(topic).createReadStream(fromOffset)
    }

    if (!subscribers.exists(topic, channel.id)) {
      const wrapper = newWrapper(topic, fromOffset)
      sourceStream.pipe(wrapper).pipe(channel)
      subscribers.add(topic, channel.id, sourceStream, wrapper)
    } else {
      logger.debug(`already subscribed channel ${JSON.stringify(channel.id)} to ${topic}`)
      const wrapper = subscribers.wrapper(topic, channel.id)
      sourceStream.pipe(wrapper)

      const previousSourceStream = subscribers.sourceStream(topic, channel.id)
      previousSourceStream.unpipe(wrapper)
      previousSourceStream.destroy()

      subscribers.remove(topic, channel.id)
      subscribers.add(topic, channel.id, sourceStream, wrapper)
    }
  }

  const unsubscribe = (channel, topic) => {
    subscribers.remove(topic, channel.id)
  }

  const publish = (topic, message) => {
    logger.debug(`publish ${topic} ${JSON.stringify(message)}`)
    initTopic(topic)
    if (store) {
      store.get(topic).write(message)
    } else {
      cache.get(topic).write(message)
    }
  }

  server.on('new-channel', c => {
    channels.set(c)
    c.on('data', d => {
      if (!d.t || !d.m) return
      if (d.t.includes([TOPICS.RPC_EXECUTOR, TOPICS.RPC_EXECUTE, TOPICS.OS_LOAD])) return
      if (d.t === TOPICS.SUBSCRIBE) {
        const topic = d.m.topic
        const fromOffset = d.m.offset
        subscribe(c, topic, fromOffset)
      } else if (d.t === TOPICS.UNSUBSCRIBE) {
        unsubscribe(c, d.m.topic)
      } else {
        publish(d.t, d.m)
      }
    })
  })
  server.on('lost-channel', c => {
    logger.debug(`lost-channel ${c.id}`)
    subscribers.removeChannel(c.id)
    channels.removeById(c.id)
  })
  return {
    subscribe,
    unsubscribe,
    publish,
    close: () => {
      logger.info(`closing broker ${port}`)
      server.close()
      store.destroy()
    }
  }
}

module.exports = {
  create
}
