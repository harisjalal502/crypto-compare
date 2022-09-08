import { GluegunToolbox } from "../types"
import { spawnProgress } from "../tools/spawn"
import { isAndroidInstalled, copyBoilerplate, renameReactNativeApp } from "../tools/react-native"
import { packager, PackagerName } from "../tools/packager"
import {
  command,
  heading,
  p,
  startSpinner,
  stopSpinner,
  clearSpinners,
  ascii,
  em,
  link,
  ir,
  prefix,
  format,
  highlight,
  pkgBgColor,
} from "../tools/pretty"
import type { ValidationsExports } from "../tools/validations"
import { boolFlag } from "../tools/flag"
import { cache } from "../tools/cache"

// CLI tool versions we support
const deps: { [k: string]: string } = {
  podInstall: "0.1",
}

export interface Options {
  /**
   * alias for `boilerplate`
   *
   * Input Source: `parameter.option`
   * @deprecated flag left in for backwards compatability, warn them to use old Ignite
   * @default undefined
   */
  b?: string
  /**
   * Input Source: `parameter.option`
   * @deprecated flag left in for backwards compatability, warn them to use old Ignite
   * @default undefined
   */
  boilerplate?: string
  /**
   * custom bundle identifier for iOS and Android
   *
   * Input Source: `prompt.ask` | `parameter.option`
   * @default `com.${name}`
   * @example 'com.pizzaapp'
   */
  bundle?: string
  /**
   * React Native Colo Loco is no longer installed with Ignite,
   * but we will give instructions on how to install it if they pass in `--colo-loco`   *
   *
   * Input Source: `parameter.option`
   * @default false
   */
  coloLoco?: boolean
  /**
   * Log raw parameters for debugging, run formatting script not quietly
   *
   * Input Source: `parameter.option`
   * @default false
   */
  debug?: boolean
  /**
   * Create new git repository and create an inital commit with boilerplate changes
   *
   * Input Source: `prompt.ask` | `parameter.option`
   * @default true
   */
  git?: boolean
  /**
   * Whether or not to run packager install script after project is created
   *
   * Input Source: `prompt.ask` | `parameter.option`
   * @default true
   */
  installDeps?: boolean
  /**
   * Remove existing directory otherwise throw if exists
   *
   * Input Source: `prompt.ask` | `parameter.option`
   * @default false
   */
  overwrite?: boolean
  /**
   * Input Source: `parameter.option`
   * @deprecated this option is deprecated. Ignite sets you up to run native or Expo
   * @default undefined
   */
  expo?: boolean
  /**
   * Package manager to install dependencies with
   *
   * Input Source: `prompt.ask`| `parameter.option`
   */
  packager?: "npm" | "yarn" | "pnpm"
  /**
   * The target directory where the project will be created.
   *
   * Input Source: `prompt.ask` | `parameter.option`
   * @default `${cwd}/${projectName}`
   */
  targetPath?: string
  /**
   * Whether or not to use the dependency cache to speed up installs
   * Input Source: `parameter.option`
   * @default true
   */
  useCache?: boolean
  /**
   * alias for `yes`
   *
   * Whether or not to accept the default options for all prompts
   *
   * Input Source: `parameter.option`
   * @default false
   */
  y?: boolean
  /**
   * Whether or not to accept the default options for all prompts
   * Input Source: `parameter.option`
   * @default false
   */
  yes?: boolean
}

