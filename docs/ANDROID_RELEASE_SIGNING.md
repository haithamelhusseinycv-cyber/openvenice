# Android release signing

OpenVenice and the FaceFusion companion use signature-level IPC, so both production APKs must be signed with the same private key.

## One-time key creation

Create and retain the keystore outside the repository:

```bash
keytool -genkeypair -v \
  -keystore openvenice-release.jks \
  -alias openvenice \
  -keyalg RSA -keysize 4096 -validity 10000
base64 -w 0 openvenice-release.jks
```

Back up the keystore and passwords securely. Losing them prevents future in-place application updates.

## Required GitHub Actions secrets

Configure these repository secrets:

- `OPENVENICE_RELEASE_KEYSTORE_BASE64`
- `OPENVENICE_RELEASE_STORE_PASSWORD`
- `OPENVENICE_RELEASE_KEY_ALIAS`
- `OPENVENICE_RELEASE_KEY_PASSWORD`

Never use repository variables for these values and never commit the keystore.

## Release process

Run **Build signed Android release APKs** manually from GitHub Actions. The workflow:

1. fails if any signing secret is missing;
2. tests and builds OpenVenice;
3. checks out the exact reviewed FaceFusion upstream commit;
4. builds both release APKs with the same certificate;
5. verifies both APK signatures and confirms matching SHA-256 certificate fingerprints;
6. publishes both APKs as one short-retention workflow artifact.

The existing debug workflows remain intended only for testing.
