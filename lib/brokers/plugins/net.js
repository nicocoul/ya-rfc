'use strict'

const EventEmitter = require('events')
const { duplexify, newPassTrough } = require('../../common.js')
const { newEncoder, newDecoder } = require('../../codecs/123')
const logger = require('../../logger')(__filename)

function create (server) {
  const result = new EventEmitter()
  server.on('connection', (socket) => {
    const reader = newPassTrough()
    const writer = newPassTrough()
    const encoder = newEncoder()
    const decoder = newDecoder()
    const channel = duplexify(reader, writer)
    channel.id = `net${socket.remoteAddress}:${socket.remotePort}`
    socket.pipe(decoder).pipe(reader)
    writer.pipe(encoder).pipe(socket)

    socket.on('error', error => {
      logger.error(`${socket.remoteAddress} ${socket.remotePort} ${error.stack}`)
    })
    socket.on('close', () => {
      decoder.unpipe(reader)
      writer.unpipe(encoder)
      result.emit('lost-channel', channel)
    })
    result.emit('new-channel', channel)
  })
  server.on('error', (error) => {
    logger.error(error.stack)
  })
  server.on('close', () => {
    logger.info('close')
  })
  result.destroy = () => {
    server.close()
  }
  return result
}

module.exports = { create }
