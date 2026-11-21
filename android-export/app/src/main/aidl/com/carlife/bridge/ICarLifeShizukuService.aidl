package com.carlife.bridge;

interface ICarLifeShizukuService {
    void launchAppOnDisplay(String packageName, String activityName, int displayId);
    void injectTouch(int action, float x, float y, long downTime, long eventTime, int displayId);
    void sendKeyEvent(int keyCode, int displayId);
    void destroy();
}
