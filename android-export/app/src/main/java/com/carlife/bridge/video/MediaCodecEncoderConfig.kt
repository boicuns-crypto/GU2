package com.carlife.bridge.video

import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.projection.MediaProjection
import android.os.Build
import android.view.Surface

/**
 * Профиль H.264 MediaCodec по оригинальному MediaFormatUtils.smali:
 * 1280x720, 25/30 fps, 2 Мбит/с, BITRATE_MODE_VBR (1),
 * AVCProfileBaseline (1), AVCLevel3 (0x100), KEY_REPEAT_PREVIOUS_FRAME_AFTER = 100_000L,
 * KEY_PRIORITY = 0 (realtime), video-qp-p-max = 36.
 */
object MediaCodecEncoderConfig {

    const val DEFAULT_WIDTH = 1280
    const val DEFAULT_HEIGHT = 720
    const val DEFAULT_FPS = 30
    const val DEFAULT_BITRATE_BPS = 2_000_000
    const val DEFAULT_DENSITY_DPI = 160

    fun buildH264Format(
        width: Int = DEFAULT_WIDTH,
        height: Int = DEFAULT_HEIGHT,
        fps: Int = DEFAULT_FPS,
        bitrateBps: Int = DEFAULT_BITRATE_BPS
    ): MediaFormat {
        return MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height).apply {
            setInteger(
                MediaFormat.KEY_COLOR_FORMAT,
                MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface
            )
            setInteger(MediaFormat.KEY_BIT_RATE, bitrateBps)
            setInteger(MediaFormat.KEY_FRAME_RATE, fps)
            setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
            setInteger(
                MediaFormat.KEY_BITRATE_MODE,
                MediaCodecInfo.EncoderCapabilities.BITRATE_MODE_VBR
            )
            setInteger(
                MediaFormat.KEY_PROFILE,
                MediaCodecInfo.CodecProfileLevel.AVCProfileBaseline
            )
            setInteger(
                MediaFormat.KEY_LEVEL,
                MediaCodecInfo.CodecProfileLevel.AVCLevel3
            )
            setLong(MediaFormat.KEY_REPEAT_PREVIOUS_FRAME_AFTER, 100_000L)
            setInteger(MediaFormat.KEY_PRIORITY, 0)
            // Стабилизация QP на кодеках Samsung Exynos / Qualcomm
            setInteger("video-qp-p-max", 36)
        }
    }

    fun createConfiguredEncoder(
        width: Int = DEFAULT_WIDTH,
        height: Int = DEFAULT_HEIGHT,
        fps: Int = DEFAULT_FPS,
        bitrateBps: Int = DEFAULT_BITRATE_BPS
    ): Pair<MediaCodec, Surface> {
        val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
        val format = buildH264Format(width, height, fps, bitrateBps)
        codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        val inputSurface = codec.createInputSurface()
        return codec to inputSurface
    }

    fun createMirroringVirtualDisplay(
        projection: MediaProjection,
        surface: Surface,
        width: Int = DEFAULT_WIDTH,
        height: Int = DEFAULT_HEIGHT,
        densityDpi: Int = DEFAULT_DENSITY_DPI
    ): VirtualDisplay {
        val clampedDpi = densityDpi.coerceIn(160, 200)
        return projection.createVirtualDisplay(
            "CarLife-Mirror",
            width,
            height,
            clampedDpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            surface,
            null,
            null
        )
    }

    fun createPresentationVirtualDisplay(
        displayManager: DisplayManager,
        surface: Surface,
        width: Int = DEFAULT_WIDTH,
        height: Int = DEFAULT_HEIGHT,
        densityDpi: Int = DEFAULT_DENSITY_DPI,
        isPublicForShizuku: Boolean
    ): VirtualDisplay {
        val baseFlags = DisplayManager.VIRTUAL_DISPLAY_FLAG_PRESENTATION or
            DisplayManager.VIRTUAL_DISPLAY_FLAG_OWN_CONTENT_ONLY
        val flags = if (isPublicForShizuku) {
            var extra = baseFlags or DisplayManager.VIRTUAL_DISPLAY_FLAG_PUBLIC
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                extra = extra or (1 shl 11) // VIRTUAL_DISPLAY_FLAG_TRUSTED when permitted
            }
            extra
        } else {
            baseFlags
        }
        return displayManager.createVirtualDisplay(
            if (isPublicForShizuku) "CarLife-Shizuku-VD" else "CarLife-Cockpit-VD",
            width,
            height,
            densityDpi.coerceIn(160, 200),
            surface,
            flags,
            null,
            null
        )
    }
}
