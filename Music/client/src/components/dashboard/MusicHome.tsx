import { useLocation } from "react-router-dom";
import { usePlaybackStore } from "../../stores/playbackStore";
import NowPlaying from "./NowPlaying";
import HomePage from "./HomePage";

/** Smart home: show player when active, dashboard otherwise.
 *  Clicking 首页 button passes forceHome state to always show dashboard. */
export default function MusicHome() {
  const playing = usePlaybackStore((s) => s.playing);
  const songName = usePlaybackStore((s) => s.song?.name);
  const location = useLocation();
  const forceHome = (location.state as { forceHome?: number })?.forceHome;

  // If user explicitly clicked 首页, always show dashboard
  if (forceHome) return <HomePage />;

  return (playing || !!songName) ? <NowPlaying /> : <HomePage />;
}
