export { buzolaPlugin } from './plugin';
export type { BuzolaPluginOptions } from './plugin';

export { scanRouteFiles } from './generator/scanner';
export type { ScannedFile } from './generator/scanner';

export { buildFileRouteTree, collectRoutePaths } from './generator/tree-builder';
export type { FileRouteNode } from './generator/tree-builder';

export { generateRouteModule, generateConfigTypeAugmentation } from './generator/codegen';
export type { CodegenOptions } from './generator/codegen';

export { collectConfigRoutePaths } from './generator/config-parser';
export type { ConfigRoutePath } from './generator/config-parser';

export {
  parseRouteFile,
  parseFileName,
  parseDirName,
  isRouteFile,
} from './conventions';
export type { ParsedRouteFile } from './conventions';
