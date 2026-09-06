import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "SamHunt v2",
  description:
    "Distributed computation benchmark dashboard"
};

export default function RootLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#f7f7f7",
          color: "#111"
        }}
      >
        {children}
      </body>
    </html>
  );
}
