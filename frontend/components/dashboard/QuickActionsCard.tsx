"use client";

import { Download, Plus, Search, Upload, Zap } from "lucide-react";
import Link from "next/link";

const ACTIONS = [
  {
    icon: Upload,
    lbl: "Upload documents",
    sub: "PDF, DOCX, HTML",
    href: "/admin/upload",
  },
  {
    icon: Search,
    lbl: "New search",
    sub: "Across all sources",
    href: "/",
  },
  {
    icon: Plus,
    lbl: "Bulk upload",
    sub: "Multiple files at once",
    href: "/admin/bulk-upload",
  },
  {
    icon: Download,
    lbl: "Export library",
    sub: "Metadata + chunks",
    href: "/admin/library",
  },
];

export default function QuickActionsCard() {
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">
          <span className="card-ico">
            <Zap size={12} />
          </span>
          Quick actions
        </div>
      </div>
      <div className="qa-grid">
        {ACTIONS.map((a) => {
          const Ico = a.icon;
          return (
            <Link key={a.lbl} href={a.href} className="qa-tile">
              <div className="qa-ico">
                <Ico size={13} />
              </div>
              <div className="qa-lbl">{a.lbl}</div>
              <div className="qa-sub">{a.sub}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
