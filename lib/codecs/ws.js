'use strict'

const { Transform } = require('stream')
const safeStringify = require('fast-safe-stringify')

function newDecoder () {
  const result = new Transform({ objectMode: true })
  result._transform = (chunk, _, callback) => {
    result.push(JSON.parse(chunk))
    callback()
  }
  return result
}

function newEncoder () {
  const result = new Transform({ objectMode: true })

  result._transform = (obj, _, callback) => {
    result.push(safeStringify(obj))
    callback()
  }
  return result
}

module.exports = {
  newDecoder,
  newEncoder
}
