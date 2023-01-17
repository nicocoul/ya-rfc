'use strict'

let procedures

const cancelledIds = []

const newRequestNotifier = (request) => ({
  progress: (v) => process.send({ id: request.id, progress: v }),
  result: (v) => {
    if (v === undefined) {
      process.send({ id: request.id, result: 'null', request })
    } else {
      process.send({ id: request.id, result: v, request })
    }
  },
  error: (v) => process.send({ id: request.id, error: v, request })
})

const newIsCancelled = (id) => () => cancelledIds.includes(id)

async function execute (procedure, args = [], onProgress, isCancelled) {
  return procedures[procedure](...args, onProgress, isCancelled)
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
  const notifier = newRequestNotifier(message)
  try {
    if (message.modulePath) {
      await register(message.modulePath)
    } else if (message.procedure && message.id !== undefined) {
      if (!procedures[message.procedure]) {
        notifier.error({ error: `${message.procedure} not found` })
        return
      }
      execute(message.procedure, message.args, notifier.progress, newIsCancelled(message.id))
        .then(result => {
          notifier.result(result, message)
        })
        .catch(error => {
          notifier.error(error.message, message)
        })
        .finally(() => {
          const index = cancelledIds.indexOf(message.id)
          if (index !== -1) {
            cancelledIds.splice(index, 1)
          }
        })
    } else if (message.cancel) {
      cancelledIds.push(message.id)
    } else {
      notifier.error('bad message')
    }
  } catch (error) {
    notifier.error(error.message)
  }
})
