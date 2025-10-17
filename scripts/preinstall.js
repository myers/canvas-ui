const { readFileSync, writeFileSync, existsSync } = require('fs')
const path = require('path')

function log(message) {
  console.log(`[preinstall] ${message}`)
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
  const isPnpmStoreTmp = /[/\\]pnpm[/\\]store[/\\]v\d+[/\\]tmp[/\\]/.test(cwd)

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

  log('Git install detected, modifying package.json...')

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
    },
    scripts: {
      ...originalPkg.scripts,
      postinstall: 'node scripts/postinstall.js'
    }
  }

  // Write modified package.json
  writeFileSync(pkgPath, JSON.stringify(modifiedPkg, null, 2), 'utf-8')
  log('Modified package.json written')
  log(`Added postinstall script: ${modifiedPkg.scripts.postinstall}`)
}

main()
