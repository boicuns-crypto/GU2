import React, { useEffect, useRef, useState } from 'react';
import {
  CARLIFE_CHANNELS,
  formatHex16,
} from '../protocol/carlifeConstants';
import { HANDSHAKE_TEST_PROFILES } from '../protocol/carlifeControlStateMachine';
import { ShizukuStatusKind } from '../protocol/shizukuServiceBridge';
import {
  APP_MODE_META,
  AppMode,
  BridgeRuntimeState,
  COCKPIT_INSTALLED_APPS,
  PacketLogEntry,
  SetupChecklistStatus,
  VideoSourceMode,
} from '../store/bridgeStore';
import {
  ArrowBackIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClearAllIcon,
  GraphicEqIcon,
  HomeIcon,
  MemoryIcon,
  PlayArrowIcon,
  RefreshIcon,
  StopIcon,
  TouchAppIcon,
  VideocamIcon,
} from './CockpitIcons';

interface UnifiedSettingsAndDiagnosticsScreenProps {
  state: BridgeRuntimeState;
  checklistStatus: SetupChecklistStatus;
  lastLaunchStatus: string;
  lastDecodedBreakdown: string;
  mediaStream: MediaStream | null;
  onSetAppMode: (mode: AppMode) => void;
  onRequestShizukuPermission: () => void;
  onOpenShizukuApp: () => void;
  onOpenDeveloperSettings: () => void;
  onToggleShizukuDaemon: () => void;
  onSetLogPacketsInUi: (enabled: boolean) => void;
  onSetTransmitAudioOverUsb: (enabled: boolean) => void;
  onSetMutePhoneSpeaker: (enabled: boolean) => void;
  onSetAutoStartOnUsbAttach: (enabled: boolean) => void;
  onSetKeepPhoneScreenOn: (enabled: boolean) => void;
  onSetForceLandscapeMirroring: (enabled: boolean) => void;
  onToggleLauncherAppVisibility: (packageName: string) => void;
  onSetLauncherVisiblePreset: (preset: 'all' | 'auto') => void;
  onSetShizukuVdNavButtonsEnabled: (enabled: boolean) => void;
  onSetShizukuVdNavButtonsLayout: (layout: 'dock' | 'floating') => void;
  onTriggerVdHome: () => void;
  onTriggerVdBack: () => void;
  onSetCanvasTestCardEnabled: (enabled: boolean) => void;
  onSetHandshakeProfile: (id: number) => void;
  onSelectResolution: (width: number, height: number) => void;
  onSelectFps: (fps: 25 | 30) => void;
  onSelectDensityDpi: (dpi: 160 | 180 | 200) => void;
  onSelectBitrate: (kbps: number) => void;
  onSetVideoHeaderMode: (useAoA20B: boolean) => void;
  onToggleProjection: () => void;
  onStartJettaVs7Vd: () => void;
  onToggleAccessibility: () => void;
  onRequestMediaProjection: () => void;
  onScanAndAttachUsb: () => void;
  onStopBridge: () => void;
  onInjectTouch: (x: number, y: number) => void;
  onRunLoopbackVector: (vector: 'handshake' | 'video' | 'touch' | 'hardkey') => void;
  onClearLogs: () => void;
}

const CanvasTestCardPreview: React.FC<{ width: number; height: number }> = ({ width, height }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let rafId = 0;
    let frameNum = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          frameNum += 1;
          ctx.fillStyle = '#0B0E14';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          ctx.strokeStyle = '#1E2636';
          ctx.lineWidth = 1;
          for (let x = 0; x < canvas.width; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
          }
          for (let y = 0; y < canvas.height; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
          }

          const scanX = (frameNum * 5) % canvas.width;
          ctx.fillStyle = 'rgba(0, 180, 216, 0.25)';
          ctx.fillRect(scanX, 0, 16, canvas.height);

          ctx.fillStyle = '#00B4D8';
          ctx.font = 'bold 20px "Space Grotesk", sans-serif';
          ctx.fillText('JETTA VS7 TEST • H.264 CANVAS', 20, 42);

          ctx.fillStyle = '#10B981';
          ctx.font = '14px "JetBrains Mono", monospace';
          const nowStr = new Date().toLocaleTimeString([], { hour12: false });
          ctx.fillText(
            `TIME: ${nowStr}  |  FRAME #${frameNum}  |  ${width}x${height} @ 30fps`,
            20,
            74
          );

          ctx.fillStyle = '#F59E0B';
          ctx.fillText('CHANNEL 0x0002 • AOA 20B (0x00020001) • VBR Baseline L3 • QP≤36', 20, 102);
        }
      }
      rafId = window.requestAnimationFrame(draw);
    };
    rafId = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(rafId);
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={140}
      className="w-full h-[120px] rounded-[10px] border border-[#222938] bg-[#0B0E14] object-cover"
    />
  );
};

const MediaStreamPreview: React.FC<{ stream: MediaStream }> = ({ stream }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);
  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="w-full h-[140px] rounded-[10px] border border-[#222938] bg-[#0B0E14] object-contain"
    />
  );
};

const SelectableOptionButton: React.FC<{
  label: string;
  selected: boolean;
  testTag: string;
  onClick: () => void;
  className?: string;
}> = ({ label, selected, testTag, onClick, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testTag}
    className={`h-11 rounded-[10px] px-2.5 text-[12px] truncate border transition cursor-pointer flex items-center justify-center ${
      selected
        ? 'bg-[#00B4D8]/18 border-[#00B4D8] text-[#00B4D8] font-semibold'
        : 'bg-[#1E2636] border-[#222938] text-[#F1F5F9] font-medium hover:border-[#00B4D8]/50'
    } ${className}`}
  >
    {label}
  </button>
);

