module.exports = {
  count: (until, progress) => {
    const x = parseInt(until / 10)
    for (let i = 0; i < until; i++) {
      if (i % x === 0) {
        progress(`${i}/${until}`)
      }
    }
    return until
  }
}
