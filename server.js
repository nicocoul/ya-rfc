const net = require('net')
const EventEmitter = require('events')
const { newChannel, newEncoder, newDecoder, newPassTrough  } = require('./common.js')
const logger = require('./logger')(__filename)

function newServer(port) {
  const result = new EventEmitter()
  const server = net.createServer((socket) => {
    const reader = new newPassTrough()
    const writer = new newPassTrough()
    const encoder = newEncoder()
    const decoder = newDecoder()
    const channel = newChannel(reader, writer)
    channel.id = `${socket.remoteAddress} ${socket.remotePort}`
    socket.pipe(decoder).pipe(reader)
    writer.pipe(encoder).pipe(socket)

    socket.on('error', error => {
      logger.error(`socket.on error ${socket.remoteAddress} ${socket.remotePort} ${error.stack}`)
    })
    socket.on('close', () => {
      // logger.info(`socket.on close ${socket.remoteAddress} ${socket.remotePort}`)
      decoder.unpipe(reader)
      writer.unpipe(encoder)
      result.emit('lost-client', channel)
    })
    result.emit('new-client', channel)
  })
  server.on('error', (err) => {
    logger.error(`server.on ${port} error ${err.stack}`)
  })
  server.on('close', () => {
    logger.info(`server.on ${port} close`)
  })
  server.on('connection', (s) => {
  })
  server.listen(port, () => {
    logger.info(`server listening on ${port}`)
  })
  result.close = () => {
    logger.info(`closing server ${port}`)
    server.close()
  }
  return result
}

module.exports = { newServer }
