import { Routes, Route } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import MusicHome from "./components/dashboard/MusicHome";
import NowPlaying from "./components/dashboard/NowPlaying";
import SearchPage from "./components/dashboard/SearchPage";
import PlaylistBrowser from "./components/dashboard/PlaylistBrowser";
import PlaylistDetail from "./components/dashboard/PlaylistDetail";
import DailyRecommend from "./components/dashboard/DailyRecommend";
import LikedSongs from "./components/dashboard/LikedSongs";
import QueueView from "./components/dashboard/QueueView";
import StyleAnalyzer from "./components/dashboard/StyleAnalyzer";
import PersonalizedPlaylists from "./components/dashboard/PersonalizedPlaylists";
import SettingsPage from "./components/dashboard/SettingsPage";
import QQPlaylistDetail from "./components/dashboard/QQPlaylistDetail";
import { useTheme } from "./hooks/useTheme";

export default function App() {
  useTheme();
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<MusicHome />} />
        <Route path="/now-playing" element={<NowPlaying />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/playlists" element={<PlaylistBrowser />} />
        <Route path="/playlist/:id" element={<PlaylistDetail />} />
        <Route path="/qq/playlist/:id" element={<QQPlaylistDetail />} />
        <Route path="/daily" element={<DailyRecommend />} />
        <Route path="/liked" element={<LikedSongs />} />
        <Route path="/queue" element={<QueueView />} />
        <Route path="/analyze" element={<StyleAnalyzer />} />
        <Route path="/personalized" element={<PersonalizedPlaylists />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </AppLayout>
  );
}
