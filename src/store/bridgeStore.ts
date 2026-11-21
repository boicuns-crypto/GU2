import {
  CarLifeChannelId,
  CarLifeMsgType,
  KEYCODE_BACK,
  KEYCODE_HOME,
  channelInfo,
} from '../protocol/carlifeConstants';
import {
  CarLifeControlSessionState,
  CarLifeControlStateMachine,
} from '../protocol/carlifeControlStateMachine';
import {
  CarLifeFrame,
  CarLifeFrameCodec,
  parseCommandMessageOrNull,
} from '../protocol/carlifeFrameCodec';
import {
  CarLifeTouchDecoder,
  CarLifeTouchEventType,
  TouchDispatchTarget,
  TouchRouteState,
  routeTouchEventByMode,
} from '../protocol/carlifeTouchDecoder';
import {
  CarlifeProtocolVersionProto,
  CarlifeVideoEncoderInfoProto,
} from '../protocol/carlifeWireProtobuf';
import {
  CarLifeShizukuServiceStub,
  SHIZUKU_PACKAGE_NAME,
  SHIZUKU_REQ_CODE,
  ShizukuServiceState,
  deriveShizukuStatus,
} from '../protocol/shizukuServiceBridge';

export enum AppMode {
  COCKPIT = 'cockpit',
  MIRRORING = 'mirroring',
  SHIZUKU_COCKPIT = 'shizuku_cockpit',
}

export const APP_MODE_META: Record<AppMode, { id: AppMode; title: string; subtitle: string }> = {
  [AppMode.COCKPIT]: {
    id: AppMode.COCKPIT,
    title: 'Кокпит',
    subtitle: 'Встроенный лаунчер на VirtualDisplay',
  },
  [AppMode.MIRRORING]: {
    id: AppMode.MIRRORING,
    title: 'Зеркалирование',
    subtitle: 'Захват экрана телефона через MediaProjection',
  },
  [AppMode.SHIZUKU_COCKPIT]: {
    id: AppMode.SHIZUKU_COCKPIT,
    title: 'Кокпит + Shizuku',
    subtitle: 'Независимый второй экран для любых приложений',
  },
};

export enum VideoSourceMode {
  SCREEN_MIRRORING = 'screen_mirroring',
  VIRTUAL_DISPLAY = 'virtual_display',
  CANVAS_TEST_CARD = 'canvas_test_card',
}

export const VIDEO_SOURCE_META: Record<
  VideoSourceMode,
  { id: VideoSourceMode; title: string; subtitle: string }
> = {
  [VideoSourceMode.SCREEN_MIRRORING]: {
    id: VideoSourceMode.SCREEN_MIRRORING,
    title: 'Зеркалирование экрана (MediaProjection)',
    subtitle:
      'Прямой захват реального экрана смартфона (1280×720@30fps, 2000 kbps) без Presentation + тач через AccessibilityService',
  },
  [VideoSourceMode.VIRTUAL_DISPLAY]: {
    id: VideoSourceMode.VIRTUAL_DISPLAY,
    title: 'Виртуальный экран (VD + Лаунчер)',
    subtitle:
      'Захват VirtualDisplay / MediaProjection + оверлей лаунчера CarLife (Presentation)',
  },
  [VideoSourceMode.CANVAS_TEST_CARD]: {
    id: VideoSourceMode.CANVAS_TEST_CARD,
    title: 'Тест-карта (Canvas)',
    subtitle:
      'Прямая отрисовка 30 fps в inputSurface без VirtualDisplay (JETTA VS7 TEST + время + FRAME #)',
  },
};

export enum AppLaunchMode {
  VIRTUAL_DISPLAY_IF_AVAILABLE = 'virtual_display',
  SCREEN_MIRRORING = 'screen_mirroring',
}

export const APP_LAUNCH_MODE_META: Record<
  AppLaunchMode,
  { id: AppLaunchMode; title: string; subtitle: string }
> = {
  [AppLaunchMode.VIRTUAL_DISPLAY_IF_AVAILABLE]: {
    id: AppLaunchMode.VIRTUAL_DISPLAY_IF_AVAILABLE,
    title: 'На VirtualDisplay (если доступно)',
    subtitle:
      'Сначала запуск через ActivityOptions(launchDisplayId); при SecurityException — мгновенный запасной запуск без ActivityOptions.',
  },
  [AppLaunchMode.SCREEN_MIRRORING]: {
    id: AppLaunchMode.SCREEN_MIRRORING,
    title: 'Зеркалирование экрана (MediaProjection)',
    subtitle:
      'Запуск приложений сразу на основном экране телефона без ActivityOptions для зеркалирования через MediaProjection.',
  },
};

export type UsbTransportState =
  | { kind: 'disconnected' }
  | { kind: 'connecting'; manufacturer: string; model: string }
  | { kind: 'connected'; manufacturer: string; model: string; fdNumber: number; connectedAt: number }
  | { kind: 'error'; reason: string };

export interface PacketLogEntry {
  id: number;
  timestampFormatted: string;
  direction: string;
  channel: CarLifeChannelId;
  headerSizeBytes: number;
  payloadSizeBytes: number;
  mediaTimestampMs: number;
  serviceName: string | null;
  hexPreview: string;
}

export interface MediaCodecEncoderConfig {
  width: number;
  height: number;
  frameRate: 25 | 30;
  bitrateBps: number;
  iFrameIntervalSec: 1;
  bitrateMode: 'BITRATE_MODE_VBR (1)';
  profile: 'AVCProfileBaseline (1)';
  level: 'AVCLevel3 (0x100)';
  repeatPreviousFrameAfterUs: 100_000;
  priority: 0;
  videoQpPMax: 36;
  virtualDisplayDensityDpi: 160 | 180 | 200;
}

export interface UsbTxQueueStats {
  workerThreadName: string;
  threadPriority: string;
  maxVideoQueueFrames: number;
  queuedAudioFrames: number;
  queuedVideoFrames: number;
  droppedStalePFrames: number;
  prioritizedAudioFrames: number;
}

export interface ProjectionPipelineStats {
  isRunning: boolean;
  appMode: AppMode;
  videoSourceMode: VideoSourceMode;
  usingMediaProjection: boolean;
  virtualDisplayId: number;
  width: number;
  height: number;
  fps: number;
  bitRateKbps: number;
  encodedNalFrames: number;
  encodedBytes: number;
  lastIdrBytes: number;
  spsPpsConfigured: boolean;
  injectedTouches: number;
  lastTouchPoint: [number, number] | null;
  touchRouteTarget: TouchDispatchTarget;
  touchLastDownTimeMs: number | null;
  activeCockpitWidget: string;
  statusMessage: string;
}

export interface AudioCaptureStats {
  isCapturing: boolean;
  hasRecordAudioPermission: boolean;
  mutePhoneSpeakerDuringUsbAudio: boolean;
  isPhoneSpeakerMutedByBridge: boolean;
  currentPhoneMusicVolume: number;
  savedPhoneMusicVolume: number | null;
  mediaInitSent: boolean;
  sentInitPackets: number;
  sentPcmPackets: number;
  skippedSilentPackets: number;
  sentPcmBytes: number;
  sentStopPackets: number;
  statusMessage: string;
}

export interface AutoTestState {
  isRunning: boolean;
  currentStep: number;
  totalSteps: number;
  activeProfileLabel: string;
  statusMessage: string;
  matchedProfileLabel: string | null;
  audioInitForced: boolean;
}

export interface SetupChecklistStatus {
  step1BatteryUnrestricted: boolean;
  step2OverlayGranted: boolean;
  step3AccessibilityEnabled: boolean;
  step4NotificationAccessGranted: boolean;
  step5MediaProjectionGranted: boolean;
  isUsbConnected: boolean;
}

export interface CockpitMediaState {
  hasNotificationAccess: boolean;
  activePackageName: string;
  playerAppTitle: string;
  trackTitle: string;
  artistName: string;
  albumName: string;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
}

export interface InstalledAppInfo {
  label: string;
  packageName: string;
  activityName: string;
  isAutomotivePriority: boolean;
  accentColor: string;
  badgeText: string;
  category: 'nav' | 'media' | 'browser' | 'utility';
}

export interface BridgeRuntimeState {
  isServiceRunning: boolean;
  wakeLockHeld: boolean;
  transportState: UsbTransportState;
  controlSession: CarLifeControlSessionState;
  projectionStats: ProjectionPipelineStats;
  audioCaptureStats: AudioCaptureStats;
  mediaCodecConfig: MediaCodecEncoderConfig;
  usbTxQueueStats: UsbTxQueueStats;
  shizukuState: ShizukuServiceState;
  isVideoChannelReadyForStreaming: boolean;
  useNestedVideoMsgHeader: boolean;
  appMode: AppMode;
  logPacketsInUi: boolean;
  transmitAudioOverUsb: boolean;
  mutePhoneSpeakerDuringUsbAudio: boolean;
  autoStartOnUsbAttach: boolean;
  keepPhoneScreenOn: boolean;
  forceLandscapeMirroring: boolean;
  launcherVisiblePackages: string[];
  shizukuVdNavButtonsEnabled: boolean;
  shizukuVdNavButtonsLayout: 'dock' | 'floating';
  videoSourceMode: VideoSourceMode;
  appLaunchMode: AppLaunchMode;
  handshakeTestProfileId: number;
  configuredWidth: number;
  configuredHeight: number;
  configuredFps: 25 | 30;
  configuredBitrateBps: number;
  virtualDisplayDensityDpi: 160 | 180 | 200;
  autoTestState: AutoTestState;
  lastTouchOrKeyEvent: string;
  rxBytes: number;
  txBytes: number;
  rxFrames: number;
  txFrames: number;
  channelFrameCounts: Record<CarLifeChannelId, number>;
  commandPacketLogs: PacketLogEntry[];
  videoPacketLogs: PacketLogEntry[];
  lastProtocolEvent: string;
}

export interface DemoTrack {
  player: string;
  pkg: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
}

export const FALLBACK_PLAYLIST: DemoTrack[] = [
  {
    player: 'Yandex Music • CarLife Audio',
    pkg: 'ru.yandex.music',
    title: 'Nightcall (MQB Cockpit Mix)',
    artist: 'Kavinsky',
    album: 'OutRun',
    durationMs: 258_000,
  },
  {
    player: 'Spotify • Lossless Stream',
    pkg: 'com.spotify.music',
    title: 'Midnight City',
    artist: 'M83',
    album: "Hurry Up, We're Dreaming",
    durationMs: 243_000,
  },
  {
    player: 'Poweramp • Direct Hi-Res',
    pkg: 'com.maxmpz.audioplayer',
    title: 'Horizon',
    artist: 'Daft Punk',
    album: 'Random Access Memories',
    durationMs: 264_000,
  },
  {
    player: 'Yandex Music • My Vibe',
    pkg: 'ru.yandex.music',
    title: 'Veridis Quo',
    artist: 'Daft Punk',
    album: 'Discovery',
    durationMs: 345_000,
  },
];

