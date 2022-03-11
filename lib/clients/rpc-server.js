'use strict'
const path = require('path')
const { fork } = require('child_process')
const os = require('os')
const yac = require('ya-common')
const { COMMANDS } = yac.constants
const logger = yac.logger(__filename)

function newWorkers () {
  const state = []
  return {
    add: (worker) => {
      state.push(worker)
    },
    removeByPid: (pid) => {
      const index = state.findIndex(p => p.pid === pid)
      if (index !== -1) {
        try {
          state[index].kill('SIGINT')
        } catch (error) {
          logger.debug(`failed to kill worker ${error.message}`)
        }
        state.splice(index, 1)
      }
    },
    pick: () => {
      return state.reduce((w1, w2) => w1.queueLength() < w2.queueLength() ? w1 : w2)
    },
    forEach: (fun) => {
      state.forEach(fun)
    }
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
  const maxLoadPerWorker = 2
  const { affinity = null, workers = Object.keys(os.cpus()).length, maxLoad = [Object.keys(os.cpus()).length * maxLoadPerWorker] } = options
  let mod
  try {
    mod = require(modulePath)
  } catch (error) {
    logger.error(`module ${modulePath} cannot be loaded ${error.stack}`)
  }
  const procedures = newProcedures(mod)
  const _workers = newWorkers()
  let destroyed = false

  function createWorker () {
    const queue = []
    let load = 0
    const worker = fork(path.join(__dirname, 'rpc-worker.js'))
    worker.send({ modulePath })
    worker.on('error', (error) => {
      logger.error(`worker ${worker.pid} ${error.stack}`)
    })
    worker.on('close', () => {
      queue.length = 0
      load = 0
      _workers.removeByPid(worker.pid)
      if (!destroyed) createWorker()
    })
    worker.on('exit', (code, signal) => {
      logger.debug(`worker exited ${worker.pid} ${code} ${signal}`)
      queue.length = 0
      load = 0
    })
    worker.on('message', data => {
      load--
      processQueue()
      channel.write({ c: COMMANDS.RPC_EXECUTE, ...data })
    })
    const processQueue = () => {
      while (load < maxLoadPerWorker && queue.length) {
        load++
        worker.send(queue.shift())
      }
    }
    worker.schedule = (request) => {
      if (request.procedure === 'cleanupEquipmentFolder') return
      const index = queue.findIndex(el => el.priority > request.priority)
      if (index === -1) {
        queue.push(request)
      } else {
        queue.splice(index, 0, request)
      }
      processQueue()
    }
    worker.queueLength = () => {
      return queue.length
    }
    _workers.add(worker)
  }

  channel.on('readable', () => {
    let d
    while ((d = channel.read()) !== null) {
      if (d.c !== COMMANDS.RPC_EXECUTE) continue
      if (!d.procedure) {
        logger.error('no procedure defined')
        channel.write({ c: COMMANDS.RPC_EXECUTE, ...d.m, error: 'no procedure defined' })
        continue
      }
      const { procedure } = d
      if (!procedures.exists(procedure)) {
        logger.error(`procedure ${procedure} not found`)
        channel.write({ c: COMMANDS.RPC_EXECUTE, ...d.m, error: `procedure ${procedure} not found` })
        continue
      }
      try {
        _workers.pick().schedule(d)
      } catch (error) {
        logger.error(error.stack)
        channel.write({ c: COMMANDS.RPC_EXECUTE, ...d.m, error: error.message })
      }
    }
  })
  channel.on('connect', () => {
    channel.write({ c: COMMANDS.RPC_EXECUTOR, procedures: procedures.names(), affinity, maxLoad })
  })

  function kill () {
    destroyed = true
    _workers.forEach((worker) => {
      try {
        worker.kill()
      } catch (error) {
        logger.debug(`failed to kill worker ${error.message}`)
      }
    })
    channel.kill()
  }

  for (let i = 0; i < workers; i++) {
    createWorker()
  }
  // notifyBroker()

  return {
    kill
  }
}

module.exports = {
  create
}
