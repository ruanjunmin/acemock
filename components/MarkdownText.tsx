import React from 'react';

// Helper for inline styles (bold)
const parseInline = (text: string) => {
    // 1. Handle Bold (**text**)
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-bold text-slate-900 bg-yellow-50/80 px-1 rounded mx-0.5">{part.slice(2, -2)}</strong>;
        }
        return part;
    });
};

export const MarkdownText: React.FC<{ text: string }> = ({ text }) => {
  // 1. Handle Code Blocks
  const codeBlockRegex = /```([\s\S]*?)```/g;
  const parts = text.split(codeBlockRegex);

  return (
    <div className="text-sm leading-7 space-y-4 break-words w-full text-slate-700">
      {parts.map((part, index) => {
        if (index % 2 === 1) {
           // This is code block
           return (
             <pre key={index} className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto text-xs font-mono my-4 whitespace-pre-wrap break-all shadow-sm border border-slate-700">
               <code>{part.trim()}</code>
             </pre>
           )
        }
        
        // Normal text processing
        const lines = part.split('\n');
        return (
          <div key={index} className="min-w-0">
            {lines.map((line, lineIdx) => {
               const trimmed = line.trim();
               if (!trimmed) return <div key={lineIdx} className="h-2"></div>;
               
               // H1 (# )
               if (trimmed.startsWith('# ')) {
                   return (
                       <h1 key={lineIdx} className="text-3xl font-extrabold text-slate-900 mt-10 mb-6 border-b pb-3 border-slate-200">
                           {parseInline(trimmed.replace(/^#\s+/, ''))}
                       </h1>
                   )
               }

               // H2 (## )
               if (trimmed.startsWith('## ')) {
                   return (
                       <h2 key={lineIdx} className="text-2xl font-bold text-slate-800 mt-8 mb-4 flex items-center group">
                           <span className="w-1.5 h-6 bg-blue-600 rounded-full mr-3 group-hover:bg-indigo-600 transition-colors"></span>
                           {parseInline(trimmed.replace(/^##\s+/, ''))}
                       </h2>
                   )
               }
               
               // H3 (### )
               if (trimmed.startsWith('### ')) {
                   return (
                       <h3 key={lineIdx} className="text-lg font-bold text-slate-700 mt-6 mb-3 bg-slate-100/50 p-2 rounded-lg border-l-4 border-blue-400 inline-block pr-6">
                           {parseInline(trimmed.replace(/^###\s+/, ''))}
                       </h3>
                   )
               }

               // H4 (#### ) - Added support
               if (trimmed.startsWith('#### ')) {
                   return (
                       <h4 key={lineIdx} className="text-base font-bold text-indigo-700 mt-4 mb-2 flex items-center">
                           <span className="mr-2 text-indigo-400">❖</span>
                           {parseInline(trimmed.replace(/^####\s+/, ''))}
                       </h4>
                   )
               }

               // Blockquote (> )
               if (trimmed.startsWith('> ')) {
                   return (
                       <div key={lineIdx} className="border-l-4 border-slate-300 bg-slate-50 pl-4 py-2 my-3 italic text-slate-600 rounded-r-lg">
                           {parseInline(trimmed.replace(/^>\s+/, ''))}
                       </div>
                   )
               }

               // Lists (* or -)
               // Regex: Starts with * or -, followed by at least one space
               if (trimmed.match(/^[-*]\s+/)) {
                   return (
                       <div key={lineIdx} className="flex items-start ml-2 mb-2 group">
                           <span className="mr-3 mt-2.5 w-1.5 h-1.5 bg-slate-400 rounded-full shrink-0 group-hover:bg-blue-500 transition-colors"></span>
                           <span className="break-words min-w-0 flex-1 leading-relaxed text-slate-700">
                               {parseInline(trimmed.replace(/^[-*]\s+/, ''))}
                           </span>
                       </div>
                   )
               }

               // Numbered Lists (1. )
               if (trimmed.match(/^\d+\.\s+/)) {
                   const match = trimmed.match(/^(\d+)\.\s+/);
                   const num = match ? match[1] : '1';
                   return (
                       <div key={lineIdx} className="flex items-start ml-1 mb-2">
                           <span className="mr-2 font-bold text-blue-600 shrink-0 min-w-[1.5em] select-none">{num}.</span>
                           <span className="break-words min-w-0 flex-1 leading-relaxed">
                               {parseInline(trimmed.replace(/^\d+\.\s+/, ''))}
                           </span>
                       </div>
                   )
               }
               
               // Reference Links [1]
               if (trimmed.match(/^\[\d+\]/) && line.includes('http')) {
                   const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
                   if (urlMatch) {
                       const url = urlMatch[0];
                       let textPart = line.replace(url, '').trim();
                       
                       const indexMatch = textPart.match(/^\[\d+\]/);
                       const indexStr = indexMatch ? indexMatch[0] : '';
                       const indexNum = indexStr.replace(/[\[\]]/g, '');

                       let title = textPart.replace(/^\[\d+\]/, '').trim();
                       if (title.endsWith(':')) title = title.slice(0, -1).trim();
                       if (!title) title = "网页来源"; 

                       return (
                           <a
                               key={lineIdx}
                               href={url}
                               target="_blank"
                               rel="noopener noreferrer"
                               className="block mb-2 mt-1 p-3 rounded-xl bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all group text-left no-underline"
                           >
                               <div className="flex items-start">
                                    <span className="shrink-0 flex items-center justify-center w-5 h-5 bg-blue-100 text-blue-600 text-[10px] font-bold rounded mr-2 mt-0.5">
                                       {indexNum}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold text-slate-700 group-hover:text-blue-600 truncate">
                                            {title}
                                        </div>
                                        <div className="text-[10px] text-slate-400 truncate mt-0.5 font-mono opacity-80 group-hover:opacity-100">
                                            {url}
                                        </div>
                                    </div>
                               </div>
                           </a>
                       )
                   }
               }
               
               // Standard Paragraph
               return <p key={lineIdx} className="mb-2 break-words text-justify text-slate-600">{parseInline(trimmed)}</p>;
            })}
          </div>
        )
      })}
    </div>
  );
};