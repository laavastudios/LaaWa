"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function SitePlatformMenu() {
  return (
    <Link href="/platform" className="site-platform-trigger site-platform-static-link">
      <span className="nav-icon site-platform-trigger-icon"><Sparkles size={16} /></span>
      <span className="site-platform-trigger-label">Platform</span>
    </Link>
  );
}
