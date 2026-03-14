import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@ugc/db";
import { PLAN_CONFIGS, type Plan } from "@ugc/shared";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-02-24.acacia" as Stripe.LatestApiVersion,
  });
}

function getPriceToPlan(): Record<string, Plan> {
  return {
    [process.env.STRIPE_STARTER_PRICE_ID!]: "STARTER",
    [process.env.STRIPE_GROWTH_PRICE_ID!]: "GROWTH",
    [process.env.STRIPE_SCALE_PRICE_ID!]: "SCALE",
  };
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const PRICE_TO_PLAN = getPriceToPlan();
  const body = await req.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.subscription && session.customer) {
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );
        const priceId = subscription.items.data[0]?.price.id;
        const plan = priceId ? PRICE_TO_PLAN[priceId] : undefined;
        if (plan) {
          const config = PLAN_CONFIGS[plan];
          await prisma.organization.update({
            where: { stripeCustomerId: session.customer as string },
            data: {
              plan,
              stripeSubscriptionId: subscription.id,
              creditsBalance: config.creditsMonthly,
              creditsMonthly: config.creditsMonthly,
            },
          });
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const priceId = subscription.items.data[0]?.price.id;
      const plan = priceId ? PRICE_TO_PLAN[priceId] : undefined;
      if (plan && subscription.customer) {
        const config = PLAN_CONFIGS[plan];
        await prisma.organization.update({
          where: { stripeCustomerId: subscription.customer as string },
          data: {
            plan,
            creditsMonthly: config.creditsMonthly,
          },
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      if (subscription.customer) {
        await prisma.organization.update({
          where: { stripeCustomerId: subscription.customer as string },
          data: {
            plan: "FREE",
            stripeSubscriptionId: null,
            creditsBalance: PLAN_CONFIGS.FREE.creditsMonthly,
            creditsMonthly: PLAN_CONFIGS.FREE.creditsMonthly,
          },
        });
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription && invoice.customer && invoice.billing_reason === "subscription_cycle") {
        const org = await prisma.organization.findUnique({
          where: { stripeCustomerId: invoice.customer as string },
        });
        if (org) {
          const config = PLAN_CONFIGS[org.plan as Plan];
          await prisma.$transaction([
            prisma.organization.update({
              where: { id: org.id },
              data: { creditsBalance: config.creditsMonthly },
            }),
            prisma.creditTransaction.create({
              data: {
                orgId: org.id,
                amount: config.creditsMonthly,
                type: "MONTHLY_RESET",
              },
            }),
          ]);
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
