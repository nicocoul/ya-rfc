'use strict'

const { stdout } = require('process')

function newLogger (name) {
  return {
    error: function (message) {
      stdout.write(`ERROR ${new Date().toISOString()} ${name} => ${message}\n`)
    },
    warn: function (message) {
      stdout.write(`WARN ${new Date().toISOString()} ${name} => ${message}\n`)
    },
    debug: function (message) {
      stdout.write(`DEBUG ${new Date().toISOString()} ${name} => ${message}\n`)
    },
    info: function (message) {
      stdout.write(`INFO ${new Date().toISOString()} ${name} => ${message}\n`)
    }
  }
}

module.exports = newLogger
