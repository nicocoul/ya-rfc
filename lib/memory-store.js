'use strict'

const DEFAULT_CACHE_TIME = 60 * 60 * 1000 // 1 hour

const { newTransform, newReadable } = require('./common.js')
const logger = require('./logger')(__filename)

function newTopic(name, cacheTime = DEFAULT_CACHE_TIME, initialOffset = 0) {
    logger.debug(`newTopic ${name} initialOffset=${initialOffset} cacheTime=${cacheTime}ms`)
    const messages = []
    let removed = initialOffset
    let offset = initialOffset
    let rid = 0
    const purge = (nowMs) => {
        const ms = nowMs - cacheTime
        while (messages[0][1] < ms) {
            const purged = messages.shift()
            logger.debug(`removed from ${name} message ${JSON.stringify(purged)}`)
            removed++
        }
    }
    const result = newTransform()

    result._transform = (message, _, next) => {
        // logger.debug(`_transform ${JSON.stringify(message)}`)
        const nowMs = new Date().getTime()
        messages.push([message, nowMs, offset])
        result.push([message, nowMs, offset])
        offset++
        purge(nowMs)
        next()
    }
    const createReadStream = (fromOffset = 0) => {
        if (fromOffset < removed) {
            throw new Error(`cannot read from ${fromOffset} in topic ${name}, data was purged`)
        }
        rid++
        logger.debug(`createReadStream #${rid} for topic ${name} from offset ${fromOffset}`)
        const r = newReadable()
        let readOffset = -1
        messages.slice(fromOffset - removed).forEach(message => {
            logger.debug(`readStream ${name} #${rid} push ${JSON.stringify(message)}`)
            r.push(message[0])
            readOffset = message[2]
        })
        result.on('data', message => {
            logger.debug(`readStream ${name} #${rid} readOffset=${readOffset} on.data ${JSON.stringify(message)}`)
            if (message[2] > readOffset && message[2] >= fromOffset) {
                r.push(message[0])
            }
        })
        return r
    }
    result.createReadStream = createReadStream
    result.count = () => (removed + messages.length)
    result.firstReadableOffset = () => removed
    return result
}

function newStore(cacheTime) {

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