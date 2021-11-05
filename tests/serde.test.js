const { EncodeProtocolStream, DecodeProtocolStream, encodeOne, decodeOne } = require('../serde')
const { newArrayReadable, pause, newAccumulator } = require('./common')
const fs = require('fs')
const path = require('path')

test('it accumulates', async () => {
  const arr = [{ id: 1 }, { id: 2 }, { id: 3 }]
  const readable = newArrayReadable(arr)
  const accumulator = newAccumulator()

  readable.pipe(accumulator)
  await pause(20)
  expect(accumulator.data()).toStrictEqual(arr)
})

test('it serialises then deserialises', async () => {
  const encoder = new EncodeProtocolStream()
  const decoder = new DecodeProtocolStream()
  const arr = [{ id: 1 }, { id: 2 }, { id: 3 }, 'toto', 23, `jiji
    nono`]
  const readable = newArrayReadable(arr)
  const accumulator = newAccumulator()
  readable
    .pipe(encoder)
    .pipe(decoder)
    .pipe(accumulator)
  await pause(20)
  expect(accumulator.data()).toStrictEqual(arr)
})

test('it deserialises', async () => {
  const readable = new fs.createReadStream(path.join(__dirname, 'fixtures', '0-100.top'))
  const decoder = new DecodeProtocolStream()
  const accumulator = newAccumulator()
  readable
    .pipe(decoder)
    .pipe(accumulator)
  await pause(20)
  expect(accumulator.data()).toHaveLength(100)
})

test('it deserialises synchronously', () => {
  const bytesRead = fs.readFileSync(path.join(__dirname, 'fixtures', '0-100.top'))
  const decoder = new DecodeProtocolStream()
  decoder.write(bytesRead)
  let cnt = 0
  while (decoder.read()) cnt++

  expect(cnt).toStrictEqual(100)
})

test('it encodes and decodes one object', () => {
  const encoded = encodeOne({ i: 'ok' })

  expect(decodeOne(encoded)).toStrictEqual({ i: 'ok' })
})
