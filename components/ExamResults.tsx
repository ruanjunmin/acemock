
import React, { useState, useEffect } from 'react';
import { ExamSession, QuestionType, Question } from '../types';
import { CheckCircleIcon, XCircleIcon, SparklesIcon, LightBulbIcon, ClockIcon, ChevronDownIcon, ChevronUpIcon } from './Icons';
import AITutorPanel from './AITutorPanel';
import { MarkdownText } from './MarkdownText';

interface Props {
  session: ExamSession;
  onRestart: () => void;
}

const ExamResults: React.FC<Props> = ({ session, onRestart }) => {
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'WRONG' | 'CORRECT'>('ALL');
  
  // State to track collapsed answers. By default, none are collapsed (all expanded).
  const [collapsedAnswers, setCollapsedAnswers] = useState<Set<string>>(new Set());

  const percentage = Math.round((session.score / session.totalPossibleScore) * 100);
  const wrongCount = session.questions.filter(q => !session.answers[q.id]?.isCorrect).length;
  
  let gradeColor = 'text-red-500';
  let gradeMessage = '继续努力！';
  if (percentage >= 90) { gradeColor = 'text-green-600'; gradeMessage = '太棒了！'; }
  else if (percentage >= 70) { gradeColor = 'text-blue-600'; gradeMessage = '做得不错！'; }
  else if (percentage >= 50) { gradeColor = 'text-yellow-600'; gradeMessage = '及格'; }

  const mapTypeToLabel = (type: QuestionType) => {
    switch(type) {
        case QuestionType.SINGLE_CHOICE: return '单选';
        case QuestionType.MULTI_CHOICE: return '多选';
        case QuestionType.TRUE_FALSE: return '判断';
        case QuestionType.ORDERING: return '排序';
        case QuestionType.MATCHING: return '连线';
        case QuestionType.FILL_IN_BLANK: return '填空';
        case QuestionType.SHORT_ANSWER: return '简答';
        case QuestionType.NOUN_EXPLANATION: return '名词解释';
        case QuestionType.ANALYSIS: return '鉴析';
        case QuestionType.FLASHCARD: return '抽认卡';
        default: return type;
    }
  }

  const formatAnswer = (ans: string | string[] | undefined, question: Question) => {
      // Special handling for Fill-in-Blank padding
      if (question.type === QuestionType.FILL_IN_BLANK) {
          const correctArr = Array.isArray(question.correctAnswer) ? question.correctAnswer : [question.correctAnswer];
          const expectedLength = correctArr.length;
          
          let ansArr: string[] = [];
          if (Array.isArray(ans)) {
              ansArr = [...ans];
          } else if (ans !== undefined && ans !== null) {
              ansArr = [ans as string];
          }
          
          // Pad with empty strings if user answer is shorter than correct answer
          while (ansArr.length < expectedLength) {
              ansArr.push('');
          }
          
          return ansArr.map(s => (s && s.trim() !== '') ? s : '(未填写)').join('; ');
      }

      if (ans === undefined || ans === null) return '未作答';
      
      if (Array.isArray(ans)) {
          if (ans.length === 0) return '未作答';
          return ans.map(s => (s && s.trim() !== '') ? s : '(未填写)').join('; ');
      }

      if (typeof ans === 'string') {
          if (ans.trim() === '') return '(未填写)';
          if (ans === 'True') return '正确';
          if (ans === 'False') return '错误';
          return ans;
      }
      return String(ans);
  }

  const toggleAnswerVisibility = (id: string) => {
      setCollapsedAnswers(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
      });
  };

  const toggleAllAnswers = () => {
      const allIds = session.questions.map(q => q.id);
      if (collapsedAnswers.size === allIds.length) {
          // All collapsed, so expand all
          setCollapsedAnswers(new Set());
      } else {
          // Collapse all
          setCollapsedAnswers(new Set(allIds));
      }
  };

  const areAllCollapsed = session.questions.length > 0 && collapsedAnswers.size === session.questions.length;

  const activeQuestion = session.questions.find(q => q.id === selectedQuestionId);

  const displayedQuestions = session.questions.filter(q => {
      const isCorrect = session.answers[q.id]?.isCorrect;
      if (filterMode === 'WRONG') return !isCorrect;
      if (filterMode === 'CORRECT') return isCorrect;
      return true;
  });

  return (
    <div className="max-w-4xl mx-auto h-full overflow-y-auto pb-10">
      
      {/* AI Tutor Panel */}
      {activeQuestion && (
        <AITutorPanel 
            question={activeQuestion}
            isOpen={!!selectedQuestionId}
            onClose={() => setSelectedQuestionId(null)}
        />
      )}

      {/* Header with Top Return Button */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 mt-4">
        <div className="text-left w-full md:w-auto">
          <h1 className="text-3xl font-bold text-slate-800 mb-1">考试结果</h1>
          <p className="text-slate-500">您的考试表现如下</p>
        </div>
        <button 
          onClick={onRestart}
          className="w-full md:w-auto px-6 py-2.5 bg-slate-800 text-white font-bold rounded-xl shadow-lg hover:bg-slate-900 transition-all flex items-center justify-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          返回首页 / 开始新考试
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 mb-8 text-center">
        <div className="text-6xl font-bold mb-2 flex justify-center items-center">
           <span className={gradeColor}>{percentage}%</span>
        </div>
        <p className={`text-xl font-medium ${gradeColor} mb-6`}>{gradeMessage}</p>
        
        {/* Stats Grid - Added Wrong Count and Generation Time */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-left">
           <div className="bg-slate-50 p-4 rounded-2xl">
              <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">得分</span>
              <p className="text-xl font-bold text-slate-800">{session.score.toFixed(1)} <span className="text-sm text-slate-400 font-normal">/ {session.totalPossibleScore}</span></p>
           </div>
           
           <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
              <span className="text-xs text-red-400 uppercase font-bold tracking-wider">错题数</span>
              <p className="text-xl font-bold text-red-600">{wrongCount}</p>
           </div>

           <div className="bg-slate-50 p-4 rounded-2xl">
              <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">题数</span>
              <p className="text-xl font-bold text-slate-800">{session.questions.length}</p>
           </div>
           <div className="bg-slate-50 p-4 rounded-2xl">
              <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">难度</span>
              <p className="text-xl font-bold text-slate-800 truncate">{session.config.difficulty}</p>
           </div>
           <div className="bg-slate-50 p-4 rounded-2xl">
              <span className="text-xs text-slate-400 uppercase font-bold tracking-wider">限时</span>
              <p className="text-xl font-bold text-slate-800">{session.config.timeLimit ? `${session.config.timeLimit}分` : '不限'}</p>
           </div>
           <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
              <span className="text-xs text-indigo-400 uppercase font-bold tracking-wider flex items-center">
                  <ClockIcon /> <span className="ml-1">生成耗时</span>
              </span>
              <p className="text-xl font-bold text-indigo-700">
                  {session.generationTimeMs !== undefined ? `${(session.generationTimeMs / 1000).toFixed(1)}s` : '--'}
              </p>
           </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-slate-800">详细回顾</h3>
        
        <div className="flex space-x-2">
            <button 
              onClick={toggleAllAnswers}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            >
              {areAllCollapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
              <span className="text-sm font-bold">{areAllCollapsed ? '全部展开答案' : '全部收起答案'}</span>
            </button>

            <button 
              onClick={() => setFilterMode(filterMode === 'WRONG' ? 'ALL' : 'WRONG')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all shadow-sm active:scale-95 ${
                filterMode === 'WRONG'
                  ? 'bg-red-50 border-red-200 text-red-700 ring-1 ring-red-200' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {filterMode === 'WRONG' ? (
                 <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                 </svg>
              ) : (
                 <svg className="w-5 h-5 text-slate-300" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0 2a10 10 0 100-20 10 10 0 000 20z" clipRule="evenodd" />
                 </svg>
              )}
              <span className="text-sm font-bold">只显示错题</span>
            </button>

            <button 
              onClick={() => setFilterMode(filterMode === 'CORRECT' ? 'ALL' : 'CORRECT')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all shadow-sm active:scale-95 ${
                filterMode === 'CORRECT'
                  ? 'bg-green-50 border-green-200 text-green-700 ring-1 ring-green-200' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {filterMode === 'CORRECT' ? (
                 <CheckCircleIcon className="w-5 h-5 text-green-600" />
              ) : (
                 <CheckCircleIcon className="w-5 h-5 text-slate-300" />
              )}
              <span className="text-sm font-bold">只显示正确</span>
            </button>
        </div>
      </div>

      {filterMode === 'WRONG' && displayedQuestions.length === 0 && (
         <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 mb-8">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
               <CheckCircleIcon />
            </div>
            <p className="text-slate-800 font-bold text-lg">太棒了！</p>
            <p className="text-slate-500 mt-1">没有发现错题，或者您所有的题目都答对了。</p>
         </div>
      )}

      {filterMode === 'CORRECT' && displayedQuestions.length === 0 && (
         <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 mb-8">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
               <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p className="text-slate-800 font-bold text-lg">有点遗憾</p>
            <p className="text-slate-500 mt-1">没有回答正确的题目，请继续加油。</p>
         </div>
      )}
      
      <div className="space-y-6">
        {displayedQuestions.map((q) => {
          // Use original index for question number
          const originalIdx = session.questions.findIndex(sq => sq.id === q.id);
          const userAns = session.answers[q.id];
          const isCorrect = userAns?.isCorrect;
          const isCollapsed = collapsedAnswers.has(q.id);
          
          return (
            <div key={q.id} className={`bg-white p-6 rounded-2xl border-l-4 shadow-sm ${isCorrect ? 'border-green-500' : 'border-red-500'}`}>
               <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                     <span className="text-xs font-bold text-slate-400 mr-2">Q{originalIdx + 1} • {mapTypeToLabel(q.type)}</span>
                     <h4 className="text-lg font-medium text-slate-800 mt-1">{q.questionText}</h4>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    {isCorrect ? <div className="text-green-500"><CheckCircleIcon/></div> : <div className="text-red-500"><XCircleIcon/></div>}
                  </div>
               </div>

               {/* Answers Display */}
               <div className="mt-4 mb-6">
                  {isCorrect ? (
                     // Correct Answer State
                     <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                        <span className="text-xs font-bold text-green-600 uppercase block mb-1 flex items-center">
                           <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                           您的答案 (正确)
                        </span>
                        <p className="font-medium text-green-800 text-sm leading-relaxed">
                           {formatAnswer(userAns?.answer, q)}
                        </p>
                     </div>
                  ) : (
                     // Incorrect Answer State
                     <div className="space-y-3">
                        <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                           <span className="text-xs font-bold text-red-500 uppercase block mb-1 flex items-center">
                               <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                               您的答案 (错误)
                           </span>
                           <p className="font-medium text-red-800 text-sm leading-relaxed">
                              {formatAnswer(userAns?.answer, q)}
                           </p>
                        </div>
                        
                        <div className="bg-green-50 p-4 rounded-xl border border-green-200 transition-all duration-300">
                           <div 
                             className="flex justify-between items-center cursor-pointer select-none"
                             onClick={() => toggleAnswerVisibility(q.id)}
                           >
                               <span className="text-xs font-bold text-green-600 uppercase flex items-center">
                                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  参考答案
                               </span>
                               <span className="text-green-600">
                                   {isCollapsed ? <ChevronDownIcon /> : <ChevronUpIcon />}
                               </span>
                           </div>

                           {!isCollapsed && (
                               <div className="font-medium text-green-800 text-sm leading-relaxed mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                  {/* Always display reference answer, using MarkdownText if possible */}
                                  {typeof q.correctAnswer === 'string' && q.correctAnswer.length > 50 ? (
                                      <MarkdownText text={q.correctAnswer} />
                                  ) : (
                                      <p>{formatAnswer(q.correctAnswer, q)}</p>
                                  )}
                               </div>
                           )}
                        </div>

                        {/* Short Answer Feedback */}
                        {(q.type === QuestionType.SHORT_ANSWER || q.type === QuestionType.NOUN_EXPLANATION || q.type === QuestionType.ANALYSIS) && userAns?.feedback && (
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                               <span className="text-xs font-bold text-blue-600 uppercase block mb-1">AI 评分反馈</span>
                               <p className="text-slate-700 italic text-sm mb-3">{userAns.feedback}</p>
                               <div className="flex items-center bg-white/50 p-2 rounded-lg border border-blue-100/50">
                                  <div className="h-2 w-32 bg-slate-200 rounded-full overflow-hidden mr-3">
                                     <div className="h-full bg-blue-500" style={{width: `${(userAns.score || 0) * 100}%`}}></div>
                                  </div>
                                  <span className="text-xs font-bold text-blue-700">{(userAns.score || 0) * 100} / 100 分</span>
                               </div>
                            </div>
                        )}
                     </div>
                  )}
               </div>

               <div className="flex items-start justify-between">
                    {q.explanation && (
                        <div className="flex-grow text-sm text-slate-600 bg-slate-50 p-4 rounded-xl mr-4 border border-slate-100">
                            <span className="font-bold text-slate-700 block mb-1 flex items-center">
                               <LightBulbIcon />
                               <span className="ml-1">解析</span>
                            </span> 
                            {q.explanation}
                        </div>
                    )}
                    
                    {/* Ask AI Button */}
                    <button 
                        onClick={() => setSelectedQuestionId(q.id)}
                        className="shrink-0 p-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-colors flex flex-col items-center justify-center text-xs font-bold w-20 h-20 border border-indigo-100 shadow-sm active:scale-95"
                    >
                        <SparklesIcon />
                        <span className="mt-1">AI 答疑</span>
                    </button>
               </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 flex justify-center pb-10">
        <button 
          onClick={onRestart}
          className="px-8 py-3 bg-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-300 transition-all border border-slate-300"
        >
          返回首页
        </button>
      </div>
    </div>
  );
};

export default ExamResults;
