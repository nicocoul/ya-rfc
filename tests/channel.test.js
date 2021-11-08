const { newServer } = require('../lib/server')
const { createChannel } = require('../lib/channel')
const { pause } = require('./common')
const logger = require('../lib/logger')(__filename)

const PORT = 8084
const HOST = '::'

test('it sends objects to server', async () => {
  const received = []

  const channel = createChannel(HOST, PORT)
  channel.write({ id: 1 })
  channel.write({ id: 2 })
  await pause(150)
  const server = newServer(PORT)
  server.on('new-channel', c => {
    c.on('data', (data) => {
      received.push(data)
    })
  })
  await pause(150)
  channel.destroy()
  server.close()

  expect(received).toStrictEqual([{ id: 1 }, { id: 2 }])
})

test('it receives objects from server', async () => {
  const received = []

  const channel = createChannel(HOST, PORT)
  channel.on('data', data => {
    received.push(data)
  })

  await pause(150)
  const server = newServer(PORT)
  server.on('new-channel', c => {
    c.on('data', (data) => {
      received.push(data)
    })
    c.write({ id: 1 })
    c.write({ id: 2 })
  })
  await pause(150)
  channel.destroy()
  server.close()

  expect(received).toStrictEqual([{ id: 1 }, { id: 2 }])
})

test('it throws when sending and when client was destroyed', async () => {
  const server = newServer(PORT)
  server.on('new-channel', c => {
    c.on('data', (data) => {
      logger.debug(JSON.stringify(data))
    })
  })
  const channel = createChannel(HOST, PORT)
  channel.write({ id: 1 })
  await pause(50)
  await channel.destroy()
  try {
    expect(() => channel.write({ id: 2 })).toThrow()
  } catch (error) {
    logger.error(error.stack)
  } finally {
    server.close()
  }
})

test('it throws when sending and when server was closed', async () => {
  const server = newServer(PORT)
  server.on('new-channel', c => {
    c.on('data', (data) => {
      logger.debug(JSON.stringify(data))
    })
  })
  const channel = createChannel(HOST, PORT)
  channel.write({ id: 1 })
  await pause(50)
  server.close()
  await pause(50)
  try {
    expect(() => channel.write({ id: 2 })).toThrow()
  } catch (error) {
    logger.error(error.stack)
  } finally {
    await channel.destroy()
    server.close()
  }
})

test('it receives objects', async () => {
  const server = await newServer(PORT)
  const received = []
  server.on('new-channel', c => {
    c.on('data', (data) => {
      received.push(data)
    })
  })
  // expect(server.address.port).toStrictEqual(PORT)
  // expect(server.address.host).toStrictEqual('::')
  const channel1 = await createChannel(HOST, PORT)
  const channel2 = await createChannel(HOST, PORT)
  channel1.write({ id: 1 })
  channel2.write({ id: 2 })

  await pause(50)

  expect(received.length).toStrictEqual(2)

  await channel1.destroy()
  await channel2.destroy()
  server.close()
})
/**/
