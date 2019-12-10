import exitCodes from '../lib/exit-codes'
import { IgniteDetectInstall, IgniteToolbox } from '../types'

/**
 * Install this module.
 */
async function importPlugin(toolbox: IgniteToolbox, opts: IgniteDetectInstall): Promise<string | void> {
  const { isEmpty, forEach, trim } = require('ramda')
  const { moduleName, version, type, directory } = opts
  const { ignite, system, filesystem } = toolbox
  const { log } = ignite
  const isDirectory = type === 'directory'
  const target = isDirectory ? directory : moduleName
  const packageVersion = version && !isDirectory ? `@${version}` : ''

  // check to see if it exists first
  if (type === 'npm') {
    try {
      const json = JSON.parse(await system.run(`npm info ${target}${packageVersion} --json`))
      log(`${json.name} ${json.version} on npm.`)
    } catch (e) {
      log(`unable to find ${target} on npm`)

      // Try getting it from URL
      const https = require('https')
      let exists
      if (!moduleName.includes('https://')) {
        try {
          exists = await https.get(`https://github.com/${moduleName}`)
        } catch (err) {
          log(`unable to fetch https://github.com/${moduleName}`)
        }
      } else {
        try {
          exists = await https.get(moduleName)
        } catch (err) {
          log(`unable to fetch ${moduleName}`)
        }
      }

      if (!exists) {
        const boom = new Error(e.message) as any
        boom.unavailable = true
        boom.name = target
        throw boom
      }
    }
  }

  if (ignite.useYarn) {
    if (isDirectory) {
      // where is the yarn cache?
      log(`checking for yarn cache`)
      const rawCacheDir = await system.exec('yarn cache dir')

      // look for a cached version of this
      const dirs = filesystem.cwd(rawCacheDir).find({
        matching: `npm-${moduleName}-*`,
        directories: true,
        recursive: false,
      })

      // clear existing cache if we have one
      if (!isEmpty(dirs)) {
        forEach(dir => {
          log(`removing yarn cache ${rawCacheDir}/${dir}`)
          filesystem.remove(`${rawCacheDir}/${dir}`)
        }, dirs)
      }
    }
    const cmd = isDirectory ? `yarn add file:${target} --force --dev` : `yarn add ${target}${packageVersion} --dev`
    log(cmd)
    const output = await system.run(cmd)
    log('finished yarn command')
    const regexpMatch = output.match(/(@?[a-zA-Z0-9-\/]*)@.*/)
    if (regexpMatch.length >= 2) {
      return regexpMatch[1]
    }
  } else {
    const cacheBusting = isDirectory ? '--cache-min=0' : ''
    const cmd = trim(`npm i ${target}${packageVersion} --save-dev ${cacheBusting}`)
    log(cmd)
    const output = await system.run(cmd)
    log('finished npm command')
    const regexpMatch = output.match(/\+ (@?[a-zA-Z0-9-\/]*)@.*/)
    if (regexpMatch.length >= 2) {
      return regexpMatch[1]
    }
  }
}

/**
 * This does everything around the periphery of importing a plugin such
 * as UI and safety checks.
 */
export default async (toolbox: IgniteToolbox, specs: IgniteDetectInstall): Promise<number | string | void> => {
  const { moduleName } = specs
  const { print, ignite } = toolbox
  const { log } = ignite
  const spinner = print.spin(`adding ${print.colors.cyan(moduleName)}`)

  if (specs.type) {
    try {
      const installedPackageName = await importPlugin(toolbox, specs)
      spinner.succeed(`Added ${print.colors.cyan(moduleName)}`)
      return installedPackageName
    } catch (e) {
      if (e.unavailable) {
        log(e.message)
        spinner.fail(`${print.colors.bold(moduleName)} is not available on npm.`)
        print.info('')
        print.info(print.colors.muted('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-'))
        print.error('  We also searched in these directories:\n')
        ignite.pluginOverrides.forEach(dir => {
          print.info(`    ▸ ${dir}`)
        })
        print.info(print.colors.muted('-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-'))
      } else {
        spinner.fail(`${print.colors.red(moduleName)} was not able to be installed. Is it a valid NPM module?`)
        print.error('----------')
        print.error(e.message)
        print.error('----------')
      }
      return exitCodes.PLUGIN_INVALID
    }
  } else {
    spinner.fail(`💩  invalid ignite plugin`)
    return exitCodes.PLUGIN_INVALID
  }
}
