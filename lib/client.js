'use strict'

const net = require('net')
const { newChannel, newEncoder, newDecoder, newPassTrough } = require('./common.js')
const logger = require('./logger')(__filename)

function newClient (serverHost, serverPort, reconnectDelay = 100) {
  const reader = newPassTrough()
  const writer = newPassTrough()
  const encoder = newEncoder()
  const decoder = newDecoder()
  const channel = newChannel(reader, writer)
  let reconnectTimeout
  let socket
  let destroyed = false

  const address = { host: undefined, port: undefined }

  const connect = (host, port) => {
    logger.debug(`connect to ${host} ${port}`)
    socket = new net.Socket()
    socket.setNoDelay()
    socket.on('connect', () => {
      address.host = socket.localAddress
      address.port = socket.localPort
      logger.info(`client ${address.host} ${address.port} connected to ${host} ${port}`)
      socket.pipe(decoder).pipe(reader)
      writer.pipe(encoder).pipe(socket)
      channel.emit('connect')
    })
    socket.on('error', (error) => {
      logger.error(error.stack)
    })
    socket.on('close', () => {
      logger.info(`client ${address.host} ${address.port} disconnected from ${host} ${port}`)
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
  newClient
}
