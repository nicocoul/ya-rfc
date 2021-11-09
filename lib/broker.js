'use strict'
/* eslint-disable no-empty */

const { newServer } = require('./server')
const { newWrapper } = require('./common')
const { TOPICS } = require('./constants')
const cacheStore = require('./memory-store')
const fsStore = require('./fs-store')
const logger = require('./logger')(__filename)
require('./array-extensions')

function newChannels () {
  const state = {}
  return {
    set: (c) => {
      state[c.id] = c
    },
    getById: (id) => {
      return state[id]
    },
    removeById: (id) => {
      delete state[id]
    }
  }
}

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

function newExecutionContext () {
  const state = []
  const procs = {}
  const affs = {}
  const lds = {}
  const refresh = (channelId) => {
    if (!procs[channelId]) return
    if (!lds[channelId]) return
    state.remove(s => s.channelId === channelId)
    procs[channelId].forEach(procedure => {
      state.push({ procedure, channelId, load: lds[channelId], affinity: affs[channelId] })
    })
  }
  return {
    setChannelProcedures: (channelId, procedures, affinity) => {
      procs[channelId] = procedures
      affs[channelId] = affinity
      lds[channelId] = 0.5
      refresh(channelId)
    },
    setChannelLoad: (channelId, load) => {
      lds[channelId] = (load.cpu + load.memory) / 2
      refresh(channelId)
    },
    removeChannel: (channelId) => {
      state.remove(s => s.channelId === channelId)
      delete procs[channelId]
      delete affs[channelId]
      delete lds[channelId]
    },
    getChannelId: (procedure, affinity = null) => {
      const tres = state
        .filter(s => s.procedure === procedure)
        .map(s => ({ ...s, affMatch: (affinity === s.affinity) ? 1 : 0 }))
        .sort((s1, s2) => s1.load - s2.load)
        .sort((s1, s2) => s2.affMatch - s1.affMatch)
      if (tres.length) {
        return tres[0].channelId
      }
    }
  }
}

function newRpcRequests () {
  const state = []
  return {
    add: (id, channelId, procedure, args, affinity) => {
      state.push({ id, channelId, procedure, args, affinity, dispatched: false })
    },
    remove: (id) => {
      const index = state.findIndex(s => s.id === id)
      if (index !== -1) {
        state.splice(index, 1)
      }
    },
    get: (id) => {
      const res = state.find(s => s.id === id)
      return { ...res }
    },
    pop: () => {
      return state.find(s => !s.dispatched)
    },
    setLowPriority: (id) => {
      const index = state.findIndex(s => s.id === id)
      if (index !== -1) {
        const save = state[index]
        state.splice(index, 1)
        state.push(save)
      }
    },
    setDispatched: (id) => {
      const r = state.find(s => s.id === id)
      if (r) {
        r.dispatched = true
      }
    },
    resetDispatched: (id) => {
      const r = state.find(s => s.id === id)
      if (r) {
        r.dispatched = false
      }
    }
  }
}

function createBroker (port, cacheTime, storePath) {
  logger.info(`createBroker port=${port} cacheTime=${cacheTime} storePath=${storePath}`)
  const server = newServer(port)
  const channels = newChannels()
  const subscribers = newTopicSubscribers()
  const rpcExecContext = newExecutionContext()
  const rpcRequests = newRpcRequests()
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

  const executeProcedure = () => {
    const r = rpcRequests.pop()
    if (!r) return false
    const execChannelId = rpcExecContext.getChannelId(r.procedure, r.affinity)
    if (!execChannelId) {
      rpcRequests.setLowPriority(r.id)
      return false
    }
    const execChannel = channels.getById(execChannelId)
    if (!execChannel) return false
    rpcRequests.setDispatched(r.id)
    execChannel.write({ t: TOPICS.RPC_EXECUTE, m: { id: r.id, procedure: r.procedure, args: r.args } })
    const reqChannel = channels.getById(r.channelId)
    reqChannel.write({ t: TOPICS.RPC_EXECUTE, m: { id: r.id, progress: 'started' } })
    return true
  }
  const executeProcedures = () => {
    while (executeProcedure()) { }
  }

  server.on('new-channel', c => {
    channels.set(c)
    c.on('data', d => {
      if (!d.t || !d.m) {
        return
      }
      initTopic(d.t)
      if (d.t === TOPICS.RPC_EXECUTOR) {
        logger.info(`executor c.id=${c.id} ${JSON.stringify(d.m)}`)
        rpcExecContext.setChannelProcedures(c.id, d.m.procedures, d.m.affinity)
        executeProcedures()
      } else if (d.t === TOPICS.RPC_EXECUTE) {
        if (d.m.result !== undefined || d.m.error !== undefined || d.m.progress !== undefined) {
          const r = rpcRequests.get(d.m.id)
          if (!r) return
          const reqChannel = channels.getById(r.channelId)
          if (!reqChannel) return
          reqChannel.write({ t: d.t, m: { id: d.m.id, result: d.m.result, error: d.m.error, progress: d.m.progress } })
          if (d.m.result !== undefined || d.m.error !== undefined) {
            rpcRequests.remove(d.m.id)
            executeProcedures()
          }
        } else if (d.m.delayed) {
          rpcRequests.resetDispatched(d.m.id)
          executeProcedures()
        } else {
          rpcRequests.add(d.m.id, c.id, d.m.procedure, d.m.args, d.m.affinity)
          c.write({ t: TOPICS.RPC_EXECUTE, m: { id: d.m.id, progress: 'scheduled' } })
          executeProcedures()
        }
      } else if (d.t === TOPICS.OS_LOAD) {
        rpcExecContext.setChannelLoad(c.id, d.m)
      } else if (d.t === TOPICS.SUBSCRIBE) {
        const topic = d.m.topic
        const fromOffset = d.m.offset
        initTopic(topic)

        let sourceStream
        if (fromOffset >= cache.get(topic).firstReadableOffset()) {
          logger.debug(`topic ${topic}: cache streams to channel ${c.id} from offset ${fromOffset}`)
          sourceStream = cache.get(topic).createReadStream(fromOffset)
        } else {
          logger.debug(`topic ${topic}: store streams to channel ${c.id} from offset ${fromOffset}`)
          sourceStream = store.get(topic).createReadStream(fromOffset)
        }

        if (!subscribers.exists(topic, c.id)) {
          const wrapper = newWrapper(topic, fromOffset)
          sourceStream.pipe(wrapper).pipe(c)
          subscribers.add(topic, c.id, sourceStream, wrapper)
        } else {
          logger.debug(`already subscribed ${JSON.stringify(d.m)}`)
          const wrapper = subscribers.wrapper(topic, c.id)
          sourceStream.pipe(wrapper)

          const previousSourceStream = subscribers.sourceStream(topic, c.id)
          previousSourceStream.unpipe(wrapper)
          previousSourceStream.destroy()

          subscribers.remove(topic, c.id)
          subscribers.add(topic, c.id, sourceStream, wrapper)
        }
      } else if (d.t === TOPICS.UNSUBSCRIBE) {
        subscribers.remove(d.m.topic, c.id)
      } else {
        if (store) {
          store.get(d.t).write(d.m)
        } else {
          cache.get(d.t).write(d.m)
        }
      }
    })
  })
  server.on('lost-channel', c => {
    logger.debug(`lost-channel ${c.id}`)
    subscribers.removeChannel(c.id)
    channels.removeById(c.id)
  })
  return {
    close: () => {
      logger.info(`closing broker ${port}`)
      server.close()
      store.destroy()
    }
  }
}

module.exports = {
  createBroker
}
