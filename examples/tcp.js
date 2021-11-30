const path = require('path')
const ya = require('../index.js')

ya.broker([ya.transports.tcp(8005)])

const modulePath = path.join(__dirname, 'procedures.js')
ya.server(ya.transports.tcp(8005, 'localhost'), modulePath)

const client = ya.client(ya.transports.tcp(8005, 'localhost'))

client.remote.count(10000, {
  onProgress: (progress) => {
    console.log('progress', progress)
  },
  onStatus: (status) => {
    console.log('status', status)
  }
})
  .then(result => {
    console.log(result)
  })
  .catch(error => {
    console.error(error)
  })

/* output:
status scheduled
status started
progress 0/10000
progress 1000/10000
progress 2000/10000
progress 3000/10000
progress 4000/10000
progress 5000/10000
progress 6000/10000
progress 7000/10000
progress 8000/10000
progress 9000/10000
status end
result is 10000
*/
