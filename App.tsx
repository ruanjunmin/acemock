
import React, { useState } from 'react';
import MaterialsManager from './components/MaterialsManager';
import ExamSetup from './components/ExamSetup';
import ExamTaker from './components/ExamTaker';
import ExamResults from './components/ExamResults';
import HistoryViewer from './components/HistoryViewer';
import MistakeBook from './components/MistakeBook';
import GenerationLoader from './components/GenerationLoader';
import QuickQAModal from './components/QuickQAModal';
import QAHistoryViewer from './components/QAHistoryViewer';
import DashboardStats from './components/DashboardStats';
import StudyGuideViewer from './components/StudyGuideViewer';
import SearchConfigModal from './components/SearchConfigModal';
import { Material, ExamConfig, ExamSession, UserAnswer, Question, QASession, StudyGuide } from './types';
import { generateExamQuestions, generateStudyGuide } from './services/geminiService';
import { saveExamSession, getAllExamSessions, saveMistake } from './services/storageService';
import { BookIcon, SearchChatIcon, ChartBarIcon, SettingsIcon } from './components/Icons';

// Feature Icon Components
const FeatureIcon1 = () => (
  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);
const FeatureIcon2 = () => (
  <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);
const FeatureIcon3 = () => (
  <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const FeatureIcon4 = () => (
  <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 v2M7 7h10" />
  </svg>
);

const App: React.FC = () => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [currentSession, setCurrentSession] = useState<ExamSession | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewState, setViewState] = useState<'DASHBOARD' | 'HISTORY' | 'MISTAKES' | 'QA_HISTORY' | 'STATS'>('DASHBOARD');
  
  // QA Modal State
  const [isQAOpen, setIsQAOpen] = useState(false);
  const [qaSessionToLoad, setQaSessionToLoad] = useState<QASession | null>(null);

  // Search Config State
  const [isSearchConfigOpen, setIsSearchConfigOpen] = useState(false);

  // Study Guide State
  const [studyGuideContent, setStudyGuideContent] = useState<StudyGuide | null>(null);

  // Generation logs state
  const [genLogs, setGenLogs] = useState<string[]>([]);
  const [genProgress, setGenProgress] = useState(0);

  const startExam = async (config: ExamConfig) => {
    setIsGenerating(true);
    setGenLogs([]);
    setGenProgress(0);
    const generationStartTime = performance.now();

    try {
      let questions: Question[] = [];
      let usedHistory = false;

      // Get names for the record
      const selectedMaterials = materials.filter(m => config.materialIds.includes(m.id));
      const materialNames = selectedMaterials.map(m => m.name);

      // 1. Check if we have a historical session with EXACTLY the same configuration
      try {
        const history = await getAllExamSessions();
        const matchedSession = history.find(h => {
           const hIds = [...h.config.materialIds].sort();
           const cIds = [...config.materialIds].sort();
           const hTypes = [...h.config.questionTypes].sort();
           const cTypes = [...config.questionTypes].sort();
           
           return (
             hIds.length === cIds.length && hIds.every((val, index) => val === cIds[index]) &&
             hTypes.length === cTypes.length && hTypes.every((val, index) => val === cTypes[index]) &&
             h.config.questionCount === config.questionCount &&
             h.config.difficulty === config.difficulty &&
             h.config.shuffleQuestions === config.shuffleQuestions &&
             h.config.mode === config.mode &&
             h.config.answerSheetStyle === config.answerSheetStyle // Check layout style too
           );
        });

        if (matchedSession) {
             setGenLogs(["检测到相同的历史配置，正在加载历史数据..."]);
             setGenProgress(100);
             await new Promise(r => setTimeout(r, 800)); // Fake delay for UX
             questions = matchedSession.questions;
             usedHistory = true;
        }
      } catch (err) {
        console.warn("Failed to check history", err);
      }

      // 2. If no history found, generate from AI
      if (!usedHistory) {
          // Note: selectedMaterials is already filtered above
          questions = await generateExamQuestions(
            selectedMaterials, 
            config.questionCount, 
            config.questionTypes,
            config.difficulty,
            !!config.shuffleQuestions,
            (msg, progress) => {
                setGenLogs(prev => {
                    if (prev.length > 0 && prev[prev.length - 1] === msg) return prev;
                    return [...prev, msg];
                });
                setGenProgress(progress);
            }
          );
      }

      const generationEndTime = performance.now();
      const generationTimeMs = Math.round(generationEndTime - generationStartTime);

      const session: ExamSession = {
        id: Date.now().toString(),
        config,
        materialNames, // Store the names snapshot
        questions,
        answers: {},
        status: 'IN_PROGRESS',
        score: 0,
        totalPossibleScore: questions.length, 
        startTime: Date.now(),
        generationTimeMs // 保存生成耗时
      };
      
      setCurrentSession(session);
    } catch (error) {
      alert("生成试卷失败，请尝试更换文档或减少题目数量。");
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const completeExam = async (answers: Record<string, UserAnswer>, score: number, total: number) => {
     if (!currentSession) return;
     
     const completedSession: ExamSession = {
         ...currentSession,
         answers,
         score,
         totalPossibleScore: total,
         status: 'COMPLETED',
         endTime: Date.now()
     };
     
     setCurrentSession(completedSession);
     
     // Save to IndexedDB (History)
     try {
       await saveExamSession(completedSession);
     } catch (e) {
       console.error("Failed to save exam history", e);
     }

     // Save Mistakes to Notebook
     try {
       const wrongAnswers = Object.values(answers).filter(a => {
           if (a.isCorrect) return false;
           // Filter out completely empty answers (e.g. unattempted fill-in-blanks)
           if (Array.isArray(a.answer)) {
               return a.answer.length > 0 && a.answer.some(val => val && val.trim() !== '');
           }
           return a.answer && a.answer.trim() !== '';
       });

       for (const ans of wrongAnswers) {
          const question = currentSession.questions.find(q => q.id === ans.questionId);
          if (question) {
            await saveMistake({
              question: question,
              userWrongAnswer: ans.answer,
              timestamp: Date.now()
            });
          }
       }
     } catch (e) {
       console.error("Failed to save mistakes", e);
     }
  };

  const resetApp = () => {
    setCurrentSession(null);
    setViewState('DASHBOARD');
  };

  const handleSelectHistory = (session: ExamSession) => {
    setCurrentSession(session);
    setViewState('DASHBOARD');
  };

  const handleOpenQA = () => {
      setQaSessionToLoad(null); // Clear history selection
      setIsQAOpen(true);
  }

  const handleSelectQASession = (session: QASession) => {
      setQaSessionToLoad(session);
      setIsQAOpen(true);
  }

  const handleGenerateStudyGuide = async () => {
      const activeMaterials = materials.filter(m => selectedMaterialIds.includes(m.id));
      setIsGenerating(true);
      setGenLogs(["AI 正在阅读文档...", "正在提炼核心概念...", "正在构建思维导图 SVG...", "正在生成结构化学习指南..."]);
      setGenProgress(50);
      try {
          const guide = await generateStudyGuide(activeMaterials);
          setStudyGuideContent(guide);
      } catch (e) {
          alert("生成学习指南失败");
      } finally {
          setIsGenerating(false);
      }
  };

  const activeMaterials = materials.filter(m => selectedMaterialIds.includes(m.id));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900 relative overflow-x-hidden">
      
      {/* Background Decor */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-100 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-[-20%] left-[20%] w-[500px] h-[500px] bg-pink-100 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      {/* Generation Loader Overlay */}
      {isGenerating && <GenerationLoader logs={genLogs} progress={genProgress} />}

      {/* Modals */}
      {studyGuideContent && (
          <StudyGuideViewer 
             content={studyGuideContent} 
             onClose={() => setStudyGuideContent(null)}
          />
      )}

      {isQAOpen && (
        <QuickQAModal 
          isOpen={isQAOpen} 
          onClose={() => setIsQAOpen(false)}
          materials={activeMaterials}
          initialSession={qaSessionToLoad}
        />
      )}

      <SearchConfigModal 
          isOpen={isSearchConfigOpen}
          onClose={() => setIsSearchConfigOpen(false)}
      />

      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer group" onClick={resetApp}>
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md group-hover:shadow-blue-500/30 transition-all">
              A
            </div>
            <span className="text-xl font-bold text-slate-800 tracking-tight group-hover:text-blue-600 transition-colors">AceMock</span>
          </div>
          
          <div className="flex items-center space-x-3">
            {!currentSession && viewState !== 'HISTORY' && (
              <button 
                onClick={() => setViewState('HISTORY')}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-full text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>历史记录</span>
              </button>
            )}

            {!currentSession && viewState !== 'STATS' && (
              <button 
                onClick={() => setViewState('STATS')}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-full text-sm font-medium text-slate-600 hover:text-green-600 hover:bg-green-50 transition-all"
              >
                <ChartBarIcon />
                <span>分析报告</span>
              </button>
            )}

             {!currentSession && viewState !== 'QA_HISTORY' && (
              <button 
                onClick={() => setViewState('QA_HISTORY')}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-full text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
              >
                <SearchChatIcon />
                <span>问答记录</span>
              </button>
            )}

            {!currentSession && viewState !== 'MISTAKES' && (
              <button 
                onClick={() => setViewState('MISTAKES')}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-full text-sm font-medium text-slate-600 hover:text-orange-600 hover:bg-orange-50 transition-all"
              >
                <BookIcon />
                <span>错题本</span>
              </button>
            )}

            {/* Search Config Button */}
            {!currentSession && (
                <button
                    onClick={() => setIsSearchConfigOpen(true)}
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-full text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
                    title="搜索渠道配置"
                >
                    <SettingsIcon />
                </button>
            )}
            
            {currentSession && (
                <div className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-500 uppercase tracking-wider border border-slate-200">
                    {currentSession.status === 'IN_PROGRESS' ? '考试中' : '回顾'}
                </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 pt-24 pb-12">
        
        {/* History View */}
        {viewState === 'HISTORY' && !currentSession && (
           <HistoryViewer 
              onSelectSession={handleSelectHistory} 
              onBack={() => setViewState('DASHBOARD')}
              materials={materials} 
           />
        )}

        {/* Stats View */}
        {viewState === 'STATS' && !currentSession && (
            <DashboardStats onBack={() => setViewState('DASHBOARD')} />
        )}

        {/* QA History View */}
        {viewState === 'QA_HISTORY' && !currentSession && (
           <QAHistoryViewer 
              onSelectSession={handleSelectQASession}
              onBack={() => setViewState('DASHBOARD')}
           />
        )}

        {/* Mistake Notebook View */}
        {viewState === 'MISTAKES' && !currentSession && (
           <MistakeBook 
              onBack={() => setViewState('DASHBOARD')}
           />
        )}

        {/* Dashboard / Setup View */}
        {viewState === 'DASHBOARD' && !currentSession && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Hero Section */}
            <div className="text-center mb-12 relative">
              <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight leading-tight">
                AI 助你轻松掌握 <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">知识点</span>
              </h1>
              <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
                上传您的讲义、PDF 或文档。我们将为您生成定制的模拟考试，助您更聪明、更高效地备考。
              </p>

              {/* Feature Grid - Moved from Sidebar to Hero */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                 <div className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-white/50 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-all">
                    <div className="p-2 bg-blue-50 rounded-xl mb-3"><FeatureIcon1 /></div>
                    <h3 className="font-bold text-slate-800 text-sm">多格式支持</h3>
                    <p className="text-xs text-slate-500 mt-1">PDF, Word, Excel, 图片</p>
                 </div>
                 <div className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-white/50 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-all">
                    <div className="p-2 bg-indigo-50 rounded-xl mb-3"><FeatureIcon2 /></div>
                    <h3 className="font-bold text-slate-800 text-sm">智能题型</h3>
                    <p className="text-xs text-slate-500 mt-1">单选、多选、填空、问答</p>
                 </div>
                 <div className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-white/50 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-all">
                    <div className="p-2 bg-purple-50 rounded-xl mb-3"><FeatureIcon3 /></div>
                    <h3 className="font-bold text-slate-800 text-sm">个性化配置</h3>
                    <p className="text-xs text-slate-500 mt-1">自定义时长与难度</p>
                 </div>
                 <div className="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-white/50 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-all">
                    <div className="p-2 bg-orange-50 rounded-xl mb-3"><FeatureIcon4 /></div>
                    <h3 className="font-bold text-slate-800 text-sm">进度追踪</h3>
                    <p className="text-xs text-slate-500 mt-1">历史记录自动存储</p>
                 </div>
              </div>
            </div>

            {/* Main Workspace Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Col: Upload */}
              <div className="lg:col-span-7">
                <MaterialsManager 
                    materials={materials} 
                    setMaterials={setMaterials}
                    selectedIds={selectedMaterialIds}
                    onToggleSelection={setSelectedMaterialIds}
                    onGenerateGuide={handleGenerateStudyGuide}
                />
              </div>

              {/* Right Col: Config */}
              <div className="lg:col-span-5 sticky top-24">
                 <ExamSetup 
                    materials={materials} 
                    selectedMaterialIds={selectedMaterialIds}
                    onStart={startExam} 
                    isGenerating={isGenerating}
                    onOpenQA={handleOpenQA}
                 />
              </div>
            </div>
          </div>
        )}

        {/* Exam View */}
        {currentSession && currentSession.status === 'IN_PROGRESS' && (
           <ExamTaker 
              session={currentSession} 
              onComplete={completeExam} 
              onExit={resetApp} 
           />
        )}

        {/* Results View */}
        {currentSession && currentSession.status === 'COMPLETED' && (
            <ExamResults 
               session={currentSession} 
               onRestart={resetApp}
            />
        )}

      </main>
    </div>
  );
};

export default App;
