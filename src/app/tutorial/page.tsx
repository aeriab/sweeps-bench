import Link from 'next/link';

export default function TutorialPage() {
  return (
    <div style={{ textAlign: 'center', paddingTop: '40vh' }}>
      <h1>Tutorial Page</h1>
      <p>Your tutorial content will go here!</p>
      <Link href="/" style={{ color: 'blue' }}>
        &larr; Back to Home
      </Link>
    </div>
  );
}