"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authenticatedFetch } from "@/lib/auth";

type Provider = "bedrock" | "openai" | "anthropic" | "google";
type TokenMetadata = { id: string; label: string; scopes: string[]; expiresAt: string; revoked: boolean };

async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(path, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : `Request failed (${response.status})`);
  return body as T;
}

export function AiPanel() {
  const [provider, setProvider] = useState<Provider>("bedrock");
  const [question, setQuestion] = useState("");
  const [consent, setConsent] = useState(false);
  const [answer, setAnswer] = useState("");
  const [coverage, setCoverage] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [keyValue, setKeyValue] = useState("");
  const [keyProvider, setKeyProvider] = useState<Exclude<Provider, "bedrock">>("openai");
  const [configuredKeys, setConfiguredKeys] = useState<string[]>([]);
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [tokens, setTokens] = useState<TokenMetadata[]>([]);
  const [newToken, setNewToken] = useState("");
  const [tokenLabel, setTokenLabel] = useState("");
  const [allowWrite, setAllowWrite] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      readJson<{ keys: { provider: string }[] }>("/ai/keys"),
      readJson<{ enabled: boolean }>("/mcp/settings"),
      readJson<{ tokens: TokenMetadata[] }>("/mcp/tokens"),
    ]).then(([keys, settings, listed]) => {
      if (!active) return;
      setConfiguredKeys(keys.keys.map((key) => key.provider));
      setMcpEnabled(settings.enabled);
      setTokens(listed.tokens);
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Settings unavailable"); });
    return () => { active = false; };
  }, []);

  async function chat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setAnswer("");
    setAiBusy(true);
    try {
      const result = await readJson<{ answer: string; coverage: string }>("/ai/chat", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, question, consent }),
      });
      setAnswer(result.answer);
      setCoverage(result.coverage);
      setConsent(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not reach assistant"); }
    finally { setAiBusy(false); }
  }

  async function saveKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await readJson("/ai/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: keyProvider, key: keyValue }) });
      setKeyValue("");
      setConfiguredKeys((previous) => [...new Set([...previous, keyProvider])]);
      setNotice("Provider key encrypted and saved. The value is not shown again.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save key"); }
  }

  async function removeKey() {
    if (!window.confirm(`Remove your ${keyProvider} key?`)) return;
    setError(null);
    try {
      const response = await authenticatedFetch(`/ai/keys/${keyProvider}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`Could not remove key (${response.status})`);
      setConfiguredKeys((previous) => previous.filter((value) => value !== keyProvider));
      setNotice("Key removed.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not remove key"); }
  }

  async function toggleMcp() {
    setError(null);
    try {
      const result = await readJson<{ enabled: boolean }>("/mcp/settings", { method: "PATCH",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !mcpEnabled }) });
      setMcpEnabled(result.enabled);
      if (!result.enabled) {
        setNewToken("");
        setTokens((previous) => previous.map((token) => ({ ...token, revoked: true })));
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not change MCP setting"); }
  }

  async function createToken() {
    setError(null);
    setNewToken("");
    try {
      const result = await readJson<{ token: TokenMetadata & { token: string } }>("/mcp/tokens", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: tokenLabel, scopes: allowWrite ? ["read", "write"] : ["read"] }),
      });
      setNewToken(result.token.token);
      setTokens((previous) => [{ ...result.token, revoked: false }, ...previous]);
      setTokenLabel("");
      setAllowWrite(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create token"); }
  }

  async function revoke(id: string) {
    setError(null);
    try {
      const response = await authenticatedFetch(`/mcp/tokens/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`Could not revoke token (${response.status})`);
      setTokens((previous) => previous.map((token) => token.id === id ? { ...token, revoked: true } : token));
      setNewToken("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not revoke token"); }
  }

  return <section className="card ai-card" aria-labelledby="assistant-heading">
    <h2 id="assistant-heading">LifeOS assistant</h2>
    <p className="muted">Answers use your recent records via LifeOS tools. Notes have no vector search yet. This is not medical advice.</p>
    <form onSubmit={chat}>
      <label htmlFor="ai-provider">Provider</label>
      <select id="ai-provider" value={provider} onChange={(event) => setProvider(event.target.value as Provider)}>
        <option value="bedrock">AWS Bedrock (server account)</option><option value="openai">OpenAI (your key)</option>
        <option value="anthropic">Anthropic (your key)</option><option value="google">Google (your key)</option>
      </select>
      <label htmlFor="ai-question">Question</label>
      <textarea id="ai-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={2000} rows={3} required />
      <label className="ai-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required />
        I agree to send the relevant recent LifeOS records to this AI provider for this question.</label>
      <button disabled={aiBusy || !consent}>{aiBusy ? "Thinking…" : "Ask"}</button>
    </form>
    {answer && <div role="status" className="ai-answer"><p>{answer}</p><small>{coverage}</small></div>}
    <section aria-labelledby="ai-keys-heading" className="ai-section">
      <h3 id="ai-keys-heading">Bring your own AI key</h3>
      <p className="muted">Keys are encrypted server-side; configure an encryption secret and the provider model before use.</p>
      <form onSubmit={saveKey}>
        <label htmlFor="key-provider">Provider</label>
        <select id="key-provider" value={keyProvider} onChange={(event) => setKeyProvider(event.target.value as Exclude<Provider, "bedrock">)}>
          <option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="google">Google</option>
        </select>
        <label htmlFor="key-value">API key (stored encrypted)</label>
        <input id="key-value" type="password" autoComplete="off" value={keyValue} onChange={(event) => setKeyValue(event.target.value)} minLength={20} maxLength={2048} required />
        <button type="submit">Save key</button>
      </form>
      {configuredKeys.includes(keyProvider) && <button className="ai-secondary" type="button" onClick={removeKey}>Remove saved {keyProvider} key</button>}
    </section>
    <section aria-labelledby="mcp-heading" className="ai-section">
      <h3 id="mcp-heading">External MCP access</h3>
      <p className="muted">Off by default. A read token exposes your finance, food, notes and goal data; write access can add notes and workouts. Turning access off revokes every token.</p>
      <button className="ai-secondary" type="button" onClick={toggleMcp}>{mcpEnabled ? "Disable MCP and revoke tokens" : "Enable MCP"}</button>
      {mcpEnabled && <div>
        <label htmlFor="token-label">Device label</label><input id="token-label" maxLength={60} value={tokenLabel} onChange={(event) => setTokenLabel(event.target.value)} />
        <label className="ai-consent"><input type="checkbox" checked={allowWrite} onChange={(event) => setAllowWrite(event.target.checked)} />Allow write tools</label>
        <button type="button" onClick={createToken} disabled={tokenLabel.trim().length < 2}>Create token</button>
      </div>}
      {newToken && <p role="status">Copy this token now; it will not be displayed again: <code>{newToken}</code></p>}
      <ul className="life-results">{tokens.map((token) => <li key={token.id}>{token.label} · {token.scopes.join(", ")} · {token.revoked ? "revoked" : `expires ${new Date(token.expiresAt).toLocaleDateString()}`}
        {!token.revoked && <button type="button" onClick={() => revoke(token.id)}>Revoke</button>}</li>)}</ul>
    </section>
    {error && <p role="alert" className="error">{error}</p>}
    {notice && <p role="status" className="muted">{notice}</p>}
  </section>;
}
