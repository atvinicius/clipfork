import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://clipfork.app";

  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/accounts?error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/accounts?error=${encodeURIComponent("No authorization code received")}`
    );
  }

  return NextResponse.redirect(
    `${baseUrl}/accounts?code=${encodeURIComponent(code)}`
  );
}
