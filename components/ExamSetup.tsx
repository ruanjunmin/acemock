import React, { useState, useEffect, useRef } from 'react';
import { ExamConfig, ExamMode, Material, QuestionType } from '../types';
import { SearchChatIcon, SparklesIcon, ClockIcon } from './Icons';
import { recommendQuestionTypes } from '../services/geminiService';

interface Props {
  materials: Material[]; 
  selectedMaterialIds: string[];
  onStart: (config: ExamConfig) => void;
  isGenerating: boolean;
  onOpenQA: () => void;
}

const TYPE_OPTIONS = [
  { id: QuestionType.SINGLE_CHOICE, label: '单项选择题', desc: '基础单选' },
  { id: QuestionType.MULTI_CHOICE, label: '多项选择题', desc: '多项组合' },
  { id: QuestionType.TRUE_FALSE, label: '判断题', desc: '是非判断' },
  { id: QuestionType.NOUN_EXPLANATION, label: '名词解释', desc: '概念定义' },
  { id: QuestionType.MATCHING, label: '连线题', desc: '概念配对' },
  { id: QuestionType.ORDERING, label: '排序题', desc: '逻辑顺序' },
  { id: QuestionType.FILL_IN_BLANK, label: '填空题', desc: '关键记忆' },
  { id: QuestionType.SHORT_ANSWER, label: '简答题', desc: '综合问答' },
  { id: QuestionType.ANALYSIS, label: '鉴析题', desc: '案例分析' },
  { id: QuestionType.FLASHCARD, label: '抽认卡模式', desc: '快速翻牌' },
];

