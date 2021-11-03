'use strict'

const { Transform } = require('stream')
// const logger = require('./logger')(__filename)

const headerLength = 6
const footerLength = 1

function encodeOne(obj) {
  const str = JSON.stringify(obj)
  const header = Buffer.from([0x01, 0x00, 0x00, 0x00, 0x00, 0x02])
  const body = Buffer.from(str, 'utf8')
  const footer = Buffer.from([0x03])

  header.writeUInt32BE(body.length, 1)

  return Buffer.concat([header, body, footer])
}

function decodeOne(bytes) {
  if ((bytes[0] !== 0x01) || (bytes[5] !== 0x02)) {
    console.error('Invalid frame header', bytes)
    throw new Error('Invalid frame header')
  }

  if (bytes[bytes.length - 1] !== 0x03) {
    throw new Error('Invalid frame footer')
  }

  return JSON.parse(bytes.slice(6,bytes.length - 1).toString('utf8'))
}

class DecodeProtocolStream extends Transform {
  constructor() {
    super({ objectMode: true })
    this._acc = Buffer.from([])
  }

  _transform(chunk, _, callback) {
    try {
      this._acc = Buffer.concat([this._acc, chunk])

      if ((this._acc[0] !== 0x01) || (this._acc[5] !== 0x02)) {
        // logger.error('Invalid frame header')
        callback(new Error('Invalid frame header'))
        return
      }

      while (this._acc.length > headerLength) {
        const messageLength = this._acc.readUInt32BE(1)
        const frameLength = headerLength + messageLength + footerLength

        if (this._acc.length >= frameLength) {
          if (this._acc[frameLength - 1] !== 0x03) {
            // logger.error('Invalid frame footer')
            callback(new Error('Invalid frame footer'))
            return
          }

          const message = JSON.parse(this._acc.toString('utf8', headerLength, messageLength + headerLength))
          this.push(message)

          this._acc = Buffer.from(this._acc.slice(frameLength))
        } else {
          // Message data is too short yet.
          break
        }
      }

      callback()
    } catch (error) {
      // logger.error(error.stack)
      callback(error)
    }
  }
}

class EncodeProtocolStream extends Transform {
  constructor() {
    super({ objectMode: true })
  }

  _transform(obj, _, callback) {
    this.push(encodeOne(obj))
    callback()
  }
}
/*
class JSONEncoder extends stream.Transform {
  constructor () {
    super({ objectMode: true })
  }

  _transform (object, _, callback) {
    this.push(JSON.stringify(object))
    callback()
  }
}

class JSONDecoder extends stream.Transform {
  constructor () {
    super({ objectMode: true })
  }

  _transform (str, encoding, callback) {
    this.push(JSON.parse(str))
    callback()
  }
}
*/

module.exports = {
  encodeOne,
  decodeOne,
  DecodeProtocolStream,
  EncodeProtocolStream,
}
