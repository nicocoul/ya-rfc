module.exports = {
  count: (until, progress) => {
    for (let i = 0; i < until; i++) {
      if (i % 10 === 0) {
        progress(`${i}/${until}`)
      }
    }
    return 'count is finished'
  }
}