const ToggleSettingRow: React.FC<{
  title: string;
  description: string;
  checked: boolean;
  onToggle: (next: boolean) => void;
  testTag: string;
  accentColor?: 'cyan' | 'emerald';
  disabled?: boolean;
}> = ({
  title,
  description,
  checked,
  onToggle,
  testTag,
  accentColor = 'cyan',
  disabled = false,
}) => (
  <div
    className={`w-full min-h-[52px] rounded-xl bg-[#0B0E14] border border-[#222938] px-3 py-2.5 flex items-center justify-between gap-3 ${
      disabled ? 'opacity-55' : ''
    }`}
  >
    <div className="flex-1 min-w-0">
      <div className="text-[13px] font-medium text-[#F1F5F9]">{title}</div>
      <div className="text-[11px] text-[#94A3B8] mt-0.5 leading-snug">{description}</div>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onToggle(!checked)}
      data-testid={testTag}
      className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 ${
        disabled ? 'cursor-not-allowed' : 'cursor-pointer'
      } ${
        checked
          ? accentColor === 'emerald'
            ? 'bg-[#10B981]'
            : 'bg-[#00B4D8]'
          : 'bg-[#1E2636]'
      }`}
    >
      <span
        className={`block w-5 h-5 rounded-full transition-transform ${
          checked ? 'translate-x-5 bg-[#0B0E14]' : 'translate-x-0 bg-[#94A3B8]'
        }`}
      />
    </button>
  </div>
);

const MetricPill: React.FC<{ label: string; value: string; subValue: string }> = ({
  label,
  value,
  subValue,
}) => (
  <div className="flex-1 min-w-0 rounded-[10px] bg-[#151A24] border border-[#222938] p-2.5">
    <div className="text-[10px] font-medium text-[#64748B] truncate">{label}</div>
    <div className="text-[16px] font-semibold text-[#F1F5F9] mt-0.5 truncate">{value}</div>
    <div className="text-[11px] text-[#00B4D8] truncate">{subValue}</div>
  </div>
);

const PacketLogItemCard: React.FC<{ entry: PacketLogEntry }> = ({ entry }) => {
  const isRx = entry.direction.startsWith('RX');
  const chHex = formatHex16(entry.channel);
  return (
    <div className="w-full rounded-xl bg-[#151A24] border border-[#222938] p-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
              isRx ? 'bg-[#064E3B] text-[#10B981]' : 'bg-[#00B4D8]/15 text-[#00B4D8]'
            }`}
          >
            {entry.direction}
          </span>
          <span className="font-mono-jetbrains text-[11px] text-[#F59E0B]">
            CH {chHex} ({entry.headerSizeBytes}B HDR)
          </span>
        </div>
        <span className="font-mono-jetbrains text-[11px] text-[#64748B]">
          {entry.timestampFormatted}
        </span>
      </div>

      {entry.serviceName && (
        <div className="text-[12px] font-medium text-[#F1F5F9] break-all">
          {entry.serviceName}
        </div>
      )}

      <div className="text-[11px] text-[#94A3B8]">
        Payload: {entry.payloadSizeBytes}B
        {entry.mediaTimestampMs > 0 ? ` • TS: ${entry.mediaTimestampMs} ms` : ''}
      </div>

      <div className="rounded-lg bg-[#0B0E14] border border-[#222938] p-2 font-mono-jetbrains text-[11px] text-[#94A3B8] break-all leading-relaxed">
        {entry.hexPreview}
      </div>
    </div>
  );
};

export const UnifiedSettingsAndDiagnosticsScreen: React.FC<
  UnifiedSettingsAndDiagnosticsScreenProps
