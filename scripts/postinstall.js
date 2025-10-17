const { execSync } = require('child_process')
const { existsSync, appendFileSync, mkdirSync } = require('fs')
const path = require('path')

// Setup logging
const logDir = path.join(__dirname, '../logs')
try {
  mkdirSync(logDir, { recursive: true })
} catch (e) {}
const logFile = path.join(logDir, `postinstall-${Date.now()}-${process.pid}.log`)

function log(message) {
  const timestamp = new Date().toISOString()
  const logLine = `[${timestamp}] ${message}\n`
  try {
    appendFileSync(logFile, logLine)
  } catch (e) {}
  console.log(message)
}

log('=== Postinstall script started ===')
log(`CWD: ${process.cwd()}`)
log(`npm_lifecycle_event: ${process.env.npm_lifecycle_event}`)
log(`Process PID: ${process.pid}`)

// Skip if explicitly disabled
if (process.env.SKIP_BUILD === '1' || process.env.SKIP_POSTINSTALL === '1') {
  log('Skipping: SKIP_BUILD or SKIP_POSTINSTALL is set')
  process.exit(0)
}

// Detect if this is a git install via pnpm's synthetic script names
// pnpm creates 'npm-install', 'yarn-install', or 'pnpm-install' scripts
// ONLY when preparing git dependencies
const lifecycleEvent = process.env.npm_lifecycle_event
log(`Lifecycle event: ${lifecycleEvent}`)

// Detect git install via pnpm's store tmp directory pattern
// pnpm prepares git dependencies in /pnpm/store/v{version}/tmp/
const cwd = process.cwd()
const isPnpmStoreTmp = /[/\\]pnpm[/\\]store[/\\]v\d+[/\\]tmp[/\\]/.test(cwd)
log(`Is pnpm store tmp: ${isPnpmStoreTmp}`)

const isGitInstall =
  lifecycleEvent === 'npm-install' ||
  lifecycleEvent === 'yarn-install' ||
  lifecycleEvent === 'pnpm-install' ||
  isPnpmStoreTmp
log(`Is git install: ${isGitInstall}`)

// Skip if already installed in node_modules (build already completed)
const inNodeModules = cwd.includes('node_modules')
log(`In node_modules: ${inNodeModules}`)
if (inNodeModules) {
  const distPath = path.join(cwd, 'packages/core/dist')
  const isAlreadyBuilt = existsSync(distPath)
  log(`Dist path: ${distPath}`)
  log(`Already built: ${isAlreadyBuilt}`)
  if (isAlreadyBuilt) {
    log('Skipping: Already built in node_modules')
    process.exit(0)
  }
}

// Skip if installed as sub-dependency in local development
// (Don't skip for git installs - the ../../package.json would be the consuming project)
if (!isGitInstall) {
  const isSubDependency = existsSync('../../package.json')
  log(`Is sub-dependency: ${isSubDependency}`)
  if (isSubDependency) {
    log('Skipping: Sub-dependency in local development')
    process.exit(0)
  }
}

if (isGitInstall) {
  // Git install: build production files
  log('Building Canvas-UI for GitHub installation...')
  try {
    execSync('sh ./tools/build.sh', { stdio: 'inherit' })
    log('Build completed successfully')
  } catch (e) {
    log(`Build failed: ${e.message}`)
    console.error('Build failed:', e.message)
    process.exit(1)
  }
} else {
  // Local development: TypeScript build only for fast linking
  log('Running local TypeScript build...')
  try {
    execSync('pnpm --filter "@canvas-ui/*" --filter "!@canvas-ui/docs" run --stream build', { stdio: 'inherit' })
    log('TypeScript build completed successfully')
  } catch (e) {
    log(`TypeScript build failed: ${e.message}`)
    console.error('Failed to run TypeScript build:', e.message)
    process.exit(1)
  }
}

log('=== Postinstall script completed ===')

