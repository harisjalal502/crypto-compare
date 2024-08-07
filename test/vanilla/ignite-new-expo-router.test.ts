import { filesystem } from "gluegun"
import * as tempy from "tempy"
import { runIgnite } from "../_test-helpers"

const APP_NAME = "Foo"
const originalDir = process.cwd()

describe(`ignite new with expo-router`, () => {
  describe(`ignite new ${APP_NAME} --debug --packager=bun --install-deps=false --experimental=expo-router --mst --yes`, () => {
    let tempDir: string
    let result: string
    let appPath: string

    beforeAll(async () => {
      tempDir = tempy.directory({ prefix: "ignite-" })
      result = await runIgnite(
        `new ${APP_NAME} --debug --packager=bun --install-deps=false --experimental=expo-router --mst --yes`,
        {
          pre: `cd ${tempDir}`,
          post: `cd ${originalDir}`,
        },
      )
      appPath = filesystem.path(tempDir, APP_NAME)
    })

    afterAll(() => {
      // console.log(tempDir) // uncomment for debugging, then run `code <tempDir>` to see the generated app
      filesystem.remove(tempDir) // clean up our mess
    })

    it("should convert to Expo Router with MST", async () => {
      expect(result).toContain("--mst")

      // make sure src/navigators, src/screens, app/, app.tsx is gone
      const dirs = filesystem.list(appPath)
      expect(dirs).toContain("src")
      expect(dirs).not.toContain("app")
      expect(dirs).not.toContain("app.tsx")
      expect(dirs).not.toContain("src/screens")
      expect(dirs).not.toContain("src/navigators")

      // check the contents of ignite/templates
      const templates = filesystem.list(`${appPath}/ignite/templates`)
      expect(templates).toContain("component")
      expect(templates).toContain("model")
      expect(templates).toContain("screen")
      expect(templates).not.toContain("navigator")

      // check tsconfig for path alias
      const tsConfigJson = filesystem.read(`${appPath}/tsconfig.json`)
      expect(tsConfigJson).toContain(`"src/*": ["./src/*"]`)

      // check entry point
      const packageJson = filesystem.read(`${appPath}/package.json`)
      expect(packageJson).toContain("expo-router/entry")
      expect(packageJson).not.toContain("AppEntry.js")

      // check plugin in app.json
      // check typedRoutes is turned on
      const appJson = filesystem.read(`${appPath}/app.json`)
      expect(appJson).toContain("expo-router")
      expect(appJson).toContain("typedRoutes")

      // check generator templates for src/components and src/models
      const componentGenerator = filesystem.read(
        `${appPath}/ignite/templates/component/NAME.tsx.ejs`,
      )
      expect(componentGenerator).toContain("src/components/index.ts")
      expect(componentGenerator).toContain("src/theme")
      expect(componentGenerator).not.toContain("app/components/index.ts")
      expect(componentGenerator).not.toContain("app/theme")
      const modelGenerator = filesystem.read(`${appPath}/ignite/templates/model/NAME.ts.ejs`)
      expect(modelGenerator).toContain("src/models")
      expect(modelGenerator).not.toContain("app/models")

      // check components for src/i18n
      const listViewComponent = filesystem.read(`${appPath}/src/components/ListView.tsx`)
      expect(listViewComponent).toContain("src/i18n")
      expect(listViewComponent).not.toContain("app/i18n")

      const switchComponent = filesystem.read(`${appPath}/src/components/Toggle/Switch.tsx`)
      expect(switchComponent).toContain("src/i18n")
      expect(switchComponent).not.toContain("app/i18n")

      // check ReactotronConfig for router.back etc
      const reactotronConfig = filesystem.read(`${appPath}/src/devtools/ReactotronConfig.ts`)
      expect(reactotronConfig).toContain("router.back()")
      expect(reactotronConfig).not.toContain("navigate(")
      expect(reactotronConfig).not.toContain("react-navigation")
      expect(reactotronConfig).not.toContain("reset navigation state")

      // make sure _layout sets up initial root store
      const rootLayout = filesystem.read(`${appPath}/src/app/_layout.tsx`)
      expect(rootLayout).toContain("useInitialRootStore")

      // make sure index has observer
      const rootIndex = filesystem.read(`${appPath}/src/app/index.tsx`)
      expect(rootIndex).toContain("observer")
    })
  })

  describe(`ignite new ${APP_NAME} --debug --packager=bun --install-deps=false --experimental=expo-router --mst-false --yes`, () => {
    let tempDir: string
    let result: string
    let appPath: string

    beforeAll(async () => {
      tempDir = tempy.directory({ prefix: "ignite-" })
      result = await runIgnite(
        `new ${APP_NAME} --debug --packager=bun --install-deps=false --experimental=expo-router --mst=false --remove-demo --yes`,
        {
          pre: `cd ${tempDir}`,
          post: `cd ${originalDir}`,
        },
      )
      appPath = filesystem.path(tempDir, APP_NAME)
    })

    afterAll(() => {
      // console.log(tempDir) // uncomment for debugging, then run `code <tempDir>` to see the generated app
      filesystem.remove(tempDir) // clean up our mess
    })

    it("should convert to Expo Router without MST", async () => {
      expect(result).toContain("--mst=false")
      expect(result).not.toContain("Setting --mst=true")

      // check the contents of ignite/templates
      const templates = filesystem.list(`${appPath}/ignite/templates`)
      expect(templates).toContain("component")
      expect(templates).toContain("screen")
      expect(templates).not.toContain("model")
      expect(templates).not.toContain("navigator")

      // same as with MST but..
      // make sure _layout doesn't have mention of rehydrating root store
      const rootLayout = filesystem.read(`${appPath}/src/app/_layout.tsx`)
      expect(rootLayout).not.toContain("useInitialRootStore")

      // make sure index does not have observer
      const rootIndex = filesystem.read(`${appPath}/src/app/index.tsx`)
      expect(rootIndex).not.toContain("observer")
    })
  })
})
