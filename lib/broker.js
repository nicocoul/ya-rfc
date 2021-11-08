'use strict'
/* eslint-disable no-empty */

const { newServer } = require('./server')
const { newWrapper } = require('./common')
const { TOPICS } = require('./constants')
const cacheStore = require('./memory-store')
const fsStore = require('./fs-store')
const logger = require('./logger')(__filename)
require('./array-extensions')

function newClients () {
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
  const getIndex = (topic, clientId) => {
    return state.findIndex(s => s.topic === topic && s.clientId === clientId)
  }
  return {
    exists: (topic, clientId) => {
      return getIndex(topic, clientId) !== -1
    },
    add: (topic, clientId, sourceStream, wrapper) => {
      if (getIndex(topic, clientId) !== -1) return
      state.push({ topic, clientId, sourceStream, wrapper })
    },
    remove: (topic, clientId) => {
      const index = getIndex(topic, clientId)
      if (index !== -1) {
        // state[index].sourceStream.unpipe(state[index].wrapper)
        // state[index].wrapper.destroy()
        // state[index].sourceStream.destroy()
        state.splice(index, 1)
      }
    },
    removeClient: (clientId) => {

    },
    clientIdsByTopic: (topic) => {
      return state.filter(s => s.topic === topic).map(s => s.id)
    },
    sourceStream: (topic, clientId) => {
      const index = getIndex(topic, clientId)
      if (index !== -1) {
        return state[index].sourceStream
      }
    },
    wrapper: (topic, clientId) => {
      const index = getIndex(topic, clientId)
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
  const refresh = (clientId) => {
    if (!procs[clientId]) return
    if (!lds[clientId]) return
    state.remove(s => s.clientId === clientId)
    procs[clientId].forEach(procedure => {
      state.push({ procedure, clientId, load: lds[clientId], affinity: affs[clientId] })
    })
  }
  return {
    setClientProcedures: (clientId, procedures, affinity) => {
      procs[clientId] = procedures
      affs[clientId] = affinity
      lds[clientId] = 0.5
      refresh(clientId)
    },
    setClientLoad: (clientId, load) => {
      lds[clientId] = (load.cpu + load.memory) / 2
      refresh(clientId)
    },
    removeClient: (clientId) => {
      state.remove(s => s.clientId === clientId)
      delete procs[clientId]
      delete affs[clientId]
      delete lds[clientId]
    },
    getClientId: (procedure, affinity = null) => {
      logger.debug(`getClientId ${procedure} ${affinity}`)
      const tres = state
        .filter(s => s.procedure === procedure)
        .map(s => ({ ...s, affMatch: (affinity === s.affinity) ? 1 : 0 }))
        .sort((s1, s2) => s1.load - s2.load)
        .sort((s1, s2) => s2.affMatch - s1.affMatch)
      if (tres.length) {
        return tres[0].clientId
      }
    }
  }
}

function newRpcRequests () {
  const state = []
  return {
    add: (id, clientId, procedure, args, affinity) => {
      // console.log('ADD')
      state.push({ id, clientId, procedure, args, affinity, dispatched: false })
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
  const clients = newClients()
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

  const runRpc = () => {
    const r = rpcRequests.pop()
    if (!r) return false
    const clientId = rpcExecContext.getClientId(r.procedure, r.affinity)
    if (!clientId) {
      rpcRequests.setLowPriority(r.id)
      return false
    }
    const client = clients.getById(clientId)
    if (!client) return false
    rpcRequests.setDispatched(r.id)
    client.write({ t: TOPICS.RPC_EXECUTE, m: { id: r.id, procedure: r.procedure, args: r.args } })
    return true
  }
  const runRpcs = () => {
    while (runRpc()) { }
  }

  server.on('new-channel', c => {
    clients.set(c)
    c.on('data', d => {
      if (!d.t || !d.m) {
        logger.warn(`no t or m for ${JSON.stringify(d)}`)
        return
      }
      initTopic(d.t)
      if (d.t === TOPICS.RPC_EXECUTOR) {
        logger.info(`executor c.id=${c.id} ${JSON.stringify(d.m)}`)
        rpcExecContext.setClientProcedures(c.id, d.m.procedures, d.m.affinity)
        runRpcs()
      } else if (d.t === TOPICS.RPC_EXECUTE) {
        // d is sent by the executor
        if (d.m.result !== undefined || d.m.error !== undefined || d.m.progress !== undefined) {
          const r = rpcRequests.get(d.m.id)
          if (!r) return
          const client = clients.getById(r.clientId)
          if (!client) return
          client.write(d)
          if (d.m.result !== undefined || d.m.error !== undefined) {
            rpcRequests.remove(d.m.id)
            runRpcs()
          }
        } else {
          if (d.m.cancelled) {
            rpcRequests.resetDispatched(d.m.id)
            runRpcs()
          } else {
            rpcRequests.add(d.m.id, c.id, d.m.procedure, d.m.args, d.m.affinity)
            runRpcs()
          }
        }
      } else if (d.t === TOPICS.OS_LOAD) {
        rpcExecContext.setClientLoad(c.id, d.m)
      } else if (d.t === TOPICS.SUBSCRIBE) {
        console.log('---subscriber---')
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
          // logger.debug(`topic ${topic}: requiredOffset=${fromOffset}, cache.firstReadableOffset=${cache.get(topic).firstReadableOffset()} cache.count=${cache.get(topic).count()}, store.count=${store.get(topic).count()}`)
          const wrapper = newWrapper(topic, fromOffset)
          sourceStream.pipe(wrapper).pipe(c.writeStream)
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
    logger.debug('lost-channel')
    // topicSubscribers.removeClient(c.id)
    // clients.removeById(c.id)
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
