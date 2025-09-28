'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import './HomePage.css';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// --- (Interfaces and constants remain the same) ---
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

// --- NEW: A generic configuration for the confirmation modal ---
interface ModalConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

export default function HomePage() {
  const [stats, setStats] = useState<CumulativeStats | null>(null);
  const [username, setUsername] = useState('');
  const [customAlert, setCustomAlert] = useState<AlertState>({ show: false, message: '', type: 'error', isExiting: false });
  
  // --- MODIFIED: Replaced the simple boolean with a configuration object ---
  const [modalConfig, setModalConfig] = useState<ModalConfig>({ 
    isOpen: false, 
    title: '', 
    message: '', 
    onConfirm: () => {} 
  });

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

  const showAlert = (message: string, type: 'success' | 'error') => {
    setCustomAlert({ show: true, message, type, isExiting: false });
    setTimeout(() => {
      setCustomAlert(current => ({ ...current, isExiting: true }));
      setTimeout(() => {
        setCustomAlert({ show: false, message: '', type: 'error', isExiting: false });
      }, 300);
    }, 3000);
  };

  // --- NEW: A generic function to close the modal ---
  const handleCloseModal = () => {
    setModalConfig({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  };
  
  // --- NEW: The function that runs after confirming a stat reset ---
  const confirmAndResetStats = () => {
    localStorage.setItem('haplotypeQuizStats', JSON.stringify(ZEROED_STATS));
    setStats(ZEROED_STATS);
    showAlert("Your stats have been successfully reset.", 'success');
    handleCloseModal();
  };
  
  // --- MODIFIED: This function now just opens the modal for resetting ---
  const handleResetStats = () => {
    if (stats?.totalAttempted === 0) {
        showAlert("There are no stats to reset.", 'error');
        return;
    }
    setModalConfig({
        isOpen: true,
        title: "Confirm Reset",
        message: "This will permanently delete your local statistics. Are you sure you want to proceed?",
        onConfirm: confirmAndResetStats
    });
  };
  
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
    
    // --- MODIFIED: Opens the modal with upload-specific configuration ---
    setModalConfig({
        isOpen: true,
        title: "Confirm Submission",
        message: "This will upload your score to the leaderboard and reset your local statistics. Are you sure?",
        onConfirm: confirmAndUploadScore
    });
  };
  
  const confirmAndUploadScore = async () => {
    const cleanedUsername = username.trim();
    if (!stats) return;

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
      // Directly reset stats after successful upload
      localStorage.setItem('haplotypeQuizStats', JSON.stringify(ZEROED_STATS));
      setStats(ZEROED_STATS);
    } catch (e) {
      console.error("Error uploading score to leaderboard: ", e);
      showAlert("An error occurred while uploading your score. Please try again.", 'error');
    }
    handleCloseModal();
  };

  // --- (calculateAccuracy, matrixMax, getCellStyle functions remain the same) ---
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
      
      {/* --- MODIFIED: The modal is now generic and reads from state --- */}
      {modalConfig.isOpen && (
        <div className="confirm-modal-overlay">
          <div className="confirm-modal-content">
            <h3>{modalConfig.title}</h3>
            <p>{modalConfig.message}</p>
            <div className="confirm-modal-buttons">
              <button onClick={handleCloseModal} className="modal-button modal-button-cancel">
                Cancel
              </button>
              <button onClick={modalConfig.onConfirm} className="modal-button modal-button-confirm">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- (Rest of the JSX remains the same) --- */}
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