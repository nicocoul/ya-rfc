const path = require('path')
const { pause, newDummyChannel } = require('../common')
const { COMMANDS, NOTIFICATIONS } = require('../../lib/constants')
const rpc = require('../../lib/clients/rpc-server')

const modulePath = path.join(__dirname, '..', 'fixtures', 'rpc-module')

describe('server', () => {
  test('executes a function that returns a value', async () => {
    const channel = newDummyChannel()
    const server = rpc.create(channel, modulePath, { workers: 1 })
    let response
    channel.remote.readable.on('data', message => {
      response = message
    })
    channel.remote.writable.write({ c: COMMANDS.EXECUTE, id: 1, cn: 'some', pr: 'funcWithResult', ar: [10], l: 1 })

    await pause(500)

    server.kill()
    expect(response.sn).toBeDefined()
    delete response.sn
    expect(response).toStrictEqual({ c: NOTIFICATIONS.EXECUTED, id: 1, cn: 'some', pr: 'funcWithResult', ar: [10], v: 10, l: 1 })
  })

  test('executes multiple', async () => {
    const channel = newDummyChannel()
    const server = rpc.create(channel, modulePath, { workers: 1 })
    const response = []
    channel.remote.readable.on('data', message => {
      response.push(message)
    })
    for (let i = 0; i < 100; i++) {
      channel.remote.writable.write({ c: COMMANDS.EXECUTE, id: i, pr: 'funcWithResult', ar: [i], sn: 'some', l: 1 })
    }
    await pause(1000)

    server.kill()
    expect(response.length).toStrictEqual(100)
  })

  test('reports an error when trying to execute a function does not exists', async () => {
    const channel = newDummyChannel()
    const server = rpc.create(channel, modulePath, { workers: 1 })
    let response
    channel.remote.readable.on('data', message => {
      response = message
    })
    channel.remote.writable.write({ c: COMMANDS.EXECUTE, id: 1, pr: 'no func', ar: [10], cn: 'some', l: 1 })

    await pause(500)

    server.kill()
    expect(response.c).toStrictEqual(NOTIFICATIONS.FAILED)
  })

  test('reports an error when trying to execute a function that throws', async () => {
    const channel = newDummyChannel()
    const server = rpc.create(channel, modulePath, { workers: 1 })
    let response
    channel.remote.readable.on('data', message => {
      response = message
    })
    channel.remote.writable.write({ c: COMMANDS.EXECUTE, id: 1, pr: 'functThatThrows', ar: [10], cn: 'some', l: 1 })

    await pause(500)

    server.kill()
    expect(response.c).toStrictEqual(NOTIFICATIONS.FAILED)
    expect(response.v[0]).toStrictEqual('ERROR_MESSAGE')
  })

  test('reports progression', async () => {
    const channel = newDummyChannel()
    const server = rpc.create(channel, modulePath, { workers: 1 })
    const response = []
    channel.remote.readable.on('data', message => {
      response.push(message)
    })
    channel.remote.writable.write({ c: COMMANDS.EXECUTE, id: 1, pr: 'funcWithProgress', cn: 'some', l: 1 })

    await pause(500)

    server.kill()
    expect(response.length).toStrictEqual(3)
    expect(response[0].v).toStrictEqual(1)
    expect(response[1].v).toStrictEqual(2)
  })
})
