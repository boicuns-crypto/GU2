package com.carlife.bridge.transport

import android.os.Process
import java.io.OutputStream
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/**
 * Выделенный поток отправки USB AOA на LinkedBlockingQueue:
 * - Аудио 0x0003 и управляющие команды 0x0001 имеют приоритет над видео 0x0002.
 * - При накоплении > 5 видеокадров устаревшие P-кадры сбрасываются (IDR / SPS+PPS не сбрасываются).
 */
class UsbTxTransportEngine(
    private val outputStreamProvider: () -> OutputStream?
) {
    data class TxPacket(
        val channel: Int,
        val payload: ByteArray,
        val isVideoKeyFrame: Boolean = false
    )

    private val priorityQueue = LinkedBlockingQueue<TxPacket>(256)
    private val videoQueue = LinkedBlockingQueue<TxPacket>(64)
    private val signalQueue = LinkedBlockingQueue<Unit>(512)
    private val running = AtomicBoolean(false)
    private var workerThread: Thread? = null

    val droppedStalePFrames = AtomicLong(0)
    val prioritizedAudioFrames = AtomicLong(0)

    fun start() {
        if (!running.compareAndSet(false, true)) return
        workerThread = Thread({
            Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)
            while (running.get()) {
                try {
                    signalQueue.take()
                    drainQueues()
                } catch (_: InterruptedException) {
                    break
                } catch (_: Throwable) {
                    // Обработка ошибок записи AOA обрабатывается вызывающей службой
                }
            }
        }, "CarLife-USB-TX-Thread").apply { start() }
    }

    fun enqueueControlOrAudio(channel: Int, packet: ByteArray) {
        if (channel == 0x0003) {
            prioritizedAudioFrames.incrementAndGet()
        }
        priorityQueue.offer(TxPacket(channel, packet, isVideoKeyFrame = false))
        signalQueue.offer(Unit)
    }

    fun enqueueVideo(packet: ByteArray, isKeyFrame: Boolean) {
        if (!isKeyFrame && videoQueue.size > MAX_VIDEO_QUEUE_FRAMES) {
            // Сброс устаревших P-кадров при отставании канала AOA
            while (videoQueue.size > MAX_VIDEO_QUEUE_FRAMES) {
                val head = videoQueue.peek() ?: break
                if (head.isVideoKeyFrame) break
                if (videoQueue.poll() != null) {
                    droppedStalePFrames.incrementAndGet()
                }
            }
        }
        videoQueue.offer(TxPacket(0x0002, packet, isVideoKeyFrame = isKeyFrame))
        signalQueue.offer(Unit)
    }

    private fun drainQueues() {
        val out = outputStreamProvider() ?: return
        while (running.get()) {
            val next = priorityQueue.poll() ?: videoQueue.poll() ?: break
            out.write(next.payload)
        }
        out.flush()
    }

    fun stop() {
        running.set(false)
        workerThread?.interrupt()
        workerThread = null
        priorityQueue.clear()
        videoQueue.clear()
        signalQueue.clear()
    }

    companion object {
        const val MAX_VIDEO_QUEUE_FRAMES = 5
    }
}
