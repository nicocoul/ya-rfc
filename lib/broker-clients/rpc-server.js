'use strict'
const path = require('path')
const { fork } = require('child_process')
const { TOPICS } = require('../constants')
const os = require('os')

require('../array-extensions')
const logger = require('../logger')(__filename)

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
        state.splice(index, 1)
      }
    },
    pop: () => {
      i = i % state.length
      const p = state[i]
      i++
      return p
    }
  }
}

function addRpcServerRole (channel, modulePath, affinity = null, workersCount) {
  const procedures = require(modulePath)
  const procedureNames = Object.keys(procedures)
  if (!procedureNames.length) {
    throw new Error(`no functions found in module ${modulePath}`)
  }
  workersCount = workersCount || Object.keys(os.cpus()).length
  logger.info(`creating ${workersCount} workers`)
  const workers = newWorkers()
  const createWorker = () => {
    const worker = fork(path.join(__dirname, 'rpc-server-worker.js'))
    logger.debug(`worker ${worker.pid} created`)
    worker.send({ modulePath })
    worker.on('error', (error) => {
      logger.error(`worker ${worker.pid} ${error.stack}`)
    })
    worker.on('close', (code) => {
      workers.removeByPid(worker.pid)
      logger.debug(`worker ${worker.pid} closed with code ${code}`)
      createWorker()
    })
    worker.on('message', data => {
      if (data.procedure) {
        channel.write({ t: TOPICS.RPC_EXECUTE, m: data })
      } else if (data.cpu) {
        channel.write({ t: TOPICS.OS_LOAD, m: data })
      }
    })
    workers.add(worker)
  }
  for (let i = 0; i < workersCount; i++) {
    createWorker()
  }

  channel.on('data', async d => {
    if (!modulePath) {
      return
    }
    if (!d.t) return
    if (d.t !== TOPICS.RPC_EXECUTE) return

    if (!d.m.procedure) {
      logger.error('no procedure defined')
      channel.write({ t: TOPICS.RPC_EXECUTE, m: { ...d.m, error: 'no procedure defined' } })
      return
    }
    const { procedure } = d.m
    if (!procedureNames.includes(procedure)) {
      logger.error(`procedure ${procedure} not found`)
      channel.write({ t: TOPICS.RPC_EXECUTE, m: { ...d.m, error: `procedure ${procedure} not found` } })
      return
    }
    try {
      workers.pop().send(d.m)
    } catch (error) {
      logger.error(error.stack)
      channel.write({ t: TOPICS.RPC_EXECUTE, m: { ...d.m, error: error.message } })
    }
  })

  channel.on('connect', () => {
    logger.debug('connected')
    channel.write({ t: TOPICS.RPC_EXECUTOR, m: { procedures: Object.keys(procedures), affinity } })
  })
  const destroy = () => {
  }

  return { destroy }
}

function create (channel, modulePath, affinity, workersCount) {
  logger.info(`create ${modulePath} affinity=${affinity} workersCount=${workersCount}`)
  addRpcServerRole(channel, modulePath, affinity, workersCount)
  return {
    destroy: () => {
      channel.destroy()
    }
  }
}

module.exports = {
  create
}
