'use strict'
const path = require('path')
const { fork } = require('child_process')
const os = require('os')
const EventEmitter = require('events')
const { v4: uuidv4 } = require('uuid')
const yac = require('ya-common')
const { COMMANDS, NOTIFICATIONS, EVENTS } = require('../constants')
const f = require('../factories')
const logger = yac.logger(__filename)

function newWorker (modulePath) {
  const events = new EventEmitter()
  let _command
  let _executing = false
  const worker = fork(path.join(__dirname, 'rpc-worker.js'))
  const emitEvent = (type, value) => {
    if (_command) {
      events.emit(type, { command: _command, value })
    }
  }
  worker.send({ modulePath })
  worker.on('error', (error) => {
    logger.warn(`worker error ${error.message}`)
    _executing = false
    emitEvent(NOTIFICATIONS.FAILED, [error.message, error.code || 'WORKER_ERROR'])
  })
  worker.on('close', (data) => {
    logger.warn(`worker close ${data}`)
    _executing = false
    emitEvent(NOTIFICATIONS.FAILED, ['worker was closed', 'WORKER_CLOSED'])
    events.emit('close', data)
  })
  worker.on('exit', (code) => {
    logger.warn(`worker exit ${code}`)
    _executing = false
    emitEvent(NOTIFICATIONS.FAILED, ['worker excited', 'WORKER_EXITED'])
    events.emit('exit', code)
  })
  worker.on('uncaughtException', (err) => {
    logger.error(`uncaughtException ${err.message}`)
    _executing = false
    emitEvent(NOTIFICATIONS.FAILED, [`uncaughtException ${err.message}`, err.code || 'UNCAUGHT_EXCEPTION'])
  })
  worker.on('unhandledRejection', (reason) => {
    logger.error('unhandledRejection')
    _executing = false
    emitEvent(NOTIFICATIONS.FAILED, [`unhandled rejection ${reason}`, 'UNHANDLED_REJECTION'])
  })
  worker.on('disconnect', () => {
    logger.warn('worker disconnect')
    _executing = false
    events.emit('disconnect')
  })
  worker.on('message', ({ notification, value }) => {
    if (notification !== NOTIFICATIONS.PROGRESS) {
      _executing = false
    }
    emitEvent(notification, value)
  })
  function execute (command) {
    _executing = true
    _command = command
    worker.send(command)
  }
  function kill () {
    worker.removeAllListeners()
    worker.kill('SIGINT')
  }
  function isExecuting () {
    return _executing
  }
  function command () {
    if (_command) {
      return { ..._command }
    }
  }

  return {
    events,
    execute,
    kill,
    isExecuting,
    command
  }
}

function newCluster (size, modulePath) {
  const events = new EventEmitter()
  const workers = []
  function registerWorker (modulePath) {
    const worker = newWorker(modulePath)
    worker.events.on('exit', () => {
      worker.events.removeAllListeners()
      registerWorker(modulePath)
    })
    worker.events.on('close', () => {
      worker.events.removeAllListeners()
      registerWorker(modulePath)
    })
    worker.events.on(NOTIFICATIONS.EXECUTED, (message) => {
      events.emit(NOTIFICATIONS.EXECUTED, message)
    })
    worker.events.on(NOTIFICATIONS.FAILED, (message) => {
      events.emit(NOTIFICATIONS.FAILED, message)
    })
    worker.events.on(NOTIFICATIONS.PROGRESS, (message) => {
      events.emit(NOTIFICATIONS.PROGRESS, message)
    })
    workers.push(worker)
  }
  [...Array(size)].forEach(() => registerWorker(modulePath))

  function availableWorker () {
    return workers.find(w => !w.isExecuting())
  }
  function kill () {
    workers.forEach((w) => {
      w.events.removeAllListeners()
      w.kill()
    })
    workers.length = 0
  }
  function cancel (id) {
    const worker = workers.find(w => w.command() && w.command().id === id)
    if (worker) {
      worker.events.removeAllListeners()
      worker.kill()
      registerWorker(modulePath)
      return true
    } else {
      return false
    }
  }
  return {
    events,
    availableWorker,
    kill,
    cancel
  }
}

function newProcedures (module = {}) {
  const state = module
  return {
    exists: (name) => {
      return state[name] !== undefined
    },
    names: () => {
      return Object.keys(state)
    }
  }
}

function create (channel, modulePath, options = {}) {
  const name = uuidv4()
  const events = new EventEmitter()
  const scheduledCommands = f.commands.queue.new()
  const { affinity = null, workers = Object.keys(os.cpus()).length } = options

  const cluster = newCluster(workers, modulePath)

  let mod
  try {
    mod = require(modulePath)
  } catch (error) {
    logger.error(`module ${modulePath} cannot be loaded ${error.stack}`)
  }
  const procedures = newProcedures(mod)

  cluster.events.on(NOTIFICATIONS.EXECUTED, ({ command, value }) => {
    channel.write(f.notifications.new(NOTIFICATIONS.EXECUTED, name, command, value))
    events.emit(EVENTS.EXECUTED, f.events.new(command, value))
    processQueue()
  })

  cluster.events.on(NOTIFICATIONS.FAILED, ({ command, value }) => {
    channel.write(f.notifications.new(NOTIFICATIONS.FAILED, name, command, value))
    events.emit(EVENTS.FAILED, f.events.new(command, value))
    processQueue()
  })

  cluster.events.on(NOTIFICATIONS.PROGRESS, ({ command, value }) => {
    channel.write(f.notifications.new(NOTIFICATIONS.PROGRESS, name, command, value))
  })

  function processQueue () {
    let worker
    while (scheduledCommands.length() && (worker = cluster.availableWorker())) {
      const command = scheduledCommands.shift()
      events.emit(EVENTS.EXECUTE, f.events.new(command))
      worker.execute(command)
    }
  }

  function onDoExecute (command) {
    if (!procedures.exists(command.procedure)) {
      const error = f.errors.noProcedure(command.procedure, command.id)
      logger.error(error.message)
      const c = f.events.new(command)
      events.emit(EVENTS.SCHEDULE, c)
      events.emit(EVENTS.EXECUTE, c)
      events.emit(EVENTS.FAILED, f.events.new(command, error.code))
      channel.write(f.notifications.new(NOTIFICATIONS.FAILED, name, command, f.errors.toWire(error)))
      return
    }
    events.emit(EVENTS.SCHEDULE, f.events.new(command))
    scheduledCommands.add(command)
    processQueue()
  }

  function onDoCancel (command) {
    if (scheduledCommands.removeById(command.id)) {
      events.emit(EVENTS.CANCELLED, f.events.new(command))
    } else {
      if (cluster.cancel(command.id)) {
        logger.debug(`cancelled ${command.id}`)
        events.emit(EVENTS.CANCELLED, f.events.new(command))
      }
    }
    processQueue()
  }

  channel.on('data', (data) => {
    if (data.c === COMMANDS.EXECUTE) {
      onDoExecute(f.commands.execute.fromWire(data))
    } else if (data.c === COMMANDS.CANCEL) {
      onDoCancel(f.commands.cancel.fromWire(data))
    }
  })

  channel.on('connect', () => {
    logger.info(`server ${name} connected to broker`)
    channel.write(f.commands.registerSerer.new(name, affinity, workers))
  })

  channel.on('close', () => {
    logger.warn(`server ${name} disconnected from broker`)
  })

  function kill () {
    events.removeAllListeners()
    cluster.kill()
    channel.kill()
  }
  return {
    kill,
    events
  }
}

module.exports = {
  create
}