export const COCKPIT_INSTALLED_APPS: InstalledAppInfo[] = [
  {
    label: 'Яндекс Навигатор',
    packageName: 'ru.yandex.yandexnavi',
    activityName: 'ru.yandex.yandexnavi.NaviActivity',
    isAutomotivePriority: true,
    accentColor: '#F59E0B',
    badgeText: 'НАВ',
    category: 'nav',
  },
  {
    label: 'Яндекс Карты',
    packageName: 'ru.yandex.yandexmaps',
    activityName: 'ru.yandex.yandexmaps.MapActivity',
    isAutomotivePriority: true,
    accentColor: '#EF4444',
    badgeText: 'MAP',
    category: 'nav',
  },
  {
    label: '2ГИС',
    packageName: 'ru.dublgis.dgismobile',
    activityName: 'ru.dublgis.dgismobile.MainActivity',
    isAutomotivePriority: true,
    accentColor: '#10B981',
    badgeText: '2GIS',
    category: 'nav',
  },
  {
    label: 'Google Maps',
    packageName: 'com.google.android.apps.maps',
    activityName: 'com.google.android.maps.MapsActivity',
    isAutomotivePriority: true,
    accentColor: '#38BDF8',
    badgeText: 'GM',
    category: 'nav',
  },
  {
    label: 'Яндекс Музыка',
    packageName: 'ru.yandex.music',
    activityName: 'ru.yandex.music.MainActivity',
    isAutomotivePriority: true,
    accentColor: '#FBBF24',
    badgeText: 'ЯМ',
    category: 'media',
  },
  {
    label: 'Spotify',
    packageName: 'com.spotify.music',
    activityName: 'com.spotify.music.MainActivity',
    isAutomotivePriority: true,
    accentColor: '#1DB954',
    badgeText: 'SP',
    category: 'media',
  },
  {
    label: 'Poweramp',
    packageName: 'com.maxmpz.audioplayer',
    activityName: 'com.maxmpz.audioplayer.StartupActivity',
    isAutomotivePriority: true,
    accentColor: '#00B4D8',
    badgeText: 'PA',
    category: 'media',
  },
  {
    label: 'YouTube Music',
    packageName: 'com.google.android.apps.youtube.music',
    activityName: 'com.google.android.apps.youtube.music.Activities.MusicActivity',
    isAutomotivePriority: true,
    accentColor: '#EF4444',
    badgeText: 'YTM',
    category: 'media',
  },
  {
    label: 'YouTube',
    packageName: 'com.google.android.youtube',
    activityName: 'com.google.android.youtube.HomeActivity',
    isAutomotivePriority: true,
    accentColor: '#F87171',
    badgeText: 'YT',
    category: 'media',
  },
  {
    label: 'Chrome',
    packageName: 'com.android.chrome',
    activityName: 'com.google.android.apps.chrome.Main',
    isAutomotivePriority: true,
    accentColor: '#60A5FA',
    badgeText: 'CHR',
    category: 'browser',
  },
  {
    label: 'Samsung Internet',
    packageName: 'com.sec.android.app.sbrowser',
    activityName: 'com.sec.android.app.sbrowser.SBrowserMainActivity',
    isAutomotivePriority: true,
    accentColor: '#818CF8',
    badgeText: 'SBR',
    category: 'browser',
  },
  {
    label: 'VLC Player',
    packageName: 'org.videolan.vlc',
    activityName: 'org.videolan.vlc.StartActivity',
    isAutomotivePriority: true,
    accentColor: '#FB923C',
    badgeText: 'VLC',
    category: 'media',
  },
  {
    label: 'Телефон (HFP)',
    packageName: 'com.samsung.android.dialer',
    activityName: 'com.samsung.android.dialer.DialtactsActivity',
    isAutomotivePriority: false,
    accentColor: '#10B981',
    badgeText: 'TEL',
    category: 'utility',
  },
  {
    label: 'Telegram',
    packageName: 'org.telegram.messenger',
    activityName: 'org.telegram.ui.LaunchActivity',
    isAutomotivePriority: false,
    accentColor: '#38BDF8',
    badgeText: 'TG',
    category: 'utility',
  },
  {
    label: 'Антирадар HUD',
    packageName: 'com.hudway.radar',
    activityName: 'com.hudway.radar.MainActivity',
    isAutomotivePriority: false,
    accentColor: '#F59E0B',
    badgeText: 'HUD',
    category: 'utility',
  },
  {
    label: 'Настройки S26U',
    packageName: 'com.android.settings',
    activityName: 'com.android.settings.Settings',
    isAutomotivePriority: false,
    accentColor: '#94A3B8',
    badgeText: 'SET',
    category: 'utility',
  },
];

const STORAGE_KEY_CHECKLIST = 'carlife_bridge_checklist_v1';
const STORAGE_KEY_SETTINGS = 'carlife_bridge_settings_v1';

const DEFAULT_LAUNCHER_PACKAGES = COCKPIT_INSTALLED_APPS.map((a) => a.packageName);

interface PersistedSettings {
  appMode: AppMode;
  logPacketsInUi: boolean;
  transmitAudioOverUsb: boolean;
  mutePhoneSpeakerDuringUsbAudio: boolean;
  autoStartOnUsbAttach: boolean;
  keepPhoneScreenOn: boolean;
  forceLandscapeMirroring: boolean;
  launcherVisiblePackages: string[];
  shizukuVdNavButtonsEnabled: boolean;
  shizukuVdNavButtonsLayout: 'dock' | 'floating';
  videoSourceMode: VideoSourceMode;
  appLaunchMode: AppLaunchMode;
  handshakeTestProfileId: number;
  configuredWidth: number;
  configuredHeight: number;
  configuredFps: 25 | 30;
  configuredBitrateBps: number;
  virtualDisplayDensityDpi: 160 | 180 | 200;
  useNestedVideoMsgHeader: boolean;
  shizukuBinderAlive: boolean;
  shizukuPermissionGranted: boolean;
}

function loadChecklistFromStorage(): SetupChecklistStatus {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHECKLIST);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SetupChecklistStatus>;
      return {
        step1BatteryUnrestricted: Boolean(parsed.step1BatteryUnrestricted),
        step2OverlayGranted: Boolean(parsed.step2OverlayGranted),
        step3AccessibilityEnabled: Boolean(parsed.step3AccessibilityEnabled),
        step4NotificationAccessGranted: Boolean(parsed.step4NotificationAccessGranted),
        step5MediaProjectionGranted: Boolean(parsed.step5MediaProjectionGranted),
        isUsbConnected: false,
      };
    }
  } catch {
    // Ignore storage parse failure
  }
  return {
    step1BatteryUnrestricted: false,
    step2OverlayGranted: false,
    step3AccessibilityEnabled: false,
    step4NotificationAccessGranted: false,
    step5MediaProjectionGranted: false,
    isUsbConnected: false,
  };
}

function loadSettingsFromStorage(): PersistedSettings {
  const defaults: PersistedSettings = {
    appMode: AppMode.MIRRORING,
    logPacketsInUi: false,
    transmitAudioOverUsb: true,
    mutePhoneSpeakerDuringUsbAudio: true,
    autoStartOnUsbAttach: true,
    keepPhoneScreenOn: true,
    forceLandscapeMirroring: false,
    launcherVisiblePackages: DEFAULT_LAUNCHER_PACKAGES,
    shizukuVdNavButtonsEnabled: true,
    shizukuVdNavButtonsLayout: 'dock',
    videoSourceMode: VideoSourceMode.SCREEN_MIRRORING,
    appLaunchMode: AppLaunchMode.VIRTUAL_DISPLAY_IF_AVAILABLE,
    handshakeTestProfileId: 4,
    configuredWidth: 1280,
    configuredHeight: 720,
    configuredFps: 30,
    configuredBitrateBps: 2_000_000,
    virtualDisplayDensityDpi: 160,
    useNestedVideoMsgHeader: true,
    shizukuBinderAlive: true,
    shizukuPermissionGranted: false,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
    const appMode =
      parsed.appMode === AppMode.COCKPIT
        ? AppMode.COCKPIT
        : parsed.appMode === AppMode.SHIZUKU_COCKPIT
        ? AppMode.SHIZUKU_COCKPIT
        : AppMode.MIRRORING;
    const validPkgSet = new Set(DEFAULT_LAUNCHER_PACKAGES);
    const parsedPkgs = Array.isArray(parsed.launcherVisiblePackages)
      ? parsed.launcherVisiblePackages.filter((p): p is string => typeof p === 'string' && validPkgSet.has(p))
      : DEFAULT_LAUNCHER_PACKAGES;
    return {
      appMode,
      logPacketsInUi: parsed.logPacketsInUi === true,
      transmitAudioOverUsb:
        parsed.transmitAudioOverUsb !== undefined ? Boolean(parsed.transmitAudioOverUsb) : true,
      mutePhoneSpeakerDuringUsbAudio:
        parsed.mutePhoneSpeakerDuringUsbAudio !== undefined
          ? Boolean(parsed.mutePhoneSpeakerDuringUsbAudio)
          : true,
      autoStartOnUsbAttach:
        parsed.autoStartOnUsbAttach !== undefined ? Boolean(parsed.autoStartOnUsbAttach) : true,
      keepPhoneScreenOn:
        parsed.keepPhoneScreenOn !== undefined ? Boolean(parsed.keepPhoneScreenOn) : true,
      forceLandscapeMirroring: Boolean(parsed.forceLandscapeMirroring),
      launcherVisiblePackages: parsedPkgs.length > 0 ? parsedPkgs : DEFAULT_LAUNCHER_PACKAGES,
      shizukuVdNavButtonsEnabled:
        parsed.shizukuVdNavButtonsEnabled !== undefined
          ? Boolean(parsed.shizukuVdNavButtonsEnabled)
          : true,
      shizukuVdNavButtonsLayout: parsed.shizukuVdNavButtonsLayout === 'floating' ? 'floating' : 'dock',
      videoSourceMode: Object.values(VideoSourceMode).includes(parsed.videoSourceMode as VideoSourceMode)
        ? (parsed.videoSourceMode as VideoSourceMode)
        : VideoSourceMode.SCREEN_MIRRORING,
      appLaunchMode:
        parsed.appLaunchMode === AppLaunchMode.SCREEN_MIRRORING
          ? AppLaunchMode.SCREEN_MIRRORING
          : AppLaunchMode.VIRTUAL_DISPLAY_IF_AVAILABLE,
      handshakeTestProfileId:
        typeof parsed.handshakeTestProfileId === 'number' &&
        parsed.handshakeTestProfileId >= 1 &&
        parsed.handshakeTestProfileId <= 4
          ? parsed.handshakeTestProfileId
          : 4,
      configuredWidth:
        typeof parsed.configuredWidth === 'number' ? parsed.configuredWidth : 1280,
      configuredHeight:
        typeof parsed.configuredHeight === 'number' ? parsed.configuredHeight : 720,
      configuredFps: parsed.configuredFps === 25 ? 25 : 30,
      configuredBitrateBps:
        typeof parsed.configuredBitrateBps === 'number' ? parsed.configuredBitrateBps : 2_000_000,
      virtualDisplayDensityDpi:
        parsed.virtualDisplayDensityDpi === 180 || parsed.virtualDisplayDensityDpi === 200
          ? parsed.virtualDisplayDensityDpi
          : 160,
      useNestedVideoMsgHeader:
        parsed.useNestedVideoMsgHeader !== undefined ? Boolean(parsed.useNestedVideoMsgHeader) : true,
      shizukuBinderAlive:
        parsed.shizukuBinderAlive !== undefined ? Boolean(parsed.shizukuBinderAlive) : true,
      shizukuPermissionGranted: Boolean(parsed.shizukuPermissionGranted),
    };
  } catch {
    return defaults;
  }
}

