"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    try {
      const csrfResponse = await fetch("/api/auth/csrf");
      const { csrfToken } = (await csrfResponse.json()) as { csrfToken?: string };
      const signOutResponse = await fetch("/api/auth/signout", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          callbackUrl: "/login",
          csrfToken: csrfToken ?? "",
          json: "true",
        }),
      });
      const data = (await signOutResponse.json()) as { url?: string };
      window.location.href = data.url ?? "/login";
    } catch {
      window.location.href = "/login";
    }
  }

  return (
    <Button disabled={pending} onClick={handleSignOut} size="sm" type="button" variant="ghost">
      <LogOut className="h-4 w-4" />
      {pending ? "Logging out..." : "Logout"}
    </Button>
  );
}
