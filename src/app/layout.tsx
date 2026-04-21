import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DID Scanner",
  description: "Multi-dialer Convoso DID management dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen hud-grid-bg hud-scanlines">
        {children}
      </body>
    </html>
  );
}
