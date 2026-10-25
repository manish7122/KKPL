import LegacyPage from '../legacy-page';

export const metadata = {
  title: 'Admin Dashboard – KKPL Auction'
};

export default function AdminPage() {
  return <LegacyPage fileName="admin.html" styles={['/css/admin.css']} scripts={['/js/data.js', '/js/admin.js']} />;
}
