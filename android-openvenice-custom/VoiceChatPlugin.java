package ai.openvenice.app;

import android.Manifest;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Locale;
import java.util.UUID;

@CapacitorPlugin(
    name = "VoiceChat",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
    }
)
public final class VoiceChatPlugin extends Plugin {
    private SpeechRecognizer speechRecognizer;
    private PluginCall activeListenCall;
    private TextToSpeech textToSpeech;
    private volatile boolean ttsReady = false;
    private PluginCall activeSpeakCall;
    private String activeUtteranceId;

    @Override
    public void load() {
        super.load();
        textToSpeech = new TextToSpeech(getContext(), status -> {
            ttsReady = status == TextToSpeech.SUCCESS;
            if (textToSpeech != null) {
                textToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override
                    public void onStart(String utteranceId) {
                        // Completion is reported through onDone/onError.
                    }

                    @Override
                    public void onDone(String utteranceId) {
                        finishSpeak(utteranceId, null);
                    }

                    @Override
                    @SuppressWarnings("deprecation")
                    public void onError(String utteranceId) {
                        finishSpeak(utteranceId, "Android text-to-speech failed");
                    }

                    @Override
                    public void onError(String utteranceId, int errorCode) {
                        finishSpeak(utteranceId, "Android text-to-speech failed: " + errorCode);
                    }
                });
            }
        }, GOOGLE_TTS);
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("speechRecognition", SpeechRecognizer.isRecognitionAvailable(getContext()));
        result.put("textToSpeech", ttsReady);
        result.put("englishLocale", "en-US");
        result.put("egyptianArabicLocale", "ar-EG");
        call.resolve(result);
    }

    @PluginMethod
    public void listen(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermissionCallback");
            return;
        }
        beginListening(call);
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("Microphone permission is required for voice chat");
            return;
        }
        beginListening(call);
    }

    private void beginListening(PluginCall call) {
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("Android speech recognition is unavailable on this device");
            return;
        }
        if (activeListenCall != null) {
            call.reject("Voice recognition is already running");
            return;
        }

        String locale = normalizeLocale(call.getString("locale"));
        activeListenCall = call;

        getActivity().runOnUiThread(() -> {
            try {
                if (speechRecognizer != null) {
                    speechRecognizer.destroy();
                }
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
                speechRecognizer.setRecognitionListener(new RecognitionListener() {
                    @Override public void onReadyForSpeech(Bundle params) {}
                    @Override public void onBeginningOfSpeech() {}
                    @Override public void onRmsChanged(float rmsdB) {}
                    @Override public void onBufferReceived(byte[] buffer) {}
                    @Override public void onEndOfSpeech() {}
                    @Override public void onPartialResults(Bundle partialResults) {}
                    @Override public void onEvent(int eventType, Bundle params) {}

                    @Override
                    public void onError(int error) {
                        PluginCall pending = takeListenCall();
                        if (pending != null) {
                            pending.reject("Speech recognition failed: " + speechErrorName(error));
                        }
                    }

                    @Override
                    public void onResults(Bundle results) {
                        PluginCall pending = takeListenCall();
                        if (pending == null) return;

                        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        float[] confidence = results.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES);
                        String transcript = matches != null && !matches.isEmpty() ? matches.get(0) : "";
                        if (transcript.trim().isEmpty()) {
                            pending.reject("No speech was recognized");
                            return;
                        }

                        JSObject result = new JSObject();
                        result.put("text", transcript);
                        result.put("locale", locale);
                        if (confidence != null && confidence.length > 0 && confidence[0] >= 0f) {
                            result.put("confidence", confidence[0]);
                        }
                        pending.resolve(result);
                    }
                });

                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, locale);
                intent.putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, false);
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
                speechRecognizer.startListening(intent);
            } catch (Exception error) {
                PluginCall pending = takeListenCall();
                if (pending != null) pending.reject("Could not start speech recognition", error);
            }
        });
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (speechRecognizer != null) speechRecognizer.stopListening();
            call.resolve();
        });
    }

    @PluginMethod
    public void cancelListening(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (speechRecognizer != null) speechRecognizer.cancel();
            PluginCall pending = takeListenCall();
            if (pending != null) {
                JSObject result = new JSObject();
                result.put("cancelled", true);
                pending.resolve(result);
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text");
        if (text == null || text.trim().isEmpty()) {
            call.reject("text is required");
            return;
        }
        if (!ttsReady || textToSpeech == null) {
            call.reject("Android text-to-speech is not ready");
            return;
        }
        if (activeSpeakCall != null) {
            stopActiveSpeech(true);
        }

        String localeTag = normalizeLocale(call.getString("locale"));
        Locale locale = Locale.forLanguageTag(localeTag);
        int availability = textToSpeech.setLanguage(locale);
        if (availability == TextToSpeech.LANG_MISSING_DATA || availability == TextToSpeech.LANG_NOT_SUPPORTED) {
            call.reject("Text-to-speech locale is not installed: " + localeTag);
            return;
        }

        Double rateValue = call.getDouble("rate");
        Double pitchValue = call.getDouble("pitch");
        float rate = rateValue == null ? 1.0f : Math.max(0.5f, Math.min(2.0f, rateValue.floatValue()));
        float pitch = pitchValue == null ? 1.0f : Math.max(0.5f, Math.min(2.0f, pitchValue.floatValue()));
        textToSpeech.setSpeechRate(rate);
        textToSpeech.setPitch(pitch);

        activeSpeakCall = call;
        activeUtteranceId = "openvenice-" + UUID.randomUUID();
        int status = textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, activeUtteranceId);
        if (status == TextToSpeech.ERROR) {
            PluginCall pending = activeSpeakCall;
            activeSpeakCall = null;
            activeUtteranceId = null;
            if (pending != null) pending.reject("Android text-to-speech could not start");
        }
    }

    @PluginMethod
    public void stopSpeaking(PluginCall call) {
        stopActiveSpeech(true);
        stopMediaPushPlayer();
        call.resolve();
    }

    // ------------------------------------------------------------------
    // Native network + studio audio (bypasses WebView CSP for trusted
    // OpenVenice voice services only — the JS layer restricts call sites).
    // ------------------------------------------------------------------

    private static final int FETCH_TIMEOUT_MS = 180_000;
    private MediaPlayer mediaPushPlayer;

    /**
     * Generic binary fetch used only by the OpenVenice voice plumbing.
     * Returns { status, contentType, bodyBase64 }. Keeps VoiceTut health and
     * speech reachable inside the WebView where connect-src blocks foreign
     * origins, without weakening the page CSP for anything else.
     */
    @PluginMethod
    public void fetchBinary(PluginCall call) {
        String urlValue = call.getString("url");
        if (urlValue == null || !(urlValue.startsWith("https://") || urlValue.startsWith("http://127.0.0.1") || urlValue.startsWith("http://localhost"))) {
            call.reject("A http(s) url is required");
            return;
        }
        String method = call.getString("method", "GET");
        if (!"GET".equalsIgnoreCase(method) && !"POST".equalsIgnoreCase(method)) {
            call.reject("Only GET and POST are supported");
            return;
        }

        getActivity().runOnUiThread(() -> { /* keep bridge thread free */ });
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(urlValue);
                connection = (HttpURLConnection) url.openConnection();
                connection.setConnectTimeout(15_000);
                connection.setReadTimeout(FETCH_TIMEOUT_MS);
                connection.setRequestMethod(method.toUpperCase(Locale.US));
                JSObject headers = call.getObject("headers");
                if (headers != null) {
                    java.util.Iterator<String> headerKeys = headers.keys();
                    while (headerKeys.hasNext()) {
                        String headerKey = headerKeys.next();
                        Object headerValue = headers.opt(headerKey);
                        if (headerValue != null) {
                            connection.setRequestProperty(headerKey, String.valueOf(headerValue));
                        }
                    }
                }
                String body = call.getString("body");
                if (body != null && !body.isEmpty() && "POST".equalsIgnoreCase(method)) {
                    connection.setDoOutput(true);
                    byte[] payload = body.getBytes(StandardCharsets.UTF_8);
                    connection.setFixedLengthStreamingMode(payload.length);
                    try (OutputStream out = connection.getOutputStream()) {
                        out.write(payload);
                    }
                }

                int status = connection.getResponseCode();
                String contentType = connection.getContentType() == null ? "" : connection.getContentType();
                InputStream input = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                byte[] bytes = readAll(input);
                JSObject result = new JSObject();
                result.put("status", status);
                result.put("contentType", contentType);
                result.put("bodyBase64", Base64.getEncoder().encodeToString(bytes));
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Native fetch failed: " + (error.getMessage() != null ? error.getMessage() : error.getClass().getSimpleName()));
            } finally {
                if (connection != null) connection.disconnect();
            }
        }, "openvenice-fetch").start();
    }

    /**
     * Plays raw base64 audio (wav/mp3) through MediaPlayer. Used for Studio
     * voice segments so the app is independent of WebView media handling.
     */
    @PluginMethod
    public void speakBinary(PluginCall call) {
        String bodyBase64 = call.getString("audioBase64");
        if (bodyBase64 == null || bodyBase64.isEmpty()) {
            call.reject("audioBase64 is required");
            return;
        }
        getActivity().runOnUiThread(() -> {
            File cacheFile;
            try {
                byte[] audio = Base64.getDecoder().decode(bodyBase64);
                cacheFile = new File(getContext().getCacheDir(), "openvenice-studio-" + UUID.randomUUID() + ".audio");
                try (FileOutputStream out = new FileOutputStream(cacheFile)) {
                    out.write(audio);
                }
            } catch (Exception error) {
                call.reject("Could not prepare studio audio", error);
                return;
            }

            stopMediaPushPlayer();
            MediaPlayer player = new MediaPlayer();
            mediaPushPlayer = player;
            try {
                player.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build());
                player.setDataSource(cacheFile.getAbsolutePath());
                player.setOnCompletionListener(mp -> {
                    releaseMediaPushPlayer();
                    JSObject result = new JSObject();
                    result.put("completed", true);
                    call.resolve(result);
                });
                player.setOnErrorListener((mp, what, extra) -> {
                    releaseMediaPushPlayer();
                    call.reject("Studio audio playback failed (" + what + ")");
                    return true;
                });
                player.prepare();
                player.start();
            } catch (Exception error) {
                releaseMediaPushPlayer();
                cacheFile.delete();
                call.reject("Could not play studio audio", error);
            } finally {
                cacheFile.deleteOnExit();
            }
        });
    }

    private synchronized void stopMediaPushPlayer() {
        if (mediaPushPlayer != null) {
            try { mediaPushPlayer.stop(); } catch (Exception ignored) { }
            releaseMediaPushPlayer();
        }
    }

    private synchronized void releaseMediaPushPlayer() {
        if (mediaPushPlayer != null) {
            try { mediaPushPlayer.release(); } catch (Exception ignored) { }
            mediaPushPlayer = null;
        }
    }

    private static byte[] readAll(InputStream input) throws Exception {
        if (input == null) return new byte[0];
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] chunk = new byte[16 * 1024];
        int read;
        while ((read = input.read(chunk)) != -1) {
            buffer.write(chunk, 0, read);
        }
        input.close();
        return buffer.toByteArray();
    }

    private synchronized PluginCall takeListenCall() {
        PluginCall pending = activeListenCall;
        activeListenCall = null;
        return pending;
    }

    private synchronized void finishSpeak(String utteranceId, String error) {
        if (activeUtteranceId == null || !activeUtteranceId.equals(utteranceId)) return;
        PluginCall pending = activeSpeakCall;
        activeSpeakCall = null;
        activeUtteranceId = null;
        if (pending == null) return;
        if (error == null) {
            JSObject result = new JSObject();
            result.put("completed", true);
            pending.resolve(result);
        } else {
            pending.reject(error);
        }
    }

    private synchronized void stopActiveSpeech(boolean resolveStopped) {
        if (textToSpeech != null) textToSpeech.stop();
        PluginCall pending = activeSpeakCall;
        activeSpeakCall = null;
        activeUtteranceId = null;
        if (pending != null && resolveStopped) {
            JSObject result = new JSObject();
            result.put("stopped", true);
            pending.resolve(result);
        }
    }

    private String normalizeLocale(String requested) {
        if (requested == null) return "en-US";
        return requested.equalsIgnoreCase("ar-EG") ? "ar-EG" : "en-US";
    }

    private String speechErrorName(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_AUDIO: return "audio";
            case SpeechRecognizer.ERROR_CLIENT: return "client";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "microphone permission";
            case SpeechRecognizer.ERROR_NETWORK: return "network";
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "network timeout";
            case SpeechRecognizer.ERROR_NO_MATCH: return "no match";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: return "recognizer busy";
            case SpeechRecognizer.ERROR_SERVER: return "recognition service";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: return "speech timeout";
            default: return "error " + error;
        }
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (speechRecognizer != null) {
            speechRecognizer.destroy();
            speechRecognizer = null;
        }
        stopActiveSpeech(false);
        stopMediaPushPlayer();
        if (textToSpeech != null) {
            textToSpeech.shutdown();
            textToSpeech = null;
        }
        ttsReady = false;
    }
}
