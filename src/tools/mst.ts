import { filesystem, patching } from "gluegun"
import * as pathlib from "path"
import { updateFiles } from "./markup"

export enum CommentType {
  REMOVE_FILE = `@mst remove-file`,
  REMOVE_CURRENT_LINE = `@mst remove-current-line`,
  REMOVE_NEXT_LINE = `@mst remove-next-line`,
  REMOVE_BLOCK_START = `@mst remove-block-start`,
  REMOVE_BLOCK_END = `@mst remove-block-end`,
  OBSERVER_BLOCK_START = `@mst observer-block-start`,
  OBSERVER_BLOCK_END = `@mst observer-block-end`,
}

export const DEFAULT_MATCHING_GLOBS = [
  "!**/.DS_Store",
  "!**/.expo{,/**}",
  "!**/.git{,/**}",
  "!**/.vscode{,/**}",
  "!**/node_modules{,/**}",
  "!**/ios/build{,/**}",
  "!**/ios/Pods{,/**}",
  "!**/ios/*.xcworkspace{,/**}",
  "!**/android/build{,/**}",
  "!**/android/app/build{,/**}",
]

/**
 * Regex pattern to find the various types of // @mst remove-x comments
 * Also finds # @mst remove-file for maestro files
 *
 * NOTE: This currently will _NOT_ remove a multiline comment
 */
