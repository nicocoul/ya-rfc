'use strict'
const os = require('os')
const logger = require('./logger')(__filename)

let procedures

const DELAYMS = 20
const cpuInfo = newCPUInfoState()
let lastNotfiedLoad

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

function newCPUInfoState (delayMs = DELAYMS) {
  let v
  let ms
  return {
    get: () => {
      if (!v) {
        v = getCPUInfo()
        ms = new Date().getTime()
      }
      const now = new Date().getTime()
      if (now > delayMs + ms) {
        v = getCPUInfo()
        ms = now
      }
      return v
    }
  }
}

const notifyProgress = (requestBoby) => (progress) => {
  process.send({ ...requestBoby, progress })
}

function getLoad (callback, ms = DELAYMS) {
  const previous = cpuInfo.get()
  setTimeout(() => {
    const current = cpuInfo.get()
    const freeCPU = (current.idle - previous.idle) / (current.total - previous.total)
    const load = { cpu: 1 - freeCPU, memory: os.freemem() / os.totalmem() }
    callback(load)
  }, ms)
}

async function execute (id, procedure, args) {
  getLoad(async (load) => {
    if (Math.abs(lastNotfiedLoad.cpu - load.cpu) > 0.1 || Math.abs(lastNotfiedLoad.memory - load.memory) > 0.1) {
      process.send(load)
      lastNotfiedLoad = load
    }
    if (load.cpu < 0.8 && load.memory < 0.8) {
      try {
        const result = (await procedures[procedure](...args, notifyProgress({ id, procedure, args })))
        if (result === undefined) {
          process.send({ id, procedure, args, result: null })
        } else {
          process.send({ id, procedure, args, result })
        }
      } catch (error) {
        logger.error(error.stack)
        process.send({ id, procedure, args, error: error.message })
      }
    } else {
      process.send({ id, procedure, args, cancelled: true })
    }
  })
}

process.on('message', async function (message) {
  if (message.modulePath) {
    getLoad(load => {
      lastNotfiedLoad = load
      process.send(load)
    })
    procedures = require(message.modulePath)
  } else if (message.procedure && message.args) {
    execute(message.id, message.procedure, message.args)
  }
})
