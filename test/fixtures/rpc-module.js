'use strict'
module.exports = {
  funcWithResult: (a) => a,
  funcWithProgress: (onProgress) => {
    onProgress(1)
    onProgress(2)
  },
  functWithoutResult: () => { },
  functThatThrows: () => { throw new Error('some error') },
  asyncFunc: (a, delay) => {
    return new Promise(resolve => {
      setTimeout(() => resolve(a), delay)
    })
  }
}
