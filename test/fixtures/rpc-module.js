'use strict'
module.exports = {
  funcWithResult: (a) => a,
  funcWithProgress: (onProgress) => {
    onProgress(1)
    onProgress(2)
  },
  functWithoutResult: () => { },
  functThatThrows: () => {
    const err = new Error('ERROR_MESSAGE')
    err.code = 'ERROR_CODE'
    throw err
  },
  asyncFunc: (a, delay) => {
    return new Promise(resolve => {
      setTimeout(() => resolve(a), delay)
    })
  }
}
