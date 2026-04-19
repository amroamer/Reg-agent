"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LegacyBulkUploadRedirect() {
  const router = useRouter();
  useEffect(() => {
    // Redirect to library — the Bulk Upload button there opens the modal
    router.replace("/admin/library");
  }, [router]);
  return null;
}
