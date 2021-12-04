'use strict'
const path = require('path')
const { fork } = require('child_process')
const os = require('os')
const yac = require('ya-common')
const { COMMANDS } = yac.constants
const logger = yac.logger(__filename)

function newWorkers () {
  const state = []
  let i = 0
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
      i = i % state.length
      const p = state[i]
      i++
      return p
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
  const { affinity = null, workers = Object.keys(os.cpus()).length * 2, maxLoad = [Object.keys(os.cpus()).length * 4] } = options
  let module
  try {
    module = require(modulePath)
  } catch (error) {
    logger.error(`module ${modulePath} cannot be loaded ${error.stack}`)
  }
  const procedures = newProcedures(module)
  const _workers = newWorkers()
  let destroyed = false

  function createWorker () {
    // logger.debug('create workers')
    const worker = fork(path.join(__dirname, 'rpc-worker.js'))
    worker.send({ modulePath })
    worker.on('error', (error) => {
      logger.error(`worker ${worker.pid} ${error.stack}`)
    })
    worker.on('close', () => {
      _workers.removeByPid(worker.pid)
      if (!destroyed) createWorker()
    })
    worker.on('exit', (code, signal) => {
      logger.debug(`worker exited ${worker.pid} ${code} ${signal}`)
    })
    worker.on('message', data => {
      channel.write({ c: COMMANDS.RPC_EXECUTE, ...data })
    })
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
      // await waitFor(() => loadMon.value().cpu < 0.8 || loadMon.value().memory < 0.9)
      try {
        _workers.pick().send(d)
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
