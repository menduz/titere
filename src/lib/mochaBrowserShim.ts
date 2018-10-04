declare var window: any

/**
 * This function runs inside the browser.
 * @param reporter
 */
export function initMocha(reporter: keyof typeof Mocha.reporters) {
  console.log = (console => {
    const log = console.log.bind(console)
    return (...args: any[]) => (args.length ? log(...args) : log(''))
  })(console)

  function shimMochaInstance(m: Mocha) {
    const run = m.run.bind(m)

    m.run = () => {
      const all: any[] = []
      const pending: any[] = []
      const failures: any[] = []
      const passes: any[] = []

      function error(err: any) {
        if (!err) return {}

        let res: any = {}
        Object.getOwnPropertyNames(err).forEach(key => (res[key] = err[key]))
        return res
      }

      function clean(test: Mocha.ITest & { err?: any }) {
        return {
          title: test.title,
          fullTitle: test.fullTitle(),
          duration: test.duration,
          err: test.err && error(test.err)
        }
      }

      function result(stats?: Mocha.IStats) {
        return {
          result: {
            stats: {
              tests: all.length,
              passes: passes.length,
              pending: pending.length,
              failures: failures.length,
              start: stats && stats.start && stats.start.toISOString(),
              end: stats && stats.end && stats.end.toISOString(),
              duration: stats && stats.duration
            },
            tests: all.map(clean),
            pending: pending.map(clean),
            failures: failures.map(clean),
            passes: passes.map(clean),
            passed: failures.length === 0
          },
          coverage: window['__coverage__']
        }
      }

      function setResult(this: Mocha.IRunner) {
        !window['__mochaResult__'] && (window['__mochaResult__'] = result(this.stats))
      }

      const runner = run(() => setTimeout(() => setResult.call(runner), 0))
        .on('pass', (test: any) => {
          passes.push(test)
          all.push(test)
        })
        .on('fail', (test: any) => {
          failures.push(test)
          all.push(test)
        })
        .on('pending', (test: any) => {
          pending.push(test)
          all.push(test)
        })
        .on('end', setResult)

      return runner
    }
  }

  function shimMochaProcess(M: any) {
    // Mocha needs a process.stdout.write in order to change the cursor position.
    !M.process && (M.process = {})
    !M.process.stdout && (M.process.stdout = {})

    // tslint:disable-next-line:no-console
    M.process.stdout.write = (data: any) => console.log('stdout:', data)
    M.reporters.Base.useColors = true
    M.reporters.none = function None(runner: Mocha.IRunner) {
      M.reporters.Base.call(this, runner)
    }
  }

  Object.defineProperty(window, 'mocha', {
    get: function() {
      return undefined
    },
    set: function(m) {
      shimMochaInstance(m)
      delete window['mocha']
      window['mocha'] = m
    },
    configurable: true
  })

  Object.defineProperty(window, 'Mocha', {
    get: function() {
      return undefined
    },
    set: function(m) {
      shimMochaProcess(m)
      delete window['Mocha']
      window['Mocha'] = m
    },
    configurable: true
  })
}
