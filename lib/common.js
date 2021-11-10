'use strict'
/* eslint-disable no-new-func */

const { DecodeProtocolStream, EncodeProtocolStream } = require('./serde.js')
const { Duplex, PassThrough, Writable, Readable, Transform } = require('stream')

function newEncoder () {
  return new EncodeProtocolStream()
}

function newDecoder () {
  return new DecodeProtocolStream()
}

function newPassTrough () {
  return new PassThrough({ objectMode: true })
}

function newTransform () {
  const result = new Transform({ objectMode: true })
  return result
}

function duplexify (readable, writable) {
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

function newLocalSubscriptionChannel (callback) {
  const result = newTransform()
  result._transform = (d, _, next) => {
    callback(d.m)
    next()
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

function newWrapper (topic) {
  const result = new Transform({ objectMode: true })
  result._transform = (message, _, next) => {
    result.push({ t: topic, o: message[1], m: message[0] })
    next()
  }
  return result
}

module.exports = {
  duplexify,
  newDecoder,
  newEncoder,
  newPassTrough,
  newReadable,
  newWritable,
  newDuplex,
  newTransform,
  newWrapper,
  newLocalSubscriptionChannel
}
