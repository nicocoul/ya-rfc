const path = require('path')
const { pause, newDummyChannel } = require('../common')
const { COMMANDS } = require('../../lib/constants')
const rpc = require('../../lib/clients/rpc-server')
const logger = require('../../lib/logger')(__filename)

const modulePath = path.join(__dirname, 'fixtures', 'rpc-module')

describe('Rcp server', () => {
  test('executes a function that returns a value', async () => {
    const channel = newDummyChannel()
    const server = rpc.create(channel, modulePath)
    let result
    let error
    channel.remote.readable.on('data', d => {
      if (d.result) {
        result = d
      }
      if (d.error) {
        error = d
      }
    })
    channel.remote.writable.write({ c: COMMANDS.RPC_EXECUTE, id: 1, procedure: 'funcWithResult', args: [10] })

    await pause(500)
    server.destroy()
    // channel.destroy()
    expect(result).toStrictEqual({ c: COMMANDS.RPC_EXECUTE, id: 1, result: 10 })
    expect(error).toBeUndefined()
  })

  test('reports an error when trying to execute a function does not exists', async () => {
    const channel = newDummyChannel()
    const server = rpc.create(channel, modulePath)
    let result
    let error
    channel.remote.readable.on('data', d => {
      if (d.result) {
        result = d
      }
      if (d.error) {
        error = d
      }
    })
    channel.remote.writable.write({ c: COMMANDS.RPC_EXECUTE, id: 1, procedure: 'no func', args: [10] })

    await pause(500)
    server.destroy()
    // channel.destroy()
    expect(result).toBeUndefined()
    expect(error).toBeDefined()
  })

  test('reports an error when trying to execute a function that throws', async () => {
    const channel = newDummyChannel()
    const server = rpc.create(channel, modulePath)
    let result
    let error
    channel.remote.readable.on('data', d => {
      if (d.result) {
        result = d
      }
      if (d.error) {
        error = d
      }
    })
    channel.remote.writable.write({ c: COMMANDS.RPC_EXECUTE, id: 1, procedure: 'functThatThrows', args: [10] })

    await pause(500)
    server.destroy()
    // channel.destroy()
    expect(result).toBeUndefined()
    expect(error).toBeDefined()
  })

  test('reports progression', async () => {
    const channel = newDummyChannel()
    const server = rpc.create(channel, modulePath)
    let result
    let error
    let progress
    channel.remote.readable.on('data', d => {
      logger.debug(JSON.stringify(d))
      if (d.result) {
        result = d
      }
      if (d.error) {
        error = d
      }
      if (d.progress) {
        progress = d
      }
    })
    channel.remote.writable.write({ c: COMMANDS.RPC_EXECUTE, id: 1, procedure: 'funcWithProgress' })

    await pause(500)
    server.destroy()
    // channel.destroy()
    expect(result).toBeDefined()
    expect(error).toBeUndefined()
    expect(progress).toBeDefined()
  })
})
