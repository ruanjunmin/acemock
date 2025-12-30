import React, { useEffect, useState } from 'react';
import { QASession } from '../types';
import { getAllQASessions, deleteQASession } from '../services/storageService';
import { TrashIcon, SearchChatIcon, ClockIcon } from './Icons';

interface Props {
  onSelectSession: (session: QASession) => void;
  onBack: () => void;
}

const QAHistoryViewer: React.FC<Props> = ({ onSelectSession, onBack }) => {
  const [sessions, setSessions] = useState<QASession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const data = await getAllQASessions();
      setSessions(data);
    } catch (e) {
      console.error("Failed to load QA history", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("确定要删除这条对话记录吗？")) {
      await deleteQASession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
       month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      <div className="flex items-center mb-6">
        <button onClick={onBack} className="mr-4 p-2 hover:bg-slate-100 rounded-full transition-colors">
           <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <h1 className="text-2xl font-bold text-slate-800">问答历史记录</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
           <div className="w-16 h-16 bg-indigo-50 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
               <SearchChatIcon />
           </div>
           <p className="text-slate-500">暂无问答记录</p>
        </div>
      ) : (
        <div className="grid gap-4">
           {sessions.map(session => (
             <div 
                key={session.id} 
                onClick={() => onSelectSession(session)}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex justify-between items-center group"
             >
                <div className="flex items-start space-x-4 flex-1 min-w-0">
                   <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg flex-shrink-0">
                      <SearchChatIcon />
                   </div>
                   <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-800 truncate text-lg mb-1">
                        {session.preview || "新对话"}
                      </h3>
                      
                      <div className="flex items-center space-x-4 text-xs text-slate-500">
                          <div className="flex items-center">
                              <ClockIcon />
                              <span className="ml-1">{formatDate(session.lastUpdated)}</span>
                          </div>
                          <div className="flex items-center">
                              <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 truncate max-w-[200px]">
                                  {session.materialNames.length > 0 ? `基于 ${session.materialNames.length} 份文档` : '无文档上下文'}
                              </span>
                          </div>
                          <div>
                              {session.messages.length} 条消息
                          </div>
                      </div>
                   </div>
                </div>
                
                <button 
                  onClick={(e) => handleDelete(e, session.id)}
                  className="p-2 ml-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                   <TrashIcon />
                </button>
             </div>
           ))}
        </div>
      )}
    </div>
  );
};

export default QAHistoryViewer;