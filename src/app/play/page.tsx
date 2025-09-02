'use client';

import { useState, useEffect, useRef } from 'react'; // Import useRef
import Link from 'next/link';
import Image from 'next/image';
import './PlayPage.css';

// --- SCALABILITY CONFIGURATION ---
const IMAGE_CONFIG = {
  Hard: { count: 5, prefix: 'sweeps_hard' },
  Soft: { count: 5, prefix: 'sweeps_soft' },
  Neutral: { count: 5, prefix: 'sweeps_neutral' },
};
const IMAGE_EXTENSION = '.png';
const TOTAL_QUESTIONS = 20;
const CATEGORIES = ['Neutral', 'Soft', 'Hard'] as const;
type Category = typeof CATEGORIES[number];

type ConfusionMatrix = { [key in Category]: { [key in Category]: number } };
const initialMatrix: ConfusionMatrix = {
  Neutral: { Neutral: 0, Soft: 0, Hard: 0 },
  Soft: { Neutral: 0, Soft: 0, Hard: 0 },
  Hard: { Neutral: 0, Soft: 0, Hard: 0 },
};

export default function PlayPage() {
  const [questionNumber, setQuestionNumber] = useState(1);
  const [score, setScore] = useState(0);
  const [currentImage, setCurrentImage] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState<Category | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; color: string } | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [quizEnded, setQuizEnded] = useState(false);
  
  const [sessionMatrix, setSessionMatrix] = useState<ConfusionMatrix>(JSON.parse(JSON.stringify(initialMatrix)));
  const [showExtraStats, setShowExtraStats] = useState(false);
  
  // --- BUG FIX: Add a ref to track if stats have been saved ---
  const hasSavedStats = useRef(false);

  useEffect(() => {
    // --- BUG FIX: Check if the quiz has ended AND if we haven't already saved the stats ---
    if (quizEnded && !hasSavedStats.current) {
      // 1. Get existing stats from localStorage
      const savedStatsRaw = localStorage.getItem('haplotypeQuizStats');
      let stats = {
        totalCorrect: 0,
        totalAttempted: 0,
        cumulativeMatrix: JSON.parse(JSON.stringify(initialMatrix)),
      };

      if (savedStatsRaw) {
        try {
          stats = JSON.parse(savedStatsRaw);
        } catch (e) {
            console.error("Could not parse existing stats, starting fresh.", e);
        }
      }

      // 2. Add current session's results to the totals
      stats.totalCorrect += score;
      stats.totalAttempted += TOTAL_QUESTIONS;

      for (const guessCat of CATEGORIES) {
        for (const actualCat of CATEGORIES) {
          stats.cumulativeMatrix[guessCat][actualCat] += sessionMatrix[guessCat][actualCat];
        }
      }
      
      // 3. Save the updated stats back to localStorage
      localStorage.setItem('haplotypeQuizStats', JSON.stringify(stats));
      
      // --- BUG FIX: Set the ref to true so this code block never runs again for this session ---
      hasSavedStats.current = true;
    }
  }, [quizEnded, score, sessionMatrix]);


  const setupNextQuestion = () => {
    if (questionNumber > TOTAL_QUESTIONS) {
      setQuizEnded(true);
      return;
    }
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

  useEffect(() => {
    setupNextQuestion();
  }, [questionNumber]);

  const handleAnswer = (userAnswer: Category) => {
    if (isAnswered || !correctAnswer) return;
    setIsAnswered(true);

    setSessionMatrix(prevMatrix => {
        const newMatrix = JSON.parse(JSON.stringify(prevMatrix)); // Deep copy
        newMatrix[userAnswer][correctAnswer]++;
        return newMatrix;
    });

    if (userAnswer === correctAnswer) {
      setFeedback({ message: 'Correct!', color: '#198754' });
      setScore((prevScore) => prevScore + 1);
    } else {
      setFeedback({ message: `Incorrect! The answer was ${correctAnswer}.`, color: '#dc3545' });
    }

    setTimeout(() => {
      setQuestionNumber((prevNumber) => prevNumber + 1);
    }, 1500);
  };

  if (quizEnded) {
    return (
      <div className="quiz-container">
        <div className="results-card">
          <h1 className="results-title">Quiz Complete!</h1>
          <div className="results-tabs">
            <button 
              className={`tab-button ${!showExtraStats ? 'active' : ''}`}
              onClick={() => setShowExtraStats(false)}
            >
              This Session's Score
            </button>
            <button 
              className={`tab-button ${showExtraStats ? 'active' : ''}`}
              onClick={() => setShowExtraStats(true)}
            >
              This Session's Stats
            </button>
          </div>
          {!showExtraStats ? (
            <div className="results-content">
              <p className="results-score">
                You scored:
                <span>{score} / {TOTAL_QUESTIONS}</span>
              </p>
              <p className="results-accuracy">
                Accuracy: {((score / TOTAL_QUESTIONS) * 100).toFixed(1)}%
              </p>
            </div>
          ) : (
            <div className="results-content">
              <h2 className="matrix-title">Session Confusion Matrix</h2>
              <table className="confusion-matrix">
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
                          {sessionMatrix[guessCat][actualCat]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Link href="/" className="home-button">
            Return to Home & View Cumulative Stats
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-container">
      <div className="quiz-header">
        <h1>Question {questionNumber} / {TOTAL_QUESTIONS}</h1>
        <h2>Score: {score}</h2>
      </div>
      <div className="image-wrapper">
        {currentImage ? (
          <Image
            src={currentImage}
            alt="Haplotype sweep visualization"
            width={600}
            height={400}
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
    </div>
  );
}

