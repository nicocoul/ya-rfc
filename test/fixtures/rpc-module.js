'use strict'
module.exports = {
  funcWithResult: (a) => a,
  funcWithProgress: (onProgress) => {
    onProgress('done')
  },
  functWithoutResult: () => { },
  functThatThrows: () => { throw new Error('some error') },
  asyncFunc: (a) => (new Promise(resolve => resolve(a)))
}
