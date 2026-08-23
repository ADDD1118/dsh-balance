/**
 * Self-contained tsdown build for the dsh-balance user plugin. Produces the
 * node half (`lib/index.js`, ESM — host plugin) and browser half
 * (`lib/client.js`, CJS — served to the browser and registered via the
 * `window.__ModuleLoader__.load` handoff). The browser bundle externalizes the
 * shell-seeded platform modules; the node half externalizes the packages it
 * needs from the real install.
 */
import { isBuiltin } from 'node:module'
import type { UserConfig } from 'tsdown'

const ID = 'dsh-balance'

/** Shell-seeded module-table keys a dynamic bundle must not inline. */
const PLATFORM_MODULES = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
])

/** Host-half dependencies resolved from the real install, never bundled. */
function isNodeExternal(specifier: string): boolean {
  return specifier === '@deepseek-ai/cordis'
    || specifier === '@deepseek-ai/schemastery'
    || specifier === '@deepseek-ai/dsh-credentials'
    || specifier === '@deepseek-ai/dsh-session'
    || specifier === '@deepseek-ai/dsh-settings'
}

const node: UserConfig = {
  name: ID,
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  deps: {
    neverBundle: isNodeExternal,
    alwaysBundle: (specifier: string) => !isBuiltin(specifier) && !isNodeExternal(specifier),
  },
}

const client: UserConfig = {
  name: `${ID}/client`,
  entry: { client: 'src/client/index.ts' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  dts: false,
  clean: false,
  sourcemap: true,
  deps: {
    neverBundle: (specifier: string) => PLATFORM_MODULES.has(specifier),
    alwaysBundle: (specifier: string) => !PLATFORM_MODULES.has(specifier),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [node, client]
