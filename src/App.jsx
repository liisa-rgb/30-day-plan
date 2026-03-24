import { useState, useRef, useCallback } from 'react';
import { extractTextFromFile, parseAnswers } from './fileUtils';
import { generatePlan } from './api';
import './App.css';

const QUESTIONS = [
  'What do I want to achieve?',
  'What will I let go of and what do I start doing more?',
  'What could AI help me with?',
  'Who should I talk to?',
  'How do I know that my plan is working?',
];

const PLACEHOLDERS = [
  'e.g. I want to position myself as a strategic advisor who uses AI to amplify my expertise, not replace it...',
  'e.g. I\'ll stop attending meetings where I add no value. I\'ll start dedicating 30 minutes daily to iterative thinking with AI...',
  'e.g. AI could help me draft proposals, analyze feedback data, prepare for difficult conversations, and explore blind spots in my thinking...',
  'e.g. My manager — about my development plan. A colleague in data science — to learn how they use AI. My mentor — for perspective on the shift...',
  'e.g. I\'ll track whether I\'m spending less time on automatable tasks, more on judgment calls, and whether I can articulate my value more clearly...',
];

const ACCEPTED_TYPES = '.txt,.doc,.docx,.pdf,.ppt,.pptx';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <button className="btn btn-primary" onClick={handleCopy}>
      {copied ? '✓ Copied!' : 'Copy Plan to Clipboard'}
    </button>
  );
}

export default function App() {
  const [step, setStep] = useState('input');
  const [inputMode, setInputMode] = useState('type');
  const [answers, setAnswers] = useState(['', '', '', '', '']);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [fileLoaded, setFileLoaded] = useState('');
  const fileRef = useRef(null);

  const updateAnswer = (idx, val) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setFileLoaded('');

    try {
      const text = await extractTextFromFile(file);
      const parsed = parseAnswers(text);
      setAnswers(parsed);
      setFileLoaded(file.name);
    } catch (err) {
      setError(err.message || 'Could not read file. Please try pasting your answers instead.');
    }
  };

  const allFilled = answers.every((a) => a.trim().length > 10);

  const handleGenerate = useCallback(async () => {
    setError('');
    setStep('generating');

    try {
      const result = await generatePlan(answers, QUESTIONS);
      setPlan(result);
      setStep('result');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Something went wrong generating your plan. Please try again.');
      setStep('input');
    }
  }, [answers]);

  const planAsText = plan
    ? `
30 DAY PLAN — THE RELEVANCE ROADMAP
=====================================

GOAL
${plan.goal}

SUCCESS CRITERIA
${plan.successCriteria}

${plan.weeks
        .map(
          (w) => `
-------------------------------------
WEEK ${w.num} — ${w.title}
Focus: ${w.focus}

Actions:
${w.actions.map((a) => `  • ${a}`).join('\n')}

AI Support:
${w.aiSupport.map((a) => `  • ${a}`).join('\n')}

