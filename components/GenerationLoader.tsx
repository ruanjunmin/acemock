import React, { useEffect, useRef, useState } from 'react';
import { ClockIcon } from './Icons';

interface Props {
  logs: string[];
  progress: number;
}

const GenerationLoader: React.FC<Props> = ({ logs, progress }) => {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);

  // 动态计时器逻辑：实时追踪生成耗时
  useEffect(() => {
    const startTime = performance.now();
    const timer = setInterval(() => {
      setElapsed((performance.now() - startTime) / 1000);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll to bottom of logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full mx-4 border border-white/50 animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="text-center mb-4">
           <div className="relative w-16 h-16 mx-auto mb-4">
               <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-75"></div>
               <div className="relative bg-white p-3 rounded-full shadow-sm border border-indigo-50 flex items-center justify-center h-full w-full text-indigo-600">
                   <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                   </svg>
               </div>
           </div>
           <h3 className="text-xl font-bold text-slate-800">AI 智能分析中</h3>
           <p className="text-slate-500 text-sm mt-2">正在深度解析文档并生成内容，请稍候...</p>
        </div>

        {/* 生成试卷耗时显示模块 - 新增 */}
        <div className="flex justify-center mb-8">
            <div className="inline-flex items-center px-3.5 py-1.5 bg-indigo-50/50 border border-indigo-100 rounded-full text-indigo-600 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="animate-pulse">
                    <ClockIcon />
                </div>
                <span className="ml-2 text-xs font-mono font-bold tracking-tight">
                    <span className="opacity-60 mr-1.5 uppercase">生成已耗时</span>
                    <span>{elapsed.toFixed(1)}s</span>
                </span>
            </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6 relative">
          <div className="flex justify-between text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">
             <span>处理进度</span>
             <span className="text-indigo-600">{Math.round(progress)}%</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
             <div 
               className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full transition-all duration-300 ease-out relative"
               style={{ width: `${progress}%` }}
             >
                <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
             </div>
          </div>
        </div>

        {/* Log Window - Modern Light Style */}
        <div className="bg-slate-50 rounded-xl p-4 h-48 overflow-hidden flex flex-col border border-slate-200 shadow-inner">
           <div className="flex items-center space-x-2 border-b border-slate-200 pb-2 mb-2">
              <div className="flex space-x-1">
                  <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                  <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                  <div className="w-2 h-2 rounded-full bg-slate-300"></div>
              </div>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider ml-auto">Process Log</span>
           </div>
           <div className="flex-grow overflow-y-auto font-mono text-xs space-y-2 custom-scrollbar">
             {logs.map((log, i) => (
                <div key={i} className="flex items-start animate-in slide-in-from-left-2 duration-300">
                   <span className="text-slate-400 mr-3 shrink-0 select-none text-[10px] mt-0.5">
                     {new Date().toLocaleTimeString('en-US', {hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                   </span>
                   <span className="text-slate-600 break-words leading-relaxed font-medium">
                     <span className="text-indigo-500 mr-1.5">●</span>
                     {log}
                   </span>
                </div>
             ))}
             <div ref={logsEndRef} />
           </div>
        </div>
      </div>
    </div>
  );
};

export default GenerationLoader;
