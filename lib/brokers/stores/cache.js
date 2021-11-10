'use strict'

const DEFAULT_CACHE_TIME = 60 * 60 * 1000 // 1 hour

const { newReadable } = require('../../common.js')
const logger = require('../../logger')(__filename)

function newTopic (name, cacheTime = DEFAULT_CACHE_TIME, initialOffset = 0) {
  logger.debug(`newTopic ${name} initialOffset=${initialOffset} cacheTime=${cacheTime}ms`)
  const messages = []
  let streamId = 0
  const streams = []
  let removed = 0
  let offset = initialOffset

  const purge = (nowMs) => {
    const ms = nowMs - cacheTime
    while (messages[0][2] < ms) {
      messages.shift()
      removed++
    }
  }
  function write (message) {
    // console.log('write', message)
    const nowMs = new Date().getTime()
    messages.push([message, offset, nowMs])
    offset++
    streams.forEach(rs => {
      rs.push([message, offset, nowMs])
    })
    purge(nowMs)
  }
  function unrefReadStream (rs) {
    const index = streams.findIndex(el => el.id === rs.id)
    if (index !== -1) {
      logger.debug(`unrefReadStream ${rs.id}`)
      streams.splice(index, 1)
      rs.removeAllListeners()
      rs.destroy()
    }
  }
  function createReadStream (fromOffset = 0) {
    if (fromOffset < removed) {
      throw new Error(`cannot read from ${fromOffset} in topic ${name}, data was purged`)
    }
    streamId++
    logger.debug(`createReadStream ${streamId} ${name} fromOffset=${fromOffset}`)
    const rs = newReadable()
    messages.slice(fromOffset - removed).forEach(message => {
      // console.log('push', message)
      rs.push(message)
    })
    rs.id = streamId
    streams.push(rs)
    return rs
  }
  return {
    unrefReadStream,
    createReadStream,
    write,
    firstReadableOffset: () => removed
  }
}

function newStore (cacheTime) {
  const topics = {}

  return {
    getTopicNames: () => {
      return Object.keys(topics)
    },
    exists: (topicName) => {
      return topics[topicName] !== undefined
    },
    get: (topicName) => {
      return topics[topicName]
    },
    set: (topicName, initialOffset) => {
      if (!topics[topicName]) {
        topics[topicName] = newTopic(topicName, cacheTime, initialOffset)
      }
    }
  }
}

module.exports = {
  newTopic,
  newStore
}
