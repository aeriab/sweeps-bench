'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import './PlayPage.css';
import { basePath } from '../../../config';

// --- CONFIGURATION ---
const IMAGE_CONFIG = {
  Hard: { count: 290, prefix: 'hard_sweep_idx', folder: 'Hard_Sweep_Images' },
  Soft: { count: 290, prefix: 'soft_sweep_idx', folder: 'Soft_Sweep_Images' },
  Neutral: { count: 290, prefix: 'neutral_sweep_idx', folder: 'Neutral_Sweep_Images' },
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

// FIXED: Restore the ZEROED_STATS constant to provide a default value
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
  // --- EXISTING STATE ---
  const [questionNumber, setQuestionNumber] = useState(1);
  const [currentImage, setCurrentImage] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState<Category | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; color: string } | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isStatsPanelOpen, setIsStatsPanelOpen] = useState(false);

  // --- NEW/MODIFIED STATE ---
  const [cumulativeStats, setCumulativeStats] = useState<CumulativeStats>(ZEROED_STATS);
  const [previousQuestion, setPreviousQuestion] = useState<{ image: string; answer: Category | null }>({ image: '', answer: null });
  const [isReviewing, setIsReviewing] = useState(false);

  useEffect(() => {
    try {
      const savedStatsRaw = localStorage.getItem('haplotypeQuizStats');
      if (savedStatsRaw) {
        setCumulativeStats(JSON.parse(savedStatsRaw));
      }
    } catch (e) {
      console.error("Failed to load stats, starting fresh.", e);
    }
    setupNextQuestion();
  }, []);

  const setupNextQuestion = () => {
    // MODIFIED: Always exit review mode when a new question is set up
    setIsReviewing(false); 
    setFeedback(null);
    setIsAnswered(false);
    const randomCategory = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const categoryInfo = IMAGE_CONFIG[randomCategory];
    const randomIndex = Math.floor(Math.random() * categoryInfo.count) + 1;
    const imageName = `${categoryInfo.prefix}${randomIndex}${IMAGE_EXTENSION}`;
    const imagePath = `${process.env.NEXT_PUBLIC_IMAGE_BASE_URL}/${categoryInfo.folder}/${imageName}`;
    setCurrentImage(imagePath);
    setCorrectAnswer(randomCategory);
  };

  const handleAnswer = (userAnswer: Category) => {
    if (isAnswered || !correctAnswer) return;

    // Save the current question data so we can go "Back" to it
    setPreviousQuestion({ image: currentImage, answer: correctAnswer });
    
    setIsAnswered(true);
    const isCorrect = userAnswer === correctAnswer;

    // --- THIS IS THE RESTORED LOGIC ---
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
    // --- END OF RESTORED LOGIC ---

    // The automatic advance to the next question
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

  // --- NEW HANDLERS for Review Mode ---
  const handleGoBack = () => {
    setIsReviewing(true);
  };
  const handleReturnToQuiz = () => {
    setIsReviewing(false);
  };

  // The Review Screen View
  if (isReviewing) {
    return (
      <div className="quiz-container">
        <div className="quiz-header">
          <h1>Reviewing Question {cumulativeStats.totalAttempted}</h1>
        </div>
        <div className="image-wrapper">
          <Image
            src={previousQuestion.image}
            alt="Previous haplotype sweep visualization"
            width={500} height={500} priority={true} className="sweep-image" unoptimized={true}
          />
        </div>
        <div className="correct-answer-label">
          Correct Answer: {'\u00A0'} <strong>{previousQuestion.answer}</strong>
        </div>
        <div className="navigation-container">
          <button onClick={handleReturnToQuiz} className="nav-button">
            Return to Quiz
          </button>
        </div>
      </div>
    );
  }

  // The Main Quiz View
  return (
    <div className="quiz-container">
      <div className="quiz-header">
        <h1>Question {cumulativeStats.totalAttempted + 1 - (isAnswered ? 1 : 0)}</h1>
        <h2>Accuracy: {cumulativeStats.totalAttempted > 0 ? ((cumulativeStats.totalCorrect / cumulativeStats.totalAttempted) * 100).toFixed(1) + '%' : 'N/A'}</h2>
      </div>

      <div className="image-wrapper">
        {currentImage ? (
          <Image src={currentImage} alt="Haplotype sweep visualization" width={500} height={500} priority={true} className="sweep-image" unoptimized={true}/>
        ) : (
          <div className="image-placeholder">Loading image...</div>
        )}
      </div>

      <div className="feedback-container">
        {feedback && <p className="feedback-message" style={{ color: feedback.color }}>{feedback.message}</p>}
      </div>

      <div className="controls-container">
        {CATEGORIES.map((category) => (
          <button key={category} onClick={() => handleAnswer(category)} disabled={isAnswered} className={`answer-button ${category.toLowerCase()}-btn`}>
            {category}
          </button>
        ))}
      </div>
      
      {/* NEW: The "Back" button, which is always available after the first question */}
      <div className="navigation-container">
        {previousQuestion.image && (
          <button
            onClick={handleGoBack}
            className="nav-button back-button"
            disabled={isAnswered}
          >
            Back
          </button>
        )}
      </div>
      

      {/* --- Stats Panel and Footer --- */}
      <div className={`stats-panel ${isStatsPanelOpen ? 'open' : ''}`}>
        <div className="stats-panel-content">
          <h2 className="stats-title">Your Cumulative Statistics</h2>
          <p className="stats-summary">
            Overall Accuracy: <strong>
              {cumulativeStats.totalAttempted > 0 ? ((cumulativeStats.totalCorrect / cumulativeStats.totalAttempted) * 100).toFixed(1) : '0.0'}%
            </strong> ({cumulativeStats.totalCorrect} / {cumulativeStats.totalAttempted} correct)
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
        <Link href={`${basePath}/`} className="footer-button home-link">
          Home
        </Link>
        <button className="footer-button stats-toggle" onClick={() => setIsStatsPanelOpen(true)}>
          See Stats
        </button>
      </footer>
    </div>
  );
}