export default {
  run: async (toolbox: GluegunToolbox) => {
    // #region Toolbox
    const { print, filesystem, system, meta, parameters, strings, prompt } = toolbox
    const { kebabCase } = strings
    const { exists, path, remove, copy, read, write } = filesystem
    const { info, colors, warning } = print
    const { gray, cyan, yellow, underline } = colors
    const options: Options = parameters.options

    const yname = boolFlag(options.y) || boolFlag(options.yes)
    const useDefault = (option: unknown) => yname && option === undefined
    // #endregion

    // #region Debug
    // start tracking performance
    const perfStart = new Date().getTime()

    // debug?
    const debug = boolFlag(options.debug)
    const log = <T = unknown>(m: T): T => {
      debug && info(` ${m}`)
      return m
    }

    // log raw parameters for debugging
    log(`ignite command: ${parameters.argv.join(" ")}`)
    // #endregion

    // #region Project Name
    // retrieve project name from toolbox
    const { validateProjectName } = require("../tools/validations") as ValidationsExports
    const projectName = await validateProjectName(toolbox)
    const projectNameKebab = kebabCase(projectName)
    // #endregion

    // #region Boilerplate
    // if they pass in --boilerplate, warn them to use old Ignite
    const bname = options.b || options.boilerplate
    if (bname) {
      p()
      p(yellow(`Different boilerplates are no longer supported in Ignite v4+.`))
      p(gray(`To use the old CLI to support different boilerplates, try:`))
      p(cyan(`npx ignite-cli@3 new ${projectName} --boilerplate ${bname}`))
      process.exit(1)
    }
    // #endregion

    // #region Bundle Identifier
    const defaultBundleIdentifier = `com.${projectName.toLowerCase()}`
    let bundleIdentifier = useDefault(options.bundle) ? defaultBundleIdentifier : options.bundle

    if (bundleIdentifier === undefined) {
      const bundleIdentifierResponse = await prompt.ask(() => ({
        type: "input",
        name: "bundleIdentifier",
        message: "What bundle identifier?",
        initial: defaultBundleIdentifier,
        prefix,
      }))

      bundleIdentifier = bundleIdentifierResponse.bundleIdentifier
    }

    const { validateBundleIdentifier } = require("../tools/validations") as ValidationsExports
    validateBundleIdentifier(toolbox, bundleIdentifier)

    // #endregion

    // #region Project Path
    const defaultTargetPath = path(projectName)
    let targetPath = useDefault(options.targetPath) ? defaultTargetPath : options.targetPath
    if (targetPath === undefined) {
      const targetPathResponse = await prompt.ask(() => ({
        type: "input",
        name: "targetPath",
        message: "Where do you want to start your project?",
        initial: defaultTargetPath,
        prefix,
      }))

      targetPath = targetPathResponse.targetPath
    }

    // #endregion

    // #region Prompt Overwrite
    // if they pass in --overwrite, remove existing directory otherwise throw if exists
    const defaultOverwrite = false
    let overwrite = useDefault(options.overwrite) ? defaultOverwrite : boolFlag(options.overwrite)

    if (exists(targetPath) && overwrite === undefined) {
      const overwriteResponse = await prompt.ask<{ overwrite: boolean }>(() => ({
        type: "confirm",
        name: "overwrite",
        message: `Directory ${targetPath} already exists. Do you want to overwrite it?`,
        initial: defaultOverwrite,
        format: format.boolean,
        prefix,
      }))
      overwrite = overwriteResponse.overwrite
    }

    if (exists(targetPath) && overwrite === false) {
      const alreadyExists = `Error: There's already a folder at ${targetPath}. To force overwriting that folder, run with --overwrite or say yes.`
      p()
      p(yellow(alreadyExists))
      process.exit(1)
    }
    // #endregion

    // #region Prompt Git Option
    const defaultGit = true
    let git = useDefault(options.git) ? defaultGit : options.git

    if (git === undefined) {
      const gitResponse = await prompt.ask<{ git: boolean }>(() => ({
        type: "confirm",
        name: "git",
        message: "Do you want to initialize a git repository?",
        initial: defaultGit,
        format: format.boolean,
        prefix,
      }))
      git = gitResponse.git
    }
    // #endregion

    // #region Packager
    // check if a packager is provided, or detect one
    // we pass in expo because we can't use pnpm if we're using expo

    const availablePackagers = packager.availablePackagers()
    const defaultPackagerName = availablePackagers.includes("yarn") ? "yarn" : "npm"
    let packagerName = useDefault(options.packager) ? defaultPackagerName : options.packager

    const validatePackagerName = (input: unknown): input is PackagerName =>
      typeof input === "string" && ["npm", "yarn", "pnpm"].includes(input)

    if (packagerName !== undefined && validatePackagerName(packagerName) === false) {
      p()
      p(yellow(`Error: Invalid packager: "${packagerName}". Valid packagers are npm, yarn, pnpm.`))
      process.exit(1)
    }

    if (packagerName !== undefined && availablePackagers.includes(packagerName) === false) {
      p()
      p(yellow(`Error: selected "${packagerName}" but packager was not available on system`))
      process.exit(1)
    }

    if (packagerName === undefined) {
      const initial = availablePackagers.findIndex((p) => p === defaultPackagerName)
      const NOT_FOUND = -1

      if (initial === NOT_FOUND) {
        p()
        p(yellow(`Error: Default packager "${defaultPackagerName}" was not available on system`))
        process.exit(1)
      }

      const packagerNameResponse = await prompt.ask<{ packagerName: PackagerName }>(() => ({
        type: "select",
        name: "packagerName",
        message: "Which package manager do you want to use?",
        choices: availablePackagers,
        initial,
        prefix,
      }))
      packagerName = packagerNameResponse.packagerName
    }

    const packagerOptions = { packagerName }

    const ignitePath = path(`${meta.src}`, "..")
    const boilerplatePath = path(ignitePath, "boilerplate")
    log(`ignitePath: ${ignitePath}`)
    log(`boilerplatePath: ${boilerplatePath}`)

    const defaultInstallDeps = true
    let installDeps = useDefault(options.installDeps)
      ? defaultInstallDeps
      : boolFlag(options.installDeps)
    if (installDeps === undefined) {
      const installDepsResponse = await prompt.ask<{ installDeps: boolean }>(() => ({
        type: "confirm",
        name: "installDeps",
        message: "Do you want to install dependencies?",
        initial: defaultInstallDeps,
        format: format.boolean,
        prefix,
      }))
      installDeps = installDepsResponse.installDeps
    }
    // #endregion

    // #region Expo
    // show warning about --expo going away
    const expo = boolFlag(options.expo)
    if (expo) {
      warning(
        " Detected --expo, this option is deprecated. Ignite sets you up to run native or Expo!",
      )
      p()
    }
    // #endregion

    // #region Print Welcome
    // welcome everybody!
    const terminalWidth = process.stdout.columns ?? 80
    const logo =
      terminalWidth > 80 ? () => ascii("logo.ascii.txt") : () => ascii("logo-sm.ascii.txt")
    p()
    p()
    p()
    p()
    logo()
    p()
    p()

    const pkg = pkgBgColor(packagerName)
    p(` █ Creating ${highlight(` ${projectName} `)} using ${ir(` Ignite ${meta.version()} `)}`)
    p(` █ Powered by ${ir(" ∞ Infinite Red ")} (${link("https://infinite.red")})`)
    p(` █ Package Manager: ${pkg(em(` ${packagerName} `))}`)
    p(` █ Bundle identifier: ${em(bundleIdentifier)}`)
    p(` █ Path: ${underline(targetPath)}`)
    p(` ────────────────────────────────────────────────\n`)
    // #endregion

    // #region Overwrite
    if (exists(targetPath) === "dir" && overwrite === true) {
      const msg = ` Tossing that old app like it's hot`
      startSpinner(msg)
      remove(targetPath)
      stopSpinner(msg, "🗑️")
    }
    // Remove some folders that we don't want to copy over
    // This mostly only applies to when you're developing locally
    remove(path(boilerplatePath, "ios", "Pods"))
    remove(path(boilerplatePath, "node_modules"))
    remove(path(boilerplatePath, "android", ".idea"))
    remove(path(boilerplatePath, "android", ".gradle"))
    // #endregion

    // #region Copy Boilerplate Files
    startSpinner(" 3D-printing a new React Native app")
    await copyBoilerplate(toolbox, {
      boilerplatePath,
      targetPath,
      excluded: [".vscode", "node_modules", "yarn.lock"],
      overwrite,
    })
    stopSpinner(" 3D-printing a new React Native app", "🖨")

    // note the original directory
    const cwd = log(process.cwd())

    // jump into the project to do additional tasks
    process.chdir(targetPath)

    // copy the .gitignore if it wasn't copied over
    // Release Ignite installs have the boilerplate's .gitignore in .gitignore.template
    // (see https://github.com/npm/npm/issues/3763); development Ignite still
    // has it in .gitignore. Copy it from one or the other.
    const targetIgnorePath = log(path(process.cwd(), ".gitignore"))
    if (!exists(targetIgnorePath)) {
      // gitignore in dev mode?
      let sourceIgnorePath = log(path(boilerplatePath, ".gitignore"))

      // gitignore in release mode?
      if (!exists(sourceIgnorePath)) {
        sourceIgnorePath = log(path(boilerplatePath, ".gitignore.template"))
      }

      // copy the file over
      copy(sourceIgnorePath, targetIgnorePath)
    }
    // #endregion

    // #region Handle package.json
    // Update package.json:
    // - We need to replace the app name in the detox paths. We do it on the
    //   unparsed file content since that's easier than updating individual values
    //   in the parsed structure, then we parse that as JSON.
    // - If Expo, we also merge in our extra expo stuff.
    // - Then write it back out.
    let packageJsonRaw = read("package.json")
    packageJsonRaw = packageJsonRaw
      .replace(/HelloWorld/g, projectName)
      .replace(/hello-world/g, projectNameKebab)
    const packageJson = JSON.parse(packageJsonRaw)

    write("./package.json", packageJson)

    // TODO: still need this in this order, was an if (expo) ?
    // for some reason we need to do this, or we get an error about duplicate RNCSafeAreaProviders
    // see https://github.com/th3rdwave/react-native-safe-area-context/issues/110#issuecomment-668864576
    // await packager.add(`react-native-safe-area-context`, packagerOptions)
    // #endregion

    // #region Run Packager Install
    // pnpm/yarn/npm install it

    // check if there is a dependency cache using a hash of the package.json
    const boilerplatePackageJsonHash = cache.hash(read(path(boilerplatePath, "package.json")))
    const cachePath = path(cache.rootdir(), boilerplatePackageJsonHash, packagerName)
    const cacheExists = exists(cachePath) === "dir"

    log(`${!cacheExists ? "expected " : ""}cachePath: ${cachePath}`)
    log(`cacheExists: ${cacheExists}`)

    const defaultUseCache = true
    const useCache = options.useCache === undefined ? defaultUseCache : boolFlag(options.useCache)

    const shouldUseCache = installDeps && cacheExists && useCache
    if (shouldUseCache) {
      const msg = `Grabbing those ${packagerName} dependencies from the back`
      startSpinner(msg)
      cache.copy({
        fromRootDir: cachePath,
        toRootDir: targetPath,
        packagerName,
      })
      stopSpinner(msg, "📦")
    }

    const shouldFreshInstallDeps = installDeps && shouldUseCache === false
    if (shouldFreshInstallDeps) {
      const unboxingMessage = `Installing ${packagerName} dependencies (wow these are heavy)`
      startSpinner(unboxingMessage)
      await packager.install({ ...packagerOptions, onProgress: log })
      stopSpinner(unboxingMessage, "🧶")
    }

    // remove the gitignore template
    remove(".gitignore.template")
    // #endregion

    // #region Rename App
    // rename the app using Ignite
    const renameSpinnerMsg = `Getting those last few details perfect`
    startSpinner(renameSpinnerMsg)

    await renameReactNativeApp(
      toolbox,
      "HelloWorld",
      projectName,
      "com.helloworld",
      bundleIdentifier,
    )

    stopSpinner(renameSpinnerMsg, "🎨")
    // #endregion

    // #region Install CocoaPods
    // install pods
    if (shouldFreshInstallDeps) {
      startSpinner("Baking CocoaPods")
      await spawnProgress(`npx pod-install@${deps.podInstall}`, {
        onProgress: log,
      })
      stopSpinner("Baking CocoaPods", "☕️")
    }
    // #endregion

    // #region Cache dependencies
    if (shouldFreshInstallDeps && cacheExists === false) {
      const msg = `Saving ${packagerName} dependencies for next time`
      startSpinner(msg)
      cache.copy({
        fromRootDir: targetPath,
        toRootDir: cachePath,
        packagerName,
      })
      stopSpinner(msg, "📦")
    }
    // #endregion

    // #region Run Format
    // we can't run this option if we didn't install deps
    if (installDeps === true) {
      // Make sure all our modifications are formatted nicely
      await packager.run("format", { ...packagerOptions, silent: !debug })
    }
    // #endregion

    // #region Create Git Repostiory and Initial Commit
    // commit any changes
    if (git === true) {
      startSpinner(" Backing everything up in source control")
      try {
        await system.run(
          log(`
            \\rm -rf ./.git
            git init;
            git add -A;
            git commit -m "New Ignite ${meta.version()} app";
          `),
        )
      } catch (e) {
        p(yellow("Unable to commit the initial changes. Please check your git username and email."))
      }
      stopSpinner(" Backing everything up in source control", "🗄")
    }

    // back to the original directory
    process.chdir(log(cwd))
    // #endregion

    // #region Print Finish
    // clean up any spinners we forgot to clear
    clearSpinners()

    // we're done! round performance stats to .xx digits
    const perfDuration = Math.round((new Date().getTime() - perfStart) / 10) / 100

    p()
    p()
    p(`Ignited ${highlight(` ${projectName} `)} in ${gray(`${perfDuration}s`)}  🚀 `)
    p()
    p(`To get started:`)
    command(`  cd ${projectName}`)

    if (process.platform === "darwin") {
      command(`  ${packager.runCmd("ios", packagerOptions)}`)
    }
    command(`  ${packager.runCmd("android", packagerOptions)}`)
    if (!isAndroidInstalled(toolbox)) {
      p()
      p("To run in Android, make sure you've followed the latest react-native setup")
      p(`instructions at ${link("https://facebook.github.io/react-native/docs/getting-started")}`)
      p("before using ignite. You won't be able to run Android successfully until you have.")
    }
    p()
    p("Or with Expo:")
    command(`  ${packager.runCmd("expo:start", packagerOptions)}`)
    // #endregion

    // #region React Native Colo Loco
    // React Native Colo Loco is no longer installed with Ignite, but
    // we will give instructions on how to install it if they
    // pass in `--colo-loco`
    const coloLoco = boolFlag(options.coloLoco)

    if (coloLoco) {
      p()
      p(`React Native Colo Loco`)
      p("React Native Colo Loco is no longer installed by default.")
      p("(More info: https://github.com/jamonholmgren/react-native-colo-loco)")
      p("However, you can install it with the following commands in your app folder:")
      p()
      command(`  ${packager.addCmd("-g react-native-colo-loco")}`)
      command(`  ${packager.runCmd("install-colo-loco", packagerOptions)}`)
    }
    // #endregion

    // #region Infinite Red Plug
    p()
    p("Need additional help?")
    p()
    p(`Join our Slack community at ${link("http://community.infinite.red.")}`)
    p()
    heading("Now get cooking! 🍽")
    // #endregion

    // #region Print CLI command
    const flags: Required<Options> = {
      b: bname,
      boilerplate: bname,
      bundle: bundleIdentifier,
      coloLoco,
      debug,
      git,
      installDeps,
      overwrite,
      expo,
      packager: packagerName,
      targetPath,
      useCache,
      y: yname,
      yes: yname,
    }

    type Flag = keyof typeof flags
    type FlagEntry = [key: Flag, value: Options[Flag]]

    const privateFlags: Flag[] = [
      "b",
      "boilerplate",
      "coloLoco",
      "debug",
      "expo",
      "useCache",
      "y",
      "yes",
    ]

    const stringFlag = ([key, value]: FlagEntry) => `--${kebabCase(key)}=${value}`
    const booleanFlag = ([key, value]: FlagEntry) =>
      value ? `--${kebabCase(key)}` : `--${kebabCase(key)}=${value}`

    const cliCommand = `npx ignite-cli new ${projectName} ${(Object.entries(flags) as FlagEntry[])
      .filter(([key]) => privateFlags.includes(key) === false)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) =>
        typeof value === "boolean" ? booleanFlag([key, value]) : stringFlag([key, value]),
      )
      .join(" ")}`

    p()
    p(`In the future, if you'd like to skip the questions, you can run Ignite with these options:`)
    command(`  ${cliCommand}`)
    p()

    // this is a hack to prevent the process from hanging
    // if there are any tasks left in the event loop
    // like I/O operations to process.stdout and process.stderr
    // see https://github.com/infinitered/ignite/issues/2084
    process.exit(0)
    // #endregion
  },
}
