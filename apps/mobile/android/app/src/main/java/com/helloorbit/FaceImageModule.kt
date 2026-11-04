package com.helloorbit

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.media.ExifInterface
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetector
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.google.mlkit.vision.face.FaceLandmark
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.atan2
import kotlin.math.hypot

/**
 * FaceImageModule: High-Performance Real-Pixel Facial Alignment Engine for Hello Orbit
 *
 * Extracts real camera photograph pixels from high-res captures, applies EXIF orientation
 * normalization, detects facial landmarks via Google ML Kit, performs Umeyama canonical
 * similarity alignment to 112x112, and extracts the 1x3x112x112 BGR Float32 tensor for SFace.
 */
class FaceImageModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val CANONICAL_LEFT_EYE_X = 38.2946f
        const val CANONICAL_LEFT_EYE_Y = 51.6963f
        const val CANONICAL_RIGHT_EYE_X = 73.5318f
        const val CANONICAL_RIGHT_EYE_Y = 51.5014f
        const val TARGET_SIZE = 112

        private val detectorOptions by lazy {
            FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
                .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_NONE)
                .setMinFaceSize(0.15f)
                .build()
        }

        private val sharedDetector: FaceDetector by lazy {
            FaceDetection.getClient(detectorOptions)
        }
    }

    override fun getName(): String {
        return "FaceImageModule"
    }

    @ReactMethod
    fun extractFaceTensor(imagePath: String, deleteAfter: Boolean, promise: Promise) {
        Thread {
            try {
                val cleanPath = if (imagePath.startsWith("file://")) imagePath.substring(7) else imagePath
                val file = File(cleanPath)
                if (!file.exists() || !file.canRead()) {
                    promise.reject("FILE_NOT_FOUND", "Image file does not exist or cannot be read: $cleanPath")
                    return@Thread
                }

                // 1. Efficient In-Memory Bitmap Decoding (with max 1920 dimension bound)
                val boundsOptions = BitmapFactory.Options().apply {
                    inJustDecodeBounds = true
                }
                BitmapFactory.decodeFile(cleanPath, boundsOptions)

                val maxDim = maxOf(boundsOptions.outWidth, boundsOptions.outHeight)
                var sampleSize = 1
                while (maxDim / (sampleSize * 2) >= 1280) {
                    sampleSize *= 2
                }

                val decodeOptions = BitmapFactory.Options().apply {
                    inSampleSize = sampleSize
                    inPreferredConfig = Bitmap.Config.ARGB_8888
                }
                var bitmap = BitmapFactory.decodeFile(cleanPath, decodeOptions)
                if (bitmap == null) {
                    promise.reject("DECODE_ERROR", "Failed to decode image from path: $cleanPath")
                    return@Thread
                }

                try {
                    val exif = ExifInterface(cleanPath)
                    val orientation = exif.getAttributeInt(
                        ExifInterface.TAG_ORIENTATION,
                        ExifInterface.ORIENTATION_NORMAL
                    )
                    val rotationDeg = when (orientation) {
                        ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                        ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                        ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                        else -> 0f
                    }
                    if (rotationDeg != 0f) {
                        val rotMatrix = Matrix()
                        rotMatrix.postRotate(rotationDeg)
                        val rotated = Bitmap.createBitmap(
                            bitmap, 0, 0, bitmap.width, bitmap.height, rotMatrix, true
                        )
                        bitmap.recycle()
                        bitmap = rotated
                    }
                } catch (e: Exception) {
                    // Ignore EXIF read failures and proceed with decoded bitmap
                }

                // 2. Detect Face via Shared Fast ML Kit Detector with Multi-Orientation Fallback
                // Accommodates unhandled front-camera sensor orientations (0, 270, 90, 180) across all Android devices
                val candidateRotations = intArrayOf(0, 270, 90, 180)

                fun processAlignedFace(primaryFace: Face, currentBitmap: Bitmap) {
                    try {
                        // 3. Compute Canonical Similarity Alignment Matrix
                        val leftEye = primaryFace.getLandmark(FaceLandmark.LEFT_EYE)?.position
                        val rightEye = primaryFace.getLandmark(FaceLandmark.RIGHT_EYE)?.position

                        val matrix = Matrix()

                        if (leftEye != null && rightEye != null) {
                            // Map ML Kit anatomical landmarks to image space (viewer left vs viewer right in 2D image coordinates)
                            val viewerLeftEye = if (leftEye.x <= rightEye.x) leftEye else rightEye
                            val viewerRightEye = if (leftEye.x <= rightEye.x) rightEye else leftEye

                            val srcDx = viewerRightEye.x - viewerLeftEye.x
                            val srcDy = viewerRightEye.y - viewerLeftEye.y
                            val srcDist = hypot(srcDx, srcDy)

                            val dstDx = CANONICAL_RIGHT_EYE_X - CANONICAL_LEFT_EYE_X
                            val dstDy = CANONICAL_RIGHT_EYE_Y - CANONICAL_LEFT_EYE_Y
                            val dstDist = hypot(dstDx, dstDy)

                            val scale = dstDist / (if (srcDist < 1f) 1f else srcDist)
                            val srcAngle = atan2(srcDy, srcDx) * 180f / Math.PI.toFloat()
                            val dstAngle = atan2(dstDy, dstDx) * 180f / Math.PI.toFloat()
                            val rotDeg = dstAngle - srcAngle

                            val srcEyeCenterX = (viewerLeftEye.x + viewerRightEye.x) / 2f
                            val srcEyeCenterY = (viewerLeftEye.y + viewerRightEye.y) / 2f
                            val dstEyeCenterX = (CANONICAL_LEFT_EYE_X + CANONICAL_RIGHT_EYE_X) / 2f
                            val dstEyeCenterY = (CANONICAL_LEFT_EYE_Y + CANONICAL_RIGHT_EYE_Y) / 2f

                            matrix.postTranslate(-srcEyeCenterX, -srcEyeCenterY)
                            matrix.postRotate(rotDeg)
                            matrix.postScale(scale, scale)
                            matrix.postTranslate(dstEyeCenterX, dstEyeCenterY)
                        } else {
                            // Fallback to bounding box alignment if individual eye landmarks are occluded
                            val box = primaryFace.boundingBox
                            val boxCenterX = box.centerX().toFloat()
                            val boxCenterY = box.centerY().toFloat()
                            val targetFaceWidth = 72f
                            val scale = targetFaceWidth / box.width().toFloat().coerceAtLeast(1f)

                            matrix.postTranslate(-boxCenterX, -boxCenterY)
                            val rollDeg = -primaryFace.headEulerAngleZ
                            if (rollDeg != 0f) {
                                matrix.postRotate(rollDeg)
                            }
                            matrix.postScale(scale, scale)
                            matrix.postTranslate(TARGET_SIZE / 2f, TARGET_SIZE / 2f)
                        }

                        // 4. Warp Real Camera Pixels into 112x112 Canonical Face Crop
                        val alignedBitmap = Bitmap.createBitmap(TARGET_SIZE, TARGET_SIZE, Bitmap.Config.ARGB_8888)
                        val canvas = Canvas(alignedBitmap)
                        val paint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.DITHER_FLAG)
                        canvas.drawBitmap(currentBitmap, matrix, paint)

                        // 5. Extract Raw Real Pixels & Build Float32 BGR Tensor Buffer
                        val totalPixels = TARGET_SIZE * TARGET_SIZE
                        val pixels = IntArray(totalPixels)
                        alignedBitmap.getPixels(pixels, 0, TARGET_SIZE, 0, 0, TARGET_SIZE, TARGET_SIZE)

                        val tensorByteBuffer = ByteBuffer.allocate(3 * totalPixels * 4).order(ByteOrder.LITTLE_ENDIAN)

                        // SFace OpenCV layout: BGR, NCHW
                        // Channel 0: Blue (0..255 float32)
                        for (i in 0 until totalPixels) {
                            val p = pixels[i]
                            val b = (p and 0xFF).toFloat()
                            tensorByteBuffer.putFloat(b)
                        }
                        // Channel 1: Green (0..255 float32)
                        for (i in 0 until totalPixels) {
                            val p = pixels[i]
                            val g = ((p shr 8) and 0xFF).toFloat()
                            tensorByteBuffer.putFloat(g)
                        }
                        // Channel 2: Red (0..255 float32)
                        for (i in 0 until totalPixels) {
                            val p = pixels[i]
                            val r = ((p shr 16) and 0xFF).toFloat()
                            tensorByteBuffer.putFloat(r)
                        }

                        val base64Tensor = Base64.encodeToString(tensorByteBuffer.array(), Base64.NO_WRAP)

                        // Cleanup in-memory bitmaps and temp storage
                        alignedBitmap.recycle()
                        currentBitmap.recycle()
                        if (deleteAfter) file.delete()

                        val result = Arguments.createMap().apply {
                            putString("base64Tensor", base64Tensor)
                            putInt("width", TARGET_SIZE)
                            putInt("height", TARGET_SIZE)
                            putDouble("faceBoundsWidth", primaryFace.boundingBox.width().toDouble())
                            putDouble("faceBoundsHeight", primaryFace.boundingBox.height().toDouble())
                        }

                        promise.resolve(result)
                    } catch (e: Exception) {
                        currentBitmap.recycle()
                        if (deleteAfter) file.delete()
                        promise.reject("ALIGNMENT_ERROR", "Failed to align face crop: ${e.message}", e)
                    }
                }

                fun tryDetectWithRotation(rotIndex: Int) {
                    if (rotIndex >= candidateRotations.size) {
                        bitmap.recycle()
                        if (deleteAfter) file.delete()
                        promise.reject("NO_FACE_DETECTED", "No face detected in the photo. Please align your face inside the guide.")
                        return
                    }

                    val rot = candidateRotations[rotIndex]
                    var workingBitmap = bitmap
                    if (rot != 0) {
                        val rotMatrix = Matrix().apply { postRotate(rot.toFloat()) }
                        workingBitmap = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, rotMatrix, true)
                    }

                    val inputImage = InputImage.fromBitmap(workingBitmap, 0)
                    sharedDetector.process(inputImage)
                        .addOnSuccessListener { faces ->
                            if (faces.isEmpty()) {
                                if (workingBitmap != bitmap) {
                                    workingBitmap.recycle()
                                }
                                tryDetectWithRotation(rotIndex + 1)
                                return@addOnSuccessListener
                            }

                            if (workingBitmap != bitmap) {
                                bitmap.recycle()
                                bitmap = workingBitmap
                            }

                            val primaryFace = faces.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() } ?: faces[0]
                            processAlignedFace(primaryFace, bitmap)
                        }
                        .addOnFailureListener { e ->
                            if (workingBitmap != bitmap) {
                                workingBitmap.recycle()
                            }
                            if (rotIndex + 1 < candidateRotations.size) {
                                tryDetectWithRotation(rotIndex + 1)
                            } else {
                                bitmap.recycle()
                                if (deleteAfter) file.delete()
                                promise.reject("DETECTION_ERROR", "ML Kit detection failed: ${e.message}", e)
                            }
                        }
                }

                tryDetectWithRotation(0)
            } catch (e: Exception) {
                promise.reject("PROCESS_ERROR", "Failed to process face image: ${e.message}", e)
            }
        }.start()
    }
}
