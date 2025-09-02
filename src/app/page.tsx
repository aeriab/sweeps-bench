'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import './HomePage.css';

// Define the structure for our stats object
const CATEGORIES = ['Neutral', 'Soft', 'Hard'] as const;
type Category = typeof CATEGORIES[number];
type ConfusionMatrix = { [key in Category]: { [key in Category]: number } };
interface CumulativeStats {
  totalCorrect: number;
  totalAttempted: number;
  cumulativeMatrix: ConfusionMatrix;
}

export default function HomePage() {
  const [stats, setStats] = useState<CumulativeStats | null>(null);

  // Load stats from localStorage when the component mounts
  useEffect(() => {
    try {
      const savedStats = localStorage.getItem('haplotypeQuizStats');
      if (savedStats) {
        setStats(JSON.parse(savedStats));
      }
    } catch (error) {
      console.error("Failed to parse stats from localStorage", error);
    }
  }, []);

  const handleResetStats = () => {
    localStorage.removeItem('haplotypeQuizStats');
    setStats(null);
  };

  const calculateAccuracy = () => {
    if (!stats || stats.totalAttempted === 0) return '0.0';
    return ((stats.totalCorrect / stats.totalAttempted) * 100).toFixed(1);
  };

  return (
    <main className="main-container">
      <div className="title-container">
        <h1>Haplotype Sweep Classifier</h1>
        <p>A human benchmark for genomic pattern recognition</p>
      </div>

      <div className="nav-container">
        <Link href="/tutorial" className="nav-button tutorial-button">
          <h2 className="button-title">Tutorial</h2>
          <p className="button-subtitle">A Quick Guide to Spotting Evolution</p>
        </Link>
        <Link href="/play" className="nav-button play-button">
          <h2 className="button-title">Play</h2>
          <p className="button-subtitle">Test your skills and classify sweep images.</p>
        </Link>
      </div>

      {stats && (
        <div className="stats-container">
          <h2 className="stats-title">Your Cumulative Statistics</h2>
          <p className="stats-summary">
            Overall Accuracy: <strong>{calculateAccuracy()}%</strong> 
            ({stats.totalCorrect} / {stats.totalAttempted} correct)
          </p>
          <table className="stats-matrix">
            <thead>
              <tr>
                <th></th>
                <th colSpan={3}>Actual Type</th>
              </tr>
              <tr>
                <th>Your Guess</th>
                {CATEGORIES.map(cat => <th key={cat}>{cat}</th>)}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map(guessCat => (
                <tr key={guessCat}>
                  <td>{guessCat}</td>
                  {CATEGORIES.map(actualCat => (
                    <td key={`${guessCat}-${actualCat}`}>
                      {stats.cumulativeMatrix[guessCat][actualCat]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={handleResetStats} className="reset-button">
            Reset Stats
          </button>
        </div>
      )}
    </main>
  );
}
