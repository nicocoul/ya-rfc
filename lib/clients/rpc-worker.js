'use strict'

let procedures

const newRequestNotifier = (id) => ({
  progress: (v) => process.send({ id, progress: v }),
  result: (v) => {
    if (v === undefined) {
      process.send({ id, result: 'null' })
    } else {
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
    try {
      await procedures.init()
    } catch (error) {
      console.error(error.stack)
      throw error
    }
  }
}

process.on('message', async function (message) {
  const notifier = newRequestNotifier(message.id)
  try {
    if (message.modulePath) {
      await register(message.modulePath)
    } else if (message.procedure && message.id !== undefined) {
      if (!procedures[message.procedure]) {
        notifier.error({ error: `${message.procedure} not found` })
        return
      }
      execute(message.procedure, message.args, notifier.progress)
        .then(result => {
          notifier.result(result)
        })
        .catch(error => {
          notifier.error(`failed to execute ${message.procedure}: ${error.message}`)
        })
    } else {
      notifier.error('bad message')
    }
  } catch (error) {
    notifier.error(error.message)
  }
})
