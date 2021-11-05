const { newWrapper } = require('../common')
const { pause, newAccumulator } = require('./common')

test('wrapper wraps', async () => {
  const wrapper = newWrapper('topic', 10)
  const acc = newAccumulator()
  wrapper.write(1)
  wrapper.write(2)

  wrapper.pipe(acc)
  await pause(50)

  expect(acc.data()).toStrictEqual([{ m: 1, o: 10, t: 'topic' }, { m: 2, o: 11, t: 'topic' }])
})
