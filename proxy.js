function exec (f, args) {
  console.log(args)
  console.log('execute', f, ...args)
}

const handler = {
  get: function (target, property) {
    return function () {
      // arguments accessible, after all!
      // exec(property, arguments)

      // here you can still invoke the original method, of course
      // target[property].apply(this, arguments)
      const args = []
      for (const arg of arguments) {
        args.push(arg)
      }
      target(property, arguments)
    }
  }
}

const proxy = new Proxy(exec, handler)

proxy.someFunction('toto', 'nono')
