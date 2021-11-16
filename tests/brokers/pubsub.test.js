const { pause, newDummyChannel } = require('../common')
const { COMMANDS } = require('../../lib/constants')
const dut = require('../../lib/brokers/pubsub')

describe('Pubsub broker', () => {
  test('publishes on 2 topics', async () => {
    const csub1 = newDummyChannel()
    const csub2 = newDummyChannel()
    const cpub = newDummyChannel()
    const received1 = []
    const received2 = []

    const pubsubBoker = dut.create()
    pubsubBoker.registerChannel(csub1)
    pubsubBoker.registerChannel(csub2)
    pubsubBoker.registerChannel(cpub)

    cpub.on('data', (data) => {
      pubsubBoker.handleData(cpub, data)
    })
    cpub.remote.writable.write({ c: COMMANDS.PUBLISH, t: 'topic1', m: 1 })
    cpub.remote.writable.write({ c: COMMANDS.PUBLISH, t: 'topic2', m: 2 })
    cpub.remote.writable.write({ c: COMMANDS.PUBLISH, t: 'topic2', m: 3 })

    csub1.on('data', (data) => {
      pubsubBoker.handleData(csub1, data)
    })
    csub1.remote.writable.write({
      c: COMMANDS.SUBSCRIBE,
      id: 0,
      filter: undefined,
      offset: 0,
      topic: 'topic1'
    })
    csub1.remote.readable.on('data', (data) => {
      received1.push(data)
    })

    csub2.on('data', (data) => {
      pubsubBoker.handleData(csub2, data)
    })
    csub2.remote.writable.write({
      c: COMMANDS.SUBSCRIBE,
      id: 0,
      filter: undefined,
      offset: 0,
      topic: 'topic2'
    })
    csub2.remote.readable.on('data', (data) => {
      received2.push(data)
    })

    await pause(0)
    expect(received1).toStrictEqual([
      { c: COMMANDS.PUBLISH, t: 'topic1', o: 0, m: 1 }])
    expect(received2).toStrictEqual([
      { c: COMMANDS.PUBLISH, t: 'topic2', o: 0, m: 2 },
      { c: COMMANDS.PUBLISH, t: 'topic2', o: 1, m: 3 }])
  })

  test('publishes from offset', async () => {
    const csub1 = newDummyChannel()
    const cpub = newDummyChannel()
    const received1 = []
    cpub.on('data', (data) => {
      pubsubBoker.handleData(cpub, data)
    })
    csub1.on('data', (data) => {
      pubsubBoker.handleData(csub1, data)
    })

    const pubsubBoker = dut.create()
    pubsubBoker.registerChannel(csub1)
    pubsubBoker.registerChannel(cpub)

    cpub.remote.writable.write({ c: COMMANDS.PUBLISH, t: 'topic1', m: 1 })
    cpub.remote.writable.write({ c: COMMANDS.PUBLISH, t: 'topic1', m: 2 })
    cpub.remote.writable.write({ c: COMMANDS.PUBLISH, t: 'topic1', m: 3 })

    csub1.remote.writable.write({
      c: COMMANDS.SUBSCRIBE,
      id: 0,
      filter: undefined,
      offset: 2,
      topic: 'topic1'
    })
    csub1.remote.readable.on('data', (data) => {
      received1.push(data)
    })

    await pause(0)
    expect(received1).toStrictEqual([
      { c: COMMANDS.PUBLISH, t: 'topic1', o: 2, m: 3 }])
  })

  test('resubscribes', async () => {
    const csub1 = newDummyChannel()
    const cpub = newDummyChannel()
    const received1 = []
    cpub.on('data', (data) => {
      pubsubBoker.handleData(cpub, data)
    })
    csub1.on('data', (data) => {
      pubsubBoker.handleData(csub1, data)
    })

    const pubsubBoker = dut.create()
    pubsubBoker.registerChannel(csub1)
    pubsubBoker.registerChannel(cpub)

    csub1.remote.writable.write({
      c: COMMANDS.SUBSCRIBE,
      id: 0,
      offset: 2,
      topic: 'topic1'
    })
    csub1.remote.writable.write({
      c: COMMANDS.SUBSCRIBE,
      id: 0,
      offset: 1,
      topic: 'topic1'
    })
    csub1.remote.readable.on('data', (data) => {
      received1.push(data)
    })

    cpub.remote.writable.write({ c: COMMANDS.PUBLISH, t: 'topic1', m: 1 })
    cpub.remote.writable.write({ c: COMMANDS.PUBLISH, t: 'topic1', m: 2 })
    cpub.remote.writable.write({ c: COMMANDS.PUBLISH, t: 'topic1', m: 3 })

    await pause(0)
    pubsubBoker.unregisterChannel(csub1)
    expect(received1).toStrictEqual([
      { c: COMMANDS.PUBLISH, t: 'topic1', o: 1, m: 2 },
      { c: COMMANDS.PUBLISH, t: 'topic1', o: 2, m: 3 }])
  })

  test('unsubscribes', async () => {
    const csub1 = newDummyChannel()
    const cpub = newDummyChannel()
    const received1 = []
    cpub.on('data', (data) => {
      pubsubBoker.handleData(cpub, data)
    })
    csub1.on('data', (data) => {
      pubsubBoker.handleData(csub1, data)
    })

    const pubsubBoker = dut.create()
    pubsubBoker.registerChannel(csub1)
    pubsubBoker.registerChannel(cpub)

    csub1.remote.writable.write({
      c: COMMANDS.SUBSCRIBE,
      id: 0,
      offset: 0,
      topic: 'topic1'
    })
    csub1.remote.readable.on('data', (data) => {
      received1.push(data)
    })

    cpub.remote.writable.write({ t: 'topic1', m: 1 })
    await pause(20)
    csub1.remote.writable.write({
      c: COMMANDS.UNSUBSCRIBE,
      topic: 'topic1'
    })
    cpub.remote.writable.write({ c: COMMANDS.PUBLISH, t: 'topic1', m: 2 })
    cpub.remote.writable.write({ c: COMMANDS.PUBLISH, t: 'topic1', m: 3 })

    await pause(0)
    expect(received1).toStrictEqual([
      { c: COMMANDS.PUBLISH, t: 'topic1', o: 0, m: 1 }])
  })

  test('publishes when mutiple publishers', async () => {
    const csub1 = newDummyChannel()
    const cpub1 = newDummyChannel()
    const cpub2 = newDummyChannel()
    const received1 = []
    cpub1.on('data', (data) => {
      pubsubBoker.handleData(cpub1, data)
    })
    cpub2.on('data', (data) => {
      pubsubBoker.handleData(cpub2, data)
    })
    csub1.on('data', (data) => {
      pubsubBoker.handleData(csub1, data)
    })

    const pubsubBoker = dut.create()
    pubsubBoker.registerChannel(csub1)
    pubsubBoker.registerChannel(cpub1)

    cpub1.remote.writable.write({ c: COMMANDS.PUBLISH, t: 'topic1', m: 1 })
    await pause(0)
    cpub2.remote.writable.write({ c: COMMANDS.PUBLISH, t: 'topic1', m: 2 })
    await pause(0)
    cpub1.remote.writable.write({ c: COMMANDS.PUBLISH, t: 'topic1', m: 3 })

    csub1.remote.writable.write({
      c: COMMANDS.SUBSCRIBE,
      id: 0,
      offset: 0,
      topic: 'topic1'
    })
    csub1.remote.readable.on('data', (data) => {
      received1.push(data)
    })

    await pause(0)
    expect(received1).toStrictEqual([
      { c: COMMANDS.PUBLISH, t: 'topic1', o: 0, m: 1 },
      { c: COMMANDS.PUBLISH, t: 'topic1', o: 1, m: 2 },
      { c: COMMANDS.PUBLISH, t: 'topic1', o: 2, m: 3 }])
  })

  test('filters', async () => {
    const csub = newDummyChannel()
    const cpub = newDummyChannel()
    const received = []

    const pubsubBoker = dut.create()
    pubsubBoker.registerChannel(csub)
    pubsubBoker.registerChannel(cpub)

    cpub.on('data', (data) => {
      pubsubBoker.handleData(cpub, data)
    })
    cpub.remote.writable.write({ c: COMMANDS.PUBLISH, t: 'topic1', m: 1 })
    cpub.remote.writable.write({ c: COMMANDS.PUBLISH, t: 'topic1', m: 2 })
    cpub.remote.writable.write({ c: COMMANDS.PUBLISH, t: 'topic1', m: 3 })
    cpub.remote.writable.write({ c: COMMANDS.PUBLISH, t: 'topic1', m: 4 })

    csub.on('data', (data) => {
      pubsubBoker.handleData(csub, data)
    })
    csub.remote.writable.write({
      c: COMMANDS.SUBSCRIBE,
      id: 0,
      offset: 0,
      topic: 'topic1',
      filter: (m) => m === 2
    })
    csub.remote.readable.on('data', (data) => {
      received.push(data)
    })

    csub.remote.writable.write({
      c: COMMANDS.SUBSCRIBE,
      id: 1,
      offset: 0,
      topic: 'topic1',
      filter: (m) => m === 3
    })

    await pause(0)
    pubsubBoker.unsubscribe(csub, 'topic1')
    cpub.destroy()
    expect(received).toStrictEqual([
      { c: COMMANDS.PUBLISH, t: 'topic1', o: 1, m: 2 },
      { c: COMMANDS.PUBLISH, t: 'topic1', o: 2, m: 3 }])
  })

  test('publishes locally and subscribes', async () => {
    const pubsub = dut.create()
    const sent = [56, 2, 3]
    const received1 = []
    sent.forEach(m => pubsub.publish('topic1', m))
    pubsub.subscribe('topic1', (m) => received1.push(m))
    pubsub.publish('topic1', 'toto')
    await pause(0)
    expect(received1).toStrictEqual([...sent, 'toto'])

    const received2 = []
    const csub = newDummyChannel()
    pubsub.registerChannel(csub)
    csub.on('data', (data) => {
      pubsub.handleData(csub, data)
    })
    csub.remote.writable.write({
      c: COMMANDS.SUBSCRIBE,
      id: 0,
      offset: 0,
      topic: 'topic1'
    })
    csub.remote.readable.on('data', (data) => {
      received2.push(data)
    })
    await pause(0)
    expect(received2.map(r => r.m)).toStrictEqual([...sent, 'toto'])
  })
})
