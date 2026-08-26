import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Concrete Kings Central",
  description: "Offline-first central service portal for Concrete Kings yard dispatches and operations.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CK Central",
  },
};

export const viewport: Viewport = {
  themeColor: "#e05300",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
