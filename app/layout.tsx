import type { Metadata } from "next";
import "./globals.css";
import "./premium.css";
import "./messaging.css";
import "./automation.css";
import "./visual-automation.css";
import "./analytics.css";
import "./contacts.css";
import "./intelligence.css";
import "./customer/customer.css";
import "./customer/customer-timeline.css";

export const metadata: Metadata = {
  title: "LaaWa — AI Business Command Center",
  description: "Premium AI-powered WhatsApp business automation dashboard.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {children}
        <div className="brand-watermark" aria-hidden="true">Made By LaavaBee</div>
      </body>
    </html>
  );
}
