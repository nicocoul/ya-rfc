const store = require('../lib/memory-store')
// const { newPassTrough } = require('../common')
const { newAccumulator, pause } = require('../lib/common')
const { newReadable } = require('../lib/common')
const logger = require('../lib/logger')(__filename)

test('it works', async () => {
  const topicName = 'newTopic2'
  const expected = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  const topic = store.newTopic(topicName, 100)
  let accumulator = newAccumulator()

  const input = newReadable(expected)
  expected.forEach(m => input.push(m))
  input.pipe(topic)
  topic.createReadStream(0).pipe(accumulator)
  await pause(100)

  // expect(accumulator.data().map(d => d.o)).toStrictEqual(expected)
  expect(accumulator.data()).toStrictEqual(expected)

  accumulator = newAccumulator()
  topic.createReadStream(0).pipe(accumulator)
  await pause(50)
  expect(accumulator.data()).toStrictEqual(expected)
})

test('it works when data was already streamed', async () => {
  const topicName = 'newTopic2'
  const expected = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  const topic = store.newTopic(topicName, 100)
  let accumulator = newAccumulator()

  const input = newReadable(expected)
  expected.forEach(m => input.push(m))
  input.pipe(topic)
  topic.pipe(newAccumulator())
  topic.createReadStream(0).pipe(accumulator)
  await pause(100)

  // expect(accumulator.data().map(d => d.o)).toStrictEqual(expected)
  expect(accumulator.data()).toStrictEqual(expected)

  accumulator = newAccumulator()
  topic.createReadStream(0).pipe(accumulator)
  await pause(50)
  expect(accumulator.data()).toStrictEqual(expected)
})

test('it streams to multiple', async () => {
  const topicName = 'newTopic3'
  const expected = [0, 1, 2, 3]

  const topic = store.newTopic(topicName, 1000)
  const input = newReadable(expected)
  expected.forEach(m => input.push(m))

  input.pipe(topic)

  const accumulator1 = newAccumulator()
  const accumulator2 = newAccumulator()

  topic.createReadStream(0).pipe(accumulator1)
  topic.createReadStream(0).pipe(accumulator2)
  await pause(20)

  expect(accumulator1.data()).toStrictEqual(expected)
  expect(accumulator2.data()).toStrictEqual(expected)

  logger.debug('push 4')
  input.push(4)
  expected.push(4)
  await pause(20)

  expect(accumulator1.data()).toStrictEqual(expected)
  expect(accumulator2.data()).toStrictEqual(expected)
})

test('it streams from offset', async () => {
  const topicName = 'newTopic3'
  const expected = [0, 1, 2, 3]

  const topic = store.newTopic(topicName, 1000)
  const input = newReadable(expected)
  expected.forEach(m => input.push(m))

  input.pipe(topic)

  const accumulator1 = newAccumulator()
  topic.createReadStream(1).pipe(accumulator1)
  await pause(20)
  expect(accumulator1.data()).toStrictEqual([1, 2, 3])

  const accumulator2 = newAccumulator()
  topic.createReadStream(1).pipe(accumulator2)
  await pause(20)
  expect(accumulator2.data()).toStrictEqual([1, 2, 3])
})

test('it purges', async () => {
  const topicName = 'newTopic3'
  const expected = [0, 1, 2, 3]

  const topic = store.newTopic(topicName, 100)
  const input = newReadable(expected)
  expected.forEach(m => input.push(m))
  input.pipe(topic)
  await pause(150)

  logger.debug('push 4 & 5')
  input.push(4)
  expected.push(4)
  input.push(5)
  expected.push(5)
  await pause(10)

  const accumulator1 = newAccumulator()
  topic.createReadStream(4).pipe(accumulator1)
  await pause(20)
  expect(topic.firstReadableOffset()).toStrictEqual(4)
  expect(topic.count()).toStrictEqual(6)
  expect(accumulator1.data()).toStrictEqual([4, 5])
})

test('it is offsettable', async () => {
  const topicName = 'newTopic4'
  const expected = [0, 1, 2, 3]

  const topic = store.newTopic(topicName, 100, 5)
  const input = newReadable(expected)
  expected.forEach(m => input.push(m))
  input.pipe(topic)
  await pause(150)

  logger.debug('push 4 & 5')
  input.push(4)
  expected.push(4)
  input.push(5)
  expected.push(5)
  await pause(10)

  const accumulator1 = newAccumulator()
  topic.createReadStream(9).pipe(accumulator1)
  await pause(20)
  expect(topic.firstReadableOffset()).toStrictEqual(9)
  expect(topic.count()).toStrictEqual(11)
  expect(accumulator1.data()).toStrictEqual([4, 5])
})
/**/
