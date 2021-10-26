

const path = require('path')
const fs = require('fs')
const { newDecoder, newReadable, newDuplex } = require('./common.js')
const { PassThrough } = require('stream')
const { EventEmitter } = require('events')
const { encodeOne, decodeOne } = require('./serde')
const logger = require('./logger')(__filename)

const blobName = (beginningOffset, count) => {
    return `${beginningOffset}-${beginningOffset + count}.top`
}

function createBlobAppender(filePath, maxBlocks, initialBlocks = 0) {
    const result = new EventEmitter()
    const buffer = []
    //const filePath = path.join(dir, blobName(firstOffset, count))
    let ready = false
    let mayWrite = false
    let writtenBlocks = 0
    const ws = fs.createWriteStream(filePath, { flags: 'a' })
    ws.on('ready', () => {
        ready = true
        flush()
    })
    ws.on('error', error => {
        logger.error(error.stack)
        result.emit('error', error)
    })
    const flush = () => {
        if (!ready || !mayWrite) return
        let data = buffer.shift()
        if (data === undefined) return
        ws.write(data[0], (err) => {
            if (err) {
                result.emit('error', err)
                return
            }
            writtenBlocks++
            const blocks = initialBlocks + writtenBlocks
            if (blocks > maxBlocks) return
            result.emit('data', data)
            flush()
            if (blocks === maxBlocks) {
                // logger.debug(`destroy ws ${blocks}`)
                ws.destroy()
                result.emit('close')
            }
        })
    }
    const write = (data) => {
        buffer.push(data)
        flush()
    }
    result.write = write
    result.flush = () => {
        mayWrite = true
        flush()
    }
    result.destroy = () => {
        result.removeAllListeners()
        buffer.length = 0
        !ws.destroyed && ws.destroy()
    }
    return result
}

function createTopicWriter(dirPath, blocksPerBlob, initialCount) {
    const result = new EventEmitter()
    const bas = {}
    let scheduled = 0
    const write = (obj) => {
        // logger.debug(`schedule ${JSON.stringify(obj)}`)
        const count = initialCount + scheduled
        const id = parseInt(count / blocksPerBlob)
        // logger.debug(`initialOffset=${initialOffset} id=${id} ${JSON.stringify(obj)}`)
        if (!bas[id]) {
            const name = blobName(id * blocksPerBlob, blocksPerBlob)
            const ba = createBlobAppender(path.join(dirPath, name), blocksPerBlob, count % blocksPerBlob)
            // logger.debug(`appender create ${dirPath} ${name}`)
            if (Object.keys(bas).length === 0) {
                ba.flush()
            }
            ba.on('data', (data) => {
                // logger.debug(`appender data ${dirPath} ${name} ${data}`)
                result.emit('data', data[1])
            })
            ba.on('close', () => {
                // logger.debug(`appender close ${dirPath} ${name}`)
                if (bas[id + 1]) {
                    bas[id + 1].flush()
                }
                bas[id].destroy()
                delete bas[id]
            })
            ba.on('error', (err) => {
                logger.error(err.stack)
                result.emit('error', err)
            })
            bas[id] = ba
        }
        bas[id].write([encodeOne(obj), obj])
        scheduled++

    }
    result.write = write
    result.destroy = () => {
        result.removeAllListeners()
        Object.values(bas).forEach(ba => ba.destroy())
    }
    return result
}

