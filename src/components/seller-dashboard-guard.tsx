"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabaseClient } from "@/lib/supabase";
import { detectRoleFromPath, getRoleLoginPath } from "@/lib/role-redirect";

export default function SellerDashboardGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    supabaseClient.auth.getUser().then(({ data }) => {
      if (!data.user) {
        const role = detectRoleFromPath(pathname ?? "");
        const target = role ? getRoleLoginPath(role) : "/buyer/login";
        router.replace(target);
      }
    });
  }, [router, pathname]);

  return <>{children}</>;
}
