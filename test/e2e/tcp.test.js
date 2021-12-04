const path = require('path')
const net = require('net')
const { pause } = require('../common')
const rpcBroker = require('../../lib/brokers/rpc')
const rpcServer = require('../../lib/clients/rpc-server')
const rpcClient = require('../../lib/clients/rpc-client')
const yac = require('ya-common')
const netPlugin = yac.plugins.net
const netChannel = yac.channels.net

function newServer (port, options) {
  const channel = netChannel({ host: 'localhost', port })
  return rpcServer.create(channel, path.join(__dirname, '..', 'fixtures', 'rpc-module'), options)
}

function newClient (port) {
  const channel = netChannel({ host: 'localhost', port })
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
const PORT = 8000
describe('TCP stack', () => {
  test('executes a function that has a return value', async () => {
    const rpcServer = newServer(PORT)
    const rpcBroker = newBroker(PORT)
    const client = newClient(PORT)

    let result
    let error
    let count = 0
    await client.remote.funcWithResult(10)
      .then(res => {
        count++
        result = res
      })
      .catch(err => {
        count++
        error = err
      })
    rpcServer.kill()
    rpcBroker.kill()
    client.kill()
    expect(result).toStrictEqual(10)
    expect(count).toStrictEqual(1)
    expect(error).toBeUndefined()
  })

  test('executes a function that has no return value', async () => {
    const rpcServer = newServer(PORT)
    const rpcBroker = newBroker(PORT)
    const client = newClient(PORT)

    let result
    let error
    let count = 0
    await client.remote.functWithoutResult(10)
      .then(res => {
        count++
        result = res
      })
      .catch(err => {
        count++
        error = err
      })
    rpcServer.kill()
    rpcBroker.kill()
    client.kill()
    expect(result).toBeUndefined()
    expect(count).toStrictEqual(1)
    expect(error).toBeUndefined()
  })

  test('executes with progression', async () => {
    const rpcServer = newServer(PORT)
    const rpcBroker = newBroker(PORT)
    const client = newClient(PORT)

    let result
    let error
    const progress = []
    let count = 0
    await client.remote.funcWithProgress({ onProgress: p => progress.push(p) })
      .then(res => {
        count++
        result = res
      })
      .catch(err => {
        count++
        error = err
      })
    rpcServer.kill()
    rpcBroker.kill()
    client.kill()
    expect(error).toBeUndefined()
    expect(count).toStrictEqual(1)
    expect(progress.find(p => p === 'done')).toBeDefined()
    expect(result).toBeUndefined()
  })

  test('executes with status', async () => {
    const rpcServer = newServer(PORT)
    const rpcBroker = newBroker(PORT)
    const client = newClient(PORT)

    let result
    let error
    const statuses = []
    let count = 0
    await client.remote.funcWithProgress({ onStatus: p => statuses.push(p) })
      .then(res => {
        count++
        result = res
      })
      .catch(err => {
        count++
        error = err
      })
    rpcServer.kill()
    rpcBroker.kill()
    client.kill()
    expect(error).toBeUndefined()
    expect(count).toStrictEqual(1)
    expect(result).toBeUndefined()
    expect(statuses.map(s => s.status)).toStrictEqual(['scheduled', 'dispatched', 'end'])
  })

  test('handles errors', async () => {
    const rpcServer = newServer(PORT)
    const rpcBroker = newBroker(PORT)
    const client = newClient(PORT)

    let result
    let error
    let count = 0
    await client.remote.functThatThrows()
      .then(res => {
        count++
        result = res
      })
      .catch(err => {
        count++
        error = err
      })

    rpcServer.kill()
    rpcBroker.kill()
    client.kill()
    expect(error).toBeDefined()
    expect(result).toBeUndefined()
    expect(count).toStrictEqual(1)
  })

  test('executes 1000 in less than 500ms', async () => {
    const rpcServer = newServer(PORT, { maxLoad: [1000] })
    const rpcBroker = newBroker(PORT)
    const client = newClient(PORT)
    const eCount = 1000
    let result
    let error
    let count = 0
    await pause(100)
    console.time('monTimer')
    for (let i = 0; i < eCount; i++) {
      client.remote.funcWithResult(10)
        .then(res => {
          count++
          result = res
          if (count === eCount) {
            console.timeEnd('monTimer')
          }
        })
        .catch(err => {
          count++
          error = err
        })
    }
    await pause(500)
    rpcServer.kill()
    rpcBroker.kill()
    client.kill()
    expect(result).toStrictEqual(10)
    expect(count).toStrictEqual(eCount)
    expect(error).toBeUndefined()
  })

  test('executes when multiple servers', async () => {
    const rpcServer1 = newServer(PORT)
    const rpcServer2 = newServer(PORT)
    const rpcBroker = newBroker(PORT)
    const client = newClient(PORT)
    await pause(300)
    let result
    let error
    let count = 0
    await client.remote.funcWithResult(10)
      .then(res => {
        count++
        result = res
      })
      .catch(err => {
        count++
        error = err
      })
    rpcServer1.kill()
    rpcServer2.kill()
    rpcBroker.kill()
    client.kill()
    expect(result).toStrictEqual(10)
    expect(count).toStrictEqual(1)
    expect(error).toBeUndefined()
  })

  test('executes when request is made before any server is started', async () => {
    const rpcBroker = newBroker(PORT)
    const client = newClient(PORT)
    let result
    let error
    let count = 0
    client.remote.funcWithResult(10)
      .then(res => {
        count++
        result = res
      })
      .catch(err => {
        count++
        error = err
      })
    const rpcServer = newServer(PORT)
    await pause(300)
    rpcServer.kill()
    rpcBroker.kill()
    client.kill()
    expect(result).toStrictEqual(10)
    expect(count).toStrictEqual(1)
    expect(error).toBeUndefined()
  })

  test('executes when broker is started after client and server', async () => {
    const client = newClient(PORT)
    const rpcServer = newServer(PORT)
    let result
    let error
    let count = 0
    client.remote.funcWithResult(10)
      .then(res => {
        count++
        result = res
      })
      .catch(err => {
        count++
        error = err
      })

    await pause(100)
    const rpcBroker = newBroker(PORT)
    await pause(500)
    rpcServer.kill()
    rpcBroker.kill()
    client.kill()
    expect(result).toStrictEqual(10)
    expect(count).toStrictEqual(1)
    expect(error).toBeUndefined()
  })

  test('executes with affinity', async () => {
    const rpcServer1 = newServer(PORT, { affinity: 'x' })
    const rpcServer2 = newServer(PORT, { affinity: 'y' })
    const rpcServer3 = newServer(PORT, { affinity: 'z' })
    const rpcBroker = newBroker(PORT)
    const client = newClient(PORT)
    await pause(300)
    const execChannelsIdsY = []
    for (let i = 0; i < 3; i++) {
      await client.remote.funcWithResult(10, {
        affinity: 'y',
        onStatus: (status) => {
          if (status.on) {
            execChannelsIdsY.push(status.on)
          }
        }
      })
    }
    const execChannelsIdsX = []
    for (let i = 0; i < 3; i++) {
      await client.remote.funcWithResult(10, {
        affinity: 'x',
        onStatus: (status) => {
          if (status.on) {
            execChannelsIdsX.push(status.on)
          }
        }
      })
    }

    rpcServer1.kill()
    rpcServer2.kill()
    rpcServer3.kill()
    rpcBroker.kill()
    client.kill()
    expect(execChannelsIdsX.length).toBeGreaterThan(0)
    expect(execChannelsIdsX[0]).not.toStrictEqual(execChannelsIdsY[0])
    for (let i = 1; i < execChannelsIdsX.length; i++) {
      expect(execChannelsIdsX[i - 1]).toStrictEqual(execChannelsIdsX[i])
      expect(execChannelsIdsY[i - 1]).toStrictEqual(execChannelsIdsY[i])
    }
  })

  test('executes with load balancing', async () => {
    const rpcServer1 = newServer(PORT, { maxLoad: [0] })
    const rpcServer2 = newServer(PORT, { maxLoad: [5] })
    const rpcServer3 = newServer(PORT, { maxLoad: [5] })
    const rpcServer4 = newServer(PORT, { maxLoad: [0] })
    const rpcBroker = newBroker(PORT)
    const client = newClient(PORT)
    await pause(50)
    const execChannels = []
    for (let i = 0; i < 20; i++) {
      client.remote.asyncFunc(10, 100, {
        load: 1,
        onStatus: (status) => {
          if (status.status === 'dispatched' && status.on) {
            execChannels.push(status.on)
          }
        }
      })
    }
    await pause(50)
    expect(execChannels).toHaveLength(10)
    await pause(300)
    rpcServer1.kill()
    rpcServer2.kill()
    rpcServer3.kill()
    rpcServer4.kill()
    rpcBroker.kill()
    client.kill()
    expect(execChannels).toHaveLength(20)
    const byChannelId = {}
    execChannels.forEach(id => {
      if (!byChannelId[id]) byChannelId[id] = 0
      byChannelId[id] += 1
    })
    expect(Object.keys(byChannelId)).toHaveLength(2)
    const channel1 = Object.keys(byChannelId)[0]
    const channel2 = Object.keys(byChannelId)[1]
    expect(byChannelId[channel1]).toBeGreaterThan(4)
    expect(byChannelId[channel2]).toBeGreaterThan(4)
  })
})
