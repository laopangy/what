import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import NowPlaying from "./components/dashboard/NowPlaying";
import SearchPage from "./components/dashboard/SearchPage";
import PlaylistBrowser from "./components/dashboard/PlaylistBrowser";
import PlaylistDetail from "./components/dashboard/PlaylistDetail";
import DailyRecommend from "./components/dashboard/DailyRecommend";
import LikedSongs from "./components/dashboard/LikedSongs";
import QueueView from "./components/dashboard/QueueView";
import { useTheme } from "./hooks/useTheme";

export default function App() {
  useTheme();
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/now-playing" replace />} />
        <Route path="/now-playing" element={<NowPlaying />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/playlists" element={<PlaylistBrowser />} />
        <Route path="/playlist/:id" element={<PlaylistDetail />} />
        <Route path="/daily" element={<DailyRecommend />} />
        <Route path="/liked" element={<LikedSongs />} />
        <Route path="/queue" element={<QueueView />} />
      </Routes>
    </AppLayout>
  );
}
