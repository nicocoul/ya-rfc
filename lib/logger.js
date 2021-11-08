'use strict'

const { stdout } = require('process')

function newLogger (name) {
  return {
    error: function (message) {
      stdout.write(`${new Date().toISOString()} ERROR ${name} => ${message}\n`)
    },
    warn: function (message) {
      stdout.write(`${new Date().toISOString()} WARN ${name} => ${message}\n`)
    },
    debug: function (message) {
      stdout.write(`${new Date().toISOString()} DEBUG ${name} => ${message}\n`)
    },
    info: function (message) {
      stdout.write(`${new Date().toISOString()} INFO ${name} => ${message}\n`)
    }
  }
}

module.exports = newLogger