export const mstMarkupRegex = /(\/\/|#)\s*@mst.*|{?\/.*@mst.*\/}?/gm

/**
 * Take the file content as a string and remove any
 * line of code with an `// @mst remove-current-line` comment
 */
function removeCurrentLine(contents: string, comment = CommentType.REMOVE_CURRENT_LINE): string {
  const lines = contents.split("\n")
  const result = lines.filter((line) => !line.includes(comment))
  return result.join("\n")
}

/**
 * Take the file content as a string and remove the next line
 * of code with an `// @mst remove-next-line` comment before it
 */
function removeNextLine(contents: string, comment = CommentType.REMOVE_NEXT_LINE): string {
  const lines = contents.split("\n")
  const result = lines.filter((line, index) => {
    const prevLine = lines[index - 1]

    const preserveCurrent = line.includes(comment) === false
    const preservePrevious = prevLine !== undefined && prevLine.includes(comment) === false

    if (index === 0) {
      // if we are on the first line, there is no previous line to check
      return preserveCurrent
    }

    // keep current line if there is no comment in current or previous line
    const keepLine = preserveCurrent && preservePrevious
    return keepLine
  })
  return result.join("\n")
}

/**
 * Take the file content as a string and remove the lines of code between
 * `// @mst remove-block-start` and `// @mst remove-block-end` comments
 */
function removeBlock(
  contents: string,
  comment = { start: CommentType.REMOVE_BLOCK_START, end: CommentType.REMOVE_BLOCK_END },
): string {
  const { start, end } = comment
  const lines = contents.split("\n")

  const findIndex = (l: typeof lines, c: typeof start | typeof end) =>
    l.findIndex((line) => line.includes(c))
  const NOT_FOUND = -1

  const blockStartIndex = findIndex(lines, start)
  const blockEndIndex = findIndex(lines, end)
  const blockExists = findIndex(lines, start) !== NOT_FOUND && blockEndIndex !== NOT_FOUND

  if (blockExists) {
    const blockLength = blockEndIndex - blockStartIndex + 1
    lines.splice(blockStartIndex, blockLength) // mutates `lines`
  }

  const updateContents = lines.join("\n")

  const anotherBlockExists =
    findIndex(lines, start) !== NOT_FOUND && findIndex(lines, end) !== NOT_FOUND
  if (anotherBlockExists) {
    return removeBlock(updateContents, comment)
  }

  return updateContents
}

/**
 * Take the file content as a string and remove the lines of code between
 * `// @mst remove-block-start` and `// @mst remove-block-end` comments
 */
function patchMSTObserverBlock(contents: string): string {
  const startBlockRegex = new RegExp(
    `\/\/\\s*${CommentType.OBSERVER_BLOCK_START}\\n(export\\s+)?const\\s+(\\w+)(:\\s*[\\w<>,\\s]+)?\\s*=\\s*observer\\(function\\s+(\\w+)(\\([^)]*\\))`,
    "g",
  )
  const startBlockReplacement = "$1const $2$3 = $5 =>"

  const endBlockRegex = new RegExp(`\\}\\)\\s*\/\/\\s*${CommentType.OBSERVER_BLOCK_END}`, "g")
  const endBlockReplacement = "}"

  const hasObserverBlock = (value: string) =>
    value.match(startBlockRegex) && value.match(endBlockRegex)

  if (!hasObserverBlock(contents)) {
    return contents
  }

  // replace via regex
  let updateContents = contents.replace(startBlockRegex, startBlockReplacement)
  updateContents = updateContents.replace(endBlockRegex, endBlockReplacement)

  // if more exist, keep processing file
  if (hasObserverBlock(updateContents)) {
    return patchMSTObserverBlock(updateContents)
  }

  return updateContents
}

/**
 * Perform all remove operations possible in a file
 * @param contents The file contents as a string
 * @return The file contents with all remove operations performed
 */
function remove(contents: string): string {
  let result = removeBlock(removeNextLine(removeCurrentLine(contents)))
  result = patchMSTObserverBlock(result)
  return result
}

/**
 * Perform replace on all types of @mst markup
 * @param contents The file contents as a string
 * @return The file contents with all @mst related CommentType removed
 */
function sanitize(contents: string): string {
  const result = contents.replace(mstMarkupRegex, "")
  return result
}

function find(targetDir: string, matching?: string[]) {
  const filePaths = filesystem
    .cwd(targetDir)
    .find({
      matching: matching ?? DEFAULT_MATCHING_GLOBS,
      recursive: true,
      files: true,
      directories: false,
    })
    .map((path) => pathlib.join(targetDir, path))
  return filePaths
}

async function update({
  filePaths,
  dryRun = true,
  onlyMarkup = false,
}: {
  filePaths: string[]
  dryRun?: boolean
  onlyMarkup?: boolean
}) {
  // handle OBSERVER_BLOCK_START and OBSERVER_BLOCK_END
  // since they're unique to mst, and not supported by generic updateFiles()

  return updateFiles({
    filePaths,
    markupRegex: mstMarkupRegex,
    commentTypes: {
      REMOVE_CURRENT_LINE: CommentType.REMOVE_CURRENT_LINE,
      REMOVE_NEXT_LINE: CommentType.REMOVE_NEXT_LINE,
      REMOVE_BLOCK_START: CommentType.REMOVE_BLOCK_START,
      REMOVE_BLOCK_END: CommentType.REMOVE_BLOCK_END,
      REMOVE_FILE: CommentType.REMOVE_FILE,
    },
    dryRun,
    onlyMarkup,
  })

  // Go through every file path and handle the operation for each mst comment
  const mstCommentResults = await Promise.allSettled(
    filePaths.map(async (path) => {
      const { exists, update } = patching
      const { read } = filesystem
      const {
        REMOVE_CURRENT_LINE,
        REMOVE_NEXT_LINE,
        REMOVE_BLOCK_START,
        REMOVE_BLOCK_END,
        REMOVE_FILE,
        OBSERVER_BLOCK_START,
        OBSERVER_BLOCK_END,
      } = mst.CommentType

      const comments: CommentType[] = []

      if (await exists(path, REMOVE_FILE)) {
        if (!dryRun) {
          if (onlyMarkup) {
            const contents = read(path)
            const sanitized = mst.sanitize(contents)
            filesystem.write(path, sanitized)
          } else {
            filesystem.remove(path)
          }
        }
        comments.push(REMOVE_FILE)
        return { path, comments }
      }

      const operations = [
        REMOVE_CURRENT_LINE,
        REMOVE_NEXT_LINE,
        REMOVE_BLOCK_START,
        REMOVE_BLOCK_END,
        OBSERVER_BLOCK_START,
        OBSERVER_BLOCK_END,
      ]

      const shouldUpdate = onlyMarkup ? mstMarkupRegex : RegExp(operations.join("|"), "g")

      if (await exists(path, shouldUpdate)) {
        const before = read(path)

        operations.forEach((operation) => {
          if (before.includes(operation)) {
            comments.push(operation)
          }
        })

        if (!dryRun) await update(path, onlyMarkup ? mst.sanitize : mst.remove)
      }

      return { path, comments }
    }),
  )

  return mstCommentResults
}

export const mst = {
  CommentType,
  removeCurrentLine,
  removeNextLine,
  removeBlock,
  remove,
  sanitize,
  find,
  update,
} as const

export const mstDependenciesToRemove = [
  "mobx",
  "mobx-react-lite",
  "mobx-state-tree",
  "reactotron-mst",
]
