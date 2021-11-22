'use strict'
const { v4: uuidv4 } = require('uuid')
const { COMMANDS } = require('../constants')
// const logger = require('../logger')(__filename)
require('../array-extensions')

function newRequests () {
  const state = []
  const getIndex = (id) => {
    return state.findIndex(s => s.request.id === id)
  }
  return {
    add: (request, onResult, onProgress) => {
      state.push({ request, onResult, onProgress })
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
    if (d.c !== COMMANDS.RPC_EXECUTE) return
    if (d.id) {
      const resp = { ...d }
      delete resp.id
      if (resp.result) {
        requests.get(d.id).onResult(undefined, d.result === 'null' ? null : d.result)
        delete resp.id
      } else if (resp.progress && requests.get(d.id).onProgress) {
        requests.get(d.id).onProgress(d.progress)
      } else if (resp.error) {
        requests.get(d.id).onResult(new Error(d.error), undefined)
        delete resp.id
      }
    }
  })

  const execute = (procedure, args, onResult, options = {}) => {
    const { affinity = null, onProgress } = options
    const withStatus = onProgress !== undefined
    const request = { id: uuidv4(), procedure, args, affinity, withStatus }
    channel.write({ c: COMMANDS.RPC_EXECUTE, ...request })
    requests.add(request, onResult, onProgress)
  }
  return { execute }
}

function create (channel) {
  // logger.info('create')
  const rpcClientRole = addRpcClientRole(channel)
  return {
    execute: rpcClientRole.execute,
    destroy: () => {
      channel.destroy()
    }
  }
}

module.exports = {
  create
}