People:
${w.people.map((a) => `  • ${a}`).join('\n')}
`
        )
        .join('')}
-------------------------------------

WHAT I LET GO OF
${plan.letGoOf.map((a) => `  • ${a}`).join('\n')}

WHAT I DO MORE OF
${plan.doMoreOf.map((a) => `  • ${a}`).join('\n')}

NOTES
${plan.notes}

-------------------------------------
Generated with The Relevance Roadmap
Stay Relevant in an AI World
`.trim()
    : '';

  return (
    <div className="app">
      {/* HEADER */}
      <header className="header">
        <div className="header-inner">
          <p className="header-eyebrow">STAY RELEVANT IN AN AI WORLD</p>
          <h1 className="header-title">The Relevance Roadmap</h1>
          <p className="header-subtitle">
            Your personal 30-day plan — from reflection to action
          </p>
        </div>
        <div className="header-accent" />
      </header>

      <main className="main">
        {/* === INPUT === */}
        {step === 'input' && (
          <div className="fade-in">
            <div className="intro">
              <p>
                This is your capstone exercise. You've spent four weeks building your mindset,
                mapping your value, and learning to work with AI. Now it's time to turn those
                insights into action.
              </p>
              <p>
                Answer the five questions below — draw on everything you've reflected on during
                this course. The tool will generate a structured 30-day roadmap you can start
                using immediately.
              </p>
            </div>

            {/* Tabs */}
            <div className="tabs">
              <button
                className={`tab ${inputMode === 'type' ? 'tab-active' : ''}`}
                onClick={() => setInputMode('type')}
              >
                Type Responses
              </button>
              <button
                className={`tab ${inputMode === 'upload' ? 'tab-active' : ''}`}
                onClick={() => setInputMode('upload')}
              >
                Upload File
              </button>
            </div>

            {inputMode === 'upload' && (
              <div className="upload-area">
                <div className="upload-box">
                  <div className="upload-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <p className="upload-label">
                    Upload your answers as TXT, DOCX, PDF, or PPTX
                  </p>
                  <p className="upload-hint">
                    Number your answers 1–5 or use the question text as headers
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept={ACCEPTED_TYPES}
                    onChange={handleFile}
                    style={{ display: 'none' }}
                  />
                  <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>
                    Choose File
                  </button>
                </div>
                {fileLoaded && (
                  <p className="upload-success">✓ Loaded from {fileLoaded} — review and edit below</p>
                )}
              </div>
            )}

            {/* Questions */}
            <div className="questions">
              {QUESTIONS.map((q, i) => (
                <div key={i} className="question-card">
                  <div className="question-num">{i + 1}</div>
                  <label className="question-label">{q}</label>
                  <textarea
                    value={answers[i]}
                    onChange={(e) => updateAnswer(i, e.target.value)}
                    placeholder={PLACEHOLDERS[i]}
                    rows={4}
                  />
                </div>
              ))}
            </div>

            {error && <p className="error">{error}</p>}

            <div className="generate-row">
              {!allFilled && (
                <p className="hint">
                  Please write at least a couple of sentences for each question to generate a meaningful plan.
                </p>
              )}
              <button
                className={`btn btn-generate ${!allFilled ? 'btn-disabled' : ''}`}
                onClick={handleGenerate}
                disabled={!allFilled}
              >
                Generate My 30-Day Plan
              </button>
            </div>
          </div>
        )}

        {/* === GENERATING === */}
        {step === 'generating' && (
          <div className="loading-container fade-in">
            <div className="spinner" />
            <p className="loading-title">Building your roadmap...</p>
            <p className="loading-sub">Analyzing your reflections and creating a personalized plan</p>
          </div>
        )}

        {/* === RESULT === */}
        {step === 'result' && plan && (
          <div className="result fade-in">
            {/* Goal */}
            <div className="goal-card">
              <div className="goal-eyebrow">YOUR GOAL</div>
              <h2 className="goal-text">{plan.goal}</h2>
              <div className="goal-success">
                <span className="goal-success-label">Success looks like:</span>
                <span className="goal-success-text">{plan.successCriteria}</span>
              </div>
            </div>

            {/* Weeks */}
            <div className="weeks">
              {plan.weeks.map((w) => (
                <div key={w.num} className="week-card">
                  <div className="week-header">
                    <span className="week-num">WEEK {w.num}</span>
                    <span className="week-title">{w.title}</span>
                  </div>
                  <p className="week-focus">{w.focus}</p>

                  <div className="week-section">
                    <div className="week-section-title">Actions</div>
                    {w.actions.map((a, j) => (
                      <div key={j} className="week-item">
                        <span className="marker marker-action">→</span> {a}
                      </div>
                    ))}
                  </div>

                  <div className="week-section">
                    <div className="week-section-title">AI Support</div>
                    {w.aiSupport.map((a, j) => (
                      <div key={j} className="week-item">
                        <span className="marker marker-ai">◈</span> {a}
                      </div>
                    ))}
                  </div>

                  <div className="week-section">
                    <div className="week-section-title">People</div>
                    {w.people.map((a, j) => (
                      <div key={j} className="week-item">
                        <span className="marker marker-people">●</span> {a}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Shifts */}
            <div className="shift-row">
              <div className="shift-card">
                <div className="shift-title">What I Let Go Of</div>
                {plan.letGoOf.map((item, i) => (
                  <div key={i} className="shift-item">
                    <span className="shift-x">✕</span> {item}
                  </div>
                ))}
              </div>
              <div className="shift-card">
                <div className="shift-title">What I Do More Of</div>
                {plan.doMoreOf.map((item, i) => (
                  <div key={i} className="shift-item">
                    <span className="shift-check">✓</span> {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {plan.notes && (
              <div className="notes-card">
                <div className="notes-label">A note for your journey</div>
                <p className="notes-text">{plan.notes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="action-row">
              <CopyButton text={planAsText} />
              <button
                className="btn btn-outline"
                onClick={() => {
                  setStep('input');
                  setPlan(null);
                }}
              >
                Regenerate Plan
              </button>
            </div>

            <p className="footer-text">
              The Relevance Roadmap — Stay Relevant in an AI World
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
