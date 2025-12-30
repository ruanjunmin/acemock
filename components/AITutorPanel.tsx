import React, { useState, useEffect, useRef } from 'react';
import { Question, ChatMessage, SearchEngine } from '../types';
import { chatWithTutor } from '../services/geminiService';
import { SendIcon, SparklesIcon, XMarkIcon, BotIcon, UserCircleIcon, GlobeIcon, ChevronDownIcon, CheckCircleIcon } from './Icons';
import { MarkdownText } from './MarkdownText';
import TTSControl from './TTSControl';

interface Props {
  question: Question;
  isOpen: boolean;
  onClose: () => void;
}

const AITutorPanel: React.FC<Props> = ({ question, isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Search Engine State
  const [selectedEngine, setSelectedEngine] = useState<SearchEngine>('google_native');
  const [showEngineSelect, setShowEngineSelect] = useState(false);

  // Initialize chat when opened with a new question
  useEffect(() => {
    if (isOpen) {
      if (messages.length === 0) {
        setMessages([{
          id: 'init',
          role: 'model',
          text: '你好！我是你的 AI 助教。关于这道题，你有什么疑问吗？我可以为你解释正确答案，或者讲解相关的知识点。',
          timestamp: Date.now()
        }]);
      }
    }
  }, [isOpen, question]);

  // Reset chat if question changes
  useEffect(() => {
     setMessages([]); 
  }, [question.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const responseText = await chatWithTutor(question, messages, input, selectedEngine);
      
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity" 
          onClick={onClose}
        />
      )}

      {/* Slide-over Panel */}
      <div 
        className={`fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white relative">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-white/20 rounded-lg">
                <SparklesIcon />
            </div>
            <div>
                <h3 className="font-bold text-lg">AI 智能答疑</h3>
                <p className="text-xs text-blue-100 opacity-90">基于题目上下文的一对一辅导</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
              {/* Engine Selector */}
              <div className="relative">
                  <button 
                      onClick={() => setShowEngineSelect(!showEngineSelect)}
                      className="flex items-center space-x-1 px-2 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-bold text-white transition-colors"
                      title="选择搜索渠道"
                  >
                      <GlobeIcon />
                      <ChevronDownIcon className="w-3 h-3"/>
                  </button>
                  
                  {showEngineSelect && (
                      <div className="absolute right-0 top-full mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 text-slate-700 animate-in fade-in zoom-in-95">
                          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                              AI 联网搜索源
                          </div>
                          <button 
                              onClick={() => { setSelectedEngine('google_native'); setShowEngineSelect(false); }}
                              className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-between
                                  ${selectedEngine === 'google_native' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}
                              `}
                          >
                              <span>Google (原生)</span>
                              {selectedEngine === 'google_native' && <CheckCircleIcon className="w-3 h-3"/>}
                          </button>
                          <button 
                              onClick={() => { setSelectedEngine('tavily'); setShowEngineSelect(false); }}
                              className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-between
                                  ${selectedEngine === 'tavily' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}
                              `}
                          >
                              <span>Tavily AI</span>
                              {selectedEngine === 'tavily' && <CheckCircleIcon className="w-3 h-3"/>}
                          </button>
                          <button 
                              onClick={() => { setSelectedEngine('baidu_search1'); setShowEngineSelect(false); }}
                              className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-between
                                  ${selectedEngine === 'baidu_search1' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}
                              `}
                          >
                              <span>百度 (Baidu)</span>
                              {selectedEngine === 'baidu_search1' && <CheckCircleIcon className="w-3 h-3"/>}
                          </button>
                          <button 
                              onClick={() => { setSelectedEngine('google_serper'); setShowEngineSelect(false); }}
                              className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-between
                                  ${selectedEngine === 'google_serper' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}
                              `}
                          >
                              <span>Google (Serper)</span>
                              {selectedEngine === 'google_serper' && <CheckCircleIcon className="w-3 h-3"/>}
                          </button>
                      </div>
                  )}
              </div>

              <button 
                onClick={onClose} 
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <XMarkIcon />
              </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-grow overflow-y-auto p-5 space-y-6 bg-slate-50 custom-scrollbar">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden shadow-sm
                  ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-600 text-white'}
              `}>
                  {msg.role === 'user' ? <UserCircleIcon /> : <BotIcon />}
              </div>

              {/* Message Bubble */}
              <div className="max-w-[85%]">
                  <div 
                    className={`rounded-2xl p-4 text-sm leading-relaxed shadow-sm overflow-hidden
                      ${msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                      }
                    `}
                  >
                    {msg.role === 'user' ? (
                        <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                    ) : (
                        <MarkdownText text={msg.text} />
                    )}
                  </div>
                  
                  <div className={`flex items-center gap-2 mt-1 px-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`text-[10px] text-slate-400`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                      
                      {/* TTS Control in Chat */}
                      <TTSControl text={msg.text} showCopy={true} className="scale-90 opacity-80 hover:opacity-100" />
                  </div>
              </div>
            </div>
          ))}
          
          {loading && (
             <div className="flex justify-start ml-11">
               <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm flex space-x-1.5 items-center">
                 <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                 <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75"></div>
                 <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-100">
           {/* Quick Suggestions */}
           {messages.length < 2 && (
             <div className="flex space-x-2 overflow-x-auto pb-3 no-scrollbar mb-1">
                {['为什么选这个答案？', '这道题考的是什么知识点？', '举个类似的例子'].map(q => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); }}
                    className="whitespace-nowrap px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-xs text-slate-600 rounded-full transition-colors border border-slate-200"
                  >
                    {q}
                  </button>
                ))}
             </div>
           )}

           <div className="flex items-center space-x-2">
             <input
               type="text"
               value={input}
               onChange={(e) => setInput(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleSend()}
               placeholder="输入您的问题..."
               className="flex-grow p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
             />
             <button
               onClick={handleSend}
               disabled={!input.trim() || loading}
               className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
             >
               <SendIcon />
             </button>
           </div>
        </div>
      </div>
    </>
  );
};

export default AITutorPanel;