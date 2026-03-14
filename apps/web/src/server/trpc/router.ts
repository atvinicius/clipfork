import { router } from "./init";
import { orgRouter } from "./routers/org";
import { creditsRouter } from "./routers/credits";
import { billingRouter } from "./routers/billing";

export const appRouter = router({
  org: orgRouter,
  credits: creditsRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;
