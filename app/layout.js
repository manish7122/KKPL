import './globals.css';

export const metadata = {
  title: 'KKPL – Kabaddi Auction System',
  description: 'Manage teams, players, and live bidding for the KKPL season.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
