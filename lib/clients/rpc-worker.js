'use strict'
const { NOTIFICATIONS } = require('../constants')
let procedures

function sendProgress (value) {
  process.send({ notification: NOTIFICATIONS.PROGRESS, value })
}
function sendResult (value) {
  process.send({ notification: NOTIFICATIONS.EXECUTED, value })
}
function sendError (value) {
  process.send({ notification: NOTIFICATIONS.FAILED, value })
}

async function execute (procedure, args = [], onProgress, isCancelled) {
  return procedures[procedure](...args, onProgress, isCancelled)
}

async function register (modulePath) {
  procedures = require(modulePath)
  if (procedures.init) {
    await procedures.init()
  }
}

process.on('message', async function (message) {
  try {
    if (message.modulePath) {
      await register(message.modulePath)
    } else if (message.procedure && message.id !== undefined) {
      if (!procedures[message.procedure]) {
        sendError({ error: `${message.procedure} not found` })
        return
      }
      execute(message.procedure, message.args, sendProgress)
        .then(result => {
          sendResult(result)
        })
        .catch(error => {
          sendError(error.message)
        })
    } else {
      sendError('bad request')
    }
  } catch (error) {
    sendError(error.message)
  }
})

process.on('unhandledRejection', (reason, p) => {
  // sendError({ error: `unhandledRejection ${reason}` })
  // process.send('unhandledRej', (reason, p))
})
