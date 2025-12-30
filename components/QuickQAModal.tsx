import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, Material, QASession, SearchEngine } from '../types';
import { askDocument, askWeb, translateText, askSmart } from '../services/geminiService';
import { saveQASession } from '../services/storageService';
import { SendIcon, SearchChatIcon, XMarkIcon, GlobeIcon, UserCircleIcon, BotIcon, ClipboardIcon, LanguageIcon, CheckCircleIcon, DocIcon, RefreshIcon, SparklesIcon, ChevronDownIcon, ChevronUpIcon } from './Icons';
import { MarkdownText } from './MarkdownText';
import TTSControl from './TTSControl';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  materials?: Material[]; // Optional, if viewing history with no materials active
  initialSession?: QASession | null; // For loading history
}

const ThinkingIndicator = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState("正在分析问题...");

  useEffect(() => {
    const startTime = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const diff = (now - startTime) / 1000;
      setElapsed(diff);

      // Simulation logic to make it feel alive
      if (diff > 0.5 && diff < 1.5) {
         setCurrentStep("正在检索相关文档...");
         // Using function update for state to avoid dependency loop, checking last element to prevent dupes
         setLogs(prev => prev[prev.length - 1] === "已接收用户提问" ? prev : [...prev, "已接收用户提问"]);
      } else if (diff > 1.5 && diff < 3.0) {
         setCurrentStep("正在阅读上下文内容...");
         setLogs(prev => prev[prev.length - 1] === "检索到相关文档片段" ? prev : [...prev, "检索到相关文档片段"]);
      } else if (diff > 3.0 && diff < 4.5) {
         setCurrentStep("正在生成回答大纲...");
         setLogs(prev => prev[prev.length - 1] === "完成语义分析" ? prev : [...prev, "完成语义分析"]);
      } else if (diff > 4.5 && diff < 6.0) {
         setCurrentStep("正在组织最终语言...");
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex justify-start ml-11 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className={`
            bg-white border border-slate-200 shadow-sm transition-all duration-300 overflow-hidden
            ${isOpen ? 'rounded-2xl w-64' : 'rounded-full px-4 py-2 hover:bg-slate-50 cursor-pointer'}
        `}>
            {/* Header / Toggle */}
            <div 
                className="flex items-center space-x-2 cursor-pointer select-none"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex space-x-1 shrink-0">
                   <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
                   <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce delay-75"></div>
                   <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce delay-150"></div>
                </div>
                <span className="text-xs font-bold text-slate-500">AI 正在思考...</span>
                <span className="text-[10px] text-slate-300 font-mono min-w-[24px]">{elapsed.toFixed(1)}s</span>
                <div className={`text-slate-400 transition-transform duration-200 ml-1 ${isOpen ? 'rotate-180' : ''}`}>
                    <ChevronDownIcon className="w-3 h-3"/>
                </div>
            </div>

            {/* Content (Expanded) */}
            {isOpen && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 pb-2 px-1">
                    {logs.map((log, i) => (
                        <div key={i} className="flex items-center text-[10px] text-slate-400 animate-in slide-in-from-left-2">
                             <CheckCircleIcon className="w-3 h-3 mr-1.5 text-green-500 shrink-0" />
                             <span>{log}</span>
                        </div>
                    ))}
                    <div className="flex items-center text-[10px] text-indigo-600 font-medium animate-pulse">
                         <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full mr-2 ml-1 shrink-0"></div>
                         <span>{currentStep}</span>
                    </div>
                </div>
            )}
        </div>
    </div>
  )
};

