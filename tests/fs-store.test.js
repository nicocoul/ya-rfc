const fsStore = require('../lib/fs-store')
const { pause, newAccumulator, newArrayReadable } = require('./common')
const fs = require('fs')
const path = require('path')
const logger = require('../lib/logger')(__filename)

const tmpPath = path.join(__dirname, 'tmp')
try { fs.mkdirSync(tmpPath) } catch (_) { }

const basePath = path.join(tmpPath, 'fs-store')
try { fs.mkdirSync(basePath) } catch (_) { }

function cleanup (topic) {
  try { fs.rmdirSync(path.join(basePath, topic), { recursive: true }) } catch (_) { }
}

test('blobAppender persists blobs', async () => {
  const topic = 'blobAppender'
  cleanup(topic)
  try { fs.mkdirSync(path.join(basePath, topic)) } catch (_) { }
  const appender = fsStore.createBlobAppender(path.join(basePath, topic, '1.top'), 3)

  const datas = []
  let closed = false
  let hasError = false
  appender.on('data', (data) => {
    datas.push(data)
  })
  appender.on('close', () => {
    closed = true
  })
  appender.on('error', () => {
    hasError = true
  })

  appender.write('a')
  appender.write('b')
  await pause(100)
  expect(datas).toHaveLength(0)

  appender.flush()
  await pause(100)
  expect(datas).toHaveLength(2)
  expect(closed).toBeFalsy()

  appender.write('c')
  await pause(100)
  expect(closed).toBeTruthy()
  expect(datas).toHaveLength(3)
  expect(hasError).toBeFalsy()

  appender.write('d')
  await pause(100)
  expect(hasError).toBeTruthy()
})

test('topicWriter persists messages in order', async () => {
  const topic = 'createTopicWriter'
  cleanup(topic)
  try { fs.mkdirSync(path.join(basePath, topic)) } catch (_) { }
  const w = fsStore.createTopicWriter(path.join(basePath, topic), 10, 0)
  const objs = []
  const expectedObjs = []

  w.on('data', (data) => {
    objs.push(data)
  })

  let cnt = 0
  for (cnt; cnt < 25; cnt++) {
    const obj = { i: cnt }
    w.write(obj)
    expectedObjs.push(obj)
  }

  await pause(100)
  expect(objs).toStrictEqual(expectedObjs)

  const w1 = fsStore.createTopicWriter(path.join(basePath, topic), 10, cnt)
  w1.on('data', (data) => {
    objs.push(data)
  })
  for (cnt; cnt < 36; cnt++) {
    const obj = { i: cnt }
    w.write(obj, cnt)
    expectedObjs.push(obj)
  }

  await pause(100)
  expect(objs).toStrictEqual(expectedObjs)
})

test('topic persists messages in order', async () => {
  const topicName = 'newTopic1'
  cleanup(topicName)
  const expected = []

  const topic = fsStore.newTopic(basePath, topicName, 5)
  const accumulator = newAccumulator()
  let cnt = 0
  for (cnt; cnt < 25; cnt++) {
    const obj = { i: cnt }
    topic.write(obj)
    expected.push(obj)
  }
  await pause(100)
  topic.createReadStream(0).pipe(accumulator)

  await pause(100)
  expect(accumulator.data()).toStrictEqual(expected)
})

test('topic streams in order', async () => {
  const topicName = 'newTopic2'
  cleanup(topicName)
  const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  const topic = fsStore.newTopic(basePath, topicName, 3)
  const accumulator = newAccumulator()

  newArrayReadable(expected).pipe(topic).pipe(accumulator)
  await pause(100)

  expect(accumulator.data()).toStrictEqual(expected)
})
/**/

/*
test('topic streams lots of data', async () => {
    const topic = 'newTopic3'
    cleanup(topic)
    const expected = []

    const t = fsStore.newTopic(basePath, topic, 10000)
    const accumulator = newAccumulator()
    let cnt = 0
    for (cnt; cnt < 100000; cnt++) {
        const obj = { i: cnt }
        t.write(obj)
        expected.push(obj)
    }
    t.getReadStream().pipe(accumulator)
    await pause(25000)

    expect(accumulator.data).toStrictEqual(expected)
}, 40000)
*/

test('store writes and reads from topic', async () => {
  const topicName = 'newTopicStore'
  cleanup(topicName)
  const written = []
  let accumulator = newAccumulator()
  let cnt = 0

  let store = fsStore.newStore(basePath, 10)
  for (cnt; cnt < 25; cnt++) {
    const obj = { i: cnt }
    store.get(topicName).write(obj)
    written.push(obj)
  }
  store.get(topicName).pipe(accumulator)
  await pause(100)

  expect(accumulator.data()).toStrictEqual(written)
  expect(store.getTopicNames()).toContain(topicName)

  store = fsStore.newStore(basePath, 10)
  for (cnt; cnt < 48; cnt++) {
    const obj = { i: cnt }
    store.get(topicName).write(obj)
    written.push(obj)
  }
  store.get(topicName).pipe(accumulator)
  await pause(200)

  expect(accumulator.data()).toStrictEqual(written)

  accumulator = newAccumulator()
  store.get(topicName).createReadStream(0).pipe(accumulator)
  await pause(100)
  expect(accumulator.data()).toStrictEqual(written)

  accumulator = newAccumulator()
  store.get(topicName).createReadStream(41, 1000).pipe(accumulator)
  await pause(100)
  expect(accumulator.data()).toStrictEqual(written.slice(41))

  accumulator = newAccumulator()
  store.get(topicName).createReadStream(38, 1000).pipe(accumulator)
  await pause(100)
  expect(accumulator.data()).toStrictEqual(written.slice(38))

  // logger.debug(`read to 11`)
  accumulator = newAccumulator()
  store.get(topicName).createReadStream(0, 11).pipe(accumulator)
  await pause(100)
  expect(accumulator.data()).toStrictEqual(written.slice(0, 11))
})
