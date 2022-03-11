'use strict'
/* eslint-disable no-empty */

const yac = require('ya-common')
const logger = yac.logger(__filename)
const { COMMANDS } = yac.constants

function newChannels () {
  const state = {}
  return {
    set: (c) => {
      state[c.id] = c
    },
    get: (id) => {
      return state[id]
    },
    remove: (id) => {
      delete state[id]
    },
    forEach: (fun) => {
      Object.values(state).forEach(fun)
    }
  }
}

function newExecChannel (procedures, affinity = null, maxLoad) {
  const _load = maxLoad.map(_ => 0)
  return {
    addLoad: (load = [1]) => {
      _load.forEach((v, i) => {
        _load[i] = v + (load[i] || 0)
      })
    },
    removeLoad: (load = [1]) => {
      _load.forEach((v, i) => {
        _load[i] = v - (load[i] || 0)
      })
    },
    hasProcedure: (procedure) => procedures.includes(procedure),
    // isOverloaded: () => maxLoad.some((max, index) => {
    //   if (max < 0) return false
    //   return _load[index] >= max
    // }),
    getLoadAvg: () => {
      const tres = maxLoad.map(_ => 0)
      maxLoad.forEach((v, i) => {
        tres[i] = _load[i] / v
      })
      return tres / maxLoad.length
    },
    getAffinityMatch: (_affinity) => (affinity === _affinity) ? 1 : 0,
    status: () => ({ load: _load, affinity, maxLoad, procedures })
  }
}

function newExecutionContext () {
  // const state = []
  const state = {}
  return {
    add: (channelId, procedures, affinity, maxLoad) => {
      state[channelId] = newExecChannel(procedures, affinity, maxLoad)
    },
    addLoad: (channelId, load) => {
      if (!state[channelId]) return
      state[channelId].addLoad(load)
    },
    removeLoad: (channelId, load) => {
      if (!state[channelId]) return
      state[channelId].removeLoad(load)
    },
    remove: (channelId) => {
      delete state[channelId]
    },
    pickChannelId: (procedure, affinity = null) => {
      const tres = Object.keys(state)
        .filter(id => /*! state[id].isOverloaded() && */ state[id].hasProcedure(procedure))
        .map(id => ({
          id,
          loadAvg: state[id].getLoadAvg(),
          affinityMatch: state[id].getAffinityMatch(affinity)
        }))
        .sort((s1, s2) => s1.loadAvg - s2.loadAvg)
        .sort((s1, s2) => s2.affinityMatch - s1.affinityMatch)
      if (tres.length) {
        return tres[0].id
      }
    },
    status: () => {
      return Object.keys(state).map(channelId => ({
        channelId,
        details: state[channelId].status()
      }))
    }
  }
}

