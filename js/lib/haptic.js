// ============================================================
// HAPTIC.JS — single source of truth for the small vibration
// feedback used across page scripts. iOS Safari has no Vibration
// API support so this is effectively a no-op there; on Android +
// other platforms with navigator.vibrate it runs the pattern.
// ============================================================
function haptic(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
}