const ExamSetup: React.FC<Props> = ({ materials, selectedMaterialIds, onStart, isGenerating, onOpenQA }) => {
  const [questionCount, setQuestionCount] = useState(30);
  const [difficulty, setDifficulty] = useState<'简单' | '中等' | '困难'>('中等');
  const [timeLimit, setTimeLimit] = useState(0); // 0 means unlimited
  const [examMode, setExamMode] = useState<ExamMode>('EXAM');
  const [answerSheetStyle, setAnswerSheetStyle] = useState<'GROUPED' | 'SEQUENTIAL'>('GROUPED');
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>([
    QuestionType.SINGLE_CHOICE, 
    QuestionType.MULTI_CHOICE,
    QuestionType.TRUE_FALSE
  ]);
  const [isAnalyzingTypes, setIsAnalyzingTypes] = useState(false);
  const [analysisTimer, setAnalysisTimer] = useState(0);

  // 动态计时器逻辑：追踪判断耗时
  useEffect(() => {
    let interval: any;
    if (isAnalyzingTypes) {
      const startTime = performance.now();
      setAnalysisTimer(0);
      interval = setInterval(() => {
        setAnalysisTimer((performance.now() - startTime) / 1000);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isAnalyzingTypes]);

  const toggleType = (type: QuestionType) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const isAllSelected = selectedTypes.length === TYPE_OPTIONS.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTypes([]);
    } else {
      setSelectedTypes(TYPE_OPTIONS.map(t => t.id));
    }
  };

  const handleSmartAnalyze = async () => {
    const activeMaterials = materials.filter(m => selectedMaterialIds.includes(m.id));
    if (activeMaterials.length === 0) {
        alert("请先选择参考资料文档");
        return;
    }
    
    setIsAnalyzingTypes(true);
    try {
        const recommended = await recommendQuestionTypes(activeMaterials);
        if (recommended && recommended.length > 0) {
            setSelectedTypes(recommended);
        } else {
            alert("AI 未能提供明确建议，请手动选择。");
        }
    } catch (e) {
        console.error(e);
        alert("智能判断服务暂时不可用");
    } finally {
        setIsAnalyzingTypes(false);
    }
  };

  const handleStart = (shuffle: boolean) => {
    if (selectedMaterialIds.length === 0) {
      alert("请至少在左侧选择一份文档。");
      return;
    }
    if (selectedTypes.length === 0) {
      alert("请至少选择一种题型。");
      return;
    }
    
    onStart({
      materialIds: selectedMaterialIds,
      questionTypes: selectedTypes,
      questionCount,
      difficulty,
      timeLimit: timeLimit > 0 ? timeLimit : undefined,
      shuffleQuestions: shuffle,
      mode: examMode,
      answerSheetStyle
    });
  };

  const hasFiles = selectedMaterialIds.length > 0;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 h-full flex flex-col transition-all duration-300">
      <div className="mb-6 pb-4 border-b border-slate-100">
          <h2 className="text-2xl font-bold text-slate-800">考试配置</h2>
          <p className="text-sm text-slate-400 mt-1">定制您的专属模拟考试</p>
      </div>
      
      <div className="space-y-8 flex-grow overflow-y-auto pr-2 custom-scrollbar">
        
        {/* Exam Mode Toggle */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
           <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">考试模式</label>
           <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm relative">
              <div 
                 className={`absolute top-1 bottom-1 w-[48%] bg-blue-600 rounded-md shadow-sm transition-all duration-300 ease-in-out ${examMode === 'PRACTICE' ? 'translate-x-[104%]' : 'translate-x-1'}`} 
              />
              <button
                onClick={() => setExamMode('EXAM')}
                className={`flex-1 py-2 text-sm font-bold relative z-10 transition-colors ${examMode === 'EXAM' ? 'text-white' : 'text-slate-500 hover:text-slate-700'}`}
              >
                🎓 正式考试
              </button>
              <button
                onClick={() => setExamMode('PRACTICE')}
                className={`flex-1 py-2 text-sm font-bold relative z-10 transition-colors ${examMode === 'PRACTICE' ? 'text-white' : 'text-slate-500 hover:text-slate-700'}`}
              >
                🏋️ 练习模式
              </button>
           </div>
           <p className="text-xs text-slate-400 mt-2 ml-1">
             {examMode === 'EXAM' ? '倒计时结束或交卷后才显示答案和解析。' : '做题过程中可随时查看答案和解析，适合刷题。'}
           </p>
        </div>

        {/* Question Types Grid */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">题目类型</label>
            <div className="flex space-x-2 items-center">
                
                {/* 判断耗时显示模块 - 新增 */}
                {(isAnalyzingTypes || (analysisTimer > 0 && !isAnalyzingTypes)) && (
                  <div className={`flex items-center px-2.5 py-1 rounded-lg border text-[10px] font-mono transition-all duration-300 animate-in fade-in slide-in-from-right-2 shadow-sm
                    ${isAnalyzingTypes 
                      ? 'bg-amber-50 border-amber-200 text-amber-600 ring-2 ring-amber-100/50 animate-pulse' 
                      : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                  >
                    <div className={`${isAnalyzingTypes ? 'animate-spin' : ''}`}>
                      <ClockIcon />
                    </div>
                    <span className="ml-1.5 whitespace-nowrap">
                       <span className="opacity-60 mr-1">判断耗时:</span>
                       <span className="font-bold">{analysisTimer.toFixed(1)}s</span>
                    </span>
                  </div>
                )}

                <button 
                  onClick={handleSmartAnalyze}
                  disabled={isAnalyzingTypes || !hasFiles}
                  className={`text-xs font-bold flex items-center px-2.5 py-1 rounded-lg transition-all border
                     ${isAnalyzingTypes ? 'bg-indigo-50 text-indigo-400 cursor-not-allowed border-indigo-100' : 'text-indigo-600 bg-indigo-50 border-indigo-100 hover:bg-indigo-100 hover:border-indigo-200'}
                     ${!hasFiles && 'opacity-50 cursor-not-allowed'}
                  `}
                  title="由 AI 分析文档内容并自动勾选适合的题型"
                >
                  {isAnalyzingTypes ? (
                      <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mr-1.5"></div>
                  ) : (
                      <SparklesIcon className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  智能判断
                </button>
                <button 
                  onClick={toggleSelectAll}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition-colors"
                >
                  {isAllSelected ? '取消全选' : '全选'}
                </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TYPE_OPTIONS.map(type => {
              const isSelected = selectedTypes.includes(type.id);
              return (
                <button
                  key={type.id}
                  onClick={() => toggleType(type.id)}
                  className={`relative p-4 rounded-xl text-left border-2 transition-all duration-200 group
                    ${isSelected
                      ? 'border-blue-500 bg-blue-50/50 shadow-md shadow-blue-500/10'
                      : 'border-slate-100 bg-slate-50 hover:border-blue-200 hover:bg-white'
                    }`}
                >
                  <div className="flex justify-between items-start">
                      <div>
                          <p className={`font-semibold ${isSelected ? 'text-blue-700' : 'text-slate-700 group-hover:text-slate-900'}`}>{type.label}</p>
                          <p className={`text-xs mt-1 ${isSelected ? 'text-blue-500' : 'text-slate-400'}`}>{type.desc}</p>
                      </div>
                      {isSelected && (
                          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                          </div>
                      )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sliders and Selects Container */}
        <div className="space-y-6 bg-slate-50 p-5 rounded-2xl border border-slate-100">
          
          {/* Answer Sheet Style Toggle */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3">答题卡布局</label>
            <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm relative">
                <div 
                    className={`absolute top-1 bottom-1 w-[48%] bg-slate-800 rounded-md shadow-sm transition-all duration-300 ease-in-out ${answerSheetStyle === 'SEQUENTIAL' ? 'translate-x-[104%]' : 'translate-x-1'}`} 
                />
                <button
                  onClick={() => setAnswerSheetStyle('GROUPED')}
                  className={`flex-1 py-2 text-sm font-bold relative z-10 transition-colors ${answerSheetStyle === 'GROUPED' ? 'text-white' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  📑 按题型归类
                </button>
                <button
                  onClick={() => setAnswerSheetStyle('SEQUENTIAL')}
                  className={`flex-1 py-2 text-sm font-bold relative z-10 transition-colors ${answerSheetStyle === 'SEQUENTIAL' ? 'text-white' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  🔢 按题目顺序
                </button>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-bold text-slate-700">题目数量</label>
                <span className="bg-white px-2 py-1 rounded-md text-xs font-bold text-blue-600 shadow-sm border border-slate-100">{questionCount} 题</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="60" 
              value={questionCount} 
              onChange={(e) => setQuestionCount(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:bg-slate-300 transition-colors"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium">
              <span>1</span>
              <span>30</span>
              <span>60</span>
            </div>
          </div>

          <div>
             <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-bold text-slate-700">考试限时</label>
                <span className="bg-white px-2 py-1 rounded-md text-xs font-bold text-blue-600 shadow-sm border border-slate-100">{timeLimit === 0 ? '不限时' : `${timeLimit} 分钟`}</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="120" 
              step="5"
              value={timeLimit} 
              onChange={(e) => setTimeLimit(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:bg-slate-300 transition-colors"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium">
              <span>不限</span>
              <span>60分</span>
              <span>120分</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-3">难度等级</label>
            <div className="flex bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
              {['简单', '中等', '困难'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setDifficulty(lvl as any)}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${
                    difficulty === lvl 
                    ? 'bg-slate-800 text-white shadow-md transform scale-[1.02]' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-100">
        {isGenerating ? (
          <button
            disabled
            className="w-full py-4 rounded-xl font-bold text-lg shadow-none bg-slate-100 text-slate-400 cursor-not-allowed flex items-center justify-center"
          >
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              正在分析与生成...
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-3">
             <button
                onClick={() => handleStart(true)}
                disabled={!hasFiles}
                className={`col-span-1 h-20 rounded-xl font-bold transition-all flex flex-col items-center justify-center border-2 space-y-1
                  ${!hasFiles
                    ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                    : 'border-indigo-100 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-500/10 active:scale-[0.98]'
                  }`}
             >
                <span className="text-xl">🎲</span> 
                <span className="text-xs">随机卷</span>
             </button>
             
             <button
                onClick={() => handleStart(false)}
                disabled={!hasFiles}
                className={`col-span-1 h-20 rounded-xl font-bold transition-all flex flex-col items-center justify-center space-y-1
                  ${!hasFiles
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-500/30 transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]'
                  }`}
             >
                <span className="text-xl">📄</span>
                <span className="text-xs">生成试卷</span>
             </button>

             <button
               onClick={onOpenQA}
               disabled={!hasFiles}
               className={`col-span-1 h-20 rounded-xl font-bold transition-all flex flex-col items-center justify-center border-2 space-y-1
                  ${!hasFiles
                    ? 'border-slate-100 text-slate-300 cursor-not-allowed'
                    : 'border-blue-100 text-blue-600 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 hover:shadow-md hover:shadow-blue-500/10 active:scale-[0.98]'
                  }`}
             >
                <span className="text-xl">💬</span>
                <span className="text-xs">AI 问答</span>
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamSetup;
