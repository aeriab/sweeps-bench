'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import './HomePage.css';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit, getCountFromServer, startAfter, endBefore, limitToLast, DocumentSnapshot } from "firebase/firestore";

// --- Interfaces and Constants ---
const CATEGORIES = ['Neutral', 'Soft', 'Hard'] as const;
type Category = typeof CATEGORIES[number];
type ConfusionMatrix = { [key in Category]: { [key in Category]: number } };

interface CumulativeStats {
  totalCorrect: number;
  totalAttempted: number;
  cumulativeMatrix: ConfusionMatrix;
}

interface LeaderboardEntry extends CumulativeStats {
    id: string;
    username: string;
    accuracy: number;
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

interface ModalConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

const SCORES_PER_PAGE = 10;

// --- Reusable component to display a confusion matrix ---
const StatsMatrixView = (stats: CumulativeStats) => {
    const matrixMax = useMemo(() => {
        if (!stats || !stats.cumulativeMatrix) return 0;

        const allValues = CATEGORIES.flatMap(guessCat =>
            CATEGORIES.map(actualCat =>
                stats.cumulativeMatrix[guessCat]?.[actualCat] ?? 0
            )
        );
        return Math.max(...allValues, 1);
    }, [stats]);

    const getCellStyle = (value: number) => {
        if (matrixMax === 0 || value === 0) return {};
        const proportion = value / matrixMax;
        return {
            backgroundColor: `rgba(40, 116, 166, ${proportion})`,
            color: proportion > 0.5 ? 'white' : 'inherit',
        };
    };

    if (!stats || !stats.cumulativeMatrix) {
      return <p>Confusion matrix data is not available for this entry.</p>;
    }

    return (
        <table className="stats-matrix">
            <thead>
                <tr>
                    <th></th>
                    <th colSpan={3}>Actual Type</th>
                </tr>
                <tr>
                    <th>Guessed Type</th>
                    {CATEGORIES.map(cat => <th key={cat}>{cat}</th>)}
                </tr>
            </thead>
            <tbody>
                {CATEGORIES.map(guessCat => (
                    <tr key={guessCat}>
                        <td>{guessCat}</td>
                        {CATEGORIES.map(actualCat => (
                            <td key={`${guessCat}-${actualCat}`} style={getCellStyle(stats.cumulativeMatrix[guessCat]?.[actualCat] ?? 0)}>
                                {stats.cumulativeMatrix[guessCat]?.[actualCat] ?? 0}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

// --- NEW: Pagination Component ---
const Pagination = ({ currentPage, totalPages, onPageChange }: { currentPage: number, totalPages: number, onPageChange: (page: number, direction: 'next' | 'prev') => void }) => {
  if (totalPages <= 1) return null;

  const handlePrev = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1, 'prev');
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1, 'next');
    }
  };

  // Logic to generate page numbers with ellipses (e.g., 1 ... 4 5 6 ... 10)
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      if (currentPage > 2) pages.push(currentPage - 1);
      if (currentPage !== 1 && currentPage !== totalPages) pages.push(currentPage);
      if (currentPage < totalPages - 1) pages.push(currentPage + 1);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return [...new Set(pages)]; // Remove duplicates
  };

  return (
    <div className="pagination-container">
      <button onClick={handlePrev} disabled={currentPage === 1} className="pagination-button">
        &lt; Previous
      </button>
      {getPageNumbers().map((page, index) =>
        typeof page === 'string' ? (
          <span key={`ellipsis-${index}`} className="pagination-ellipsis">{page}</span>
        ) : (
          <button
            key={page}
            onClick={() => alert('Jumping to specific pages requires a more complex query. Please use Next/Previous.')} // Simplified for this example
            className={`pagination-button ${currentPage === page ? 'active' : ''}`}
          >
            {page}
          </button>
        )
      )}
      <button onClick={handleNext} disabled={currentPage === totalPages} className="pagination-button">
        Next &gt;
      </button>
    </div>
  );
};

export default function HomePage() {
  const [stats, setStats] = useState<CumulativeStats | null>(null);
  const [username, setUsername] = useState('');
  const [customAlert, setCustomAlert] = useState<AlertState>({ show: false, message: '', type: 'error', isExiting: false });
  const [modalConfig, setModalConfig] = useState<ModalConfig>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // --- State for leaderboard data, loading, and modal ---
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStat, setSelectedStat] = useState<LeaderboardEntry | null>(null);
  
  // --- State for pagination ---
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [firstVisible, setFirstVisible] = useState<DocumentSnapshot | null>(null);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);

  const fetchLeaderboardPage = async (page: number = 1, direction: 'next' | 'prev' | 'initial' = 'initial') => {
    setIsLoading(true);
    try {
      const leaderboardCol = collection(db, "leaderboard");
      let q;

      if (direction === 'next' && lastVisible) {
        q = query(leaderboardCol, orderBy("accuracy", "desc"), startAfter(lastVisible), limit(SCORES_PER_PAGE));
      } else if (direction === 'prev' && firstVisible) {
        q = query(leaderboardCol, orderBy("accuracy", "desc"), endBefore(firstVisible), limitToLast(SCORES_PER_PAGE));
      } else {
        q = query(leaderboardCol, orderBy("accuracy", "desc"), limit(SCORES_PER_PAGE));
      }

      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => {
        const docData = doc.data();
        return { 
          id: doc.id, 
          ...docData,
          cumulativeMatrix: docData.confusionMatrix 
        }
      }) as LeaderboardEntry[];

      setLeaderboard(data);
      setFirstVisible(querySnapshot.docs[0] || null);
      setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1] || null);
      setCurrentPage(page);

    } catch (error) {
      console.error("Error fetching leaderboard: ", error);
      showAlert("Could not fetch leaderboard data.", 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  const initializeLeaderboard = async () => {
      setIsLoading(true);
      const leaderboardCol = collection(db, "leaderboard");
      const countSnapshot = await getCountFromServer(leaderboardCol);
      const totalScores = countSnapshot.data().count;
      setTotalPages(Math.ceil(totalScores / SCORES_PER_PAGE));
      await fetchLeaderboardPage(1, 'initial');
      setIsLoading(false);
  };

  useEffect(() => {
    initializeLeaderboard();
  }, []);

  useEffect(() => {
    try {
      const savedStats = localStorage.getItem('haplotypeQuizStats');
      if (savedStats) setStats(JSON.parse(savedStats));
      else setStats(ZEROED_STATS);
    } catch (error) {
      console.error("Failed to parse stats from localStorage", error);
      setStats(ZEROED_STATS);
    }
  }, []);

  // --- Handler functions ---
  const showAlert = (message: string, type: 'success' | 'error') => {
    setCustomAlert({ show: true, message, type, isExiting: false });
    setTimeout(() => {
      setCustomAlert(current => ({ ...current, isExiting: true }));
      setTimeout(() => {
        setCustomAlert({ show: false, message: '', type: 'error', isExiting: false });
      }, 300);
    }, 3000);
  };
  const handleCloseModal = () => setModalConfig({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const confirmAndResetStats = () => {
    localStorage.setItem('haplotypeQuizStats', JSON.stringify(ZEROED_STATS));
    setStats(ZEROED_STATS);
    showAlert("Your stats have been successfully reset.", 'success');
    handleCloseModal();
  };
  const handleResetStats = () => {
    if (stats?.totalAttempted === 0) {
        showAlert("There are no stats to reset.", 'error'); return;
    }
    setModalConfig({ isOpen: true, title: "Confirm Reset", message: "This will permanently delete your local statistics. Are you sure?", onConfirm: confirmAndResetStats });
  };
  const calculateAccuracy = () => {
    if (!stats || stats.totalAttempted === 0) return '0.0';
    return ((stats.totalCorrect / stats.totalAttempted) * 100).toFixed(1);
  };
  const confirmAndUploadScore = async () => {
    handleCloseModal();
    if (!stats) return;
    const cleanedUsername = username.trim();
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
      await initializeLeaderboard();
      localStorage.setItem('haplotypeQuizStats', JSON.stringify(ZEROED_STATS));
      setStats(ZEROED_STATS);
    } catch (e) {
      console.error("Error uploading score: ", e);
      showAlert("An error occurred while uploading your score.", 'error');
    }
  };
  const handleUploadScore = async () => {
    if (!stats || stats.totalAttempted < 0) { showAlert("You must play at least 0 rounds to upload score!", 'error'); return; }
    const cleanedUsername = username.trim();
    if (cleanedUsername.length < 3) { showAlert("Username must be at least 3 characters.", 'error'); return; }
    if (cleanedUsername.length > 30) { showAlert("Username cannot be longer than 30 characters.", 'error'); return; }
    setModalConfig({ isOpen: true, title: "Confirm Submission", message: "This will upload your score and reset local statistics. Are you sure?", onConfirm: confirmAndUploadScore });
  };
  
  return (
    <main className="main-container">
      {/* --- Alerts and Modals --- */}
      {customAlert.show && <div className={`custom-alert alert-${customAlert.type} ${customAlert.isExiting ? 'fade-out' : ''}`}><p>{customAlert.message}</p><button onClick={() => setCustomAlert({ ...customAlert, show: false })} className="alert-close-button">&times;</button></div>}
      {modalConfig.isOpen && <div className="confirm-modal-overlay"><div className="confirm-modal-content"><h3>{modalConfig.title}</h3><p>{modalConfig.message}</p><div className="confirm-modal-buttons"><button onClick={handleCloseModal} className="modal-button modal-button-cancel">Cancel</button><button onClick={modalConfig.onConfirm} className="modal-button modal-button-confirm">Confirm</button></div></div></div>}
      {selectedStat && (
        <div className="confirm-modal-overlay" onClick={() => setSelectedStat(null)}>
            <div className="stats-modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>Statistics for {selectedStat.username}</h3>
                <p className="stats-summary">Overall Accuracy: <strong>{selectedStat.accuracy.toFixed(1)}%</strong> ({selectedStat.totalCorrect} / {selectedStat.totalAttempted} correct)</p>
                <StatsMatrixView {...selectedStat} />
                <button onClick={() => setSelectedStat(null)} className="modal-button modal-button-close">Close</button>
            </div>
        </div>
      )}

      {/* --- Header and Navigation --- */}
      <div className="title-container"><h1>Haplotype Sweep Classifier</h1><p>A human benchmark for genomic pattern recognition</p></div>
      <div className="nav-container"><Link href="/tutorial" className="nav-button tutorial-button"><h2 className="button-title">Tutorial</h2><p className="button-subtitle">A Quick Guide to Spotting Evolution</p></Link><Link href="/play" className="nav-button play-button"><h2 className="button-title">Play</h2><p className="button-subtitle">Test your skills and classify sweep images.</p></Link></div>

      {/* --- User Statistics Section --- */}
      {stats && (
        <div className="stats-container">
          <h2 className="stats-title">Your Cumulative Statistics</h2>
          <p className="stats-summary">Overall Accuracy: <strong>{calculateAccuracy()}%</strong> ({stats.totalCorrect} / {stats.totalAttempted} correct)</p>
          <StatsMatrixView {...stats} />
          <div className="leaderboard-form"><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter a username" className="username-input" maxLength={30} /><button onClick={handleUploadScore} className="upload-button">Upload Score to Leaderboard</button></div>
          <button onClick={handleResetStats} className="reset-button">Reset Stats</button>
        </div>
      )}

      {/* --- Leaderboard Section --- */}
      <div className="leaderboard-container">
        <h2 className="stats-title">Leaderboard 🏆</h2>
        {isLoading ? (
            <p>Loading top scores...</p>
        ) : (
          <>
            <table className="leaderboard-table">
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Username</th>
                        <th>Accuracy</th>
                        <th>Score</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
                    {leaderboard.map((entry, index) => (
                        <tr key={entry.id}>
                            <td>{(currentPage - 1) * SCORES_PER_PAGE + index + 1}</td>
                            <td>{entry.username}</td>
                            <td>{entry.accuracy.toFixed(1)}%</td>
                            <td>{entry.totalCorrect} / {entry.totalAttempted}</td>
                            <td>
                                <button onClick={() => setSelectedStat(entry)} className="view-stats-button">
                                    See Stats
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={fetchLeaderboardPage}
            />
          </>
        )}
      </div>
    </main>
  );
}