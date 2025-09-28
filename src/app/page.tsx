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

interface AlertState {
  show: boolean;
  message: string;
  type: 'success' | 'error';
  isExiting: boolean;
}

export default function HomePage() {
  const [stats, setStats] = useState<CumulativeStats | null>(null);
  const [username, setUsername] = useState('');
  const [customAlert, setCustomAlert] = useState<AlertState>({ show: false, message: '', type: 'error', isExiting: false });
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

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

  // Context: Replace the old showAlert function
  const showAlert = (message: string, type: 'success' | 'error') => {
    // 1. Show the alert and ensure exiting is false
    setCustomAlert({ show: true, message, type, isExiting: false });

    // 2. Set a timer for how long the alert is visible
    setTimeout(() => {
      // 3. After the time is up, trigger the exit animation
      setCustomAlert(current => ({ ...current, isExiting: true }));

      // 4. Set a final timer to remove the component after the animation completes
      setTimeout(() => {
        setCustomAlert({ show: false, message: '', type: 'error', isExiting: false });
      }, 300); // This duration MUST match your fade-out animation time
    }, 3000); // Alert is visible for 3 seconds
  };

  const handleResetStats = () => {
    localStorage.setItem('haplotypeQuizStats', JSON.stringify(ZEROED_STATS));
    setStats(ZEROED_STATS);
  };
  
  // --- MODIFIED: This function now just validates and opens the modal ---
  const handleUploadScore = async () => {
    if (!stats || stats.totalAttempted < 3) {
      showAlert("You must play at least 3 rounds to upload your score!", 'error');
      return;
    }
    const cleanedUsername = username.trim();
    if (cleanedUsername.length < 3) {
      showAlert("Please enter a username that is at least 3 characters long.", 'error');
      return;
    }
    if (cleanedUsername.length > 30) {
      showAlert("Username cannot be longer than 30 characters.", 'error');
      return;
    }
    
    // Open the confirmation modal instead of calling window.confirm
    setIsConfirmModalOpen(true);
  };
  
  const confirmAndUploadScore = async () => {
    setIsConfirmModalOpen(false); // Close the modal immediately

    const cleanedUsername = username.trim();
    if (!stats) return; // Should not happen, but good for type safety

    const leaderboardData = {
      username: cleanedUsername,
      accuracy: parseFloat(calculateAccuracy()),
      totalCorrect: stats.totalCorrect,
      totalAttempted: stats.totalAttempted,
      confusionMatrix: stats.cumulativeMatrix,
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, "leaderboard"), leaderboardData);
      showAlert(`Success! Your score has been uploaded for username: ${cleanedUsername}`, 'success');
      handleResetStats();
    } catch (e) {
      console.error("Error uploading score to leaderboard: ", e);
      showAlert("An error occurred while uploading your score. Please try again.", 'error');
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
    if (matrixMax === 0 || value === 0) return {};
    const proportion = value / matrixMax;
    return {
      backgroundColor: `rgba(40, 116, 166, ${proportion})`,
      color: proportion > 0.5 ? 'white' : 'inherit',
    };
  };

  return (
    <main className="main-container">
      {customAlert.show && (
        <div className={`custom-alert alert-${customAlert.type} ${customAlert.isExiting ? 'fade-out' : ''}`}>
          <p>{customAlert.message}</p>
          <button
            onClick={() => setCustomAlert({ ...customAlert, show: false })}
            className="alert-close-button"
          >
            &times;
          </button>
        </div>
      )}

      {/* --- NEW: Confirmation Modal Component --- */}
      {isConfirmModalOpen && (
        <div className="confirm-modal-overlay">
          <div className="confirm-modal-content">
            <h3>Confirm Submission</h3>
            <p>This will upload your score to the leaderboard and permanently reset your local statistics. Are you sure you want to proceed?</p>
            <div className="confirm-modal-buttons">
              <button onClick={() => setIsConfirmModalOpen(false)} className="modal-button modal-button-cancel">
                Cancel
              </button>
              <button onClick={confirmAndUploadScore} className="modal-button modal-button-confirm">
                Confirm & Submit
              </button>
            </div>
          </div>
        </div>
      )}

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
            {/* ... table content remains the same ... */}
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
              maxLength={30}
            />
            <button onClick={handleUploadScore} className="upload-button">
              Upload Score to Leaderboard
            </button>
          </div>

          <button onClick={handleResetStats} className="reset-button">
            Reset Stats
          </button>
        </div>
      )}
    </main>
  );
}