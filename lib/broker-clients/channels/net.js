'use strict'

const net = require('net')
const { duplexify, newEncoder, newDecoder, newPassTrough } = require('../../common.js')
const logger = require('../../logger')(__filename)

function create (serverHost, serverPort, reconnectDelay = 50) {
  logger.debug(`createChannel ${serverHost} ${serverPort} ${reconnectDelay}`)
  const reader = newPassTrough()
  const writer = newPassTrough()
  const encoder = newEncoder()
  const decoder = newDecoder()
  const channel = duplexify(reader, writer)
  let reconnectTimeout
  let socket
  let destroyed = false

  const connect = (host, port) => {
    logger.debug(`connect to ${host} ${port}`)
    socket = new net.Socket()
    socket.setNoDelay()
    socket.on('connect', () => {
      logger.debug(`channel ${socket.localAddress} ${socket.localPort} connected to ${host} ${port}`)
      socket.pipe(decoder).pipe(reader)
      writer.pipe(encoder).pipe(socket)
      channel.emit('connect', `${socket.localAddress}:${socket.localPort}>${host}:${port}`)
    })
    socket.on('error', (error) => {
      logger.error(`socket error ${error.stack}`)
    })
    socket.on('close', () => {
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
    socket.connect(port, host)
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
