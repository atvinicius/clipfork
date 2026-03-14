import { z } from "zod";
import { router, protectedProcedure } from "../init";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-02-24.acacia" as Stripe.LatestApiVersion,
  });
}

export const billingRouter = router({
  getPlan: protectedProcedure.query(async ({ ctx }) => {
    return {
      plan: ctx.org.plan,
      creditsBalance: ctx.org.creditsBalance,
      creditsMonthly: ctx.org.creditsMonthly,
    };
  }),

  createPortalSession: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.org.stripeCustomerId) {
      const customer = await getStripe().customers.create({
        metadata: { orgId: ctx.org.id },
      });
      await ctx.prisma.organization.update({
        where: { id: ctx.org.id },
        data: { stripeCustomerId: customer.id },
      });
      ctx.org.stripeCustomerId = customer.id;
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: ctx.org.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    });

    return { url: session.url };
  }),

  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        priceId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.org.stripeCustomerId) {
        const customer = await getStripe().customers.create({
          metadata: { orgId: ctx.org.id },
        });
        await ctx.prisma.organization.update({
          where: { id: ctx.org.id },
          data: { stripeCustomerId: customer.id },
        });
        ctx.org.stripeCustomerId = customer.id;
      }

      const session = await getStripe().checkout.sessions.create({
        customer: ctx.org.stripeCustomerId,
        line_items: [{ price: input.priceId, quantity: 1 }],
        mode: "subscription",
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?canceled=true`,
      });

      return { url: session.url };
    }),
});
