'use strict'
/* eslint-disable no-empty */

const { newServer } = require('../../obsolete/server')
const { TOPICS } = require('../constants')
const logger = require('../logger')(__filename)
require('../array-extensions')
const { newChannels } = require('./common')

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

function newRequests () {
  const state = []
  return {
    add: (id, channelId, procedure, args, affinity, withStatus) => {
      state.push({ id, channelId, procedure, args, affinity, dispatched: false, withStatus })
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

function create (port) {
  logger.info(`create ${port}`)
  const server = newServer(port)
  const channels = newChannels()
  const execContext = newExecutionContext()
  const requests = newRequests()

  const executeProcedure = () => {
    const r = requests.pop()
    if (!r) return false
    const execChannelId = execContext.getChannelId(r.procedure, r.affinity)
    if (!execChannelId) {
      requests.setLowPriority(r.id)
      return false
    }
    const execChannel = channels.getById(execChannelId)
    if (!execChannel) return false
    requests.setDispatched(r.id)
    execChannel.write({ t: TOPICS.RPC_EXECUTE, m: { id: r.id, procedure: r.procedure, args: r.args } })
    if (r.withStatus) {
      const reqChannel = channels.getById(r.channelId)
      reqChannel.write({ t: TOPICS.RPC_EXECUTE, m: { id: r.id, progress: 'started' } })
    }
    return true
  }
  const executeProcedures = () => {
    while (executeProcedure()) { }
  }

  const schedule = (channel, id, procedure, args, affinity = null, withStatus = false) => {
    requests.add(id, channel.id, procedure, args, affinity, withStatus)
    if (withStatus) channel.write({ t: TOPICS.RPC_EXECUTE, m: { id, progress: 'scheduled' } })
    executeProcedures()
  }

  server.on('new-channel', c => {
    channels.set(c)
    c.on('data', d => {
      if (!d.t || !d.m) return
      if (d.t === TOPICS.RPC_EXECUTOR) {
        logger.debug(`executor c.id=${c.id} ${JSON.stringify(d.m)}`)
        execContext.setChannelProcedures(c.id, d.m.procedures, d.m.affinity)
        executeProcedures()
      } else if (d.t === TOPICS.RPC_EXECUTE) {
        if (d.m.result !== undefined || d.m.error !== undefined || d.m.progress !== undefined) {
          const r = requests.get(d.m.id)
          if (!r) return
          const reqChannel = channels.getById(r.channelId)
          if (!reqChannel) return
          reqChannel.write({ t: d.t, m: { id: d.m.id, result: d.m.result, error: d.m.error, progress: d.m.progress } })
          if (d.m.result !== undefined || d.m.error !== undefined) {
            requests.remove(d.m.id)
            executeProcedures()
          }
        } else if (d.m.delayed) {
          requests.resetDispatched(d.m.id)
          const r = requests.get(d.m.id)
          if (r && r.withStatus) {
            const reqChannel = channels.getById(r.channelId)
            if (reqChannel) {
              c.write({ t: TOPICS.RPC_EXECUTE, m: { id: d.m.id, progress: 'delayed' } })
            }
          }
          executeProcedures()
        } else {
          schedule(c, d.m.id, d.m.procedure, d.m.args, d.m.affinity, d.m.withStatus)
        }
      } else if (d.t === TOPICS.OS_LOAD) {
        execContext.setChannelLoad(c.id, d.m)
      }
    })
  })
  server.on('lost-channel', c => {
    logger.debug(`lost-channel ${c.id}`)
    channels.removeById(c.id)
    execContext.removeChannel(c.id)
  })
  return {
    schedule,
    close: () => {
      logger.info(`closing broker ${port}`)
      server.close()
    }
  }
}

module.exports = {
  create
}
