import puppeteer = require('puppeteer')
const ProgressBar = require('progress')

const revision = require('puppeteer/package.json').puppeteer.chromium_revision
const browserFetcher = (puppeteer as any)['createBrowserFetcher']()

let progressBar: any | null = null
let lastDownloadedBytes = 0

function onProgress(downloadedBytes: number, totalBytes: number) {
  if (!progressBar) {
    progressBar = new ProgressBar(
      `Downloading Chromium r${revision} - ${toMegabytes(totalBytes)} [:bar] :percent :etas `,
      {
        complete: '=',
        incomplete: ' ',
        width: 20,
        total: totalBytes
      }
    )
  }
  const delta = downloadedBytes - lastDownloadedBytes
  lastDownloadedBytes = downloadedBytes
  progressBar.tick(delta)
}

function toMegabytes(bytes: number) {
  const mb = bytes / 1024 / 1024
  return `${Math.round(mb * 10) / 10} Mb`
}

export async function getLocalPath() {
  let revisionInfo = browserFetcher.revisionInfo(revision)

  if (revisionInfo.local) {
    return revisionInfo.local
  } else {
    await browserFetcher.download(revisionInfo.revision, onProgress)
    revisionInfo = browserFetcher.revisionInfo(revision)
    // tslint:disable-next-line:no-console
    console.log('Chromium downloaded to ' + revisionInfo.folderPath)
    return revisionInfo.local
  }
}
