import React, { useState, useRef, useEffect } from 'react';
import * as echarts from 'echarts';
import { XMarkIcon, PrinterIcon, BookIcon, BrainIcon, RefreshIcon, ExpandIcon, CollapseIcon, CopyIcon, DownloadIcon, ChevronDownIcon, CheckCircleIcon } from './Icons';
import { MarkdownText } from './MarkdownText';
import { StudyGuide, MindMapNode } from '../types';

interface Props {
  content: StudyGuide;
  onClose: () => void;
}

const TabButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
    <button
        onClick={onClick}
        className={`flex items-center space-x-2 px-6 py-3 rounded-t-xl font-bold text-sm transition-all relative top-[1px] z-10
            ${active 
                ? 'bg-white text-blue-600 border-t border-x border-slate-200 shadow-[0_-2px_5px_rgba(0,0,0,0.02)]' 
                : 'bg-slate-50 text-slate-500 hover:bg-slate-100 border-b border-slate-200'
            }
        `}
    >
        {icon}
        <span>{label}</span>
    </button>
);

// --- ECharts Mind Map Component ---
const EChartsMindMap = ({ tree }: { tree: MindMapNode }) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<echarts.ECharts | null>(null);

    // Transform data for ECharts
    const transformData = (node: MindMapNode): any => {
        return {
            name: node.label || 'Unknown', // Fallback for empty labels
            value: node.summary, // Used for tooltip
            children: node.children?.map(transformData) || [],
            // Style logic can be added here if needed per node
            collapsed: false
        };
    };

    useEffect(() => {
        if (!chartRef.current) return;

        // Dispose previous instance to prevent leaks or conflicts if re-rendering
        if (instanceRef.current) {
            instanceRef.current.dispose();
        }

        const chart = echarts.init(chartRef.current);
        instanceRef.current = chart;

        const data = transformData(tree);

        const option: echarts.EChartsOption = {
            tooltip: {
                trigger: 'item',
                triggerOn: 'mousemove',
                formatter: (params: any) => {
                    const val = params.value;
                    return `
                        <div class="font-bold mb-1">${params.name}</div>
                        ${val ? `<div class="text-xs opacity-80 max-w-[200px] whitespace-normal">${val}</div>` : ''}
                    `;
                },
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                borderColor: '#cbd5e1',
                borderWidth: 1,
                textStyle: { color: '#334155' },
                padding: 10,
                extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border-radius: 8px;'
            },
            series: [
                {
                    type: 'tree',
                    data: [data],
                    top: '10%',
                    left: '7%',
                    bottom: '10%',
                    right: '20%',
                    symbolSize: 7,
                    symbol: 'emptyCircle',
                    roam: true, // Enable dragging and zooming
                    itemStyle: {
                        color: '#fff',
                        borderColor: '#2563eb',
                        borderWidth: 2
                    },
                    label: {
                        position: 'left',
                        verticalAlign: 'middle',
                        align: 'right',
                        fontSize: 14,
                        color: '#334155',
                        fontWeight: 'bold'
                    },
                    leaves: {
                        label: {
                            position: 'right',
                            verticalAlign: 'middle',
                            align: 'left',
                            color: '#475569',
                            fontWeight: 'normal',
                            backgroundColor: '#f8fafc',
                            padding: [4, 8],
                            borderRadius: 4,
                            borderColor: '#e2e8f0',
                            borderWidth: 1
                        }
                    },
                    emphasis: {
                        focus: 'descendant'
                    },
                    expandAndCollapse: true,
                    animationDuration: 550,
                    animationDurationUpdate: 750,
                    initialTreeDepth: 2, // Collapsed by default to avoid overlap
                    lineStyle: {
                        color: '#cbd5e1',
                        curveness: 0.5,
                        width: 1.5
                    }
                }
            ]
        };

        chart.setOption(option);

        // Resize handler using ResizeObserver for container changes (full screen toggle)
        const resizeObserver = new ResizeObserver(() => {
            chart.resize();
        });
        resizeObserver.observe(chartRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.dispose();
        };
    }, [tree]);

    return (
        <div className="relative w-full h-full bg-slate-50/50">
             <div ref={chartRef} className="w-full h-full" />
             <div className="absolute bottom-4 left-4 text-xs text-slate-400 bg-white/80 px-2 py-1 rounded pointer-events-none z-10 border border-slate-100 shadow-sm">
                支持滚轮缩放 • 拖拽平移 • 点击节点折叠
            </div>
        </div>
    );
};

