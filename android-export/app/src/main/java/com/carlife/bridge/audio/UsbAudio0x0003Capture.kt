package com.carlife.bridge.audio

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.projection.MediaProjection
import com.carlife.bridge.transport.UsbTxTransportEngine
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.abs

/**
 * Захват системного звука через AudioPlaybackCapture (48 кГц Stereo 16-bit PCM, 4096B)
 * и отправка в канал 0x0003 с автоматическим глушением и восстановлением STREAM_MUSIC.
 */
class UsbAudio0x0003Capture(
    private val context: Context,
    private val txEngine: UsbTxTransportEngine,
    private val frameEncoder: (pcmChunk: ByteArray, length: Int, timestampMs: Long) -> ByteArray,
    private val mediaInitPacketBuilder: () -> ByteArray,
    private val mediaStopPacketBuilder: () -> ByteArray
) {
    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val isCapturing = AtomicBoolean(false)
    private var captureThread: Thread? = null
    private var savedMusicVolume: Int? = null

    @SuppressLint("MissingPermission")
    fun start(
        projection: MediaProjection,
        mutePhoneSpeaker: Boolean
    ) {
        if (!isCapturing.compareAndSet(false, true)) return

        if (mutePhoneSpeaker) {
            val currentVol = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
            savedMusicVolume = currentVol
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, 0, 0)
        }

        val captureConfig = AudioPlaybackCaptureConfiguration.Builder(projection)
            .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
            .addMatchingUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
            .addMatchingUsage(AudioAttributes.USAGE_GAME)
            .build()

        val format = AudioFormat.Builder()
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setSampleRate(48_000)
            .setChannelMask(AudioFormat.CHANNEL_IN_STEREO)
            .build()

        val bufferSize = maxOf(
            AudioRecord.getMinBufferSize(
                48_000,
                AudioFormat.CHANNEL_IN_STEREO,
                AudioFormat.ENCODING_PCM_16BIT
            ),
            CHUNK_SIZE_BYTES * 2
        )

        val audioRecord = AudioRecord.Builder()
            .setAudioFormat(format)
            .setBufferSizeInBytes(bufferSize)
            .setAudioPlaybackCaptureConfig(captureConfig)
            .build()

        txEngine.enqueueControlOrAudio(0x0003, mediaInitPacketBuilder())

        captureThread = Thread({
            val pcmBuffer = ByteArray(CHUNK_SIZE_BYTES)
            try {
                audioRecord.startRecording()
                while (isCapturing.get()) {
                    val read = audioRecord.read(pcmBuffer, 0, pcmBuffer.size)
                    if (read > 0 && !isSilentFrame(pcmBuffer, read)) {
                        val packet = frameEncoder(pcmBuffer, read, System.currentTimeMillis())
                        txEngine.enqueueControlOrAudio(0x0003, packet)
                    }
                }
            } finally {
                runCatching { audioRecord.stop() }
                runCatching { audioRecord.release() }
            }
        }, "CarLife-Audio-0x0003").apply { start() }
    }

    fun stop() {
        if (!isCapturing.compareAndSet(true, false)) {
            restorePhoneSpeakerVolume()
            return
        }
        captureThread?.interrupt()
        captureThread = null
        txEngine.enqueueControlOrAudio(0x0003, mediaStopPacketBuilder())
        restorePhoneSpeakerVolume()
    }

    fun restorePhoneSpeakerVolume() {
        savedMusicVolume?.let { previous ->
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, previous, 0)
            savedMusicVolume = null
        }
    }

    private fun isSilentFrame(data: ByteArray, length: Int): Boolean {
        var i = 0
        while (i + 1 < length) {
            val sample = ((data[i + 1].toInt() shl 8) or (data[i].toInt() and 0xFF)).toShort()
            if (abs(sample.toInt()) > SILENCE_THRESHOLD) return false
            i += 2
        }
        return true
    }

    companion object {
        const val CHUNK_SIZE_BYTES = 4096
        private const val SILENCE_THRESHOLD = 16
    }
}
