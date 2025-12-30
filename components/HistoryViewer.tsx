
import React, { useEffect, useRef, useState } from 'react';
import { Material, ExamSession } from '../types';
import { getAllExamSessions, deleteExamSession, saveExamSession } from '../services/storageService';
import { TrashIcon, CheckCircleIcon, ExportIcon, ImportIcon } from './Icons';

interface Props {
  onSelectSession: (session: ExamSession) => void;
  onBack: () => void;
  materials?: Material[];
}

const HistoryViewer: React.FC<Props> = ({ onSelectSession, onBack, materials }) => {
  const [history, setHistory] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await getAllExamSessions();
      setHistory(data);
    } catch (e) {
      console.error("Failed to load history", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (window.confirm("确定要删除这条考试记录吗？")) {
      try {
        await deleteExamSession(id);
        setHistory(prev => prev.filter(h => h.id !== id));
      } catch (err) {
        console.error("Delete failed", err);
        alert("删除失败，请稍后重试");
      }
    }
  };

  const handleExport = (e: React.MouseEvent, session: ExamSession) => {
      e.preventDefault();
      e.stopPropagation();
      const dataStr = JSON.stringify(session);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `acemock_exam_${new Date(session.startTime).toISOString().slice(0,10)}.json`;
  
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
  };

  const handleImportClick = () => {
      fileInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const json = event.target?.result as string;
              const session = JSON.parse(json) as ExamSession;
              
              // Validate structure roughly
              if (!session.id || !session.questions || !session.config) {
                  throw new Error("Invalid format");
              }

              // Regenerate ID to avoid conflicts
              session.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
              session.endTime = Date.now(); // Mark as imported now

              await saveExamSession(session);
              loadHistory(); // Reload
              alert("试卷导入成功！");
          } catch (err) {
              alert("导入失败：文件格式不正确");
          }
      };
      reader.readAsText(file);
      // Reset input
      e.target.value = '';
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
       month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getMaterialNames = (session: ExamSession) => {
      // 1. Try to get saved names from the session
      if (session.materialNames && session.materialNames.length > 0) {
          return session.materialNames.join(', ');
      }
      
      // 2. Fallback: Try to map IDs to current materials
      if (materials && session.config.materialIds) {
          const names = session.config.materialIds
              .map(id => materials.find(m => m.id === id)?.name)
              .filter((n): n is string => !!n);
          if (names.length > 0) return names.join(', ');
      }
      
      return '未知/已删除文档';
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
            <button onClick={onBack} className="mr-4 p-2 hover:bg-slate-100 rounded-full transition-colors">
               <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <h1 className="text-2xl font-bold text-slate-800">历史考试记录</h1>
        </div>
        <div>
            <input 
               type="file" 
               accept=".json" 
               ref={fileInputRef} 
               className="hidden" 
               onChange={handleImportFile}
            />
            <button 
                onClick={handleImportClick}
                className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm text-sm font-bold text-slate-700"
            >
                <ImportIcon />
                <span>导入试卷</span>
            </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
           <p className="text-slate-500">暂无考试记录</p>
        </div>
      ) : (
        <div className="grid gap-4">
           {history.map(session => (
             <div 
                key={session.id} 
                onClick={() => onSelectSession(session)}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex justify-between items-center group relative overflow-hidden"
             >
                <div className="flex items-start space-x-4 flex-1 min-w-0 relative z-0">
                   <div className={`p-3 rounded-lg flex-shrink-0 ${session.score / session.totalPossibleScore >= 0.6 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      <CheckCircleIcon />
                   </div>
                   <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-800">
                        {formatDate(session.endTime || session.startTime)}
                      </h3>
                      
                      <div className="flex items-center text-xs text-slate-500 mt-1 mb-1" title={getMaterialNames(session)}>
                          <svg className="w-3.5 h-3.5 mr-1.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          <span className="truncate">{getMaterialNames(session)}</span>
                      </div>

                      <div className="flex items-center text-sm text-slate-500 space-x-2">
                        <span>得分: <span className="font-bold">{session.score.toFixed(1)}</span> / {session.totalPossibleScore}</span>
                        <span>•</span>
                        <span>难度: {session.config.difficulty}</span>
                        <span>•</span>
                        <span>题数: {session.questions.length}</span>
                        {session.generationTimeMs !== undefined && (
                            <>
                                <span>•</span>
                                <span className="bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded text-[10px] font-bold border border-indigo-100">
                                    生成: {(session.generationTimeMs / 1000).toFixed(1)}s
                                </span>
                            </>
                        )}
                      </div>
                   </div>
                </div>
                
                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity relative z-10">
                    <button 
                      type="button"
                      onClick={(e) => handleExport(e, session)}
                      className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                      title="导出试卷 (JSON)"
                    >
                       <ExportIcon />
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => handleDelete(e, session.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="删除"
                    >
                       <TrashIcon />
                    </button>
                </div>
             </div>
           ))}
        </div>
      )}
    </div>
  );
};

export default HistoryViewer;
