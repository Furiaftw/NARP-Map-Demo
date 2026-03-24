import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

const TOOLS = {
  BRUSH: 'brush',
  LINE: 'line',
  ERASER: 'eraser',
};

const DEFAULT_SETTINGS = {
  tool: TOOLS.BRUSH,
  color: '#ef4444',
  brushSize: 4,
  opacity: 0.8,
  lineStyle: 'solid',
};

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#a855f7', '#ec4899',
  '#ffffff', '#000000', '#78716c', '#b91c1c', '#1d4ed8',
];

export default function MapDrawingCanvas({
  imageWrapperRef,
  imageNaturalSize,
  isActive,
  onClose,
  hasStaffAccess,
  scale,
  toolbarContainerRef,
}) {
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [drawings, setDrawings] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokeRef = useRef(null);
  const [lineStart, setLineStart] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [undoStack, setUndoStack] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const drawingsRef = useRef([]);
  const [, forceUpdate] = useState(0);

  // Keep ref in sync
  useEffect(() => { drawingsRef.current = drawings; }, [drawings]);

  // Load drawings on mount and whenever draw mode is activated
  useEffect(() => {
    fetchDrawings();
  }, []);

  useEffect(() => {
    if (isActive) fetchDrawings();
  }, [isActive]);

  const fetchDrawings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/drawings');
      if (res.ok) {
        const data = await res.json();
        const d = data.drawings || [];
        setDrawings(d);
        drawingsRef.current = d;
      }
    } catch {}
    setLoading(false);
  };

  // Redraw all strokes whenever drawings change or canvas resizes
  useEffect(() => {
    redrawCanvas();
  }, [drawings, imageNaturalSize]);

  useEffect(() => {
    if (!imageWrapperRef?.current) return;
    const observer = new ResizeObserver(() => {
      syncCanvasSize();
      redrawCanvas();
    });
    observer.observe(imageWrapperRef.current);
    return () => observer.disconnect();
  }, [drawings]);

  const syncCanvasSize = useCallback(() => {
    const wrapper = imageWrapperRef?.current;
    if (!wrapper) return;
    const w = wrapper.offsetWidth;
    const h = wrapper.offsetHeight;
    [canvasRef.current, overlayCanvasRef.current].forEach(c => {
      if (c && (c.width !== w || c.height !== h)) {
        c.width = w;
        c.height = h;
      }
    });
  }, [imageWrapperRef]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = imageWrapperRef?.current;
    if (!canvas || !wrapper) return;
    syncCanvasSize();
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    drawingsRef.current.forEach(stroke => {
      renderStroke(ctx, stroke, w, h);
    });
  }, [imageWrapperRef, syncCanvasSize]);

  const renderStroke = (ctx, stroke, w, h) => {
    if (!stroke || !stroke.points || stroke.points.length === 0) return;
    ctx.save();
    ctx.globalAlpha = stroke.opacity ?? 0.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.tool === TOOLS.ERASER) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.strokeStyle = stroke.color || '#ef4444';
    ctx.lineWidth = (stroke.brushSize || 4) * (w / 1000);

    if (stroke.lineStyle === 'dashed') {
      ctx.setLineDash([ctx.lineWidth * 3, ctx.lineWidth * 2]);
    } else if (stroke.lineStyle === 'dotted') {
      ctx.setLineDash([ctx.lineWidth, ctx.lineWidth * 2]);
    } else {
      ctx.setLineDash([]);
    }

    if (stroke.tool === TOOLS.LINE && stroke.points.length === 2) {
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x * w, stroke.points[0].y * h);
      ctx.lineTo(stroke.points[1].x * w, stroke.points[1].y * h);
      ctx.stroke();
    } else {
      ctx.beginPath();
      const pts = stroke.points;
      if (pts.length === 1) {
        ctx.arc(pts[0].x * w, pts[0].y * h, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.tool === TOOLS.ERASER ? 'black' : stroke.color;
        ctx.fill();
      } else {
        ctx.moveTo(pts[0].x * w, pts[0].y * h);
        for (let i = 1; i < pts.length; i++) {
          if (i < pts.length - 1) {
            const midX = (pts[i].x * w + pts[i + 1].x * w) / 2;
            const midY = (pts[i].y * h + pts[i + 1].y * h) / 2;
            ctx.quadraticCurveTo(pts[i].x * w, pts[i].y * h, midX, midY);
          } else {
            ctx.lineTo(pts[i].x * w, pts[i].y * h);
          }
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  const getCanvasPoint = (e) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  };

  const handlePointerDown = (e) => {
    if (!isActive || !hasStaffAccess) return;
    e.preventDefault();
    e.stopPropagation();
    const point = getCanvasPoint(e);
    if (!point) return;

    if (settings.tool === TOOLS.LINE) {
      if (!lineStart) {
        setLineStart(point);
      } else {
        // Second click: finalize line
        const stroke = {
          tool: TOOLS.LINE,
          color: settings.color,
          brushSize: settings.brushSize,
          opacity: settings.opacity,
          lineStyle: settings.lineStyle,
          points: [lineStart, point],
        };
        const newDrawings = [...drawingsRef.current, stroke];
        setUndoStack(prev => [...prev, drawingsRef.current]);
        setDrawings(newDrawings);
        setHasUnsavedChanges(true);
        setLineStart(null);
        const overlay = overlayCanvasRef.current;
        if (overlay) overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
      }
      return;
    }

    setIsDrawing(true);
    const newStroke = {
      tool: settings.tool,
      color: settings.color,
      brushSize: settings.brushSize,
      opacity: settings.opacity,
      lineStyle: settings.lineStyle,
      points: [point],
    };
    currentStrokeRef.current = newStroke;
    forceUpdate(n => n + 1);
  };

  const handlePointerMove = (e) => {
    if (!isActive) return;
    e.preventDefault();
    e.stopPropagation();
    const point = getCanvasPoint(e);
    if (!point) return;

    // Line tool preview
    if (settings.tool === TOOLS.LINE && lineStart) {
      const overlay = overlayCanvasRef.current;
      if (overlay) {
        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        renderStroke(ctx, {
          tool: TOOLS.LINE,
          color: settings.color,
          brushSize: settings.brushSize,
          opacity: settings.opacity,
          lineStyle: settings.lineStyle,
          points: [lineStart, point],
        }, overlay.width, overlay.height);
      }
      return;
    }

    if (!isDrawing || !currentStrokeRef.current) return;

    const newStroke = {
      ...currentStrokeRef.current,
      points: [...currentStrokeRef.current.points, point],
    };
    currentStrokeRef.current = newStroke;

    const overlay = overlayCanvasRef.current;
    if (overlay) {
      const ctx = overlay.getContext('2d');
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      renderStroke(ctx, newStroke, overlay.width, overlay.height);
    }
  };

  const handlePointerUp = (e) => {
    if (!isActive) return;
    e.preventDefault();
    e.stopPropagation();

    // Line tool handled in pointerDown (click-click)
    if (settings.tool === TOOLS.LINE) return;

    if (!isDrawing || !currentStrokeRef.current) return;

    const point = getCanvasPoint(e);
    const finalStroke = point
      ? { ...currentStrokeRef.current, points: [...currentStrokeRef.current.points, point] }
      : currentStrokeRef.current;

    const newDrawings = [...drawingsRef.current, finalStroke];
    setUndoStack(prev => [...prev, drawingsRef.current]);
    setDrawings(newDrawings);
    setHasUnsavedChanges(true);
    currentStrokeRef.current = null;
    setIsDrawing(false);

    const overlay = overlayCanvasRef.current;
    if (overlay) overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
  };

  const handleUndo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setDrawings(last);
      drawingsRef.current = last;
      setHasUnsavedChanges(true);
      return prev.slice(0, -1);
    });
  }, []);

  const handleClearAll = () => {
    if (drawingsRef.current.length === 0) return;
    setUndoStack(prev => [...prev, drawingsRef.current]);
    setDrawings([]);
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/drawings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', drawings: drawingsRef.current }),
      });
      if (res.ok) setHasUnsavedChanges(false);
    } catch {}
    setSaving(false);
  };

  const handleClearAndSave = async () => {
    setUndoStack(prev => [...prev, drawingsRef.current]);
    setDrawings([]);
    setSaving(true);
    try {
      await fetch('/api/drawings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' }),
      });
      setHasUnsavedChanges(false);
    } catch {}
    setSaving(false);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && lineStart) {
        setLineStart(null);
        const overlay = overlayCanvasRef.current;
        if (overlay) overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
    };
    if (isActive) {
      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
    }
  }, [isActive, lineStart, handleUndo]);

  const toolButtons = [
    { id: TOOLS.BRUSH, label: 'Brush', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z"/>
        <path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7"/>
        <path d="M14.5 17.5 4.5 15"/>
      </svg>
    )},
    { id: TOOLS.LINE, label: 'Line', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
        <line x1="5" y1="19" x2="19" y2="5"/>
      </svg>
    )},
    { id: TOOLS.ERASER, label: 'Eraser', icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/>
        <path d="M22 21H7"/>
        <path d="m5 11 9 9"/>
      </svg>
    )},
  ];

  // Toolbar rendered via portal into the toolbar container (outside zoom)
  const toolbar = isActive && toolbarContainerRef?.current ? createPortal(
    <div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[45] flex flex-col items-center gap-2"
      onPointerDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      {showSettings && (
        <div className="bg-[#1c1917]/95 backdrop-blur-md rounded-2xl border border-[#292524] p-4 shadow-2xl w-[320px] max-w-[90vw] space-y-4">
          {/* Color */}
          <div>
            <label className="text-[9px] text-[#78716c] uppercase font-black block mb-2 tracking-widest">Color</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setSettings(s => ({ ...s, color: c }))}
                  className={`w-7 h-7 rounded-lg border-2 transition-all hover:scale-110 active:scale-90 ${settings.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={settings.color}
                onChange={e => setSettings(s => ({ ...s, color: e.target.value }))}
                className="h-8 w-10 bg-black border border-[#292524] rounded-lg cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={settings.color}
                onChange={e => setSettings(s => ({ ...s, color: e.target.value }))}
                className="flex-grow bg-black border border-[#292524] rounded-lg p-2 text-xs text-[#e7e5e4] focus:border-amber-500/50 outline-none uppercase font-mono tracking-wider"
              />
            </div>
          </div>

          {/* Brush size */}
          <div>
            <label className="text-[9px] text-[#78716c] uppercase font-black block mb-2 tracking-widest">
              {settings.tool === TOOLS.ERASER ? 'Eraser' : 'Brush'} Size: {settings.brushSize}
            </label>
            <input
              type="range" min="1" max="30" step="1"
              value={settings.brushSize}
              onChange={e => setSettings(s => ({ ...s, brushSize: parseInt(e.target.value) }))}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-[8px] text-[#57534e] font-mono mt-1">
              <span>1</span><span>30</span>
            </div>
          </div>

          {/* Opacity */}
          <div>
            <label className="text-[9px] text-[#78716c] uppercase font-black block mb-2 tracking-widest">
              Opacity: {Math.round(settings.opacity * 100)}%
            </label>
            <input
              type="range" min="0.1" max="1" step="0.05"
              value={settings.opacity}
              onChange={e => setSettings(s => ({ ...s, opacity: parseFloat(e.target.value) }))}
              className="w-full accent-amber-500"
            />
          </div>

          {/* Line style */}
          <div>
            <label className="text-[9px] text-[#78716c] uppercase font-black block mb-2 tracking-widest">Line Style</label>
            <div className="flex gap-2">
              {[
                { id: 'solid', label: 'Solid' },
                { id: 'dashed', label: 'Dashed' },
                { id: 'dotted', label: 'Dotted' },
              ].map(ls => (
                <button
                  key={ls.id}
                  onClick={() => setSettings(s => ({ ...s, lineStyle: ls.id }))}
                  className={`flex-1 py-2 px-3 rounded-lg border text-[9px] font-bold uppercase tracking-wider transition-all
                    ${settings.lineStyle === ls.id
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-500'
                      : 'bg-black border-[#292524] text-[#78716c] hover:border-[#44403c]'
                    }`}
                >
                  {ls.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clear / Reset */}
          <div className="flex gap-2 pt-2 border-t border-[#292524]">
            <button
              onClick={handleClearAll}
              disabled={drawings.length === 0}
              className="flex-1 py-2.5 bg-red-900/20 text-red-500 rounded-xl border border-red-900/30 text-[9px] font-black uppercase tracking-widest hover:bg-red-900/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Clear Canvas
            </button>
            <button
              onClick={handleClearAndSave}
              disabled={drawings.length === 0 && !hasUnsavedChanges}
              className="flex-1 py-2.5 bg-red-900/20 text-red-400 rounded-xl border border-red-900/30 text-[9px] font-black uppercase tracking-widest hover:bg-red-900/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Reset & Save
            </button>
          </div>
        </div>
      )}

      {/* Main toolbar */}
      <div className="bg-[#1c1917]/95 backdrop-blur-md rounded-2xl border border-[#292524] p-2 shadow-2xl flex items-center gap-1.5">
        {toolButtons.map(tb => (
          <button
            key={tb.id}
            onClick={() => {
              setSettings(s => ({ ...s, tool: tb.id }));
              setLineStart(null);
              const overlay = overlayCanvasRef.current;
              if (overlay) overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
            }}
            className={`p-2.5 rounded-xl transition-all text-xs font-bold flex items-center gap-1.5
              ${settings.tool === tb.id
                ? 'bg-amber-500 text-black'
                : 'text-[#78716c] hover:text-white hover:bg-white/5'
              }`}
            title={tb.label}
          >
            {tb.icon}
            <span className="hidden sm:inline text-[9px] uppercase tracking-wider">{tb.label}</span>
          </button>
        ))}

        <div className="w-px h-6 bg-[#292524] mx-1" />

        {/* Color swatch */}
        <div
          className="w-7 h-7 rounded-lg border-2 border-white/20"
          style={{ backgroundColor: settings.tool === TOOLS.ERASER ? '#78716c' : settings.color, opacity: settings.opacity }}
        />

        {/* Settings */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`p-2.5 rounded-xl transition-all ${showSettings ? 'bg-white/10 text-white' : 'text-[#78716c] hover:text-white hover:bg-white/5'}`}
          title="Settings"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>

        <div className="w-px h-6 bg-[#292524] mx-1" />

        {/* Undo */}
        <button
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          className="p-2.5 rounded-xl text-[#78716c] hover:text-white hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo (Ctrl+Z)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
          </svg>
        </button>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving || !hasUnsavedChanges}
          className={`p-2.5 rounded-xl transition-all flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider
            ${hasUnsavedChanges
              ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30 border border-green-500/30'
              : 'text-[#78716c] hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed'
            }`}
          title="Save drawings"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save'}</span>
        </button>

        <div className="w-px h-6 bg-[#292524] mx-1" />

        {/* Close */}
        <button
          onClick={onClose}
          className="p-2.5 rounded-xl text-red-500 hover:bg-red-500/10 transition-all"
          title="Exit draw mode"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Status */}
      <div className="flex gap-2 items-center">
        {loading && (
          <span className="text-[9px] text-[#78716c] uppercase tracking-widest font-bold animate-pulse bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1">Loading drawings...</span>
        )}
        {lineStart && (
          <span className="text-[9px] text-amber-500 uppercase tracking-widest font-bold bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1">Click to place line endpoint (Esc to cancel)</span>
        )}
        {hasUnsavedChanges && !saving && (
          <span className="text-[9px] text-amber-500 uppercase tracking-widest font-bold bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1">Unsaved changes</span>
        )}
      </div>
    </div>,
    toolbarContainerRef.current
  ) : null;

  return (
    <>
      {/* Main canvas (persisted strokes) - always visible */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-[15]"
        style={{ pointerEvents: 'none', touchAction: 'none' }}
      />
      {/* Overlay canvas (live preview) - only interactive when drawing */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 z-[16]"
        style={{
          pointerEvents: isActive ? 'auto' : 'none',
          touchAction: 'none',
          cursor: isActive ? 'crosshair' : 'default',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={(e) => {
          if (isDrawing) handlePointerUp(e);
        }}
      />
      {toolbar}
    </>
  );
}
