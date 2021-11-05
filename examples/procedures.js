module.exports = {
  count: (count) => {
    let counter = 0
    while (counter < count) {
      counter++
    }
    return counter
  },
  err: (a, b) => {
    throw new Error('some error')
  },
  mult: (a, b, onProgress) => {
    onProgress(`started ${a}*${b}`)
    return a * b
  },
  nores: (a, b, onProgress) => {
  }
}
