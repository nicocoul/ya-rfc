'use strict'

const { DecodeProtocolStream, EncodeProtocolStream } = require('./serde.js')
const { Duplex, PassThrough, Writable, Readable, Transform } = require('stream')
// const { EventEmitter } = require('events')

function newEncoder () {
  return new EncodeProtocolStream()
}

function newDecoder () {
  return new DecodeProtocolStream()
}

function newPassTrough () {
  return new PassThrough({ objectMode: true })
}

function createChannel (readable, writable) {
  /*
  const result = new EventEmitter()
  result.readStream = readable
  result.writeStream = writable
  result.write = (obj) => writable.write(obj)
  result.on = (eventName, callback) => readable.on(eventName, callback)
  return result
  */

  const result = new Duplex({ objectMode: true })
  result._waiting = false

  writable.once('finish', () => {
    result.end()
  })

  result.once('finish', () => {
    writable.end()
  })

  readable.once('end', () => {
    result.push(null)
  })

  readable.on('readable', () => {
    if (result._waiting) {
      result._waiting = false
      result._read()
    }
  })

  result._write = (object, encoding, next) => {
    writable.write(object, encoding, next)
  }

  result._read = () => {
    let buf
    let reads = 0
    while ((buf = readable.read()) !== null) {
      result.push(buf)
      reads++
    }
    if (reads === 0) {
      result._waiting = true
    }
  }
  return result
}

function newReadable () {
  const result = new Readable({ objectMode: true })
  result._read = () => { }
  return result
}

function newWritable () {
  const result = new Writable({ objectMode: true })
  result._write = function (obj, _, next) {
    next()
  }
  return result
}

function newDuplex () {
  const result = new Duplex({ objectMode: true })
  result._write = function (obj, _, next) {
    next()
  }
  result._read = () => { }
  return result
}

function newTransform () {
  const result = new Transform({ objectMode: true })
  return result
}

function newArrayReadable (array) {
  const a = [...array]
  const result = new Readable({ objectMode: true })
  result._read = () => {
    const el = a.shift()
    if (el !== undefined) { result.push(el) } else { result.push(null) }
  }
  return result
}

function newWrapper (topic, startOffset) {
  const result = new Transform({ objectMode: true })
  let offset = startOffset
  result._transform = (message, _, next) => {
    result.push({ t: topic, o: offset, m: message })
    offset++
    next()
  }
  return result
}

module.exports = {
  createChannel,
  newDecoder,
  newEncoder,
  newPassTrough,
  newReadable,
  newWritable,
  newDuplex,
  newTransform,
  newArrayReadable,
  newWrapper
}
