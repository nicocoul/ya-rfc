const { newDummyChannel } = require('../common')
const yac = require('ya-common')
const { COMMANDS } = yac.constants
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
    expect(data).toBeDefined()
    expect(data.c).toStrictEqual(COMMANDS.RPC_EXECUTE)
    expect(data.id).toBeDefined()
    expect(data.procedure).toStrictEqual('someFunction')
    expect(data.withStatus).toStrictEqual(false)
    expect(data.withProgress).toStrictEqual(false)
    expect(data.args).toStrictEqual([1, 2])
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
    expect(data.c).toStrictEqual(COMMANDS.RPC_EXECUTE)
    expect(data.id).toBeDefined()
    expect(data.procedure).toStrictEqual('someFunction')
    expect(data.withStatus).toStrictEqual(false)
    expect(data.withProgress).toStrictEqual(true)
    expect(data.args).toStrictEqual([1, 2])
  })
  test('sends command with option onStatus', () => {
    const channel = newDummyChannel()
    const client = rpc.create(channel)
    let data
    channel.remote.readable.on('data', d => {
      data = d
    })
    client.remote.someFunction(1, 2, { onStatus: () => {} })
    client.kill()
    expect(data).toBeDefined()
    expect(data.c).toStrictEqual(COMMANDS.RPC_EXECUTE)
    expect(data.id).toBeDefined()
    expect(data.procedure).toStrictEqual('someFunction')
    expect(data.withStatus).toStrictEqual(true)
    expect(data.withProgress).toStrictEqual(false)
    expect(data.args).toStrictEqual([1, 2])
  })
  test('sends command with options onProgress & onStatus', () => {
    const channel = newDummyChannel()
    const client = rpc.create(channel)
    let data
    channel.remote.readable.on('data', d => {
      data = d
    })
    client.remote.someFunction(1, 2, { onStatus: () => {}, onProgress: () => {} })
    client.kill()
    expect(data).toBeDefined()
    expect(data.c).toStrictEqual(COMMANDS.RPC_EXECUTE)
    expect(data.id).toBeDefined()
    expect(data.procedure).toStrictEqual('someFunction')
    expect(data.withStatus).toStrictEqual(true)
    expect(data.withProgress).toStrictEqual(true)
    expect(data.args).toStrictEqual([1, 2])
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
    expect(data.c).toStrictEqual(COMMANDS.RPC_EXECUTE)
    expect(data.id).toBeDefined()
    expect(data.procedure).toStrictEqual('someFunction')
    expect(data.withStatus).toStrictEqual(true)
    expect(data.withProgress).toStrictEqual(true)
    expect(data.args).toStrictEqual([])
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
    expect(data.c).toStrictEqual(COMMANDS.RPC_EXECUTE)
    expect(data.id).toBeDefined()
    expect(data.procedure).toStrictEqual('someFunction')
    expect(data.withStatus).toStrictEqual(false)
    expect(data.withProgress).toStrictEqual(false)
    expect(data.args).toStrictEqual([{ foo: 'bar' }])
  })
})
