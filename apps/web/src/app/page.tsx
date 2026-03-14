import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AnimatedLanding from "@/components/landing/animated-landing";

export default async function Home() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }

  return <AnimatedLanding />;
}
