'use strict'
const path = require('path')
const { fork } = require('child_process')
const { COMMANDS } = require('../constants')
const os = require('os')

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
    add: (name, fct) => {
      state[name] = fct
    },
    get: (name) => {
      return state[name]
    },
    names: () => {
      return Object.keys(state)
    }
  }
}

function getCPUInfo () {
  const cpus = os.cpus()

  let total = 0
  let idle = 0

  Object.values(cpus).forEach(cpu => {
    total += cpu.times.user
    total += cpu.times.nice
    total += cpu.times.sys
    total += cpu.times.irq
    total += cpu.times.idle
    idle += cpu.times.idle
  })
  return { idle, total }
}

function getCPUInfoWithDelay (ms = 50) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(getCPUInfo())
    }, ms)
  })
}

function getLoad (previous, current) {
  const cpu = (current.idle - previous.idle) / (current.total - previous.total)
  return { cpu: 1 - cpu, memory: os.freemem() / os.totalmem() }
}

function newLoadMonitor (ms = 50) {
  let load = { cpu: 0.5, memory: 0.5 }
  let destroyed = false
  let cpuPrevious = getCPUInfo()
  async function tick () {
    if (destroyed) {
      return
    }
    const cpu = await getCPUInfoWithDelay(ms)
    if (cpu.total !== cpuPrevious.total && cpu.idle !== cpuPrevious.idle) {
      load = getLoad(cpuPrevious, cpu)
      cpuPrevious = cpu
    }
    await tick()
  }
  tick()
  return {
    value: () => {
      return load
    },
    destroy: () => {
      destroyed = true
    }
  }
}

async function waitFor (condition) {
  if (condition()) return
  await new Promise(resolve => {
    setTimeout(() => { resolve() }, 20)
  })
  waitFor(condition)
}

function create (channel, modulePath, options = {}) {
  const { affinity = null, workersCount = Object.keys(os.cpus()).length } = options
  let module
  try {
    module = require(modulePath)
  } catch (error) {
    logger.error(`module ${modulePath} cannot be loaded ${error.stack}`)
  }
  const procedures = newProcedures(module)
  const workers = newWorkers()
  const loadMon = newLoadMonitor(20)
  const loadMonNot = newLoadMonitor(500)
  let destroyed = false
  let notifyLoadTimeout

  function createWorker () {
    // logger.debug('create workers')
    const worker = fork(path.join(__dirname, 'rpc-worker.js'))
    worker.send({ modulePath })
    worker.on('error', (error) => {
      logger.error(`worker ${worker.pid} ${error.stack}`)
    })
    worker.on('close', () => {
      workers.removeByPid(worker.pid)
      if (!destroyed) createWorker()
    })
    worker.on('exit', (code, signal) => {
      logger.debug(`worker exited ${worker.pid} ${code} ${signal}`)
    })
    worker.on('message', data => {
      channel.write({ c: COMMANDS.RPC_EXECUTE, ...data })
    })
    workers.add(worker)
  }

  function notifyLoad () {
    const load = loadMonNot.value()
    channel.write({ c: COMMANDS.OS_LOAD, ...load })
    notifyLoadTimeout = setTimeout(() => {
      notifyLoad()
    }, 500)
  }

  async function processRequests () {
    for await (const d of channel) {
      // logger.debug(JSON.stringify(d))
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
      await waitFor(() => loadMon.value().cpu < 0.7 || loadMon.value().memory < 0.9)
      try {
        // console.log(procedure, procedures.get(procedure).length, d.args)
        workers.pick().send(d)
      } catch (error) {
        logger.error(error.stack)
        channel.write({ c: COMMANDS.RPC_EXECUTE, ...d.m, error: error.message })
      }
    }
  }

  channel.on('connect', () => {
    // logger.debug('connected to broker')
    channel.write({ c: COMMANDS.RPC_EXECUTOR, procedures: procedures.names(), affinity })
  })

  function destroy () {
    destroyed = true
    loadMon.destroy()
    loadMonNot.destroy()
    if (notifyLoadTimeout) clearTimeout(notifyLoadTimeout)
    workers.forEach((worker) => {
      try {
        worker.kill()
      } catch (error) {
        logger.debug(`failed to kill worker ${error.message}`)
      }
    })
    channel.destroy()
  }

  for (let i = 0; i < workersCount; i++) {
    createWorker()
  }
  notifyLoad()
  processRequests()

  return {
    destroy
  }
}

module.exports = {
  create
}
