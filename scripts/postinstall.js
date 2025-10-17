const { execSync } = require('child_process')
const { existsSync, readFileSync, writeFileSync, mkdirSync, symlinkSync, rmSync, unlinkSync } = require('fs')
const path = require('path')

function log(message) {
  console.log(`[postinstall] ${message}`)
}

function createPackageSymlinks() {
  log('Creating symlinks for Canvas-UI packages...')

  const cwd = process.cwd()

  // Find the consuming project's top-level node_modules directory
  let topLevelNodeModules = cwd
  if (cwd.includes('node_modules/.pnpm/')) {
    // Extract path before .pnpm
    const pnpmIndex = cwd.indexOf('node_modules/.pnpm/')
    topLevelNodeModules = cwd.substring(0, pnpmIndex + 'node_modules'.length)
  } else {
    // Fallback: go up until we find the root node_modules
    topLevelNodeModules = path.resolve(cwd, '../../..')
  }

  const canvasUiDir = path.join(topLevelNodeModules, '@canvas-ui')
  log(`Top-level node_modules: ${topLevelNodeModules}`)
  log(`Target @canvas-ui directory: ${canvasUiDir}`)

  // Ensure the @canvas-ui directory exists
  try {
    mkdirSync(canvasUiDir, { recursive: true })
  } catch (e) {
    log(`Directory already exists or error creating: ${e.message}`)
  }

  const packages = ['react', 'core', 'assert', 'animation']

  packages.forEach(pkg => {
    const symlinkPath = path.join(canvasUiDir, pkg)
    // Target should be relative to the symlinkPath
    // From node_modules/@canvas-ui/{pkg} to node_modules/@canvas-ui/root/packages/{pkg}
    const targetPath = path.join('root', 'packages', pkg)

    log(`Creating symlink: ${symlinkPath} -> ${targetPath}`)

    try {
      // Remove existing symlink or directory if it exists
      if (existsSync(symlinkPath)) {
        log(`Removing existing symlink/directory: ${symlinkPath}`)
        rmSync(symlinkPath, { recursive: true, force: true })
      }

      // Create symlink (use 'junction' on Windows, 'dir' on Unix)
      const symlinkType = process.platform === 'win32' ? 'junction' : 'dir'
      symlinkSync(targetPath, symlinkPath, symlinkType)
      log(`✓ Created symlink for @canvas-ui/${pkg}`)
    } catch (e) {
      log(`Failed to create symlink for @canvas-ui/${pkg}: ${e.message}`)
      console.error(`Failed to create symlink for @canvas-ui/${pkg}:`, e.message)
    }
  })

  log('Symlink creation completed')
}

function restoreOriginalPackageJson() {
  const backupPath = path.join(__dirname, '../.package.json.backup')
  const pkgPath = path.join(__dirname, '../package.json')

  if (!existsSync(backupPath)) {
    log('No backup found, skipping restore')
    return
  }

  try {
    const originalPkg = readFileSync(backupPath, 'utf-8')
    writeFileSync(pkgPath, originalPkg, 'utf-8')
    unlinkSync(backupPath)
    log('✓ Restored original package.json')
  } catch (e) {
    log(`Failed to restore package.json: ${e.message}`)
  }
}

function main() {
  log('=== Postinstall script started (git install) ===')
  log(`CWD: ${process.cwd()}`)

  // Skip if explicitly disabled
  if (process.env.SKIP_BUILD === '1' || process.env.SKIP_POSTINSTALL === '1') {
    log('Skipping: SKIP_BUILD or SKIP_POSTINSTALL is set')
    process.exit(0)
  }

  // Build packages
  log('Building Canvas-UI for GitHub installation...')
  try {
    // Clean dist directories (use rm instead of pnpm distclean to avoid dependency on rimraf)
    execSync('rm -rf packages/*/dist packages/*/.tsbuildinfo out/*/dist out/*/.tsbuildinfo', { stdio: 'inherit' })

    // Build packages
    execSync('pnpm --filter "@canvas-ui/*" --filter "!@canvas-ui/docs" run --stream build', { stdio: 'inherit' })

    // Build root bundle
    execSync('NODE_OPTIONS=--max_old_space_size=4096 rollup -c', { stdio: 'inherit' })

    log('✓ Build completed successfully')
  } catch (e) {
    log(`Build failed: ${e.message}`)
    console.error('Build failed:', e.message)
    process.exit(1)
  }

  // Create symlinks
  createPackageSymlinks()

  // Restore original package.json
  restoreOriginalPackageJson()

  log('=== Postinstall script completed ===')
}

main()
