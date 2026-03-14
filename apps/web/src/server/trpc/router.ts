import { router } from "./init";
import { orgRouter } from "./routers/org";
import { creditsRouter } from "./routers/credits";
import { billingRouter } from "./routers/billing";
import { videoRouter } from "./routers/video";
import { productRouter } from "./routers/product";
import { brandKitRouter } from "./routers/brandkit";
import { assetRouter } from "./routers/asset";

export const appRouter = router({
  org: orgRouter,
  credits: creditsRouter,
  billing: billingRouter,
  video: videoRouter,
  product: productRouter,
  brandKit: brandKitRouter,
  asset: assetRouter,
});

export type AppRouter = typeof appRouter;
