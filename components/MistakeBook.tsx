
import React, { useEffect, useState } from 'react';
import { MistakeRecord, QuestionType, Question } from '../types';
import { getAllMistakes, deleteMistake } from '../services/storageService';
import { TrashIcon, LightBulbIcon, SparklesIcon } from './Icons';
import AITutorPanel from './AITutorPanel';

interface Props {
  onBack: () => void;
}

const MistakeBook: React.FC<Props> = ({ onBack }) => {
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // AI Tutor State
  const [activeTutorQuestion, setActiveTutorQuestion] = useState<any | null>(null);

  useEffect(() => {
    loadMistakes();
  }, []);

  const loadMistakes = async () => {
    try {
      const data = await getAllMistakes();
      setMistakes(data);
    } catch (e) {
      console.error("Failed to load mistakes", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("确定要将此题移出错题本吗？")) {
      await deleteMistake(id);
      setMistakes(prev => prev.filter(m => m.id !== id));
    }
  };

  const handleOpenTutor = (e: React.MouseEvent, question: any) => {
      e.stopPropagation();
      setActiveTutorQuestion(question);
  }

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

  const formatAnswer = (ans: string | string[], question: Question) => {
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
          
          // Pad with empty strings if user answer is shorter than correct answer (e.g. trailing blanks left empty)
          while (ansArr.length < expectedLength) {
              ansArr.push('');
          }
          
          return ansArr.map(s => (s && s.trim() !== '') ? s : '(未填写)').join('; ');
      }

      if (ans === undefined || ans === null) return '未作答';
      
      if (Array.isArray(ans)) {
          if (ans.length === 0) return '未作答';
          return ans.map(s => (typeof s === 'string' && s.trim() !== '') ? s : '(未填写)').join('; ');
      }
      
      if (typeof ans === 'string') {
          if (ans.trim() === '') return '(未填写)';
          if (ans === 'True') return '正确';
          if (ans === 'False') return '错误';
          return ans;
      }
      
      return JSON.stringify(ans);
  }

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      
      {activeTutorQuestion && (
        <AITutorPanel 
            question={activeTutorQuestion}
            isOpen={!!activeTutorQuestion}
            onClose={() => setActiveTutorQuestion(null)}
        />
      )}

      <div className="flex items-center mb-6">
        <button onClick={onBack} className="mr-4 p-2 hover:bg-slate-100 rounded-full transition-colors">
           <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div>
            <h1 className="text-2xl font-bold text-slate-800">我的错题本</h1>
            <p className="text-sm text-slate-500">自动收集答错的题目，温故而知新</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        </div>
      ) : mistakes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
           <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
           </div>
           <h3 className="text-lg font-bold text-slate-800">太棒了！暂无错题</h3>
           <p className="text-slate-500 mt-2">快去生成试卷挑战一下吧</p>
        </div>
      ) : (
        <div className="space-y-4">
           {mistakes.map((record, index) => {
             const isExpanded = expandedId === record.id;
             const q = record.question;
             
             return (
               <div 
                  key={record.id} 
                  className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden
                     ${isExpanded ? 'shadow-md border-orange-200 ring-1 ring-orange-100' : 'border-slate-200 hover:border-orange-200 hover:shadow-sm'}
                  `}
               >
                  <div 
                    onClick={() => setExpandedId(isExpanded ? null : record.id)}
                    className="p-5 cursor-pointer flex justify-between items-start"
                  >
                     <div className="flex-1 pr-4">
                        <div className="flex items-center space-x-2 mb-2">
                            <span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded border border-orange-100">
                                {mapTypeToLabel(q.type)}
                            </span>
                            <span className="text-xs text-slate-400">
                                {new Date(record.timestamp).toLocaleDateString()}
                            </span>
                        </div>
                        <h3 className="text-base font-semibold text-slate-800 line-clamp-2 leading-relaxed">
                             {q.questionText}
                        </h3>
                     </div>
                     <div className="flex space-x-2">
                         <button
                           onClick={(e) => handleOpenTutor(e, q)}
                           className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                           title="AI 答疑"
                         >
                            <SparklesIcon />
                         </button>
                         <button 
                           onClick={(e) => handleDelete(e, record.id)}
                           className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                           title="移出错题本"
                         >
                            <TrashIcon />
                         </button>
                     </div>
                  </div>
                  
                  {isExpanded && (
                      <div className="px-5 pb-5 pt-0 bg-slate-50/50 border-t border-slate-100">
                          {/* Options if MC/SC */}
                          {(q.type === QuestionType.SINGLE_CHOICE || q.type === QuestionType.MULTI_CHOICE) && q.options && (
                              <div className="mt-4 space-y-2">
                                  {q.options.map((opt, i) => (
                                      <div key={i} className="text-sm text-slate-600 px-3 py-2 bg-white rounded border border-slate-100">
                                          {['A','B','C','D','E'][i]}. {opt}
                                      </div>
                                  ))}
                              </div>
                          )}

                          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                                  <span className="text-xs font-bold text-red-500 uppercase block mb-1">您的错误答案</span>
                                  <p className="text-sm font-medium text-red-700">{formatAnswer(record.userWrongAnswer, q)}</p>
                              </div>
                              <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                                  <span className="text-xs font-bold text-green-500 uppercase block mb-1">正确答案</span>
                                  <p className="text-sm font-medium text-green-700">{formatAnswer(q.correctAnswer, q)}</p>
                              </div>
                          </div>

                          {q.explanation && (
                              <div className="mt-4 flex items-start space-x-2 text-sm text-slate-600 bg-blue-50/50 p-3 rounded-lg border border-blue-50">
                                 <div className="shrink-0 text-blue-500 mt-0.5"><LightBulbIcon /></div>
                                 <div><span className="font-bold text-blue-600">解析：</span>{q.explanation}</div>
                              </div>
                          )}
                      </div>
                  )}
               </div>
             )
           })}
        </div>
      )}
    </div>
  );
};

export default MistakeBook;
