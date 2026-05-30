import { useThemeStore } from "../../stores/themeStore";
import { Palette, RotateCcw, Sparkles } from "lucide-react";

export default function ThemePicker() {
  const {
    availableImages, selectedImage, isApplying, error,
    selectImage, resetToDefault,
  } = useThemeStore();

  return (
    <div className="px-1">
      <div className="flex items-center gap-1.5 px-3 pt-3 pb-2">
        <Palette className="w-3.5 h-3.5 text-text-dim" />
        <span className="text-[11px] text-text-dim font-medium">主题配色</span>
      </div>

      {/* Reset button */}
      <button
        onClick={resetToDefault}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-text-dim hover:text-text hover:bg-accent/5 rounded-lg w-full text-left smooth"
      >
        <RotateCcw className="w-3 h-3" />
        恢复默认
        {!selectedImage && <span className="ml-auto text-[10px] opacity-60">当前</span>}
      </button>

      {/* Image grid */}
      {availableImages.length > 0 ? (
        <div className="grid grid-cols-3 gap-1.5 px-2 mt-1.5 mb-1">
          {availableImages.map((filename) => (
            <button
              key={filename}
              onClick={() => selectImage(filename)}
              disabled={isApplying}
              className={`relative aspect-square rounded-lg overflow-hidden border-2 smooth ${
                selectedImage === filename
                  ? "border-accent ring-2 ring-accent/30"
                  : "border-transparent hover:border-accent/40"
              }`}
              title={filename}
            >
              <img
                src={`/images/${filename}`}
                alt={filename}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : (
        <p className="px-3 py-2 text-[10px] text-text-dim/70 leading-relaxed">
          将图片放入 <code className="bg-surface/80 px-1 rounded text-[10px]">public/images/</code> 即可选择主题配色
        </p>
      )}

      {isApplying && (
        <div className="flex items-center gap-1.5 px-3 py-1.5">
          <Sparkles className="w-3 h-3 text-accent animate-spin" />
          <span className="text-[10px] text-text-dim">提取配色中...</span>
        </div>
      )}

      {error && (
        <p className="px-3 py-1 text-[10px] text-red-400">{error}</p>
      )}
    </div>
  );
}
