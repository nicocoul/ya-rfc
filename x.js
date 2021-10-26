

const path = require('path')
const fs = require('fs')
const { newEncoder, newDecoder } = require('./common.js')
const { PassThrough } = require('stream')
const logger = require('./logger')(__filename)

function* newIntGenerator(start = -1) {
    let val = start
    while (true) {
        val++
        yield val
    }
}

const topicPath = (topic) => {
    return `C:\\topics\\${topic}`
}

function newTopic(name, offset = -1) {
    const stream = new PassThrough({ objectMode: true })
    //const encoder = newEncoder()
    // const appendStream = createAppendStream(name, offset)
    //encoder.pipe(appendStream).pipe(stream, { end: false })
    const generator = newIntGenerator(offset)
    return {
        offset,
        generator,
        getStream: () => stream,
        write: (message) => {
            try {
                try {
                    fs.statSync(topicPath(topic))
                } catch (error) {
                    fs.mkdirSync(topicPath(topic))
                }
            } catch (error) {
                console.log(error.stack)
            }
        }
    }
}


module.exports = {
    newTopic
}