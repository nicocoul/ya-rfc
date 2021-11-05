'use strict'
/* eslint-disable no-extend-native */

Array.prototype.remove = function (filter) {
  const indices = []
  this.forEach((el, index) => {
    if (filter(el)) {
      indices.push(index)
    }
  })
  for (let i = indices.length - 1; i > -1; i--) {
    this.splice(indices[i], 1)
  }
}
