import "./globals.css";

export const metadata = {
  title: "Serenity Itinerary",
  description: "Rencana perjalanan yang rapi, tenang, dan selalu dapat diedit.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
