import LegacyPage from '../legacy-page';

export const metadata = {
  title: 'Team Portal – KKPL Auction'
};

export default function TeamPage() {
  return <LegacyPage fileName="team.html" styles={['/css/team.css']} scripts={['/js/data.js', '/js/team.js']} />;
}
