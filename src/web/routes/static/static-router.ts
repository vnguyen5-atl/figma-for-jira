import { Router, static as Static } from 'express';

import { join } from 'path';

export const staticRouter = Router();

// Note: as of Phase 6 the admin React app is hosted by Forge as a Custom UI
// (see `manifest.yml` `resources` + `jira:adminPage`) and is no longer served
// from this Express remote backend. The only remaining static asset is the
// `static/figma-logo.svg` referenced by `devops:designInfoProvider.logoUrl`
// in the Forge manifest.
staticRouter.use('/', Static(join(process.cwd(), 'static')));
