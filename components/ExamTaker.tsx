import React, { useState, useEffect, useRef } from 'react';
import { ExamSession, QuestionType, UserAnswer, Question } from '../types';
import { gradeShortAnswer } from '../services/geminiService';
import { CheckCircleIcon, LightBulbIcon, FlagIcon, SparklesIcon, PrinterIcon, ChevronDownIcon, ChevronUpIcon } from './Icons';
import AITutorPanel from './AITutorPanel';
import TTSControl from './TTSControl';
import { MarkdownText } from './MarkdownText';

interface Props {
  session: ExamSession;
  onComplete: (answers: Record<string, UserAnswer>, score: number, total: number) => void;
  onExit: () => void;
}

const ExamTaker: React.FC<Props> = ({ session, onComplete, onExit }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFlashcardBack, setShowFlashcardBack] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false); 
  const [isTutorOpen, setIsTutorOpen] = useState(false);
  
  // Printing state
  const [isPrinting, setIsPrinting] = useState(false);

  // Matching Type State
  const [selectedMatchingLeft, setSelectedMatchingLeft] = useState<string | null>(null);

  // Timer state
  const [timeLeft, setTimeLeft] = useState<number | null>(
    session.config.timeLimit ? session.config.timeLimit * 60 : null
  );

  const currentQ = session.questions[currentIdx];
  const isLast = currentIdx === session.questions.length - 1;
  const isSubmitRef = useRef(false);
  const isPracticeMode = session.config.mode === 'PRACTICE';
  const isSequentialLayout = session.config.answerSheetStyle === 'SEQUENTIAL';

  useEffect(() => {
    setShowFlashcardBack(false);
    if (!isPracticeMode) setShowExplanation(false); 
    setShowExplanation(false);
    setSelectedMatchingLeft(null);
    
    if (currentQ.type === QuestionType.ORDERING && !answers[currentQ.id]) {
        const initialOrder = currentQ.options || [];
        setAnswers(prev => ({
            ...prev,
            [currentQ.id]: { questionId: currentQ.id, answer: initialOrder }
        }));
    }

    // Initialize Fill In Blank Answer as array if needed
    if (currentQ.type === QuestionType.FILL_IN_BLANK && !answers[currentQ.id]) {
        setAnswers(prev => ({
            ...prev,
            [currentQ.id]: { questionId: currentQ.id, answer: [] }
        }));
    }
  }, [currentIdx, currentQ]);

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
        if (!isSubmitRef.current) {
            alert("考试时间到！系统将自动提交您的试卷。");
            submitExam();
        }
        return;
    }
    const timerId = setInterval(() => {
      setTimeLeft(prev => (prev !== null && prev > 0) ? prev - 1 : 0);
    }, 1000);
    return () => clearInterval(timerId);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const updateAnswer = (newAnswerData: Partial<UserAnswer>) => {
      setAnswers(prev => ({
          ...prev,
          [currentQ.id]: {
              questionId: currentQ.id,
              answer: prev[currentQ.id]?.answer || '', 
              ...prev[currentQ.id], 
              ...newAnswerData
          }
      }));
  }

  const handleSingleSelect = (option: string) => updateAnswer({ answer: option });

  const handleMultiSelect = (option: string) => {
    const currentAns = (answers[currentQ.id]?.answer as string[]) || [];
    let newAns;
    if (currentAns.includes(option)) {
      newAns = currentAns.filter(a => a !== option);
    } else {
      newAns = [...currentAns, option];
    }
    updateAnswer({ answer: newAns });
  };

  const handleTextChange = (text: string) => updateAnswer({ answer: text });
  
  const handleBlankChange = (index: number, val: string) => {
      const currentAns = (answers[currentQ.id]?.answer as string[]) || [];
      const newAns = [...currentAns];
      newAns[index] = val;
      updateAnswer({ answer: newAns });
  };
  
  const handleTrueFalse = (val: string) => updateAnswer({ answer: val });

  const handleOrderingMove = (idx: number, direction: 'up' | 'down') => {
      const currentList = (answers[currentQ.id]?.answer as string[]) || currentQ.options || [];
      const newList = [...currentList];
      if (direction === 'up' && idx > 0) {
          [newList[idx], newList[idx - 1]] = [newList[idx - 1], newList[idx]];
      } else if (direction === 'down' && idx < newList.length - 1) {
          [newList[idx], newList[idx + 1]] = [newList[idx + 1], newList[idx]];
      }
      updateAnswer({ answer: newList });
  };

  const handleMatchingSelect = (side: 'left' | 'right', value: string) => {
      const currentPairs = (answers[currentQ.id]?.answer as string[]) || [];
      const currentMap = new Map();
      currentPairs.forEach(p => {
          const [l, r] = p.split(' :: ');
          if(l && r) currentMap.set(l, r);
      });

      if (side === 'left') {
          setSelectedMatchingLeft(value);
      } else {
          if (selectedMatchingLeft) {
              currentMap.set(selectedMatchingLeft, value);
              setSelectedMatchingLeft(null);
              const newPairs: string[] = [];
              currentMap.forEach((v, k) => newPairs.push(`${k} :: ${v}`));
              updateAnswer({ answer: newPairs });
          }
      }
  };

  const handleFlashcardSelfRate = (correct: boolean) => {
      updateAnswer({ 
          answer: correct ? 'CORRECT' : 'INCORRECT',
          isCorrect: correct,
          score: correct ? 1 : 0
      });
      if (!isLast) setTimeout(() => setCurrentIdx(p => p + 1), 300);
  }

  const toggleMarkQuestion = () => {
      const isMarked = !!answers[currentQ.id]?.isMarked;
      updateAnswer({ isMarked: !isMarked });
  }

  const handlePrint = () => {
      setIsPrinting(true);
      setTimeout(() => {
          window.print();
          setIsPrinting(false);
      }, 500);
  };

  const submitExam = async () => {
    if (isSubmitRef.current) return;
    isSubmitRef.current = true;
    setIsSubmitting(true);
    let totalScore = 0;
    const finalAnswers = { ...answers };
    
    for (const q of session.questions) {
      const userAns = finalAnswers[q.id];
      if (!userAns) {
        finalAnswers[q.id] = { questionId: q.id, answer: '', isCorrect: false, score: 0 };
        continue;
      }

      if (q.type === QuestionType.SINGLE_CHOICE || q.type === QuestionType.TRUE_FALSE) {
        const isCorrect = String(userAns.answer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
        finalAnswers[q.id].isCorrect = isCorrect;
        finalAnswers[q.id].score = isCorrect ? 1 : 0;
        if (isCorrect) totalScore += 1;
      
      } else if (q.type === QuestionType.MULTI_CHOICE) {
        const correctSet = new Set((q.correctAnswer as string[]).map(s => s.trim()));
        const userSet = new Set((userAns.answer as string[]).map(s => s.trim()));
        const isCorrect = correctSet.size === userSet.size && [...correctSet].every(x => userSet.has(x));
        finalAnswers[q.id].isCorrect = isCorrect;
        finalAnswers[q.id].score = isCorrect ? 1 : 0;
        if (isCorrect) totalScore += 1;

      } else if (q.type === QuestionType.FILL_IN_BLANK) {
        const correctArr = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
        const userArr = Array.isArray(userAns.answer) ? userAns.answer : [userAns.answer];
        
        let isCorrect = true;
        // If length differs, incorrect
        if (correctArr.length !== userArr.length && correctArr.length > 0) {
            // Special case: sometimes user might input all in one box if we fallback? 
            // But with new UI, length should typically match if user fills all.
            // Strict length check is okay.
        }
        
        // Ensure every blank matches
        for (let i = 0; i < correctArr.length; i++) {
             const u = (userArr[i] || "").trim().toLowerCase();
             const c = (correctArr[i] || "").trim().toLowerCase();
             if (u !== c) {
                 isCorrect = false; 
                 break;
             }
        }
        
        finalAnswers[q.id].isCorrect = isCorrect;
        finalAnswers[q.id].score = isCorrect ? 1 : 0;
        if (isCorrect) totalScore += 1;

      } else if (q.type === QuestionType.ORDERING) {
          const correctOrder = q.correctAnswer as string[];
          const userOrder = userAns.answer as string[];
          let isCorrect = true;
          if (!userOrder || correctOrder.length !== userOrder.length) isCorrect = false;
          else {
              for(let i=0; i<correctOrder.length; i++) {
                  if (correctOrder[i].trim() !== userOrder[i].trim()) {
                      isCorrect = false;
                      break;
                  }
              }
          }
          finalAnswers[q.id].isCorrect = isCorrect;
          finalAnswers[q.id].score = isCorrect ? 1 : 0;
          if (isCorrect) totalScore += 1;

      } else if (q.type === QuestionType.MATCHING) {
          const correctPairs = new Set((q.correctAnswer as string[]).map(s => s.replace(/\s+/g, '')));
          const userPairs = new Set((userAns.answer as string[]).map(s => s.replace(/\s+/g, '')));
          const isCorrect = correctPairs.size === userPairs.size && [...correctPairs].every(x => userPairs.has(x));
          finalAnswers[q.id].isCorrect = isCorrect;
          finalAnswers[q.id].score = isCorrect ? 1 : 0;
          if (isCorrect) totalScore += 1;

      } else if (q.type === QuestionType.SHORT_ANSWER || q.type === QuestionType.NOUN_EXPLANATION || q.type === QuestionType.ANALYSIS) {
        try {
            const grading = await gradeShortAnswer(q.questionText, q.correctAnswer as string, userAns.answer as string);
            finalAnswers[q.id].score = grading.score / 100;
            finalAnswers[q.id].feedback = grading.feedback;
            finalAnswers[q.id].isCorrect = grading.score >= 60; 
            totalScore += (grading.score / 100);
        } catch (e) {
            finalAnswers[q.id].score = 0;
            finalAnswers[q.id].feedback = "AI 评分失败";
        }
      } else if (q.type === QuestionType.FLASHCARD) {
          if (userAns.isCorrect) totalScore += 1;
      }
    }

    onComplete(finalAnswers, totalScore, session.questions.length);
  };

  const mapTypeToLabel = (type: QuestionType) => {
      switch(type) {
          case QuestionType.SINGLE_CHOICE: return '单项选择题';
          case QuestionType.MULTI_CHOICE: return '多项选择题';
          case QuestionType.TRUE_FALSE: return '判断题';
          case QuestionType.ORDERING: return '排序题';
          case QuestionType.MATCHING: return '连线题';
          case QuestionType.FILL_IN_BLANK: return '填空题';
          case QuestionType.SHORT_ANSWER: return '简答题';
          case QuestionType.NOUN_EXPLANATION: return '名词解释';
          case QuestionType.ANALYSIS: return '鉴析题';
          case QuestionType.FLASHCARD: return '抽认卡';
          default: return type;
      }
  }

  const groupedQuestions = session.questions.reduce((acc, q, idx) => {
    if (!acc[q.type]) acc[q.type] = [];
    acc[q.type].push({ ...q, originalIndex: idx });
    return acc;
  }, {} as Record<string, (Question & { originalIndex: number })[]>);

  const typeOrder = [
    QuestionType.SINGLE_CHOICE, QuestionType.MULTI_CHOICE, QuestionType.TRUE_FALSE,
    QuestionType.FILL_IN_BLANK, QuestionType.MATCHING, QuestionType.ORDERING, 
    QuestionType.NOUN_EXPLANATION, QuestionType.SHORT_ANSWER, QuestionType.ANALYSIS, QuestionType.FLASHCARD
  ];
  
  const sortedGroupKeys = Object.keys(groupedQuestions).sort((a, b) => {
      return typeOrder.indexOf(a as QuestionType) - typeOrder.indexOf(b as QuestionType);
  });

  if (isPrinting) {
      return (
          <div className="bg-white p-8 max-w-4xl mx-auto print:p-0">
             <div className="text-center border-b pb-6 mb-8">
                 <h1 className="text-3xl font-bold mb-2">模拟考试试卷</h1>
                 <p className="text-slate-500">
                     题数: {session.questions.length} | 难度: {session.config.difficulty} | 限时: {session.config.timeLimit ? session.config.timeLimit + '分钟' : '不限'}
                 </p>
             </div>
             
             {sortedGroupKeys.map((typeKey) => (
                <div key={typeKey} className="mb-8">
                    <h3 className="text-xl font-bold text-slate-800 border-l-4 border-slate-800 pl-3 mb-4 uppercase">
                        {mapTypeToLabel(typeKey as QuestionType)}
                    </h3>
                    <div className="space-y-6">
                        {groupedQuestions[typeKey].map((q) => (
                             <div key={q.id} className="break-inside-avoid">
                                <div className="flex items-start mb-2">
                                    <span className="font-bold mr-2 text-lg">{q.originalIndex + 1}.</span>
                                    <span className="text-lg font-medium leading-normal">{q.questionText}</span>
                                </div>
                                <div className="ml-8">
                                    {q.options && (q.type === QuestionType.SINGLE_CHOICE || q.type === QuestionType.MULTI_CHOICE) && (
                                        <div className="grid grid-cols-1 gap-1">
                                            {q.options.map((opt, i) => (
                                                <div key={i} className="flex items-center">
                                                    <span className="inline-block w-6 font-bold">{['A','B','C','D','E'][i]}.</span>
                                                    <span>{opt}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {q.type === QuestionType.TRUE_FALSE && (
                                        <div className="flex gap-8 mt-2 text-sm">
                                            <span>( &nbsp; ) 正确</span>
                                            <span>( &nbsp; ) 错误</span>
                                        </div>
                                    )}
                                    {q.type === QuestionType.FILL_IN_BLANK && (
                                        <div className="mt-4 border-b border-slate-400 w-full max-w-md"></div>
                                    )}
                                    {(q.type === QuestionType.SHORT_ANSWER || q.type === QuestionType.NOUN_EXPLANATION || q.type === QuestionType.ANALYSIS) && (
                                        <div className="mt-2 h-32 border border-slate-200 rounded w-full bg-slate-50"></div>
                                    )}
                                </div>
                             </div>
                        ))}
                    </div>
                </div>
             ))}

             <div className="break-before-page mt-12 pt-8 border-t-2 border-slate-800">
                 <h2 className="text-2xl font-bold text-center mb-6">参考答案与解析</h2>
                 <div className="space-y-4">
                     {session.questions.map((q, idx) => (
                         <div key={q.id} className="border-b border-slate-100 pb-2">
                             <div className="flex items-baseline">
                                 <span className="font-bold mr-2 w-8">#{idx+1}</span>
                                 <div className="flex-1">
                                     <p className="font-bold text-slate-800">
                                        答案: {Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer}
                                     </p>
                                     <p className="text-sm text-slate-600 mt-1">解析: {q.explanation}</p>
                                 </div>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>

             <div className="mt-12 text-center text-xs text-slate-400 border-t pt-4">
                 Generated by AceMock AI Platform
             </div>
          </div>
      );
  }

  const renderSingleChoice = () => (
    <div className="space-y-4">
      {currentQ.options?.map((opt, idx) => {
        const isSelected = answers[currentQ.id]?.answer === opt;
        return (
          <button key={idx} onClick={() => handleSingleSelect(opt)} className={`w-full text-left p-5 rounded-xl border-2 transition-all flex justify-between items-center group ${isSelected ? 'border-blue-600 bg-blue-50/80 shadow-sm' : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50'}`}>
            <div className="flex items-center">
              <span className={`flex items-center justify-center w-8 h-8 rounded-full border-2 mr-4 transition-colors font-medium text-sm ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 text-slate-500 bg-white group-hover:border-blue-300'}`}>{['A', 'B', 'C', 'D', 'E', 'F'][idx] || idx + 1}</span>
              <span className={`text-base ${isSelected ? 'font-semibold text-blue-900' : 'text-slate-700'}`}>{opt}</span>
            </div>
            {isSelected && (<div className="text-blue-600"><CheckCircleIcon /></div>)}
          </button>
        );
      })}
    </div>
  );
  const renderMultiChoice = () => (
    <div className="space-y-4">
      {currentQ.options?.map((opt, idx) => {
        const selected = (answers[currentQ.id]?.answer as string[] || []).includes(opt);
        return (
          <button key={idx} onClick={() => handleMultiSelect(opt)} className={`w-full text-left p-5 rounded-xl border-2 transition-all flex justify-between items-center group ${selected ? 'border-blue-600 bg-blue-50/80 shadow-sm' : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50'}`}>
            <div className="flex items-center">
              <span className={`flex items-center justify-center w-6 h-6 rounded border-2 mr-4 transition-colors ${selected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white group-hover:border-blue-300'}`}>{selected && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</span>
              <span className={`text-base ${selected ? 'font-semibold text-blue-900' : 'text-slate-700'}`}>{opt}</span>
            </div>
            {selected && (<div className="text-blue-600"><CheckCircleIcon /></div>)}
          </button>
        )
      })}
    </div>
  );
  const renderTrueFalse = () => (
      <div className="flex gap-6 mt-4">
          {['True', 'False'].map((val) => {
              const isSelected = answers[currentQ.id]?.answer === val;
              const isTrue = val === 'True';
              return (
                <button key={val} onClick={() => handleTrueFalse(val)} className={`flex-1 py-8 rounded-2xl border-2 text-xl font-bold flex flex-col items-center justify-center transition-all ${isSelected ? (isTrue ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-700') : 'border-slate-100 bg-white hover:border-slate-300 text-slate-600 hover:bg-slate-50'}`}>
                    <span className="text-3xl mb-2">{isTrue ? '✅' : '❌'}</span>
                    <span>{isTrue ? '正 确' : '错 误'}</span>
                </button>
              )
          })}
      </div>
  );
  const renderOrdering = () => {
      const list = (answers[currentQ.id]?.answer as string[]) || currentQ.options || [];
      return (
          <div className="space-y-3">
              <p className="text-sm text-slate-400 mb-2">请使用右侧按钮调整顺序</p>
              {list.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 animate-in slide-in-from-left-2 duration-300">
                      <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-sm border border-slate-200">{idx + 1}</span>
                      <div className="flex-grow p-4 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-800 font-medium">{item}</div>
                      <div className="flex flex-col gap-1">
                          <button onClick={() => handleOrderingMove(idx, 'up')} disabled={idx === 0} className="p-2 bg-slate-100 hover:bg-blue-100 hover:text-blue-600 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg></button>
                          <button onClick={() => handleOrderingMove(idx, 'down')} disabled={idx === list.length - 1} className="p-2 bg-slate-100 hover:bg-blue-100 hover:text-blue-600 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition-colors"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button>
                      </div>
                  </div>
              ))}
          </div>
      )
  };
  const renderMatching = () => {
      const correctPairs = (currentQ.correctAnswer as string[]) || [];
      const leftItems = correctPairs.map(p => p.split(' :: ')[0]).sort();
      const rightItems = currentQ.options || [];
      const currentPairsUser = (answers[currentQ.id]?.answer as string[]) || [];
      const userMap = new Map<string, string>();
      currentPairsUser.forEach(p => { const [l, r] = p.split(' :: '); if(l && r) userMap.set(l, r); });
      return (
          <div className="flex flex-col md:flex-row gap-8">
              <div className="flex-1 space-y-3">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">项目</h4>
                  {leftItems.map((item, idx) => {
                      const isSelected = selectedMatchingLeft === item;
                      const matchedValue = userMap.get(item);
                      return (
                          <button key={idx} onClick={() => handleMatchingSelect('left', item)} className={`w-full text-left p-4 rounded-xl border-2 transition-all relative ${isSelected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 bg-white hover:border-blue-300'} ${matchedValue ? 'border-green-500 bg-green-50' : ''}`}>
                              <span className="font-medium text-slate-800">{item}</span>
                              {matchedValue && (<div className="absolute right-0 top-0 bottom-0 flex items-center pr-3"><div className="w-2 h-2 rounded-full bg-green-500"></div><div className="h-0.5 w-4 bg-green-500 ml-1"></div></div>)}
                          </button>
                      )
                  })}
              </div>
              <div className="flex-1 space-y-3">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">匹配项</h4>
                   {rightItems.map((item, idx) => {
                       const isUsed = Array.from(userMap.values()).includes(item);
                       return (
                           <button key={idx} onClick={() => handleMatchingSelect('right', item)} disabled={isUsed} className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center ${isUsed ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed opacity-60' : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md cursor-pointer text-slate-700'}`}>
                               {isUsed && <span className="mr-2 text-green-500">✓</span>}
                               <span className="font-medium">{item}</span>
                           </button>
                       )
                   })}
              </div>
          </div>
      )
  }
  
  const renderFillInBlank = () => {
      // Regex to split by 3+ underscores OR parentheses () or full-width parentheses （）
      const regex = /(__{3,})|(\(\s*\))|（\s*）/g;
      const parts = currentQ.questionText.split(regex).filter(p => p !== undefined); 
      
      // We need to keep track of how many blanks we've rendered to index the answer array
      let blankIndex = 0;
      
      const userAnswerArr = (answers[currentQ.id]?.answer as string[]) || [];

      return (
          <div className="leading-loose text-lg text-slate-800">
              {parts.map((part, idx) => {
                  const isPlaceholder = /^__{3,}$|^\(\s*\)$|^（\s*）$/.test(part);
                  
                  if (isPlaceholder) {
                      const currentIndex = blankIndex++;
                      const val = userAnswerArr[currentIndex] || '';
                      
                      return (
                          <span key={idx} className="inline-block mx-1">
                              <input 
                                type="text" 
                                value={val}
                                onChange={(e) => handleBlankChange(currentIndex, e.target.value)}
                                className="border-b-2 border-slate-400 focus:border-blue-600 outline-none px-2 py-0.5 text-center bg-blue-50/30 text-blue-900 font-bold min-w-[80px] w-auto transition-colors placeholder:text-slate-300 placeholder:text-xs"
                                placeholder={`空 ${currentIndex + 1}`}
                              />
                          </span>
                      );
                  }
                  
                  // Return text span
                  return <span key={idx}>{part}</span>;
              })}
          </div>
      );
  };

  const renderTextInput = (placeholder: string) => (
    <div className="mt-4">
      <textarea className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[200px] text-lg leading-relaxed" placeholder={placeholder} value={answers[currentQ.id]?.answer as string || ''} onChange={(e) => handleTextChange(e.target.value)} />
    </div>
  );
  
  const renderFlashcard = () => (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
          <div onClick={() => setShowFlashcardBack(!showFlashcardBack)} className="cursor-pointer perspective-1000 w-full max-w-xl">
              <div className={`relative w-full p-12 text-center rounded-2xl shadow-xl border-t-4 border-t-blue-500 border-x border-b border-slate-100 transition-all duration-500 transform bg-white hover:scale-[1.01] min-h-[280px] flex items-col justify-center`}>
                  <div className="w-full flex flex-col items-center justify-center">
                    <p className="text-xs font-bold text-blue-500 uppercase mb-6 tracking-widest bg-blue-50 px-3 py-1 rounded-full">{showFlashcardBack ? "答案 (背面)" : "问题 (正面)"}</p>
                    <p className="text-2xl font-serif text-slate-800 leading-relaxed">{showFlashcardBack ? (Array.isArray(currentQ.correctAnswer) ? currentQ.correctAnswer.join(', ') : currentQ.correctAnswer) : currentQ.questionText}</p>
                  </div>
              </div>
          </div>
          {showFlashcardBack ? (
              <div className="flex gap-4 mt-8 w-full max-w-md animate-in slide-in-from-bottom-2">
                   <button onClick={() => handleFlashcardSelfRate(false)} className="flex-1 py-3 bg-red-100 text-red-700 font-bold rounded-xl hover:bg-red-200 border border-red-200 transition-colors">❌ 记错了</button>
                   <button onClick={() => handleFlashcardSelfRate(true)} className="flex-1 py-3 bg-green-100 text-green-700 font-bold rounded-xl hover:bg-green-200 border border-green-200 transition-colors">✅ 记住了</button>
              </div>
          ) : (
             <div className="mt-8 text-slate-400 text-sm flex items-center animate-pulse"><span className="mr-2">👆</span> 点击卡片翻转查看答案</div>
          )}
      </div>
  )

  if (isSubmitting) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-10 text-center">
         <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-8"></div>
         <h2 className="text-3xl font-bold text-slate-800 mb-2">正在判卷...</h2>
         <p className="text-slate-500 text-lg">AI 教授正在批改您的试卷，请保持网络连接。</p>
      </div>
    );
  }

  const getQuestionStatus = (idx: number) => {
      const q = session.questions[idx];
      const ans = answers[q.id];
      if (idx === currentIdx) return 'current';
      if (ans) {
          if (Array.isArray(ans.answer)) {
              if (ans.answer.length > 0 && ans.answer.some(a => a && a.trim() !== '')) return 'answered';
          } else if (ans.answer) {
              return 'answered';
          }
      }
      return 'unanswered';
  };

  const isMarked = !!answers[currentQ.id]?.isMarked;

  const correctAnswerText = Array.isArray(currentQ.correctAnswer) ? currentQ.correctAnswer.join(', ') : currentQ.correctAnswer;
  const ttsText = `参考答案：${correctAnswerText}。${currentQ.explanation ? `详细解析：${currentQ.explanation}` : ''}`;
  
  // Check if answer is AI generated (supplemented) based on keywords in explanation
  const isAiGenerated = currentQ.explanation?.includes('AI 联网') || currentQ.explanation?.includes('AI 补全');

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col lg:flex-row gap-8 pb-10">
      
      <AITutorPanel 
        question={currentQ}
        isOpen={isTutorOpen}
        onClose={() => setIsTutorOpen(false)}
      />

      <div className="flex-1 min-w-0">
          
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] flex flex-col relative">
            
            {/* Main Header with Questions Nav */}
            <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/30 flex justify-between items-start">
               <div>
                  <div className="flex items-center space-x-3 mb-2">
                      <span className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-md shadow-sm tracking-wide uppercase">
                         {mapTypeToLabel(currentQ.type)}
                      </span>
                      <span className="text-slate-400 text-sm font-medium">题目 {currentIdx + 1} / {session.questions.length}</span>
                  </div>
                  {currentQ.type !== QuestionType.FLASHCARD && currentQ.type !== QuestionType.FILL_IN_BLANK && (
                     <h3 className="text-xl md:text-2xl font-bold text-slate-900 leading-snug mt-4">
                       {currentQ.questionText}
                     </h3>
                  )}
                  {currentQ.type === QuestionType.FILL_IN_BLANK && (
                      <div className="mt-4 mb-2 p-1">
                          {/* Use the new renderer for the question text itself */}
                          {renderFillInBlank()}
                      </div>
                  )}
               </div>
               
               <div className="flex flex-col items-end gap-2">
                   {/* Top Nav Buttons */}
                   <div className="flex items-center bg-white rounded-lg border border-slate-200 shadow-sm p-1">
                        <button
                            onClick={() => setCurrentIdx(p => Math.max(0, p - 1))}
                            disabled={currentIdx === 0}
                            className={`p-1.5 rounded transition-all ${currentIdx === 0 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600'}`}
                            title="上一题"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div className="w-px h-4 bg-slate-200 mx-1"></div>
                        <button
                            onClick={() => setCurrentIdx(p => Math.min(session.questions.length - 1, p + 1))}
                            disabled={isLast}
                            className={`p-1.5 rounded transition-all ${isLast ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600'}`}
                            title="下一题"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                   </div>

                   <div className="flex space-x-2">
                       <button 
                          onClick={handlePrint}
                          className="p-2 bg-white rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-all"
                          title="打印试卷"
                       >
                          <PrinterIcon />
                       </button>

                       <button 
                          onClick={toggleMarkQuestion}
                          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold transition-all
                             ${isMarked 
                                ? 'bg-orange-50 text-orange-600 border-orange-200 shadow-sm' 
                                : 'bg-white text-slate-400 border-slate-200 hover:text-orange-500 hover:border-orange-200'
                             }
                          `}
                          title="标记此题以便稍后检查"
                       >
                          <FlagIcon />
                          <span>{isMarked ? '已标记' : '标记'}</span>
                       </button>
                   </div>
               </div>
            </div>

            <div className="p-6 md:p-8 flex-grow">
               {currentQ.type === QuestionType.SINGLE_CHOICE && renderSingleChoice()}
               {currentQ.type === QuestionType.MULTI_CHOICE && renderMultiChoice()}
               {currentQ.type === QuestionType.TRUE_FALSE && renderTrueFalse()}
               {currentQ.type === QuestionType.ORDERING && renderOrdering()}
               {currentQ.type === QuestionType.MATCHING && renderMatching()}
               {/* FILL_IN_BLANK is rendered in header mostly, but maybe if we want to add extra space? 
                   Actually, the input fields are embedded in the question text now. 
                   So we don't need a separate input area unless fallback.
               */}
               {currentQ.type === QuestionType.FILL_IN_BLANK && (
                   <div className="text-sm text-slate-400 italic mt-4 border-t border-slate-50 pt-2">
                       请直接点击上方的横线进行填空。
                   </div>
               )}

               {currentQ.type === QuestionType.SHORT_ANSWER && renderTextInput("请输入您的回答，AI 将为您评分...")}
               {currentQ.type === QuestionType.NOUN_EXPLANATION && renderTextInput("请输入名词解释...")}
               {currentQ.type === QuestionType.ANALYSIS && renderTextInput("请输入鉴析内容...")}
               {currentQ.type === QuestionType.FLASHCARD && renderFlashcard()}
               
               {currentQ.type !== QuestionType.FLASHCARD && (
                    <div className="mt-8 pt-6 border-t border-dashed border-slate-200">
                        {isPracticeMode ? (
                            <div className="flex items-center justify-between">
                                <button 
                                    onClick={() => setShowExplanation(!showExplanation)}
                                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center space-x-2
                                        ${showExplanation ? 'bg-slate-100 text-slate-600' : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'}
                                    `}
                                >
                                    <LightBulbIcon />
                                    <span>{showExplanation ? '收起解析' : '查看答案 & 解析'}</span>
                                </button>
                                {showExplanation && (
                                   <div className="flex items-center space-x-4">
                                       <button
                                         onClick={() => setIsTutorOpen(true)}
                                         className="flex items-center space-x-1.5 text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors animate-pulse hover:animate-none"
                                       >
                                           <SparklesIcon />
                                           <span>AI 答疑</span>
                                       </button>
                                       <span className="text-xs text-slate-400 font-medium">练习模式已启用</span>
                                   </div>
                                )}
                            </div>
                        ) : (
                             <div className="flex items-center justify-center text-slate-300 text-sm italic">
                                 考试模式下不可查看解析
                             </div>
                        )}
                        
                        {showExplanation && (
                            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/50 shadow-sm animate-in slide-in-from-top-4 duration-500 overflow-hidden">
                                {/* Header of Answer Block */}
                                <div className="px-6 py-3 bg-white border-b border-slate-100 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-4 bg-blue-600 rounded-full"></div>
                                        <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">参考答案</h4>
                                        {isAiGenerated ? (
                                            <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 ml-2">
                                                ✨ AI 联网补全
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 ml-2">
                                                文档原文摘录
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <TTSControl text={ttsText} />
                                    </div>
                                </div>
                                
                                {/* Content Wrapper */}
                                <div className="p-6 space-y-6">
                                    {/* VERBATIM ANSWER AREA */}
                                    <div className="bg-white p-5 rounded-xl border border-blue-50 shadow-sm prose prose-blue max-w-none">
                                        <MarkdownText text={correctAnswerText} />
                                    </div>

                                    {/* EXPLANATION AREA */}
                                    {currentQ.explanation && (
                                        <div className="border-t border-slate-100 pt-5">
                                            <h5 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <LightBulbIcon />
                                                详细解析
                                            </h5>
                                            <div className="text-slate-600 leading-relaxed text-sm bg-indigo-50/30 p-4 rounded-xl border border-indigo-50/50">
                                                {currentQ.explanation}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-white flex justify-between items-center sticky bottom-0 z-10">
               <button
                  onClick={() => setCurrentIdx(p => Math.max(0, p - 1))}
                  disabled={currentIdx === 0}
                  className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all border
                    ${currentIdx === 0 
                        ? 'border-slate-100 text-slate-300 cursor-not-allowed bg-slate-50' 
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'}`}
                >
                  上一题
                </button>
                
                {!isLast && (
                  <button
                    onClick={() => setCurrentIdx(p => p + 1)}
                    className="px-8 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-black shadow-lg shadow-slate-200 transition-all active:scale-95 flex items-center"
                  >
                    下一题
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                )}

                {isLast && (
                     <button
                        onClick={() => submitExam()}
                        className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95"
                    >
                        提交试卷
                    </button>
                )}
            </div>
        </div>
      </div>

      <div className="w-full lg:w-80 shrink-0 space-y-6">
          
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
             <div className="flex items-center justify-between mb-2">
                 <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">剩余时间</span>
                 {timeLeft !== null && timeLeft < 300 && <span className="text-xs font-bold text-red-500 animate-pulse">即将结束</span>}
             </div>
             {timeLeft !== null ? (
                 <div className={`text-3xl font-mono font-bold tracking-tight ${timeLeft < 60 ? 'text-red-500' : 'text-slate-800'}`}>
                    {formatTime(timeLeft)}
                 </div>
             ) : (
                 <div className="text-xl font-bold text-slate-800">不限时</div>
             )}
             
             <button 
               onClick={onExit} 
               className="w-full mt-4 py-2 text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium border border-transparent hover:border-red-100"
             >
               退出考试
             </button>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 sticky top-24 max-h-[calc(100vh-10rem)] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800">答题卡</h3>
                  <div className="text-sm font-medium text-slate-500">
                      <span className="text-blue-600">{Object.keys(answers).length}</span>
                      <span className="mx-1">/</span>
                      {session.questions.length}
                  </div>
              </div>

              <div className="flex items-center space-x-3 text-[10px] font-medium text-slate-500 mb-6 bg-slate-50 p-2 rounded-lg">
                  <div className="flex items-center"><span className="w-2.5 h-2.5 bg-blue-600 rounded-sm mr-1"></span>当前</div>
                  <div className="flex items-center"><span className="w-2.5 h-2.5 bg-blue-100 border border-blue-200 rounded-sm mr-1"></span>已答</div>
                  <div className="flex items-center"><span className="w-2.5 h-2.5 bg-white border border-slate-300 rounded-sm mr-1"></span>未答</div>
              </div>

              <div className="space-y-6">
                {isSequentialLayout ? (
                    <div className="grid grid-cols-5 gap-2">
                        {session.questions.map((q, idx) => {
                            const status = getQuestionStatus(idx);
                            const isFlagged = !!answers[q.id]?.isMarked;
                            return (
                                <button
                                  key={q.id}
                                  onClick={() => setCurrentIdx(idx)}
                                  className={`h-9 rounded-lg font-bold text-xs transition-all relative
                                    ${status === 'current' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-105 ring-2 ring-blue-200' : ''}
                                    ${status === 'answered' ? 'bg-blue-50 text-blue-700 border border-blue-200' : ''}
                                    ${status === 'unanswered' ? 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-600' : ''}
                                    ${isFlagged && status !== 'current' ? 'ring-2 ring-orange-300 ring-offset-1 border-orange-300' : ''}
                                  `}
                                >
                                    {idx + 1}
                                    {isFlagged && (
                                        <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border border-white ${status === 'current' ? 'bg-orange-300' : 'bg-orange-500'}`}></div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                ) : (
                    sortedGroupKeys.map(typeKey => (
                        <div key={typeKey}>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-100 pb-1">
                                {mapTypeToLabel(typeKey as QuestionType)}
                            </h4>
                            <div className="grid grid-cols-5 gap-2">
                                 {groupedQuestions[typeKey].map(q => {
                                     const idx = q.originalIndex;
                                     const status = getQuestionStatus(idx);
                                     const isFlagged = !!answers[q.id]?.isMarked;
                                     
                                     return (
                                         <button
                                            key={q.id}
                                            onClick={() => setCurrentIdx(idx)}
                                            className={`h-9 rounded-lg font-bold text-xs transition-all relative
                                              ${status === 'current' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-105 ring-2 ring-blue-200' : ''}
                                              ${status === 'answered' ? 'bg-blue-50 text-blue-700 border border-blue-200' : ''}
                                              ${status === 'unanswered' ? 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-600' : ''}
                                              ${isFlagged && status !== 'current' ? 'ring-2 ring-orange-300 ring-offset-1 border-orange-300' : ''}
                                            `}
                                         >
                                             {idx + 1}
                                             {isFlagged && (
                                                 <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full border border-white ${status === 'current' ? 'bg-orange-300' : 'bg-orange-500'}`}></div>
                                             )}
                                         </button>
                                     )
                                 })}
                            </div>
                        </div>
                    ))
                )}
              </div>

              <button
                onClick={() => submitExam()}
                className="w-full mt-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-[0.98]"
              >
                交卷
              </button>
          </div>

      </div>

    </div>
  );
};

export default ExamTaker;