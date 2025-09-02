'use client';

import { useState, useEffect, useMemo } from 'react';
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

// Define a constant for the zeroed-out stats structure
const ZEROED_STATS: CumulativeStats = {
  totalCorrect: 0,
  totalAttempted: 0,
  cumulativeMatrix: {
    Neutral: { Neutral: 0, Soft: 0, Hard: 0 },
    Soft: { Neutral: 0, Soft: 0, Hard: 0 },
    Hard: { Neutral: 0, Soft: 0, Hard: 0 },
  },
};

export default function HomePage() {
  const [stats, setStats] = useState<CumulativeStats | null>(null);

  // Load stats from localStorage or initialize with zeros
  useEffect(() => {
    try {
      const savedStats = localStorage.getItem('haplotypeQuizStats');
      if (savedStats) {
        setStats(JSON.parse(savedStats));
      } else {
        setStats(ZEROED_STATS);
      }
    } catch (error) {
      console.error("Failed to parse stats from localStorage", error);
      setStats(ZEROED_STATS);
    }
  }, []);

  const handleResetStats = () => {
    localStorage.setItem('haplotypeQuizStats', JSON.stringify(ZEROED_STATS));
    setStats(ZEROED_STATS);
  };

  const calculateAccuracy = () => {
    if (!stats || stats.totalAttempted === 0) return '0.0';
    return ((stats.totalCorrect / stats.totalAttempted) * 100).toFixed(1);
  };

  // --- MODIFIED: Calculate matrix-wide maximum value for heatmap scaling ---
  const matrixMax = useMemo(() => {
    if (!stats) return 0;
    
    // Flatten all values from the matrix into a single array and find the max
    const allValues = CATEGORIES.flatMap(guessCat => 
        CATEGORIES.map(actualCat => stats.cumulativeMatrix[guessCat][actualCat])
    );

    return Math.max(...allValues);
  }, [stats]);
  
  // --- MODIFIED: Function to get the dynamic style for each cell based on matrix-wide max ---
  const getCellStyle = (guessCat: Category, actualCat: Category) => {
    if (!stats) return {};
    
    const value = stats.cumulativeMatrix[guessCat][actualCat];
    
    if (matrixMax === 0 || value === 0) {
      return {}; // No background for zero values
    }

    const proportion = value / matrixMax;
    // Base color: a scientific-looking blue. RGBA allows for transparency.
    return {
      backgroundColor: `rgba(40, 116, 166, ${proportion})`,
      color: proportion > 0.5 ? 'white' : 'inherit', // Make text readable on dark backgrounds
    };
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
            Overall Accuracy: <strong>{calculateAccuracy()}%</strong> ({stats.totalCorrect} / {stats.totalAttempted} correct)
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
                    <td 
                      key={`${guessCat}-${actualCat}`}
                      style={getCellStyle(guessCat, actualCat)}
                    >
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

