'use strict'
/* eslint-disable no-empty */

const { COMMANDS } = require('../constants')
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
      // logger.debug(`setChannelProcedures ${channelId} ${procedures.join(',')} ${affinity}`)
      procs[channelId] = procedures
      affs[channelId] = affinity
      lds[channelId] = 0.5
      refresh(channelId)
    },
    setChannelLoad: (channelId, cpu, memory) => {
      lds[channelId] = (cpu + memory) / 2
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

function create () {
  const channels = newChannels()
  const execContext = newExecutionContext()
  const requests = newRequests()
  let _plugin

  const executeProcedure = () => {
    const r = requests.pop()
    if (!r) {
      // logger.debug('nothing to execute')
      return false
    }
    const execChannelId = execContext.getChannelId(r.procedure, r.affinity)
    if (!execChannelId) {
      requests.setLowPriority(r.id)
      // logger.debug('no exec channel')
      return false
    }
    const execChannel = channels.getById(execChannelId)
    if (!execChannel) return false
    requests.setDispatched(r.id)
    execChannel.write({ c: COMMANDS.RPC_EXECUTE, id: r.id, procedure: r.procedure, args: r.args })
    if (r.withStatus) {
      const reqChannel = channels.getById(r.channelId)
      reqChannel.write({ c: COMMANDS.RPC_EXECUTE, id: r.id, progress: 'started' })
    }
    return true
  }
  const executeProcedures = () => {
    // logger.debug('executeProcedures')
    while (executeProcedure()) { }
  }

  function execute (channel, id, procedure, args, affinity = null, withStatus = false) {
    // logger.debug(`execute requestor:${channel.id} ${procedure} ${affinity} ${withStatus}`)
    requests.add(id, channel.id, procedure, args, affinity, withStatus)
    if (withStatus) channel.write({ c: COMMANDS.RPC_EXECUTE, id, progress: 'scheduled' })
    executeProcedures()
  }

  function handleData (c, d) {
    // logger.debug(`handleData ${JSON.stringify(d)}`)
    if (d.c === COMMANDS.RPC_EXECUTOR) {
      // logger.debug(`executor c.id=${c.id}`)
      execContext.setChannelProcedures(c.id, d.procedures, d.affinity)
      executeProcedures()
    } else if (d.c === COMMANDS.RPC_EXECUTE) {
      if (d.result !== undefined || d.error !== undefined || d.progress !== undefined) {
        const r = requests.get(d.id)
        if (!r) return
        const reqChannel = channels.getById(r.channelId)
        if (!reqChannel) return
        reqChannel.write({ c: d.c, id: d.id, result: d.result, error: d.error, progress: d.progress })
        if (d.result !== undefined || d.error !== undefined) {
          requests.remove(d.id)
          executeProcedures()
        }
      } else if (d.delayed) {
        requests.resetDispatched(d.id)
        const r = requests.get(d.id)
        if (r && r.withStatus) {
          const reqChannel = channels.getById(r.channelId)
          if (reqChannel) {
            c.write({ c: COMMANDS.RPC_EXECUTE, id: d.id, progress: 'delayed' })
          }
        }
        executeProcedures()
      } else {
        execute(c, d.id, d.procedure, d.args, d.affinity, d.withStatus)
      }
    } else if (d.c === COMMANDS.OS_LOAD) {
      execContext.setChannelLoad(c.id, d.cpu, d.memory)
      executeProcedures()
    } else {
      logger.warn(`message not handled ${JSON.stringify(d)}`)
    }
  }
  function plug (plugin) {
    _plugin = plugin
    plugin.on('new-channel', channel => {
      logger.debug(`plugged ${channel.id}`)
      channels.set(channel)
      channel.on('data', d => {
        handleData(channel, d)
      })
    })
    plugin.on('lost-channel', channel => {
      channels.removeById(channel.id)
      execContext.removeChannel(channel.id)
    })
  }
  function destroy () {
    _plugin.destroy()
    channels.forEach(channel => channel.destroy())
  }
  return {
    plug,
    execute,
    destroy
  }
}

module.exports = {
  create
}
