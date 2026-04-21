/**
 * Forge function entry point.
 *
 * @remarks
 * The Forge CLI's manifest validator and bundler look for handler files
 * at conventional locations (typically `index.<handler>` referring to
 * `src/index.ts` at the bundler root). To keep our actual implementation
 * organized under `src/functions/`, we re-export the named handlers
 * from this single module.
 *
 * Manifest references:
 *   handler: index.preUninstall      -> src/functions/pre-uninstall.ts#handler
 *   handler: index.refreshAppTokens  -> src/functions/refresh-app-tokens.ts#handler
 */

export { handler as preUninstall } from './functions/pre-uninstall';
export { handler as refreshAppTokens } from './functions/refresh-app-tokens';
