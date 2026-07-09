import { useTheme, PRESET_THEMES } from '@/lib/theme';
import { Palette, Check } from 'lucide-react';

const presetLabels: Record<string, { label: string; gradient: string }> = {
  default: { label: 'Default', gradient: 'from-indigo-500 to-purple-600' },
  ocean: { label: 'Ocean', gradient: 'from-cyan-500 to-teal-600' },
  forest: { label: 'Forest', gradient: 'from-emerald-500 to-green-700' },
  sunset: { label: 'Sunset', gradient: 'from-orange-500 to-red-600' },
  midnight: { label: 'Midnight', gradient: 'from-violet-500 to-purple-700' },
  rose: { label: 'Rose', gradient: 'from-rose-500 to-pink-700' },
};

export default function ThemePage() {
  const { theme, setTheme, themeName, setThemeName } = useTheme();

  function handleColorChange(key: 'primary' | 'secondary' | 'accent', value: string) {
    const newTheme = { ...theme, [key]: value };
    setTheme(newTheme);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 border border-white/10">
            <Palette className="w-6 h-6 text-pink-400" />
          </div>
          Kustomisasi Tema
        </h1>
        <p className="text-slate-400 mt-2 ml-14">Sesuaikan tampilan aplikasi sesuai selera Anda</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Presets & Colors */}
        <div className="lg:col-span-2 space-y-6">
          {/* Preset themes */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6">
            <h3 className="text-white font-medium mb-4">Tema Preset</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(PRESET_THEMES).map(([key, colors]) => {
                const preset = presetLabels[key] || { label: key, gradient: 'from-gray-500 to-gray-700' };
                const isActive = themeName === key;

                return (
                  <button
                    key={key}
                    onClick={() => setThemeName(key)}
                    className={`
                      relative flex flex-col items-center gap-3 p-4 rounded-xl border transition-all duration-300 cursor-pointer group
                      ${
                        isActive
                          ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 ring-1 ring-[hsl(var(--primary))]/30 scale-[1.02]'
                          : 'border-white/10 bg-slate-800/50 hover:border-white/20 hover:bg-slate-800'
                      }
                    `}
                  >
                    {/* Color preview circle */}
                    <div
                      className={`w-12 h-12 rounded-full bg-gradient-to-br ${preset.gradient} shadow-lg transition-transform duration-300 group-hover:scale-110`}
                    />

                    {/* Color dots */}
                    <div className="flex gap-1.5">
                      <div
                        className="w-3 h-3 rounded-full border border-white/20"
                        style={{ backgroundColor: colors.primary }}
                      />
                      <div
                        className="w-3 h-3 rounded-full border border-white/20"
                        style={{ backgroundColor: colors.secondary }}
                      />
                      <div
                        className="w-3 h-3 rounded-full border border-white/20"
                        style={{ backgroundColor: colors.accent }}
                      />
                    </div>

                    <span className="text-sm font-medium text-slate-300">{preset.label}</span>

                    {/* Active indicator */}
                    {isActive && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[hsl(var(--primary))] flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom colors */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6">
            <h3 className="text-white font-medium mb-4">Warna Kustom</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Primary */}
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Primary</label>
                <div className="flex items-center gap-3 bg-slate-800 border border-white/10 rounded-lg px-3 py-2">
                  <input
                    type="color"
                    value={theme.primary}
                    onChange={(e) => handleColorChange('primary', e.target.value)}
                    className="w-8 h-8 rounded-md cursor-pointer border-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={theme.primary}
                    onChange={(e) => handleColorChange('primary', e.target.value)}
                    className="flex-1 bg-transparent text-white text-sm font-mono focus:outline-none"
                    maxLength={7}
                  />
                </div>
              </div>

              {/* Secondary */}
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Secondary</label>
                <div className="flex items-center gap-3 bg-slate-800 border border-white/10 rounded-lg px-3 py-2">
                  <input
                    type="color"
                    value={theme.secondary}
                    onChange={(e) => handleColorChange('secondary', e.target.value)}
                    className="w-8 h-8 rounded-md cursor-pointer border-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={theme.secondary}
                    onChange={(e) => handleColorChange('secondary', e.target.value)}
                    className="flex-1 bg-transparent text-white text-sm font-mono focus:outline-none"
                    maxLength={7}
                  />
                </div>
              </div>

              {/* Accent */}
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Accent</label>
                <div className="flex items-center gap-3 bg-slate-800 border border-white/10 rounded-lg px-3 py-2">
                  <input
                    type="color"
                    value={theme.accent}
                    onChange={(e) => handleColorChange('accent', e.target.value)}
                    className="w-8 h-8 rounded-md cursor-pointer border-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={theme.accent}
                    onChange={(e) => handleColorChange('accent', e.target.value)}
                    className="flex-1 bg-transparent text-white text-sm font-mono focus:outline-none"
                    maxLength={7}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Live preview */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6 sticky top-6">
            <h3 className="text-white font-medium mb-4">Pratinjau Langsung</h3>

            <div className="space-y-4">
              {/* Button previews */}
              <div className="space-y-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Tombol</p>
                <button
                  className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-all cursor-pointer hover:opacity-90"
                  style={{ backgroundColor: theme.primary }}
                >
                  Tombol Utama
                </button>
                <button
                  className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-all cursor-pointer hover:opacity-90"
                  style={{ backgroundColor: theme.secondary }}
                >
                  Tombol Sekunder
                </button>
                <button
                  className="w-full py-2.5 rounded-lg text-sm font-medium text-white transition-all cursor-pointer hover:opacity-90"
                  style={{ backgroundColor: theme.accent }}
                >
                  Tombol Aksen
                </button>
              </div>

              {/* Badge previews */}
              <div className="space-y-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Badge</p>
                <div className="flex flex-wrap gap-2">
                  <span
                    className="px-3 py-1 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: theme.primary }}
                  >
                    Kategori
                  </span>
                  <span
                    className="px-3 py-1 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: theme.secondary }}
                  >
                    Aktif
                  </span>
                  <span
                    className="px-3 py-1 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: theme.accent }}
                  >
                    Baru
                  </span>
                </div>
              </div>

              {/* Card preview */}
              <div className="space-y-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Kartu</p>
                <div
                  className="rounded-xl p-4 border"
                  style={{
                    borderColor: theme.primary + '40',
                    backgroundColor: theme.primary + '10',
                  }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: theme.primary }}
                    >
                      <Palette className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">Contoh Kartu</p>
                      <p className="text-slate-400 text-xs">Deskripsi singkat</p>
                    </div>
                  </div>
                  <div
                    className="h-1 rounded-full mt-3"
                    style={{
                      background: `linear-gradient(to right, ${theme.primary}, ${theme.secondary}, ${theme.accent})`,
                    }}
                  />
                </div>
              </div>

              {/* Gradient preview */}
              <div className="space-y-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Gradien</p>
                <div
                  className="h-16 rounded-xl"
                  style={{
                    background: `linear-gradient(135deg, ${theme.primary}, ${theme.secondary}, ${theme.accent})`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
