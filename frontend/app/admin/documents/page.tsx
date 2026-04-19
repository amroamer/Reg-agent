"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LegacyUploadRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/upload");
  }, [router]);
  return null;
}