function newRequests () {
  const state = []
  return {
    add: (id, channelId, procedure, args, affinity, withStatus, withProgress, load = [1], priority) => {
      state.push({ id, channelId, procedure, args, affinity, withStatus, withProgress, load, priority })
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
    pick: () => {
      return state[0]
    },
    reschedule: () => {
      if (state.length) {
        const save = state[0]
        state.splice(0, 1)
        state.push(save)
      }
    },
    removeByChannelId: (channelId) => {
      state.remove(s => s.channelId === channelId)
    },
    length: () => {
      return state.length
    }
  }
}

function newDispatchedRequests () {
  const state = []
  return {
    add: (request, execChannelId) => {
      state.push({ ...request, execChannelId })
    },
    remove: (id) => {
      const index = state.findIndex(s => s.id === id)
      if (index !== -1) {
        state.splice(index, 1)
      }
    },
    // exists: (procedure, args) => {
    //   return state.find(r => r.procedure === procedure && r.args.every((arg, i) => arg === args[i])) !== undefined
    // },
    get: (id) => {
      const res = state.find(s => s.id === id)
      if (res) {
        return { ...res }
      }
    },
    getByExecChannelId: (execChannelId) => {
      return state.filter(s => s.execChannelId === execChannelId)
    },
    removeByExecChannelId: (execChannelId) => {
      state.remove(s => s.execChannelId === execChannelId)
    }
  }
}

function create () {
  const channels = newChannels()
  const execContext = newExecutionContext()
  const requests = newRequests()
  const dispatchedRequests = newDispatchedRequests()
  let _plugin

  const executeProcedure = () => {
    const request = requests.pick()
    if (!request) {
      return false
    }
    const reqChannel = channels.get(request.channelId)
    if (request.withStatus && reqChannel) {
      reqChannel.write({
        c: COMMANDS.RPC_EXECUTE,
        id: request.id,
        status: 'try',
        execContext: execContext.status()
      })
    }

    const execChannelId = execContext.pickChannelId(request.procedure, request.affinity)
    if (!execChannelId) {
      requests.reschedule()
      if (request.withStatus && reqChannel) {
        reqChannel.write({
          c: COMMANDS.RPC_EXECUTE,
          id: request.id,
          status: 'no-exec-channel-id',
          execContext: execContext.status()
        })
      }
      return false
    }
    const execChannel = channels.get(execChannelId)
    if (!execChannel) {
      requests.reschedule()
      if (request.withStatus && reqChannel) {
        reqChannel.write({
          c: COMMANDS.RPC_EXECUTE,
          id: request.id,
          status: 'no-exec-channel',
          execContext: execContext.status()
        })
      }
      return false
    }
    // avoid concurrent execution of the same procedure/args
    // if (dispatchedRequests.exists(request.procedure, request.args)) {
    //   requests.reschedule()
    //   if (request.withStatus) {
    //     const reqChannel = channels.get(request.channelId)
    //     reqChannel && reqChannel.write({ c: COMMANDS.RPC_EXECUTE, id: request.id, status: 'already-dispatched' })
    //   }
    //   return false
    // }
    dispatchedRequests.add(request, execChannelId)
    requests.remove(request.id)
    execContext.addLoad(execChannelId, request.load)
    execChannel.write({ c: COMMANDS.RPC_EXECUTE, id: request.id, procedure: request.procedure, args: request.args, priority: request.priority })
    if (request.withStatus && reqChannel) {
      reqChannel.write({ c: COMMANDS.RPC_EXECUTE, id: request.id, status: 'dispatched', on: execChannel.id })
    }
    return true
  }
  const executeProcedures = () => {
    for (let i = 0; i < requests.length(); i++) {
      try {
        executeProcedure()
      } catch (error) {
        logger.error(`failed to execute ${error.stack}`)
      }
    }
  }
  function schedule (channel, id, procedure, args, affinity = null, withStatus = false, withProgress = false, load, priority) {
    requests.add(id, channel.id, procedure, args, affinity, withStatus, withProgress, load, priority)
    if (withStatus) channel.write({ c: COMMANDS.RPC_EXECUTE, id, status: 'scheduled' })
    executeProcedures()
  }

  function handleData (c, d) {
    if (d.c === COMMANDS.RPC_EXECUTOR) {
      execContext.add(c.id, d.procedures, d.affinity, d.maxLoad)
      executeProcedures()
    } else if (d.c === COMMANDS.RPC_EXECUTE) {
      if (d.result !== undefined || d.error !== undefined || d.progress !== undefined) {
        const request = dispatchedRequests.get(d.id)
        if (!request) {
          // logger.warn(`request ${d.id} not found`)
          return
        }
        if (d.result !== undefined || d.error !== undefined) {
          execContext.removeLoad(request.execChannelId, request.load)
          dispatchedRequests.remove(request.id)
        }
        const reqChannel = channels.get(request.channelId)
        if (!reqChannel) {
          logger.warn(`request channel ${request.channelId} not found`)
          return
        }
        if (request.withStatus) {
          if (d.error) {
            reqChannel.write({ c: COMMANDS.RPC_EXECUTE, id: d.id, status: 'error', on: c.id })
          } else if (d.result) {
            reqChannel.write({ c: COMMANDS.RPC_EXECUTE, id: d.id, status: 'end', on: c.id })
          }
        }
        reqChannel.write({ c: COMMANDS.RPC_EXECUTE, id: d.id, result: d.result, error: d.error, progress: d.progress })
        if (d.result !== undefined || d.error !== undefined) {
          executeProcedures()
        }
      } else {
        schedule(c, d.id, d.procedure, d.args, d.affinity, d.withStatus, d.withProgress, d.load, d.priority)
        executeProcedures()
      }
    } else {
      logger.warn(`message not handled ${JSON.stringify(d)}`)
    }
  }
  function plug (plugin) {
    _plugin = plugin
    plugin.on('new-channel', channel => {
      channels.set(channel)
      channel.on('data', d => {
        handleData(channel, d)
      })
      executeProcedures()
    })
    plugin.on('lost-channel', channel => {
      dispatchedRequests.getByExecChannelId(channel.id).forEach(request => {
        const reqChannel = channels.get(request.channelId)
        if (reqChannel) reqChannel.write({ c: COMMANDS.RPC_EXECUTE, id: request.id, error: `lost server ${channel.id}` })
        execContext.removeLoad(request.execChannelId, request.load)
      })
      dispatchedRequests.removeByExecChannelId(channel)
      channels.remove(channel.id)
      execContext.remove(channel.id)
    })
  }
  function kill () {
    _plugin.kill()
    channels.forEach(channel => channel.kill())
  }
  return {
    plug,
    schedule,
    kill
  }
}

module.exports = {
  create
}
