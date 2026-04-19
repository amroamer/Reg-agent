"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LegacyUploadRedirect() {
  const router = useRouter();
  useEffect(() => {
    // Redirect to library — the Upload button there opens the slide-over
    router.replace("/admin/library");
  }, [router]);
  return null;
}
