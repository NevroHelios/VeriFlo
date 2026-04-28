import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VeriFlo - Compliant Asset Distribution on Stellar",
  description:
    "Privacy-preserving eligibility proofs for regulated Stellar asset distribution.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
