import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "ArcIndex | Multi-asset Index Vaults on Arc",
  description:
    "Deposit ETH or stablecoins into ArcIndex vaults and receive AETF receipt tokens tracking a multi-asset basket. Built with Arc Network by Circle.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
