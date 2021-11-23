'use strict'
const { v4: uuidv4 } = require('uuid')
const { COMMANDS } = require('../constants')
const logger = require('../logger')(__filename)
require('../array-extensions')

function newRequests () {
  const state = []
  const getIndex = (id) => {
    return state.findIndex(s => s.request.id === id)
  }
  return {
    add: (request, onResult, onProgress, onStatus) => {
      state.push({ request, onResult, onProgress, onStatus })
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
      const request = requests.get(d.id)
      if (resp.result) {
        request.onResult(undefined, d.result === 'null' ? null : d.result)
        delete resp.id
      } else if (resp.progress && request.onProgress) {
        request.onProgress(d.progress)
      } else if (resp.error) {
        request.onResult(new Error(d.error), undefined)
        delete resp.id
      } else if (resp.status && request.onStatus) {
        request.onStatus(resp.status)
      }
    }
  })

  const execute = (procedure, args, onResult, options = {}) => {
    const { affinity = null, onProgress, onStatus } = options
    const withProgress = onProgress !== undefined
    const withStatus = onStatus !== undefined
    const request = { id: uuidv4(), procedure, args, affinity, withStatus, withProgress }
    channel.write({ c: COMMANDS.RPC_EXECUTE, ...request })
    requests.add(request, onResult, onProgress, onStatus)
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
