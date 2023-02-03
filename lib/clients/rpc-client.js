'use strict'
const EventEmitter = require('events')
const { v4: uuidv4 } = require('uuid')
const { NOTIFICATIONS, EVENTS } = require('../constants')
const f = require('../factories')
const logger = require('ya-common').logger(__filename)

function newRequests () {
  const state = {}
  return {
    add: (request, onEnd, onProgress) => {
      state[request.id] = { request, onEnd, onProgress }
    },
    remove: (id) => {
      delete state[id]
    },
    get: (id) => {
      return state[id]
    },
    getByCancelToken: (cancelToken) => {
      return Object.values(state).filter(s => s.request.cancelToken === cancelToken)
    },
    forEach: (fun) => {
      Object.values(state).forEach(fun)
    }
  }
}

function addRpcClientRole (channel, events) {
  const name = uuidv4()
  const requests = newRequests()

  channel.on('data', (data) => {
    if (!data.c) return
    const request = requests.get(data.id)
    if (!request) return
    const notification = f.notifications.fromWire(data)
    switch (data.c) {
      case NOTIFICATIONS.PROGRESS:
        if (request.onProgress) {
          request.onProgress(notification.value)
        }
        break
      case NOTIFICATIONS.FAILED:
        events.emit(EVENTS.FAILED, f.events.fromWireNotification(data))
        requests.remove(notification.id)
        request.onEnd(f.errors.fromWire(notification.value), undefined)
        break
      case NOTIFICATIONS.EXECUTED:
        events.emit(EVENTS.EXECUTED, f.events.fromWireNotification(data))
        requests.remove(notification.id)
        request.onEnd(undefined, notification.value)
        break
    }
  })

  channel.on('close', () => {
    logger.warn('connection close')
    requests.forEach(s => {
      s.onEnd(f.errors.lostBroker(), undefined)
      events.emit(EVENTS.FAILED, f.events.fromWire(s.request))
      requests.remove(s.request.id)
    })
  })

  function execute (procedure, args, onEnd, options = {}) {
    const id = uuidv4()
    const command = f.commands.execute.new(name, id, procedure, args, options.cancelToken, options.affinity, options.priority, options.load)
    channel.write(command)
    events.emit(EVENTS.EXECUTE, f.events.new(command))
    requests.add(command, onEnd, options.onProgress)
  }

  function cancel (cancelToken) {
    requests.getByCancelToken(cancelToken).forEach(s => {
      const command = f.commands.cancel.new(s.request.id, s.request.procedure, s.request.load)
      channel.write(command)
      s.onEnd(f.errors.cancelled(s.request.id), undefined)
      events.emit(EVENTS.CANCELLED, f.events.new(command))
      requests.remove(s.request.id)
    })
  }

  function isOptions (variable) {
    if (variable === undefined) return false
    if (variable === null) return false
    if (typeof variable !== 'object') return false
    if (Array.isArray(variable)) return false
    if (variable.onProgress || variable.affinity || variable.priority || variable.cancelToken) return true
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
  return { execute, remote, cancel, name }
}

function create (channel) {
  const events = new EventEmitter()
  const rpcClient = addRpcClientRole(channel, events)
  channel.on('connect', () => {
    logger.info(`client ${rpcClient.name} connected to broker`)
  })
  channel.on('close', () => {
    logger.info(`client ${rpcClient.name} disconnected from broker`)
  })
  return {
    execute: rpcClient.execute,
    cancel: rpcClient.cancel,
    remote: rpcClient.remote,
    kill: () => {
      channel.kill()
    },
    events
  }
}

module.exports = {
  create
}
