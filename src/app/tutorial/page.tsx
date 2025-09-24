'use client'; // This must be at the top to use hooks

import { useState, FC, ReactNode } from 'react';
import { basePath } from '../../../config';
import Link from 'next/link';

// Define props for the new dropdown component
interface ExampleDropdownProps {
  category: string;
  imagePaths: string[];
  children: ReactNode;
}

// Reusable Dropdown Component
const ExampleDropdown: FC<ExampleDropdownProps> = ({ category, imagePaths, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <li className="ruleListItem">
      {children}
      <button onClick={() => setIsOpen(!isOpen)} className="exampleButton">
        Examples
        <span className={`arrow ${isOpen ? 'arrowOpen' : ''}`}>
          ▶
        </span>
      </button>

      {isOpen && (
        <div className="imageGrid">
          {imagePaths.map((path) => (
            <img
              key={path}
              src={`${basePath}/${path}`}
              alt={`${category} sweep example`}
              className="exampleImage"
              // Add a fallback for broken images
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.onerror = null; // prevent infinite loop
                target.src = "https://placehold.co/200x200/eee/ccc?text=Image+Not+Found";
              }}
            />
          ))}
        </div>
      )}
    </li>
  );
};


export default function TutorialPage() {
  return (
    <>
      <style>{`
        .container {
          max-width: 800px;
          margin: 4rem auto;
          padding: 2rem;
          text-align: left;
          line-height: 1.7;
          font-family: sans-serif;
        }

        .title {
          text-align: center;
          margin-bottom: 2rem;
        }

        .sectionTitle {
          margin-top: 2.5rem;
          margin-bottom: 1rem;
          border-bottom: 2px solid #eee;
          padding-bottom: 0.5rem;
        }

        .ruleList {
          list-style: none;
          padding-left: 0;
        }

        .ruleListItem {
          background-color: #f9f9f9;
          border-left: 4px solid #0070f3;
          padding: 1rem 1.5rem;
          margin-bottom: 1rem;
          position: relative;
        }

        .homeLink {
          display: block;
          text-align: center;
          margin-top: 3rem;
          color: #0070f3;
          text-decoration: none;
        }

        .exampleButton {
          display: inline-flex;
          align-items: center;
          margin-left: 1rem;
          font-size: 0.9rem;
          font-weight: 500;
          padding: 0.25rem 0.6rem;
          border-radius: 999px;
          border: 1px solid #ccc;
          background-color: #fff;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .exampleButton:hover {
          background-color: #f0f0f0;
        }

        .arrow {
          margin-left: 0.3rem;
          transition: transform 0.2s ease-in-out;
          display: inline-block;
        }

        .arrowOpen {
          transform: rotate(90deg);
        }

        .imageGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin-top: 1.25rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e5e5;
        }

        .exampleImage {
          width: 100%;
          border-radius: 8px;
          border: 1px solid #ddd;
          background-color: #fff;
        }
      `}</style>
      <div className="container">
        <h1 className="title">How to Play 🎮</h1>

        <p>
          Your goal is to sort images into three categories. The best way to learn is by trial and error, but here are some general clues to get you started:
        </p>

        <ul className="ruleList">
          <ExampleDropdown
            category="Hard"
            imagePaths={['hard_sweep_1.png', 'hard_sweep_2.png', 'hard_sweep_3.png']}
          >
            <strong>Hard Sweep:</strong> Usually shows one long, solid stripe at the top.
          </ExampleDropdown>

          <ExampleDropdown
            category="Soft"
            imagePaths={['soft_sweep_1.png', 'soft_sweep_2.png', 'soft_sweep_3.png']}
          >
            <strong>Soft Sweep:</strong> Tends to have several different stripes starting from the top.
          </ExampleDropdown>

          <ExampleDropdown
            category="Neutral"
            imagePaths={['neutral_sweep_1.png', 'neutral_sweep_2.png', 'neutral_sweep_3.png']}
          >
            <strong>Neutral:</strong> Typically lacks any strong vertical patterns.
          </ExampleDropdown>
        </ul>

        <h2 className="sectionTitle">The Science Behind the Images 🧬</h2>

        <p>
          These messy images are actually visual maps of ancient human DNA. Each row is one person’s genetic sequence, and a red or black pixel shows a specific version of a gene. The white space is missing data, much of which results from the DNA breaking down over thousands of years.
        </p>
        <p>
          The patterns you're sorting are called <strong>“selective sweeps,”</strong> and they tell a story about evolution:
        </p>
        <ul>
          <li>A <strong>Hard Sweep</strong> is where a single, highly beneficial mutation appeared in one ancestor and was so advantageous it quickly spread throughout the whole population.</li>
          <li>A <strong>Soft Sweep</strong> is where several individuals already had a beneficial gene, and this trait rose in popularity from multiple sources at once.</li>
          <li><strong>Neutral</strong> is where no strong selection is happening.</li>
        </ul>

        <h2 className="sectionTitle">Your Mission</h2>
        <p>
          The Garud Lab at UCLA uses AI to find these patterns, but to know if our models are performing well, we need your help. By playing, you are creating a vital human benchmark for science.
        </p>

        <Link href={`${basePath}/`} className="homeLink">
          &larr; Back to Home
        </Link>
      </div>
    </>
  );
}