// --- Flashcard Batching Component ---
const FlashcardGrid = ({ cards }: { cards: { term: string, definition: string }[] }) => {
    const BATCH_SIZE = 6;
    const [batchIndex, setBatchIndex] = useState(0);
    const [flipping, setFlipping] = useState(false); // For animation effect
    
    // Ensure cards is an array to prevent crashes
    const safeCards = cards || [];
    const totalBatches = Math.max(1, Math.ceil(safeCards.length / BATCH_SIZE));
    const currentCards = safeCards.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);

    const handleNextBatch = () => {
        setFlipping(true);
        setTimeout(() => {
            setBatchIndex(prev => (prev + 1) % totalBatches);
            setFlipping(false);
        }, 300);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center">
                    <span className="bg-indigo-600 w-1.5 h-6 rounded-full mr-3"></span>
                    <h3 className="text-xl font-bold text-slate-700">高频考点速记</h3>
                    <span className="ml-3 text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full">
                        第 {batchIndex + 1} / {totalBatches} 组
                    </span>
                </div>
                
                {totalBatches > 1 && (
                    <button 
                        onClick={handleNextBatch}
                        className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all shadow-sm active:scale-95"
                    >
                        <RefreshIcon />
                        <span>换一批</span>
                    </button>
                )}
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity duration-300 ${flipping ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                {currentCards.map((card, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col h-full group hover:-translate-y-1 duration-300">
                        <div className="flex items-center space-x-2 mb-3">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                                {batchIndex * BATCH_SIZE + idx + 1}
                            </span>
                            <h4 className="font-bold text-slate-800 text-lg leading-tight group-hover:text-blue-600 transition-colors">
                                {card.term || "未命名概念"}
                            </h4>
                        </div>
                        <div className="flex-grow bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm text-slate-600 leading-relaxed group-hover:bg-blue-50/30 group-hover:border-blue-100 transition-colors">
                            {card.definition || "暂无定义"}
                        </div>
                    </div>
                ))}
            </div>
            
            {safeCards.length === 0 && (
                <div className="text-center py-20 text-slate-400">
                    暂无卡片数据
                </div>
            )}
        </div>
    );
};