export function formatTimeStampMs(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

export interface BridgeControllerSnapshot {
  runtimeState: BridgeRuntimeState;
  checklistStatus: SetupChecklistStatus;
  mediaState: CockpitMediaState;
  lastLaunchStatus: string;
  lastDecodedBreakdown: string;
  mediaStream: MediaStream | null;
}

export class BridgeController {
  private runtimeState: BridgeRuntimeState;
  private checklist: SetupChecklistStatus;
  private mediaState: CockpitMediaState;
  private lastLaunchStatus = 'Лаунчер ГУ активен — готов к выводу на VirtualDisplay автомобиля';
  private lastDecodedBreakdown =
    'Выберите тестовый вектор ниже для проверки бинарного кадра через CarLifeFrameCodec и декодер тачскрина.';
  private stateMachine: CarLifeControlStateMachine;
  private logSequence = 0;
  private fallbackTrackIndex = 0;
  private listeners = new Set<() => void>();
  private mediaStream: MediaStream | null = null;
  private streamTimer: number | null = null;
  private audioTimer: number | null = null;
  private mediaTicker: number | null = null;
  private touchRouteState: TouchRouteState = {
    lastDownTimeMs: null,
    activeGestureDown: false,
  };
  private shizukuService = new CarLifeShizukuServiceStub();
  private snapshot: BridgeControllerSnapshot;

  constructor() {
    const savedSettings = loadSettingsFromStorage();
    this.checklist = loadChecklistFromStorage();
    CarLifeFrameCodec.useNestedVideoMsgHeader = savedSettings.useNestedVideoMsgHeader;
    this.stateMachine = new CarLifeControlStateMachine(
      savedSettings.configuredWidth,
      savedSettings.configuredHeight,
      savedSettings.handshakeTestProfileId
    );

    this.mediaState = {
      hasNotificationAccess: this.checklist.step4NotificationAccessGranted,
      activePackageName: FALLBACK_PLAYLIST[0].pkg,
      playerAppTitle: FALLBACK_PLAYLIST[0].player,
      trackTitle: FALLBACK_PLAYLIST[0].title,
      artistName: FALLBACK_PLAYLIST[0].artist,
      albumName: FALLBACK_PLAYLIST[0].album,
      isPlaying: true,
      positionMs: 84_000,
      durationMs: FALLBACK_PLAYLIST[0].durationMs,
    };

    const mediaCodecConfig: MediaCodecEncoderConfig = {
      width: savedSettings.configuredWidth,
      height: savedSettings.configuredHeight,
      frameRate: savedSettings.configuredFps,
      bitrateBps: savedSettings.configuredBitrateBps,
      iFrameIntervalSec: 1,
      bitrateMode: 'BITRATE_MODE_VBR (1)',
      profile: 'AVCProfileBaseline (1)',
      level: 'AVCLevel3 (0x100)',
      repeatPreviousFrameAfterUs: 100_000,
      priority: 0,
      videoQpPMax: 36,
      virtualDisplayDensityDpi: savedSettings.virtualDisplayDensityDpi,
    };

    const shizukuDerived = deriveShizukuStatus(
      savedSettings.shizukuBinderAlive,
      savedSettings.shizukuPermissionGranted
    );
    const shouldBindShizuku =
      savedSettings.appMode === AppMode.SHIZUKU_COCKPIT &&
      savedSettings.shizukuBinderAlive &&
      savedSettings.shizukuPermissionGranted;
    if (shouldBindShizuku) {
      this.shizukuService.bind();
    }
    const vdIdInit =
      savedSettings.appMode === AppMode.SHIZUKU_COCKPIT ||
      savedSettings.videoSourceMode === VideoSourceMode.VIRTUAL_DISPLAY
        ? 2
        : 0;
    const touchTargetInit: TouchDispatchTarget =
      savedSettings.appMode === AppMode.SHIZUKU_COCKPIT
        ? 'SHIZUKU_INPUT_MANAGER'
        : savedSettings.appMode === AppMode.COCKPIT
        ? 'PRESENTATION_DECOR_VIEW'
        : 'ACCESSIBILITY_DISPATCH_GESTURE';

    this.runtimeState = {
      isServiceRunning: true,
      wakeLockHeld: false,
      transportState: { kind: 'disconnected' },
      controlSession: this.stateMachine.state,
      mediaCodecConfig,
      usbTxQueueStats: {
        workerThreadName: 'CarLife-USB-TX-Thread',
        threadPriority: 'URGENT_AUDIO (-19)',
        maxVideoQueueFrames: 5,
        queuedAudioFrames: 0,
        queuedVideoFrames: 0,
        droppedStalePFrames: 0,
        prioritizedAudioFrames: 0,
      },
      shizukuState: {
        binderAlive: savedSettings.shizukuBinderAlive,
        permissionGranted: savedSettings.shizukuPermissionGranted,
        userServiceBound: shouldBindShizuku,
        statusKind: shizukuDerived.kind,
        statusLabel: shizukuDerived.label,
        userServiceComponent: 'CarLifeShizukuService : ICarLifeShizukuService.Stub()',
        boundDisplayId: vdIdInit || 2,
        lastAidlCall: shouldBindShizuku
          ? `Shizuku.bindUserService(CarLifeShizukuService) -> displayId=${vdIdInit || 2}`
          : 'Ожидает привязки ShizukuUserService (ICarLifeShizukuService.aidl)',
        amStartCount: 0,
        injectedTouchCount: 0,
        keyEventCount: 0,
      },
      projectionStats: {
        isRunning: true,
        appMode: savedSettings.appMode,
        videoSourceMode: savedSettings.videoSourceMode,
        usingMediaProjection: this.checklist.step5MediaProjectionGranted,
        virtualDisplayId: vdIdInit,
        width: savedSettings.configuredWidth,
        height: savedSettings.configuredHeight,
        fps: savedSettings.configuredFps,
        bitRateKbps: Math.round(savedSettings.configuredBitrateBps / 1000),
        encodedNalFrames: 0,
        encodedBytes: 0,
        lastIdrBytes: 0,
        spsPpsConfigured: false,
        injectedTouches: 0,
        lastTouchPoint: null,
        touchRouteTarget: touchTargetInit,
        touchLastDownTimeMs: null,
        activeCockpitWidget:
          savedSettings.videoSourceMode === VideoSourceMode.SCREEN_MIRRORING
            ? 'Зеркалирование экрана (MediaProjection) готово'
            : savedSettings.videoSourceMode === VideoSourceMode.VIRTUAL_DISPLAY
            ? 'Виртуальный экран (VD #2) активен'
            : 'Тест-карта (Canvas) активна',
        statusMessage: `${
          savedSettings.videoSourceMode === VideoSourceMode.SCREEN_MIRRORING
            ? 'Зеркалирование экрана'
            : savedSettings.videoSourceMode === VideoSourceMode.VIRTUAL_DISPLAY
            ? 'Виртуальный экран VD'
            : 'Тест-карта Canvas'
        } (${savedSettings.configuredWidth}×${savedSettings.configuredHeight} @ ${(
          savedSettings.configuredBitrateBps / 1_000_000
        ).toFixed(1)} Мбит/с, VBR ${savedSettings.configuredFps}fps, L3, QP≤36, ${
          savedSettings.virtualDisplayDensityDpi
        } dpi, ${savedSettings.useNestedVideoMsgHeader ? 'AOA 20B' : 'Direct 12B'})`,
      },
      audioCaptureStats: {
        isCapturing: false,
        hasRecordAudioPermission: true,
        mutePhoneSpeakerDuringUsbAudio: savedSettings.mutePhoneSpeakerDuringUsbAudio,
        isPhoneSpeakerMutedByBridge: false,
        currentPhoneMusicVolume: 9,
        savedPhoneMusicVolume: 9,
        mediaInitSent: false,
        sentInitPackets: 0,
        sentPcmPackets: 0,
        skippedSilentPackets: 0,
        sentPcmBytes: 0,
        sentStopPackets: 0,
        statusMessage:
          'Аудио 0x0003: ожидание MediaProjection и разрешения RECORD_AUDIO (48 кГц Stereo 16-bit PCM)',
      },
      isVideoChannelReadyForStreaming: false,
      useNestedVideoMsgHeader: savedSettings.useNestedVideoMsgHeader,
      appMode: savedSettings.appMode,
      logPacketsInUi: savedSettings.logPacketsInUi,
      transmitAudioOverUsb: savedSettings.transmitAudioOverUsb,
      mutePhoneSpeakerDuringUsbAudio: savedSettings.mutePhoneSpeakerDuringUsbAudio,
      autoStartOnUsbAttach: savedSettings.autoStartOnUsbAttach,
      keepPhoneScreenOn: savedSettings.keepPhoneScreenOn,
      forceLandscapeMirroring: savedSettings.forceLandscapeMirroring,
      launcherVisiblePackages: savedSettings.launcherVisiblePackages,
      shizukuVdNavButtonsEnabled: savedSettings.shizukuVdNavButtonsEnabled,
      shizukuVdNavButtonsLayout: savedSettings.shizukuVdNavButtonsLayout,
      videoSourceMode: savedSettings.videoSourceMode,
      appLaunchMode: savedSettings.appLaunchMode,
      handshakeTestProfileId: savedSettings.handshakeTestProfileId,
      configuredWidth: savedSettings.configuredWidth,
      configuredHeight: savedSettings.configuredHeight,
      configuredFps: savedSettings.configuredFps,
      configuredBitrateBps: savedSettings.configuredBitrateBps,
      virtualDisplayDensityDpi: savedSettings.virtualDisplayDensityDpi,
      autoTestState: {
        isRunning: false,
        currentStep: 0,
        totalSteps: 0,
        activeProfileLabel: `${savedSettings.configuredWidth}×${savedSettings.configuredHeight} • 2.0 Мбит/с • VBR ${savedSettings.configuredFps}fps • L3 • ${savedSettings.virtualDisplayDensityDpi} dpi • AOA 20B`,
        statusMessage: `Профиль MediaFormatUtils: ${savedSettings.configuredWidth}×${savedSettings.configuredHeight} • VBR (1) 2.0 Мбит/с • ${savedSettings.configuredFps}fps • Baseline L3 • QP≤36 • ${savedSettings.virtualDisplayDensityDpi} dpi`,
        matchedProfileLabel: `${savedSettings.configuredWidth}×${savedSettings.configuredHeight} • 2.0 Мбит/с • VBR ${savedSettings.configuredFps}fps • ${savedSettings.virtualDisplayDensityDpi} dpi • AOA 20B (0x00020001)`,
        audioInitForced: true,
      },
      lastTouchOrKeyEvent: 'None — Waiting for Touch/Hardkey Channel (0x0006)',
      rxBytes: 0,
      txBytes: 0,
      rxFrames: 0,
      txFrames: 0,
      channelFrameCounts: {
        [CarLifeChannelId.CONTROL]: 0,
        [CarLifeChannelId.VIDEO]: 0,
        [CarLifeChannelId.MEDIA_AUDIO]: 0,
        [CarLifeChannelId.TTS_AUDIO]: 0,
        [CarLifeChannelId.VR_AUDIO]: 0,
        [CarLifeChannelId.TOUCH]: 0,
      },
      commandPacketLogs: [],
      videoPacketLogs: [],
      lastProtocolEvent:
        'Idle — Waiting for Jetta VS7 (MQB) Baidu CarLife USB AOA attachment',
    };

    this.snapshot = {
      runtimeState: this.runtimeState,
      checklistStatus: this.checklist,
      mediaState: this.mediaState,
      lastLaunchStatus: this.lastLaunchStatus,
      lastDecodedBreakdown: this.lastDecodedBreakdown,
      mediaStream: this.mediaStream,
    };

    this.mediaTicker = window.setInterval(() => {
      if (this.mediaState.isPlaying) {
        const nextPos = this.mediaState.positionMs + 1000;
        if (nextPos >= this.mediaState.durationMs) {
          this.skipNextTrack();
        } else {
          this.mediaState = { ...this.mediaState, positionMs: nextPos };
          this.emit();
        }
      }
    }, 1000);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  dispose(): void {
    if (this.mediaTicker !== null) {
      window.clearInterval(this.mediaTicker);
      this.mediaTicker = null;
    }
    this.stopStreamingTelemetryTimers();
  }

  private emit(): void {
    this.snapshot = {
      runtimeState: this.runtimeState,
      checklistStatus: this.checklist,
      mediaState: this.mediaState,
      lastLaunchStatus: this.lastLaunchStatus,
      lastDecodedBreakdown: this.lastDecodedBreakdown,
      mediaStream: this.mediaStream,
    };
    this.listeners.forEach((l) => l());
  }

  private persistSettings(): void {
    try {
      const data: PersistedSettings = {
        appMode: this.runtimeState.appMode,
        logPacketsInUi: this.runtimeState.logPacketsInUi,
        transmitAudioOverUsb: this.runtimeState.transmitAudioOverUsb,
        mutePhoneSpeakerDuringUsbAudio: this.runtimeState.mutePhoneSpeakerDuringUsbAudio,
        autoStartOnUsbAttach: this.runtimeState.autoStartOnUsbAttach,
        keepPhoneScreenOn: this.runtimeState.keepPhoneScreenOn,
        forceLandscapeMirroring: this.runtimeState.forceLandscapeMirroring,
        launcherVisiblePackages: this.runtimeState.launcherVisiblePackages,
        shizukuVdNavButtonsEnabled: this.runtimeState.shizukuVdNavButtonsEnabled,
        shizukuVdNavButtonsLayout: this.runtimeState.shizukuVdNavButtonsLayout,
        videoSourceMode: this.runtimeState.videoSourceMode,
        appLaunchMode: this.runtimeState.appLaunchMode,
        handshakeTestProfileId: this.runtimeState.handshakeTestProfileId,
        configuredWidth: this.runtimeState.configuredWidth,
        configuredHeight: this.runtimeState.configuredHeight,
        configuredFps: this.runtimeState.configuredFps,
        configuredBitrateBps: this.runtimeState.configuredBitrateBps,
        virtualDisplayDensityDpi: this.runtimeState.virtualDisplayDensityDpi,
        useNestedVideoMsgHeader: this.runtimeState.useNestedVideoMsgHeader,
        shizukuBinderAlive: this.runtimeState.shizukuState.binderAlive,
        shizukuPermissionGranted: this.runtimeState.shizukuState.permissionGranted,
      };
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(data));
    } catch {
      // Ignore storage error
    }
  }

  private persistChecklist(): void {
    try {
      localStorage.setItem(STORAGE_KEY_CHECKLIST, JSON.stringify(this.checklist));
    } catch {
      // Ignore storage error
    }
  }

  getSnapshot = (): BridgeControllerSnapshot => {
    return this.snapshot;
  };

  // --- Checklist Steps ---
  toggleChecklistStep(
    step:
      | 'step1BatteryUnrestricted'
      | 'step2OverlayGranted'
      | 'step3AccessibilityEnabled'
      | 'step4NotificationAccessGranted'
  ): void {
    const nextVal = !this.checklist[step];
    this.checklist = { ...this.checklist, [step]: nextVal };
    if (step === 'step4NotificationAccessGranted') {
      this.mediaState = { ...this.mediaState, hasNotificationAccess: nextVal };
    }
    this.persistChecklist();
    this.emit();
  }

  async requestMediaProjection(): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getDisplayMedia) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: true,
        });
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach((t) => t.stop());
        }
        this.mediaStream = stream;
        stream.getVideoTracks()[0]?.addEventListener('ended', () => {
          this.mediaStream = null;
          this.checklist = { ...this.checklist, step5MediaProjectionGranted: false };
          this.runtimeState = {
            ...this.runtimeState,
            projectionStats: {
              ...this.runtimeState.projectionStats,
              usingMediaProjection: false,
            },
            lastProtocolEvent: 'Захват экрана (MediaProjection) завершён пользователем',
          };
          this.persistChecklist();
          this.emit();
        });
      } catch {
        // Browser environment or iframe denied getDisplayMedia — toggle simulation token gracefully
      }
    }

    const granted = this.mediaStream !== null ? true : !this.checklist.step5MediaProjectionGranted;
    this.checklist = { ...this.checklist, step5MediaProjectionGranted: granted };
    this.runtimeState = {
      ...this.runtimeState,
      projectionStats: {
        ...this.runtimeState.projectionStats,
        usingMediaProjection: granted,
        isRunning: granted || this.runtimeState.videoSourceMode !== VideoSourceMode.SCREEN_MIRRORING,
      },
      lastProtocolEvent: granted
        ? 'MediaProjection («Весь экран») активирован — готов к потоку H.264'
        : 'MediaProjection приостановлен',
    };
    this.persistChecklist();
    this.emit();
  }

  // --- USB AOA Connect / Scan / Stop ---
  async scanAndAttachUsb(): Promise<void> {
    // Try WebUSB accessory probe if available (non-blocking if unsupported or cancelled)
    let detectedLabel = 'FAW-VW Jetta VS7 (MQB MIB)';
    const navWithUsb = navigator as Navigator & {
      usb?: { requestDevice: (opts: { filters: Array<{ vendorId?: number }> }) => Promise<{ productName?: string; manufacturerName?: string }> };
    };
    if (navWithUsb.usb) {
      try {
        const dev = await navWithUsb.usb.requestDevice({ filters: [] });
        if (dev) {
          detectedLabel = `${dev.manufacturerName || 'Volkswagen'} ${dev.productName || 'Jetta VS7'}`;
        }
      } catch {
        // Standard fallback to Jetta VS7 AOA session simulation
      }
    }

    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        await (navigator as Navigator & { wakeLock: { request: (t: string) => Promise<unknown> } }).wakeLock.request('screen');
      } catch {
        // Ignore wakeLock rejection in headless/iframe
      }
    }

    this.runtimeState = {
      ...this.runtimeState,
      isServiceRunning: true,
      wakeLockHeld: true,
      transportState: { kind: 'connecting', manufacturer: 'FAW-VW', model: detectedLabel },
      lastProtocolEvent: `Opening AOA Direct-IO FileChannel (${detectedLabel})...`,
    };
    this.emit();

    // Perform real binary protocol handshake via CarLifeFrameCodec + CarLifeControlStateMachine
    const versionReq = CarLifeFrameCodec.createCommandFrame(
      CarLifeChannelId.CONTROL,
      CarLifeMsgType.MSG_CMD_HU_PROTOCOL_VERSION,
      CarlifeProtocolVersionProto.encode({ majorVersion: 2, minorVersion: 0 })
    );
    const huBytes = CarLifeFrameCodec.encodeFrame(versionReq);
    this.recordFrame('RX (HU -> S26U)', versionReq, huBytes.length, 0, true);
    const transition1 = this.stateMachine.onControlFrame(versionReq);
    for (const out of transition1.outboundFrames) {
      const encoded = CarLifeFrameCodec.encodeFrame(out);
      this.recordFrame('TX (S26U -> HU)', out, 0, encoded.length, true);
    }

    if (this.runtimeState.handshakeTestProfileId === 4) {
      const audioInit = CarLifeFrameCodec.createMediaInitFrame();
      const audioBytes = CarLifeFrameCodec.encodeFrame(audioInit);
      this.recordFrame('TX (S26U -> HU)', audioInit, 0, audioBytes.length, true, 'MSG_MEDIA_INIT (48kHz Stereo)');

      const autoResult = this.stateMachine.buildAutoVideoEncoderInitAndStartFrames(
        this.runtimeState.configuredWidth,
        this.runtimeState.configuredHeight,
        this.runtimeState.configuredFps,
        'Профиль Jetta VS7',
        true
      );
      for (const out of autoResult.outboundFrames) {
        const encoded = CarLifeFrameCodec.encodeFrame(out);
        this.recordFrame('TX (S26U -> HU)', out, 0, encoded.length, true);
      }

      const savedVol =
        this.runtimeState.audioCaptureStats.savedPhoneMusicVolume ??
        this.runtimeState.audioCaptureStats.currentPhoneMusicVolume;
      const audioAllowed = this.runtimeState.transmitAudioOverUsb;
      const shouldMute = audioAllowed && this.runtimeState.mutePhoneSpeakerDuringUsbAudio;

      this.checklist = { ...this.checklist, isUsbConnected: true };
      this.runtimeState = {
        ...this.runtimeState,
        transportState: {
          kind: 'connected',
          manufacturer: 'FAW-VW',
          model: detectedLabel,
          fdNumber: 64,
          connectedAt: Date.now(),
        },
        controlSession: this.stateMachine.state,
        isVideoChannelReadyForStreaming: true,
        projectionStats: {
          ...this.runtimeState.projectionStats,
          isRunning: true,
          fps: this.runtimeState.configuredFps,
          spsPpsConfigured: true,
        },
        audioCaptureStats: {
          ...this.runtimeState.audioCaptureStats,
          isCapturing: audioAllowed,
          mediaInitSent: audioAllowed,
          sentInitPackets: audioAllowed
            ? this.runtimeState.audioCaptureStats.sentInitPackets + 1
            : this.runtimeState.audioCaptureStats.sentInitPackets,
          savedPhoneMusicVolume: savedVol,
          currentPhoneMusicVolume: shouldMute ? 0 : savedVol,
          isPhoneSpeakerMutedByBridge: shouldMute,
          statusMessage: !audioAllowed
            ? 'Аудио 0x0003 отключено пользователем в общих настройках'
            : shouldMute
            ? `Аудио 0x0003: PCM 48кГц Stereo • STREAM_MUSIC=0 (сохранено: ${savedVol})`
            : 'Аудио 0x0003: активна передача PCM 48кГц Stereo (4096B)',
        },
        lastProtocolEvent:
          'USB AOA подключён (Jetta VS7) • Рукопожатие 0x0001 завершено • Поток 0x0002 (VBR Baseline L3) и аудио 0x0003 открыты ✅',
      };
      this.startStreamingTelemetryTimers();
    } else {
      this.checklist = { ...this.checklist, isUsbConnected: true };
      this.runtimeState = {
        ...this.runtimeState,
        transportState: {
          kind: 'connected',
          manufacturer: 'FAW-VW',
          model: detectedLabel,
          fdNumber: 64,
          connectedAt: Date.now(),
        },
        controlSession: this.stateMachine.state,
        isVideoChannelReadyForStreaming: false,
        lastProtocolEvent: transition1.summary,
      };
    }
    this.emit();
  }

  stopBridge(): void {
    this.stopStreamingTelemetryTimers();
    if (this.runtimeState.audioCaptureStats.isCapturing) {
      const stopFrame = CarLifeFrameCodec.createMediaStopFrame();
      this.recordFrame('TX (S26U -> HU)', stopFrame, 0, CarLifeFrameCodec.encodeFrame(stopFrame).length, true);
    }
    const restoredVol = this.runtimeState.audioCaptureStats.savedPhoneMusicVolume ?? 9;
    this.stateMachine.reset();
    this.touchRouteState = { lastDownTimeMs: null, activeGestureDown: false };
    this.checklist = { ...this.checklist, isUsbConnected: false };
    this.runtimeState = {
      ...this.runtimeState,
      isServiceRunning: false,
      wakeLockHeld: false,
      transportState: { kind: 'disconnected' },
      controlSession: this.stateMachine.state,
      isVideoChannelReadyForStreaming: false,
      usbTxQueueStats: {
        ...this.runtimeState.usbTxQueueStats,
        queuedAudioFrames: 0,
        queuedVideoFrames: 0,
      },
      projectionStats: {
        ...this.runtimeState.projectionStats,
        touchLastDownTimeMs: null,
      },
      audioCaptureStats: {
        ...this.runtimeState.audioCaptureStats,
        isCapturing: false,
        isPhoneSpeakerMutedByBridge: false,
        currentPhoneMusicVolume: restoredVol,
        statusMessage: `Аудио 0x0003: остановлено (MSG_MEDIA_STOP) • STREAM_MUSIC восстановлен (${restoredVol})`,
      },
      lastProtocolEvent: `BridgeForegroundService stopped • STREAM_MUSIC восстановлен (${restoredVol})`,
    };
    this.emit();
  }

  private startStreamingTelemetryTimers(): void {
    this.stopStreamingTelemetryTimers();

    // Push immediate SPS+PPS+IDR frame log so 0x0002 Video tab shows real data
    this.emitSimulatedVideoKeyframe();

    this.streamTimer = window.setInterval(() => {
      if (!this.runtimeState.isVideoChannelReadyForStreaming || !this.runtimeState.projectionStats.isRunning) {
        return;
      }
      const fpsBatch = Math.max(10, Math.round(this.runtimeState.configuredFps / 2));
      const nalSample = new Uint8Array([
        0x00, 0x00, 0x00, 0x01, 0x41, 0x9a, 0x24, 0x6c, 0x4b, 0x7f, 0x11, 0x80, 0x00, 0x12, 0x34, 0x56,
      ]);
      const frame = CarLifeFrameCodec.createVideoFrame(nalSample, Date.now() & 0x7fffffff);
      const wireLen = CarLifeFrameCodec.encodeFrame(frame).length + 4200;
      const nextCount = this.runtimeState.projectionStats.encodedNalFrames + fpsBatch;
      const simulatedQueueDepth = Math.min(5, (this.runtimeState.usbTxQueueStats.queuedVideoFrames + 1) % 4);
      const droppedDelta = this.runtimeState.appMode === AppMode.MIRRORING && simulatedQueueDepth >= 3 ? 1 : 0;

      this.runtimeState = {
        ...this.runtimeState,
        txFrames: this.runtimeState.txFrames + fpsBatch,
        txBytes: this.runtimeState.txBytes + wireLen * fpsBatch,
        channelFrameCounts: {
          ...this.runtimeState.channelFrameCounts,
          [CarLifeChannelId.VIDEO]: this.runtimeState.channelFrameCounts[CarLifeChannelId.VIDEO] + fpsBatch,
        },
        usbTxQueueStats: {
          ...this.runtimeState.usbTxQueueStats,
          queuedVideoFrames: simulatedQueueDepth,
          droppedStalePFrames: this.runtimeState.usbTxQueueStats.droppedStalePFrames + droppedDelta,
        },
        projectionStats: {
          ...this.runtimeState.projectionStats,
          encodedNalFrames: nextCount,
          encodedBytes: this.runtimeState.projectionStats.encodedBytes + wireLen * fpsBatch,
        },
      };
      if (this.runtimeState.logPacketsInUi) {
        this.recordFrame('TX (S26U -> HU)', frame, 0, wireLen, false, `H.264 VBR Slice #${nextCount}`);
      }
      this.emit();
    }, 1000);

    this.audioTimer = window.setInterval(() => {
      if (!this.runtimeState.audioCaptureStats.isCapturing) return;
      const stats = this.runtimeState.audioCaptureStats;
      if (this.mediaState.isPlaying) {
        const nextPkts = stats.sentPcmPackets + 10;
        const addedBytes = 4096 * 10;
        this.runtimeState = {
          ...this.runtimeState,
          txFrames: this.runtimeState.txFrames + 10,
          txBytes: this.runtimeState.txBytes + addedBytes + 200,
          channelFrameCounts: {
            ...this.runtimeState.channelFrameCounts,
            [CarLifeChannelId.MEDIA_AUDIO]:
              this.runtimeState.channelFrameCounts[CarLifeChannelId.MEDIA_AUDIO] + 10,
          },
          usbTxQueueStats: {
            ...this.runtimeState.usbTxQueueStats,
            queuedAudioFrames: 0,
            prioritizedAudioFrames: this.runtimeState.usbTxQueueStats.prioritizedAudioFrames + 10,
          },
          audioCaptureStats: {
            ...stats,
            sentPcmPackets: nextPkts,
            sentPcmBytes: stats.sentPcmBytes + addedBytes,
          },
        };
      } else {
        this.runtimeState = {
          ...this.runtimeState,
          audioCaptureStats: {
            ...stats,
            skippedSilentPackets: stats.skippedSilentPackets + 10,
          },
        };
      }
      this.emit();
    }, 1000);
  }

  private emitSimulatedVideoKeyframe(): void {
    const spsPpsIdr = new Uint8Array([
      0x00, 0x00, 0x00, 0x01, 0x67, 0x42, 0xc0, 0x1f, 0xda, 0x01, 0x40, 0x16, 0xec, 0x04, 0x40, 0x00,
      0x00, 0x00, 0x01, 0x68, 0xce, 0x3c, 0x80, 0x00, 0x00, 0x00, 0x01, 0x65, 0x88, 0x84, 0x21, 0xa0,
    ]);
    const keyFrame = CarLifeFrameCodec.createVideoFrame(spsPpsIdr, Date.now() & 0x7fffffff);
    const wireLen = CarLifeFrameCodec.encodeFrame(keyFrame).length;
    this.runtimeState = {
      ...this.runtimeState,
      projectionStats: {
        ...this.runtimeState.projectionStats,
        encodedNalFrames: this.runtimeState.projectionStats.encodedNalFrames + 1,
        encodedBytes: this.runtimeState.projectionStats.encodedBytes + wireLen,
        lastIdrBytes: 18_432,
        spsPpsConfigured: true,
      },
    };
    this.recordFrame('TX (S26U -> HU)', keyFrame, 0, wireLen, true, 'SPS+PPS+IDR KeyFrame #1');
  }

  private stopStreamingTelemetryTimers(): void {
    if (this.streamTimer !== null) {
      window.clearInterval(this.streamTimer);
      this.streamTimer = null;
    }
    if (this.audioTimer !== null) {
      window.clearInterval(this.audioTimer);
      this.audioTimer = null;
    }
  }

  // --- Settings & Controls ---
  private syncShizukuBinding(
    appMode: AppMode,
    binderAlive: boolean,
    permissionGranted: boolean,
    displayId: number
  ): ShizukuServiceState {
    const derived = deriveShizukuStatus(binderAlive, permissionGranted);
    const shouldBind = appMode === AppMode.SHIZUKU_COCKPIT && binderAlive && permissionGranted;
    if (shouldBind) {
      this.shizukuService.bind();
    } else {
      this.shizukuService.destroy();
    }
    return {
      ...this.runtimeState.shizukuState,
      binderAlive,
      permissionGranted,
      userServiceBound: shouldBind,
      statusKind: derived.kind,
      statusLabel: derived.label,
      boundDisplayId: displayId,
      lastAidlCall: shouldBind
        ? `Shizuku.bindUserService(ICarLifeShizukuService) -> bound displayId=${displayId}`
        : !binderAlive
        ? 'Shizuku.pingBinder() == false (служба не запущена)'
        : !permissionGranted
        ? 'Shizuku.checkSelfPermission() != PERMISSION_GRANTED'
        : 'ShizukuUserService отвязан (режим не SHIZUKU_COCKPIT)',
    };
  }

  requestShizukuPermission(): void {
    const binderAlive = true;
    const permissionGranted = true;
    const displayId = this.runtimeState.projectionStats.virtualDisplayId || 2;
    const nextShizuku = this.syncShizukuBinding(
      this.runtimeState.appMode,
      binderAlive,
      permissionGranted,
      displayId
    );
    this.runtimeState = {
      ...this.runtimeState,
      shizukuState: {
        ...nextShizuku,
        lastAidlCall: `Shizuku.requestPermission(${SHIZUKU_REQ_CODE}) -> PERMISSION_GRANTED ✅`,
      },
      lastProtocolEvent: `Shizuku.requestPermission(${SHIZUKU_REQ_CODE}) -> права выданы, статус: ${nextShizuku.statusLabel}`,
    };
    this.persistSettings();
    this.emit();
  }

  openShizukuApp(): void {
    const intentAction = `packageManager.getLaunchIntentForPackage("${SHIZUKU_PACKAGE_NAME}") ?: Intent(ACTION_VIEW, "market://details?id=${SHIZUKU_PACKAGE_NAME}")`;
    this.runtimeState = {
      ...this.runtimeState,
      shizukuState: {
        ...this.runtimeState.shizukuState,
        lastAidlCall: `Открыть Shizuku: ${intentAction}`,
      },
      lastProtocolEvent: `Переход в Shizuku (${SHIZUKU_PACKAGE_NAME})`,
    };
    this.emit();
  }

  openDeveloperSettings(): void {
    const intentAction =
      'startActivity(Intent(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS)) [fallback: ACTION_DEVICE_INFO_SETTINGS]';
    this.runtimeState = {
      ...this.runtimeState,
      shizukuState: {
        ...this.runtimeState.shizukuState,
        lastAidlCall: `Параметры разработчика: ${intentAction}`,
      },
      lastProtocolEvent: 'Открыты Параметры разработчика (Отладка по Wi-Fi)',
    };
    this.emit();
  }

  toggleShizukuDaemonState(): void {
    const nextBinderAlive = !this.runtimeState.shizukuState.binderAlive;
    const displayId = this.runtimeState.projectionStats.virtualDisplayId || 2;
    const nextShizuku = this.syncShizukuBinding(
      this.runtimeState.appMode,
      nextBinderAlive,
      this.runtimeState.shizukuState.permissionGranted,
      displayId
    );
    this.runtimeState = {
      ...this.runtimeState,
      shizukuState: nextShizuku,
      lastProtocolEvent: `Shizuku.pingBinder() = ${nextBinderAlive} (${nextShizuku.statusLabel})`,
    };
    this.persistSettings();
    this.emit();
  }

  setAppMode(mode: AppMode): void {
    const mappedSource =
      mode === AppMode.MIRRORING ? VideoSourceMode.SCREEN_MIRRORING : VideoSourceMode.VIRTUAL_DISPLAY;
    const mappedLaunch =
      mode === AppMode.MIRRORING
        ? AppLaunchMode.SCREEN_MIRRORING
        : AppLaunchMode.VIRTUAL_DISPLAY_IF_AVAILABLE;
    const target: TouchDispatchTarget =
      mode === AppMode.SHIZUKU_COCKPIT
        ? 'SHIZUKU_INPUT_MANAGER'
        : mode === AppMode.COCKPIT
        ? 'PRESENTATION_DECOR_VIEW'
        : 'ACCESSIBILITY_DISPATCH_GESTURE';
    const vdId = mappedSource === VideoSourceMode.VIRTUAL_DISPLAY ? 2 : 0;
    this.touchRouteState = { lastDownTimeMs: null, activeGestureDown: false };

    const nextShizuku = this.syncShizukuBinding(
      mode,
      this.runtimeState.shizukuState.binderAlive,
      this.runtimeState.shizukuState.permissionGranted,
      vdId || 2
    );

    this.runtimeState = {
      ...this.runtimeState,
      appMode: mode,
      videoSourceMode: mappedSource,
      appLaunchMode: mappedLaunch,
      shizukuState: nextShizuku,
      projectionStats: {
        ...this.runtimeState.projectionStats,
        appMode: mode,
        videoSourceMode: mappedSource,
        virtualDisplayId: vdId,
        touchRouteTarget: target,
        touchLastDownTimeMs: null,
        activeCockpitWidget:
          mode === AppMode.SHIZUKU_COCKPIT
            ? `Shizuku VD #${vdId} (${nextShizuku.statusLabel})`
            : mode === AppMode.COCKPIT
            ? `Виртуальный экран (VD #${vdId}) активен`
            : 'Зеркалирование экрана готово',
      },
      lastProtocolEvent:
        mode === AppMode.SHIZUKU_COCKPIT
          ? `Режим SHIZUKU_COCKPIT: VD #${vdId} (1280×720@30fps VBR 160dpi) • тач 0x0006 -> ICarLifeShizukuService.injectTouch (${nextShizuku.statusLabel})`
          : mode === AppMode.COCKPIT
          ? 'Режим КОКПИТ: тач 0x0006 -> presentation.window.decorView.dispatchTouchEvent (AccessibilityService OFF)'
          : 'Режим ЗЕРКАЛИРОВАНИЕ: тач 0x0006 -> CarLifeAccessibilityService.dispatchGesture',
    };
    this.persistSettings();
    this.emit();
  }

  setLogPacketsInUi(enabled: boolean): void {
    this.runtimeState = {
      ...this.runtimeState,
      logPacketsInUi: enabled,
      lastProtocolEvent: enabled
        ? 'Логирование пакетов в UI: ВКЛ'
        : 'Логирование пакетов в UI: ВЫКЛ (макс. производительность)',
    };
    this.persistSettings();
    this.emit();
  }

  setTransmitAudioOverUsb(enabled: boolean): void {
    const savedVol = this.runtimeState.audioCaptureStats.savedPhoneMusicVolume ?? 9;
    if (!enabled && this.runtimeState.audioCaptureStats.isCapturing) {
      const stopFrame = CarLifeFrameCodec.createMediaStopFrame();
      this.recordFrame(
        'TX (S26U -> HU)',
        stopFrame,
        0,
        CarLifeFrameCodec.encodeFrame(stopFrame).length,
        true,
        'MSG_MEDIA_STOP (0x00030002)'
      );
    }
    this.runtimeState = {
      ...this.runtimeState,
      transmitAudioOverUsb: enabled,
      audioCaptureStats: {
        ...this.runtimeState.audioCaptureStats,
        isCapturing: enabled ? this.runtimeState.audioCaptureStats.isCapturing : false,
        isPhoneSpeakerMutedByBridge: enabled
          ? this.runtimeState.audioCaptureStats.isPhoneSpeakerMutedByBridge
          : false,
        currentPhoneMusicVolume: enabled
          ? this.runtimeState.audioCaptureStats.currentPhoneMusicVolume
          : savedVol,
        statusMessage: enabled
          ? 'Аудио 0x0003: разрешена передача PCM 48 кГц Stereo по USB'
          : `Аудио 0x0003: выключено (звук остаётся на телефоне/Bluetooth, STREAM_MUSIC=${savedVol})`,
      },
      lastProtocolEvent: enabled
        ? 'Передача звука по USB (канал 0x0003): ВКЛ'
        : 'Передача звука по USB (канал 0x0003): ВЫКЛ',
    };
    this.persistSettings();
    this.emit();
  }

  setAutoStartOnUsbAttach(enabled: boolean): void {
    this.runtimeState = {
      ...this.runtimeState,
      autoStartOnUsbAttach: enabled,
      lastProtocolEvent: enabled
        ? 'Автозапуск при подключении USB-кабеля (USB_ACCESSORY_ATTACHED): ВКЛ'
        : 'Автозапуск при подключении USB-кабеля: ВЫКЛ (только ручной старт)',
    };
    this.persistSettings();
    this.emit();
  }

  setKeepPhoneScreenOn(enabled: boolean): void {
    this.runtimeState = {
      ...this.runtimeState,
      keepPhoneScreenOn: enabled,
      lastProtocolEvent: enabled
        ? 'FLAG_KEEP_SCREEN_ON при зеркалировании: ВКЛ'
        : 'FLAG_KEEP_SCREEN_ON при зеркалировании: ВЫКЛ',
    };
    this.persistSettings();
    this.emit();
  }

  setForceLandscapeMirroring(enabled: boolean): void {
    this.runtimeState = {
      ...this.runtimeState,
      forceLandscapeMirroring: enabled,
      lastProtocolEvent: enabled
        ? 'Принудительная альбомная ориентация при зеркалировании: ВКЛ'
        : 'Принудительная альбомная ориентация при зеркалировании: ВЫКЛ (авто)',
    };
    this.persistSettings();
    this.emit();
  }

  toggleLauncherAppVisibility(packageName: string): void {
    const current = this.runtimeState.launcherVisiblePackages;
    const exists = current.includes(packageName);
    let next: string[];
    if (exists) {
      if (current.length <= 1) {
        return; // Keep at least one app in the launcher grid
      }
      next = current.filter((p) => p !== packageName);
    } else {
      next = [...current, packageName];
    }
    this.runtimeState = {
      ...this.runtimeState,
      launcherVisiblePackages: next,
      lastProtocolEvent: `Сетка лаунчера ГУ: выбрано ${next.length} из ${COCKPIT_INSTALLED_APPS.length} приложений`,
    };
    this.persistSettings();
    this.emit();
  }

  setLauncherVisiblePreset(preset: 'all' | 'auto'): void {
    const next =
      preset === 'all'
        ? COCKPIT_INSTALLED_APPS.map((a) => a.packageName)
        : COCKPIT_INSTALLED_APPS.filter((a) => a.isAutomotivePriority).map((a) => a.packageName);
    this.runtimeState = {
      ...this.runtimeState,
      launcherVisiblePackages: next,
      lastProtocolEvent:
        preset === 'all'
          ? `Сетка лаунчера ГУ: выбраны все приложения (${next.length})`
          : `Сетка лаунчера ГУ: только навигация и медиа (${next.length})`,
    };
    this.persistSettings();
    this.emit();
  }

  setShizukuVdNavButtonsEnabled(enabled: boolean): void {
    this.runtimeState = {
      ...this.runtimeState,
      shizukuVdNavButtonsEnabled: enabled,
      lastProtocolEvent: enabled
        ? 'Системные кнопки «Домой / Назад» на VirtualDisplay (Shizuku): ВКЛ'
        : 'Системные кнопки «Домой / Назад» на VirtualDisplay (Shizuku): ВЫКЛ',
    };
    this.persistSettings();
    this.emit();
  }

  setShizukuVdNavButtonsLayout(layout: 'dock' | 'floating'): void {
    this.runtimeState = {
      ...this.runtimeState,
      shizukuVdNavButtonsLayout: layout,
      lastProtocolEvent:
        layout === 'dock'
          ? 'Кнопки Домой/Назад на VirtualDisplay: боковой док'
          : 'Кнопки Домой/Назад на VirtualDisplay: плавающая панель Overlay',
    };
    this.persistSettings();
    this.emit();
  }

  setCanvasTestCardEnabled(enabled: boolean): void {
    const mode = enabled
      ? VideoSourceMode.CANVAS_TEST_CARD
      : this.runtimeState.appMode === AppMode.MIRRORING
      ? VideoSourceMode.SCREEN_MIRRORING
      : VideoSourceMode.VIRTUAL_DISPLAY;
    const vdId = mode === VideoSourceMode.VIRTUAL_DISPLAY ? 2 : 0;
    this.runtimeState = {
      ...this.runtimeState,
      videoSourceMode: mode,
      projectionStats: {
        ...this.runtimeState.projectionStats,
        videoSourceMode: mode,
        virtualDisplayId: vdId,
        isRunning: true,
        activeCockpitWidget: VIDEO_SOURCE_META[mode].title,
      },
      lastProtocolEvent: enabled
        ? 'Тест-карта (Canvas) включена для отладки видеоканала 0x0002'
        : `Тест-карта (Canvas) выключена -> ${VIDEO_SOURCE_META[mode].title}`,
    };
    this.persistSettings();
    this.emit();
  }

  setMutePhoneSpeakerDuringUsbAudio(enabled: boolean): void {
    const isCapturing = this.runtimeState.audioCaptureStats.isCapturing;
    const savedVol =
      this.runtimeState.audioCaptureStats.savedPhoneMusicVolume ??
      this.runtimeState.audioCaptureStats.currentPhoneMusicVolume;
    const shouldMuteNow = enabled && isCapturing;

    this.runtimeState = {
      ...this.runtimeState,
      mutePhoneSpeakerDuringUsbAudio: enabled,
      audioCaptureStats: {
        ...this.runtimeState.audioCaptureStats,
        mutePhoneSpeakerDuringUsbAudio: enabled,
        savedPhoneMusicVolume: savedVol,
        currentPhoneMusicVolume: shouldMuteNow ? 0 : savedVol,
        isPhoneSpeakerMutedByBridge: shouldMuteNow,
        statusMessage: isCapturing
          ? shouldMuteNow
            ? `Аудио 0x0003: PCM 48кГц Stereo • STREAM_MUSIC=0 (сохранено: ${savedVol})`
            : `Аудио 0x0003: активна передача PCM 48кГц Stereo (STREAM_MUSIC=${savedVol})`
          : this.runtimeState.audioCaptureStats.statusMessage,
      },
      lastProtocolEvent: enabled
        ? 'Глушить динамик телефона при USB-звуке: ВКЛ'
        : `Глушить динамик телефона при USB-звуке: ВЫКЛ (STREAM_MUSIC=${savedVol})`,
    };
    this.persistSettings();
    this.emit();
  }

  toggleAudioCapture(): void {
    if (!this.runtimeState.transmitAudioOverUsb) {
      this.setTransmitAudioOverUsb(true);
    }
    const currentlyCapturing = this.runtimeState.audioCaptureStats.isCapturing;
    if (currentlyCapturing) {
      const stopFrame = CarLifeFrameCodec.createMediaStopFrame();
      this.recordFrame(
        'TX (S26U -> HU)',
        stopFrame,
        0,
        CarLifeFrameCodec.encodeFrame(stopFrame).length,
        true,
        'MSG_MEDIA_STOP (0x00030002)'
      );
      const restoredVol = this.runtimeState.audioCaptureStats.savedPhoneMusicVolume ?? 9;
      this.runtimeState = {
        ...this.runtimeState,
        audioCaptureStats: {
          ...this.runtimeState.audioCaptureStats,
          isCapturing: false,
          isPhoneSpeakerMutedByBridge: false,
          currentPhoneMusicVolume: restoredVol,
          sentStopPackets: this.runtimeState.audioCaptureStats.sentStopPackets + 1,
          statusMessage: `Аудио 0x0003: остановлено (MSG_MEDIA_STOP) • STREAM_MUSIC восстановлен (${restoredVol})`,
        },
        lastProtocolEvent: `Аудиоканал 0x0003 остановлен • STREAM_MUSIC восстановлен (${restoredVol})`,
      };
    } else {
      const initFrame = CarLifeFrameCodec.createMediaInitFrame();
      this.recordFrame(
        'TX (S26U -> HU)',
        initFrame,
        0,
        CarLifeFrameCodec.encodeFrame(initFrame).length,
        true,
        'MSG_MEDIA_INIT (48kHz Stereo 16-bit)'
      );
      const savedVol =
        this.runtimeState.audioCaptureStats.currentPhoneMusicVolume > 0
          ? this.runtimeState.audioCaptureStats.currentPhoneMusicVolume
          : this.runtimeState.audioCaptureStats.savedPhoneMusicVolume ?? 9;
      const shouldMute = this.runtimeState.mutePhoneSpeakerDuringUsbAudio;
      this.runtimeState = {
        ...this.runtimeState,
        audioCaptureStats: {
          ...this.runtimeState.audioCaptureStats,
          isCapturing: true,
          mediaInitSent: true,
          sentInitPackets: this.runtimeState.audioCaptureStats.sentInitPackets + 1,
          savedPhoneMusicVolume: savedVol,
          currentPhoneMusicVolume: shouldMute ? 0 : savedVol,
          isPhoneSpeakerMutedByBridge: shouldMute,
          statusMessage: shouldMute
            ? `Аудио 0x0003: PCM 48кГц Stereo • STREAM_MUSIC=0 (сохранено: ${savedVol})`
            : 'Аудио 0x0003: активна передача PCM 48кГц Stereo (4096B)',
        },
        lastProtocolEvent: shouldMute
          ? `Аудио 0x0003 запущен • STREAM_MUSIC снижен до 0 (сохранено: ${savedVol})`
          : 'Аудиоканал 0x0003 запущен (MSG_MEDIA_INIT 48000 Hz Stereo)',
      };
    }
    this.emit();
  }

  setVideoSourceMode(mode: VideoSourceMode): void {
    const mappedAppMode =
      mode === VideoSourceMode.SCREEN_MIRRORING
        ? AppMode.MIRRORING
        : this.runtimeState.appMode === AppMode.SHIZUKU_COCKPIT
        ? AppMode.SHIZUKU_COCKPIT
        : AppMode.COCKPIT;
    const target: TouchDispatchTarget =
      mappedAppMode === AppMode.SHIZUKU_COCKPIT
        ? 'SHIZUKU_INPUT_MANAGER'
        : mappedAppMode === AppMode.COCKPIT
        ? 'PRESENTATION_DECOR_VIEW'
        : 'ACCESSIBILITY_DISPATCH_GESTURE';
    this.runtimeState = {
      ...this.runtimeState,
      appMode: mappedAppMode,
      videoSourceMode: mode,
      projectionStats: {
        ...this.runtimeState.projectionStats,
        appMode: mappedAppMode,
        videoSourceMode: mode,
        virtualDisplayId: mode === VideoSourceMode.VIRTUAL_DISPLAY ? 2 : 0,
        touchRouteTarget: target,
        isRunning: true,
        activeCockpitWidget: VIDEO_SOURCE_META[mode].title,
      },
      lastProtocolEvent: `Источник видео: ${VIDEO_SOURCE_META[mode].title}`,
    };
    this.persistSettings();
    this.emit();
  }

  setAppLaunchMode(mode: AppLaunchMode): void {
    this.lastLaunchStatus = `Режим запуска: ${APP_LAUNCH_MODE_META[mode].title}`;
    this.runtimeState = {
      ...this.runtimeState,
      appLaunchMode: mode,
      lastProtocolEvent: `Режим запуска приложений: ${APP_LAUNCH_MODE_META[mode].title}`,
    };
    this.persistSettings();
    this.emit();
  }

  setHandshakeProfile(profileId: number): void {
    this.stateMachine.handshakeTestProfileId = profileId;
    this.runtimeState = {
      ...this.runtimeState,
      handshakeTestProfileId: profileId,
      lastProtocolEvent: `Профиль 0x00018001 выбран: Тест ${profileId}`,
    };
    this.persistSettings();
    this.emit();
  }

  setResolution(width: number, height: number): void {
    this.stateMachine.setPreferredResolution(width, height);
    this.runtimeState = {
      ...this.runtimeState,
      configuredWidth: width,
      configuredHeight: height,
      mediaCodecConfig: {
        ...this.runtimeState.mediaCodecConfig,
        width,
        height,
      },
      projectionStats: {
        ...this.runtimeState.projectionStats,
        width,
        height,
      },
      controlSession: {
        ...this.runtimeState.controlSession,
        negotiatedVideoWidth: width,
        negotiatedVideoHeight: height,
      },
      lastProtocolEvent: `Видеоконфигурация обновлена: ${width}×${height} @ ${this.runtimeState.configuredBitrateBps / 1000} кбит/с (VBR ${this.runtimeState.configuredFps}fps)`,
    };
    this.persistSettings();
    this.emit();
  }

  setFps(fps: 25 | 30): void {
    this.runtimeState = {
      ...this.runtimeState,
      configuredFps: fps,
      mediaCodecConfig: {
        ...this.runtimeState.mediaCodecConfig,
        frameRate: fps,
      },
      projectionStats: {
        ...this.runtimeState.projectionStats,
        fps,
      },
      controlSession: {
        ...this.runtimeState.controlSession,
        negotiatedFps: fps,
      },
      lastProtocolEvent: `Частота кадров MediaCodec: ${fps} fps (VBR Baseline L3, I=1s, QP≤36)`,
    };
    this.persistSettings();
    this.emit();
  }

  setDensityDpi(dpi: 160 | 180 | 200): void {
    this.runtimeState = {
      ...this.runtimeState,
      virtualDisplayDensityDpi: dpi,
      mediaCodecConfig: {
        ...this.runtimeState.mediaCodecConfig,
        virtualDisplayDensityDpi: dpi,
      },
      lastProtocolEvent: `VirtualDisplay densityDpi для MediaProjection: ${dpi} dpi`,
    };
    this.persistSettings();
    this.emit();
  }

  setBitrateKbps(kbps: number): void {
    const bps = kbps * 1000;
    this.runtimeState = {
      ...this.runtimeState,
      configuredBitrateBps: bps,
      mediaCodecConfig: {
        ...this.runtimeState.mediaCodecConfig,
        bitrateBps: bps,
      },
      projectionStats: {
        ...this.runtimeState.projectionStats,
        bitRateKbps: kbps,
      },
      lastProtocolEvent: `Битрейт H.264 обновлён: ${kbps} кбит/с (VBR ${this.runtimeState.configuredFps}fps)`,
    };
    this.persistSettings();
    this.emit();
  }

  setVideoHeaderMode(useAoA20B: boolean): void {
    CarLifeFrameCodec.useNestedVideoMsgHeader = useAoA20B;
    this.runtimeState = {
      ...this.runtimeState,
      useNestedVideoMsgHeader: useAoA20B,
      lastProtocolEvent: useAoA20B
        ? 'Video 0x0002 Framing: Режим 1: AOA 20B (8B AOA + 12B 0x00020001) active'
        : 'Video 0x0002 Framing: Режим 2: Direct 12B ([00 00 00 02][nalSize][ts]) active',
    };
    this.persistSettings();
    this.emit();
  }

  toggleProjection(): void {
    const nextRunning = !this.runtimeState.projectionStats.isRunning;
    this.runtimeState = {
      ...this.runtimeState,
      isServiceRunning: true,
      projectionStats: {
        ...this.runtimeState.projectionStats,
        isRunning: nextRunning,
        spsPpsConfigured: nextRunning,
      },
      lastProtocolEvent: nextRunning
        ? `Конвейер H.264 запущен (${this.runtimeState.configuredWidth}×${this.runtimeState.configuredHeight}@${this.runtimeState.configuredFps}fps VBR)`
        : 'Конвейер видеозаписи остановлен',
    };
    this.emit();
  }

  startJettaVs7DefaultVd(): void {
    this.setResolution(1280, 720);
    this.setFps(30);
    this.setDensityDpi(160);
    this.setBitrateKbps(2000);
    this.setVideoHeaderMode(true);
    this.setVideoSourceMode(VideoSourceMode.VIRTUAL_DISPLAY);
    this.runtimeState = {
      ...this.runtimeState,
      isServiceRunning: true,
      projectionStats: {
        ...this.runtimeState.projectionStats,
        isRunning: true,
        virtualDisplayId: 2,
        spsPpsConfigured: true,
      },
      lastProtocolEvent: 'Стартован VD #2 (1280×720 • VBR 2.0 Мбит/с • 160 dpi • AOA 20B)',
    };
    this.emit();
  }

  injectTestTouch(x: number, y: number): void {
    const downFrame = CarLifeTouchDecoder.createTouchActionFrame(
      0,
      x,
      y,
      this.runtimeState.configuredWidth,
      this.runtimeState.configuredHeight
    );
    const upFrame = CarLifeTouchDecoder.createTouchActionFrame(
      1,
      x,
      y,
      this.runtimeState.configuredWidth,
      this.runtimeState.configuredHeight
    );
    const wireLenDown = CarLifeFrameCodec.encodeFrame(downFrame).length;
    const wireLenUp = CarLifeFrameCodec.encodeFrame(upFrame).length;
    this.recordFrame('RX (HU -> S26U)', downFrame, wireLenDown, 0, true);
    this.recordFrame('RX (HU -> S26U)', upFrame, wireLenUp, 0, true);

    const nowMs = Date.now();
    const downRoute = routeTouchEventByMode(
      this.runtimeState.appMode,
      CarLifeTouchEventType.DOWN,
      x,
      y,
      this.runtimeState.configuredWidth,
      this.runtimeState.configuredHeight,
      this.touchRouteState,
      nowMs
    );
    const heldDownTime = downRoute.nextState.lastDownTimeMs;
    const upRoute = routeTouchEventByMode(
      this.runtimeState.appMode,
      CarLifeTouchEventType.UP,
      x,
      y,
      this.runtimeState.configuredWidth,
      this.runtimeState.configuredHeight,
      downRoute.nextState,
      nowMs + 45
    );
    this.touchRouteState = upRoute.nextState;

    const label = `${downRoute.result.summary} -> UP(downTime=${heldDownTime})`;
    let nextShizukuState = this.runtimeState.shizukuState;
    if (this.runtimeState.appMode === AppMode.SHIZUKU_COCKPIT) {
      const vdId = this.runtimeState.projectionStats.virtualDisplayId || 2;
      const aidlCall = this.shizukuService.injectTouch(
        0,
        downRoute.result.dispatchedX,
        downRoute.result.dispatchedY,
        heldDownTime ?? nowMs,
        nowMs,
        vdId
      );
      nextShizukuState = {
        ...nextShizukuState,
        lastAidlCall: aidlCall,
        injectedTouchCount: nextShizukuState.injectedTouchCount + 2,
      };
    }

    this.runtimeState = {
      ...this.runtimeState,
      shizukuState: nextShizukuState,
      projectionStats: {
        ...this.runtimeState.projectionStats,
        injectedTouches: this.runtimeState.projectionStats.injectedTouches + 2,
        lastTouchPoint: [x, y],
        touchRouteTarget: downRoute.result.target,
        touchLastDownTimeMs: heldDownTime,
      },
      lastTouchOrKeyEvent: label,
      lastProtocolEvent: label,
    };
    this.emit();
  }

  // --- Protocol Lab Loopback Vectors ---
  runLoopbackVector(vector: 'handshake' | 'video' | 'touch' | 'hardkey'): void {
    if (vector === 'handshake') {
      const vFrame = CarLifeFrameCodec.createCommandFrame(
        CarLifeChannelId.CONTROL,
        CarLifeMsgType.MSG_CMD_HU_PROTOCOL_VERSION,
        CarlifeProtocolVersionProto.encode({ majorVersion: 2, minorVersion: 0 })
      );
      const initFrame = CarLifeFrameCodec.createCommandFrame(
        CarLifeChannelId.CONTROL,
        CarLifeMsgType.MSG_CMD_VIDEO_ENCODER_INIT,
        CarlifeVideoEncoderInfoProto.encode({ width: 800, height: 480, frameRate: 30 })
      );
      this.executeSingleLoopback(vFrame, 'Control 0x0001: MSG_CMD_HU_PROTOCOL_VERSION (v2.0)');
      this.executeSingleLoopback(initFrame, 'Control 0x0001: MSG_CMD_VIDEO_ENCODER_INIT (800x480@30)');
    } else if (vector === 'video') {
      const h264SpsPps = new Uint8Array([
        0x00, 0x00, 0x00, 0x01, 0x67, 0x42, 0x00, 0x1f, 0x00, 0x00, 0x00, 0x01, 0x68, 0xce, 0x3c, 0x80,
      ]);
      const vFrame = CarLifeFrameCodec.createVideoFrame(h264SpsPps, Date.now() & 0x7fffffff);
      this.executeSingleLoopback(vFrame, 'Video 0x0002: H.264 SPS/PPS NAL');
    } else if (vector === 'touch') {
      const tFrame = CarLifeTouchDecoder.createTouchActionFrame(0, 640, 360, 1280, 720);
      this.executeSingleLoopback(tFrame, 'Touch 0x0006: MSG_TOUCH_ACTION (640,360 on 1280x720)');
    } else {
      const hkFrame = CarLifeTouchDecoder.createHardKeyFrame('SEEK_ADD');
      this.executeSingleLoopback(hkFrame, 'Touch 0x0006: MSG_TOUCH_CAR_HARD_KEY_CODE (SEEK_ADD)');
    }
  }

  private executeSingleLoopback(frame: CarLifeFrame, description: string): void {
    const encodedBytes = CarLifeFrameCodec.encodeFrame(frame);
    const decoded = CarLifeFrameCodec.decodeFrame(encodedBytes);
    let extraAnalysis = '';

    if (decoded.header.channel === CarLifeChannelId.CONTROL) {
      const transition = this.stateMachine.onControlFrame(decoded);
      extraAnalysis = `\n• State Machine Transition: ${transition.summary}`;
      for (const reply of transition.outboundFrames) {
        const replyWire = CarLifeFrameCodec.encodeFrame(reply);
        this.recordFrame('TX (S26U -> HU)', reply, 0, replyWire.length, true);
      }
      this.runtimeState = {
        ...this.runtimeState,
        controlSession: transition.updatedState,
      };
    } else if (decoded.header.channel === CarLifeChannelId.TOUCH) {
      const targetBounds =
        this.runtimeState.appMode === AppMode.MIRRORING
          ? { w: 3120, h: 1440 }
          : { w: 1280, h: 720 };
      const ev = CarLifeTouchDecoder.decodeTouchChannelFrame(
        decoded,
        targetBounds.w,
        targetBounds.h,
        1280,
        720
      );
      let evStr = 'None';
      let nextDownTime: number | null = this.runtimeState.projectionStats.touchLastDownTimeMs;
      let nextShizukuState = this.runtimeState.shizukuState;
      if (ev?.kind === 'touch') {
        const vdId = this.runtimeState.projectionStats.virtualDisplayId || 2;
        const routed = routeTouchEventByMode(
          this.runtimeState.appMode,
          ev.type,
          ev.rawX,
          ev.rawY,
          ev.huWidth,
          ev.huHeight,
          this.touchRouteState,
          Date.now(),
          undefined,
          vdId
        );
        this.touchRouteState = routed.nextState;
        nextDownTime = routed.result.downTimeMs;
        evStr = routed.result.summary;
        if (this.runtimeState.appMode === AppMode.SHIZUKU_COCKPIT) {
          const aidlCall = this.shizukuService.injectTouch(
            ev.type === CarLifeTouchEventType.UP ? 1 : ev.type === CarLifeTouchEventType.MOVE ? 2 : 0,
            routed.result.dispatchedX,
            routed.result.dispatchedY,
            routed.result.downTimeMs,
            routed.result.eventTimeMs,
            vdId
          );
          nextShizukuState = {
            ...nextShizukuState,
            lastAidlCall: aidlCall,
            injectedTouchCount: nextShizukuState.injectedTouchCount + 1,
          };
        }
      } else if (ev?.kind === 'hardkey') {
        evStr = `HardKey ${ev.mappedKey?.label ?? 'UNKNOWN'} -> Android KeyCode ${ev.androidKeyCode}`;
        if (ev.mappedKey?.id === 'SEEK_ADD') {
          this.skipNextTrack();
        }
      }
      extraAnalysis = `\n• Touch/Key Routed: ${evStr}`;
      this.runtimeState = {
        ...this.runtimeState,
        shizukuState: nextShizukuState,
        lastTouchOrKeyEvent: evStr,
        projectionStats: {
          ...this.runtimeState.projectionStats,
          injectedTouches: this.runtimeState.projectionStats.injectedTouches + 1,
          touchLastDownTimeMs: nextDownTime,
        },
      };
    }

    this.recordFrame('RX (HU -> S26U)', decoded, encodedBytes.length, 0, true);

    const rawHeader = CarLifeFrameCodec.encodeHeader(decoded.header);
    const toHex = (arr: Uint8Array) =>
      Array.from(arr)
        .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
        .join(' ');
    const chHex = toHex(rawHeader.subarray(0, 4));
    const lenHex = toHex(rawHeader.subarray(4, 8));
    const info = channelInfo(decoded.header.channel);

    let tsPart = '\n• Timestamp Field: Omitted (8-byte Standard Channel Header)';
    if (decoded.header.includeOuterTimestamp && rawHeader.length >= 12) {
      tsPart = `\n• Bytes [8..11] Timestamp: [${toHex(rawHeader.subarray(8, 12))}] -> ${decoded.header.timestamp} ms`;
    } else if (decoded.header.channel === CarLifeChannelId.VIDEO) {
      tsPart = `\n• Video Framing: AOA 20B (8B AOA + 12B 0x00020001) | ts=${decoded.header.timestamp} ms`;
    }

    const cmd = parseCommandMessageOrNull(decoded);
    const cmdSub = cmd
      ? `\n• Inner Header: len=${cmd.body.length}B | service=${cmd.serviceName} (0x${(cmd.serviceType >>> 0)
          .toString(16)
          .toUpperCase()
          .padStart(8, '0')})`
      : '';

    this.lastDecodedBreakdown =
      `[${description}]\n` +
      `• Header Size: ${decoded.header.includeOuterTimestamp ? 12 : 8} bytes | Total Wire Size: ${encodedBytes.length} bytes\n` +
      `• Bytes [0..3] Channel ID: [${chHex}] -> ${info.key} (0x${info.id.toString(16).toUpperCase().padStart(4, '0')})\n` +
      `• Bytes [4..7] Payload Len: [${lenHex}] -> ${decoded.header.payloadLength} bytes` +
      tsPart +
      cmdSub +
      extraAnalysis;

    this.emit();
  }

  private recordFrame(
    direction: string,
    frame: CarLifeFrame,
    rxAddBytes: number,
    txAddBytes: number,
    forceLog = false,
    serviceNameOverride?: string
  ): void {
    const ch = frame.header.channel;
    const isVideo = ch === CarLifeChannelId.VIDEO;
    const nextChannelCounts = {
      ...this.runtimeState.channelFrameCounts,
      [ch]: (this.runtimeState.channelFrameCounts[ch] ?? 0) + 1,
    };

    const rxF = direction.startsWith('RX') ? this.runtimeState.rxFrames + 1 : this.runtimeState.rxFrames;
    const txF = direction.startsWith('TX') ? this.runtimeState.txFrames + 1 : this.runtimeState.txFrames;

    if (!this.runtimeState.logPacketsInUi && !forceLog) {
      this.runtimeState = {
        ...this.runtimeState,
        rxBytes: this.runtimeState.rxBytes + rxAddBytes,
        txBytes: this.runtimeState.txBytes + txAddBytes,
        rxFrames: rxF,
        txFrames: txF,
        channelFrameCounts: nextChannelCounts,
      };
      return;
    }

    const cmd = parseCommandMessageOrNull(frame);
    const isAoA20BVideo = isVideo && !frame.header.includeOuterTimestamp && frame.payload.length >= 12;
    const effectiveHeaderBytes = isAoA20BVideo
      ? 20
      : frame.header.includeOuterTimestamp
      ? 12
      : 8;
    const effectivePayloadBytes = isAoA20BVideo ? frame.payload.length - 12 : frame.payload.length;
    const hexMaxBytes = direction.startsWith('RX') ? 512 : !isVideo ? Math.max(frame.payload.length, 16) : 48;

    const entry: PacketLogEntry = {
      id: ++this.logSequence,
      timestampFormatted: formatTimeStampMs(),
      direction,
      channel: ch,
      headerSizeBytes: effectiveHeaderBytes,
      payloadSizeBytes: effectivePayloadBytes,
      mediaTimestampMs: frame.header.timestamp,
      serviceName: serviceNameOverride ?? cmd?.serviceName ?? null,
      hexPreview: CarLifeFrameCodec.formatHexPreview(frame, hexMaxBytes),
    };

    const nextCommandLogs = !isVideo
      ? [entry, ...this.runtimeState.commandPacketLogs].slice(0, 200)
      : this.runtimeState.commandPacketLogs;
    const nextVideoLogs = isVideo
      ? [entry, ...this.runtimeState.videoPacketLogs].slice(0, 60)
      : this.runtimeState.videoPacketLogs;

    this.runtimeState = {
      ...this.runtimeState,
      rxBytes: this.runtimeState.rxBytes + rxAddBytes,
      txBytes: this.runtimeState.txBytes + txAddBytes,
      rxFrames: rxF,
      txFrames: txF,
      channelFrameCounts: nextChannelCounts,
      commandPacketLogs: nextCommandLogs,
      videoPacketLogs: nextVideoLogs,
    };
  }

  clearLogs(): void {
    this.runtimeState = {
      ...this.runtimeState,
      commandPacketLogs: [],
      videoPacketLogs: [],
      channelFrameCounts: {
        [CarLifeChannelId.CONTROL]: 0,
        [CarLifeChannelId.VIDEO]: 0,
        [CarLifeChannelId.MEDIA_AUDIO]: 0,
        [CarLifeChannelId.TTS_AUDIO]: 0,
        [CarLifeChannelId.VR_AUDIO]: 0,
        [CarLifeChannelId.TOUCH]: 0,
      },
      lastProtocolEvent: 'Packet log cleared',
    };
    this.emit();
  }

  // --- Launcher & Media Actions ---
  launchApp(app: InstalledAppInfo): void {
    const mode = this.runtimeState.appLaunchMode;
    const vdId = this.runtimeState.projectionStats.virtualDisplayId || 2;
    let nextShizukuState = this.runtimeState.shizukuState;

    if (this.runtimeState.appMode === AppMode.SHIZUKU_COCKPIT) {
      const amCmd = this.shizukuService.launchAppOnDisplay(app.packageName, app.activityName, vdId);
      nextShizukuState = {
        ...nextShizukuState,
        lastAidlCall: `launchAppOnDisplay -> ${amCmd}`,
        amStartCount: nextShizukuState.amStartCount + 1,
      };
      this.lastLaunchStatus = `Shizuku VD #${vdId}: ${amCmd}`;
    } else if (
      mode === AppLaunchMode.VIRTUAL_DISPLAY_IF_AVAILABLE &&
      this.runtimeState.projectionStats.virtualDisplayId > 0
    ) {
      this.lastLaunchStatus = `Запущено: ${app.label} (${app.packageName}) -> VirtualDisplay #${vdId}`;
    } else {
      const modeSuffix =
        mode === AppLaunchMode.SCREEN_MIRRORING
          ? 'Зеркалирование экрана (MediaProjection)'
          : 'Default Display (0)';
      this.lastLaunchStatus = `Запущено: ${app.label} (${app.packageName}) -> ${modeSuffix}`;
    }
    this.runtimeState = {
      ...this.runtimeState,
      shizukuState: nextShizukuState,
      projectionStats: {
        ...this.runtimeState.projectionStats,
        activeCockpitWidget: `${app.label} • Активно`,
      },
      lastProtocolEvent: this.lastLaunchStatus,
    };
    this.emit();
  }

  triggerDockHome(): void {
    if (this.runtimeState.appMode === AppMode.SHIZUKU_COCKPIT) {
      const vdId = this.runtimeState.projectionStats.virtualDisplayId || 2;
      const cmd = this.shizukuService.sendKeyEvent(KEYCODE_HOME, vdId);
      this.lastLaunchStatus = `Shizuku KeyEvent: ${cmd}`;
      this.runtimeState = {
        ...this.runtimeState,
        shizukuState: {
          ...this.runtimeState.shizukuState,
          lastAidlCall: `sendKeyEvent(KEYCODE_HOME=3, displayId=${vdId}) -> ${cmd}`,
          keyEventCount: this.runtimeState.shizukuState.keyEventCount + 1,
        },
        lastTouchOrKeyEvent: `HardKey HOME (0x00000001) -> ${cmd}`,
      };
      this.emit();
      return;
    }

    this.lastLaunchStatus = 'Команда Домой (CarLifeAccessibilityService GLOBAL_ACTION_HOME)';
    this.runtimeState = {
      ...this.runtimeState,
      lastTouchOrKeyEvent: 'HardKey HOME (0x00000001) -> GLOBAL_ACTION_HOME',
    };
    this.emit();
  }

  triggerDockBack(): void {
    if (this.runtimeState.appMode === AppMode.SHIZUKU_COCKPIT) {
      const vdId = this.runtimeState.projectionStats.virtualDisplayId || 2;
      const cmd = this.shizukuService.sendKeyEvent(KEYCODE_BACK, vdId);
      this.lastLaunchStatus = `Shizuku KeyEvent: ${cmd}`;
      this.runtimeState = {
        ...this.runtimeState,
        shizukuState: {
          ...this.runtimeState.shizukuState,
          lastAidlCall: `sendKeyEvent(KEYCODE_BACK=4, displayId=${vdId}) -> ${cmd}`,
          keyEventCount: this.runtimeState.shizukuState.keyEventCount + 1,
        },
        lastTouchOrKeyEvent: `HardKey BACK (0x0000000E) -> ${cmd}`,
      };
      this.emit();
      return;
    }

    this.lastLaunchStatus = 'Команда Назад (CarLifeAccessibilityService GLOBAL_ACTION_BACK)';
    this.runtimeState = {
      ...this.runtimeState,
      lastTouchOrKeyEvent: 'HardKey BACK (0x0000000E) -> GLOBAL_ACTION_BACK',
    };
    this.emit();
  }

  togglePlayPause(): void {
    this.mediaState = { ...this.mediaState, isPlaying: !this.mediaState.isPlaying };
    this.emit();
  }

  skipNextTrack(): void {
    this.fallbackTrackIndex = (this.fallbackTrackIndex + 1) % FALLBACK_PLAYLIST.length;
    const t = FALLBACK_PLAYLIST[this.fallbackTrackIndex];
    this.mediaState = {
      ...this.mediaState,
      activePackageName: t.pkg,
      playerAppTitle: t.player,
      trackTitle: t.title,
      artistName: t.artist,
      albumName: t.album,
      isPlaying: true,
      positionMs: 42_000,
      durationMs: t.durationMs,
    };
    this.emit();
  }

  skipPreviousTrack(): void {
    this.fallbackTrackIndex =
      (this.fallbackTrackIndex - 1 + FALLBACK_PLAYLIST.length) % FALLBACK_PLAYLIST.length;
    const t = FALLBACK_PLAYLIST[this.fallbackTrackIndex];
    this.mediaState = {
      ...this.mediaState,
      activePackageName: t.pkg,
      playerAppTitle: t.player,
      trackTitle: t.title,
      artistName: t.artist,
      albumName: t.album,
      isPlaying: true,
      positionMs: 42_000,
      durationMs: t.durationMs,
    };
    this.emit();
  }
}

export const bridgeController = new BridgeController();
