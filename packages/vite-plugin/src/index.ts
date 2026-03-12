export { buzolaPlugin } from './plugin.js'
export type { BuzolaPluginOptions } from './plugin.js'

export { scanRouteFiles } from './generator/scanner.js'
export type { ScannedFile } from './generator/scanner.js'

export { buildFileRouteTree } from './generator/tree-builder.js'
export type { FileRouteNode, PageExportInfo } from './generator/tree-builder.js'

export { generateRouteModule } from './generator/codegen.js'
export type { CodegenOptions } from './generator/codegen.js'

export { extractPages } from './generator/page-extractor.js'
export type { ExtractedPage, ExtractedParam, ModuleLoader } from './generator/page-extractor.js'

export { isRouteFile, parseDirName, parseFileName, parseRouteFile } from './conventions.js'
export type { ParsedRouteFile } from './conventions.js'
