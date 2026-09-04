import os
import unittest
from unittest.mock import patch

from security import (
    ApiKeyAuthenticator,
    AuthenticationError,
    ConfigurationError,
    FixedWindowQuota,
    Metrics,
)


class AuthenticationTests(unittest.TestCase):
    def test_accepts_valid_bearer_without_exposing_key(self):
        auth = ApiKeyAuthenticator(("secret-one",))
        principal = auth.authenticate("Bearer secret-one")
        self.assertEqual(len(principal), 16)
        self.assertNotIn("secret", principal)

    def test_rejects_missing_or_invalid_key(self):
        auth = ApiKeyAuthenticator(("secret-one",))
        with self.assertRaises(AuthenticationError):
            auth.authenticate(None)
        with self.assertRaises(AuthenticationError):
            auth.authenticate("Bearer wrong")

    def test_fails_closed_when_unconfigured(self):
        auth = ApiKeyAuthenticator(())
        with self.assertRaises(ConfigurationError):
            auth.authenticate(None)

    def test_unauthenticated_mode_is_explicit(self):
        auth = ApiKeyAuthenticator((), allow_unauthenticated=True)
        self.assertEqual(auth.authenticate(None), "development")

    def test_environment_supports_key_rotation(self):
        with patch.dict(os.environ, {"VOICETUT_API_KEYS": "old,new"}, clear=False):
            auth = ApiKeyAuthenticator.from_environment()
        self.assertEqual(len(auth.authenticate("Bearer new")), 16)


class QuotaTests(unittest.TestCase):
    def test_enforces_request_limit_and_resets(self):
        quota = FixedWindowQuota(requests=2, characters=100, window_seconds=60)
        self.assertTrue(quota.consume("a", 10, now=0).allowed)
        self.assertTrue(quota.consume("a", 10, now=1).allowed)
        denied = quota.consume("a", 10, now=2)
        self.assertFalse(denied.allowed)
        self.assertEqual(denied.retry_after, 58)
        self.assertTrue(quota.consume("a", 10, now=60).allowed)

    def test_enforces_character_limit_per_principal(self):
        quota = FixedWindowQuota(requests=10, characters=20)
        self.assertTrue(quota.consume("a", 15, now=0).allowed)
        self.assertFalse(quota.consume("a", 6, now=1).allowed)
        self.assertTrue(quota.consume("b", 20, now=1).allowed)


class MetricsTests(unittest.TestCase):
    def test_snapshot_tracks_activity(self):
        metrics = Metrics()
        metrics.increment("requests_total")
        metrics.active(1)
        snapshot = metrics.snapshot()
        self.assertEqual(snapshot["requests_total"], 1)
        self.assertEqual(snapshot["active_synthesis"], 1)


if __name__ == "__main__":
    unittest.main()
