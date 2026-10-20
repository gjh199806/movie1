package com.libretv.app

import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.Window
import android.view.WindowManager
import android.view.WindowInsets
import android.view.WindowInsetsController
// No Handler/Looper needed for view.post

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Delay applying immersive mode until the decor view is ready
    window.decorView.post {
        applyImmersiveMode()
    }
  }

  override fun onResume() {
    super.onResume()
    // Delay applying immersive mode
    window.decorView.post {
        applyImmersiveMode()
    }
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      // Delay applying immersive mode
      window.decorView.post {
          applyImmersiveMode()
      }
    }
  }

  private fun applyImmersiveMode() {
    val window: Window = this.window // Use this.window for clarity inside the posted runnable

    // Try to force fullscreen using WindowManager flags (should hide status bar)
    window.setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, WindowManager.LayoutParams.FLAG_FULLSCREEN)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) { // Android 11 (API 30) and above
        window.setDecorFitsSystemWindows(false)
        val controller = window.insetsController
        if (controller != null) {
            controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
            controller.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    } else { // Older Android versions
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            or View.SYSTEM_UI_FLAG_FULLSCREEN
        )
    }
    // Optional: This might be too aggressive and could interfere with keyboard, etc.
    // window.addFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS)
  }
}
