const { pause } = require('../common')
const { fork } = require('child_process')
const path = require('path')

function createWorker () {
  const result = fork(path.join(__dirname, '..', '..', 'lib', 'clients', 'rpc-worker.js'))
  result.send({ modulePath: path.join(__dirname, 'fixtures', 'rpc-module') })
  return result
}

describe('Rpc Worker', () => {
  test('executes a function that returns a value', async () => {
    const worker = createWorker()
    let result
    let error
    worker.on('message', data => {
      if (data.result) {
        result = data.result
      }
      if (data.error) {
        result = data.error
      }
    })
    worker.send({ id: 1, procedure: 'funcWithResult', args: [10] })
    await pause(1000)
    worker.kill('SIGINT')
    expect(result).toStrictEqual(10)
    expect(error).toBeUndefined()
  })

  test('executes an async function', async () => {
    const worker = createWorker()
    let result
    let error
    worker.on('message', data => {
      if (data.result) {
        result = data.result
      }
      if (data.error) {
        result = data.error
      }
    })
    worker.send({ id: 1, procedure: 'asyncFunc', args: [10] })
    await pause(2000)
    worker.kill('SIGINT')
    expect(error).toBeUndefined()
    expect(result).toStrictEqual(10)
  })

  test('executes a function that does not return a value', async () => {
    const worker = createWorker()
    let result = 'dummy'
    let error
    worker.on('message', data => {
      if (data.result) {
        result = data.result
      }
      if (data.error) {
        result = data.error
      }
    })
    worker.send({ id: 1, procedure: 'functWithoutResult', args: [10] })
    await pause(2000)
    worker.kill('SIGINT')
    expect(error).toBeUndefined()
    expect(result).toStrictEqual('null')
  })

  test('reports an error when trying to execute a function does not exists', async () => {
    const worker = createWorker()
    let error
    worker.on('message', data => {
      if (data.error) {
        error = data.error
      }
    })
    worker.send({ id: 1, procedure: 'non existing function', args: [10] })
    await pause(2000)
    worker.kill('SIGINT')
    expect(error).toBeDefined()
  })

  test('reports an error when trying to execute a function that throws', async () => {
    const worker = createWorker()
    let error
    worker.on('message', data => {
      if (data.error) {
        error = data.error
      }
    })
    worker.send({ id: 1, procedure: 'functThatThrows', args: [10] })
    await pause(2000)
    worker.kill('SIGINT')
    expect(error).toBeDefined()
  })

  test('reports progression', async () => {
    const worker = createWorker()
    let error
    let result
    let progress
    worker.on('message', data => {
      if (data.error) {
        error = data.error
      }
      if (data.progress) {
        progress = data.progress
      }
      if (data.result) {
        result = data.result
      }
    })
    worker.send({ id: 1, procedure: 'funcWithProgress' })
    await pause(2000)
    worker.kill('SIGINT')
    expect(error).toBeUndefined()
    expect(result).toBeDefined()
    expect(progress).toBeDefined()
  })
})