function createTopicReader(dirPath, blocksPerBlob, fromOffset = 0, toOffset) {
    logger.debug(`createTopicReader ${dirPath} ${blocksPerBlob} fromOffset=${fromOffset}`)
    const createBlobReader = (file) => {
        try {
            fs.statSync(file)
            return fs.createReadStream(file)
        } catch (error) {
            // logger.error(error.stack)
            return
        }
    }

    const read = (offset, targetStream) => {
        const bid = parseInt(offset / blocksPerBlob)
        const filePath = path.join(dirPath, blobName(bid * blocksPerBlob, blocksPerBlob))
        // logger.debug(`reading from ${filePath}`)
        const readStream = createBlobReader(filePath)
        if (!readStream) {
            targetStream.destroy()
            return
        }
        // logger.debug(`reading from ${readStream.path}`)
        const decoder = newDecoder()
        readStream.on('close', () => {
            readStream.destroy()
            decoder.destroy()
            read(offset + blocksPerBlob, targetStream)
        })
        readStream.pipe(decoder).pipe(targetStream, { end: false })
    }

    const filter = new PassThrough({ objectMode: true })
    const result = newReadable()
    let readOffset = parseInt(fromOffset / blocksPerBlob) * blocksPerBlob
    filter.on('data', (data) => {
        // logger.debug(`read ${JSON.stringify(data)}`)
        if (readOffset >= fromOffset) {
            if (!toOffset || readOffset < toOffset) {
                logger.debug(`reading ${JSON.stringify(data)}`)
                result.push(data)
            } else {
                filter.destroy()
                logger.debug(`skipping 1 ${JSON.stringify(data)} ${readOffset} ${toOffset}`)
            }
        } else {
            logger.debug(`skipping 2 ${JSON.stringify(data)} ${readOffset} ${toOffset}`)
        }
        readOffset++
    })
    filter.on('close', () => {
        // logger.debug(`destroyed`)
        filter.destroy()
        result.destroy()
    })
    read(fromOffset, filter)
    return result
}

function countBlocks(dirPath, blocksPerBlob) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
        .map(e => {
            if (!e.isFile()) return
            if (!e.name.endsWith('.top')) return
            const splits = e.name.split('.')[0].split('-')
            if (splits.length !== 2) return
            const start = parseInt(splits[0])
            if (start === NaN) return
            const end = parseInt(splits[1])
            if (end === NaN) return
            if (end !== start + blocksPerBlob) return
            return { start, end, name: e.name }
        })
        .filter(e => e !== undefined)

    if (entries.length) {
        const last = entries.reduce((max, entry) => (entry.start > max.start ? entry : max), { start: -1 })
        let cnt = 0
        const bytes = fs.readFileSync(path.join(dirPath, last.name))
        const decoder = newDecoder()
        decoder.write(bytes)
        while (decoder.read()) cnt++
        return last.start + cnt
    } else {
        return 0
    }
}

function newTopic(dir, name, messagesPerFile = 1000) {
    try {
        fs.statSync(path.join(dir, name))
    } catch (error) {
        fs.mkdirSync(path.join(dir, name))
    }
    let count = countBlocks(path.join(dir, name), messagesPerFile)
    // logger.debug(`topic '${name}' count is ${count}`)
    const topicWriter = createTopicWriter(path.join(dir, name), messagesPerFile, count)
    const result = newDuplex()
    result._write = (obj, _, next) => {
        topicWriter.write(obj)
        next()
    }
    topicWriter.on('error', error => {
        // TODO: prevent for continuing writing
        topicWriter.destroy()
        logger.error(error.stack)
        result.emit('error', error)
    })

    topicWriter.on('data', (data) => {
        result.push(data)
        count++
    })

    result.createReadStream = (fromOffset = 0, toOffset) => (createTopicReader(path.join(dir, name), messagesPerFile, fromOffset, toOffset))
    result.count = () => (count)
    result.destroy = () => {
        topicWriter.destroy()
    }
    return result
}

function newStore(dir, messagesPerFile) {
    const topicNames = fs.readdirSync(dir, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => path.parse(entry.name).name)

    const topics = topicNames.reduce((acc, topic) => {
        acc[topic] = newTopic(dir, topic, messagesPerFile)
        return acc
    }, {})

    return {
        getTopicNames: () => {
            return Object.keys(topics)
        },
        get: (topicName) => {
            if (!topics[topicName]) {
                topics[topicName] = newTopic(dir, topicName, messagesPerFile)
            }
            return topics[topicName]
        },
        destroy: () => {
            Object.values(topics).forEach(topic => {
                topic.destroy()
            })
        }
    }
}

module.exports = {
    newStore,
    createBlobAppender,
    createTopicWriter,
    countBlocks,
    newTopic
}