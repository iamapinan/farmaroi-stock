
"use client";

import { useAuth } from "@/lib/firebase/context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function StaffGuard({ children }: { children: React.ReactNode }) {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      }
      // Optional: Strict check if we want to block Admins from Staff view
      // else if (userProfile?.role !== 'staff') { ... }
    }
  }, [user, loading, router]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
