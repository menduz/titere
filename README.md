# titere

Yet another run mocha in the browser using puppeteer package.

The usage is super simple:

```ts
// tests/index.js
// vanilla js or generated using webpack

describe('a', function() {
  it('does something', function() {
    console.log('Hello!!!!1')
  })
})

// we control when do we run mocha.
mocha.run()
```

```ts
import express = require('express')
import { run, serveIndex } from 'titere'

const app = express()

// specify what test to run
app.get('/', serveIndex('tests/index.js'))

// we do this to serve the test file
app.use('/tests', express.static('./tests/'))

app.listen(7667, function() {
  // once we are listening, trigger the test
  doTest()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err)
      process.exit(1)
    })
})

async function doTest() {
  const passingResult = await run({
    file: 'http://localhost:7667'
  })

  console.assert(passingResult.result.passed, 'It should pass')
}
```
