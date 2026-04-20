/**
 * Returns a path to a static asset bundled with the admin Custom UI.
 *
 * In Custom UI, files placed under `admin/public/` are copied to the root
 * of the build output (`admin/dist/`) by Vite. Because Custom UI iframes
 * load assets from a Forge CDN with relative paths (Vite `base: './'`),
 * we just prefix with `./`.
 *
 * Example: `getAppPath('jira-logo.svg')` -> `'./jira-logo.svg'`.
 */
export function getAppPath(path: string): string {
	const trimmed = path.replace(/^\/+/, '').replace(/^static\/admin\//, '');
	return `./${trimmed}`;
}
