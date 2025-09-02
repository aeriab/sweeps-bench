'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import './PlayPage.css';

// --- CONFIGURATION ---
const IMAGE_CONFIG = {
  Hard: { count: 5, prefix: 'sweeps_hard' },
  Soft: { count: 5, prefix: 'sweeps_soft' },
  Neutral: { count: 5, prefix: 'sweeps_neutral' },
};
const IMAGE_EXTENSION = '.png';
const CATEGORIES = ['Neutral', 'Soft', 'Hard'] as const;
type Category = typeof CATEGORIES[number];

// --- TYPES & DEFAULTS ---
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

export default function PlayPage() {
  // Quiz state
  const [questionNumber, setQuestionNumber] = useState(1);
  const [currentImage, setCurrentImage] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState<Category | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; color: string } | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);

  // Stats State
  const [cumulativeStats, setCumulativeStats] = useState<CumulativeStats>(ZEROED_STATS);
  const [isStatsPanelOpen, setIsStatsPanelOpen] = useState(false);

  // Load cumulative stats on initial render
  useEffect(() => {
    try {
      const savedStatsRaw = localStorage.getItem('haplotypeQuizStats');
      if (savedStatsRaw) {
        setCumulativeStats(JSON.parse(savedStatsRaw));
      }
    } catch (e) {
      console.error("Failed to load stats, starting fresh.", e);
    }
    // Load the first question
    setupNextQuestion();
  }, []);

  const setupNextQuestion = () => {
    setFeedback(null);
    setIsAnswered(false);
    const randomCategory = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const categoryInfo = IMAGE_CONFIG[randomCategory];
    const randomIndex = Math.floor(Math.random() * categoryInfo.count) + 1;
    const imageName = `${categoryInfo.prefix}${randomIndex}${IMAGE_EXTENSION}`;
    const imagePath = `/SweepImages/${randomCategory}/${imageName}`;
    setCurrentImage(imagePath);
    setCorrectAnswer(randomCategory);
  };

  const handleAnswer = (userAnswer: Category) => {
    if (isAnswered || !correctAnswer) return;
    setIsAnswered(true);

    const isCorrect = userAnswer === correctAnswer;

    // Update stats immediately
    const newStats = JSON.parse(JSON.stringify(cumulativeStats));
    newStats.totalAttempted += 1;
    if (isCorrect) {
      newStats.totalCorrect += 1;
      setFeedback({ message: 'Correct!', color: '#198754' });
    } else {
      setFeedback({ message: `Incorrect! The answer was ${correctAnswer}.`, color: '#dc3545' });
    }
    newStats.cumulativeMatrix[userAnswer][correctAnswer] += 1;
    
    setCumulativeStats(newStats);
    localStorage.setItem('haplotypeQuizStats', JSON.stringify(newStats));

    setTimeout(() => {
      setQuestionNumber((prev) => prev + 1);
      setupNextQuestion();
    }, 1500);
  };

  // --- Heatmap Logic ---
  const matrixMax = useMemo(() => {
    const allValues = CATEGORIES.flatMap(guessCat => 
        CATEGORIES.map(actualCat => cumulativeStats.cumulativeMatrix[guessCat][actualCat])
    );
    return Math.max(...allValues, 1); // Use 1 as a minimum to avoid division by zero
  }, [cumulativeStats]);
  
  const getCellStyle = (guessCat: Category, actualCat: Category) => {
    const value = cumulativeStats.cumulativeMatrix[guessCat][actualCat];
    if (matrixMax === 0 || value === 0) return {};

    const proportion = value / matrixMax;
    return {
      backgroundColor: `rgba(40, 116, 166, ${proportion})`,
      color: proportion > 0.5 ? 'white' : 'inherit',
    };
  };

  return (
    <div className="quiz-container">
      <div className="quiz-header">
        <h1>Question {questionNumber}</h1>
        <h2>
          Accuracy: {
            cumulativeStats.totalAttempted > 0 
            ? ((cumulativeStats.totalCorrect / cumulativeStats.totalAttempted) * 100).toFixed(1) + '%' 
            : 'N/A'
          }
        </h2>
      </div>
      <div className="image-wrapper">
        {currentImage ? (
          <Image
            src={currentImage}
            alt="Haplotype sweep visualization"
            width={500}
            height={500}
            priority={true}
            className="sweep-image"
          />
        ) : (
          <div className="image-placeholder">Loading image...</div>
        )}
      </div>
      <div className="feedback-container">
        {feedback && (
          <p className="feedback-message" style={{ color: feedback.color }}>
            {feedback.message}
          </p>
        )}
      </div>
      <div className="controls-container">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => handleAnswer(category)}
            disabled={isAnswered}
            className={`answer-button ${category.toLowerCase()}-btn`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* --- Stats Panel and Footer --- */}
      <div className={`stats-panel ${isStatsPanelOpen ? 'open' : ''}`}>
        <div className="stats-panel-content">
          <h2 className="stats-title">Your Cumulative Statistics</h2>
          <p className="stats-summary">
            Overall Accuracy: <strong>
              {cumulativeStats.totalAttempted > 0 ? ((cumulativeStats.totalCorrect / cumulativeStats.totalAttempted) * 100).toFixed(1) : '0.0'}%
            </strong> 
            ({cumulativeStats.totalCorrect} / {cumulativeStats.totalAttempted} correct)
          </p>
          <table className="stats-matrix">
             <thead>
              <tr>
                <th></th><th colSpan={3}>Actual Type</th>
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
                    <td key={`${guessCat}-${actualCat}`} style={getCellStyle(guessCat, actualCat)}>
                      {cumulativeStats.cumulativeMatrix[guessCat][actualCat]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <button className="close-stats-button" onClick={() => setIsStatsPanelOpen(false)}>Close</button>
        </div>
      </div>

      <footer className="quiz-footer">
        <Link href="/" className="footer-button home-link">
          Home
        </Link>
        <button className="footer-button stats-toggle" onClick={() => setIsStatsPanelOpen(true)}>
          See Stats
        </button>
      </footer>
    </div>
  );
}

