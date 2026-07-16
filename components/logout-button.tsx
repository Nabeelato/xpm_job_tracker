"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    try {
      await signOut({ callbackUrl: "/login", redirect: false });
      window.location.replace("/login");
    } catch {
      window.location.replace("/login");
    }
  }

  return (
    <Button disabled={pending} onClick={handleSignOut} size="sm" type="button" variant="ghost">
      <LogOut className="h-4 w-4" />
      {pending ? "Logging out..." : "Logout"}
    </Button>
  );
}
