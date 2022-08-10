'use strict'
module.exports = {
  funcWithResult: (a) => a,
  funcWithProgress: (onProgress) => {
    onProgress('done')
  },
  functWithoutResult: () => { },
  functThatThrows: () => { throw new Error('some error') },
  asyncFunc: (a, delay) => (new Promise(resolve => {
    setTimeout(() => resolve(a), delay)
  })),
  cancellableFunc: async (onProgress, isCancelled) => {
    let cancelled = false
    while (!cancelled) {
      await (new Promise(resolve => {
        setTimeout(() => resolve(), 100)
      }))
      cancelled = isCancelled()
      if (cancelled) {
        return
      }
    }
  }
}
