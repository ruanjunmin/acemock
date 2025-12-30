import React, { useState, useEffect } from 'react';
import { SearchProvider, getSearchKey, setSearchKey, testSearchConnection, getActiveSearchEngine, setActiveSearchEngine, getBatchSize, getRequestDelay, setBatchSize, setRequestDelay, getShardingMode, setShardingMode, ShardingMode } from '../services/externalSearch';
import { SearchEngine } from '../types';
import { XMarkIcon, CheckCircleIcon, GlobeIcon, SettingsIcon } from './Icons';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const SearchConfigModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [activeEngine, setEngine] = useState<SearchEngine>('google_native');
  const [baiduKey, setBaiduKey] = useState('');
  const [serperKey, setSerperKey] = useState('');
  const [tavilyKey, setTavilyKey] = useState('');
  
  // 性能相关配置
  const [batchSize, setLocalBatchSize] = useState(10);
  const [requestDelay, setLocalRequestDelay] = useState(1000);
  const [shardingMode, setLocalShardingMode] = useState<ShardingMode>('SERIAL');

  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, boolean | null>>({});

  useEffect(() => {
    if (isOpen) {
        setEngine(getActiveSearchEngine());
        setBaiduKey(getSearchKey('baidu_search1'));
        setSerperKey(getSearchKey('google_serper'));
        setTavilyKey(getSearchKey('tavily'));
        setLocalBatchSize(getBatchSize());
        setLocalRequestDelay(getRequestDelay());
        setLocalShardingMode(getShardingMode());
        setTestResult({});
    }
  }, [isOpen]);

  const handleSave = () => {
      setSearchKey('baidu_search1', baiduKey);
      setSearchKey('google_serper', serperKey);
      setSearchKey('tavily', tavilyKey);
      setActiveSearchEngine(activeEngine);
      setBatchSize(batchSize);
      setRequestDelay(requestDelay);
      setShardingMode(shardingMode);
      onClose();
  };

  const handleTest = async (provider: SearchProvider) => {
      setTesting(provider);
      setTestResult(prev => ({ ...prev, [provider]: null }));
      
      let keyToTest = '';
      if (provider === 'baidu_search1') keyToTest = baiduKey;
      else if (provider === 'google_serper') keyToTest = serperKey;
      else if (provider === 'tavily') keyToTest = tavilyKey;

      const success = await testSearchConnection(provider, keyToTest);
      
      setTestResult(prev => ({ ...prev, [provider]: success }));
      setTesting(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div className="flex items-center space-x-2">
                <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg"><SettingsIcon /></div>
                <h2 className="text-xl font-bold text-slate-800">系统配置</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                <XMarkIcon />
            </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {/* Active Engine Selection */}
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-3">默认搜索引擎</label>
                <div className="grid grid-cols-1 gap-2">
                    <button 
                        onClick={() => setEngine('google_native')}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${activeEngine === 'google_native' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center">
                            <span className="text-lg mr-2">🤖</span>
                            <div className="text-left">
                                <div className="font-bold text-sm">Google Native (Gemini Built-in)</div>
                                <div className="text-xs opacity-70">使用 Gemini 原生搜索工具，无需额外 Key</div>
                            </div>
                        </div>
                        {activeEngine === 'google_native' && <CheckCircleIcon />}
                    </button>

                    <button 
                        onClick={() => setEngine('tavily')}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${activeEngine === 'tavily' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center">
                            <span className="text-lg mr-2">🌐</span>
                            <div className="text-left">
                                <div className="font-bold text-sm">Tavily AI Search</div>
                                <div className="text-xs opacity-70">专为 LLM 优化的搜索引擎 (推荐)</div>
                            </div>
                        </div>
                        {activeEngine === 'tavily' && <CheckCircleIcon />}
                    </button>

                    <button 
                        onClick={() => setEngine('baidu_search1')}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${activeEngine === 'baidu_search1' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center">
                            <span className="text-lg mr-2">🐼</span>
                            <div className="text-left">
                                <div className="font-bold text-sm">百度搜索 (Baidu via Search1)</div>
                                <div className="text-xs opacity-70">适合中文内容检索，需配置 API Key</div>
                            </div>
                        </div>
                        {activeEngine === 'baidu_search1' && <CheckCircleIcon />}
                    </button>

                    <button 
                        onClick={() => setEngine('google_serper')}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${activeEngine === 'google_serper' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center">
                            <span className="text-lg mr-2">🔍</span>
                            <div className="text-left">
                                <div className="font-bold text-sm">Google (Serper Dev)</div>
                                <div className="text-xs opacity-70">高性能 Google 搜索 API，需配置 Key</div>
                            </div>
                        </div>
                        {activeEngine === 'google_serper' && <CheckCircleIcon />}
                    </button>
                </div>
            </div>

            <div className="border-t border-slate-100 my-2"></div>

            {/* Performance Config */}
            <div>
                <div className="flex items-center space-x-2 mb-4">
                    <span className="text-xl">⚡</span>
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">生成性能与限流优化</h3>
                </div>
                
                <div className="space-y-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    {/* Sharding Mode Selection */}
                    <div>
                        <label className="text-xs font-bold text-slate-600 mb-2 block">分片执行模式</label>
                        <div className="flex p-1 bg-slate-200 rounded-lg">
                            <button 
                                onClick={() => setLocalShardingMode('SERIAL')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${shardingMode === 'SERIAL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                串行分片 (最稳健)
                            </button>
                            <button 
                                onClick={() => setLocalShardingMode('PARALLEL')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${shardingMode === 'PARALLEL' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                并行分片 (极速)
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2">
                            {shardingMode === 'SERIAL' 
                                ? '顺序发起请求。一个完成后再等待间隔时间启动下一个。' 
                                : '错开时间启动。以设定的间隔启动所有请求，速度最快。'}
                        </p>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-slate-600">单请求题目分片数量 (Batch Size)</label>
                            <span className="text-xs font-mono font-bold text-indigo-600 bg-white px-2 py-0.5 rounded border border-indigo-100">{batchSize} 题/片</span>
                        </div>
                        <input 
                            type="range" 
                            min="1" 
                            max="30" 
                            value={batchSize}
                            onChange={(e) => setLocalBatchSize(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                    </div>

                    <div className="animate-in fade-in duration-300">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-slate-600">请求启动间隔延迟 (Request Delay)</label>
                            <span className="text-xs font-mono font-bold text-indigo-600 bg-white px-2 py-0.5 rounded border border-indigo-100">{requestDelay} ms</span>
                        </div>
                        <input 
                            type="range" 
                            min="0" 
                            max="5000" 
                            step="100"
                            value={requestDelay}
                            onChange={(e) => setLocalRequestDelay(parseInt(e.target.value))}
                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <p className="text-[10px] text-slate-400 mt-2">即便使用并行模式，也建议设置 1000ms+ 的启动间隔，以防止被 API 识别为攻击而限流。</p>
                    </div>
                </div>
            </div>

            <div className="border-t border-slate-100 my-2"></div>

            {/* API Key Configuration */}
            <div className="space-y-4">
                <div className="flex items-center space-x-2 mb-1">
                    <span className="text-xl">🔑</span>
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">外部搜索引擎 API Key</h3>
                </div>
                
                {/* Tavily Config */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600 flex justify-between">
                        <span>Tavily AI (默认提供免费 Key)</span>
                        <a href="https://tavily.com/" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">官网 &rarr;</a>
                    </label>
                    <div className="flex space-x-2">
                        <input 
                            type="password" 
                            value={tavilyKey}
                            onChange={(e) => setTavilyKey(e.target.value)}
                            placeholder="自定义 Tavily API Key (可选)"
                            className="flex-grow p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button 
                            onClick={() => handleTest('tavily')}
                            disabled={testing === 'tavily'}
                            className={`px-3 py-2 rounded-lg font-bold text-xs transition-colors border
                                ${testResult['tavily'] === true ? 'bg-green-100 text-green-700 border-green-200' : 
                                  testResult['tavily'] === false ? 'bg-red-100 text-red-700 border-red-200' :
                                  'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}
                            `}
                        >
                            {testing === 'tavily' ? '测试中...' : 
                             testResult['tavily'] === true ? '连接成功' : 
                             testResult['tavily'] === false ? '连接失败' : '测试链接'}
                        </button>
                    </div>
                </div>

                {/* Baidu Config */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600 flex justify-between">
                        <span>Baidu (Search1 API)</span>
                        <a href="https://www.search1api.com/" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">获取 Key &rarr;</a>
                    </label>
                    <div className="flex space-x-2">
                        <input 
                            type="password" 
                            value={baiduKey}
                            onChange={(e) => setBaiduKey(e.target.value)}
                            placeholder="输入 Search1 API Key"
                            className="flex-grow p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button 
                            onClick={() => handleTest('baidu_search1')}
                            disabled={!baiduKey || testing === 'baidu_search1'}
                            className={`px-3 py-2 rounded-lg font-bold text-xs transition-colors border
                                ${testResult['baidu_search1'] === true ? 'bg-green-100 text-green-700 border-green-200' : 
                                  testResult['baidu_search1'] === false ? 'bg-red-100 text-red-700 border-red-200' :
                                  'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}
                            `}
                        >
                            {testing === 'baidu_search1' ? '测试中...' : 
                             testResult['baidu_search1'] === true ? '连接成功' : 
                             testResult['baidu_search1'] === false ? '连接失败' : '测试链接'}
                        </button>
                    </div>
                </div>

                {/* Serper Config */}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600 flex justify-between">
                        <span>Google (Serper.dev)</span>
                        <a href="https://serper.dev/" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">获取 Key &rarr;</a>
                    </label>
                    <div className="flex space-x-2">
                        <input 
                            type="password" 
                            value={serperKey}
                            onChange={(e) => setSerperKey(e.target.value)}
                            placeholder="输入 Serper API Key"
                            className="flex-grow p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button 
                            onClick={() => handleTest('google_serper')}
                            disabled={!serperKey || testing === 'google_serper'}
                            className={`px-3 py-2 rounded-lg font-bold text-xs transition-colors border
                                ${testResult['google_serper'] === true ? 'bg-green-100 text-green-700 border-green-200' : 
                                  testResult['google_serper'] === false ? 'bg-red-100 text-red-700 border-red-200' :
                                  'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}
                            `}
                        >
                            {testing === 'google_serper' ? '测试中...' : 
                             testResult['google_serper'] === true ? '连接成功' : 
                             testResult['google_serper'] === false ? '连接失败' : '测试链接'}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end">
            <button 
                onClick={onClose}
                className="px-4 py-2 text-slate-500 hover:text-slate-700 font-bold text-sm mr-2"
            >
                取消
            </button>
            <button 
                onClick={handleSave}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-sm"
            >
                保存配置
            </button>
        </div>
      </div>
    </div>
  );
};

export default SearchConfigModal;