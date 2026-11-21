/**
 * TypeScript contract & runtime simulation of the Android Shizuku UserService (AIDL):
 * ICarLifeShizukuService.aidl / CarLifeShizukuService : ICarLifeShizukuService.Stub()
 *
 * Dependencies mirrored:
 * - dev.rikka.shizuku:api:13.1.5
 * - dev.rikka.shizuku:provider:13.1.5
 * - rikka.shizuku.ShizukuProvider (${applicationId}.shizuku)
 */

export enum ShizukuStatusKind {
  NOT_RUNNING = 'not_running',
  NO_PERMISSION = 'no_permission',
  RUNNING_GRANTED = 'running_granted',
}

export type ShizukuStatusLabel =
  | 'Активен и разрешён'
  | 'Нет прав'
  | 'Не запущен';

export interface ShizukuServiceState {
  binderAlive: boolean;
  permissionGranted: boolean;
  userServiceBound: boolean;
  statusKind: ShizukuStatusKind;
  statusLabel: ShizukuStatusLabel;
  userServiceComponent: string;
  boundDisplayId: number;
  lastAidlCall: string;
  amStartCount: number;
  injectedTouchCount: number;
  keyEventCount: number;
}

export interface ICarLifeShizukuService {
  launchAppOnDisplay(packageName: string, activityName: string, displayId: number): string;
  injectTouch(
    action: number,
    x: number,
    y: number,
    downTime: number,
    eventTime: number,
    displayId: number
  ): string;
  sendKeyEvent(keyCode: number, displayId: number): string;
  destroy(): void;
}

export const SHIZUKU_REQ_CODE = 1001;
export const SHIZUKU_PACKAGE_NAME = 'moe.shizuku.privileged.api';

export function deriveShizukuStatus(
  binderAlive: boolean,
  permissionGranted: boolean
): { kind: ShizukuStatusKind; label: ShizukuStatusLabel } {
  if (!binderAlive) {
    return { kind: ShizukuStatusKind.NOT_RUNNING, label: 'Не запущен' };
  }
  if (!permissionGranted) {
    return { kind: ShizukuStatusKind.NO_PERMISSION, label: 'Нет прав' };
  }
  return { kind: ShizukuStatusKind.RUNNING_GRANTED, label: 'Активен и разрешён' };
}

export class CarLifeShizukuServiceStub implements ICarLifeShizukuService {
  private bound = false;

  bind(): void {
    this.bound = true;
  }

  isBound(): boolean {
    return this.bound;
  }

  launchAppOnDisplay(packageName: string, activityName: string, displayId: number): string {
    const component = activityName ? `${packageName}/${activityName}` : packageName;
    if (activityName) {
      return `am start --display ${displayId} -n ${component}`;
    }
    return `am start --display ${displayId} -a android.intent.action.MAIN -c android.intent.category.LAUNCHER ${packageName}`;
  }

  injectTouch(
    action: number,
    x: number,
    y: number,
    downTime: number,
    eventTime: number,
    displayId: number
  ): string {
    return (
      `MotionEvent.obtain(${downTime}, ${eventTime}, ${action}, ${x.toFixed(1)}, ${y.toFixed(1)}, 0) ` +
      `[SOURCE_TOUCHSCREEN, setDisplayId(${displayId})] -> InputManager.injectInputEvent(ASYNC)`
    );
  }

  sendKeyEvent(keyCode: number, displayId: number): string {
    return `input keyevent --display ${displayId} ${keyCode}`;
  }

  destroy(): void {
    this.bound = false;
  }
}
