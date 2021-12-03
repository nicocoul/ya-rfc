'use strict'

let procedures

const newRequestNotifier = (id) => ({
  progress: (v) => process.send({ id, progress: v }),
  result: (v) => {
    if (v === undefined) {
      process.send({ id, result: 'null' })
    } else {
      // logger.debug('SEND')
      process.send({ id, result: v })
    }
  },
  error: (v) => process.send({ id, error: v })
})

async function execute (procedure, args = [], onProgress) {
  return procedures[procedure](...args, onProgress)
}

async function register (modulePath) {
  procedures = require(modulePath)
  if (procedures.init) {
    await procedures.init()
  }
}

process.on('message', async function (message) {
  if (message.modulePath) {
    await register(message.modulePath)
  } else if (message.procedure && message.id !== undefined) {
    const notifier = newRequestNotifier(message.id)
    if (!procedures[message.procedure]) {
      notifier.error({ error: `${message.procedure} not found` })
      return
    }
    execute(message.procedure, message.args, notifier.progress)
      .then(result => {
        // logger.debug('EXECUTED')
        notifier.result(result)
      })
      .catch(error => {
        notifier.error(`failed to execute ${message.procedure}: ${error.message}`)
      })
  } else {
    throw new Error('bad message')
  }
})
