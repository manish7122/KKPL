import LegacyPage from './legacy-page';

export const metadata = {
  title: 'KKPL – Kabaddi Auction System'
};

export default function HomePage() {
  return <LegacyPage fileName="index.html" styles={[]} scripts={['/js/data.js', '/js/auth.js']} />;
}
