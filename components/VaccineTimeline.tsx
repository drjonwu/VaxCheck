import React, { useMemo, useState, useRef, useLayoutEffect } from 'react';
import { VaccineDose, VaccineSeriesStatus, VaxStatus, ForecastDose } from '../types';
import { Info, Check, AlertCircle, AlertTriangle, X, Clock } from 'lucide-react';

interface VaccineTimelineProps {
  history: VaccineDose[];
  gapAnalysis: VaccineSeriesStatus[];
  forecast: ForecastDose[];
  dob: Date;
  onSeriesClick: (seriesName: string) => void;
}

// Visual Constants
const PIXELS_PER_MONTH = 40; // Increased density for better separation and scroll range
const MIN_CHART_WIDTH = 1200;

const VaccineTimeline: React.FC<VaccineTimelineProps> = ({ 
  history, 
  gapAnalysis, 
  forecast, 
  dob, 
  onSeriesClick 
}) => {
  const [hoveredItem, setHoveredItem] = useState<{ x: number, y: number, data: any } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 1. Prepare Data & Date Ranges
  const { seriesRows, minDate, maxDate, totalMonths, dobTime, todayTime } = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const todayTime = today.getTime();
    const dobTime = dob.getTime();

    // Collect all relevant dates to determine bounds
    const allDates = [
        dobTime, 
        todayTime,
        ...history.map(d => d.dateAdministered.getTime()),
        ...gapAnalysis.map(g => g.nextDoseDue?.getTime() || 0).filter(d => d > 0),
        ...forecast.map(f => f.dueDate.getTime())
    ];

    let minTime = Math.min(...allDates);
    let maxTime = Math.max(...allDates);

    const ONE_MONTH_MS = 2629800000;
    
    // Pad the timeline: Start 6 months before earliest event (or DOB) for context
    minTime = Math.min(minTime, dobTime) - (ONE_MONTH_MS * 6);
    
    // Fix: Allow scrolling significantly into the future (10 years / 120 months) from today
    // Increased pixel density combined with this range enables the "scroll into future" behavior.
    maxTime = Math.max(maxTime, todayTime + (ONE_MONTH_MS * 120)); 
    
    // Add end padding
    maxTime += (ONE_MONTH_MS * 6); 

    const totalDurationMs = maxTime - minTime;
    const totalMonths = totalDurationMs / ONE_MONTH_MS;

    // Structure Data Rows
    // gapAnalysis is already sorted in App.tsx, we respect that order.
    const seriesRows = gapAnalysis.map(series => {
        const seriesName = series.seriesName;
        const events: any[] = [];

        // History
        history.filter(h => h.vaccineCode === seriesName).forEach(h => {
            events.push({
                type: 'HISTORY',
                date: h.dateAdministered,
                status: 'ADMINISTERED',
                doseNumber: null,
                details: 'Administered',
                series: seriesName
            });
        });

        // Current Status (Next Due or Complete)
        // Show status for all actionable OR completed series to ensure icons appear
        const isStatusVisible = 
            series.status === VaxStatus.COMPLETE || 
            series.status === VaxStatus.UP_TO_DATE ||
            series.status === VaxStatus.CONTRAINDICATED ||
            series.status === VaxStatus.DUE_NOW ||
            series.status === VaxStatus.OVERDUE ||
            series.status === VaxStatus.FUTURE;

        if (isStatusVisible) {
             // If no nextDoseDue (e.g. Complete), anchor to Today for visualization
             const anchorDate = series.nextDoseDue || new Date(); 
             
             // Dedupe: Don't show status if it overlaps exactly with a forecast (unlikely for complete, but possible for future)
             const isDuplicate = events.some(e => 
                (e.type === 'FORECAST' || e.type === 'STATUS') && Math.abs(e.date.getTime() - anchorDate.getTime()) < 86400000
             );

             if (!isDuplicate) {
                 events.push({
                     type: 'STATUS',
                     date: anchorDate,
                     status: series.status,
                     doseNumber: series.dosesAdministered + (series.status === VaxStatus.COMPLETE ? 0 : 1),
                     details: series.reason,
                     series: seriesName
                 });
             }
        }

        // Forecast
        forecast.filter(f => f.seriesName === seriesName).forEach(f => {
            // Dedupe: Don't show forecast if it matches the "Next Due" exactly
            const isDuplicate = events.some(e => 
                e.type === 'STATUS' && Math.abs(e.date.getTime() - f.dueDate.getTime()) < 86400000
            );
            if (!isDuplicate) {
                events.push({
                    type: 'FORECAST',
                    date: f.dueDate,
                    status: VaxStatus.FUTURE,
                    doseNumber: f.doseNumber,
                    details: 'Projected',
                    series: seriesName
                });
            }
        });

        return { name: seriesName, events };
    });

    return { seriesRows, minDate: minTime, maxDate: maxTime, totalMonths, dobTime, todayTime };
  }, [history, gapAnalysis, forecast, dob]);

  // 2. Timeline Geometry Helper
  const chartWidth = Math.max(MIN_CHART_WIDTH, totalMonths * PIXELS_PER_MONTH);

  const getLeftPos = (date: Date | number) => {
    const time = date instanceof Date ? date.getTime() : date;
    const percentage = (time - minDate) / (maxDate - minDate);
    return `${percentage * 100}%`;
  };

  // 3. Auto-Snap to Today Logic
  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    
    const scrollToToday = () => {
        if (!scrollContainer) return;
        
        const containerWidth = scrollContainer.clientWidth;
        if (containerWidth === 0) return;

        const todayPercentage = (todayTime - minDate) / (maxDate - minDate);
        
        const sidebarWidth = 144;
        const trackWidth = chartWidth - sidebarWidth;
        const todayX = sidebarWidth + (todayPercentage * trackWidth);

        const centerOffset = containerWidth / 2;
        const targetScroll = todayX - centerOffset;
        
        scrollContainer.scrollLeft = Math.max(0, targetScroll);
    };

    scrollToToday();
    const rafId = requestAnimationFrame(scrollToToday);
    const t1 = setTimeout(scrollToToday, 50);
    const t2 = setTimeout(scrollToToday, 350); 

    return () => {
        cancelAnimationFrame(rafId);
        clearTimeout(t1);
        clearTimeout(t2);
    };
  }, [minDate, maxDate, chartWidth, todayTime]);

  // 4. Generate Axis Ticks (Years & Age Milestones)
  const axisTicks = useMemo(() => {
    const ticks: { label: string, left: string, type: 'year' | 'age' }[] = [];
    const minD = new Date(minDate);
    const maxD = new Date(maxDate);
    
    for (let y = minD.getFullYear(); y <= maxD.getFullYear(); y++) {
        const d = new Date(y, 0, 1);
        if (d.getTime() >= minDate && d.getTime() <= maxDate) {
            ticks.push({ label: y.toString(), left: getLeftPos(d), type: 'year' });
        }
    }

    const milestones = [2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60, 72, 84, 96, 108, 120, 132, 144, 156, 168, 180, 192];
    milestones.forEach(m => {
        const d = new Date(dobTime);
        d.setMonth(d.getMonth() + m);
        if (d.getTime() >= minDate && d.getTime() <= maxDate) {
            const label = m < 24 ? `${m}m` : `${Math.floor(m/12)}y`;
            ticks.push({ label, left: getLeftPos(d), type: 'age' });
        }
    });

    return ticks;
  }, [minDate, maxDate, dobTime]);

  // 5. Interaction Handlers
  const handleInteraction = (e: React.MouseEvent | React.FocusEvent, item: any) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
        // For focus events (keyboard), center tooltip on element if not using mouse coordinates
        let clientX = (e as React.MouseEvent).clientX;
        let clientY = (e as React.MouseEvent).clientY;

        if (e.type === 'focus') {
             const targetRect = (e.target as HTMLElement).getBoundingClientRect();
             clientX = targetRect.left + (targetRect.width / 2);
             clientY = targetRect.top + (targetRect.height / 2);
        }

        setHoveredItem({
            x: clientX - rect.left,
            y: clientY - rect.top,
            data: item
        });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
        case VaxStatus.COMPLETE: return 'bg-emerald-500 border-emerald-500';
        case VaxStatus.UP_TO_DATE: return 'bg-emerald-500 border-emerald-500'; // Using emerald for compliant to match design
        case VaxStatus.DUE_NOW: return 'bg-amber-500 border-amber-500';
        case VaxStatus.OVERDUE: return 'bg-red-500 border-red-500';
        case VaxStatus.FUTURE: return 'bg-white border-slate-300';
        case VaxStatus.CONTRAINDICATED: return 'bg-purple-500 border-purple-500';
        case 'ADMINISTERED': return 'bg-emerald-600 border-emerald-600';
        default: return 'bg-slate-300 border-slate-300';
    }
  };

  const getEventIcon = (event: any) => {
      if (event.type === 'HISTORY') return null; // Simple dot for history
      if (event.type === 'FORECAST') return null; // Number for forecast

      switch (event.status) {
          case VaxStatus.COMPLETE: 
          case VaxStatus.UP_TO_DATE: return Check;
          case VaxStatus.DUE_NOW: return AlertTriangle;
          case VaxStatus.OVERDUE: return AlertCircle;
          case VaxStatus.CONTRAINDICATED: return X;
          case VaxStatus.FUTURE: return Clock;
          default: return null;
      }
  };

  return (
    <div ref={containerRef} className="relative w-full h-[320px] bg-slate-50 flex flex-col select-none">
      
      {/* Scrollable Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden relative scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div 
            className="relative h-full border-l border-slate-200 bg-[linear-gradient(90deg,transparent_0%,transparent_95%,rgba(0,0,0,0.02)_100%)] bg-[length:100px_100%]"
            style={{ width: chartWidth }}
        >
            {/* Sidebar (Sticky) */}
            <div className="absolute left-0 top-0 bottom-0 w-36 bg-slate-50 border-r border-slate-200 z-10 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.1)] sticky" style={{ left: 0 }}>
                 <div className="h-8 border-b border-slate-200 bg-slate-100/50 backdrop-blur"></div>
                 {seriesRows.map((row, i) => (
                     <div 
                        key={row.name} 
                        className="h-10 flex items-center px-4 text-xs font-bold text-slate-600 border-b border-slate-100 hover:bg-slate-100 cursor-pointer truncate"
                        onClick={() => onSeriesClick(row.name)}
                        title={row.name}
                     >
                         {row.name}
                     </div>
                 ))}
            </div>

            {/* Grid & Axis */}
            <div className="absolute inset-0 ml-36">
                 {/* Current Day Line */}
                 <div 
                    className="absolute top-0 bottom-0 border-l-2 border-dashed border-blue-400 z-0 pointer-events-none"
                    style={{ left: getLeftPos(todayTime) }}
                 >
                    <div className="absolute -top-1 -left-1.5 w-3 h-3 bg-blue-400 rounded-full" />
                 </div>

                 {/* Axis Ticks */}
                 <div className="h-8 border-b border-slate-200 relative bg-slate-50/80">
                     {axisTicks.map((tick, i) => (
                         <div key={i} className="absolute bottom-0 border-l border-slate-300 h-2" style={{ left: tick.left }}>
                             <span className={`absolute -translate-x-1/2 text-[10px] font-medium whitespace-nowrap ${
                                 tick.type === 'year' 
                                 ? 'top-0 text-slate-600 font-bold' 
                                 : 'top-3.5 text-slate-400'
                             }`}>
                                 {tick.label}
                             </span>
                         </div>
                     ))}
                 </div>

                 {/* Rows */}
                 <div className="relative">
                    {seriesRows.map((row, i) => (
                        <div key={row.name} className="h-10 border-b border-slate-100 relative group">
                            {/* Hover Track Highlight */}
                            <div className="absolute inset-0 hover:bg-slate-100/50 transition-colors pointer-events-none" />
                            
                            {row.events.map((event, idx) => {
                                const left = getLeftPos(event.date);
                                const color = getStatusColor(event.status);
                                const Icon = getEventIcon(event);
                                
                                // Dynamic classes based on type
                                let markerClass = `absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full border-2 shadow-sm cursor-pointer hover:scale-125 transition-transform z-10 ${color}`;
                                let content = null;

                                if (event.type === 'HISTORY') {
                                    markerClass += " w-3 h-3 bg-emerald-600 border-white";
                                } else if (event.type === 'FORECAST') {
                                    markerClass += " w-6 h-6 bg-white border-dashed text-slate-400 text-[9px] font-bold";
                                    content = event.doseNumber;
                                } else {
                                    // Status Icons
                                    markerClass += " w-6 h-6 border-white text-white";
                                }

                                return (
                                    <div 
                                        key={idx}
                                        className={markerClass}
                                        style={{ left }}
                                        onMouseEnter={(e) => handleInteraction(e, event)}
                                        onFocus={(e) => handleInteraction(e, event)}
                                        onMouseLeave={() => setHoveredItem(null)}
                                        tabIndex={0}
                                        aria-label={`${event.series} ${event.details}`}
                                    >
                                        {Icon && <Icon size={12} strokeWidth={3} />}
                                        {content}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                 </div>
            </div>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredItem && (
          <div 
            className="absolute z-50 bg-slate-900 text-white text-xs rounded px-3 py-2 shadow-xl pointer-events-none"
            style={{ 
                left: Math.min(containerRef.current!.offsetWidth - 160, hoveredItem.x + 10), 
                top: Math.min(containerRef.current!.offsetHeight - 60, hoveredItem.y + 10)
            }}
          >
              <div className="font-bold mb-1 flex items-center gap-2">
                  <Info size={12} className="text-emerald-400" />
                  {hoveredItem.data.series}
              </div>
              <div className="text-slate-300 mb-0.5">
                  {hoveredItem.data.date.toLocaleDateString()}
              </div>
              <div className="capitalize font-medium text-slate-100">
                  {hoveredItem.data.details}
              </div>
          </div>
      )}
    </div>
  );
};

export default VaccineTimeline;