> = ({
  state,
  checklistStatus,
  lastLaunchStatus,
  lastDecodedBreakdown,
  mediaStream,
  onSetAppMode,
  onRequestShizukuPermission,
  onOpenShizukuApp,
  onOpenDeveloperSettings,
  onToggleShizukuDaemon,
  onSetLogPacketsInUi,
  onSetTransmitAudioOverUsb,
  onSetMutePhoneSpeaker,
  onSetAutoStartOnUsbAttach,
  onSetKeepPhoneScreenOn,
  onSetForceLandscapeMirroring,
  onToggleLauncherAppVisibility,
  onSetLauncherVisiblePreset,
  onSetShizukuVdNavButtonsEnabled,
  onSetShizukuVdNavButtonsLayout,
  onTriggerVdHome,
  onTriggerVdBack,
  onSetCanvasTestCardEnabled,
  onSetHandshakeProfile,
  onSelectResolution,
  onSelectFps,
  onSelectDensityDpi,
  onSelectBitrate,
  onSetVideoHeaderMode,
  onToggleProjection,
  onStartJettaVs7Vd,
  onToggleAccessibility,
  onRequestMediaProjection,
  onScanAndAttachUsb,
  onStopBridge,
  onInjectTouch,
  onRunLoopbackVector,
  onClearLogs,
}) => {
  const [diagnosticsExpanded, setDiagnosticsExpanded] = useState(false);
  const [shizukuGuideExpanded, setShizukuGuideExpanded] = useState(false);
  const [selectedLogTab, setSelectedLogTab] = useState<0 | 1>(0);

  const sourceMode = state.videoSourceMode;
  const proj = state.projectionStats;
  const audioStats = state.audioCaptureStats;
  const shizuku = state.shizukuState;
  const isCanvasTestCard = sourceMode === VideoSourceMode.CANVAS_TEST_CARD;

  const shizukuBadgeStyle =
    shizuku.statusKind === ShizukuStatusKind.RUNNING_GRANTED
      ? 'bg-[#064E3B] text-[#10B981] border-[#10B981]/50'
      : shizuku.statusKind === ShizukuStatusKind.NO_PERMISSION
      ? 'bg-[#451A03] text-[#F59E0B] border-[#F59E0B]/50'
      : 'bg-[#450A0A] text-[#EF4444] border-[#EF4444]/50';

  const visiblePkgSet = new Set(state.launcherVisiblePackages);
  const displayedLogs =
    selectedLogTab === 0 ? state.commandPacketLogs : state.videoPacketLogs;

  return (
    <div className="h-full w-full overflow-y-auto px-4 py-4">
      <div className="max-w-[680px] mx-auto flex flex-col gap-4 pb-6">
        {/* 1. Блок «Режим работы» (всегда сверху) */}
        <section
          data-testid="app_mode_switcher_card"
          className="w-full rounded-2xl bg-[#151A24] border border-[#00B4D8]/75 p-4 flex flex-col gap-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-[16px] font-semibold text-[#F1F5F9]">Режим работы</h2>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                Выберите сценарий вывода изображения и обработки касаний на ГУ
              </p>
            </div>
            <span className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-[#00B4D8]/16 border border-[#00B4D8]/65 text-[#00B4D8] whitespace-nowrap">
              {state.appMode === AppMode.COCKPIT
                ? 'КОКПИТ'
                : state.appMode === AppMode.SHIZUKU_COCKPIT
                ? 'SHIZUKU'
                : 'ЗЕРКАЛО'}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {[AppMode.COCKPIT, AppMode.MIRRORING, AppMode.SHIZUKU_COCKPIT].map((mode) => {
              const meta = APP_MODE_META[mode];
              const isSelected = state.appMode === mode;
              const tag =
                mode === AppMode.COCKPIT
                  ? 'app_mode_cockpit_btn'
                  : mode === AppMode.MIRRORING
                  ? 'app_mode_mirroring_btn'
                  : 'app_mode_shizuku_cockpit_btn';

              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onSetAppMode(mode)}
                  data-testid={tag}
                  className={`w-full min-h-[52px] rounded-xl px-3.5 py-2.5 border flex items-center gap-3 text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#00B4D8]/12 border-[#00B4D8]'
                      : 'bg-[#0B0E14] border-[#222938] hover:border-[#00B4D8]/40'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-[#00B4D8]' : 'border-[#64748B]'
                    }`}
                  >
                    {isSelected && <span className="w-2 h-2 rounded-full bg-[#00B4D8]" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[14px] ${
                          isSelected ? 'font-semibold text-[#00B4D8]' : 'font-medium text-[#F1F5F9]'
                        }`}
                      >
                        {meta.title}
                      </span>
                      {mode === AppMode.SHIZUKU_COCKPIT && (
                        <span
                          className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold border ${shizukuBadgeStyle}`}
                        >
                          {shizuku.statusLabel}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#94A3B8] mt-0.5 leading-snug">
                      {meta.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. Контекстный блок «Настройки выбранного режима» */}
        <section
          data-testid="active_mode_settings_card"
          className="w-full rounded-2xl bg-[#151A24] border border-[#222938] p-4 flex flex-col gap-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-[16px] font-semibold text-[#F1F5F9]">
                Настройки выбранного режима
              </h2>
              <p className="text-[11px] text-[#00B4D8] mt-0.5 font-medium">
                {APP_MODE_META[state.appMode].title} — {APP_MODE_META[state.appMode].subtitle}
              </p>
            </div>
            <span className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium bg-[#1E2636] border border-[#222938] text-[#94A3B8] whitespace-nowrap">
              {state.configuredWidth}×{state.configuredHeight} • {state.virtualDisplayDensityDpi} dpi
            </span>
          </div>

          {/* Ветка 1: «Кокпит» */}
          {state.appMode === AppMode.COCKPIT && (
            <div data-testid="cockpit_mode_settings" className="flex flex-col gap-3.5">
              {/* Разрешение и DPI виртуального экрана */}
              <div className="rounded-xl bg-[#0B0E14] border border-[#222938] p-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-[#F1F5F9]">
                    Виртуальный экран (Presentation)
                  </span>
                  <span className="text-[11px] font-medium text-[#10B981]">
                    VD #{proj.virtualDisplayId || 2} • {state.configuredWidth}×{state.configuredHeight} •{' '}
                    {state.virtualDisplayDensityDpi} dpi
                  </span>
                </div>
                <p className="text-[11px] text-[#94A3B8]">
                  Разрешение и плотность DPI виртуального экрана (по умолчанию 1280×720, 160 dpi)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <SelectableOptionButton
                    label="800 × 480"
                    selected={state.configuredWidth === 800}
                    testTag="res_480p_btn"
                    onClick={() => onSelectResolution(800, 480)}
                  />
                  <SelectableOptionButton
                    label="1024 × 600"
                    selected={state.configuredWidth === 1024}
                    testTag="res_600p_btn"
                    onClick={() => onSelectResolution(1024, 600)}
                  />
                  <SelectableOptionButton
                    label="1280 × 720"
                    selected={state.configuredWidth === 1280}
                    testTag="res_720p_btn"
                    onClick={() => onSelectResolution(1280, 720)}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <SelectableOptionButton
                    label="160 dpi"
                    selected={state.virtualDisplayDensityDpi === 160}
                    testTag="dpi_160_btn"
                    onClick={() => onSelectDensityDpi(160)}
                  />
                  <SelectableOptionButton
                    label="180 dpi"
                    selected={state.virtualDisplayDensityDpi === 180}
                    testTag="dpi_180_btn"
                    onClick={() => onSelectDensityDpi(180)}
                  />
                  <SelectableOptionButton
                    label="200 dpi"
                    selected={state.virtualDisplayDensityDpi === 200}
                    testTag="dpi_200_btn"
                    onClick={() => onSelectDensityDpi(200)}
                  />
                </div>
              </div>

              {/* Настройка сетки приложений (выбор иконок для лаунчера) */}
              <div
                data-testid="launcher_grid_config_block"
                className="rounded-xl bg-[#0B0E14] border border-[#222938] p-3 flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="text-[13px] font-semibold text-[#F1F5F9]">
                      Сетка приложений лаунчера
                    </div>
                    <div className="text-[11px] text-[#94A3B8]">
                      Показано иконок: {state.launcherVisiblePackages.length} из{' '}
                      {COCKPIT_INSTALLED_APPS.length}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSetLauncherVisiblePreset('all')}
                      data-testid="launcher_preset_all_btn"
                      className="px-2.5 py-1 rounded-lg bg-[#1E2636] border border-[#222938] hover:border-[#00B4D8]/60 text-[11px] font-medium text-[#F1F5F9] cursor-pointer"
                    >
                      Все
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetLauncherVisiblePreset('auto')}
                      data-testid="launcher_preset_auto_btn"
                      className="px-2.5 py-1 rounded-lg bg-[#1E2636] border border-[#222938] hover:border-[#00B4D8]/60 text-[11px] font-medium text-[#00B4D8] cursor-pointer"
                    >
                      Только авто
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {COCKPIT_INSTALLED_APPS.map((app) => {
                    const checked = visiblePkgSet.has(app.packageName);
                    return (
                      <button
                        key={app.packageName}
                        type="button"
                        onClick={() => onToggleLauncherAppVisibility(app.packageName)}
                        data-testid={`launcher_app_toggle_${app.packageName}`}
                        className={`min-h-[38px] rounded-lg px-2.5 py-1.5 border flex items-center gap-2 text-left transition cursor-pointer ${
                          checked
                            ? 'bg-[#00B4D8]/12 border-[#00B4D8]/70 text-[#F1F5F9]'
                            : 'bg-[#151A24] border-[#222938] text-[#64748B]'
                        }`}
                      >
                        <span
                          className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0"
                          style={{
                            backgroundColor: checked ? `${app.accentColor}28` : '#1E2636',
                            color: checked ? app.accentColor : '#64748B',
                          }}
                        >
                          {app.badgeText}
                        </span>
                        <span className="text-[11px] font-medium truncate flex-1">{app.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Быстрая проверка тача в Presentation */}
              <div
                data-testid="presentation_touch_test_block"
                className="rounded-xl bg-[#0B0E14] border border-[#222938] p-3 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-[#F1F5F9]">
                    Быстрая проверка тача в Presentation
                  </span>
                  <span className="text-[11px] text-[#00B4D8] font-mono-jetbrains">
                    decorView • #{proj.injectedTouches}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onInjectTouch(120, 180)}
                    data-testid="inject_touch_dock_btn"
                    className="h-11 rounded-[10px] bg-[#1E2636] border border-[#222938] hover:border-[#00B4D8] text-[#F1F5F9] text-[12px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <TouchAppIcon className="w-4 h-4 text-[#00B4D8]" />
                    <span>Тест Док</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onInjectTouch(680, 360)}
                    data-testid="inject_touch_launcher_btn"
                    className="h-11 rounded-[10px] bg-[#1E2636] border border-[#222938] hover:border-[#00B4D8] text-[#F1F5F9] text-[12px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <TouchAppIcon className="w-4 h-4 text-[#10B981]" />
                    <span>Тест Сетка</span>
                  </button>
                </div>
                <div className="text-[11px] font-mono-jetbrains text-[#94A3B8] truncate">
                  {state.lastTouchOrKeyEvent}
                </div>
              </div>
            </div>
          )}

          {/* Ветка 2: «Зеркалирование» */}
          {state.appMode === AppMode.MIRRORING && (
            <div data-testid="mirroring_mode_settings" className="flex flex-col gap-3.5">
              {/* Служба тача (Спец. возможности) */}
              <div
                data-testid="accessibility_touch_service_card"
                className={`rounded-xl bg-[#0B0E14] border p-3 flex flex-col gap-2.5 ${
                  checklistStatus.step3AccessibilityEnabled
                    ? 'border-[#10B981]/60'
                    : 'border-[#F59E0B]/70'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[#F1F5F9]">
                      Служба тача (CarLifeAccessibilityService)
                    </div>
                    <div className="text-[11px] text-[#94A3B8] mt-0.5">
                      Передаёт касания с экрана ГУ в экран смартфона через dispatchGesture
                    </div>
                  </div>
                  <span
                    data-testid="a11y_status_badge"
                    className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                      checklistStatus.step3AccessibilityEnabled
                        ? 'bg-[#064E3B] text-[#10B981]'
                        : 'bg-[#451A03] text-[#F59E0B]'
                    }`}
                  >
                    {checklistStatus.step3AccessibilityEnabled ? 'Вкл' : 'Выкл'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={onToggleAccessibility}
                  data-testid="enable_accessibility_touch_btn"
                  className={`w-full min-h-[44px] rounded-[10px] px-4 flex items-center justify-center gap-2 font-semibold text-[13px] transition cursor-pointer ${
                    checklistStatus.step3AccessibilityEnabled
                      ? 'bg-[#1E2636] text-[#10B981] border border-[#10B981]/50'
                      : 'bg-[#00B4D8] text-[#001D24] hover:brightness-110'
                  }`}
                >
                  <TouchAppIcon className="w-[18px] h-[18px]" />
                  <span>
                    {checklistStatus.step3AccessibilityEnabled
                      ? 'Служба тача активна (Спец. возможности)'
                      : 'Включить службу тача (Спец. возможности)'}
                  </span>
                </button>

                {!checklistStatus.step5MediaProjectionGranted && (
                  <button
                    type="button"
                    onClick={onRequestMediaProjection}
                    data-testid="mirroring_request_mp_btn"
                    className="w-full min-h-[40px] rounded-[10px] px-3 bg-[#1E2636] border border-[#222938] hover:border-[#00B4D8]/60 text-[12px] font-semibold text-[#F1F5F9] cursor-pointer transition"
                  >
                    Выдать разрешение MediaProjection («Весь экран»)
                  </button>
                )}
              </div>

              {/* Качество потока: 1280×720, FPS (25/30), режим VBR, densityDpi (160/200) */}
              <div className="rounded-xl bg-[#0B0E14] border border-[#222938] p-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-[#F1F5F9]">Качество потока</span>
                  <span className="rounded-md px-2 py-0.5 text-[10px] font-semibold bg-[#10B981]/15 border border-[#10B981]/50 text-[#10B981]">
                    VBR • Baseline L3 • QP≤36
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <SelectableOptionButton
                    label="800 × 480"
                    selected={state.configuredWidth === 800}
                    testTag="res_480p_btn"
                    onClick={() => onSelectResolution(800, 480)}
                  />
                  <SelectableOptionButton
                    label="1024 × 600"
                    selected={state.configuredWidth === 1024}
                    testTag="res_600p_btn"
                    onClick={() => onSelectResolution(1024, 600)}
                  />
                  <SelectableOptionButton
                    label="1280 × 720"
                    selected={state.configuredWidth === 1280}
                    testTag="res_720p_btn"
                    onClick={() => onSelectResolution(1280, 720)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <SelectableOptionButton
                    label="25 fps"
                    selected={state.configuredFps === 25}
                    testTag="fps_25_btn"
                    onClick={() => onSelectFps(25)}
                  />
                  <SelectableOptionButton
                    label="30 fps"
                    selected={state.configuredFps === 30}
                    testTag="fps_30_btn"
                    onClick={() => onSelectFps(30)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <SelectableOptionButton
                    label="160 dpi"
                    selected={state.virtualDisplayDensityDpi === 160}
                    testTag="dpi_160_btn"
                    onClick={() => onSelectDensityDpi(160)}
                  />
                  <SelectableOptionButton
                    label="200 dpi"
                    selected={state.virtualDisplayDensityDpi === 200}
                    testTag="dpi_200_btn"
                    onClick={() => onSelectDensityDpi(200)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <SelectableOptionButton
                    label="VBR 800 кбит/с"
                    selected={state.configuredBitrateBps === 800_000}
                    testTag="bitrate_800_btn"
                    onClick={() => onSelectBitrate(800)}
                  />
                  <SelectableOptionButton
                    label="VBR 1.2 Мбит/с"
                    selected={state.configuredBitrateBps === 1_200_000}
                    testTag="bitrate_1200_btn"
                    onClick={() => onSelectBitrate(1200)}
                  />
                  <SelectableOptionButton
                    label="VBR 2.0 Мбит/с"
                    selected={state.configuredBitrateBps === 2_000_000}
                    testTag="bitrate_2000_btn"
                    onClick={() => onSelectBitrate(2000)}
                  />
                </div>
              </div>

              {/* Тумблеры экрана телефона */}
              <div className="flex flex-col gap-2">
                <ToggleSettingRow
                  title="Не выключать экран телефона"
                  description="Удерживает FLAG_KEEP_SCREEN_ON во время трансляции экрана (вкл. по умолчанию)"
                  checked={state.keepPhoneScreenOn}
                  onToggle={onSetKeepPhoneScreenOn}
                  testTag="keep_phone_screen_on_switch"
                  accentColor="emerald"
                />
                <ToggleSettingRow
                  title="Принудительная альбомная ориентация"
                  description="Фиксирует горизонтальный режим экрана при зеркалировании (если поддерживается устройством)"
                  checked={state.forceLandscapeMirroring}
                  onToggle={onSetForceLandscapeMirroring}
                  testTag="force_landscape_mirroring_switch"
                />
              </div>

              {proj.isRunning && mediaStream && !isCanvasTestCard && (
                <MediaStreamPreview stream={mediaStream} />
              )}
            </div>
          )}

          {/* Ветка 3: «Кокпит + Shizuku» */}
          {state.appMode === AppMode.SHIZUKU_COCKPIT && (
            <div data-testid="shizuku_mode_settings" className="flex flex-col gap-3.5">
              {/* Статус и права Shizuku */}
              <div className="rounded-xl bg-[#0B0E14] border border-[#222938] p-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[#F1F5F9]">
                      Служба Shizuku (AIDL)
                    </div>
                    <div className="text-[11px] text-[#94A3B8] truncate">
                      {shizuku.userServiceBound
                        ? `Привязан к VD #${shizuku.boundDisplayId} • ${shizuku.userServiceComponent}`
                        : shizuku.lastAidlCall}
                    </div>
                  </div>
                  <span
                    data-testid="shizuku_status_badge"
                    className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold border ${shizukuBadgeStyle}`}
                  >
                    {shizuku.statusLabel}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onRequestShizukuPermission}
                    data-testid="request_shizuku_permission_btn"
                    className={`flex-1 min-h-[44px] rounded-[10px] px-3 text-[13px] font-semibold transition cursor-pointer ${
                      shizuku.permissionGranted && shizuku.binderAlive
                        ? 'bg-[#064E3B] text-[#10B981] border border-[#10B981]/50'
                        : 'bg-[#00B4D8] text-[#001D24] hover:brightness-110'
                    }`}
                  >
                    {shizuku.permissionGranted && shizuku.binderAlive
                      ? 'Права Shizuku выданы'
                      : 'Запросить права Shizuku'}
                  </button>
                  <button
                    type="button"
                    onClick={onToggleShizukuDaemon}
                    data-testid="toggle_shizuku_daemon_btn"
                    className="min-h-[44px] rounded-[10px] px-3 bg-[#1E2636] border border-[#222938] text-[11px] font-medium text-[#94A3B8] hover:text-[#F1F5F9] cursor-pointer shrink-0"
                  >
                    {shizuku.binderAlive ? 'Служба: ВКЛ' : 'Служба: ВЫКЛ'}
                  </button>
                </div>

                {/* Сворачиваемый блок «Как настроить Shizuku (инструкция)» */}
                <div
                  data-testid="shizuku_setup_guide_block"
                  className="rounded-lg bg-[#151A24] border border-[#222938] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setShizukuGuideExpanded((v) => !v)}
                    data-testid="toggle_shizuku_guide_btn"
                    className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-[#1E2636]/70 transition cursor-pointer"
                  >
                    <span className="text-[12px] font-semibold text-[#00B4D8]">
                      Как настроить Shizuku (инструкция)
                    </span>
                    {shizukuGuideExpanded ? (
                      <ChevronUpIcon className="w-4 h-4 text-[#00B4D8] shrink-0" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4 text-[#00B4D8] shrink-0" />
                    )}
                  </button>

                  {shizukuGuideExpanded && (
                    <div className="px-3 pb-3 pt-1.5 flex flex-col gap-2.5 border-t border-[#222938]">
                      <ol className="flex flex-col gap-2 text-[11px] text-[#94A3B8] leading-relaxed list-none">
                        <li>
                          <span className="font-semibold text-[#F1F5F9]">1. Установите Shizuku</span>{' '}
                          на смартфон (из Google Play или GitHub) и подключите телефон к любой сети
                          Wi-Fi (нужно только на момент запуска).
                        </li>
                        <li>
                          <span className="font-semibold text-[#F1F5F9]">
                            2. Включите «Отладку по Wi-Fi»:
                          </span>{' '}
                          откройте <em>Параметры разработчика</em> → включите{' '}
                          <em>«Отладка по Wi-Fi»</em> → нажмите на этот пункт → выберите{' '}
                          <em>«Подключить устройство с помощью кода сопряжения»</em>.
                        </li>
                        <li>
                          <span className="font-semibold text-[#F1F5F9]">
                            3. Выполните сопряжение и запуск:
                          </span>{' '}
                          откройте Shizuku → нажмите <em>«Сопряжение»</em>, введите 6-значный код в
                          уведомлении, затем вернитесь в Shizuku и нажмите <em>«Запуск»</em>{' '}
                          (дождитесь статуса «Shizuku работает»).
                        </li>
                        <li>
                          <span className="font-semibold text-[#F1F5F9]">
                            4. Выдайте права приложению:
                          </span>{' '}
                          вернитесь сюда и нажмите <em>«Запросить права Shizuku»</em> →{' '}
                          <em>«Разрешить всегда»</em>. После этого Wi-Fi можно отключить (служба
                          работает до перезагрузки телефона).
                        </li>
                      </ol>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={onOpenShizukuApp}
                          data-testid="open_shizuku_app_btn"
                          className="min-h-[38px] rounded-lg px-2.5 py-1.5 bg-[#1E2636] border border-[#222938] hover:border-[#00B4D8]/60 text-[11px] font-semibold text-[#F1F5F9] text-center transition cursor-pointer"
                        >
                          Открыть Shizuku
                        </button>
                        <button
                          type="button"
                          onClick={onOpenDeveloperSettings}
                          data-testid="open_developer_settings_btn"
                          className="min-h-[38px] rounded-lg px-2.5 py-1.5 bg-[#1E2636] border border-[#222938] hover:border-[#00B4D8]/60 text-[11px] font-semibold text-[#F1F5F9] text-center transition cursor-pointer"
                        >
                          Параметры разработчика
                        </button>
                        <button
                          type="button"
                          onClick={onRequestShizukuPermission}
                          data-testid="guide_request_shizuku_permission_btn"
                          className="min-h-[38px] rounded-lg px-2.5 py-1.5 bg-[#00B4D8] text-[#001D24] hover:brightness-110 text-[11px] font-semibold text-center transition cursor-pointer"
                        >
                          Запросить права Shizuku
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Разрешение и DPI второго экрана (1280×720, 160 dpi, VBR) */}
              <div className="rounded-xl bg-[#0B0E14] border border-[#222938] p-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-[#F1F5F9]">
                    Параметры второго экрана (VirtualDisplay)
                  </span>
                  <span className="rounded-md px-2 py-0.5 text-[10px] font-semibold bg-[#10B981]/15 border border-[#10B981]/50 text-[#10B981]">
                    VBR • {state.configuredBitrateBps / 1000} кбит/с • {state.configuredFps} fps
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <SelectableOptionButton
                    label="800 × 480"
                    selected={state.configuredWidth === 800}
                    testTag="res_480p_btn"
                    onClick={() => onSelectResolution(800, 480)}
                  />
                  <SelectableOptionButton
                    label="1024 × 600"
                    selected={state.configuredWidth === 1024}
                    testTag="res_600p_btn"
                    onClick={() => onSelectResolution(1024, 600)}
                  />
                  <SelectableOptionButton
                    label="1280 × 720"
                    selected={state.configuredWidth === 1280}
                    testTag="res_720p_btn"
                    onClick={() => onSelectResolution(1280, 720)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <SelectableOptionButton
                    label="160 dpi"
                    selected={state.virtualDisplayDensityDpi === 160}
                    testTag="dpi_160_btn"
                    onClick={() => onSelectDensityDpi(160)}
                  />
                  <SelectableOptionButton
                    label="180 dpi"
                    selected={state.virtualDisplayDensityDpi === 180}
                    testTag="dpi_180_btn"
                    onClick={() => onSelectDensityDpi(180)}
                  />
                  <SelectableOptionButton
                    label="200 dpi"
                    selected={state.virtualDisplayDensityDpi === 200}
                    testTag="dpi_200_btn"
                    onClick={() => onSelectDensityDpi(200)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <SelectableOptionButton
                    label="25 fps"
                    selected={state.configuredFps === 25}
                    testTag="fps_25_btn"
                    onClick={() => onSelectFps(25)}
                  />
                  <SelectableOptionButton
                    label="30 fps"
                    selected={state.configuredFps === 30}
                    testTag="fps_30_btn"
                    onClick={() => onSelectFps(30)}
                  />
                </div>
              </div>

              {/* Настройка системных кнопок «Домой» / «Назад» для VirtualDisplay */}
              <div
                data-testid="shizuku_vd_nav_buttons_block"
                className="rounded-xl bg-[#0B0E14] border border-[#222938] p-3 flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[#F1F5F9]">
                      Системные кнопки «Домой» / «Назад» для VirtualDisplay
                    </div>
                    <div className="text-[11px] text-[#94A3B8] mt-0.5">
                      Отправка KEYCODE_HOME (3) и KEYCODE_BACK (4) на displayId={shizuku.boundDisplayId} через Shizuku
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={state.shizukuVdNavButtonsEnabled}
                    onClick={() =>
                      onSetShizukuVdNavButtonsEnabled(!state.shizukuVdNavButtonsEnabled)
                    }
                    data-testid="shizuku_vd_nav_buttons_switch"
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                      state.shizukuVdNavButtonsEnabled ? 'bg-[#00B4D8]' : 'bg-[#1E2636]'
                    }`}
                  >
                    <span
                      className={`block w-5 h-5 rounded-full transition-transform ${
                        state.shizukuVdNavButtonsEnabled
                          ? 'translate-x-5 bg-[#0B0E14]'
                          : 'translate-x-0 bg-[#94A3B8]'
                      }`}
                    />
                  </button>
                </div>

                {state.shizukuVdNavButtonsEnabled && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <SelectableOptionButton
                        label="Боковой док"
                        selected={state.shizukuVdNavButtonsLayout === 'dock'}
                        testTag="shizuku_nav_layout_dock_btn"
                        onClick={() => onSetShizukuVdNavButtonsLayout('dock')}
                      />
                      <SelectableOptionButton
                        label="Плавающая панель"
                        selected={state.shizukuVdNavButtonsLayout === 'floating'}
                        testTag="shizuku_nav_layout_floating_btn"
                        onClick={() => onSetShizukuVdNavButtonsLayout('floating')}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={onTriggerVdHome}
                        data-testid="shizuku_test_home_btn"
                        className="h-10 rounded-[10px] bg-[#1E2636] border border-[#222938] hover:border-[#00B4D8] text-[#F1F5F9] text-[12px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition"
                      >
                        <HomeIcon className="w-4 h-4 text-[#00B4D8]" />
                        <span>Домой (VD #{shizuku.boundDisplayId})</span>
                      </button>
                      <button
                        type="button"
                        onClick={onTriggerVdBack}
                        data-testid="shizuku_test_back_btn"
                        className="h-10 rounded-[10px] bg-[#1E2636] border border-[#222938] hover:border-[#00B4D8] text-[#F1F5F9] text-[12px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition"
                      >
                        <ArrowBackIcon className="w-4 h-4 text-[#F1F5F9]" />
                        <span>Назад (VD #{shizuku.boundDisplayId})</span>
                      </button>
                    </div>

                    <div className="text-[11px] font-mono-jetbrains text-[#94A3B8] truncate">
                      {lastLaunchStatus}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        {/* 3. Блок «Общие настройки (Звук и USB)» */}
        <section
          data-testid="general_audio_usb_settings_card"
          className="w-full rounded-2xl bg-[#151A24] border border-[#222938] p-4 flex flex-col gap-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[16px] font-semibold text-[#F1F5F9]">
              Общие настройки (Звук и USB)
            </h2>
            <span
              className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${
                audioStats.isCapturing
                  ? 'bg-[#064E3B] text-[#10B981]'
                  : state.transmitAudioOverUsb
                  ? 'bg-[#1E2636] text-[#00B4D8]'
                  : 'bg-[#1E2636] text-[#64748B]'
              }`}
            >
              {audioStats.isCapturing
                ? '0x0003 PCM ON'
                : state.transmitAudioOverUsb
                ? '0x0003 ГОТОВ'
                : '0x0003 ВЫКЛ'}
            </span>
          </div>

          <ToggleSettingRow
            title="Передавать звук по USB (канал 0x0003)"
            description="AudioPlaybackCapture 48 кГц Stereo 16-bit PCM (по умолчанию включено)"
            checked={state.transmitAudioOverUsb}
            onToggle={onSetTransmitAudioOverUsb}
            testTag="transmit_audio_usb_switch"
            accentColor="emerald"
          />

          <ToggleSettingRow
            title="Глушить динамик телефона при USB-звуке"
            description={
              audioStats.isPhoneSpeakerMutedByBridge
                ? `Динамик заглушен: STREAM_MUSIC=0 (сохранена громкость ${audioStats.savedPhoneMusicVolume ?? 0}/15)`
                : `При старте сохраняет STREAM_MUSIC (${audioStats.currentPhoneMusicVolume}/15), ставит 0 и восстанавливает при отключении USB`
            }
            checked={state.mutePhoneSpeakerDuringUsbAudio}
            onToggle={onSetMutePhoneSpeaker}
            testTag="mute_speaker_usb_audio_switch"
            accentColor="emerald"
            disabled={!state.transmitAudioOverUsb}
          />

          <div
            data-testid="hfp_bluetooth_info_row"
            className="w-full rounded-xl bg-[#0B0E14] border border-[#222938] px-3 py-2.5 flex items-center gap-2.5"
          >
            <span className="w-2 h-2 rounded-full bg-[#00B4D8] shrink-0" />
            <span className="text-[12px] text-[#CBD5E1]">
              Звонки (HFP) работают через штатный Bluetooth ГУ
            </span>
          </div>

          <ToggleSettingRow
            title="Автозапуск при подключении кабеля USB"
            description="Автоматически запускает USB AOA сервис при подключении кабеля к головному устройству"
            checked={state.autoStartOnUsbAttach}
            onToggle={onSetAutoStartOnUsbAttach}
            testTag="autostart_usb_attach_switch"
          />
        </section>

        {/* 4. Сворачиваемый блок «Инженерная диагностика (AOA & Protocol Lab)» (в самом низу, свёрнут по умолчанию) */}
        <section
          data-testid="engineering_diagnostics_card"
          className="w-full rounded-2xl bg-[#151A24] border border-[#222938] p-4 flex flex-col gap-3"
        >
          <button
            type="button"
            onClick={() => setDiagnosticsExpanded((v) => !v)}
            data-testid="toggle_engineering_diagnostics_btn"
            className="w-full rounded-[10px] py-1 flex items-center justify-between gap-2 text-left cursor-pointer hover:opacity-90"
          >
            <div className="flex-1 min-w-0">
              <h2 className="text-[16px] font-semibold text-[#F1F5F9]">
                Инженерная диагностика (AOA &amp; Protocol Lab)
              </h2>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                Логирование пакетов, тест-карта (Canvas), счётчики каналов 0x0001..0x0006 и статистика USB AOA
              </p>
            </div>
            {diagnosticsExpanded ? (
              <ChevronUpIcon className="w-6 h-6 text-[#00B4D8] shrink-0" />
            ) : (
              <ChevronDownIcon className="w-6 h-6 text-[#00B4D8] shrink-0" />
            )}
          </button>

          {diagnosticsExpanded && (
            <div className="flex flex-col gap-3 pt-1">
              {/* Тумблер «Логировать пакеты в UI» + Переключатель «Тест-карта (Canvas)» */}
              <ToggleSettingRow
                title="Логировать пакеты в UI"
                description={
                  state.logPacketsInUi
                    ? 'Включено — пакеты записываются в журнал ниже (нагружает UI на высоком FPS)'
                    : 'Выключено по умолчанию — не тормозит телефон при потоковой передаче'
                }
                checked={state.logPacketsInUi}
                onToggle={onSetLogPacketsInUi}
                testTag="log_packets_ui_switch"
              />

              <ToggleSettingRow
                title="Тест-карта (Canvas)"
                description="Отладка видеоканала 0x0002: прямая отрисовка тестового кадра JETTA VS7 TEST в H.264"
                checked={isCanvasTestCard}
                onToggle={onSetCanvasTestCardEnabled}
                testTag="canvas_test_card_switch"
                accentColor="emerald"
              />

              {isCanvasTestCard && (
                <CanvasTestCardPreview
                  width={state.configuredWidth}
                  height={state.configuredHeight}
                />
              )}

              {/* Транспорт USB AOA и статистика TX/RX */}
              <div className="rounded-[14px] bg-[#1E2636] border border-[#222938] p-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-[#F1F5F9]">Транспорт USB AOA</span>
                  <span className="text-[11px] font-medium text-[#10B981]">
                    {state.wakeLockHeld ? 'WakeLock: ACTIVE' : 'LinkedBlockingQueue TX'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <MetricPill
                    label="RX КАДРЫ"
                    value={`${state.rxFrames}`}
                    subValue={`${state.rxBytes} B`}
                  />
                  <MetricPill
                    label="TX КАДРЫ"
                    value={`${state.txFrames}`}
                    subValue={`${state.txBytes} B`}
                  />
                  <MetricPill
                    label="H.264 NALS"
                    value={`${proj.encodedNalFrames}`}
                    subValue={`${Math.floor(proj.encodedBytes / 1024)} KiB`}
                  />
                </div>

                <div
                  data-testid="usb_tx_queue_stats"
                  className="rounded-[10px] bg-[#0B0E14] border border-[#222938] px-2.5 py-1.5 font-mono-jetbrains text-[10px] text-[#94A3B8] flex flex-col gap-0.5"
                >
                  <div className="text-[#00B4D8]">
                    {state.usbTxQueueStats.workerThreadName} • {state.usbTxQueueStats.threadPriority}
                  </div>
                  <div>
                    0x0003 Priority TX: {state.usbTxQueueStats.prioritizedAudioFrames} • 0x0002 Queue:{' '}
                    {state.usbTxQueueStats.queuedVideoFrames}/
                    {state.usbTxQueueStats.maxVideoQueueFrames} • Drop stale P-frames:{' '}
                    {state.usbTxQueueStats.droppedStalePFrames}
                  </div>
                  <div className="text-[#CBD5E1] break-all">
                    0x0006:{' '}
                    {proj.touchRouteTarget === 'SHIZUKU_INPUT_MANAGER'
                      ? `ICarLifeShizukuService.injectTouch(displayId=${proj.virtualDisplayId || 2}) -> InputManager`
                      : proj.touchRouteTarget === 'PRESENTATION_DECOR_VIEW'
                      ? `presentation.window.decorView.dispatchTouchEvent (lastDownTime=${proj.touchLastDownTimeMs ?? '—'})`
                      : 'CarLifeAccessibilityService.dispatchGesture (currentWindowMetrics.bounds)'}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={onScanAndAttachUsb}
                    data-testid="scan_connect_usb_button"
                    className="flex-1 h-10 rounded-[10px] bg-[#00B4D8] text-[#001D24] font-semibold text-[12px] flex items-center justify-center gap-1.5 hover:brightness-110 cursor-pointer"
                  >
                    <RefreshIcon className="w-[18px] h-[18px]" />
                    <span>Scan &amp; Attach USB AOA</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleProjection}
                    data-testid="toggle_projection_diag_btn"
                    className="h-10 px-3 rounded-[10px] border border-[#222938] bg-[#151A24] text-[#F1F5F9] text-[12px] font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <PlayArrowIcon className="w-4 h-4 text-[#10B981]" />
                    <span>{proj.isRunning ? 'Пауза видео' : 'Старт видео'}</span>
                  </button>

                  {state.isServiceRunning && (
                    <button
                      type="button"
                      onClick={onStopBridge}
                      data-testid="stop_bridge_button"
                      className="h-10 px-3.5 rounded-[10px] border border-[#222938] bg-[#151A24] text-[#EF4444] text-[12px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <StopIcon className="w-4 h-4" />
                      <span>Стоп</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Счётчики каналов 0x0001 .. 0x0006 */}
              <div className="rounded-[14px] bg-[#1E2636] border border-[#222938] p-3 flex flex-col gap-2">
                <div className="text-[13px] font-semibold text-[#F1F5F9]">
                  Счётчики каналов CarLife (0x0001 .. 0x0006)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {CARLIFE_CHANNELS.map((ch) => {
                    const count = state.channelFrameCounts[ch.id] ?? 0;
                    const badgeColor = ch.hasTimestampHeader ? '#10B981' : '#00B4D8';
                    return (
                      <div
                        key={ch.id}
                        className="rounded-[10px] bg-[#151A24] border border-[#222938] p-2.5 flex flex-col"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="font-mono-jetbrains text-[11px] font-medium"
                            style={{ color: badgeColor }}
                          >
                            {formatHex16(ch.id)}
                          </span>
                          <span className="font-mono-jetbrains text-[10px] text-[#64748B]">
                            {ch.headerSizeBytes}B HDR
                          </span>
                        </div>
                        <div className="text-[13px] font-semibold text-[#F1F5F9] mt-0.5 truncate">
                          {ch.label}
                        </div>
                        <div
                          className="text-[11px]"
                          style={{ color: count > 0 ? badgeColor : '#94A3B8' }}
                        >
                          {count} пакетов
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Заголовок видеоканала, профиль Jetta VS7 и Handshake Lab */}
              <div className="rounded-[14px] bg-[#1E2636] border border-[#222938] p-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-[#F1F5F9]">
                    Профиль протокола и заголовок 0x0002
                  </span>
                  <span className="text-[11px] font-medium text-[#10B981]">
                    ТЕСТ {state.handshakeTestProfileId}/4
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <SelectableOptionButton
                    label="Режим 1: AOA 20B (0x00020001)"
                    selected={state.useNestedVideoMsgHeader}
                    testTag="toggle_video_header_mode_btn"
                    onClick={() => onSetVideoHeaderMode(true)}
                    className="flex-[1.25]"
                  />
                  <SelectableOptionButton
                    label="Режим 2: Direct 12B"
                    selected={!state.useNestedVideoMsgHeader}
                    testTag="video_header_legacy_12b_btn"
                    onClick={() => onSetVideoHeaderMode(false)}
                    className="flex-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {HANDSHAKE_TEST_PROFILES.map((profile) => {
                    const isSelected = state.handshakeTestProfileId === profile.id;
                    return (
                      <SelectableOptionButton
                        key={profile.id}
                        label={profile.shortTitle}
                        selected={isSelected}
                        testTag={`handshake_profile_${profile.id}_btn`}
                        onClick={() => onSetHandshakeProfile(profile.id)}
                      />
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={onStartJettaVs7Vd}
                  data-testid="start_auto_test_btn"
                  className="w-full min-h-[42px] rounded-xl px-3 bg-[#151A24] border border-[#10B981]/60 text-[#10B981] font-semibold text-[12px] flex items-center justify-center gap-2 hover:bg-[#10B981]/10 transition cursor-pointer"
                >
                  <CheckCircleIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    Сброс на профиль Jetta VS7 (1280×720 • VBR 2.0 Мбит/с • 160 dpi)
                  </span>
                </button>
              </div>

              {/* Тестовые векторы протокола */}
              <div className="rounded-[14px] bg-[#1E2636] border border-[#222938] p-3 flex flex-col gap-2.5">
                <div className="text-[13px] font-semibold text-[#00B4D8]">
                  Тестовые векторы протокола Baidu CarLife
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLogTab(0);
                      onRunLoopbackVector('handshake');
                    }}
                    data-testid="test_control_frame_btn"
                    className="rounded-[10px] bg-[#151A24] border border-[#222938] hover:border-[#00B4D8]/60 p-2.5 flex items-center gap-2 text-left cursor-pointer"
                  >
                    <MemoryIcon className="w-5 h-5 text-[#00B4D8] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-[#F1F5F9] truncate">
                        1. Handshake
                      </div>
                      <div className="text-[10px] text-[#94A3B8] truncate">
                        HU v2.0 + Video Init
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLogTab(1);
                      onRunLoopbackVector('video');
                    }}
                    data-testid="test_video_frame_btn"
                    className="rounded-[10px] bg-[#151A24] border border-[#222938] hover:border-[#10B981]/60 p-2.5 flex items-center gap-2 text-left cursor-pointer"
                  >
                    <VideocamIcon className="w-5 h-5 text-[#10B981] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-[#F1F5F9] truncate">
                        2. Video (0x0002)
                      </div>
                      <div className="text-[10px] text-[#94A3B8] truncate">
                        H.264 SPS/PPS + IDR
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLogTab(0);
                      onRunLoopbackVector('touch');
                    }}
                    data-testid="test_touch_frame_btn"
                    className="rounded-[10px] bg-[#151A24] border border-[#222938] hover:border-[#F59E0B]/60 p-2.5 flex items-center gap-2 text-left cursor-pointer"
                  >
                    <TouchAppIcon className="w-5 h-5 text-[#F59E0B] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-[#F1F5F9] truncate">
                        3. Touch Scale
                      </div>
                      <div className="text-[10px] text-[#94A3B8] truncate">
                        1280x720 -&gt; 1920x1080
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLogTab(0);
                      onRunLoopbackVector('hardkey');
                    }}
                    data-testid="test_audio_frame_btn"
                    className="rounded-[10px] bg-[#151A24] border border-[#222938] hover:border-[#38BDF8]/60 p-2.5 flex items-center gap-2 text-left cursor-pointer"
                  >
                    <GraphicEqIcon className="w-5 h-5 text-[#38BDF8] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-[#F1F5F9] truncate">
                        4. HardKey
                      </div>
                      <div className="text-[10px] text-[#94A3B8] truncate">
                        Steering Wheel NEXT
                      </div>
                    </div>
                  </button>
                </div>

                <div className="rounded-[10px] bg-[#0B0E14] border border-[#222938] p-2.5 font-mono-jetbrains text-[11px] text-[#F1F5F9] whitespace-pre-wrap break-words leading-relaxed">
                  {lastDecodedBreakdown}
                </div>
              </div>

              {/* Журнал бинарных пакетов */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[13px] font-semibold text-[#00B4D8]">
                  Журнал бинарных пакетов
                </span>
                <button
                  type="button"
                  onClick={onClearLogs}
                  aria-label="Очистить логи"
                  data-testid="clear_logs_button"
                  className="p-2 rounded-lg text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#1E2636] cursor-pointer"
                >
                  <ClearAllIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <SelectableOptionButton
                  label={`Команды 0x0001 & 0x0006 (${state.commandPacketLogs.length})`}
                  selected={selectedLogTab === 0}
                  testTag="filter_rx_commands_chip"
                  onClick={() => setSelectedLogTab(0)}
                  className="flex-[1.25]"
                />
                <SelectableOptionButton
                  label={`Видеопоток 0x0002 (${state.videoPacketLogs.length})`}
                  selected={selectedLogTab === 1}
                  testTag="filter_all_packets_chip"
                  onClick={() => setSelectedLogTab(1)}
                  className="flex-[0.95]"
                />
              </div>

              {displayedLogs.length === 0 ? (
                <div className="rounded-xl bg-[#1E2636] border border-[#222938] p-4 text-center text-[12px] text-[#64748B]">
                  Пакеты ещё не записаны. Запустите тестовый вектор выше или подключите USB AOA.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {displayedLogs.map((entry) => (
                    <PacketLogItemCard key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
