'use strict'

const logger = require('../logger')(__filename)

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
  // noResult: (v) => process.send({ id, noResult: 'noResult' }),
  error: (v) => process.send({ id, error: v }),
  delayed: () => process.send({ id, delayed: true })
})

async function execute (procedure, args = [], onProgress) {
  return procedures[procedure](...args, onProgress)
}

function register (modulePath) {
  procedures = require(modulePath)
}

process.on('message', function (message) {
  if (message.modulePath) {
    register(message.modulePath)
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
