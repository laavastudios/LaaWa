import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LaaWa — AI Business Command Center",
  description: "Premium AI-powered WhatsApp business automation dashboard.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <div className="brand-watermark" aria-hidden="true">Made By LaavaBee</div>
      </body>
    </html>
  );
}
