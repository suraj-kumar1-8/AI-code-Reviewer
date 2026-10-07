import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { Copy, Check, Code, Eye, RefreshCw, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({
  chart,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [showRaw, setShowRaw] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isRendering, setIsRendering] = useState<boolean>(false);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        darkMode: true,
        background: '#070D18',
        primaryColor: '#6366F1',
        primaryTextColor: '#FFFFFF',
        primaryBorderColor: '#818CF8',
        lineColor: '#818CF8',
        secondaryColor: '#1E1B4B',
        tertiaryColor: '#0B132B',
      },
      securityLevel: 'loose',
      fontFamily: 'Inter, system-ui, sans-serif',
    });
  }, []);

  const renderDiagram = async () => {
    if (!chart || !chart.trim()) {
      setSvgContent('');
      setRenderError(null);
      return;
    }

    setIsRendering(true);
    setRenderError(null);

    try {
      const uniqueId = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
      const { svg } = await mermaid.render(uniqueId, chart.trim());
      setSvgContent(svg);
      setRenderError(null);
    } catch (err: any) {
      console.warn('[MermaidDiagram] Render error:', err.message);
      setRenderError(err.message || 'Unable to render syntax. Showing raw diagram text.');
    } finally {
      setIsRendering(false);
    }
  };

  useEffect(() => {
    renderDiagram();
  }, [chart]);

  const handleCopy = () => {
    navigator.clipboard.writeText(chart);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 0.15, 2.0));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 0.15, 0.5));
  const handleZoomReset = () => setZoomLevel(1);

  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-[#070D18] overflow-hidden shadow-xl ${className}`}
    >
      {/* Header Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-300">
            Architecture Topology Diagram
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Zoom controls */}
          {!showRaw && !renderError && svgContent && (
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-0.5 mr-2">
              <button
                onClick={handleZoomOut}
                title="Zoom Out"
                className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono text-gray-400 px-1">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                title="Zoom In"
                className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleZoomReset}
                title="Reset Zoom"
                className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Toggle Raw/Visual */}
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors cursor-pointer"
          >
            {showRaw ? (
              <>
                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                Visual
              </>
            ) : (
              <>
                <Code className="w-3.5 h-3.5 text-indigo-400" />
                Mermaid Syntax
              </>
            )}
          </button>

          {/* Copy Mermaid Code */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors cursor-pointer"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-gray-400" />
                Copy Syntax
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Diagram Area */}
      <div className="p-6 relative min-h-[300px] flex items-center justify-center overflow-auto bg-[#040810]">
        {isRendering && (
          <div className="absolute inset-0 bg-[#040810]/80 backdrop-blur-sm flex items-center justify-center z-10">
            <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        )}

        {showRaw ? (
          <pre className="w-full text-xs font-mono text-indigo-200 bg-black/40 p-4 rounded-xl border border-white/10 overflow-x-auto leading-relaxed">
            {chart}
          </pre>
        ) : renderError ? (
          <div className="w-full text-center p-6 space-y-3">
            <div className="inline-flex p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
              ⚠️ Visual rendering notice: {renderError}
            </div>
            <pre className="text-left text-xs font-mono text-gray-300 bg-black/40 p-4 rounded-xl border border-white/10 overflow-x-auto">
              {chart}
            </pre>
          </div>
        ) : svgContent ? (
          <div
            ref={containerRef}
            className="w-full flex items-center justify-center transition-transform duration-200"
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : (
          <div className="text-sm text-gray-500 py-12">No diagram syntax available</div>
        )}
      </div>
    </div>
  );
};

export default MermaidDiagram;
