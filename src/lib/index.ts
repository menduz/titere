import path = require('path')
import util = require('util')
import puppeteer = require('puppeteer')
import { getLocalPath } from './downloadChromium'
import { initMocha } from './mochaBrowserShim'
import { readFileSync } from 'fs'

declare var window: any

/**
 * Options to run the mocha-headless-chrome runner.
 */
export interface Options {
  /**
   * Arguments to pass Puppeteer, if any.
   */
  args?: string[]

  /**
   * Chrome executable path, if not the system default.
   */
  executablePath?: string

  /**
   * Path or URL of the page which contains tests.
   */
  file: string

  /**
   * Viewport height.
   */
  height?: number

  /**
   * Mocha reporter name (defaults to "Spec").
   */
  reporter?: string

  /**
   * Viewport width.
   */
  width?: number

  /**
   * Test timeout in ms.
   */
  timeout?: number

  /**
   * Whether to show the Chrome window.
   */
  visible?: boolean
}

/**
 * Description of a runner run.
 */
export interface Run {
  /**
   * Exposed coverage results.
   */
  coverage: object | undefined

  /**
   * Test results.
   */
  result: Result
}

/**
 * Test results from a run.
 */
export interface Result {
  /**
   * Tests that failed.
   */
  failures: TestDescription[]

  /**
   * Tests that passed.
   */
  passed: TestDescription[]

  /**
   * Tests that were pending at completion time.
   */
  pending: TestDescription[]

  /**
   * Test statistics.
   */
  stats: ResultStats

  /**
   * All tests that were run.
   */
  tests: TestDescription[]
}

/**
 * Description of a single test's results.
 */
export interface TestDescription {
  /**
   * How many milliseconds it took to run the test.
   */
  duration: number

  /**
   * Any details for an error that happened during the test, if any.
   */
  err: TestError

  /**
   * Full title of the test.
   */
  fullTitle: string

  /**
   * Friendly title of the test.
   */
  title: string
}

export type TestError = Error | {}

/**
 * Test statistics from a run result.
 */
export interface ResultStats {
  /**
   * How many milliseconds it took to run the tests.
   */
  duration: number

  /**
   * ISO string formatted end time.
   */
  end: string

  /**
   * How many tests failed.
   */
  failures: number

  /**
   * How many tests passed.
   */
  passes: number

  /**
   * How many tests were still pending at completion time.
   */
  pending: number

  /**
   * ISO string formatted start time.
   */
  start: string

  /**
   * How many tests were run.
   */
  tests: number
}

async function configureViewport(width: number, height: number, page: puppeteer.Page) {
  if (!width && !height) return page

  let viewport = page.viewport()
  width && (viewport.width = width)
  height && (viewport.height = height)

  await page.setViewport(viewport)

  return page
}

function handleConsole(msg: any) {
  const args = msg._args

  // tslint:disable-next-line
  Promise.all(args.map((arg: any) => arg.jsonValue())).then((args: any[]) => {
    // process stdout stub
    let isStdout = args[0] === 'stdout:'

    if (isStdout) {
      // tslint:disable-next-line
      args = args.slice(1)
    }

    // tslint:disable-next-line
    let msg = (util.format as any)(...args)
    !isStdout && (msg += '\n')
    process.stdout.write(msg)
  })
}

function prepareUrl(filePath: string) {
  if (/^[a-zA-Z]+:\/\//.test(filePath)) {
    // path is URL
    return filePath
  }

  // local path
  let resolvedPath = path.resolve(filePath)
  return `file://${resolvedPath}`
}

/**
 * Runs client-side mocha tests in the command line through Puppeteer.
 *
 * @returns A Promise for the test results.
 */
export async function run({
  file,
  reporter,
  timeout,
  width,
  height,
  args,
  executablePath,
  visible
}: Options): Promise<Run> {
  // validate options
  if (!file) {
    throw new Error('Test page path is required.')
  }

  let theTimeout = timeout || 60000

  const url = prepareUrl(file)

  const options = {
    ignoreHTTPSErrors: true,
    headless: false,
    args,
    dumpio: true,
    executablePath
  }

  if (!options.executablePath) {
    executablePath = await getLocalPath()
  }

  const browser = await puppeteer.launch(options)
  const page = await browser.newPage()

  await configureViewport(width || 800, height || 600, page)

  page.on('console', handleConsole)
  page.on('dialog', dialog => dialog.dismiss())

  // tslint:disable-next-line:no-console
  page.on('pageerror', err => console.error(err))

  await page.evaluateOnNewDocument(initMocha, reporter)
  await page.goto(url)
  await page.waitForFunction(() => window['__mochaResult__'], { timeout: theTimeout })
  const result = await page.evaluate(() => window['__mochaResult__'])

  await browser.close()

  return result
}

export function serveIndex(compiledTestsLocation: string) {
  return serveRaw(`<script src="${compiledTestsLocation}"></script>`)
}

function sourceUrl(file: string) {
  return JSON.stringify(readFileSync(file) + '\n//# sourceURL=file')
}

export function serveRaw(html: string) {
  return function(req: any, res: any) {
    res.writeHead(200, 'OK', {
      'Content-Type': 'text/html'
    })

    res.write(`<!DOCTYPE html>
      <html>

      <head>
        <title>Mocha Tests</title>
        <meta charset="utf-8">
        <style>
          ${readFileSync(require.resolve('mocha/mocha.css')).toJSON()}
        </style>
      </head>

      <body>
        <div id="mocha"></div>
        <script>
          eval(${sourceUrl(require.resolve('mocha/mocha.js'))})
        </script>
        <script>mocha.setup('bdd');</script>
        ${html}
      </body>

      </html>
    `)

    res.end()
  }
}
