package ai.openvenice.app;

import android.Manifest;
import android.content.Intent;
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

import java.util.ArrayList;
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
        });
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
        call.resolve();
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
        if (textToSpeech != null) {
            textToSpeech.shutdown();
            textToSpeech = null;
        }
        ttsReady = false;
    }
}
