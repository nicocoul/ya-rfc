// procedures.js

module.exports = {
  replyWithDelay: (result, delayMs) => {
    return new Promise(resolve => {
      setTimeout(() => resolve(result), delayMs)
    })
  }
}
