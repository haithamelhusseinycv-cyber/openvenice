package ai.openvenice.app;

import android.app.Activity;
import android.app.KeyguardManager;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.annotation.ActivityCallback;
import android.content.SharedPreferences;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.Executor;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Credential vault + front-door lock.
 *
 * Uses the PLATFORM (framework) biometric APIs — not the androidx.biometric
 * library — so the device's own Android build resolves OEM quirks instead of
 * a bundled library that ages badly across Android releases. Every biometric
 * failure rejects authentication so unavailable hardware cannot unlock the app.
 */
@CapacitorPlugin(name = "AuthVault")
public class AuthVaultPlugin extends Plugin {
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "openvenice.auth.vault.v1";
    private static final String GATE_KEY_ALIAS = "openvenice.auth.gate.v1";
    private static final byte[] GATE_CHALLENGE = "OpenVenice authentication gate".getBytes(StandardCharsets.UTF_8);
    private static final String PREFS = "openvenice_auth_vault";
    private static final String PREF_CT = "ciphertext";
    private static final String PREF_IV = "iv";

    private String namedKey(String prefix, String name) {
        return prefix + "." + name;
    }

    private String validatedName(PluginCall call) {
        String name = call.getString("name");
        return name != null && name.matches("[A-Za-z0-9_-]{1,40}") ? name : null;
    }

    @PluginMethod
    public void saveNamed(PluginCall call) {
        String name = validatedName(call);
        String value = call.getString("value");
        if (name == null || value == null || value.trim().isEmpty()) {
            call.reject("Missing or invalid credential name/value");
            return;
        }
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            prefs().edit()
                .putString(namedKey(PREF_CT, name), Base64.encodeToString(encrypted, Base64.NO_WRAP))
                .putString(namedKey(PREF_IV, name), Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                .apply();
            JSObject result = new JSObject();
            result.put("saved", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not save named credential securely", error);
        }
    }

    @PluginMethod
    public void loadNamed(PluginCall call) {
        String name = validatedName(call);
        if (name == null) { call.reject("Invalid credential name"); return; }
        String ct = prefs().getString(namedKey(PREF_CT, name), null);
        String iv = prefs().getString(namedKey(PREF_IV, name), null);
        JSObject result = new JSObject();
        if (ct == null || iv == null) { result.put("found", false); call.resolve(result); return; }
        try {
            KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
            keyStore.load(null);
            if (!keyStore.containsAlias(KEY_ALIAS)) { result.put("found", false); call.resolve(result); return; }
            SecretKey key = ((KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
            byte[] plaintext = cipher.doFinal(Base64.decode(ct, Base64.NO_WRAP));
            result.put("found", true);
            result.put("value", new String(plaintext, StandardCharsets.UTF_8));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not unlock named credential", error);
        }
    }

    @PluginMethod
    public void clearNamed(PluginCall call) {
        String name = validatedName(call);
        if (name == null) { call.reject("Invalid credential name"); return; }
        prefs().edit().remove(namedKey(PREF_CT, name)).remove(namedKey(PREF_IV, name)).apply();
        JSObject result = new JSObject();
        result.put("cleared", true);
        call.resolve(result);
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, 0);
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
        keyStore.load(null);
        if (keyStore.containsAlias(KEY_ALIAS)) {
            return ((KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
        }

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        generator.init(new KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build());
        return generator.generateKey();
    }

    @PluginMethod
    public void save(PluginCall call) {
        String value = call.getString("value");
        if (value == null || value.trim().isEmpty()) {
            call.reject("Missing value");
            return;
        }

        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            prefs().edit()
                .putString(PREF_CT, Base64.encodeToString(encrypted, Base64.NO_WRAP))
                .putString(PREF_IV, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                .apply();

            JSObject result = new JSObject();
            result.put("saved", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not save credential securely", error);
        }
    }

    @PluginMethod
    public void load(PluginCall call) {
        String ct = prefs().getString(PREF_CT, null);
        String iv = prefs().getString(PREF_IV, null);
        JSObject result = new JSObject();
        if (ct == null || iv == null) {
            result.put("found", false);
            call.resolve(result);
            return;
        }

        try {
            KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
            keyStore.load(null);
            if (!keyStore.containsAlias(KEY_ALIAS)) {
                prefs().edit().clear().apply();
                result.put("found", false);
                call.resolve(result);
                return;
            }

            SecretKey key = ((KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null)).getSecretKey();
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                Cipher.DECRYPT_MODE,
                key,
                new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP))
            );
            byte[] plaintext = cipher.doFinal(Base64.decode(ct, Base64.NO_WRAP));
            result.put("found", true);
            result.put("value", new String(plaintext, StandardCharsets.UTF_8));
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not unlock saved credential", error);
        }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        try {
            prefs().edit().remove(PREF_CT).remove(PREF_IV).apply();
            JSObject result = new JSObject();
            result.put("cleared", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not clear saved credential", error);
        }
    }

    private Cipher gateCipher() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
        keyStore.load(null);
        if (!keyStore.containsAlias(GATE_KEY_ALIAS)) {
            KeyGenParameterSpec.Builder spec = new KeyGenParameterSpec.Builder(
                GATE_KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setUserAuthenticationRequired(true);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                spec.setUserAuthenticationParameters(0,
                    KeyProperties.AUTH_BIOMETRIC_STRONG | KeyProperties.AUTH_DEVICE_CREDENTIAL);
            } else {
                // Legacy credential confirmation authorizes key use for a short window.
                spec.setUserAuthenticationValidityDurationSeconds(30);
            }
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
            generator.init(spec.build());
            generator.generateKey();
            keyStore.load(null);
        }
        SecretKey key = ((KeyStore.SecretKeyEntry) keyStore.getEntry(GATE_KEY_ALIAS, null)).getSecretKey();
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key);
        return cipher;
    }

    private int biometricStatus() {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
                KeyguardManager keyguard = (KeyguardManager) getContext().getSystemService(KeyguardManager.class);
                boolean secure = keyguard != null && keyguard.isDeviceSecure();
                return secure ? BiometricManager.BIOMETRIC_SUCCESS : BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE;
            }
            BiometricManager manager = getContext().getSystemService(BiometricManager.class);
            if (manager == null) return BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE;
            return manager.canAuthenticate(
                BiometricManager.Authenticators.BIOMETRIC_STRONG
                    | BiometricManager.Authenticators.DEVICE_CREDENTIAL);
        } catch (Throwable error) {
            // Some OEM builds throw from canAuthenticate (missing KeyguardManager
            // bindings etc.). Treat as unavailable rather than crashing the app.
            return BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE;
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", true);
        result.put("storage", "Android Keystore");
        result.put("biometric", biometricStatus() == BiometricManager.BIOMETRIC_SUCCESS);
        call.resolve(result);
    }

