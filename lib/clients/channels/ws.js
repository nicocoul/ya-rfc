'use strict'

const WebSocket = require('ws')
const { createWebSocketStream } = require('ws')
const { duplexify, newPassTrough } = require('../../common.js')
const { newEncoder, newDecoder } = require('../../codecs/ws')
const logger = require('../../logger')(__filename)

function create (serverHost, serverPort, ssl = false, reconnectDelay = 50) {
  logger.debug(`create ${serverHost} ${serverPort} ssl=${ssl} ${reconnectDelay}`)

  const reader = newPassTrough()
  const writer = newPassTrough()
  const encoder = newEncoder()
  const decoder = newDecoder()
  const channel = duplexify(reader, writer)
  let reconnectTimeout
  let socket
  let destroyed = false

  const connect = (host, port) => {
    const address = `${ssl ? 'wss' : 'ws'}://${serverHost}:${serverPort}/`
    logger.debug(`connect to ${serverHost} ${serverPort}`)
    // TODO: purpose of origin?
    const ws = new WebSocket(address, { origin: 'yaps' })

    const socket = createWebSocketStream(ws, { encoding: 'utf8' })
    ws.on('open', () => {
      logger.debug(`channel ${socket.localAddress} ${socket.localPort} connected to ${serverHost} ${port}`)
      socket.pipe(decoder).pipe(reader)
      writer.pipe(encoder).pipe(socket)
      channel.emit('connect', `${socket.localAddress}:${socket.localPort}>${serverHost}:${port}`)
    })
    ws.on('error', (error) => {
      logger.error(`socket error ${error.stack}`)
    })
    ws.on('close', () => {
      channel.emit('close')
      logger.debug(`channel ${socket.localAddress} ${socket.localPort} disconnected from ${host} ${port}`)
      decoder.unpipe(reader)
      writer.unpipe(encoder)
      socket.destroy()
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (!destroyed) {
        reconnectTimeout = setTimeout(() => {
          logger.debug(`reconnecting to ${host} ${port}`)
          connect(host, port)
        }, reconnectDelay)
      }
    })
  }

  connect(serverHost, serverPort)
  channel.destroy = () => {
    if (reconnectTimeout) clearTimeout(reconnectTimeout)
    socket.destroy()
    destroyed = true
  }
  return channel
}

module.exports = {
  create
}
