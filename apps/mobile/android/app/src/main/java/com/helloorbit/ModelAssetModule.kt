package com.helloorbit

import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream

class ModelAssetModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "ModelAssetModule"
    }

    @ReactMethod
    fun getModelPath(modelName: String, promise: Promise) {
        try {
            val modelsDir = File(reactContext.filesDir, "models")
            if (!modelsDir.exists()) {
                modelsDir.mkdirs()
            }

            val targetFile = File(modelsDir, modelName)
            val assetPath = "models/$modelName"

            // Check if asset exists and copy if necessary
            var shouldCopy = !targetFile.exists()
            if (targetFile.exists()) {
                // Verify file is not empty
                if (targetFile.length() == 0L) {
                    shouldCopy = true
                }
            }

            if (shouldCopy) {
                reactContext.assets.open(assetPath).use { inputStream ->
                    FileOutputStream(targetFile).use { outputStream ->
                        val buffer = ByteArray(8 * 1024)
                        var bytesRead: Int
                        while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                            outputStream.write(buffer, 0, bytesRead)
                        }
                        outputStream.flush()
                    }
                }
            }

            promise.resolve(targetFile.absolutePath)
        } catch (e: Exception) {
            promise.reject("MODEL_ASSET_ERROR", "Failed to resolve model asset: ${e.message}", e)
        }
    }
}