const QuickQAModal: React.FC<Props> = ({ isOpen, onClose, materials = [], initialSession }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWebSearch, setShowWebSearch] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Session State
  const [sessionId, setSessionId] = useState<string>(Date.now().toString());
  const [hasStarted, setHasStarted] = useState(false);

  // Search Engine State
  const [selectedEngine, setSelectedEngine] = useState<SearchEngine>('google_native');
  const [showEngineSelect, setShowEngineSelect] = useState(false);

  // New features state
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<Record<string, boolean>>({});
  const [copyStatus, setCopyStatus] = useState<Record<string, boolean>>({});

  // Regenerate features state
  const [regenInputVisible, setRegenInputVisible] = useState<Record<string, boolean>>({});
  const [regenInstruction, setRegenInstruction] = useState<Record<string, string>>({});
  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({});

  // Load initial session or start new
  useEffect(() => {
    if (isOpen) {
      if (initialSession) {
        setSessionId(initialSession.id);
        setMessages(initialSession.messages);
        setHasStarted(true); // Treat loaded history as started
      } else if (messages.length === 0) {
        const newId = Date.now().toString();
        setSessionId(newId);
        setMessages([{
          id: 'init',
          role: 'model',
          text: `你好！我是你的文档助手。你可以直接向我提问，我会根据你上传的 ${materials.length} 份文档内容进行回答。`,
          timestamp: Date.now()
        }]);
        setHasStarted(false);
      }
    }
  }, [isOpen, initialSession, materials.length]);

  // Save session on updates
  useEffect(() => {
      if (messages.length > 1 && isOpen) { // >1 to skip just the greeting
          const sessionToSave: QASession = {
              id: sessionId,
              timestamp: initialSession?.timestamp || Date.now(),
              lastUpdated: Date.now(),
              messages: messages,
              materialNames: initialSession?.materialNames || materials.map(m => m.name),
              preview: messages.find(m => m.role === 'user')?.text || '新对话'
          };
          saveQASession(sessionToSave).catch(e => console.error("Failed to save chat", e));
      }
  }, [messages, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, showWebSearch]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    setHasStarted(true);
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setShowWebSearch(false); 

    try {
      const responseText = await askDocument(materials, userMsg.text, messages);
      
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, aiMsg]);

      if (responseText.includes("无法找到相关答案") || responseText.includes("无法在参考材料中")) {
          setShowWebSearch(true);
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "抱歉，出现了一些问题，请稍后再试。",
        timestamp: Date.now()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleWebSearch = async () => {
      if (loading) return;
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      if (!lastUserMsg) return;

      setLoading(true);
      setShowWebSearch(false); 

      try {
          const webResponse = await askWeb(lastUserMsg.text, messages, selectedEngine);
          
          const engineName = selectedEngine === 'baidu_search1' ? '百度搜索' : 
                             selectedEngine === 'google_serper' ? 'Google (Serper)' : 
                             selectedEngine === 'tavily' ? 'Tavily AI' : 'Google (原生)';
          
          const aiMsg: ChatMessage = {
              id: Date.now().toString(),
              role: 'model',
              text: `🌐 **${engineName} 结果** \n\n` + webResponse,
              timestamp: Date.now()
          };
          setMessages(prev => [...prev, aiMsg]);
      } catch (e) {
          setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'model',
              text: "抱歉，联网搜索失败。",
              timestamp: Date.now()
          }]);
      } finally {
          setLoading(false);
      }
  };

  const handleCopy = (id: string, text: string) => {
      navigator.clipboard.writeText(text).then(() => {
          setCopyStatus(prev => ({ ...prev, [id]: true }));
          setTimeout(() => {
              setCopyStatus(prev => ({ ...prev, [id]: false }));
          }, 2000);
      });
  };

  const handleTranslate = async (id: string, text: string) => {
      if (translations[id]) return; // Already translated
      if (translating[id]) return; // In progress

      setTranslating(prev => ({ ...prev, [id]: true }));
      try {
          const result = await translateText(text);
          setTranslations(prev => ({ ...prev, [id]: result }));
      } catch (e) {
          console.error(e);
      } finally {
          setTranslating(prev => ({ ...prev, [id]: false }));
      }
  };

  const toggleRegenInput = (id: string) => {
      setRegenInputVisible(prev => ({ ...prev, [id]: !prev[id] }));
      setRegenInstruction(prev => ({ ...prev, [id]: '' })); // Reset instruction on open
  };

  const submitRegenerate = async (msgId: string) => {
      if (regenerating[msgId]) return;

      const msgIndex = messages.findIndex(m => m.id === msgId);
      if (msgIndex <= 0) return; // Cannot regenerate if first message or not found

      // Find the last user message to use as context
      let targetUserMsgIndex = -1;
      for (let i = msgIndex - 1; i >= 0; i--) {
          if (messages[i].role === 'user') {
              targetUserMsgIndex = i;
              break;
          }
      }

      if (targetUserMsgIndex === -1) {
          console.warn("Could not find user message context for regeneration.");
          return;
      }

      const prevMsg = messages[targetUserMsgIndex];
      
      setRegenerating(prev => ({ ...prev, [msgId]: true }));
      setRegenInputVisible(prev => ({ ...prev, [msgId]: false }));

      const instruction = regenInstruction[msgId] || '';
      const originalQuestion = prevMsg.text;
      const contextHistory = messages.slice(0, targetUserMsgIndex); 

      try {
          const queryText = instruction 
             ? `${originalQuestion}\n\n(补充指令/要求: ${instruction})`
             : originalQuestion;

          // Pass the selected engine to askSmart for regeneration
          const responseText = await askSmart(materials, queryText, contextHistory, selectedEngine);
          
          setMessages(prev => prev.map(m => {
              if (m.id === msgId) {
                  return {
                      ...m,
                      text: responseText,
                      timestamp: Date.now()
                  };
              }
              return m;
          }));
          
          setTranslations(prev => {
              const newState = { ...prev };
              delete newState[msgId];
              return newState;
          });

      } catch (e) {
          console.error("Regeneration failed", e);
          alert("重新生成失败，请稍后重试。");
      } finally {
          setRegenerating(prev => ({ ...prev, [msgId]: false }));
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[700px] flex flex-col relative z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-white border-b border-slate-100 flex flex-col">
            <div className="p-4 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <SearchChatIcon />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-lg">即问即答</h3>
                        <p className="text-xs text-slate-500">
                            {initialSession ? '历史记录回顾' : `基于 ${materials.length} 份选中文档检索`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    {/* Search Engine Selector */}
                    <div className="relative">
                        <button 
                            onClick={() => setShowEngineSelect(!showEngineSelect)}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 transition-colors"
                        >
                            <GlobeIcon />
                            <span>
                                {selectedEngine === 'google_native' ? 'Google (AI)' : 
                                 selectedEngine === 'baidu_search1' ? '百度 (Baidu)' : 
                                 selectedEngine === 'tavily' ? 'Tavily AI' : 'Google (Serper)'}
                            </span>
                            <ChevronDownIcon className="w-3 h-3"/>
                        </button>
                        
                        {showEngineSelect && (
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1 animate-in fade-in zoom-in-95">
                                <button 
                                    onClick={() => { setSelectedEngine('google_native'); setShowEngineSelect(false); }}
                                    className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-between
                                        ${selectedEngine === 'google_native' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}
                                    `}
                                >
                                    <span>Google (原生 AI 工具)</span>
                                    {selectedEngine === 'google_native' && <CheckCircleIcon className="w-3 h-3"/>}
                                </button>
                                <button 
                                    onClick={() => { setSelectedEngine('tavily'); setShowEngineSelect(false); }}
                                    className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-between
                                        ${selectedEngine === 'tavily' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}
                                    `}
                                >
                                    <span>Tavily AI Search</span>
                                    {selectedEngine === 'tavily' && <CheckCircleIcon className="w-3 h-3"/>}
                                </button>
                                <button 
                                    onClick={() => { setSelectedEngine('baidu_search1'); setShowEngineSelect(false); }}
                                    className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-between
                                        ${selectedEngine === 'baidu_search1' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}
                                    `}
                                >
                                    <span>百度 (Baidu Search)</span>
                                    {selectedEngine === 'baidu_search1' && <CheckCircleIcon className="w-3 h-3"/>}
                                </button>
                                <button 
                                    onClick={() => { setSelectedEngine('google_serper'); setShowEngineSelect(false); }}
                                    className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-between
                                        ${selectedEngine === 'google_serper' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}
                                    `}
                                >
                                    <span>Google (Serper API)</span>
                                    {selectedEngine === 'google_serper' && <CheckCircleIcon className="w-3 h-3"/>}
                                </button>
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={onClose} 
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <XMarkIcon />
                    </button>
                </div>
            </div>
            
            {/* Active Documents List (only show if not in history view and there are materials) */}
            {!initialSession && materials.length > 0 && (
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-bold text-slate-500 mr-1">参考文档:</span>
                  {materials.map(m => (
                      <div key={m.id} className="flex items-center px-2 py-1 bg-white border border-slate-200 rounded-md text-xs text-slate-700 shadow-sm max-w-[200px]" title={m.name}>
                          <div className="text-blue-500 mr-1.5 shrink-0"><DocIcon /></div>
                          <span className="truncate">{m.name}</span>
                      </div>
                  ))}
              </div>
            )}
        </div>

        {/* Chat Area */}
        <div className="flex-grow overflow-y-auto p-6 space-y-6 bg-slate-50 custom-scrollbar">
           {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden
                  ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-600 text-white'}
              `}>
                  {msg.role === 'user' ? <UserCircleIcon /> : <BotIcon />}
              </div>

              {/* Message Bubble Wrapper */}
              <div className="group relative max-w-[85%]">
                  <div 
                    className={`rounded-2xl p-4 shadow-sm relative transition-all duration-300 overflow-hidden
                      ${msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                      }
                    `}
                  >
                    {/* Regenerating Overlay */}
                    {regenerating[msg.id] && (
                        <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center backdrop-blur-sm">
                            <div className="flex items-center space-x-2 text-indigo-600 font-medium text-sm">
                                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                <span>重新生成中...</span>
                            </div>
                        </div>
                    )}

                    {/* Original Text */}
                    {msg.role === 'user' ? (
                        <div className="whitespace-pre-wrap leading-relaxed break-words">{msg.text}</div>
                    ) : (
                        <MarkdownText text={msg.text} />
                    )}

                    {/* Translation Section */}
                    {(translating[msg.id] || translations[msg.id]) && (
                        <div className={`mt-3 pt-3 border-t ${msg.role === 'user' ? 'border-indigo-400/50' : 'border-slate-100'}`}>
                            {translating[msg.id] ? (
                                <div className="flex items-center space-x-2 text-xs opacity-70">
                                    <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce delay-75"></div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce delay-150"></div>
                                    <span>翻译中...</span>
                                </div>
                            ) : (
                                <div className="text-sm break-words">
                                    <div className="flex items-center space-x-1 mb-1 opacity-70 text-xs uppercase font-bold tracking-wider">
                                        <LanguageIcon /> <span>翻译结果</span>
                                    </div>
                                    <MarkdownText text={translations[msg.id]} />
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Regenerate Input Box */}
                    {regenInputVisible[msg.id] && msg.role === 'model' && (
                        <div className="mt-3 pt-3 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                             <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">重新生成说明 (可选)</label>
                             <div className="flex space-x-2">
                                 <input 
                                    type="text" 
                                    placeholder="例如：请更详细一点 / 请用列表形式..."
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-400 transition-colors"
                                    value={regenInstruction[msg.id] || ''}
                                    onChange={(e) => setRegenInstruction(prev => ({ ...prev, [msg.id]: e.target.value }))}
                                    onKeyDown={(e) => e.key === 'Enter' && submitRegenerate(msg.id)}
                                    autoFocus
                                 />
                                 <button 
                                     onClick={() => submitRegenerate(msg.id)}
                                     className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                                 >
                                     确定
                                 </button>
                             </div>
                        </div>
                    )}

                    {/* Footer: Word Count + Timestamp + Toolbar */}
                    <div className="flex justify-between items-end mt-2 pt-2 gap-4">
                        {/* Meta Info (Left) */}
                        <div className={`text-[10px] font-medium shrink-0 flex items-center space-x-2 ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400 opacity-60'}`}>
                           <span>{new Date(msg.timestamp).toLocaleString('zh-CN', { hour12: false, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                           <span>•</span>
                           <span>{msg.text.length} 字</span>
                        </div>

                        {/* Toolbar (Right) - Always visible now */}
                        <div className="flex space-x-1 items-center">
                            {/* TTS Button - Added */}
                            <TTSControl text={msg.text} showCopy={false} />

                            <button 
                                onClick={() => handleCopy(msg.id, msg.text)}
                                className={`p-1.5 rounded-md transition-colors flex items-center space-x-1 text-xs font-medium ml-1
                                    ${msg.role === 'user' 
                                        ? 'hover:bg-indigo-500 text-indigo-100 hover:text-white' 
                                        : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                                    }
                                `}
                                title="复制"
                            >
                                {copyStatus[msg.id] ? <CheckCircleIcon /> : <ClipboardIcon />}
                            </button>
                            
                            <button 
                                onClick={() => handleTranslate(msg.id, msg.text)}
                                className={`p-1.5 rounded-md transition-colors text-xs font-medium
                                    ${msg.role === 'user' 
                                        ? 'hover:bg-indigo-500 text-indigo-100 hover:text-white' 
                                        : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                                    }
                                `}
                                title="翻译"
                            >
                                <LanguageIcon />
                            </button>
                            
                            {/* Regenerate Button - Only for AI messages */}
                            {msg.role === 'model' && (
                                <button 
                                    onClick={() => toggleRegenInput(msg.id)}
                                    className={`p-1.5 rounded-md transition-colors text-xs font-medium hover:bg-slate-100 text-slate-400 hover:text-slate-600 ${regenInputVisible[msg.id] ? 'bg-slate-100 text-slate-600' : ''}`}
                                    title="重新生成"
                                >
                                    <RefreshIcon />
                                </button>
                            )}
                        </div>
                    </div>
                  </div>
              </div>
            </div>
          ))}
           
           {/* Web Search Suggestion Button */}
           {showWebSearch && !loading && (
               <div className="flex justify-start ml-11 animate-in fade-in slide-in-from-bottom-2 duration-300">
                   <button 
                      onClick={handleWebSearch}
                      className="bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 rounded-xl px-4 py-3 shadow-sm flex items-center space-x-2 transition-all hover:shadow-md active:scale-95"
                   >
                       <div className="bg-blue-100 p-1 rounded-full"><GlobeIcon /></div>
                       <span className="text-sm font-bold">
                           在文档中未找到，尝试{selectedEngine === 'baidu_search1' ? '百度' : selectedEngine === 'tavily' ? 'Tavily' : 'Google'}搜索？
                       </span>
                   </button>
               </div>
           )}

           {loading && (
             <ThinkingIndicator />
           )}
           <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-100">
           <div className="flex items-center space-x-3">
             <input
               type="text"
               value={input}
               onChange={(e) => setInput(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleSend()}
               placeholder="输入问题..."
               disabled={!!initialSession && materials.length === 0} 
               className="flex-grow p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
               autoFocus
             />
             <button
               onClick={handleSend}
               disabled={!input.trim() || loading}
               className="p-3.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
             >
               <SendIcon />
             </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default QuickQAModal;