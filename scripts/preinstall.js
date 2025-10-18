const { readFileSync, writeFileSync, existsSync } = require('fs')
const path = require('path')

function log(message) {
  console.log(`[preinstall] ${message}`)
}

function isInTmpDirectory() {
  const cwd = process.cwd()
  // pnpm prepares git deps in store tmp directory
  return /[/\\]pnpm[/\\]store[/\\]v\d+[/\\]tmp[/\\]/.test(cwd)
}

function isGitInstall() {
  const lifecycleEvent = process.env.npm_lifecycle_event
  const cwd = process.cwd()

  // pnpm uses synthetic lifecycle events for git deps
  const isPnpmGitEvent = [
    'npm-install',
    'yarn-install',
    'pnpm-install'
  ].includes(lifecycleEvent)

  // pnpm prepares git deps in store tmp directory
  const isPnpmStoreTmp = isInTmpDirectory()

  // Detect GitHub URL in path
  const hasGitHubUrl = /codeload\.github\.com|github\.com.*\.tar\.gz/.test(cwd)

  return isPnpmGitEvent || isPnpmStoreTmp || hasGitHubUrl
}

function collectSubPackageDependencies() {
  const packages = ['react', 'core', 'assert', 'animation']
  const allDeps = {}
  const allDevDeps = {}

  for (const pkg of packages) {
    const pkgPath = path.join(__dirname, '../packages', pkg, 'package.json')
    if (!existsSync(pkgPath)) {
      log(`Warning: ${pkg} package.json not found`)
      continue
    }

    const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf-8'))

    // Collect dependencies (skip workspace:* deps)
    if (pkgJson.dependencies) {
      for (const [name, version] of Object.entries(pkgJson.dependencies)) {
        if (!version.startsWith('workspace:')) {
          allDeps[name] = version
        }
      }
    }

    // Collect devDependencies (skip workspace:* deps)
    if (pkgJson.devDependencies) {
      for (const [name, version] of Object.entries(pkgJson.devDependencies)) {
        if (!version.startsWith('workspace:')) {
          allDevDeps[name] = version
        }
      }
    }
  }

  return { dependencies: allDeps, devDependencies: allDevDeps }
}

function main() {
  log('Starting...')

  // Check if this is a git install
  if (!isGitInstall()) {
    log('Not a git install, skipping package.json modification')
    process.exit(0)
  }

  // Only modify package.json in tmp directory (first run)
  // Skip in final node_modules location (second run)
  if (!isInTmpDirectory()) {
    log('Not in tmp directory (final location), skipping package.json modification')
    process.exit(0)
  }

  log('Git install detected (in tmp directory), modifying package.json...')

  // Read current package.json
  const pkgPath = path.join(__dirname, '../package.json')
  const originalPkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))

  // Save backup
  const backupPath = path.join(__dirname, '../.package.json.backup')
  writeFileSync(backupPath, JSON.stringify(originalPkg, null, 2), 'utf-8')
  log(`Saved backup to ${backupPath}`)

  // Collect dependencies from sub-packages
  const { dependencies, devDependencies } = collectSubPackageDependencies()
  log(`Collected ${Object.keys(dependencies).length} dependencies`)
  log(`Collected ${Object.keys(devDependencies).length} devDependencies`)

  // Create modified package.json
  const modifiedPkg = {
    ...originalPkg,
    dependencies: {
      ...originalPkg.dependencies,
      ...dependencies
    },
    devDependencies: {
      ...originalPkg.devDependencies,
      ...devDependencies
    }
  }

  // Write modified package.json
  writeFileSync(pkgPath, JSON.stringify(modifiedPkg, null, 2), 'utf-8')
  log('Modified package.json written')
}

main()
