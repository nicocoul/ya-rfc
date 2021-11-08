module.exports = {
  count: (count, progress) => {
    let counter = 0
    while (counter < count) {
      if (counter % 10 === 0) {
        progress(`${counter}/${count}`)
      }
      counter++
    }
    return counter
  }
}
