import React, { useState } from 'react';

interface CodePlaygroundProps {
  lang?: 'en' | 'id';
}

const tabs = ['curl', 'javascript', 'python', 'nodejs'] as const;
type Tab = typeof tabs[number];

const tabLabels: Record<Tab, string> = {
  curl: 'cURL',
  javascript: 'JavaScript',
  python: 'Python',
  nodejs: 'Node.js',
};

export function CodePlayground({ lang = 'en' }: CodePlaygroundProps) {
  const [tab, setTab] = useState<Tab>('curl');
  const [copied, setCopied] = useState(false);

  const snippets: Record<Tab, string> = {
    curl: `# Allow the recipient once\ncurl -X POST http://localhost:3000/recipients/allow \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"phone":"6281234567890","label":"Demo"}'\n\n# Send with an idempotency key\ncurl -X POST http://localhost:3000/messages/send \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -H "Idempotency-Key: demo-001" \\\n  -d '{"to":"6281234567890","text":"Hello from Wago"}'`,
    javascript: `const headers = {\n  Authorization: "Bearer YOUR_API_KEY",\n  "Content-Type": "application/json"\n};\n\nawait fetch("http://localhost:3000/recipients/allow", {\n  method: "POST",\n  headers,\n  body: JSON.stringify({ phone: "6281234567890", label: "Demo" })\n});\n\nconst response = await fetch("http://localhost:3000/messages/send", {\n  method: "POST",\n  headers: { ...headers, "Idempotency-Key": "demo-001" },\n  body: JSON.stringify({ to: "6281234567890", text: "Hello from Wago" })\n});\n\nconsole.log(await response.json());`,
    python: `import requests\n\nheaders = {"Authorization": "Bearer YOUR_API_KEY"}\n\nrequests.post(\n    "http://localhost:3000/recipients/allow",\n    json={"phone": "6281234567890", "label": "Demo"},\n    headers=headers,\n).raise_for_status()\n\nresponse = requests.post(\n    "http://localhost:3000/messages/send",\n    json={"to": "6281234567890", "text": "Hello from Wago"},\n    headers={**headers, "Idempotency-Key": "demo-001"},\n)\nprint(response.json())`,
    nodejs: `import axios from 'axios';\n\nconst client = axios.create({\n  baseURL: 'http://localhost:3000',\n  headers: { Authorization: 'Bearer YOUR_API_KEY' }\n});\n\nawait client.post('/recipients/allow', {\n  phone: '6281234567890',\n  label: 'Demo'\n});\n\nconst { data } = await client.post(\n  '/messages/send',\n  { to: '6281234567890', text: 'Hello from Wago' },\n  { headers: { 'Idempotency-Key': 'demo-001' } }\n);\n\nconsole.log(data);`
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippets[tab]);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ border: '1px solid #262626', borderRadius: '8px', overflow: 'hidden', background: '#111' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a1a1a', overflowX: 'auto' }}>
        <div style={{ display: 'flex', minWidth: 'max-content' }}>
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '10px 16px',
                fontSize: '13px',
                fontFamily: 'Inter, system-ui, sans-serif',
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? '2px solid #fafafa' : '2px solid transparent',
                color: tab === t ? '#fafafa' : '#52525b',
                cursor: 'pointer',
              }}
            >
              {tabLabels[t]}
            </button>
          ))}
        </div>
        <button
          onClick={() => void handleCopy()}
          style={{
            padding: '6px 12px',
            margin: '0 8px',
            fontSize: '12px',
            fontFamily: 'Inter, system-ui, sans-serif',
            color: '#a1a1aa',
            background: 'none',
            border: '1px solid #262626',
            borderRadius: '5px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {copied ? (lang === 'id' ? 'Tersalin' : 'Copied') : (lang === 'id' ? 'Salin' : 'Copy')}
        </button>
      </div>
      <pre style={{ margin: 0, padding: '20px', overflowX: 'auto', fontSize: '13px', lineHeight: 1.7, color: '#d4d4d8' }}>
        <code>{snippets[tab]}</code>
      </pre>
    </div>
  );
}
