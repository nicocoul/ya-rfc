'use strict'
function newChannels () {
  const state = {}
  return {
    set: (c) => {
      state[c.id] = c
    },
    getById: (id) => {
      return state[id]
    },
    removeById: (id) => {
      delete state[id]
    }
  }
}

module.exports = { newChannels }
