import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Music,
  Tag,
  Smile,
  Clock,
  Languages,
  Heart,
  CheckCircle,
  Plus,
  ChevronRight,
  ArrowLeft,
  Search,
  User,
  X,
  Users,
  Layers,
} from "lucide-react";
import { playlistApi, analyzeApi, userApi } from "../../api/client";
import { onSocketEvent } from "../../api/socket";
import LoadingSpinner from "../shared/LoadingSpinner";
import EmptyState from "../shared/EmptyState";
import type { Playlist } from "../../types/ncm";

// ── types ──

interface PlaylistWithSelect extends Playlist {
  selected: boolean;
}

type PageState = "select" | "analyzing" | "results" | "generated";

interface AnalysisData {
  styleProfile: string;
  tasteClusters: { name: string; percentage: number; description: string; keyArtists: string[] }[];
  genreTags: string[];
  moodTags: string[];
  eraTags: string[];
  languageTags: string[];
  favoritePatterns: string;
  recommendedSongs: { id: string; name: string; artist: string; album: string }[];
  totalSongs: number;
  analyzedSongs: number;
  sampled: boolean;
  filteredLikedSongs: number;
}

// ── component ──

export default function StyleAnalyzer() {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>("select");
  const [playlists, setPlaylists] = useState<PlaylistWithSelect[]>([]);
  const [tab, setTab] = useState<"created" | "collected">("created");
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playlistName, setPlaylistName] = useState("");
  const [showNameInput, setShowNameInput] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedId, setGeneratedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"mine" | "friend">("mine");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { userId: string; nickname: string; avatarUrl: string; followeds: number; signature: string }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [friendUid, setFriendUid] = useState<string | null>(null);
  const [friendNickname, setFriendNickname] = useState<string | null>(null);
  const [follows, setFollows] = useState<
    { userId: string; nickname: string; avatarUrl: string; followeds: number; signature: string }[]
  >([]);
  const [loadingFollows, setLoadingFollows] = useState(false);
  const [progress, setProgress] = useState<{
    phase: string; current: number; total: number; message: string;
    analyzedSoFar?: number; totalSongs?: number;
  } | null>(null);

  // ── fetch playlists ──

  useEffect(() => {
    setLoadingPlaylists(true);
    setError(null);
    const uid = mode === "friend" ? friendUid ?? undefined : undefined;
    const fetcher = tab === "created" ? playlistApi.created : playlistApi.collected;
    fetcher(50, uid)
      .then((res) => {
        const pls = extractPlaylists(res.data);
        setPlaylists(pls.map((p) => ({ ...p, selected: false })));
      })
      .catch(() => setError("获取歌单失败，请检查登录状态"))
      .finally(() => setLoadingPlaylists(false));
  }, [tab, mode, friendUid]);

  // ── selection helpers ──

  const togglePlaylist = useCallback((id: string) => {
    setPlaylists((prev) =>
      prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p))
    );
  }, []);

  const selectedCount = playlists.filter((p) => p.selected).length;
  const selectAll = () => setPlaylists((prev) => prev.map((p) => ({ ...p, selected: true })));
  const deselectAll = () => setPlaylists((prev) => prev.map((p) => ({ ...p, selected: false })));

  // ── analyze ──

  const handleAnalyze = async () => {
    const selectedIds = playlists.filter((p) => p.selected).map((p) => p.id);
    if (selectedIds.length === 0) return;
    setPageState("analyzing");
    setError(null);
    setProgress(null);
    try {
      const res = await analyzeApi.style(selectedIds);
      if (res.success && res.data) {
        setAnalysis(res.data);
        setPageState("results");
      } else {
        setError(res.error || "分析失败");
        setPageState("select");
      }
    } catch (e) {
      setError(`分析失败: ${(e as Error).message}`);
      setPageState("select");
    }
  };

  // ── generate playlist ──

  const handleGenerate = async () => {
    if (!playlistName.trim() || !analysis) return;
    setGenerating(true);
    try {
      const res = await analyzeApi.generatePlaylist(
        playlistName.trim(),
        analysis.recommendedSongs.map((s) => s.id)
      );
      if (res.success && res.data) {
        setGeneratedId(res.data.playlistId);
        setPageState("generated");
      } else {
        setError(res.error || "生成歌单失败");
      }
    } catch (e) {
      setError(`生成歌单失败: ${(e as Error).message}`);
    } finally {
      setGenerating(false);
    }
  };

  // ── reset ──

  const reset = () => {
    setPageState("select");
    setAnalysis(null);
    setError(null);
    setShowNameInput(false);
    setPlaylistName("");
    setGeneratedId(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  // ── load follows ──

  useEffect(() => {
    if (mode !== "friend" || friendUid) return;
    setLoadingFollows(true);
    userApi.follows(100)
      .then((res) => {
        if (res.success && res.data) setFollows(res.data.users);
      })
      .catch(() => {})
      .finally(() => setLoadingFollows(false));
  }, [mode, friendUid]);

  // ── listen for analysis progress via WebSocket ──

  useEffect(() => {
    const unsub = onSocketEvent("analysis:progress", (data) => {
      setProgress(data as { phase: string; current: number; total: number; message: string });
    });
    return unsub;
  }, []);

  // ── friend search ──

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const res = await userApi.search(searchQuery.trim());
      if (res.success && res.data) {
        setSearchResults(res.data);
      }
    } catch {
      setError("搜索用户失败");
    } finally {
      setSearching(false);
    }
  };

  const selectFriend = (uid: string, nickname: string) => {
    setFriendUid(uid);
    setFriendNickname(nickname);
    setSearchResults([]);
    setSearchQuery("");
  };

  const clearFriend = () => {
    setFriendUid(null);
    setFriendNickname(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  const tabs = [
    { key: "created" as const, label: "创建的歌单" },
    { key: "collected" as const, label: "收藏的歌单" },
  ];

  // ── render: select ──

  if (pageState === "select") {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent" />
              风格分析
            </h1>
            <p className="text-sm text-text-dim mt-1">
              AI 分析歌单，发现音乐品味，生成精选歌单
            </p>
          </div>
        </div>

        {/* mode toggle */}
        <div className="flex gap-1 p-1 rounded-2xl bg-surface-raised border border-accent/10 w-fit">
          <button
            onClick={() => { setMode("mine"); clearFriend(); }}
            className={`px-4 py-2 rounded-xl text-sm smooth ${
              mode === "mine"
                ? "bg-accent text-white shadow-sm"
                : "text-text-dim hover:text-text"
            }`}
          >
            <User className="w-3.5 h-3.5 inline mr-1.5" />
            我的歌单
          </button>
          <button
            onClick={() => setMode("friend")}
            className={`px-4 py-2 rounded-xl text-sm smooth ${
              mode === "friend"
                ? "bg-accent text-white shadow-sm"
                : "text-text-dim hover:text-text"
            }`}
          >
            <Users className="w-3.5 h-3.5 inline mr-1.5" />
            好友歌单
          </button>
        </div>

        {/* friend search */}
        {mode === "friend" && (
          <div className="space-y-3">
            {friendNickname ? (
              /* friend selected */
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-accent/5 border border-accent/20">
                <User className="w-4 h-4 text-accent" />
                <span className="text-sm font-medium text-text">{friendNickname} 的歌单</span>
                <button
                  onClick={clearFriend}
                  className="ml-auto p-1 rounded-lg hover:bg-accent/10 text-text-dim hover:text-text smooth"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div>
                {/* follows list — quick select */}
                {!searchQuery && !searchResults.length && (
                  <div className="mb-3">
                    {loadingFollows ? (
                      <div className="flex justify-center py-4">
                        <LoadingSpinner />
                      </div>
                    ) : follows.length > 0 ? (
                      <div>
                        <p className="text-xs text-text-dim mb-2 font-medium">你的关注</p>
                        <div className="flex flex-wrap gap-2">
                          {follows.map((user) => (
                            <button
                              key={user.userId}
                              onClick={() => selectFriend(user.userId, user.nickname)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-raised border border-accent/10 hover:border-accent/30 smooth"
                            >
                              <div className="w-5 h-5 rounded-full bg-accent/10 overflow-hidden flex-shrink-0">
                                {user.avatarUrl ? (
                                  <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <User className="w-3 h-3 m-auto text-text-dim/30" />
                                )}
                              </div>
                              <span className="text-xs text-text">{user.nickname}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-text-dim/50 text-center py-2">暂无关注用户</p>
                    )}
                  </div>
                )}

                {/* search divider */}
                {follows.length > 0 && !searchQuery && !searchResults.length && (
                  <p className="text-xs text-text-dim/40 mb-2">或搜索其他用户</p>
                )}

                {/* search input */}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-dim/50" />
                    <input
                      type="text"
                      placeholder="输入好友的网易云昵称…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-surface-raised border border-accent/10 text-text text-sm outline-none focus:border-accent/30 smooth"
                    />
                  </div>
                  <button
                    onClick={handleSearch}
                    disabled={!searchQuery.trim() || searching}
                    className={`px-5 py-2.5 rounded-2xl text-sm font-medium smooth flex items-center gap-1.5 ${
                      searchQuery.trim()
                        ? "bg-accent text-white hover:bg-accent-dim active:scale-95"
                        : "bg-surface-raised text-text-dim/50 cursor-not-allowed"
                    }`}
                  >
                    {searching ? <LoadingSpinner /> : <Search className="w-4 h-4" />}
                    搜索
                  </button>
                </div>

                {/* search results */}
                {searchResults.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-accent/10 bg-surface overflow-hidden divide-y divide-accent/5">
                    {searchResults.map((user) => (
                      <button
                        key={user.userId}
                        onClick={() => selectFriend(user.userId, user.nickname)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/5 smooth text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-accent/10 overflow-hidden flex-shrink-0">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 m-auto text-text-dim/30" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text truncate">{user.nickname}</p>
                          <p className="text-xs text-text-dim truncate">
                            {user.signature || "暂无签名"}
                            {user.followeds > 0 ? ` · ${user.followeds} 粉丝` : ""}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-dim/30" />
                      </button>
                    ))}
                  </div>
                )}

                {/* no results after search */}
                {searchResults.length === 0 && searchQuery && !searching && (
                  <p className="text-xs text-text-dim/50 text-center mt-3">
                    未找到匹配的用户，试试其他关键词
                  </p>
                )}
              </div>
            )}

            {/* show prompt only if no follows, no search active, no results */}
            {!friendUid && !searchResults.length && !searchQuery && follows.length === 0 && !loadingFollows && (
              <div className="flex flex-col items-center py-8 text-center text-text-dim/50">
                <Users className="w-8 h-8 mb-2" />
                <p className="text-sm">搜索好友昵称，查看并分析他的歌单</p>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* tab switcher (only show when playlists available) */}
        {(mode === "mine" || friendUid) && (
          <div className="flex gap-1">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-5 py-2 rounded-2xl text-sm smooth ${
                  tab === key
                    ? "bg-accent/15 text-accent-dim font-medium border border-accent/20"
                    : "text-text-dim hover:text-text border border-transparent"
                }`}
              >
                {label}
              </button>
            ))}
            <div className="flex-1" />
            {playlists.length > 0 && (
              <button
                onClick={selectedCount === playlists.length ? deselectAll : selectAll}
                className="px-4 py-2 text-sm text-text-dim hover:text-text smooth"
              >
                {selectedCount === playlists.length && playlists.length > 0
                  ? "取消全选"
                  : "全选"}
              </button>
            )}
          </div>
        )}

        {/* playlist grid */}
        {loadingPlaylists ? (
          <LoadingSpinner />
        ) : playlists.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={() => togglePlaylist(pl.id)}
                  className={`relative text-left rounded-2xl overflow-hidden smooth border-2 ${
                    pl.selected
                      ? "border-accent shadow-lg shadow-accent/20 scale-[1.02]"
                      : "border-transparent hover:border-accent/30"
                  }`}
                >
                  {/* cover */}
                  <div className="aspect-square bg-surface-raised">
                    {pl.coverUrl ? (
                      <img
                        src={pl.coverUrl}
                        alt={pl.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-dim/20">
                        <Music className="w-10 h-10" />
                      </div>
                    )}
                  </div>
                  {/* info */}
                  <div className="p-2.5 bg-surface/90 backdrop-blur">
                    <p className="text-sm font-medium text-text truncate">{pl.name}</p>
                    <p className="text-xs text-text-dim mt-0.5">
                      {pl.trackCount ?? "?"} 首
                    </p>
                  </div>
                  {/* check overlay */}
                  {pl.selected && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* analyze button */}
            <div className="flex justify-center pt-4">
              <button
                onClick={handleAnalyze}
                disabled={selectedCount === 0}
                className={`px-8 py-3 rounded-2xl font-medium smooth flex items-center gap-2 ${
                  selectedCount > 0
                    ? "bg-accent text-white hover:bg-accent-dim shadow-lg shadow-accent/25 active:scale-95"
                    : "bg-surface-raised text-text-dim/50 cursor-not-allowed"
                }`}
              >
                <Sparkles className="w-5 h-5" />
                开始分析 ({selectedCount} 个歌单)
              </button>
            </div>
          </>
        ) : (
          <EmptyState
            icon={<Music className="w-12 h-12" />}
            title="暂无歌单"
            description={
              mode === "friend"
                ? `${friendNickname || "该用户"}还没有公开歌单`
                : tab === "created"
                  ? "去创建你的第一个歌单吧"
                  : "去收藏一些喜欢的歌单吧"
            }
          />
        )}
      </div>
    );
  }

  // ── render: analyzing ──

  if (pageState === "analyzing") {
    const pct = progress ? Math.round((progress.current / progress.total) * 100) : 0;
    const showBar = progress && progress.total > 1;

    return (
      <div className="p-6 max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[60vh] space-y-8">
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-accent animate-pulse" />
          </div>
          <div className="absolute -inset-4 rounded-[2rem] border-2 border-accent/20 animate-spin [animation-duration:3s] [border-top-color:transparent] [border-right-color:transparent]" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-text">
            AI 正在分析{friendNickname ? ` ${friendNickname} ` : "你的"}音乐品味…
          </h2>
          <p className="text-sm text-text-dim">
            {progress?.message || `正在扫描 ${selectedCount} 个歌单的歌曲风格`}
          </p>
          {progress?.totalSongs && (
            <p className="text-xs text-text-dim/50">
              共 {progress.totalSongs} 首歌曲，全部参与分析
            </p>
          )}
        </div>
        {showBar ? (
          /* Deterministic progress bar */
          <div className="w-80 space-y-1.5">
            <div className="h-2 rounded-full bg-surface-raised overflow-hidden">
              <div
                className="h-full bg-accent rounded-full smooth transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-text-dim/50 text-center">
              {progress!.current} / {progress!.total} 批
              {progress!.phase === "synthesis" ? " — 综合分析中" : ""}
            </p>
          </div>
        ) : (
          /* Indeterminate pulse bar */
          <div className="w-64 h-1.5 rounded-full bg-surface-raised overflow-hidden">
            <div className="h-full bg-accent rounded-full animate-pulse [animation-duration:1.5s] w-2/3" />
          </div>
        )}
      </div>
    );
  }

  // ── render: results ──

  if (pageState === "results" && analysis) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-8">
        {/* back button */}
        <button
          onClick={reset}
          className="flex items-center gap-1 text-sm text-text-dim hover:text-text smooth"
        >
          <ArrowLeft className="w-4 h-4" />
          重新选择歌单
        </button>

        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* style profile card */}
        <div className="p-6 rounded-2xl bg-accent/5 border border-accent/20 space-y-4">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold text-text">
              {friendNickname ? `${friendNickname} 的` : "你的"}音乐风格画像
            </h2>
            {analysis.sampled && (
              <span className="text-xs text-text-dim/60 bg-surface-raised px-2 py-0.5 rounded-full">
                已采样 {analysis.analyzedSongs}/{analysis.totalSongs} 首
              </span>
            )}
          </div>
          <p className="text-sm text-text-dim leading-relaxed">{analysis.styleProfile}</p>
          <p className="text-sm text-accent-dim italic">{analysis.favoritePatterns}</p>
        </div>

        {/* taste clusters */}
        {analysis.tasteClusters && analysis.tasteClusters.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-text flex items-center gap-2">
              <Layers className="w-4 h-4 text-accent" />
              品味聚类
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {analysis.tasteClusters.map((cluster, i) => (
                <div
                  key={i}
                  className="p-4 rounded-2xl bg-surface-raised border border-accent/10 space-y-2 hover:border-accent/20 smooth"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-text">{cluster.name}</h4>
                    <span className="text-xs font-mono text-accent-dim bg-accent/10 px-2 py-0.5 rounded-full">
                      ~{cluster.percentage}%
                    </span>
                  </div>
                  <p className="text-xs text-text-dim leading-relaxed">{cluster.description}</p>
                  {cluster.keyArtists && cluster.keyArtists.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {cluster.keyArtists.map((artist) => (
                        <span
                          key={artist}
                          className="px-2 py-0.5 rounded-full text-xs bg-accent/5 text-accent-dim border border-accent/10"
                        >
                          {artist}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* tags */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TagSection icon={<Tag className="w-4 h-4" />} title="流派" tags={analysis.genreTags} color="bg-purple-500/10 text-purple-400 border-purple-500/20" />
          <TagSection icon={<Smile className="w-4 h-4" />} title="情绪" tags={analysis.moodTags} color="bg-pink-500/10 text-pink-400 border-pink-500/20" />
          <TagSection icon={<Clock className="w-4 h-4" />} title="年代" tags={analysis.eraTags} color="bg-amber-500/10 text-amber-400 border-amber-500/20" />
          <TagSection icon={<Languages className="w-4 h-4" />} title="语言" tags={analysis.languageTags} color="bg-emerald-500/10 text-emerald-400 border-emerald-500/20" />
        </div>

        {/* recommended songs */}
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-text flex items-center gap-2">
            <Music className="w-4 h-4 text-accent" />
            精选推荐 ({analysis.recommendedSongs.length} 首)
          </h3>
          {analysis.filteredLikedSongs > 0 && (
            <p className="text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/10 rounded-xl px-3 py-1.5">
              🔍 已自动排除 {analysis.filteredLikedSongs} 首红心歌曲，避免重复推荐
            </p>
          )}
          <div className="rounded-2xl border border-accent/15 bg-surface overflow-hidden divide-y divide-accent/5">
            {analysis.recommendedSongs.map((song, i) => (
              <div
                key={song.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/5 smooth cursor-pointer"
              >
                <span className="w-5 text-xs text-text-dim/50 text-right tabular-nums">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate text-text">{song.name}</p>
                  <p className="text-xs text-text-dim truncate">
                    {song.artist}
                    {song.album ? ` · ${song.album}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* generate button */}
        <div className="flex justify-center">
          {showNameInput ? (
            <div className="flex items-center gap-3 bg-surface-raised rounded-2xl p-1.5 border border-accent/20">
              <input
                type="text"
                placeholder="输入歌单名称…"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
                className="px-4 py-2 bg-transparent text-text text-sm outline-none min-w-[240px]"
                autoFocus
              />
              <button
                onClick={handleGenerate}
                disabled={!playlistName.trim() || generating}
                className={`px-5 py-2 rounded-xl text-sm font-medium smooth flex items-center gap-1.5 ${
                  playlistName.trim()
                    ? "bg-accent text-white hover:bg-accent-dim active:scale-95"
                    : "bg-surface text-text-dim/50 cursor-not-allowed"
                }`}
              >
                {generating ? (
                  <LoadingSpinner />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    生成歌单
                  </>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNameInput(true)}
              className="px-8 py-3 rounded-2xl font-medium smooth flex items-center gap-2 bg-accent text-white hover:bg-accent-dim shadow-lg shadow-accent/25 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              生成精选歌单
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── render: generated ──

  if (pageState === "generated") {
    return (
      <div className="p-6 max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-text">歌单已生成！</h2>
          <p className="text-text-dim">
            歌单「{playlistName}」已创建，包含 {analysis?.recommendedSongs.length ?? 0} 首精选歌曲
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/playlists")}
            className="px-6 py-2.5 rounded-2xl font-medium bg-accent text-white hover:bg-accent-dim smooth flex items-center gap-2"
          >
            查看我的歌单
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={reset}
            className="px-6 py-2.5 rounded-2xl font-medium bg-surface-raised text-text-dim hover:text-text smooth"
          >
            继续分析
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ── sub-components ──

function TagSection({
  icon,
  title,
  tags,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  tags: string[];
  color: string;
}) {
  return (
    <div className="p-4 rounded-2xl bg-surface-raised border border-accent/10 space-y-3">
      <div className="flex items-center gap-1.5 text-sm font-medium text-text">
        {icon}
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.length > 0 ? (
          tags.map((t) => (
            <span
              key={t}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}
            >
              {t}
            </span>
          ))
        ) : (
          <span className="text-xs text-text-dim/50">暂无数据</span>
        )}
      </div>
    </div>
  );
}

// ── helpers ──

function extractPlaylists(data: unknown): Playlist[] {
  const d = data as Record<string, unknown> | undefined;
  if (!d) return [];
  const inner = d.data as Record<string, unknown> | undefined;
  if (inner && Array.isArray(inner.records)) {
    return (inner.records as Array<Record<string, unknown>>).map(mapPlaylist);
  }
  if (Array.isArray(d.playlists)) return d.playlists as Playlist[];
  if (Array.isArray(d.data)) return d.data as Playlist[];
  if (Array.isArray(d)) return d as Playlist[];
  return [];
}

function mapPlaylist(raw: Record<string, unknown>): Playlist {
  return {
    id: String(raw.id ?? raw.originalId ?? ""),
    name: String(raw.name ?? ""),
    description: raw.describe ? String(raw.describe) : undefined,
    coverUrl: raw.coverImgUrl ? String(raw.coverImgUrl) : undefined,
    trackCount: raw.trackCount ? Number(raw.trackCount) : undefined,
    playCount: raw.playCount ? Number(raw.playCount) : undefined,
    creator: raw.creatorNickName ? { nickname: String(raw.creatorNickName) } : undefined,
  };
}
