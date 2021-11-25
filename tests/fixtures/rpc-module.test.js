const {
  funcWithResult,
  asyncFunc,
  funcWithProgress,
  functWithoutResult,
  functThatThrows
} = require('./rpc-module')

describe('fixtures', () => {
  test('funcWithResult works', () => {
    expect(funcWithResult('x')).toStrictEqual('x')
  })
  test('asyncFunc works', async () => {
    expect(await asyncFunc('x')).toStrictEqual('x')
  })
  test('funcWithProgress works', async () => {
    let progress
    const callback = (data) => {
      progress = data
    }
    funcWithProgress(callback)
    expect(progress).toBeDefined()
  })
  test('functWithoutResult works', () => {
    expect(functWithoutResult('x')).toBeUndefined()
  })
  test('functThatThrows works', () => {
    expect(functThatThrows()).toThrow(TypeError)
  })
})
