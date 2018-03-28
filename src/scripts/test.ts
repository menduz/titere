import { run, serveRaw } from '../lib'
import http = require('http')

const server = http.createServer(
  serveRaw(`
    <script>
      describe('a', function(){
        it('does something', function(){
          console.log('Hello!!!!1')
        })
      })

      mocha.run()
    </script>
  `)
)

const serverFailure = http.createServer(
  serveRaw(`
    <script>
      describe('testing failures', function(){
        it('this should fail', function(){
          throw new Error('If you see this error message, the test should pass')
        })
      })
      mocha.run()
    </script>
  `)
)

async function doTest() {
  console.log('Testing passing fixture')

  const passingResult = await run({
    file: 'http://localhost:7667',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  console.dir(passingResult)

  console.assert(passingResult.result.passed, 'It should pass')

  const failingResult = await run({
    file: 'http://localhost:7666',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  console.assert(!failingResult.result.passed, 'It should fail')
}

server.listen(7667, function() {
  serverFailure.listen(7666, function() {
    doTest()
      .then(() => process.exit(0))
      .catch(err => {
        console.error(err)
        process.exit(1)
      })
  })
})
