"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Video, VideoOff } from "lucide-react";

interface ExerciseSet {
  weight: number;
  reps: number;
  completed: boolean;
}

interface ExerciseCardProps {
  name: string;
  muscleGroup: string;
  targetSets: number;
  targetReps: string;
  previousWeight?: number;
  suggestedWeight?: number;
  sets: ExerciseSet[];
  youtubeId?: string;
  onLogSet: (setIndex: number, weight: number, reps: number) => void;
  onToggleSet: (setIndex: number) => void;
}

export default function ExerciseCard({
  name,
  muscleGroup,
  targetSets,
  targetReps,
  previousWeight,
  suggestedWeight,
  sets,
  youtubeId,
  onLogSet,
  onToggleSet,
}: ExerciseCardProps) {
  const [showVideo, setShowVideo] = useState(false);
  const completedSets = sets.filter((s) => s.completed).length;
  const allDone = completedSets === targetSets;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className={`glass-card p-4 transition-all duration-300 ${allDone ? "border-[#8ba893]/30" : ""}`}
      style={allDone ? { background: "rgba(139,168,147,0.04)" } : {}}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="text-left flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{name}</h3>
            {youtubeId && (
              <button 
                type="button"
                onClick={() => setShowVideo(!showVideo)}
                className="text-zinc-500 hover:text-[#8ba893] transition-colors p-0.5 cursor-pointer flex items-center justify-center rounded hover:bg-white/5"
                title={showVideo ? "Hide Form Video" : "Watch Form Video"}
              >
                {showVideo ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">{muscleGroup} · {targetSets}×{targetReps}</p>
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          {Array.from({ length: targetSets }).map((_, i) => (
            <motion.div
              key={i}
              animate={{ 
                scale: i < completedSets ? [1, 1.3, 1] : 1,
                backgroundColor: i < completedSets ? "#8ba893" : "rgba(255,255,255,0.12)"
              }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className="w-2 h-2 rounded-full"
              style={{
                boxShadow: i < completedSets ? "0 0 6px rgba(139,168,147,0.5)" : "none",
              }}
            />
          ))}
        </div>
      </div>

      {/* Video Embed */}
      {showVideo && youtubeId && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mb-3 rounded-xl overflow-hidden border border-white/10 p-2 bg-white/5 space-y-2"
        >
          <iframe
            className="w-full aspect-video rounded-lg"
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title={`${name} Form Video`}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
          <a
            href={`https://www.youtube.com/watch?v=${youtubeId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full py-1.5 text-[10px] text-zinc-400 hover:text-white transition-colors bg-white/5 rounded-lg hover:bg-white/10 font-medium"
          >
            <span>Can't view? Open on YouTube ↗</span>
          </a>
        </motion.div>
      )}

      {/* Progressive overload hint */}
      {suggestedWeight && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mb-3 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 overflow-hidden"
          style={{ background: "rgba(139,168,147,0.08)", border: "1px solid rgba(139,168,147,0.15)" }}
        >
          <span className="text-[#8ba893]">↑</span>
          <span className="text-zinc-400">Suggested: <span className="text-[#8ba893] font-semibold">{suggestedWeight}kg</span></span>
          {previousWeight && <span className="text-zinc-600 ml-auto">prev {previousWeight}kg</span>}
        </motion.div>
      )}

      {/* Sets */}
      <div className="space-y-2">
        {sets.map((set, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-zinc-600 w-6">#{i + 1}</span>
            <input
              type="number"
              placeholder="kg"
              value={set.weight || ""}
              onChange={(e) => onLogSet(i, parseFloat(e.target.value), set.reps)}
              className="input-glass text-center h-9 text-xs flex-1"
            />
            <input
              type="number"
              placeholder={targetReps.replace(/[^0-9\-]/g, "").split("-")[0] || "10"}
              value={set.reps || ""}
              onChange={(e) => onLogSet(i, set.weight, parseInt(e.target.value))}
              className="input-glass text-center h-9 text-xs flex-1"
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => onToggleSet(i)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0 cursor-pointer ${
                set.completed
                  ? "text-white"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
              style={set.completed ? { background: "#8ba893", boxShadow: "0 0 12px rgba(139,168,147,0.3)" } : { background: "rgba(255,255,255,0.06)" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
            </motion.button>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
