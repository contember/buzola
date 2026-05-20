export { generate } from './generate.js'
export type { GenerateOptions } from './generate.js'

export { loadConfig } from './config.js'
export type { BuzolaConfig } from './config.js'

export { buildVirtualSource, BUZOLA_NAMESPACE, resolveOptions, resolveVirtualModuleId, VIRTUAL_ID_PATTERN, VIRTUAL_PREFIX } from './resolve.js'
export type { BasePluginOptions, ResolvedOptions, ResolveOptionsInput, VirtualModuleId } from './resolve.js'

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
