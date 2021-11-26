const { PassThrough } = require('stream')
const yac = require('ya-common')
const { duplexify } = yac.common
const { v4: uuidv4 } = require('uuid')

function delay (fun, time) {
  return new Promise((resolve, reject) => {
    return setTimeout(() => {
      fun()
      resolve()
    }, time)
  })
}

function newDummyChannel () {
  const pt1 = new PassThrough({ objectMode: true })
  const pt2 = new PassThrough({ objectMode: true })
  const result = duplexify(pt1, pt2)
  result.remote = {
    writable: pt1,
    readable: pt2
  }
  result.id = uuidv4()
  result.kill = () => {
    pt1.removeAllListeners()
    pt2.removeAllListeners()
    pt1.destroy()
    pt2.destroy()
    result.removeAllListeners()
    result.destroy()
  }
  return result
}

function pause (time) {
  return delay(() => { }, time)
}

module.exports = {
  delay,
  pause,
  newDummyChannel
}
