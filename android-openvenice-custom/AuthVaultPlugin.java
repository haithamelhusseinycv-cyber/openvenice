package ai.openvenice.app;

import android.app.KeyguardManager;
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
 * path is armored with catch(Throwable) and falls OPEN: the lock can never
 * be the reason the app fails to launch.
 */
@CapacitorPlugin(name = "AuthVault")
public class AuthVaultPlugin extends Plugin {
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "openvenice.auth.vault.v1";
    private static final String PREFS = "openvenice_auth_vault";
    private static final String PREF_CT = "ciphertext";
    private static final String PREF_IV = "iv";

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
            prefs().edit().clear().apply();
            KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
            keyStore.load(null);
            if (keyStore.containsAlias(KEY_ALIAS)) keyStore.deleteEntry(KEY_ALIAS);
            JSObject result = new JSObject();
            result.put("cleared", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not clear saved credential", error);
        }
    }

    private int biometricStatus() {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                KeyguardManager keyguard = (KeyguardManager) getContext().getSystemService(KeyguardManager.class);
                boolean secure = keyguard != null && keyguard.isDeviceSecure();
                return secure ? BiometricManager.BIOMETRIC_SUCCESS : BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE;
            }
            BiometricManager manager = getContext().getSystemService(BiometricManager.class);
            if (manager == null) return BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE;
            return manager.canAuthenticate(
                BiometricManager.Authenticators.BIOMETRIC_WEAK
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
     * device credential). Armored end to end — any internal failure falls
     * OPEN, because the lock must never be able to kill the app.
     */
    @PluginMethod
    public void gate(PluginCall call) {
        try {
            android.app.Activity activity = getBridge() != null ? getBridge().getActivity() : null;
            if (activity == null || activity.isFinishing()) {
                call.resolve(fallOpen("activity-unavailable"));
                return;
            }

            int status = biometricStatus();
            if (status != BiometricManager.BIOMETRIC_SUCCESS) {
                // No usable authenticator (none enrolled, no lock screen,
                // hardware missing): fall open and surface why.
                JSObject result = fallOpen("no-authenticator");
                result.put("status", status);
                call.resolve(result);
                return;
            }

            Executor executor = activity.getMainExecutor();
            String title = call.getString("title", "Unlock OpenVenice");

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setSubtitle(call.getString("subtitle", ""))
                    .setAllowedAuthenticators(
                        BiometricManager.Authenticators.BIOMETRIC_WEAK
                            | BiometricManager.Authenticators.DEVICE_CREDENTIAL)
                    .build();
                new BiometricPrompt(activity, executor, callbackFor(call)).authenticate(info);
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
                    activity.startActivityForResult(confirmIntent, 7001);
                    // Resolve optimistically; the vault itself is unchanged and
                    // the gate is UX, not a security boundary for the key.
                    call.resolve(fallOpen("legacy-credential-flow"));
                    return;
                }
            }
            call.resolve(fallOpen("no-framework-prompt"));
        } catch (Throwable error) {
            // Never let biometric internals take the app down.
            call.resolve(fallOpen(error.getClass().getSimpleName()));
        }
    }

    private BiometricPrompt.AuthenticationCallback callbackFor(final PluginCall call) {
        return new BiometricPrompt.AuthenticationCallback() {
            @Override
            public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                JSObject response = new JSObject();
                response.put("unlocked", true);
                call.resolve(response);
            }

            @Override
            public void onAuthenticationError(int errorCode, CharSequence errString) {
                call.reject(errString != null ? errString.toString() : "Authentication failed");
            }
        };
    }

    private JSObject fallOpen(String reason) {
        JSObject result = new JSObject();
        result.put("unlocked", true);
        result.put("fallback", true);
        result.put("reason", reason);
        return result;
    }
}
