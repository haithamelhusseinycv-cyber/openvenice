import asyncio
import importlib.util
import os
import pathlib
import sys
import types
import unittest
from unittest.mock import patch


class Timeout:
    def __init__(self, **kwargs):
        self.kwargs = kwargs


class TimeoutException(Exception):
    pass


class RequestError(Exception):
    pass


httpx_stub = types.SimpleNamespace(
    Timeout=Timeout,
    TimeoutException=TimeoutException,
    RequestError=RequestError,
    AsyncClient=None,
)
sys.modules.setdefault("httpx", httpx_stub)

PIPE_PATH = pathlib.Path(__file__).with_name("shahy_pipe.py")
SPEC = importlib.util.spec_from_file_location("shahy_pipe", PIPE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class Response:
    def __init__(self, status, payload):
        self.status_code = status
        self.payload = payload
        self.text = str(payload)
        self.is_success = 200 <= status < 300

    def json(self):
        return self.payload


class Client:
    def __init__(self, responses):
        self.responses = list(responses)
        self.requests = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, url, headers, json):
        self.requests.append((url, headers, json))
        return self.responses.pop(0)

    async def get(self, url, follow_redirects=True):
        self.requests.append((url, {}, {}))
        return self.responses.pop(0)


class PipeTests(unittest.TestCase):
    def setUp(self):
        self.pipe = MODULE.Pipe()

    def run_pipe(self, client, body=None):
        MODULE.httpx.AsyncClient = lambda timeout: client
        with patch.dict(os.environ, {"NUBE_API_KEY": "test-key"}, clear=False):
            return asyncio.run(self.pipe.pipe(body or {"messages": [{"role": "user", "content": "hello"}]}))

    def test_payload_allowlist_and_model_override(self):
        payload = self.pipe._payload({"messages": [], "stream": True, "unknown": "drop"}, "model-x")
        self.assertEqual(payload["model"], "model-x")
        self.assertFalse(payload["stream"])
        self.assertNotIn("unknown", payload)

    def test_transient_failure_uses_exactly_one_fallback(self):
        client = Client([
            Response(503, {"error": {"message": "unavailable"}}),
            Response(200, {"choices": [{"message": {"content": "fallback-ok"}}]}),
        ])
        result = self.run_pipe(client)
        self.assertEqual(result, "fallback-ok")
        self.assertEqual([r[2]["model"] for r in client.requests], ["kimi-k2.6", "deepseek-v4-flash"])

    def test_nontechnical_400_does_not_fallback(self):
        client = Client([
            Response(400, {"error": {"message": "blocked by provider policy"}}),
            Response(200, {"choices": [{"message": {"content": "must-not-run"}}]}),
        ])
        result = self.run_pipe(client)
        self.assertIn("blocked by provider policy", result)
        self.assertEqual(len(client.requests), 1)

    def test_auth_failure_does_not_fallback(self):
        client = Client([Response(401, {"error": {"message": "invalid key"}})])
        result = self.run_pipe(client)
        self.assertIn("authentication/billing error (401)", result)
        self.assertEqual(len(client.requests), 1)

    def test_system_prompt_is_injected_once(self):
        client = Client([Response(200, {"choices": [{"message": {"content": "ok"}}]})])
        self.run_pipe(client)
        messages = client.requests[0][2]["messages"]
        self.assertEqual(messages[0]["role"], "system")
        self.assertIn("POLICY audit_shahy_venice v1", messages[0]["content"])
        self.assertEqual(sum(m.get("role") == "system" for m in messages), 1)

    def test_policy_is_prepended_even_when_a_system_message_already_exists(self):
        client = Client([Response(200, {"choices": [{"message": {"content": "ok"}}]})])
        self.run_pipe(client, body={"messages": [{"role": "system", "content": "other instructions"}, {"role": "user", "content": "hi"}]})
        messages = client.requests[0][2]["messages"]
        self.assertEqual(messages[0]["role"], "system")
        self.assertIn("POLICY audit_shahy_venice v1", messages[0]["content"])
        self.assertEqual(messages[1]["content"], "other instructions")

    def test_policy_is_not_duplicated_when_already_present(self):
        client = Client([Response(200, {"choices": [{"message": {"content": "ok"}}]})])
        existing = self.pipe.system_prompt
        self.run_pipe(client, body={"messages": [{"role": "system", "content": existing}, {"role": "user", "content": "hi"}]})
        messages = client.requests[0][2]["messages"]
        self.assertEqual(sum(MODULE.POLICY_MARKER in str(m.get("content") or "") for m in messages), 1)

    def test_system_prompt_has_one_product_policy_and_external_provider_boundary(self):
        prompt = self.pipe.system_prompt
        self.assertIn("POLICY audit_shahy_venice v1", prompt)
        self.assertIn("product-owned Shahy/Venice policy", prompt)
        self.assertIn("Provider-enforced controls", prompt)
        self.assertIn("not a technical failure", prompt)
        self.assertIn("UNDER-18 HARD STOP", prompt)
        self.assertIn("stated, depicted, or requested as 17 or under", prompt)
        self.assertIn("research, web search, coding", prompt)
        self.assertIn("belong in Venice", prompt)
        self.assertNotIn("Moderation OFF", prompt)
        self.assertNotIn("lawful_only OFF", prompt)
        self.assertNotIn("consensual_only OFF", prompt)
        self.assertNotIn("switch model or tool, and continue", prompt)
        self.assertNotIn("provider or manufacturer rule was erased", prompt.lower())

    def test_coding_request_uses_zen_then_nube_on_technical_failure(self):
        client = Client([
            Response(503, {"error": {"message": "unavailable"}}),
            Response(200, {"choices": [{"message": {"content": "nube-code"}}]}),
        ])
        MODULE.httpx.AsyncClient = lambda timeout: client
        with patch.dict(os.environ, {"NUBE_API_KEY": "nube", "OPENCODE_API_KEY": "zen"}, clear=False):
            result = asyncio.run(self.pipe.pipe({"messages": [{"role": "user", "content": "implement this python function"}]}))
        self.assertEqual(result, "nube-code")
        self.assertEqual(client.requests[0][0], "https://opencode.ai/zen/v1/responses")
        self.assertEqual(client.requests[0][2]["model"], "kimi-k2.7-code")
        self.assertEqual(client.requests[1][2]["model"], "kimi-k2.6")

    def test_zen_policy_refusal_is_not_routed_around(self):
        client = Client([
            Response(400, {"error": {"message": "request refused by provider safety policy"}}),
            Response(200, {"choices": [{"message": {"content": "must-not-run"}}]}),
        ])
        MODULE.httpx.AsyncClient = lambda timeout: client
        with patch.dict(os.environ, {"NUBE_API_KEY": "nube", "OPENCODE_API_KEY": "zen"}, clear=False):
            result = asyncio.run(self.pipe.pipe({"messages": [{"role": "user", "content": "debug this python function"}]}))
        self.assertIn("request refused by provider safety policy", result)
        self.assertEqual(len(client.requests), 1)

    def test_zen_hop_uses_responses_shape_and_returns_its_text(self):
        client = Client([
            Response(200, {
                "id": "resp_1",
                "output": [
                    {"type": "message", "content": [{"type": "output_text", "text": "zen-code-ok"}]},
                ],
            }),
        ])
        MODULE.httpx.AsyncClient = lambda timeout: client
        with patch.dict(os.environ, {"NUBE_API_KEY": "nube", "OPENCODE_API_KEY": "zen"}, clear=False):
            result = asyncio.run(self.pipe.pipe({"messages": [{"role": "user", "content": "refactor this typescript endpoint"}]}))
        self.assertEqual(result, "zen-code-ok")
        self.assertEqual(len(client.requests), 1)
        url, _headers, payload = client.requests[0]
        self.assertEqual(url, "https://opencode.ai/zen/v1/responses")
        self.assertEqual(payload["model"], "kimi-k2.7-code")
        self.assertIn("input", payload)
        self.assertFalse(payload["stream"])
        self.assertNotIn("temperature", payload)
        self.assertNotIn("top_p", payload)

    def test_zen_hop_maps_system_messages_to_instructions(self):
        payload = self.pipe._responses_payload(
            {"messages": [
                {"role": "system", "content": "be terse"},
                {"role": "user", "content": "hi"},
            ]},
            "kimi-k2.7-code",
        )
        self.assertEqual(payload["instructions"], "be terse")
        self.assertEqual(payload["input"], "user: hi")

    def test_zen_hop_handles_plain_output_text_fallback(self):
        client = Client([Response(200, {"output_text": "plain-text-ok"})])
        MODULE.httpx.AsyncClient = lambda timeout: client
        with patch.dict(os.environ, {"NUBE_API_KEY": "nube", "OPENCODE_API_KEY": "zen"}, clear=False):
            result = asyncio.run(self.pipe.pipe({"messages": [{"role": "user", "content": "debug this python traceback"}]}))
        self.assertEqual(result, "plain-text-ok")

    def test_non_coding_request_never_calls_zen(self):
        client = Client([Response(200, {"choices": [{"message": {"content": "plain"}}]})])
        MODULE.httpx.AsyncClient = lambda timeout: client
        with patch.dict(os.environ, {"NUBE_API_KEY": "nube", "OPENCODE_API_KEY": "zen"}, clear=False):
            result = asyncio.run(self.pipe.pipe({"messages": [{"role": "user", "content": "summarize this contract"}]}))
        self.assertEqual(result, "plain")
        self.assertTrue(all("/responses" not in r[0] for r in client.requests))

    def test_search_tools_are_injected_when_exa_key_is_set(self):
        client = Client([Response(200, {"choices": [{"message": {"content": "ok"}}]})])
        MODULE.httpx.AsyncClient = lambda timeout: client
        with patch.dict(os.environ, {"NUBE_API_KEY": "nube", "EXA_API_KEY": "exa"}, clear=False):
            asyncio.run(self.pipe.pipe({"messages": [{"role": "user", "content": "latest FRA circular"}]}))
        tools = client.requests[0][2]["tools"]
        names = {(tool.get("function") or {}).get("name") for tool in tools}
        self.assertIn("search_web", names)
        self.assertIn("fetch_url", names)

    def test_tool_calls_are_returned_for_open_webui(self):
        payload = {"choices": [{"message": {"content": None, "tool_calls": [{"id": "call-1"}]}}]}
        client = Client([Response(200, payload)])
        self.assertEqual(self.run_pipe(client), payload)

    def test_missing_key_fails_closed(self):
        with patch.dict(os.environ, {}, clear=True):
            result = asyncio.run(self.pipe.pipe({"messages": []}))
        self.assertIn("NUBE_API_KEY is not available", result)


if __name__ == "__main__":
    unittest.main()
