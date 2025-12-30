import React, { useEffect, useState } from 'react';
import { ExamSession, QuestionType } from '../types';
import { getAllExamSessions } from '../services/storageService';
import { ChartBarIcon, CheckCircleIcon } from './Icons';

interface Props {
  onBack: () => void;
}

const DashboardStats: React.FC<Props> = ({ onBack }) => {
  const [history, setHistory] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const data = await getAllExamSessions();
    setHistory(data);
    setLoading(false);
  }

  // Calculate Radar Data
  const calculateRadarData = () => {
      // Dimensions: Memory, Logic, Concept, Application
      const scores = {
          memory: { total: 0, correct: 0 },
          logic: { total: 0, correct: 0 },
          concept: { total: 0, correct: 0 },
          application: { total: 0, correct: 0 }
      };

      history.forEach(session => {
          session.questions.forEach(q => {
              const isCorrect = session.answers[q.id]?.isCorrect;
              const type = q.type;
              
              if ([QuestionType.FILL_IN_BLANK, QuestionType.FLASHCARD, QuestionType.TRUE_FALSE].includes(type)) {
                  scores.memory.total++;
                  if(isCorrect) scores.memory.correct++;
              } else if ([QuestionType.ORDERING, QuestionType.MATCHING].includes(type)) {
                  scores.logic.total++;
                  if(isCorrect) scores.logic.correct++;
              } else if ([QuestionType.SINGLE_CHOICE, QuestionType.MULTI_CHOICE].includes(type)) {
                  scores.concept.total++;
                  if(isCorrect) scores.concept.correct++;
              } else if ([QuestionType.SHORT_ANSWER].includes(type)) {
                  scores.application.total++;
                  if(isCorrect) scores.application.correct++;
              }
          });
      });

      const getPercent = (c: number, t: number) => t === 0 ? 0 : Math.round((c / t) * 100);

      return [
          { label: '记忆力', value: getPercent(scores.memory.correct, scores.memory.total), max: 100 },
          { label: '逻辑力', value: getPercent(scores.logic.correct, scores.logic.total), max: 100 },
          { label: '概念理解', value: getPercent(scores.concept.correct, scores.concept.total), max: 100 },
          { label: '应用分析', value: getPercent(scores.application.correct, scores.application.total), max: 100 },
      ];
  };

  const radarData = calculateRadarData();

  // Simple SVG Radar Chart Component
  const RadarChart = ({ data }: { data: { label: string, value: number, max: number }[] }) => {
      const size = 300;
      const center = size / 2;
      const radius = 100;
      const angleStep = (Math.PI * 2) / data.length;

      const getCoordinates = (index: number, value: number, max: number) => {
          const angle = index * angleStep - Math.PI / 2;
          const r = (value / max) * radius;
          return {
              x: center + r * Math.cos(angle),
              y: center + r * Math.sin(angle)
          };
      };

      const points = data.map((d, i) => {
          const coords = getCoordinates(i, d.value, d.max);
          return `${coords.x},${coords.y}`;
      }).join(' ');

      const bgPoints = data.map((d, i) => {
         const coords = getCoordinates(i, 100, 100);
         return `${coords.x},${coords.y}`;
      }).join(' ');
      
      const midPoints = data.map((d, i) => {
         const coords = getCoordinates(i, 50, 100);
         return `${coords.x},${coords.y}`;
      }).join(' ');

      return (
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {/* Background Web */}
              <polygon points={bgPoints} fill="none" stroke="#e2e8f0" strokeWidth="1" />
              <polygon points={midPoints} fill="none" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 4"/>
              
              {/* Axes */}
              {data.map((d, i) => {
                  const end = getCoordinates(i, 100, 100);
                  return <line key={i} x1={center} y1={center} x2={end.x} y2={end.y} stroke="#e2e8f0" strokeWidth="1" />
              })}

              {/* Data Area */}
              <polygon points={points} fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" strokeWidth="2" />
              
              {/* Labels */}
              {data.map((d, i) => {
                  const pos = getCoordinates(i, 120, 100);
                  return (
                      <text 
                        key={i} 
                        x={pos.x} 
                        y={pos.y} 
                        textAnchor="middle" 
                        dominantBaseline="middle" 
                        className="text-xs font-bold fill-slate-500"
                      >
                          {d.label}
                      </text>
                  )
              })}
              
              {/* Values */}
              {data.map((d, i) => {
                  const pos = getCoordinates(i, d.value, d.max);
                   return (
                      <circle key={i} cx={pos.x} cy={pos.y} r="3" className="fill-blue-600" />
                   )
              })}
          </svg>
      )
  };

  return (
      <div className="max-w-4xl mx-auto h-full flex flex-col">
          <div className="flex items-center mb-6">
            <button onClick={onBack} className="mr-4 p-2 hover:bg-slate-100 rounded-full transition-colors">
               <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <h1 className="text-2xl font-bold text-slate-800">学习能力分析</h1>
          </div>

          {loading ? (
             <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
          ) : history.length === 0 ? (
             <div className="text-center py-12 bg-white rounded-2xl border border-slate-200"><p className="text-slate-500">完成至少一次考试以查看分析</p></div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Radar Chart Card */}
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center">
                     <h3 className="text-lg font-bold text-slate-800 mb-2">能力雷达图</h3>
                     <p className="text-sm text-slate-400 mb-6">基于历史答题数据的多维评估</p>
                     <RadarChart data={radarData} />
                 </div>

                 {/* Summary Stats */}
                 <div className="space-y-6">
                     <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                         <h3 className="text-lg font-bold text-slate-800 mb-4">数据概览</h3>
                         <div className="grid grid-cols-2 gap-4">
                             <div className="bg-blue-50 p-4 rounded-xl">
                                 <p className="text-xs text-blue-400 font-bold uppercase">总考试次数</p>
                                 <p className="text-2xl font-bold text-blue-700">{history.length}</p>
                             </div>
                             <div className="bg-green-50 p-4 rounded-xl">
                                 <p className="text-xs text-green-400 font-bold uppercase">平均正确率</p>
                                 <p className="text-2xl font-bold text-green-700">
                                     {Math.round(history.reduce((acc, curr) => acc + (curr.score / curr.totalPossibleScore), 0) / history.length * 100)}%
                                 </p>
                             </div>
                         </div>
                     </div>
                     
                     <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                         <h3 className="text-lg font-bold text-slate-800 mb-4">强弱项分析</h3>
                         <div className="space-y-3">
                             {radarData.map(d => (
                                 <div key={d.label}>
                                     <div className="flex justify-between text-sm mb-1">
                                         <span className="font-medium text-slate-600">{d.label}</span>
                                         <span className="font-bold text-slate-800">{d.value}%</span>
                                     </div>
                                     <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                         <div className="h-full bg-blue-500 rounded-full" style={{ width: `${d.value}%` }}></div>
                                     </div>
                                 </div>
                             ))}
                         </div>
                     </div>
                 </div>
             </div>
          )}
      </div>
  );
};

export default DashboardStats;