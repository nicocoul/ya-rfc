const { pause } = require('../common')
const { fork } = require('child_process')
const { NOTIFICATIONS } = require('../../lib/constants')
const path = require('path')

function createWorker () {
  const result = fork(path.join(__dirname, '..', '..', 'lib', 'clients', 'rpc-worker.js'))
  result.send({ modulePath: path.join(__dirname, '..', 'fixtures', 'rpc-module') })
  return result
}

describe('worker', () => {
  test('executes a function that returns a value', async () => {
    const worker = createWorker()
    let response
    worker.on('message', data => {
      response = data
    })
    worker.send({ id: 1, procedure: 'funcWithResult', args: [10] })
    await pause(500)
    worker.kill()
    expect(response.notification).toStrictEqual(NOTIFICATIONS.EXECUTED)
    expect(response.value).toStrictEqual(10)
  })

  test('executes an async function', async () => {
    const worker = createWorker()
    let response
    worker.on('message', data => {
      response = data
    })
    worker.send({ id: 1, procedure: 'asyncFunc', args: [10] })
    await pause(500)
    worker.kill()
    expect(response.notification).toStrictEqual(NOTIFICATIONS.EXECUTED)
    expect(response.value).toStrictEqual(10)
  })

  test('executes a function that does not return a value', async () => {
    const worker = createWorker()
    let response
    worker.on('message', data => {
      response = data
    })
    worker.send({ id: 1, procedure: 'functWithoutResult', args: [10] })
    await pause(500)
    worker.kill()
    expect(response.notification).toStrictEqual(NOTIFICATIONS.EXECUTED)
    expect(response.value).toBeUndefined()
  })

  test('reports an error when trying to execute a function does not exists', async () => {
    const worker = createWorker()
    let response
    worker.on('message', data => {
      response = data
    })
    worker.send({ id: 1, procedure: 'non existing function', args: [10] })
    await pause(500)
    worker.kill()
    expect(response.notification).toStrictEqual(NOTIFICATIONS.FAILED)
    expect(response.value).toBeDefined()
  })

  test('reports an error when trying to execute a function that throws', async () => {
    const worker = createWorker()
    let response
    worker.on('message', data => {
      response = data
    })
    worker.send({ id: 1, procedure: 'functThatThrows', args: [10] })
    await pause(500)
    worker.kill()
    expect(response.notification).toStrictEqual(NOTIFICATIONS.FAILED)
    expect(response.value).toBeDefined()
  })

  test('reports progression', async () => {
    const worker = createWorker()
    const responses = []
    worker.on('message', data => {
      responses.push(data)
    })
    worker.send({ id: 1, procedure: 'funcWithProgress' })
    await pause(500)
    worker.kill()
    expect(responses.length).toStrictEqual(3)
  })
})
