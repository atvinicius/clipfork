import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@ugc/db";

interface ClerkUserEvent {
  data: {
    id: string;
    email_addresses: Array<{ email_address: string }>;
    organization_memberships?: Array<{
      organization: { id: string; name: string };
      role: string;
    }>;
  };
  type: string;
}

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  let event: ClerkUserEvent;

  try {
    event = wh.verify(body, {
      "svix-id": headersList.get("svix-id")!,
      "svix-timestamp": headersList.get("svix-timestamp")!,
      "svix-signature": headersList.get("svix-signature")!,
    }) as ClerkUserEvent;
  } catch (err) {
    console.error("Clerk webhook verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { type, data } = event;
  const email = data.email_addresses[0]?.email_address ?? "";

  if (type === "user.created") {
    // Create a personal organization for the user
    const org = await prisma.organization.create({
      data: {
        clerkOrgId: `personal_${data.id}`,
        name: email.split("@")[0] ?? "My Workspace",
      },
    });

    await prisma.user.create({
      data: {
        clerkUserId: data.id,
        orgId: org.id,
        role: "OWNER",
        email,
      },
    });
  }

  if (type === "user.updated") {
    await prisma.user.updateMany({
      where: { clerkUserId: data.id },
      data: { email },
    });
  }

  if (type === "user.deleted") {
    const user = await prisma.user.findUnique({
      where: { clerkUserId: data.id },
    });
    if (user) {
      // If they're the only user in the org, delete the org too
      const orgUserCount = await prisma.user.count({
        where: { orgId: user.orgId },
      });
      await prisma.user.delete({ where: { id: user.id } });
      if (orgUserCount <= 1) {
        await prisma.organization.delete({ where: { id: user.orgId } });
      }
    }
  }

  return NextResponse.json({ received: true });
}
