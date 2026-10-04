# Provider credential storage

Venice and Qwen credentials remain in memory during the current app/page session. Legacy plaintext session-storage keys are consumed once and removed. Plaintext credentials are not written back to localStorage or sessionStorage.

Venice's existing Android encrypted device-vault remembering and passphrase-encrypted browser remembering remain available. Secure remembered credentials can be restored by their existing flows. Temporary browser credentials and Qwen keys must be entered again after a full page reload; provider URLs and model choices remain persisted. This intentionally replaces plaintext session persistence.

VoiceTut authentication still uses constant-time comparison of configured API keys. Its in-memory quotas now use independent random 128-bit principal identifiers stable for the lifetime of the authenticator, rather than a truncated unsalted key hash. Service restarts already reset these in-memory quotas.

Regression tests cover plaintext cleanup, volatile credentials, encrypted remembering, wrong-passphrase rejection, Android vault restoration, persisted-settings exclusion and stable distinct quota principals.
