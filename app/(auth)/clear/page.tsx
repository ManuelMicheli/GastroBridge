"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ClearCookiesPage() {
  const router = useRouter();
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    // Clear all cookies
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0]?.trim();
      if (name) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=localhost`;
      }
    });

    // Clear localStorage Supabase keys
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("sb-")) {
        localStorage.removeItem(key);
      }
    });

    setCleared(true);

    // Redirect to login after 2 seconds
    setTimeout(() => {
      router.push("/login");
    }, 2000);
  }, [router]);

  return (
    <div className="text-center">
      <h2 className="text-xl font-bold text-charcoal mb-2">
        {cleared ? "Sessione pulita!" : "Pulizia in corso..."}
      </h2>
      <p className="text-sage text-sm">
        {cleared
          ? "Redirect al login tra 2 secondi..."
          : "Cancellazione cookie e storage..."}
      </p>
    </div>
  );
}