    /**
     * Premium lock gate: platform BiometricPrompt (fingerprint, face, or
     * device credential). Success is reported only after a verified OS callback.
     */
    @PluginMethod
    public void gate(PluginCall call) {
        try {
            android.app.Activity activity = getBridge() != null ? getBridge().getActivity() : null;
            if (activity == null || activity.isFinishing()) {
                call.reject("Authentication activity unavailable");
                return;
            }

            int status = biometricStatus();
            if (status != BiometricManager.BIOMETRIC_SUCCESS) {
                call.reject("No usable authenticator. Configure a device screen lock and retry.");
                return;
            }

            Executor executor = activity.getMainExecutor();
            String title = call.getString("title", "Unlock OpenVenice");

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.hardware.biometrics.BiometricPrompt prompt =
                    new android.hardware.biometrics.BiometricPrompt.Builder(activity)
                        .setTitle(title)
                        .setSubtitle(call.getString("subtitle", ""))
                        .setAllowedAuthenticators(
                            BiometricManager.Authenticators.BIOMETRIC_STRONG
                                | BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                        .build();
                android.os.CancellationSignal cancellation = new android.os.CancellationSignal();
                cancellation.setOnCancelListener(() ->
                    call.reject("Authentication cancelled"));
                Cipher cipher = gateCipher();
                prompt.authenticate(new BiometricPrompt.CryptoObject(cipher), cancellation, executor, callbackFor(call));
                return;
            }

            // API 28/29: framework prompt without credential combo — fall back
            // to the KeyguardManager confirm flow for PIN/pattern/password.
            KeyguardManager keyguard = (KeyguardManager) getContext().getSystemService(KeyguardManager.class);
            if (keyguard != null && keyguard.isDeviceSecure()) {
                android.content.Intent confirmIntent = keyguard.createConfirmDeviceCredentialIntent(
                    title,
                    call.getString("subtitle", ""));
                if (confirmIntent != null) {
                    startActivityForResult(call, confirmIntent, "credentialResult");
                    return;
                }
            }
            call.reject("Device authentication prompt unavailable");
        } catch (Throwable error) {
            call.reject("Device authentication unavailable");
        }
    }

    private BiometricPrompt.AuthenticationCallback callbackFor(final PluginCall call) {
        return new BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                try {
                    BiometricPrompt.CryptoObject crypto = result.getCryptoObject();
                    Cipher cipher = crypto != null ? crypto.getCipher() : null;
                    if (cipher == null) {
                        call.reject("Authentication did not authorize the secure key");
                        return;
                    }
                    // A forged success callback cannot perform this key operation.
                    byte[] proof = cipher.doFinal(GATE_CHALLENGE);
                    JSObject response = new JSObject();
                    response.put("unlocked", proof.length > 0);
                    call.resolve(response);
                } catch (Exception error) {
                    call.reject("Secure device authentication failed");
                }
            }

            @Override
            public void onAuthenticationError(int errorCode, CharSequence errString) {
                call.reject(errString != null ? errString.toString() : "Authentication failed");
            }
        };
    }

    @ActivityCallback
    private void credentialResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK) {
            call.reject("Authentication cancelled or failed");
            return;
        }
        try {
            byte[] proof = gateCipher().doFinal(GATE_CHALLENGE);
            JSObject response = new JSObject();
            response.put("unlocked", proof.length > 0);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("Device credential did not authorize the secure key");
        }
    }
}
