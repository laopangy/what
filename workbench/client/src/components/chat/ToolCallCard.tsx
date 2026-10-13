import { useState } from "react";
import {
  Activity, BookOpen, CalendarClock, ChevronDown, ChevronUp, Clock, Dumbbell, ExternalLink, Flame, History,
  ListChecks, ListMusic, Mountain, Music, NotebookPen, Pause, Play, Plus, Power, QrCode, Route, Salad, Scale,
  Search, SkipBack, SkipForward, Timer, User, Utensils, Volume2, Zap, type LucideIcon,
} from "lucide-react";
import type { ToolCall } from "../../types/chat";
import ConfirmActionCard from "./ConfirmActionCard";

const TOOL_ICONS: Record<string, LucideIcon> = {
  search_songs: Search, search_playlists: Search,
  play_song: Play, play_playlist: Play, resume: Play, pause: Pause, stop: Pause,
  next_track: SkipForward, prev_track: SkipBack, set_volume: Volume2, seek: Clock,
  get_playback_state: Music, get_queue: ListMusic, clear_queue: ListMusic, add_to_queue: Plus,
  get_user_profile: User, get_login_qr: QrCode,
  fitness_today: Flame, fitness_history: Activity, fitness_plan: ListChecks, fitness_estimate_food: Salad,
  fitness_log_meal: Utensils, fitness_delete_meal: Utensils, fitness_log_weight: Scale, fitness_log_workout: Dumbbell,
  timer_list: Timer, timer_history: History, timer_toggle: Power, timer_trigger: Play,
  outdoor_list_journeys: Mountain, outdoor_get_journey: Route, outdoor_sync_calendar: CalendarClock,
  journal_list: BookOpen, journal_read: BookOpen, journal_write: NotebookPen,
  open_module: ExternalLink,
};

const summaryOf = ({ name, args, result }: ToolCall) => {
  if (name === "open_module" && result && typeof result === "object") {
    const page = (result as Record<string, unknown>).page;
    if (typeof page === "string") return page;
  }
  return Object.values(args).find((value): value is string => typeof value === "string" && value.length > 0);
};

export default function ToolCallCard({ messageId, toolCall }: { messageId: string; toolCall: ToolCall }) {
  const [open, setOpen] = useState(false);
  const Icon = TOOL_ICONS[toolCall.name] ?? Zap;
  const summary = summaryOf(toolCall);

  return (
    <div className="mb-1.5 text-xs">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-accent/[0.07] border border-accent/20 text-accent-dim hover:bg-accent/[0.11] hover:border-accent/30 smooth group"
      >
        <Icon className="w-3 h-3 text-accent-dim/70 group-hover:text-accent-dim smooth" />
        <span className="font-medium">{toolCall.label ?? toolCall.name}</span>
        {summary && <span className="text-text-dim/50 truncate max-w-[160px]">· {summary}</span>}
        <span className="ml-auto text-accent-dim/40">
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </span>
      </button>
      {open && toolCall.result !== undefined && (
        <pre className="mt-1.5 p-3 rounded-lg bg-bg/70 border border-border/60 text-[10px] text-text-dim overflow-auto max-h-40 leading-relaxed">
          {JSON.stringify(toolCall.result, null, 2)}
        </pre>
      )}
      {toolCall.confirmation && <ConfirmActionCard messageId={messageId} confirmation={toolCall.confirmation} />}
    </div>
  );
}
