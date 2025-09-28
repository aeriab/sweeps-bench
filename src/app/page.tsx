'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import './HomePage.css';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const CATEGORIES = ['Neutral', 'Soft', 'Hard'] as const;
type Category = typeof CATEGORIES[number];
type ConfusionMatrix = { [key in Category]: { [key in Category]: number } };
interface CumulativeStats {
  totalCorrect: number;
  totalAttempted: number;
  cumulativeMatrix: ConfusionMatrix;
}

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
  const [username, setUsername] = useState(''); // <-- NEW: State for the username input

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

  // --- NEW: Function to handle uploading the score ---
  const handleUploadScore = async () => {
    // 1. Validate the username
    const cleanedUsername = username.trim();
    if (!cleanedUsername) {
      alert("Please enter a username before uploading your score.");
      return;
    }
    // Regex for valid characters (alphanumeric, underscore, hyphen) and length (3-15)
    const usernameRegex = /^[a-zA-Z0-9_-]{3,15}$/;
    if (!usernameRegex.test(cleanedUsername)) {
      alert("Invalid username. Please use only letters, numbers, underscores (_), or hyphens (-), between 3 and 15 characters.");
      return;
    }

    // 2. Ensure stats exist and there's at least one attempt
    if (!stats || stats.totalAttempted === 0) {
      alert("You need to play at least one round to upload a score!");
      return;
    }

    // 3. Prepare the data payload
    const leaderboardData = {
      username: cleanedUsername,
      accuracy: parseFloat(calculateAccuracy()),
      totalCorrect: stats.totalCorrect,
      totalAttempted: stats.totalAttempted,
      confusionMatrix: stats.cumulativeMatrix,
      createdAt: serverTimestamp(),
    };

    // 4. Send data to Firestore
    try {
      await addDoc(collection(db, "leaderboard"), leaderboardData);
      alert(`Success! Your score has been uploaded for username: ${cleanedUsername}`);
    } catch (e) {
      console.error("Error uploading score to leaderboard: ", e);
      alert("An error occurred while uploading your score. Please try again.");
    }
  };

  const calculateAccuracy = () => {
    if (!stats || stats.totalAttempted === 0) return '0.0';
    return ((stats.totalCorrect / stats.totalAttempted) * 100).toFixed(1);
  };

  const matrixMax = useMemo(() => {
    if (!stats) return 0;
    
    const allValues = CATEGORIES.flatMap(guessCat => 
        CATEGORIES.map(actualCat => stats.cumulativeMatrix[guessCat][actualCat])
    );

    return Math.max(...allValues);
  }, [stats]);
  
  const getCellStyle = (guessCat: Category, actualCat: Category) => {
    if (!stats) return {};
    
    const value = stats.cumulativeMatrix[guessCat][actualCat];
    
    if (matrixMax === 0 || value === 0) {
      return {};
    }

    const proportion = value / matrixMax;
    return {
      backgroundColor: `rgba(40, 116, 166, ${proportion})`,
      color: proportion > 0.5 ? 'white' : 'inherit',
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

          <div className="leaderboard-form">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter a username"
              className="username-input"
            />
            <button onClick={handleUploadScore} className="upload-button">
              Upload My Score to the Leaderboard
            </button>
          </div>
          
          <div className="button-group">
            <button onClick={handleResetStats} className="reset-button">
              Reset Stats
            </button>
          </div>
        </div>
      )}
    </main>
  );
}