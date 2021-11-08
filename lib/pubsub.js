'use strict'
const path = require('path')
const { fork } = require('child_process')
const { TOPICS } = require('./constants')

require('./array-extensions')
const logger = require('./logger')(__filename)

function addPublisherRole (channel) {
  const publish = (topic, message) => {
    channel.write({ t: topic, m: message })
  }
  return { publish }
}

function newRequests () {
  const state = []
  const getIndex = (id) => {
    return state.findIndex(s => s.request.id === id)
  }
  return {
    add: (request, callback) => {
      state.push({ request, callback })
    },
    remove: (id) => {
      const index = getIndex(id)
      if (index !== -1) {
        state.splice(index, 1)
      }
    },
    get: (id) => {
      const index = getIndex(id)
      if (index !== -1) {
        return state[index]
      }
    }
  }
}

function addRpcClientRole (channel) {
  const requests = newRequests()
  let requestId = new Date().getTime()

  channel.on('data', d => {
    if (!d.t) {
      logger.warn(`${channel.id}: no .t in received data`)
      return
    }
    if (d.t !== TOPICS.RPC_EXECUTE) return
    if (d.m.id) {
      if (d.m.error !== undefined) {
        try {
          requests.get(d.m.id).callback(d.m.error, undefined, undefined)
          requests.remove(d.m.id)
        } catch (error) {
          logger.error(`execute role, ${JSON.stringify(d.m)} ${error.message}`)
        }
      } else if (d.m.result !== undefined) {
        try {
          requests.get(d.m.id).callback(undefined, d.m.result, undefined)
          requests.remove(d.m.id)
        } catch (error) {
          logger.error(`execute role, ${JSON.stringify(d.m)} ${error.message}`)
        }
      } else if (d.m.progress !== undefined) {
        requests.get(d.m.id).callback(undefined, undefined, d.m.progress)
      }
    }
  })

  const execute = (procedure, args, callback, affinity) => {
    requestId++
    const request = { id: requestId, procedure, args, affinity }
    channel.write({ t: TOPICS.RPC_EXECUTE, m: request })
    requests.add(request, callback)
  }
  return { execute }
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
      channel.write({ t: TOPICS.SUBSCRIBER, m: { topic, offset: topics.getOffset(topic) + 1 } })
    })
    if (notifyBrokerTimeout) clearTimeout(notifyBrokerTimeout)
    notifyBrokerTimeout = setTimeout(() => {
      notifyBroker()
    }, subscribeDelay)
  }
  const subscribe = (topic, callback) => {
    topics.set(topic)
    channel.write({ t: TOPICS.SUBSCRIBER, m: { topic, offset: topics.getOffset(topic) + 1 } })
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

function newChildProcess () {
  const state = []
  let i = 0
  return {
    add: (process) => {
      state.push(process)
    },
    removeByPid: (pid) => {
      const index = state.findIndex(p => p.pid === pid)
      if (index !== -1) {
        state.splice(index, 1)
      }
    },
    pop: () => {
      i = i % state.length
      const p = state[i]
      i++
      return p
    }
  }
}

function addRpcServerRole (channel, modulePath, affinity = null, childProcessesCount = 5) {
  const childProcesses = newChildProcess()
  const createChildProcess = () => {
    const childProcess = fork(path.join(__dirname, 'rpc-child.js'))
    childProcess.send({ modulePath })
    childProcess.on('error', (error) => {
      logger.error(error.stack)
    })
    childProcess.on('close', (code) => {
      childProcesses.removeByPid(childProcess.pid)
      logger.debug(`child process closed with code ${code}`)
      createChildProcess()
    })
    childProcess.on('message', data => {
      if (data.procedure) {
        channel.write({ t: TOPICS.RPC_EXECUTE, m: data })
      } else if (data.cpu) {
        channel.write({ t: TOPICS.OS_LOAD, m: data })
      }
    })
    childProcesses.add(childProcess)
  }
  for (let i = 0; i < childProcessesCount; i++) {
    createChildProcess()
  }

  const procedures = require(modulePath)
  channel.on('data', async d => {
    if (!modulePath) {
      return
    }
    if (!d.t) {
      logger.warn(`${channel.id}: no .t in received data`)
      return
    }
    if (d.t !== TOPICS.RPC_EXECUTE) return

    if (!d.m.procedure) {
      logger.warn('no procedure defined')
      channel.write({ t: TOPICS.RPC_EXECUTE, m: { ...d.m, error: 'no procedure defined' } })
      return
    }
    const { procedure } = d.m
    if (!Object.keys(procedures).includes(procedure)) {
      logger.warn(`procedure ${procedure} not found`)
      channel.write({ t: TOPICS.RPC_EXECUTE, m: { ...d.m, error: `procedure ${procedure} not found` } })
      return
    }
    try {
      console.log(`execute ${procedure} on ${affinity}`)
      childProcesses.pop().send(d.m)
    } catch (error) {
      logger.error(error.stack)
      channel.write({ t: TOPICS.RPC_EXECUTE, m: { ...d.m, error: error.message } })
    }
  })

  channel.on('connect', () => {
    const procedureNames = Object.keys(procedures)
    if (procedureNames.length) {
      channel.write({ t: TOPICS.RPC_EXECUTOR, m: { procedures: Object.keys(procedures), affinity } })
    }
  })
  const destroy = () => {
  }

  return { destroy }
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

function createRpcClient (channel) {
  const rpcClientRole = addRpcClientRole(channel)
  return {
    execute: rpcClientRole.execute,
    destroy: () => {
      channel.destroy()
    }
  }
}

function createRpcServer (channel, modulePath, affinity, childProcessesCount) {
  addRpcServerRole(channel, modulePath, affinity, childProcessesCount)
  return {
    destroy: () => {
      channel.destroy()
    }
  }
}

module.exports = {
  createPubSubClient,
  createRpcClient,
  createRpcServer
}
