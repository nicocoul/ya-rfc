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
    channel.remote.writable.write({ c: COMMANDS.EXECUTE, id: 1, procedure: 'funcWithResult', args: [10], channelId: 'some', load: 1 })

    await pause(500)

    server.kill()
    expect(response).toStrictEqual({ c: NOTIFICATIONS.EXECUTED, channelId: 'some', id: 1, procedure: 'funcWithResult', value: 10, load: 1 })
  })

  test('executes multiple', async () => {
    const channel = newDummyChannel()
    const server = rpc.create(channel, modulePath, { workers: 1 })
    const response = []
    channel.remote.readable.on('data', message => {
      response.push(message)
    })
    for (let i = 0; i < 100; i++) {
      channel.remote.writable.write({ c: COMMANDS.EXECUTE, id: i, procedure: 'funcWithResult', args: [i], channelId: 'some', load: 1 })
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
    channel.remote.writable.write({ c: COMMANDS.EXECUTE, id: 1, procedure: 'no func', args: [10], channelId: 'some', load: 1 })

    await pause(500)

    server.kill()
    expect(response).toStrictEqual({ c: NOTIFICATIONS.FAILED, channelId: 'some', id: 1, procedure: 'no func', value: 'procedure no func not found', load: 1 })
  })

  test('reports an error when trying to execute a function that throws', async () => {
    const channel = newDummyChannel()
    const server = rpc.create(channel, modulePath, { workers: 1 })
    let response
    channel.remote.readable.on('data', message => {
      response = message
    })
    channel.remote.writable.write({ c: COMMANDS.EXECUTE, id: 1, procedure: 'functThatThrows', args: [10], channelId: 'some', load: 1 })

    await pause(500)

    server.kill()
    expect(response).toStrictEqual({ c: NOTIFICATIONS.FAILED, channelId: 'some', id: 1, procedure: 'functThatThrows', value: 'some error', load: 1 })
  })

  test('reports progression', async () => {
    const channel = newDummyChannel()
    const server = rpc.create(channel, modulePath, { workers: 1 })
    const response = []
    channel.remote.readable.on('data', message => {
      response.push(message)
    })
    channel.remote.writable.write({ c: COMMANDS.EXECUTE, id: 1, procedure: 'funcWithProgress', channelId: 'some', load: 1 })

    await pause(500)

    server.kill()
    expect(response).toStrictEqual(
      [
        { c: NOTIFICATIONS.PROGRESS, channelId: 'some', id: 1, procedure: 'funcWithProgress', value: 1, load: 1 },
        { c: NOTIFICATIONS.PROGRESS, channelId: 'some', id: 1, procedure: 'funcWithProgress', value: 2, load: 1 },
        { c: NOTIFICATIONS.EXECUTED, channelId: 'some', id: 1, procedure: 'funcWithProgress', value: undefined, load: 1 }]
    )
  })
})
