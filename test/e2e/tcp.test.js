const path = require('path')
const net = require('net')
const { pause } = require('../common')
const rpcBroker = require('../../lib/brokers/rpc')
const rpcServer = require('../../lib/clients/rpc-server')
const rpcClient = require('../../lib/clients/rpc-client')
const { EVENTS } = require('../../lib/constants')
const yac = require('ya-common')
const netPlugin = yac.plugins.net
const netChannel = yac.channels.net

function newServer (port, options) {
  const channel = netChannel({ host: 'localhost', port })
  return rpcServer.create(channel, path.join(__dirname, '..', 'fixtures', 'rpc-module'), options)
}

function newClient (port, reconnectDelay = 50, reconnectAttemps = 5) {
  const channel = netChannel({ host: 'localhost', port }, reconnectDelay, reconnectAttemps)
  return rpcClient.create(channel)
}

function newBroker (port) {
  const server = net.Server()
  const plugin = netPlugin(server)
  const result = rpcBroker.create()
  server.listen(port)
  result.plug(plugin)
  return result
}
function aggrEvents (emitter) {
  const evs = [EVENTS.SCHEDULE, EVENTS.EXECUTE, EVENTS.EXECUTED, EVENTS.FAILED, EVENTS.CANCELLED]
  const result = evs.reduce((acc, current) => {
    acc[current] = 0
    return acc
  }, {})
  evs.forEach(e => {
    emitter.events.on(e, () => {
      result[e]++
    })
  })
  return result
}
async function output (promise) {
  try {
    return { result: (await promise), error: undefined }
  } catch (error) {
    return { result: undefined, error }
  }
}
const PORT = 8002
describe('TCP stack', () => {

  test('executes a function that has a return value', async () => {
    const server = newServer(PORT, { workers: 1 })
    const broker = newBroker(PORT)
    const client = newClient(PORT)
    const events = [aggrEvents(client), aggrEvents(broker), aggrEvents(server)]

    const out = await output(client.remote.funcWithResult(10))

    server.kill()
    broker.kill()
    client.kill()
    expect(out).toStrictEqual({ result: 10, error: undefined })
    expect(events).toStrictEqual([
      { schedule: 1, execute: 1, executed: 1, failed: 0, cancelled: 0 },
      { schedule: 1, execute: 1, executed: 1, failed: 0, cancelled: 0 },
      { schedule: 1, execute: 1, executed: 1, failed: 0, cancelled: 0 }
    ])
  })

  test('executes a function that has no return value', async () => {
    const server = newServer(PORT, { workers: 1 })
    const broker = newBroker(PORT)
    const client = newClient(PORT)
    const events = [aggrEvents(client), aggrEvents(broker), aggrEvents(server)]

    const out = await output(client.remote.functWithoutResult(10))
    server.kill()
    broker.kill()
    client.kill()

    expect(out).toStrictEqual({ result: undefined, error: undefined })
    expect(events).toStrictEqual([
      { schedule: 1, execute: 1, executed: 1, failed: 0, cancelled: 0 },
      { schedule: 1, execute: 1, executed: 1, failed: 0, cancelled: 0 },
      { schedule: 1, execute: 1, executed: 1, failed: 0, cancelled: 0 }
    ])
  })

  test('executes with progression', async () => {
    const server = newServer(PORT, { workers: 1 })
    const broker = newBroker(PORT)
    const client = newClient(PORT)

    const events = [aggrEvents(client), aggrEvents(broker), aggrEvents(server)]

    const progress = []

    const out = await output(client.remote.funcWithProgress({ onProgress: p => progress.push(p) }))
    server.kill()
    broker.kill()
    client.kill()

    expect(out).toStrictEqual({ result: undefined, error: undefined })
    expect(events).toStrictEqual([
      { schedule: 1, execute: 1, executed: 1, failed: 0, cancelled: 0 },
      { schedule: 1, execute: 1, executed: 1, failed: 0, cancelled: 0 },
      { schedule: 1, execute: 1, executed: 1, failed: 0, cancelled: 0 }
    ])
    expect(progress).toStrictEqual([1, 2])
  })

  test('handles functions that throws', async () => {
    const server = newServer(PORT)
    const broker = newBroker(PORT)
    const client = newClient(PORT)

    const events = [aggrEvents(client), aggrEvents(broker), aggrEvents(server)]

    const out = await output(client.remote.functThatThrows())

    server.kill()
    broker.kill()
    client.kill()
    expect(out.error.code).toStrictEqual('ERROR_CODE')
    expect(out.error.message).toStrictEqual('ERROR_MESSAGE')
    expect(events).toStrictEqual([
      { schedule: 1, execute: 1, executed: 0, failed: 1, cancelled: 0 },
      { schedule: 1, execute: 1, executed: 0, failed: 1, cancelled: 0 },
      { schedule: 1, execute: 1, executed: 0, failed: 1, cancelled: 0 }
    ])
  })

  test('throws when procedure does not exists', async () => {
    const server = newServer(PORT)
    const broker = newBroker(PORT)
    const client = newClient(PORT)

    const events = [aggrEvents(client), aggrEvents(broker), aggrEvents(server)]

    const out = await output(client.remote.notExistingProcedure())

    server.kill()
    broker.kill()
    client.kill()
    expect(out.error.code).toStrictEqual('NO_PROCEDURE')
    expect(events).toStrictEqual([
      { schedule: 1, execute: 1, executed: 0, failed: 1, cancelled: 0 },
      { schedule: 1, execute: 1, executed: 0, failed: 1, cancelled: 0 },
      { schedule: 1, execute: 1, executed: 0, failed: 1, cancelled: 0 }
    ])
  })

  test('executes when multiple servers', async () => {
    const server1 = newServer(PORT, { workers: 1 })
    const server2 = newServer(PORT, { workers: 1 })
    const broker = newBroker(PORT)
    const client = newClient(PORT)

    const events = [aggrEvents(client), aggrEvents(broker)]

    const out = await output(client.remote.funcWithResult(10))

    server1.kill()
    server2.kill()
    broker.kill()
    client.kill()

    expect(out).toStrictEqual({ result: 10, error: undefined })

    expect(events).toStrictEqual([
      { schedule: 1, execute: 1, executed: 1, failed: 0, cancelled: 0 },
      { schedule: 1, execute: 1, executed: 1, failed: 0, cancelled: 0 }
    ])
  })

  test('executes when request is made before server is started', async () => {
    const broker = newBroker(PORT)
    const client = newClient(PORT)

    const events = [aggrEvents(client), aggrEvents(broker)]

    const out = output(client.remote.funcWithResult(10))

    await pause(100)

    const server = newServer(PORT, { workers: 1 })
    const serverEvents = aggrEvents(server)
    await pause(500)
    server.kill()
    broker.kill()
    client.kill()

    expect(await out).toStrictEqual({ result: 10, error: undefined })
    expect(events).toStrictEqual([
      { schedule: 1, execute: 1, executed: 1, failed: 0, cancelled: 0 },
      { schedule: 1, execute: 1, executed: 1, failed: 0, cancelled: 0 }
    ])
    expect(serverEvents).toStrictEqual({ schedule: 1, execute: 1, executed: 1, failed: 0, cancelled: 0 })
  })

  test('executes when broker is started after client and server', async () => {
    const client = newClient(PORT)
    const server = newServer(PORT, { workers: 1 })
    const events = [aggrEvents(client), aggrEvents(server)]

    const out = output(client.remote.funcWithResult(10))

    await pause(100)
    const broker = newBroker(PORT)
    const brokerEvents = aggrEvents(server)
    await pause(1000)
    server.kill()
    broker.kill()
    client.kill()

    expect(await out).toStrictEqual({ result: 10, error: undefined })
    expect(events).toStrictEqual([
      { schedule: 1, execute: 1, executed: 1, failed: 0, cancelled: 0 },
      { schedule: 1, execute: 1, executed: 1, failed: 0, cancelled: 0 }
    ])
    expect(brokerEvents).toStrictEqual({ schedule: 1, execute: 1, executed: 1, failed: 0, cancelled: 0 })
  })

  test('executes with affinity', async () => {
    const server1 = newServer(PORT, { affinity: 'aff1', workers: 1 })
    const server2 = newServer(PORT, { affinity: 'aff2', workers: 1 })
    const server3 = newServer(PORT, { affinity: 'aff3', workers: 1 })
    const broker = newBroker(PORT)
    const client = newClient(PORT)
    const events = [aggrEvents(client), aggrEvents(broker), aggrEvents(server1), aggrEvents(server2), aggrEvents(server3)]

    // make sure stack is ready
    await pause(2000)

    const promises = [
      [...new Array(10)].map((_, index) => client.remote.funcWithResult(index, { affinity: 'aff1' })),
      [...new Array(10)].map((_, index) => client.remote.funcWithResult(index, { affinity: 'aff2' }))
    ].flatMap(el => el)
    await Promise.all(promises)

    server1.kill()
    server2.kill()
    server3.kill()
    broker.kill()
    client.kill()
    expect(events).toStrictEqual([
      { schedule: 20, execute: 20, executed: 20, failed: 0, cancelled: 0 },
      { schedule: 20, execute: 20, executed: 20, failed: 0, cancelled: 0 },
      { schedule: 10, execute: 10, executed: 10, failed: 0, cancelled: 0 },
      { schedule: 10, execute: 10, executed: 10, failed: 0, cancelled: 0 },
      { schedule: 0, execute: 0, executed: 0, failed: 0, cancelled: 0 }
    ])
  }, 100000)

  test('distributes load', async () => {
    const server1 = newServer(PORT, { workers: 2 })
    const server2 = newServer(PORT, { workers: 2 })
    const broker = newBroker(PORT)
    const client = newClient(PORT)
    const events = [aggrEvents(client), aggrEvents(broker), aggrEvents(server1), aggrEvents(server2)]

    await pause(2000)

    const promises = [...new Array(10)].map((_, index) => client.remote.asyncFunc(index, 100))
    await Promise.all(promises)

    server1.kill()
    server2.kill()
    broker.kill()
    client.kill()
    expect(events[0]).toStrictEqual({ schedule: 10, execute: 10, executed: 10, failed: 0, cancelled: 0 })
    expect(events[1]).toStrictEqual({ schedule: 10, execute: 10, executed: 10, failed: 0, cancelled: 0 })
    expect(events[2]).toStrictEqual({ schedule: 5, execute: 5, executed: 5, failed: 0, cancelled: 0 })
    expect(events[3]).toStrictEqual({ schedule: 5, execute: 5, executed: 5, failed: 0, cancelled: 0 })
  }, 10000)

  test('distributes load when weighting requests', async () => {
    const server1 = newServer(PORT, { workers: 5 })
    const server2 = newServer(PORT, { workers: 5 })
    const broker = newBroker(PORT)
    const client = newClient(PORT)
    const events = [aggrEvents(client), aggrEvents(broker), aggrEvents(server1), aggrEvents(server2)]

    await pause(2000)

    const promises = [
      client.remote.asyncFunc(1, 1000, { load: 10 }),
      client.remote.asyncFunc(2, 100, { load: 1 }),
      client.remote.asyncFunc(3, 100, { load: 1 }),
      client.remote.asyncFunc(4, 100, { load: 1 })
    ]
    await Promise.all(promises)

    server1.kill()
    server2.kill()
    broker.kill()
    client.kill()
    expect(events[0]).toStrictEqual({ schedule: 4, execute: 4, executed: 4, failed: 0, cancelled: 0 })
    expect(events[1]).toStrictEqual({ schedule: 4, execute: 4, executed: 4, failed: 0, cancelled: 0 })
    expect([events[2], events[3]].some(e => e.executed === 3)).toBeTruthy()
    expect([events[2], events[3]].some(e => e.executed === 1)).toBeTruthy()
  }, 10000)

  test('cancels when it is executing', async () => {
    const server = newServer(PORT, { workers: 4 })
    const broker = newBroker(PORT)
    const client = newClient(PORT)
    const events = [aggrEvents(client), aggrEvents(broker), aggrEvents(server)]

    await pause(2000)

    const out1 = output(client.remote.asyncFunc('result1', 100000, { cancelToken: 'ct1' }))
    client.remote.asyncFunc('result2', 100000, { cancelToken: 'ct2' })
    const out3 = output(client.remote.asyncFunc('result3', 400, { cancelToken: 'ct3' }))

    await pause(200)
    client.cancel('ct1')

    await pause(1000)
    server.kill()
    broker.kill()
    client.kill()

    expect((await out1).error.code).toStrictEqual('CANCELLED')
    expect(await out3).toStrictEqual({ result: 'result3', error: undefined })

    expect(events).toStrictEqual([
      { schedule: 3, execute: 3, executed: 1, failed: 0, cancelled: 1 },
      { schedule: 3, execute: 3, executed: 1, failed: 0, cancelled: 1 },
      { schedule: 3, execute: 3, executed: 1, failed: 0, cancelled: 1 }
    ])
  }, 10000)

  test('cancels when no server', async () => {
    const broker = newBroker(PORT)
    const client = newClient(PORT)
    const events = [aggrEvents(client), aggrEvents(broker)]

    await pause(2000)

    const out1 = output(client.remote.asyncFunc('result1', 100000, { cancelToken: 'ct1' }))
    client.remote.asyncFunc('result2', 100000, { cancelToken: 'ct2' })
    client.remote.asyncFunc('result3', 400, { cancelToken: 'ct3' })

    await pause(200)
    client.cancel('ct1')

    await pause(1000)
    broker.kill()
    client.kill()

    expect((await out1).error.code).toStrictEqual('CANCELLED')

    expect(events).toStrictEqual([
      { schedule: 3, execute: 3, executed: 0, failed: 0, cancelled: 1 },
      { schedule: 3, execute: 0, executed: 0, failed: 0, cancelled: 1 }])
  }, 10000)

  test('cancels when no broker', async () => {
    const client = newClient(PORT)
    const events = [aggrEvents(client)]

    await pause(2000)

    const out1 = output(client.remote.asyncFunc('result1', 100000, { cancelToken: 'ct1' }))
    client.remote.asyncFunc('result2', 100000, { cancelToken: 'ct2' })
    client.remote.asyncFunc('result3', 400, { cancelToken: 'ct3' })

    await pause(200)
    client.cancel('ct1')

    await pause(1000)
    client.kill()

    expect((await out1).error.code).toStrictEqual('CANCELLED')

    expect(events).toStrictEqual([
      { schedule: 3, execute: 3, executed: 0, failed: 0, cancelled: 1 }])
  }, 10000)

  test('rejects when broker disconnected from client', async () => {
    const client = newClient(PORT, 50, 1)
    const broker = newBroker(PORT)
    const events = [aggrEvents(client), aggrEvents(broker)]

    const promises = [...new Array(2)].map((_, index) => output(client.remote.asyncFunc(index, 10000)))

    await pause(1000)
    broker.kill()
    await pause(1000)
    client.kill()

    const result = (await Promise.all(promises)).map(r => ({ result: undefined, code: r.error.code }))
    expect(result).toStrictEqual([
      { result: undefined, code: 'LOST_BROKER' },
      { result: undefined, code: 'LOST_BROKER' }
    ])

    expect(events).toStrictEqual([
      { schedule: 2, execute: 2, executed: 0, failed: 2, cancelled: 0 },
      { schedule: 2, execute: 0, executed: 0, failed: 0, cancelled: 0 }])
  }, 10000)

  test('cancels the execution of a function if it is already executing with the same arguments', async () => {
    const server = newServer(PORT, { workers: 10 })
    const broker = newBroker(PORT)
    const client = newClient(PORT)
    const events = [aggrEvents(client), aggrEvents(broker), aggrEvents(server)]

    const promises = [
      client.remote.asyncFunc(1, 100),
      client.remote.asyncFunc(1, 100),
      client.remote.asyncFunc(1, 100),
      client.remote.asyncFunc(1, 100)
    ]
    const result = await Promise.allSettled(promises)

    server.kill()
    broker.kill()
    client.kill()

    expect(result).toHaveLength(4)

    expect(result.filter(r => r.status === 'rejected')).toHaveLength(3)
    expect(result.filter(r => r.status === 'fulfilled')).toHaveLength(1)

    expect(events).toStrictEqual([
      { schedule: 4, execute: 4, executed: 1, failed: 0, cancelled: 3 },
      { schedule: 4, execute: 4, executed: 1, failed: 0, cancelled: 3 },
      { schedule: 4, execute: 4, executed: 1, failed: 0, cancelled: 3 }
    ])
  })
})
