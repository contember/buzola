export { buzolaPlugin } from './plugin'
export type { BuzolaPluginOptions } from './plugin'

export { scanRouteFiles } from './generator/scanner'
export type { ScannedFile } from './generator/scanner'

export { buildFileRouteTree, collectRoutePaths } from './generator/tree-builder'
export type { FileRouteNode, PageExportInfo } from './generator/tree-builder'

export { generateRouteModule } from './generator/codegen'
export type { CodegenOptions } from './generator/codegen'

export { extractPages, extractPagesFromSource } from './generator/page-extractor'
export type { ExtractedPage, ExtractedParam } from './generator/page-extractor'

export { isRouteFile, parseDirName, parseFileName, parseRouteFile } from './conventions'
export type { ParsedRouteFile } from './conventions'
