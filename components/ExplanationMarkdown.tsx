import React from 'react';

interface ExplanationMarkdownProps {
    text: string;
    className?: string;
}

export const ExplanationMarkdown: React.FC<ExplanationMarkdownProps> = ({ text, className = "" }) => {
    if (!text) return null;
    
    // Split by newlines to handle paragraphs and lists
    const lines = text.split('\n');

    return (
        <div className={`space-y-1.5 ${className}`}>
            {lines.map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={i} className="h-1" />; // Small spacer for empty lines

                // Check for bullets (standard, dash, or bullet char)
                const isBullet = trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('• ');
                // Check for indentation (2 spaces or tab)
                const isNested = line.startsWith('  ') || line.startsWith('\t');
                
                let content = trimmed;
                if (isBullet) {
                    content = trimmed.substring(2).trim();
                }

                // Parse Bold **text** using regex split
                // This splits "A **bold** word" into ["A ", "**bold**", " word"]
                const parts = content.split(/(\*\*.*?\*\*)/g);

                return (
                    <div key={i} className={`text-sm text-slate-700 leading-relaxed ${isBullet ? 'flex gap-2' : ''} ${isNested ? 'ml-5' : ''}`}>
                         {isBullet && (
                             <div className="shrink-0 mt-[0.4rem] w-1.5 h-1.5 rounded-full bg-indigo-400" />
                         )}
                         <div>
                            {parts.map((part, j) => {
                                if (part.startsWith('**') && part.endsWith('**')) {
                                    return <span key={j} className="font-bold text-slate-900">{part.slice(2, -2)}</span>;
                                }
                                return <span key={j}>{part}</span>;
                            })}
                         </div>
                    </div>
                );
            })}
        </div>
    );
};
