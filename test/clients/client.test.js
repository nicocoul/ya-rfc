const { newDummyChannel } = require('../common')
const { COMMANDS } = require('../../lib/constants')
const f = require('../../lib/factories')
const rpc = require('../../lib/clients/rpc-client')

describe('client.remote', () => {
  test('sends command', () => {
    const channel = newDummyChannel()
    const client = rpc.create(channel)
    let data
    channel.remote.readable.on('data', d => {
      data = d
    })
    client.remote.someFunction(1, 2)
    client.kill()
    expect(data.c).toStrictEqual(COMMANDS.EXECUTE)
    expect(data.id).toBeDefined()
    expect(data.pr).toStrictEqual('someFunction')
    expect(data.ar).toStrictEqual([1, 2])
  })

  test('sends command with option onProgress', async () => {
    const channel = newDummyChannel()
    const client = rpc.create(channel)
    let data
    channel.remote.readable.on('data', d => {
      data = d
    })
    client.remote.someFunction(1, 2, { onProgress: () => {} })
    client.kill()
    expect(data).toBeDefined()
    expect(data.c).toStrictEqual(COMMANDS.EXECUTE)
    expect(data.id).toBeDefined()
    expect(data.pr).toStrictEqual('someFunction')
    expect(data.ar).toStrictEqual([1, 2])
  })

  test('sends command with options onProgress', () => {
    const channel = newDummyChannel()
    const client = rpc.create(channel)
    let data
    channel.remote.readable.on('data', d => {
      data = d
    })
    client.remote.someFunction(1, 2, { onStatus: () => {}, onProgress: () => {} })
    client.kill()
    expect(data).toBeDefined()
    expect(data.c).toStrictEqual(COMMANDS.EXECUTE)
    expect(data.id).toBeDefined()
    expect(data.pr).toStrictEqual('someFunction')
    expect(data.ar).toStrictEqual([1, 2])
  })

  test('sends command with no arguments', () => {
    const channel = newDummyChannel()
    const client = rpc.create(channel)
    let data
    channel.remote.readable.on('data', d => {
      data = d
    })
    client.remote.someFunction({ onStatus: () => {}, onProgress: () => {} })
    client.kill()
    expect(data).toBeDefined()
    expect(data.c).toStrictEqual(COMMANDS.EXECUTE)
    expect(data.id).toBeDefined()
    expect(data.pr).toStrictEqual('someFunction')
    expect(data.ar).toStrictEqual([])
  })

  test('sends command with an oject argument', () => {
    const channel = newDummyChannel()
    const client = rpc.create(channel)
    let data
    channel.remote.readable.on('data', d => {
      data = d
    })
    client.remote.someFunction({ foo: 'bar' })
    client.kill()
    expect(data).toBeDefined()
    expect(data.c).toStrictEqual(COMMANDS.EXECUTE)
    expect(data.id).toBeDefined()
    expect(data.pr).toStrictEqual('someFunction')
    expect(data.ar).toStrictEqual([{ foo: 'bar' }])
  })
})
