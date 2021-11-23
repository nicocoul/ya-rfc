const path = require('path')
const { pause, newDummyChannel } = require('../common')
const { duplexify } = require('../../lib/common')
const { COMMANDS } = require('../../lib/constants')
const rpcBroker = require('../../lib/brokers/rpc')
const rpcServer = require('../../lib/clients/rpc-server')

function newRpcServer (channel) {
  return rpcServer.create(channel, path.join(__dirname, 'fixtures', 'rpc-module'))
}

describe('Rpc broker', () => {
  test('executes a function when 1 server', async () => {
    const channelServer = newDummyChannel()
    const server = newRpcServer(channelServer)
    const broker = rpcBroker.create()
    const channelBroker = duplexify(channelServer.remote.readable, channelServer.remote.writable)
    broker.plug(channelBroker)
    const received = []
    channelBroker.on('data', data => {
      received.push(data)
    })
    channelBroker.write({ c: COMMANDS.RPC_EXECUTE, id: 1, procedure: 'funcWithResult', args: [10] })
    await pause(200)
    server.destroy()
    expect(received.find(r => r.result !== undefined)).toStrictEqual({ c: COMMANDS.RPC_EXECUTE, id: 1, result: 10 })
    expect(received.find(r => r.error !== undefined)).toBeUndefined()
  })

  // test('executes a function when 2 servers', async () => {
  //   const channelServer = newDummyChannel()
  //   const server1 = newRpcServer(channelServer)
  //   const server2 = newRpcServer(channelServer)
  //   const broker = rpcBroker.create()
  //   const channelBroker = duplexify(channelServer.remote.readable, channelServer.remote.writable)
  //   broker.plug(channelBroker)
  //   const received = []
  //   channelBroker.on('data', data => {
  //     received.push(data)
  //   })
  //   channelBroker.write({ c: COMMANDS.RPC_EXECUTE, id: 1, procedure: 'funcWithResult', args: [10] })
  //   await pause(200)
  //   server1.destroy()
  //   server2.destroy()
  //   expect(received.find(r => r.result !== undefined)).toStrictEqual({ c: COMMANDS.RPC_EXECUTE, id: 1, result: 10 })
  //   expect(received.find(r => r.error !== undefined)).toBeUndefined()
  // })

  // test('routes execution requests according affinity', async () => {
  //   const channelServer = newDummyChannel()
  //   const server1 = newRpcServer(channelServer, { affinity: 'aff' })
  //   const server2 = newRpcServer(channelServer)
  //   const broker = rpcBroker.create()
  //   const channelBroker = duplexify(channelServer.remote.readable, channelServer.remote.writable)
  //   broker.plug(channelBroker)
  //   const received = []
  //   channelBroker.on('data', data => {
  //     received.push(data)
  //   })
  //   channelBroker.write({ c: COMMANDS.RPC_EXECUTE, id: 1, procedure: 'funcWithResult', args: [10] })
  //   await pause(200)
  //   server1.destroy()
  //   server2.destroy()
  //   expect(received.find(r => r.result !== undefined)).toStrictEqual({ c: COMMANDS.RPC_EXECUTE, id: 1, result: 10 })
  //   expect(received.find(r => r.error !== undefined)).toBeUndefined()
  // })
})
