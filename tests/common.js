const { Readable, Writable } = require('stream')

function delay(fun, time) {
    return new Promise((resolve, reject) => {
        return setTimeout(() => {
            fun()
            resolve()
        }, time)
    })
}

function pause(time) {
    return delay(() => { }, time)
}

function newArrayReadable(array) {
    const a = [...array]
    const result = new Readable({ objectMode: true })
    result._read = () => {
        const el = a.shift()
        if (el !== undefined)
            result.push(el)
        else
            result.push(null)
    }
    return result
}

function newAccumulator() {
    const data = []
    const result = new Writable({ objectMode: true })
    result._write = (object, _, next) => {
        data.push(object)
        next()
    }
    result.data = () => {
        return data
    }
    return result
}

module.exports = {
    delay,
    pause,
    newArrayReadable,
    newAccumulator
}