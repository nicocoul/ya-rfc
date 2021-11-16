'use strict'

const EventEmitter = require('events')
const { createWebSocketStream } = require('ws')
const { duplexify, newPassTrough } = require('../../common.js')
const { newEncoder, newDecoder } = require('../../codecs/ws.js')
const logger = require('../../logger')(__filename)

function create (wsServer) {
  const result = new EventEmitter()
  // wsServer._server.on('upgrade', (request, socket, head) => {
  //   if (request.headers.origin === 'yaps') {
  //     wsServer.handleUpgrade(request, socket, head, (ws) => {
  //       wsServer.emit('connection', ws, request)
  //     })
  //   }
  // })
  wsServer.on('connection', (ws, request) => {
    if (request.headers.origin !== 'yaps') return
    const wsDuplex = createWebSocketStream(ws, { encoding: 'utf8' })
    const reader = newPassTrough()
    const writer = newPassTrough()
    const encoder = newEncoder()
    const decoder = newDecoder()
    const channel = duplexify(reader, writer)
    channel.id = `ws ${ws._socket.remoteAddress} ${ws._socket.remotePort}`
    wsDuplex.pipe(decoder).pipe(reader)
    writer.pipe(encoder).pipe(wsDuplex)
    ws.on('error', error => {
      logger.error(error.stack)
    })
    ws.on('close', () => {
      decoder.unpipe(reader)
      writer.unpipe(encoder)
      result.emit('lost-channel', channel)
    })
    result.emit('new-channel', channel)
  })
  wsServer.on('error', (error) => {
    logger.error(error.stack)
  })
  wsServer.on('close', () => {
    logger.info('close')
  })
  return result
}

module.exports = { create }
