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
    curl: `curl -X POST http://localhost:3000/messages/send \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "6281234567890",
    "text": "Hello from Wago"
  }'`,
    javascript: `const response = await fetch("http://localhost:3000/messages/send", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    to: "6281234567890",
    text: "Hello from Wago"
  })
});

const data = await response.json();`,
    python: `import requests

response = requests.post(
    "http://localhost:3000/messages/send",
    json={"to": "6281234567890", "text": "Hello from Wago"},
    headers={"Authorization": "Bearer YOUR_API_KEY"}
)

print(response.json())`,
    nodejs: `import axios from 'axios';

const { data } = await axios.post(
  'http://localhost:3000/messages/send',
  { to: '6281234567890', text: 'Hello from Wago' },
  { headers: { Authorization: 'Bearer YOUR_API_KEY' } }
);

console.log(data);`
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(snippets[tab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ border: '1px solid #262626', borderRadius: '8px', overflow: 'hidden', background: '#111' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1a1a1a', padding: '0 1px' }}>
        <div style={{ display: 'flex' }}>
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
                transition: 'color 0.15s',
              }}
            >
              {tabLabels[t]}
            </button>
          ))}
        </div>
        <button
          onClick={handleCopy}
          style={{
            padding: '6px 12px',
            marginRight: '8px',
            fontSize: '12px',
            fontFamily: 'Inter, system-ui, sans-serif',
            color: '#71717a',
            background: 'none',
            border: '1px solid #262626',
            borderRadius: '5px',
            cursor: 'pointer',
            transition: 'color 0.15s',
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
