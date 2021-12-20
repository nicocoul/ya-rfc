'use strict'
const { v4: uuidv4 } = require('uuid')
const yac = require('ya-common')
const { COMMANDS } = yac.constants

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
      if (!request) return
      if (resp.result !== undefined) {
        request.onResult(undefined, d.result === 'null' ? undefined : d.result)
        requests.remove(d.id)
      } else if (resp.progress && request.onProgress) {
        request.onProgress(d.progress)
      } else if (resp.error) {
        request.onResult(new Error(d.error), undefined)
        requests.remove(d.id)
      } else if (resp.status && request.onStatus) {
        request.onStatus({ status: resp.status, on: resp.on, execContext: resp.execContext })
      }
    }
  })

  function execute (procedure, args, onResult, options = {}) {
    const { affinity = null, onProgress, onStatus } = options
    const withProgress = onProgress !== undefined
    const withStatus = onStatus !== undefined
    const request = { id: uuidv4(), procedure, args, affinity, withStatus, withProgress }
    channel.write({ c: COMMANDS.RPC_EXECUTE, ...request })
    requests.add(request, onResult, onProgress, onStatus)
  }

  function isOptions (variable) {
    if (variable === undefined) return false
    if (variable === null) return false
    if (typeof variable !== 'object') return false
    if (Array.isArray(variable)) return false
    if (variable.onProgress || variable.onStatus) return true
    return false
  }

  const proxyHandler = {
    get: function (target, property) {
      return function () {
        return new Promise((resolve, reject) => {
          const args = []
          for (const arg of arguments) {
            args.push(arg)
          }
          const options = isOptions(args[args.length - 1]) && args.pop()
          target(property, args, (error, result) => {
            if (error) {
              reject(error)
            } else {
              resolve(result)
            }
          }, options)
        })
      }
    }
  }

  const remote = new Proxy(execute, proxyHandler)
  return { execute, remote }
}

function create (channel) {
  const rpcClientRole = addRpcClientRole(channel)
  return {
    execute: rpcClientRole.execute,
    remote: rpcClientRole.remote,
    kill: () => {
      channel.kill()
    }
  }
}

module.exports = {
  create
}