const StudyGuideViewer: React.FC<Props> = ({ content, onClose }) => {
  const [activeTab, setActiveTab] = useState<'NOTES' | 'MINDMAP' | 'CARDS'>('NOTES');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const notesRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
      window.print();
  }

  const handleCopy = async () => {
      try {
          await navigator.clipboard.writeText(content.markdownContent);
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
          console.error('Failed to copy', err);
      }
  };

  const handleExport = (format: 'word' | 'pdf' | 'txt' | 'md') => {
      const filename = `学习笔记_${new Date().toISOString().slice(0,10)}`;

      if (format === 'pdf') {
          window.print();
          setShowExportMenu(false);
          return;
      }

      let blob;
      let extension;

      if (format === 'md') {
          blob = new Blob([content.markdownContent], { type: 'text/markdown;charset=utf-8' });
          extension = 'md';
      } else if (format === 'txt') {
          blob = new Blob([content.markdownContent], { type: 'text/plain;charset=utf-8' });
          extension = 'txt';
      } else if (format === 'word') {
          // Simple HTML export for Word
          const contentHtml = notesRef.current ? notesRef.current.innerHTML : '';
          // Basic styling for the exported HTML to look okay in Word
          const styles = `
              <style>
                  body { font-family: sans-serif; line-height: 1.5; }
                  h1 { font-size: 24pt; font-weight: bold; margin-bottom: 12pt; }
                  h2 { font-size: 18pt; font-weight: bold; margin-top: 12pt; margin-bottom: 6pt; color: #1e293b; }
                  h3 { font-size: 14pt; font-weight: bold; margin-top: 10pt; margin-bottom: 6pt; color: #334155; }
                  p { margin-bottom: 10pt; font-size: 11pt; color: #334155; }
                  strong { font-weight: bold; color: #0f172a; }
                  ul { margin-bottom: 10pt; }
                  li { margin-bottom: 4pt; }
                  code { background: #f1f5f9; padding: 2px 4px; border-radius: 4px; font-family: monospace; }
                  pre { background: #1e293b; color: #f8fafc; padding: 10px; border-radius: 6px; }
                  blockquote { border-left: 4px solid #cbd5e1; padding-left: 10px; color: #64748b; font-style: italic; }
              </style>
          `;
          const html = `
              <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
              <head><meta charset='utf-8'>${styles}</head>
              <body>${contentHtml}</body>
              </html>
          `;
          blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
          extension = 'doc';
      }

      if (blob && extension) {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `${filename}.${extension}`;
          link.click();
          URL.revokeObjectURL(link.href);
      }
      setShowExportMenu(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="bg-white w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl relative z-10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="pt-5 px-6 pb-0 bg-slate-50 border-b border-slate-200 flex flex-col">
            <div className="flex justify-between items-start mb-4">
                <div>
                   <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                       <span className="text-2xl">🎓</span> 全能学习中心
                   </h2>
                   <p className="text-slate-500 text-sm mt-1">AI 生成的多维度学习资料</p>
                </div>
                <div className="flex gap-2 relative">
                    {/* Copy and Export Buttons - Only for Notes */}
                    {activeTab === 'NOTES' && (
                        <>
                            <button 
                                onClick={handleCopy}
                                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all
                                    ${copySuccess 
                                        ? 'bg-green-50 text-green-600 border-green-200' 
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                                    }
                                `}
                                title="复制全文"
                            >
                                {copySuccess ? <CheckCircleIcon className="w-4 h-4"/> : <CopyIcon />}
                                <span>{copySuccess ? '已复制' : '复制'}</span>
                            </button>

                            <div className="relative">
                                <button 
                                    onClick={() => setShowExportMenu(!showExportMenu)}
                                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all
                                        ${showExportMenu 
                                            ? 'bg-indigo-50 text-indigo-600 border-indigo-200' 
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                                        }
                                    `}
                                >
                                    <DownloadIcon />
                                    <span>导出笔记</span>
                                    <ChevronDownIcon className="w-3 h-3" />
                                </button>
                                
                                {showExportMenu && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden">
                                        <div className="py-1">
                                            <button onClick={() => handleExport('word')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-blue-600 flex items-center space-x-2">
                                                <span className="w-5 flex justify-center text-blue-600 font-bold text-xs border border-blue-200 rounded px-1">W</span>
                                                <span>导出 Word (.doc)</span>
                                            </button>
                                            <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-red-600 flex items-center space-x-2">
                                                <span className="w-5 flex justify-center text-red-600 font-bold text-xs border border-red-200 rounded px-1">P</span>
                                                <span>打印 / PDF</span>
                                            </button>
                                            <button onClick={() => handleExport('md')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center space-x-2">
                                                <span className="w-5 flex justify-center text-slate-600 font-bold text-xs border border-slate-300 rounded px-1">M</span>
                                                <span>导出 Markdown</span>
                                            </button>
                                            <button onClick={() => handleExport('txt')} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center space-x-2">
                                                <span className="w-5 flex justify-center text-slate-500 font-bold text-xs border border-slate-300 rounded px-1">T</span>
                                                <span>导出 Text (.txt)</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    <button onClick={onClose} className="p-2 hover:bg-red-100 hover:text-red-600 rounded-lg text-slate-400 transition-colors ml-2">
                        <XMarkIcon />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-2 overflow-x-auto no-scrollbar">
                <TabButton 
                    active={activeTab === 'NOTES'} 
                    onClick={() => setActiveTab('NOTES')} 
                    icon={<BookIcon />} 
                    label="结构化笔记" 
                />
                <TabButton 
                    active={activeTab === 'MINDMAP'} 
                    onClick={() => setActiveTab('MINDMAP')} 
                    icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>} 
                    label="思维导图" 
                />
                <TabButton 
                    active={activeTab === 'CARDS'} 
                    onClick={() => setActiveTab('CARDS')} 
                    icon={<BrainIcon />} 
                    label="核心卡片" 
                />
            </div>
        </div>

        {/* Content Area */}
        <div className="flex-grow bg-white overflow-hidden relative">
            
            {/* NOTES VIEW */}
            <div className={`absolute inset-0 p-8 overflow-y-auto custom-scrollbar transition-opacity duration-300 ${activeTab === 'NOTES' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                <div ref={notesRef} className="prose prose-slate max-w-4xl mx-auto pb-10">
                    <MarkdownText text={content.markdownContent} />
                </div>
            </div>

            {/* MIND MAP VIEW */}
            <div className={`transition-opacity duration-300 ${activeTab === 'MINDMAP' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}
                ${isFullScreen ? 'fixed inset-0 z-[100] bg-white' : 'absolute inset-0 p-0 bg-slate-50'}
            `}>
                {/* Check if tree exists, fallback if not updated yet */}
                {content.mindMapTree && content.mindMapTree.label ? (
                    <div className="w-full h-full relative">
                        <EChartsMindMap tree={content.mindMapTree} />
                        {/* Full Screen Toggle */}
                        <button
                            onClick={() => setIsFullScreen(!isFullScreen)}
                            className="absolute top-4 right-4 p-2 bg-white rounded-lg shadow-md border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all z-20"
                            title={isFullScreen ? "退出全屏" : "全屏查看"}
                        >
                            {isFullScreen ? <CollapseIcon /> : <ExpandIcon />}
                        </button>
                    </div>
                ) : (
                   <div className="flex items-center justify-center h-full text-slate-400">
                       数据加载中或导图结构不完整，请尝试重新生成。
                   </div>
                )}
            </div>

            {/* CARDS VIEW */}
            <div className={`absolute inset-0 p-8 overflow-y-auto custom-scrollbar bg-slate-50 transition-opacity duration-300 ${activeTab === 'CARDS' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                <div className="max-w-6xl mx-auto">
                    <FlashcardGrid cards={content.keyConcepts} />
                </div>
            </div>

        </div>
        
      </div>
    </div>
  );
};

export default StudyGuideViewer;
