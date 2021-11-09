'use strict'
const { v4: uuidv4 } = require('uuid')
const { TOPICS } = require('./constants')
require('./array-extensions')

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

  channel.on('data', d => {
    if (!d.t) return
    if (d.t !== TOPICS.RPC_EXECUTE) return
    if (d.m.id) {
      const resp = { ...d.m }
      delete resp.id
      requests.get(d.m.id).callback(resp)
    }
  })

  const execute = (procedure, args, callback, affinity, withStatus = false) => {
    const request = { id: uuidv4(), procedure, args, affinity, withStatus }
    channel.write({ t: TOPICS.RPC_EXECUTE, m: request })
    requests.add(request, callback)
  }
  return { execute }
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

module.exports = {
  createRpcClient
}
